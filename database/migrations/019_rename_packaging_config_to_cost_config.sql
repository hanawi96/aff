-- Migration: Rename packaging_config to cost_config
-- Date: 2024-11-16
-- Description: Đổi tên bảng packaging_config thành cost_config để phản ánh đúng mục đích sử dụng

-- ============================================
-- 1. Đổi tên bảng
-- ============================================

ALTER TABLE packaging_config RENAME TO cost_config;

-- ============================================
-- 2. Đổi tên index
-- ============================================

DROP INDEX IF EXISTS idx_packaging_config_item_name;
CREATE INDEX IF NOT EXISTS idx_cost_config_item_name ON cost_config(item_name);

-- ============================================
-- 3. Đổi tên trigger
-- ============================================

DROP TRIGGER IF EXISTS update_packaging_config_timestamp;

CREATE TRIGGER IF NOT EXISTS update_cost_config_timestamp 
AFTER UPDATE ON cost_config
BEGIN
  UPDATE cost_config SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- ============================================
-- 4. Verification
-- ============================================

SELECT 'Table renamed successfully' as status;
SELECT * FROM cost_config ORDER BY id;
