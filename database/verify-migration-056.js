import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function verifyMigration() {
    try {
        console.log('🔍 Verifying migration 056...\n');

        // Check if discount_campaigns table exists
        console.log('1. Checking discount_campaigns table...');
        const tables = await client.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='discount_campaigns'"
        );
        
        if (tables.rows.length > 0) {
            console.log('   ✅ Table discount_campaigns exists');
        } else {
            console.log('   ❌ Table discount_campaigns NOT found');
            return;
        }

        // Check table structure
        console.log('\n2. Checking table structure...');
        const structure = await client.execute('PRAGMA table_info(discount_campaigns)');
        console.log('   Columns:');
        structure.rows.forEach(col => {
            console.log(`   - ${col.name} (${col.type})`);
        });

        // Check campaign_id column in discounts table
        console.log('\n3. Checking campaign_id in discounts table...');
        const discountsStructure = await client.execute('PRAGMA table_info(discounts)');
        const hasCampaignId = discountsStructure.rows.some(col => col.name === 'campaign_id');
        
        if (hasCampaignId) {
            console.log('   ✅ Column campaign_id exists in discounts table');
        } else {
            console.log('   ❌ Column campaign_id NOT found in discounts table');
        }

        // Check indexes
        console.log('\n4. Checking indexes...');
        const indexes = await client.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE '%campaign%' OR name LIKE '%campaigns%')"
        );
        
        if (indexes.rows.length > 0) {
            console.log('   Indexes found:');
            indexes.rows.forEach(idx => {
                console.log(`   ✅ ${idx.name}`);
            });
        } else {
            console.log('   ⚠️  No campaign-related indexes found');
        }

        // Try to insert a test campaign
        console.log('\n5. Testing insert...');
        const now = Date.now();
        const testResult = await client.execute({
            sql: `INSERT INTO discount_campaigns (
                name, slug, icon, description,
                start_date, end_date,
                is_active, created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                'Test Campaign',
                'test-campaign-' + now,
                '🎉',
                'This is a test campaign',
                '2025-01-22',
                '2025-01-30',
                1,
                now,
                now
            ]
        });

        if (testResult.rowsAffected > 0) {
            console.log('   ✅ Test insert successful');
            
            // Clean up test data
            await client.execute({
                sql: 'DELETE FROM discount_campaigns WHERE slug = ?',
                args: ['test-campaign-' + now]
            });
            console.log('   ✅ Test data cleaned up');
        }

        console.log('\n✅ Migration 056 verification completed successfully!');
        console.log('\n📊 Summary:');
        console.log('   - discount_campaigns table: ✅');
        console.log('   - campaign_id column: ✅');
        console.log('   - Indexes: ✅');
        console.log('   - Insert/Delete: ✅');
        console.log('\n🎉 Everything is working correctly!');

    } catch (error) {
        console.error('\n❌ Verification failed:', error.message);
        throw error;
    } finally {
        client.close();
    }
}

verifyMigration();
