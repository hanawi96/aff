-- Migration: Add red string and labor cost to cost_config
-- Date: 2024-11-16
-- Description: Thêm chi phí dây đỏ và tiền công vào cost_config (tính theo số lượng sản phẩm)

-- ============================================
-- 1. Thêm chi phí dây đỏ (per-product)
-- ============================================
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) 
VALUES ('red_string', 100, 1);

-- ============================================
-- 2. Thêm chi phí tiền công (per-product)
-- ============================================
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) 
VALUES ('labor_cost', 5000, 1);

-- ============================================
-- 3. Verification
-- ============================================
SELECT 'Cost config updated with red_string and labor_cost' as status;
SELECT * FROM cost_config ORDER BY id;
