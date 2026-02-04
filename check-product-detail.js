/**
 * Script để xem chi tiết nguyên liệu của một sản phẩm cụ thể
 * Usage: node check-product-detail.js [product_id]
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkProductDetail(productId) {
    try {
        // Lấy thông tin sản phẩm
        const product = await client.execute({
            sql: `SELECT * FROM products WHERE id = ?`,
            args: [productId]
        });

        if (product.rows.length === 0) {
            console.log('❌ Không tìm thấy sản phẩm với ID:', productId);
            return;
        }

        const p = product.rows[0];
        console.log('\n📦 THÔNG TIN SẢN PHẨM\n');
        console.log(`ID: ${p.id}`);
        console.log(`Tên: ${p.name}`);
        console.log(`Giá bán: ${p.price?.toLocaleString('vi-VN')}đ`);
        console.log(`Giá vốn: ${p.cost_price?.toLocaleString('vi-VN')}đ`);
        console.log(`Lợi nhuận: ${(p.price - p.cost_price)?.toLocaleString('vi-VN')}đ`);
        console.log(`Ảnh: ${p.image_url || 'Không có'}`);

        // Lấy nguyên liệu
        const materials = await client.execute({
            sql: `
                SELECT 
                    pm.id,
                    pm.material_name,
                    pm.quantity,
                    pm.unit,
                    pm.notes,
                    cc.item_cost,
                    cc.display_name,
                    cc.category_id,
                    mc.name as category_name,
                    (pm.quantity * cc.item_cost) as subtotal
                FROM product_materials pm
                LEFT JOIN cost_config cc ON pm.material_name = cc.item_name
                LEFT JOIN material_categories mc ON cc.category_id = mc.id
                WHERE pm.product_id = ?
                ORDER BY mc.sort_order, pm.id
            `,
            args: [productId]
        });

        console.log('\n🧱 NGUYÊN LIỆU CHI TIẾT\n');
        
        if (materials.rows.length === 0) {
            console.log('⚠️  Sản phẩm này chưa có nguyên liệu');
        } else {
            let totalCost = 0;
            materials.rows.forEach((mat, index) => {
                console.log(`${index + 1}. ${mat.display_name || mat.material_name}`);
                console.log(`   Mã: ${mat.material_name}`);
                console.log(`   Số lượng: ${mat.quantity} ${mat.unit || ''}`);
                console.log(`   Đơn giá: ${mat.item_cost?.toLocaleString('vi-VN') || 'N/A'}đ`);
                console.log(`   Thành tiền: ${mat.subtotal?.toLocaleString('vi-VN') || 'N/A'}đ`);
                if (mat.category_name) {
                    console.log(`   Danh mục: ${mat.category_name}`);
                }
                if (mat.notes) {
                    console.log(`   Ghi chú: ${mat.notes}`);
                }
                console.log('');
                totalCost += mat.subtotal || 0;
            });

            console.log(`💰 Tổng giá vốn tính từ nguyên liệu: ${totalCost.toLocaleString('vi-VN')}đ`);
            console.log(`💾 Giá vốn lưu trong DB: ${p.cost_price?.toLocaleString('vi-VN')}đ`);
            
            if (Math.abs(totalCost - p.cost_price) > 0.01) {
                console.log(`⚠️  Chênh lệch: ${(totalCost - p.cost_price).toLocaleString('vi-VN')}đ`);
            } else {
                console.log(`✅ Giá vốn khớp chính xác`);
            }
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        client.close();
    }
}

// Lấy product_id từ command line hoặc dùng mặc định
const productId = process.argv[2] || 9;
console.log(`\n🔍 Kiểm tra sản phẩm ID: ${productId}\n`);
checkProductDetail(productId);
