-- Migration: Add Profit Management Features
-- Date: 2024-11-14
-- Description: Thêm các bảng và cột cần thiết cho quản lý lãi lỗ

-- ============================================
-- 1. Tạo bảng cost_config
-- ============================================
CREATE TABLE IF NOT EXISTS cost_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL UNIQUE,
  item_cost REAL NOT NULL DEFAULT 0,
  is_default INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert dữ liệu mặc định
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES
  ('bag_zip', 500, 1),
  ('paper_print', 200, 1),
  ('bag_red', 1000, 0),
  ('box_shipping', 3000, 0);

-- ============================================
-- 2. Cập nhật bảng products
-- ============================================
-- Thêm cột cost_price (giá vốn)
ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;

-- ============================================
-- 3. Cập nhật bảng orders
-- ============================================
-- Thêm các cột chi phí và lãi
ALTER TABLE orders ADD COLUMN product_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN packaging_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN packaging_details TEXT;
ALTER TABLE orders ADD COLUMN shipping_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN profit REAL DEFAULT 0;

-- ============================================
-- 4. Tạo trigger tự động update updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_cost_config_timestamp 
AFTER UPDATE ON cost_config
BEGIN
  UPDATE cost_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 5. Tạo indexes để tăng tốc query
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_profit ON orders(profit);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_profit ON orders(created_at, profit);
CREATE INDEX IF NOT EXISTS idx_cost_config_item_name ON cost_config(item_name);
