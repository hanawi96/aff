// Script to get full data of bundle products (ID 133, 134)
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

async function getBundleProducts() {
    try {
        console.log('🔍 Fetching bundle products (ID 133, 134)...\n');
        
        // Get products with all details
        const result = await client.execute({
            sql: `
                SELECT 
                    p.*,
                    GROUP_CONCAT(DISTINCT c.id || ':' || c.name) as categories_data
                FROM products p
                LEFT JOIN product_categories pc ON p.id = pc.product_id
                LEFT JOIN categories c ON pc.category_id = c.id
                WHERE p.id IN (133, 134)
                GROUP BY p.id
                ORDER BY p.id
            `,
            args: []
        });
        
        if (result.rows.length === 0) {
            console.log('❌ No products found with ID 133 or 134');
            return;
        }
        
        console.log(`✅ Found ${result.rows.length} products\n`);
        
        // Format data
        const products = result.rows.map(row => {
            // Parse categories
            let categories = [];
            if (row.categories_data) {
                categories = row.categories_data.split(',').map(cat => {
                    const [id, name] = cat.split(':');
                    return { id: parseInt(id), name };
                });
            }
            
            return {
                id: row.id,
                name: row.name,
                description: row.description || '',
                price: row.price,
                originalPrice: row.original_price || null,
                image: row.image_url || row.image || '/assets/images/product_img/tat-ca-mau.webp',
                stock_quantity: row.stock_quantity || 99,
                maxQuantity: row.stock_quantity || 99,
                is_active: row.is_active,
                categories: categories,
                category_name: categories.length > 0 ? categories[0].name : '',
                category_id: categories.length > 0 ? categories[0].id : null,
                badges: [], // Will be populated if needed
                isBundleProduct: true
            };
        });
        
        // Print formatted JSON
        console.log('📦 BUNDLE PRODUCTS DATA (ready to hardcode):\n');
        console.log(JSON.stringify(products, null, 2));
        
        console.log('\n✅ Done! Copy the JSON above and paste into bundle-products.service.js');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

getBundleProducts();
