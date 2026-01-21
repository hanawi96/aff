import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function recreateIndexes() {
    console.log('🔧 Recreating indexes for orders table');
    console.log('=' .repeat(60));

    try {
        console.log('\n📋 Creating indexes...');
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code)
        `);
        console.log('✅ Created idx_orders_referral_code');
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)
        `);
        console.log('✅ Created idx_orders_customer_phone');
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_created_at_unix ON orders(created_at_unix)
        `);
        console.log('✅ Created idx_orders_created_at_unix');
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
        `);
        console.log('✅ Created idx_orders_status');
        
        // Verify indexes
        console.log('\n🔍 Verifying indexes...');
        const indexesResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='orders'
            ORDER BY name
        `);
        
        console.log('Indexes on orders table:');
        indexesResult.rows.forEach(row => {
            console.log(`  - ${row.name}`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Indexes recreated successfully!');
        
    } catch (error) {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run
recreateIndexes().catch(console.error);
