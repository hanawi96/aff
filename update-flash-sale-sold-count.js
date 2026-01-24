const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function updateSoldCounts() {
    try {
        // Lấy tất cả flash sale products
        const result = await client.execute({
            sql: 'SELECT id, product_id, stock_limit FROM flash_sale_products WHERE is_active = 1',
            args: []
        });

        console.log('Found', result.rows.length, 'flash sale products');

        // Cập nhật sold_count ngẫu nhiên để test
        for (const product of result.rows) {
            const stockLimit = product.stock_limit || 50;
            // Tạo số lượng đã bán từ 15-40% của stock limit để tạo cảm giác khan hiếm
            const soldCount = Math.floor(stockLimit * (0.15 + Math.random() * 0.25));
            
            await client.execute({
                sql: 'UPDATE flash_sale_products SET sold_count = ? WHERE id = ?',
                args: [soldCount, product.id]
            });

            console.log(`Updated product ${product.id}: sold ${soldCount}/${stockLimit}`);
        }

        console.log('\nDone! Refresh your browser to see the changes.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.close();
    }
}

updateSoldCounts();
