-- Migration: Remove redundant cost columns from orders table
-- Created: 2024-11-15
-- Reason: packaging_cost, shipping_cost, and profit should be calculated dynamically
--         These are fixed costs that don't need to be stored per order

-- Backup note: These columns will be dropped. Data will be lost.
-- However, these values can be recalculated using:
-- - packaging_cost = 4000 (fixed)
-- - shipping_cost = 21000 (fixed)
-- - profit = total_amount - product_cost - 4000 - 21000 - commission

-- SQLite doesn't support DROP COLUMN with indexes
-- Need to recreate table without redundant columns

-- Step 1: Create new table with correct structure
CREATE TABLE orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  order_date TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  address TEXT,
  products TEXT,
  total_amount REAL DEFAULT 0,
  payment_method TEXT,
  status TEXT,
  referral_code TEXT,
  commission REAL DEFAULT 0,
  ctv_phone TEXT,
  product_cost REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referral_code) REFERENCES ctv(referral_code)
);

-- Step 2: Copy data from old table (only needed columns)
INSERT INTO orders_new (
  id, order_id, order_date, customer_name, customer_phone, address,
  products, total_amount, payment_method, status, referral_code,
  commission, ctv_phone, product_cost, notes, created_at
)
SELECT 
  id, order_id, order_date, customer_name, customer_phone, address,
  products, total_amount, payment_method, status, referral_code,
  commission, ctv_phone, product_cost, notes, created_at
FROM orders;

-- Step 3: Drop old table
DROP TABLE orders;

-- Step 4: Rename new table
ALTER TABLE orders_new RENAME TO orders;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_ctv_phone ON orders(ctv_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Note: We keep product_cost and commission because:
-- - product_cost varies per order (different products)
-- - commission varies per CTV (different rates)
-- Removed columns: profit, packaging_cost, shipping_cost, packaging_details
