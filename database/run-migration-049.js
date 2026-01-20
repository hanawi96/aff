// Run Migration 049: Create Material Categories System
// This script creates the material_categories table and adds category_id to cost_config

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function runMigration() {
    console.log('🚀 Starting Migration 049: Material Categories System...\n');

    try {
        // Execute statements one by one
        console.log('📝 Step 1: Creating material_categories table...');
        try {
            await client.execute(`
                CREATE TABLE IF NOT EXISTS material_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    display_name TEXT NOT NULL,
                    icon TEXT,
                    description TEXT,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ material_categories table created\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  material_categories table already exists\n');
            } else {
                throw error;
            }
        }

        console.log('📝 Step 2: Adding category_id to cost_config...');
        try {
            await client.execute('ALTER TABLE cost_config ADD COLUMN category_id INTEGER REFERENCES material_categories(id)');
            console.log('✅ category_id column added\n');
        } catch (error) {
            if (error.message.includes('duplicate column')) {
                console.log('⚠️  category_id column already exists\n');
            } else {
                throw error;
            }
        }

        console.log('📝 Step 3: Inserting default categories...');
        const categories = [
            ['da_quy', 'Đá quý', '💎', 'Bi bạc, hổ phách, đá đỏ, đá xanh...', 1],
            ['day', 'Dây', '🧵', 'Dây trơn, dây ngũ sắc, dây vàng...', 2],
            ['charm', 'Charm/Mặt', '✨', 'Charm rắn, rồng, hoa sen, cỏ 4 lá...', 3],
            ['phu_kien', 'Phụ kiện', '🔔', 'Chuông, thẻ tên, thanh giá...', 4],
            ['khac', 'Khác', '📦', 'Các nguyên liệu khác', 5]
        ];

        for (const [name, display_name, icon, description, sort_order] of categories) {
            try {
                await client.execute({
                    sql: 'INSERT INTO material_categories (name, display_name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)',
                    args: [name, display_name, icon, description, sort_order]
                });
                console.log(`   ✅ ${icon} ${display_name}`);
            } catch (error) {
                if (error.message.includes('UNIQUE constraint')) {
                    console.log(`   ⚠️  ${icon} ${display_name} (already exists)`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n📝 Step 4: Updating existing materials with categories...');
        
        // Đá quý
        await client.execute(`
            UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'da_quy')
            WHERE item_name IN ('bi_bac_s999', 'ho_phach_vang', 'ho_phach_nau', 'da_do', 'da_xanh')
        `);
        console.log('   ✅ Đá quý materials updated');

        // Dây
        await client.execute(`
            UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'day')
            WHERE item_name IN ('day_tron', 'day_ngu_sac', 'day_vang')
        `);
        console.log('   ✅ Dây materials updated');

        // Charm
        await client.execute(`
            UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'charm')
            WHERE item_name IN ('charm_ran', 'charm_rong', 'charm_hoa_sen', 'charm_co_4_la')
        `);
        console.log('   ✅ Charm materials updated');

        // Phụ kiện
        await client.execute(`
            UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'phu_kien')
            WHERE item_name IN ('chuong', 'the_ten_tron', 'the_hinh_ran', 'thanh_gia')
        `);
        console.log('   ✅ Phụ kiện materials updated');

        // Khác
        await client.execute(`
            UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'khac')
            WHERE category_id IS NULL
        `);
        console.log('   ✅ Other materials updated');

        console.log('\n📝 Step 5: Creating index...');
        try {
            await client.execute('CREATE INDEX IF NOT EXISTS idx_cost_config_category ON cost_config(category_id)');
            console.log('✅ Index created\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  Index already exists\n');
            } else {
                throw error;
            }
        }

        // Verify migration
        console.log('\n🔍 Verifying migration...\n');

        // Check material_categories table
        const { rows: categoriesResult } = await client.execute('SELECT * FROM material_categories ORDER BY sort_order');
        console.log(`✅ material_categories table: ${categoriesResult.length} categories`);
        categoriesResult.forEach(cat => {
            console.log(`   ${cat.icon} ${cat.display_name} (${cat.name})`);
        });

        // Check cost_config with categories
        const { rows: materials } = await client.execute(`
            SELECT 
                cc.item_name,
                cc.item_cost,
                mc.display_name as category_name,
                mc.icon as category_icon
            FROM cost_config cc
            LEFT JOIN material_categories mc ON cc.category_id = mc.id
            ORDER BY mc.sort_order, cc.item_name
        `);
        console.log(`\n✅ cost_config materials: ${materials.length} materials`);
        
        let currentCategory = null;
        materials.forEach(mat => {
            if (mat.category_name !== currentCategory) {
                currentCategory = mat.category_name;
                console.log(`\n   ${mat.category_icon || '📦'} ${mat.category_name || 'Chưa phân loại'}:`);
            }
            console.log(`      - ${mat.item_name}: ${mat.item_cost}đ`);
        });

        console.log('\n✅ Migration 049 completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
