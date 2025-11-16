-- Migration: Update Cost Config Defaults
-- Date: 2024-11-15
-- Description: Cập nhật cấu hình đóng gói mặc định theo yêu cầu mới

-- ============================================
-- 1. Thêm thank_card nếu chưa có
-- ============================================
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) 
VALUES ('thank_card', 300, 1);

-- ============================================
-- 2. Cập nhật is_default cho các item
-- ============================================

-- Per-Product items (is_default = 1)
UPDATE cost_config SET is_default = 1 WHERE item_name = 'bag_zip';      -- Túi zip
UPDATE cost_config SET is_default = 1 WHERE item_name = 'bag_red';      -- Túi rút đỏ

-- Per-Order items (is_default = 1)
UPDATE cost_config SET is_default = 1 WHERE item_name = 'box_shipping'; -- Hộp hàng
UPDATE cost_config SET is_default = 1 WHERE item_name = 'thank_card';   -- Thiệp cảm ơn

-- Các item không dùng mặc định (is_default = 0)
UPDATE cost_config SET is_default = 0 WHERE item_name = 'paper_print';  -- Không dùng mặc định

-- ============================================
-- 3. Cập nhật giá nếu cần
-- ============================================
UPDATE cost_config SET item_cost = 500 WHERE item_name = 'bag_zip';
UPDATE cost_config SET item_cost = 1000 WHERE item_name = 'bag_red';
UPDATE cost_config SET item_cost = 3000 WHERE item_name = 'box_shipping';
UPDATE cost_config SET item_cost = 300 WHERE item_name = 'thank_card';

-- ============================================
-- 4. Kiểm tra kết quả
-- ============================================
-- SELECT * FROM cost_config WHERE is_default = 1;
-- Expected result:
-- bag_zip: 500đ (per-product)
-- bag_red: 1000đ (per-product)
-- box_shipping: 3000đ (per-order)
-- thank_card: 300đ (per-order)
-- Total per product: 500 + 1000 = 1500đ
-- Total per order: 3000 + 300 = 3300đ
-- For 1 product: (1500 × 1) + 3300 = 4800đ ✓
