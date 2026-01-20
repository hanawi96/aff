-- Migration 048: Create Product Materials System
-- Purpose: Enable dynamic cost calculation based on material prices
-- Date: 2026-01-20

-- Step 1: Create product_materials table
CREATE TABLE IF NOT EXISTS product_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT,
  notes TEXT,
  created_at_unix INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at_unix INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_materials_product_id ON product_materials(product_id);

CREATE INDEX IF NOT EXISTS idx_product_materials_material_name ON product_materials(material_name);

-- Step 3: Add sample materials to cost_config (if not exists)
INSERT OR IGNORE INTO cost_config (item_name, item_cost, is_default) VALUES
('bi_bac_s999', 15000, 1),
('ho_phach_vang', 50000, 1),
('ho_phach_nau', 45000, 1),
('da_do', 30000, 1),
('da_xanh', 28000, 1),
('day_tron', 5000, 1),
('day_ngu_sac', 8000, 1),
('day_vang', 6000, 1),
('charm_ran', 12000, 1),
('charm_rong', 25000, 1),
('charm_hoa_sen', 15000, 1),
('charm_co_4_la', 10000, 1),
('chuong', 3000, 1),
('the_ten_tron', 8000, 1),
('the_hinh_ran', 10000, 1),
('thanh_gia', 12000, 1);

-- Note: Triggers are created separately via create-triggers-048.js
-- This ensures proper error handling and verification
