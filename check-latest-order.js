// Check latest order packaging_details
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkLatestOrder() {
    try {
        console.log('🔍 Checking latest order packaging_details...\n');

        // Get latest 5 orders
        const result = await client.execute(`
            SELECT id, order_id, order_date, packaging_cost, packaging_details, created_at_unix
            FROM orders
            ORDER BY created_at_unix DESC
            LIMIT 5
        `);

        console.log('📦 Latest 5 orders:');
        console.log('='.repeat(120));
        
        result.rows.forEach((order, index) => {
            console.log(`\n[${index + 1}] Order ID: ${order.order_id}`);
            console.log(`    Database ID: ${order.id}`);
            console.log(`    Date: ${new Date(order.order_date).toLocaleString('vi-VN')}`);
            console.log(`    Packaging Cost: ${order.packaging_cost}đ`);
            
            if (order.packaging_details) {
                try {
                    const details = JSON.parse(order.packaging_details);
                    console.log(`    Packaging Details:`);
                    console.log(JSON.stringify(details, null, 6));
                    
                    // Check if has per_product (BAD)
                    if (details.per_product) {
                        console.log(`    ⚠️  WARNING: Has per_product (should be removed!)`);
                        console.log(`        red_string: ${details.per_product.red_string || 0}đ`);
                        console.log(`        labor_cost: ${details.per_product.labor_cost || 0}đ`);
                    } else {
                        console.log(`    ✅ GOOD: No per_product field`);
                    }
                    
                    // Check per_order
                    if (details.per_order) {
                        console.log(`    ✅ Has per_order:`);
                        Object.keys(details.per_order).forEach(key => {
                            const item = details.per_order[key];
                            if (typeof item === 'object') {
                                console.log(`        ${key}: ${item.name} = ${item.cost}đ`);
                            } else {
                                console.log(`        ${key}: ${item}đ`);
                            }
                        });
                    }
                } catch (e) {
                    console.log(`    ❌ Error parsing JSON: ${e.message}`);
                }
            } else {
                console.log(`    ⚠️  No packaging_details`);
            }
        });
        
        console.log('\n' + '='.repeat(120));
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkLatestOrder();
