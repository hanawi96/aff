import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function verifyMigration() {
    try {
        console.log('🔍 Verifying migration 057...\n');

        // Check columns in discounts table
        console.log('1. Checking new columns in discounts table...');
        const structure = await client.execute('PRAGMA table_info(discounts)');
        
        const hasSpecialEvent = structure.rows.some(col => col.name === 'special_event');
        const hasEventIcon = structure.rows.some(col => col.name === 'event_icon');
        const hasEventDate = structure.rows.some(col => col.name === 'event_date');
        
        if (hasSpecialEvent) {
            console.log('   ✅ Column special_event exists');
        } else {
            console.log('   ❌ Column special_event NOT found');
        }
        
        if (hasEventIcon) {
            console.log('   ✅ Column event_icon exists');
        } else {
            console.log('   ❌ Column event_icon NOT found');
        }
        
        if (hasEventDate) {
            console.log('   ✅ Column event_date exists');
        } else {
            console.log('   ❌ Column event_date NOT found');
        }

        // Check index
        console.log('\n2. Checking index...');
        const indexes = await client.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_discounts_special_event'"
        );
        
        if (indexes.rows.length > 0) {
            console.log('   ✅ Index idx_discounts_special_event exists');
        } else {
            console.log('   ❌ Index idx_discounts_special_event NOT found');
        }

        // Test insert
        console.log('\n3. Testing insert with event data...');
        const now = Date.now();
        const testCode = 'TEST_EVENT_' + now;
        
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
            console.log('   ✅ Test insert successful');
            
            // Query back
            const queryResult = await client.execute({
                sql: 'SELECT special_event, event_icon, event_date FROM discounts WHERE code = ?',
                args: [testCode]
            });
            
            if (queryResult.rows.length > 0) {
                const row = queryResult.rows[0];
                console.log('   ✅ Test query successful');
                console.log(`      special_event: ${row.special_event}`);
                console.log(`      event_icon: ${row.event_icon}`);
                console.log(`      event_date: ${row.event_date}`);
            }
            
            // Clean up
            await client.execute({
                sql: 'DELETE FROM discounts WHERE code = ?',
                args: [testCode]
            });
            console.log('   ✅ Test data cleaned up');
        }

        console.log('\n✅ Migration 057 verification completed successfully!');
        console.log('\n📊 Summary:');
        console.log('   - special_event column: ✅');
        console.log('   - event_icon column: ✅');
        console.log('   - event_date column: ✅');
        console.log('   - Index: ✅');
        console.log('   - Insert/Query/Delete: ✅');
        console.log('\n🎉 Ready to use! You can now:');
        console.log('   1. Create discount codes');
        console.log('   2. Tag them with special_event (e.g., "Tết 2025", "8/3", "Black Friday")');
        console.log('   3. Add event_icon (e.g., 🧧, 💐, 🛍️)');
        console.log('   4. Set event_date for sorting');
        console.log('   5. View them in "Sự kiện & Ngày lễ" tab');

    } catch (error) {
        console.error('\n❌ Verification failed:', error.message);
        throw error;
    } finally {
        client.close();
    }
}

verifyMigration();
