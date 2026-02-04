/**
 * Script để đọc và hiểu dữ liệu từ bảng product_materials
 * Usage: node read-product-materials.js
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function readProductMaterials() {
    try {
        console.log('📊 Đọc dữ liệu từ bảng product_materials...\n');

        // 1. Đếm tổng số sản phẩm có nguyên liệu
        const countResult = await client.execute(`
            SELECT COUNT(DISTINCT product_id) as total_products
            FROM product_materials
        `);
        console.log('📦 Tổng số sản phẩm có nguyên liệu:', countResult.rows[0].total_products);

        // 2. Lấy 5 sản phẩm mẫu với nguyên liệu
        console.log('\n📋 5 sản phẩm mẫu với nguyên liệu:\n');
        const sampleProducts = await client.execute(`
            SELECT 
                p.id,
                p.name,
                p.price,
                p.cost_price,
                COUNT(pm.id) as material_count
            FROM products p
            INNER JOIN product_materials pm ON p.id = pm.product_id
            GROUP BY p.id
            LIMIT 5
        `);

        for (const product of sampleProducts.rows) {
            console.log(`\n🔹 Sản phẩm: ${product.name} (ID: ${product.id})`);
            console.log(`   Giá bán: ${product.price?.toLocaleString('vi-VN')}đ`);
            console.log(`   Giá vốn: ${product.cost_price?.toLocaleString('vi-VN')}đ`);
            console.log(`   Số nguyên liệu: ${product.material_count}`);

            // Lấy chi tiết nguyên liệu
            const materials = await client.execute({
                sql: `
                    SELECT 
                        pm.material_name,
                        pm.quantity,
                        pm.unit,
                        pm.notes,
                        cc.item_cost,
                        (pm.quantity * cc.item_cost) as subtotal
                    FROM product_materials pm
                    LEFT JOIN cost_config cc ON pm.material_name = cc.item_name
                    WHERE pm.product_id = ?
                    ORDER BY pm.id
                `,
                args: [product.id]
            });

            console.log('   Nguyên liệu:');
            for (const mat of materials.rows) {
                const displayName = mat.material_name.replace(/_/g, ' ');
                console.log(`     • ${displayName}: ${mat.quantity} ${mat.unit || ''}`);
                if (mat.item_cost) {
                    console.log(`       Đơn giá: ${mat.item_cost.toLocaleString('vi-VN')}đ → Thành tiền: ${mat.subtotal?.toLocaleString('vi-VN')}đ`);
                }
                if (mat.notes) {
                    console.log(`       Ghi chú: ${mat.notes}`);
                }
            }
        }

        // 3. Thống kê nguyên liệu được sử dụng nhiều nhất
        console.log('\n\n📊 Top 10 nguyên liệu được sử dụng nhiều nhất:\n');
        const topMaterials = await client.execute(`
            SELECT 
                pm.material_name,
                COUNT(DISTINCT pm.product_id) as product_count,
                SUM(pm.quantity) as total_quantity,
                cc.item_cost,
                cc.display_name
            FROM product_materials pm
            LEFT JOIN cost_config cc ON pm.material_name = cc.item_name
            GROUP BY pm.material_name
            ORDER BY product_count DESC
            LIMIT 10
        `);

        for (const mat of topMaterials.rows) {
            const displayName = mat.display_name || mat.material_name.replace(/_/g, ' ');
            console.log(`🔸 ${displayName}`);
            console.log(`   Số sản phẩm sử dụng: ${mat.product_count}`);
            console.log(`   Tổng số lượng: ${mat.total_quantity}`);
            if (mat.item_cost) {
                console.log(`   Đơn giá: ${mat.item_cost.toLocaleString('vi-VN')}đ`);
            }
        }

        // 4. Kiểm tra cấu trúc dữ liệu
        console.log('\n\n🔍 Cấu trúc bảng product_materials:\n');
        const schema = await client.execute(`
            PRAGMA table_info(product_materials)
        `);

        for (const col of schema.rows) {
            console.log(`   ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        }

        console.log('\n✅ Hoàn thành!\n');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        console.error(error);
    } finally {
        client.close();
    }
}

readProductMaterials();
