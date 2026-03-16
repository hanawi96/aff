const { createClient } = require('@libsql/client');

// Database configuration from wrangler.toml
const client = createClient({
    url: "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg"
});

async function checkPricingMethods() {
    try {
        console.log('🔍 Checking pricing methods in products...');

        // Get all products with pricing info
        const result = await client.execute(`
            SELECT id, name, price, cost_price, markup_multiplier, pricing_method, target_profit
            FROM products 
            WHERE is_active = 1
            ORDER BY id DESC
            LIMIT 10
        `);
        
        console.log('📋 Recent products:');
        result.rows.forEach(row => {
            const profit = row.price - row.cost_price;
            console.log(`  ID: ${row.id}`);
            console.log(`  Name: ${row.name}`);
            console.log(`  Price: ${row.price}, Cost: ${row.cost_price}, Profit: ${profit}`);
            console.log(`  Markup: ${row.markup_multiplier}, Method: ${row.pricing_method}, Target: ${row.target_profit}`);
            console.log('  ---');
        });

        // Count by pricing method
        const methodCount = await client.execute(`
            SELECT 
                pricing_method,
                COUNT(*) as count
            FROM products 
            WHERE is_active = 1
            GROUP BY pricing_method
        `);
        
        console.log('📊 Pricing method distribution:');
        methodCount.rows.forEach(row => {
            console.log(`  ${row.pricing_method || 'NULL'}: ${row.count} products`);
        });

        // Find products with materials and profit method
        const profitProducts = await client.execute(`
            SELECT DISTINCT p.id, p.name, p.pricing_method, p.target_profit, p.markup_multiplier
            FROM products p
            INNER JOIN product_materials pm ON p.id = pm.product_id
            WHERE p.is_active = 1 AND p.pricing_method = 'profit'
            LIMIT 5
        `);
        
        console.log('💰 Products using profit method with materials:');
        if (profitProducts.rows.length === 0) {
            console.log('  ❌ No products found with profit method!');
        } else {
            profitProducts.rows.forEach(row => {
                console.log(`  ID: ${row.id}, Name: ${row.name}, Target: ${row.target_profit}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkPricingMethods();