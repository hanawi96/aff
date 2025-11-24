-- Migration: Add customer shipping fee to cost_config
-- Date: 2024-11-24
-- Description: Thêm phí vận chuyển khách phải trả vào cost_config

-- ============================================
-- 1. Thêm phí vận chuyển khách phải trả
-- ============================================
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) 
VALUES ('customer_shipping_fee', 25000, 1);

-- ============================================
-- 2. Kiểm tra kết quả
-- ============================================
SELECT 'Customer shipping fee added to cost_config' as status;
SELECT * FROM cost_config ORDER BY id;
