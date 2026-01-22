import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fixForeignKey() {
    try {
        console.log('🔧 Fixing foreign key issue...\n');
        
        console.log('Option 1: Create empty discount_campaigns table (dummy table)');
        console.log('This allows the FK constraint to work without errors.\n');
        
        // Create minimal discount_campaigns table structure
        console.log('Creating discount_campaigns table...');
        await client.execute(`
            CREATE TABLE IF NOT EXISTS discount_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                created_at_unix INTEGER NOT NULL,
                updated_at_unix INTEGER NOT NULL
            )
        `);
        console.log('✅ Table created (empty, just for FK constraint)\n');
        
        // Test insert
        console.log('Testing insert into discounts...');
        const now = Date.now();
        const testCode = 'TEST_FK_' + now;
        
        const insertResult = await client.execute({
            sql: `INSERT INTO discounts (
                code, title, type, discount_value,
                special_event, event_icon, event_date,
                expiry_date, active, visible,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                testCode,
                'Test Event Discount',
                'fixed',
                50000,
                'Tết 2025',
                '🧧',
                '2025-01-28',
                '2025-02-05',
                1,
                1,
                now,
                now
            ]
        });

        if (insertResult.rowsAffected > 0) {
            console.log('✅ Test insert successful!\n');
            
            // Clean up test data
            await client.execute({
                sql: 'DELETE FROM discounts WHERE code = ?',
                args: [testCode]
            });
            console.log('✅ Test data cleaned up\n');
        }
        
        console.log('✅ Fix completed successfully!');
        console.log('\n📝 Note: The discount_campaigns table now exists but is empty.');
        console.log('   It\'s only there to satisfy the FK constraint on campaign_id column.');
        console.log('   We use special_event, event_icon, event_date columns instead.');
        console.log('   The campaign_id column in discounts will remain NULL and unused.');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        throw error;
    } finally {
        client.close();
    }
}

fixForeignKey();
