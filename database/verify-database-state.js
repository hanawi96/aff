import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function verifyDatabaseState() {
    console.log('🔍 Verifying Database State');
    console.log('=' .repeat(60));

    try {
        // Check orders table schema
        console.log('\n📋 Orders Table Schema:');
        const schemaResult = await client.execute(`
            PRAGMA table_info(orders)
        `);
        
        console.log('\nColumns:');
        schemaResult.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type})`);
        });
        
        const hasOrderDate = schemaResult.rows.some(row => row.name === 'order_date');
        const hasCreatedAtUnix = schemaResult.rows.some(row => row.name === 'created_at_unix');
        
        console.log('\n✅ Column Check:');
        console.log(`  - order_date exists: ${hasOrderDate ? '❌ YES (should be removed)' : '✅ NO (correct)'}`);
        console.log(`  - created_at_unix exists: ${hasCreatedAtUnix ? '✅ YES (correct)' : '❌ NO (should exist)'}`);

        // Check indexes
        console.log('\n📋 Indexes on orders table:');
        const indexesResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='orders'
            ORDER BY name
        `);
        
        indexesResult.rows.forEach(row => {
            console.log(`  - ${row.name}`);
        });

        // Check triggers
        console.log('\n📋 Triggers on order_items table:');
        const triggersResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='trigger' AND tbl_name='order_items'
            ORDER BY name
        `);
        
        triggersResult.rows.forEach(row => {
            console.log(`  - ${row.name}`);
        });

        // Check order_items schema
        console.log('\n📋 Order Items Table Schema:');
        const orderItemsSchema = await client.execute(`
            PRAGMA table_info(order_items)
        `);
        
        console.log('\nColumns:');
        orderItemsSchema.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type})`);
        });
        
        const hasProductId = orderItemsSchema.rows.some(row => row.name === 'product_id');
        console.log(`\n✅ product_id exists in order_items: ${hasProductId ? '✅ YES (correct)' : '❌ NO (should exist)'}`);

        // Count records
        console.log('\n📊 Record Counts:');
        const ordersCount = await client.execute('SELECT COUNT(*) as total FROM orders');
        const orderItemsCount = await client.execute('SELECT COUNT(*) as total FROM order_items');
        
        console.log(`  - Orders: ${ordersCount.rows[0]?.total}`);
        console.log(`  - Order Items: ${orderItemsCount.rows[0]?.total}`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ Database verification complete!');
        
    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run
verifyDatabaseState().catch(console.error);
