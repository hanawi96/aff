/**
 * Script để kiểm tra nguyên liệu dây đỏ và dây cước trong cost_config
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkStringMaterials() {
    try {
        console.log('🔍 Tìm nguyên liệu dây trong cost_config...\n');

        const result = await client.execute(`
            SELECT 
                item_name,
                display_name,
                item_cost
            FROM cost_config
            WHERE item_name LIKE '%day%' OR item_name LIKE '%cuoc%' OR item_name LIKE '%string%'
            ORDER BY item_name
        `);

        const materials = result.rows || [];

        if (materials.length === 0) {
            console.log('❌ Không tìm thấy nguyên liệu dây nào');
        } else {
            console.log(`✅ Tìm thấy ${materials.length} nguyên liệu:\n`);
            materials.forEach(mat => {
                console.log(`📌 ${mat.display_name || mat.item_name}`);
                console.log(`   Mã: ${mat.item_name}`);
                console.log(`   Giá: ${mat.item_cost?.toLocaleString('vi-VN')}đ\n`);
            });
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        client.close();
    }
}

checkStringMaterials();
