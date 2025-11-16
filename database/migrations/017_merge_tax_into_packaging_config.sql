-- Migration: Merge tax_config into cost_config
-- Created: 2024-11-16
-- Description: Gộp bảng tax_config vào cost_config - chỉ thêm 1 dòng tax_rate

-- ============================================
-- 1. Thêm dòng tax_rate vào cost_config
-- ============================================

-- Thêm dòng tax_rate với giá trị 0.015 (1.5%)
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) 
VALUES ('tax_rate', 0.015, 1);

-- ============================================
-- 2. Xóa bảng tax_config (không cần thiết)
-- ============================================

DROP TABLE IF EXISTS tax_config;
DROP INDEX IF EXISTS idx_tax_config_effective_from;
DROP INDEX IF EXISTS idx_tax_config_is_active;

-- ============================================
-- 3. Verification
-- ============================================

SELECT 'Cost config updated' as status;
SELECT * FROM cost_config ORDER BY id;
