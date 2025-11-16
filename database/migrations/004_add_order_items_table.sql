-- Migration: Add order_items table for detailed product tracking
-- Date: 2024-11-15
-- Description: Create order_items table to store individual products in orders
--              This enables detailed product analytics and accurate profit tracking

-- ============================================
-- 1. Create order_items table
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  product_price REAL NOT NULL DEFAULT 0,
  product_cost REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  cost_total REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  weight TEXT,
  size TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ============================================
-- 2. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_product_name ON order_items(product_name);
CREATE INDEX IF NOT EXISTS idx_order_items_profit ON order_items(profit);

-- ============================================
-- 3. Add notes column to orders table (if not exists)
-- ============================================
-- Check if column exists first, SQLite doesn't have IF NOT EXISTS for columns
-- This will be handled in the application code

-- ============================================
-- 4. Verification queries
-- ============================================
-- Verify table creation
SELECT name FROM sqlite_master WHERE type='table' AND name='order_items';

-- Verify indexes
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='order_items';

-- ============================================
-- NOTES:
-- ============================================
-- - order_id: Links to orders.id (CASCADE DELETE means if order deleted, items deleted too)
-- - product_id: Links to products.id (SET NULL means if product deleted, keep order_items but set product_id to NULL)
-- - product_name, product_price, product_cost: Snapshot at time of order (won't change if product changes)
-- - subtotal: product_price * quantity
-- - cost_total: product_cost * quantity
-- - profit: subtotal - cost_total (per item line)
-- - weight, size, notes: Additional product details at time of order
