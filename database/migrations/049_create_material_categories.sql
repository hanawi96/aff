-- Migration 049: Create Material Categories System
-- Purpose: Add category system for materials to organize them better
-- Date: 2026-01-20

-- ============================================
-- 1. Create material_categories table
-- ============================================

CREATE TABLE IF NOT EXISTS material_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. Add category_id to cost_config
-- ============================================

ALTER TABLE cost_config ADD COLUMN category_id INTEGER REFERENCES material_categories(id);

-- ============================================
-- 3. Insert default categories
-- ============================================

INSERT INTO material_categories (name, display_name, icon, description, sort_order) VALUES
('da_quy', 'Đá quý', '💎', 'Bi bạc, hổ phách, đá đỏ, đá xanh...', 1),
('day', 'Dây', '🧵', 'Dây trơn, dây ngũ sắc, dây vàng...', 2),
('charm', 'Charm/Mặt', '✨', 'Charm rắn, rồng, hoa sen, cỏ 4 lá...', 3),
('phu_kien', 'Phụ kiện', '🔔', 'Chuông, thẻ tên, thanh giá...', 4),
('khac', 'Khác', '📦', 'Các nguyên liệu khác', 5);

-- ============================================
-- 4. Update existing materials with categories
-- ============================================

-- Đá quý
UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'da_quy')
WHERE item_name IN ('bi_bac_s999', 'ho_phach_vang', 'ho_phach_nau', 'da_do', 'da_xanh');

-- Dây
UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'day')
WHERE item_name IN ('day_tron', 'day_ngu_sac', 'day_vang');

-- Charm
UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'charm')
WHERE item_name IN ('charm_ran', 'charm_rong', 'charm_hoa_sen', 'charm_co_4_la');

-- Phụ kiện
UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'phu_kien')
WHERE item_name IN ('chuong', 'the_ten_tron', 'the_hinh_ran', 'thanh_gia');

-- Khác (customer_shipping_fee, etc.)
UPDATE cost_config SET category_id = (SELECT id FROM material_categories WHERE name = 'khac')
WHERE category_id IS NULL;

-- ============================================
-- 5. Create index for better performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cost_config_category ON cost_config(category_id);

-- ============================================
-- Migration complete
-- ============================================
