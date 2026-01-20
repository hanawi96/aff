// Update category for shipping configs
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function updateShippingCategory() {
    try {
        console.log('🚀 Updating category for shipping configs...\n');

        // Get "Khác" category ID
        const category = await client.execute(`
            SELECT id FROM material_categories WHERE name = 'khac' LIMIT 1
        `);

        if (category.rows.length === 0) {
            console.error('❌ Category "khac" not found!');
            process.exit(1);
        }

        const categoryId = category.rows[0].id;
        console.log(`✅ Found category "Khác" with ID: ${categoryId}\n`);

        // Update shipping configs
        await client.execute({
            sql: `
                UPDATE cost_config 
                SET category_id = ? 
                WHERE item_name IN ('default_shipping_cost', 'customer_shipping_fee')
            `,
            args: [categoryId]
        });

        console.log('✅ Updated category for shipping configs\n');

        // Verify
        console.log('📊 Shipping configs:');
        const result = await client.execute(`
            SELECT cc.*, mc.name as category_name 
            FROM cost_config cc
            LEFT JOIN material_categories mc ON cc.category_id = mc.id
            WHERE cc.item_name IN ('default_shipping_cost', 'customer_shipping_fee')
        `);
        console.table(result.rows);

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

updateShippingCategory();
