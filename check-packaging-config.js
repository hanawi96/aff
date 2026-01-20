// Check packaging config from database
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkPackagingConfig() {
    try {
        console.log('🔍 Checking packaging config from database...\n');

        // Get all cost_config items
        const result = await client.execute(`
            SELECT id, item_name, item_cost, is_default, display_name, category_id
            FROM cost_config
            WHERE is_default = 1
            ORDER BY item_name ASC
        `);

        console.log('📦 All default cost_config items:');
        console.log('='.repeat(100));
        console.table(result.rows);

        // Filter packaging items
        const packagingKeywords = ['bag', 'box', 'túi', 'hộp', 'thank', 'paper', 'bang', 'thiệp', 'giấy'];
        const packagingItems = result.rows.filter(row => {
            const itemName = (row.item_name || '').toLowerCase();
            const displayName = (row.display_name || '').toLowerCase();
            return packagingKeywords.some(keyword => 
                itemName.includes(keyword) || displayName.includes(keyword)
            );
        });

        console.log('\n📦 Packaging items only:');
        console.log('='.repeat(100));
        console.table(packagingItems);

        // Show specific items we're looking for
        console.log('\n🔎 Looking for specific items:');
        console.log('='.repeat(100));
        const searchItems = ['bag_zip', 'bag_red', 'box_shipping', 'box_carton', 'thank_card', 'paper_print', 'bang_dinh'];
        
        searchItems.forEach(itemName => {
            const found = result.rows.find(row => row.item_name === itemName);
            if (found) {
                console.log(`✅ ${itemName.padEnd(20)} → ${found.display_name || 'N/A'} (${found.item_cost}đ)`);
            } else {
                console.log(`❌ ${itemName.padEnd(20)} → NOT FOUND`);
            }
        });

        console.log('\n✨ Summary:');
        console.log('='.repeat(100));
        console.log(`Total items: ${result.rows.length}`);
        console.log(`Packaging items: ${packagingItems.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkPackagingConfig();
