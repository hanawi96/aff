-- Migration: Cleanup order_items table - Remove redundant columns
-- Created: 2024-11-15
-- Reason: Remove calculated/redundant columns that should be computed dynamically
--
-- Columns to remove:
-- 1. profit - Wrong logic level (profit is order-level, not item-level)
-- 2. subtotal - Redundant (can calculate: product_price × quantity)
-- 3. cost_total - Redundant (can calculate: product_cost × quantity)
--
-- Why remove these?
-- - Data redundancy (same value stored multiple times)
-- - Risk of inconsistency (if quantity changes but subtotal doesn't update)
-- - Wrong business logic (profit includes shipping/tax/commission at order level)
--
-- Calculation formulas after migration:
-- subtotal = product_price × quantity
-- cost_total = product_cost × quantity
-- item_gross_profit = subtotal - cost_total
-- order_net_profit = SUM(item_gross_profit) - shipping - packaging - tax - commission

-- ============================================
-- SQLite doesn't support DROP COLUMN directly
-- Need to recreate table without redundant columns
-- ============================================

-- Step 1: Create new table with correct structure
CREATE TABLE order_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  product_price REAL NOT NULL DEFAULT 0,
  product_cost REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight TEXT,
  size TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Step 2: Copy data from old table (only needed columns)
INSERT INTO order_items_new (
  id, order_id, product_id, product_name, product_price, product_cost,
  quantity, weight, size, notes, created_at
)
SELECT 
  id, order_id, product_id, product_name, product_price, product_cost,
  quantity, weight, size, notes, created_at
FROM order_items;

-- Step 3: Drop old table
DROP TABLE order_items;

-- Step 4: Rename new table to original name
ALTER TABLE order_items_new RENAME TO order_items;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_product_name ON order_items(product_name);

-- ============================================
-- Verification
-- ============================================

-- Check table structure
PRAGMA table_info(order_items);

-- Expected columns after migration:
-- id, order_id, product_id, product_name, product_price, product_cost,
-- quantity, weight, size, notes, created_at
