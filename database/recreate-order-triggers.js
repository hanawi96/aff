import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function recreateOrderTriggers() {
    console.log('🔧 Recreating order_items triggers');
    console.log('=' .repeat(60));

    try {
        // Drop existing triggers first
        console.log('\n🗑️ Dropping existing triggers...');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_insert_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_update_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_delete_update_total');
        console.log('✅ Dropped existing triggers');

        // Create INSERT trigger
        console.log('\n📋 Creating INSERT trigger...');
        await client.execute(`
            CREATE TRIGGER trg_order_items_insert_update_total
            AFTER INSERT ON order_items
            BEGIN
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(price * quantity), 0)
                    FROM order_items
                    WHERE order_id = NEW.order_id
                )
                WHERE id = NEW.order_id;
            END
        `);
        console.log('✅ Created trg_order_items_insert_update_total');

        // Create UPDATE trigger
        console.log('\n📋 Creating UPDATE trigger...');
        await client.execute(`
            CREATE TRIGGER trg_order_items_update_update_total
            AFTER UPDATE ON order_items
            BEGIN
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(price * quantity), 0)
                    FROM order_items
                    WHERE order_id = NEW.order_id
                )
                WHERE id = NEW.order_id;
            END
        `);
        console.log('✅ Created trg_order_items_update_update_total');

        // Create DELETE trigger
        console.log('\n📋 Creating DELETE trigger...');
        await client.execute(`
            CREATE TRIGGER trg_order_items_delete_update_total
            AFTER DELETE ON order_items
            BEGIN
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(price * quantity), 0)
                    FROM order_items
                    WHERE order_id = OLD.order_id
                )
                WHERE id = OLD.order_id;
            END
        `);
        console.log('✅ Created trg_order_items_delete_update_total');

        // Verify triggers
        console.log('\n🔍 Verifying triggers...');
        const triggersResult = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='trigger' AND tbl_name='order_items'
            ORDER BY name
        `);
        
        console.log('Triggers on order_items table:');
        triggersResult.rows.forEach(row => {
            console.log(`  - ${row.name}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ Order triggers recreated successfully!');
        
    } catch (error) {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Run
recreateOrderTriggers().catch(console.error);
