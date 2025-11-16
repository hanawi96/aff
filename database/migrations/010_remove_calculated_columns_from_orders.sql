-- Migration: Remove calculated columns from orders table
-- Created: 2024-11-15
-- Reason: total_amount and product_cost should be calculated from order_items
--         These are aggregated values that can be computed dynamically
--
-- Why remove?
-- - Data redundancy (duplicates data from order_items)
-- - Risk of inconsistency (if items change but totals don't update)
-- - Single source of truth (order_items is the source)
--
-- Calculation after migration:
-- total_amount = SUM(order_items.product_price × order_items.quantity)
-- product_cost = SUM(order_items.product_cost × order_items.quantity)

-- ============================================
-- Recreate orders table without calculated columns
-- ============================================

-- Step 1: Create new table without total_amount and product_cost
CREATE TABLE orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  order_date TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  address TEXT,
  products TEXT,
  payment_method TEXT,
  status TEXT,
  referral_code TEXT,
  commission REAL DEFAULT 0,
  ctv_phone TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referral_code) REFERENCES ctv(referral_code)
);

-- Step 2: Copy data (excluding total_amount and product_cost)
INSERT INTO orders_new (
  id, order_id, order_date, customer_name, customer_phone, address,
  products, payment_method, status, referral_code,
  commission, ctv_phone, notes, created_at
)
SELECT 
  id, order_id, order_date, customer_name, customer_phone, address,
  products, payment_method, status, referral_code,
  commission, ctv_phone, notes, created_at
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

-- ============================================
-- Verification
-- ============================================

-- Check table structure
PRAGMA table_info(orders);

-- Expected columns after migration:
-- id, order_id, order_date, customer_name, customer_phone, address,
-- products, payment_method, status, referral_code, commission,
-- ctv_phone, notes, created_at

-- Note: total_amount and product_cost will be calculated from order_items:
-- SELECT 
--   o.*,
--   SUM(oi.product_price * oi.quantity) as total_amount,
--   SUM(oi.product_cost * oi.quantity) as product_cost
-- FROM orders o
-- LEFT JOIN order_items oi ON o.id = oi.order_id
-- GROUP BY o.id
