const { createClient } = require('@libsql/client');

// Database configuration from wrangler.toml
const client = createClient({
    url: "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg"
});

async function checkProduct35() {
    try {
        console.log('🔍 Checking product ID 35...');

        // Get product details
        const product = await client.execute(`
            SELECT id, name, price, cost_price, markup_multiplier, pricing_method, target_profit
            FROM products 
            WHERE id = 35
        `);
        
        if (product.rows.length === 0) {
            console.log('❌ Product 35 not found');
            return;
        }

        const p = product.rows[0];
        console.log('📦 Product details:');
        console.log(`  ID: ${p.id}`);
        console.log(`  Name: ${p.name}`);
        console.log(`  Price: ${p.price}`);
        console.log(`  Cost: ${p.cost_price}`);
        console.log(`  Actual Profit: ${p.price - p.cost_price}`);
        console.log(`  Markup: ${p.markup_multiplier}`);
        console.log(`  Method: ${p.pricing_method}`);
        console.log(`  Target Profit: ${p.target_profit}`);

        // Get materials for this product
        const materials = await client.execute(`
            SELECT pm.material_name, pm.quantity, m.item_cost, 
                   (pm.quantity * m.item_cost) as total_cost
            FROM product_materials pm
            JOIN cost_config m ON pm.material_name = m.item_name
            WHERE pm.product_id = 35
        `);
        
        console.log('🧪 Materials:');
        let totalMaterialCost = 0;
        materials.rows.forEach(row => {
            console.log(`  ${row.material_name}: ${row.quantity} × ${row.item_cost} = ${row.total_cost}`);
            totalMaterialCost += row.total_cost;
        });
        console.log(`  Total material cost: ${totalMaterialCost}`);

        // Calculate what the price should be
        if (p.pricing_method === 'profit' && p.target_profit) {
            const expectedPrice = totalMaterialCost + p.target_profit;
            console.log(`💰 Expected price (profit method): ${totalMaterialCost} + ${p.target_profit} = ${expectedPrice}`);
        } else {
            const expectedPrice = totalMaterialCost * p.markup_multiplier;
            console.log(`📊 Expected price (markup method): ${totalMaterialCost} × ${p.markup_multiplier} = ${expectedPrice}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkProduct35();