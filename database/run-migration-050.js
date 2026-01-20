// Run Migration 050: Add display_name to cost_config
// This script adds display_name column to allow custom material names

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function runMigration() {
    console.log('🚀 Starting Migration 050: Add display_name to materials...\n');

    try {
        // Step 1: Add display_name column
        console.log('📝 Step 1: Adding display_name column...');
        try {
            await client.execute('ALTER TABLE cost_config ADD COLUMN display_name TEXT');
            console.log('✅ display_name column added\n');
        } catch (error) {
            if (error.message.includes('duplicate column')) {
                console.log('⚠️  display_name column already exists\n');
            } else {
                throw error;
            }
        }

        // Step 2: Populate display_name for existing materials
        console.log('📝 Step 2: Populating display_name for existing materials...');
        await client.execute(`
            UPDATE cost_config SET display_name = 
                CASE item_name
                    WHEN 'bi_bac_s999' THEN 'Bi bạc S999'
                    WHEN 'ho_phach_vang' THEN 'Hổ phách vàng'
                    WHEN 'ho_phach_nau' THEN 'Hổ phách nâu'
                    WHEN 'da_do' THEN 'Đá đỏ'
                    WHEN 'da_xanh' THEN 'Đá xanh'
                    WHEN 'day_tron' THEN 'Dây trơn'
                    WHEN 'day_ngu_sac' THEN 'Dây ngũ sắc'
                    WHEN 'day_vang' THEN 'Dây vàng'
                    WHEN 'charm_ran' THEN 'Charm rắn'
                    WHEN 'charm_rong' THEN 'Charm rồng'
                    WHEN 'charm_hoa_sen' THEN 'Charm hoa sen'
                    WHEN 'charm_co_4_la' THEN 'Charm cỏ 4 lá'
                    WHEN 'chuong' THEN 'Chuông'
                    WHEN 'the_ten_tron' THEN 'Thẻ tên tròn'
                    WHEN 'the_hinh_ran' THEN 'Thẻ hình rắn'
                    WHEN 'thanh_gia' THEN 'Thanh giá'
                    WHEN 'bag_red' THEN 'Túi đỏ'
                    WHEN 'bag_zip' THEN 'Túi zip'
                    WHEN 'box_shipping' THEN 'Hộp vận chuyển'
                    WHEN 'customer_shipping_fee' THEN 'Phí ship khách'
                    WHEN 'default_shipping_cost' THEN 'Chi phí ship mặc định'
                    WHEN 'labor_cost' THEN 'Chi phí nhân công'
                    WHEN 'paper_print' THEN 'Giấy in'
                    WHEN 'red_string' THEN 'Dây đỏ'
                    WHEN 'tax_rate' THEN 'Thuế suất'
                    WHEN 'thank_card' THEN 'Thiệp cảm ơn'
                    ELSE item_name
                END
            WHERE display_name IS NULL
        `);
        console.log('✅ display_name populated\n');

        // Verify migration
        console.log('🔍 Verifying migration...\n');
        const { rows: materials } = await client.execute(`
            SELECT item_name, display_name, item_cost 
            FROM cost_config 
            ORDER BY item_name 
            LIMIT 10
        `);
        
        console.log('✅ Sample materials with display_name:');
        materials.forEach(m => {
            console.log(`   ${m.item_name} → "${m.display_name}" (${m.item_cost}đ)`);
        });

        console.log('\n✅ Migration 050 completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
