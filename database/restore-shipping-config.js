// Restore shipping config to cost_config table
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function restoreShippingConfig() {
    try {
        console.log('🚀 Starting to restore shipping config...\n');

        // Check current data
        console.log('📊 Current cost_config data:');
        const current = await client.execute('SELECT * FROM cost_config ORDER BY id');
        console.table(current.rows);

        // Insert shipping configs
        const configs = [
            {
                item_name: 'default_shipping_cost',
                item_cost: 26000,
                is_default: 1,
                display_name: 'Chi phí ship mặc định'
            },
            {
                item_name: 'customer_shipping_fee',
                item_cost: 38000,
                is_default: 1,
                display_name: 'Phí ship khách'
            }
        ];

        console.log('\n✨ Inserting shipping configs...');
        for (const config of configs) {
            await client.execute({
                sql: `
                    INSERT INTO cost_config (item_name, item_cost, is_default, display_name)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(item_name) DO UPDATE SET
                        item_cost = excluded.item_cost,
                        is_default = excluded.is_default,
                        display_name = excluded.display_name,
                        updated_at = CURRENT_TIMESTAMP
                `,
                args: [config.item_name, config.item_cost, config.is_default, config.display_name]
            });
            console.log(`✅ Inserted/Updated: ${config.item_name} = ${config.item_cost}đ`);
        }

        // Verify
        console.log('\n📊 Updated cost_config data:');
        const updated = await client.execute('SELECT * FROM cost_config ORDER BY id');
        console.table(updated.rows);

        console.log('\n✅ Done! Shipping configs restored successfully.');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

restoreShippingConfig();
