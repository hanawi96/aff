import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function debugOrder() {
    try {
        console.log('🔍 Kiểm tra đơn hàng DH1790165492631...\n');

        // Get order info
        const order = await client.execute({
            sql: `SELECT 
                    id, order_id, customer_name, total_amount, 
                    products, payment_method, status,
                    shipping_fee, shipping_cost, discount_amount,
                    created_at_unix
                  FROM orders 
                  WHERE order_id = ?`,
            args: ['DH1790165492631']
        });

        if (order.rows.length === 0) {
            console.log('❌ Không tìm thấy đơn hàng này!');
            return;
        }

        const orderData = order.rows[0];
        console.log('📦 Thông tin đơn hàng:');
        console.log('   ID:', orderData.id);
        console.log('   Order ID:', orderData.order_id);
        console.log('   Khách hàng:', orderData.customer_name);
        console.log('   Tổng tiền:', orderData.total_amount);
        console.log('   Phí ship:', orderData.shipping_fee);
        console.log('   Chi phí ship:', orderData.shipping_cost);
        console.log('   Giảm giá:', orderData.discount_amount);
        console.log('   Trạng thái:', orderData.status);
        console.log('   Sản phẩm:', orderData.products);
        console.log('');

        // Get order_items (product costs) - check what columns actually exist
        const items = await client.execute({
            sql: `SELECT * FROM order_items WHERE order_id = ?`,
            args: [orderData.id]
        });

        console.log('📋 Chi tiết sản phẩm từ order_items:');
        if (items.rows.length === 0) {
            console.log('   ⚠️  KHÔNG CÓ dữ liệu trong order_items!');
        } else {
            console.log('   Columns:', Object.keys(items.rows[0]));
            let totalProductCost = 0;
            items.rows.forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.product_name || 'N/A'}`);
                console.log(`      - Product ID: ${item.product_id}`);
                console.log(`      - Số lượng: ${item.quantity}`);
                console.log(`      - Đơn giá: ${item.product_price || item.price || 'N/A'}`);
                console.log(`      - Giá vốn/sp: ${item.product_cost}`);
                const cost = Number(item.product_cost || 0) * Number(item.quantity || 0);
                console.log(`      - Tổng giá vốn: ${cost}`);
                totalProductCost += cost;
            });
            console.log(`   📊 TỔNG GIÁ VỐN SẢN PHẨM: ${totalProductCost}`);
        }
        console.log('');

        // Calculate profit
        const totalAmount = Number(orderData.total_amount || 0);
        const shippingFee = Number(orderData.shipping_fee || 0);
        const shippingCost = Number(orderData.shipping_cost || 0);
        const discountAmount = Number(orderData.discount_amount || 0);
        
        let totalProductCost = 0;
        items.rows.forEach(item => {
            totalProductCost += Number(item.product_cost || 0) * Number(item.quantity || 0);
        });

        const profit = totalAmount - totalProductCost - shippingCost;
        
        console.log('💰 Tính toán lợi nhuận:');
        console.log(`   Tổng tiền: ${totalAmount}`);
        console.log(`   - Giá vốn SP: ${totalProductCost}`);
        console.log(`   - Chi phí ship: ${shippingCost}`);
        console.log(`   = LỢI NHUẬN: ${profit}`);
        console.log('');

        // Check invoice export history
        const exports = await client.execute({
            sql: `SELECT id, file_name, status, created_at, downloaded_at
                  FROM export_history 
                  WHERE type = 'invoice' 
                    AND json_extract(order_ids, '$') LIKE ?
                  ORDER BY created_at DESC`,
            args: [`%${orderData.id}%`]
        });

        console.log('📄 Lịch sử xuất HĐĐT:');
        if (exports.rows.length === 0) {
            console.log('   Chưa có lần xuất nào');
        } else {
            exports.rows.forEach((exp, idx) => {
                console.log(`   ${idx + 1}. File: ${exp.file_name}`);
                console.log(`      Status: ${exp.status}`);
                console.log(`      Created: ${new Date(exp.created_at).toLocaleString('vi-VN')}`);
                console.log(`      Downloaded: ${exp.downloaded_at ? new Date(exp.downloaded_at).toLocaleString('vi-VN') : 'Chưa tải'}`);
            });
        }

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        client.close();
    }
}

debugOrder();
