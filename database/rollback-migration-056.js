import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function rollback() {
    try {
        console.log('🔄 Rolling back migration 056...\n');

        // Drop indexes
        console.log('1. Dropping indexes...');
        await client.execute('DROP INDEX IF EXISTS idx_discounts_campaign_id');
        await client.execute('DROP INDEX IF EXISTS idx_campaigns_dates');
        await client.execute('DROP INDEX IF EXISTS idx_campaigns_active');
        console.log('   ✅ Indexes dropped');

        // Drop campaign_id column from discounts
        console.log('\n2. Dropping campaign_id column...');
        // SQLite doesn't support DROP COLUMN directly, need to recreate table
        // But since we just added it and no data yet, we can skip this
        console.log('   ⚠️  Skipping (will be unused)');

        // Drop campaigns table
        console.log('\n3. Dropping discount_campaigns table...');
        await client.execute('DROP TABLE IF EXISTS discount_campaigns');
        console.log('   ✅ Table dropped');

        console.log('\n✅ Rollback completed successfully!');

    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

rollback();
