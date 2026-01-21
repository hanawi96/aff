import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fixOrderTriggers() {
    console.log('🔧 Fixing order_items triggers (price → product_price)');
    console.log('=' .repeat(60));

    try {
        // Drop existing triggers
        console.log('\n🗑️ Dropping old triggers...');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_insert_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_update_update_total');
        await client.execute('DROP TRIGGER IF EXISTS trg_order_items_delete_update_total');
        console.log('✅ Dropped old triggers');

        // Create INSERT trigger with correct column name
        console.log('\n📋 Creating INSERT trigger...');
        await client.execute(`
            CREATE TRIGGER trg_order_items_insert_update_total
            AFTER INSERT ON order_items
            BEGIN
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(product_price * quantity), 0)
                    FROM order_items
                    WHERE order_id = NEW.order_id
                )
                WHERE id = NEW.order_id;
            END
        `);
        console.log('✅ Created trg_order_items_insert_update_total');

        // Create UPDATE trigger with correct column name
        console.log('\n📋 Creating UPDATE trigger...');
        await client.execute(`
            CREATE TRIGGER trg_order_items_update_update_total
            AFTER UPDATE ON order_items
            BEGIN
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(product_price * quantity), 0)
                    FROM order_items
                    WHERE order_id = NEW.order_id
                )
                WHERE id = NEW.order_id;
            END
        `);
        console.log('✅ Created trg_order_items_update_update_total');

        // Create DELETE trigger with correct column name
        console.log('\n📋 Creating DELETE trigger...');
        await client.execute(`
            CREATE TRIGGER trg_order_items_delete_update_total
            AFTER DELETE ON order_items
            BEGIN
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(product_price * quantity), 0)
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
            SELECT name, sql FROM sqlite_master 
            WHERE type='trigger' AND tbl_name='order_items' AND name LIKE 'trg_order_items%'
            ORDER BY name
        `);
        
        console.log('\nFixed triggers:');
        triggersResult.rows.forEach(row => {
            console.log(`\n  ✅ ${row.name}`);
            console.log(`     ${row.sql.substring(0, 100)}...`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ Triggers fixed successfully!');
        console.log('   Changed: price → product_price');
        
    } catch (error) {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

fixOrderTriggers().catch(console.error);
