const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function updateProductBadges() {
    try {
        console.log('Updating product badges...\n');
        
        // Get all products
        const result = await client.execute({
            sql: 'SELECT id, name FROM products WHERE is_active = 1',
            args: []
        });
        
        console.log(`Found ${result.rows.length} active products\n`);
        
        let updatedCount = 0;
        
        // Update all products with handmade and chemical-free badges
        // You can customize this logic based on product names or categories
        for (const product of result.rows) {
            const productName = product.name.toLowerCase();
            
            // All "vòng" products are handmade and chemical-free
            const isVongProduct = productName.includes('vòng') || 
                                  productName.includes('bi bạc') ||
                                  productName.includes('hổ phách') ||
                                  productName.includes('đầu tâm') ||
                                  productName.includes('bồ đề');
            
            if (isVongProduct) {
                await client.execute({
                    sql: 'UPDATE products SET is_handmade = 1, is_chemical_free = 1 WHERE id = ?',
                    args: [product.id]
                });
                console.log(`✓ Updated: ${product.name}`);
                updatedCount++;
            }
        }
        
        console.log(`\n✅ Updated ${updatedCount} products with badges!`);
        console.log('\nBadges added:');
        console.log('🟡 Thủ công 100% (Orange badge)');
        console.log('🟢 Không hóa chất (Green badge)');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.close();
    }
}

updateProductBadges();
