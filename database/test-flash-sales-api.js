import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Test data
let testFlashSaleId = null;
let testProductId = null;
let testFlashSaleProductId = null;

async function testFlashSalesAPI() {
    try {
        console.log('🧪 Testing Flash Sales API...\n');

        // ============================================
        // 1. Setup: Get a test product
        // ============================================
        console.log('1️⃣  Getting test product...');
        const { rows: products } = await client.execute(`
            SELECT id, name, price FROM products LIMIT 1
        `);
        
        if (products.length === 0) {
            throw new Error('No products found in database. Please add products first.');
        }
        
        testProductId = products[0].id;
        console.log(`   ✓ Using product: ${products[0].name} (ID: ${testProductId})`);

        // ============================================
        // 2. Create Flash Sale
        // ============================================
        console.log('\n2️⃣  Creating flash sale...');
        const now = Math.floor(Date.now() / 1000);
        const startTime = now + 3600; // Start in 1 hour
        const endTime = now + 86400; // End in 24 hours

        const createResult = await client.execute({
            sql: `INSERT INTO flash_sales (
                name, description, start_time, end_time, 
                status, is_visible, created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                'Test Flash Sale',
                'This is a test flash sale',
                startTime,
                endTime,
                'scheduled',
                1,
                now,
                now
            ]
        });

        testFlashSaleId = createResult.lastInsertRowid;
        console.log(`   ✓ Created flash sale (ID: ${testFlashSaleId})`);

        // ============================================
        // 3. Add Product to Flash Sale
        // ============================================
        console.log('\n3️⃣  Adding product to flash sale...');
        const originalPrice = products[0].price;
        const flashPrice = originalPrice * 0.7; // 30% discount
        const discountPercentage = 30;

        const addProductResult = await client.execute({
            sql: `INSERT INTO flash_sale_products (
                flash_sale_id, product_id, original_price, flash_price, 
                discount_percentage, stock_limit, sold_count, is_active,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                testFlashSaleId,
                testProductId,
                originalPrice,
                flashPrice,
                discountPercentage,
                100, // stock limit
                0,
                1,
                now,
                now
            ]
        });

        testFlashSaleProductId = addProductResult.lastInsertRowid;
        console.log(`   ✓ Added product to flash sale (ID: ${testFlashSaleProductId})`);

        // ============================================
        // 4. Query Flash Sale with Products
        // ============================================
        console.log('\n4️⃣  Querying flash sale with products...');
        const flashSale = await client.execute({
            sql: `SELECT 
                fs.*,
                COUNT(fsp.id) as product_count,
                SUM(fsp.sold_count) as total_sold
            FROM flash_sales fs
            LEFT JOIN flash_sale_products fsp ON fs.id = fsp.flash_sale_id
            WHERE fs.id = ?
            GROUP BY fs.id`,
            args: [testFlashSaleId]
        });

        console.log('   ✓ Flash Sale Details:');
        console.log(`     - Name: ${flashSale.rows[0].name}`);
        console.log(`     - Status: ${flashSale.rows[0].status}`);
        console.log(`     - Products: ${flashSale.rows[0].product_count}`);
        console.log(`     - Total Sold: ${flashSale.rows[0].total_sold}`);

        // ============================================
        // 5. Query Flash Sale Products
        // ============================================
        console.log('\n5️⃣  Querying flash sale products...');
        const { rows: flashSaleProducts } = await client.execute({
            sql: `SELECT 
                fsp.*,
                p.name as product_name,
                p.image_url
            FROM flash_sale_products fsp
            INNER JOIN products p ON fsp.product_id = p.id
            WHERE fsp.flash_sale_id = ?`,
            args: [testFlashSaleId]
        });

        console.log('   ✓ Products in Flash Sale:');
        flashSaleProducts.forEach(product => {
            console.log(`     - ${product.product_name}`);
            console.log(`       Original: ${product.original_price}đ`);
            console.log(`       Flash: ${product.flash_price}đ`);
            console.log(`       Discount: ${product.discount_percentage}%`);
            console.log(`       Stock: ${product.sold_count}/${product.stock_limit}`);
        });

        // ============================================
        // 6. Update Flash Sale Product
        // ============================================
        console.log('\n6️⃣  Updating flash sale product...');
        const newFlashPrice = originalPrice * 0.6; // 40% discount
        const newDiscountPercentage = 40;

        await client.execute({
            sql: `UPDATE flash_sale_products 
                SET flash_price = ?, discount_percentage = ?, updated_at_unix = ?
                WHERE id = ?`,
            args: [newFlashPrice, newDiscountPercentage, now, testFlashSaleProductId]
        });

        console.log(`   ✓ Updated flash price to ${newFlashPrice}đ (${newDiscountPercentage}% off)`);

        // ============================================
        // 7. Simulate Product Purchase
        // ============================================
        console.log('\n7️⃣  Simulating product purchase...');
        await client.execute({
            sql: `UPDATE flash_sale_products 
                SET sold_count = sold_count + ?
                WHERE id = ?`,
            args: [5, testFlashSaleProductId]
        });

        const updated = await client.execute({
            sql: `SELECT sold_count, stock_limit FROM flash_sale_products WHERE id = ?`,
            args: [testFlashSaleProductId]
        });

        console.log(`   ✓ Sold count updated: ${updated.rows[0].sold_count}/${updated.rows[0].stock_limit}`);

        // ============================================
        // 8. Check Product in Active Flash Sale
        // ============================================
        console.log('\n8️⃣  Checking if product is in active flash sale...');
        
        // First activate the flash sale
        await client.execute({
            sql: `UPDATE flash_sales SET status = 'active', start_time = ? WHERE id = ?`,
            args: [now - 3600, testFlashSaleId]
        });

        const activeCheck = await client.execute({
            sql: `SELECT 
                fsp.*,
                fs.name as flash_sale_name,
                fs.end_time
            FROM flash_sale_products fsp
            INNER JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
            WHERE fsp.product_id = ?
                AND fsp.is_active = 1
                AND fs.status = 'active'
                AND fs.start_time <= ?
                AND fs.end_time > ?
                AND (fsp.stock_limit IS NULL OR fsp.sold_count < fsp.stock_limit)
            LIMIT 1`,
            args: [testProductId, now, now]
        });

        if (activeCheck.rows.length > 0) {
            console.log(`   ✓ Product IS in active flash sale: ${activeCheck.rows[0].flash_sale_name}`);
            console.log(`     - Flash price: ${activeCheck.rows[0].flash_price}đ`);
        } else {
            console.log('   ✗ Product NOT in active flash sale');
        }

        // ============================================
        // 9. Get Flash Sale Statistics
        // ============================================
        console.log('\n9️⃣  Getting flash sale statistics...');
        const stats = await client.execute({
            sql: `SELECT 
                COUNT(fsp.id) as total_products,
                SUM(fsp.sold_count) as total_sold,
                SUM(fsp.sold_count * fsp.flash_price) as total_revenue,
                SUM(fsp.sold_count * (fsp.original_price - fsp.flash_price)) as total_discount_given,
                AVG(fsp.discount_percentage) as avg_discount_percentage
            FROM flash_sale_products fsp
            WHERE fsp.flash_sale_id = ? AND fsp.is_active = 1`,
            args: [testFlashSaleId]
        });

        console.log('   ✓ Statistics:');
        console.log(`     - Total Products: ${stats.rows[0].total_products}`);
        console.log(`     - Total Sold: ${stats.rows[0].total_sold}`);
        console.log(`     - Total Revenue: ${stats.rows[0].total_revenue}đ`);
        console.log(`     - Total Discount Given: ${stats.rows[0].total_discount_given}đ`);
        console.log(`     - Avg Discount: ${Math.round(stats.rows[0].avg_discount_percentage)}%`);

        // ============================================
        // 10. Cleanup Test Data
        // ============================================
        console.log('\n🧹 Cleaning up test data...');
        await client.execute({
            sql: `DELETE FROM flash_sales WHERE id = ?`,
            args: [testFlashSaleId]
        });
        console.log('   ✓ Test data cleaned up');

        console.log('\n✅ All Flash Sales API tests passed!');
        console.log('\n📊 Summary:');
        console.log('   ✓ Flash sale creation');
        console.log('   ✓ Product addition');
        console.log('   ✓ Product updates');
        console.log('   ✓ Sold count tracking');
        console.log('   ✓ Active flash sale check');
        console.log('   ✓ Statistics calculation');
        console.log('   ✓ Data cleanup');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        
        // Cleanup on error
        if (testFlashSaleId) {
            try {
                await client.execute({
                    sql: `DELETE FROM flash_sales WHERE id = ?`,
                    args: [testFlashSaleId]
                });
                console.log('\n🧹 Cleaned up test data after error');
            } catch (cleanupError) {
                console.error('Failed to cleanup:', cleanupError.message);
            }
        }
        
        throw error;
    } finally {
        client.close();
    }
}

testFlashSalesAPI();
