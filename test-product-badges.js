const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function testProductBadges() {
    try {
        console.log('Testing product badges...\n');
        
        // Get products with badges
        const result = await client.execute({
            sql: `SELECT id, name, is_handmade, is_chemical_free 
                  FROM products 
                  WHERE is_handmade = 1 OR is_chemical_free = 1
                  LIMIT 10`,
            args: []
        });
        
        console.log(`Found ${result.rows.length} products with badges:\n`);
        
        result.rows.forEach(product => {
            console.log(`Product: ${product.name}`);
            console.log(`  🟡 Thủ công 100%: ${product.is_handmade === 1 ? '✓' : '✗'}`);
            console.log(`  🟢 Không hóa chất: ${product.is_chemical_free === 1 ? '✓' : '✗'}`);
            console.log('');
        });
        
        // Count total products with badges
        const countResult = await client.execute({
            sql: `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_handmade = 1 THEN 1 ELSE 0 END) as handmade_count,
                    SUM(CASE WHEN is_chemical_free = 1 THEN 1 ELSE 0 END) as chemical_free_count
                  FROM products 
                  WHERE is_active = 1`,
            args: []
        });
        
        const stats = countResult.rows[0];
        console.log('=== STATISTICS ===');
        console.log(`Total active products: ${stats.total}`);
        console.log(`Products with "Thủ công 100%": ${stats.handmade_count}`);
        console.log(`Products with "Không hóa chất": ${stats.chemical_free_count}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.close();
    }
}

testProductBadges();
