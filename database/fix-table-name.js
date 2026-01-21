import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fixTableName() {
    console.log('🔧 Fixing table name: orders_new → orders');
    console.log('=' .repeat(60));

    try {
        // Check if orders_new exists
        console.log('\n🔍 Checking current tables...');
        const tablesResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('orders', 'orders_new')
            ORDER BY name
        `);
        
        console.log('Current tables:', tablesResult.rows.map(r => r.name));
        
        const hasOrdersNew = tablesResult.rows.some(r => r.name === 'orders_new');
        const hasOrders = tablesResult.rows.some(r => r.name === 'orders');
        
        if (!hasOrdersNew && hasOrders) {
            console.log('✅ Table "orders" already exists. No fix needed.');
            return;
        }
        
        if (!hasOrdersNew) {
            console.log('❌ Table "orders_new" does not exist. Cannot fix.');
            return;
        }
        
        console.log('\n🔧 Renaming orders_new to orders...');
        
        // Drop triggers first
        console.log('🗑️ Dropping triggers...');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_insert_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_update_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_delete_update_total');
        console.log('✅ Dropped triggers');
        
        // If orders table exists, drop it first
        if (hasOrders) {
            console.log('⚠️ Dropping existing orders table...');
            await client.execute('DROP TABLE orders');
            console.log('✅ Dropped old orders table');
        }
        
        // Rename orders_new to orders
        await client.execute('ALTER TABLE orders_new RENAME TO orders');
        console.log('✅ Renamed orders_new to orders');
        
        // Verify
        console.log('\n🔍 Verifying...');
        const verifyResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name = 'orders'
        `);
        
        if (verifyResult.rows.length === 0) {
            throw new Error('❌ Verification failed: orders table not found');
        }
        
        const countResult = await client.execute(`
            SELECT COUNT(*) as total FROM orders
        `);
        
        console.log('✅ Table "orders" exists');
        console.log(`✅ Total rows: ${countResult.rows[0]?.total}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Fix completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Fix failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run fix
fixTableName().catch(console.error);
