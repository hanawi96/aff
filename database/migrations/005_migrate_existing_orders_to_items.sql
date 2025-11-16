-- Migration: Migrate existing order products to order_items
-- Date: 2024-11-15
-- Description: Parse products JSON from existing orders and populate order_items table
--              This is a DATA migration, not a schema migration

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- This migration CANNOT be run directly in SQL because:
-- 1. SQLite doesn't have native JSON parsing functions in all versions
-- 2. We need to parse complex JSON structures
-- 3. We need to handle various product formats (JSON array, text, etc.)
--
-- This migration MUST be run through the application code (worker.js)
-- See the migrateOrdersToItems() function in worker.js
--
-- The function will:
-- 1. Fetch all existing orders
-- 2. Parse the products column (JSON or text)
-- 3. For each product in each order:
--    - Extract product details (name, price, quantity, etc.)
--    - Try to match with products table to get product_id and cost_price
--    - Calculate subtotal, cost_total, profit
--    - Insert into order_items table
-- 4. Handle errors gracefully (log but don't fail entire migration)
--
-- ============================================
-- Manual verification after migration:
-- ============================================

-- Check total orders
SELECT COUNT(*) as total_orders FROM orders;

-- Check total order items created
SELECT COUNT(*) as total_items FROM order_items;

-- Check orders with items
SELECT 
  COUNT(DISTINCT order_id) as orders_with_items 
FROM order_items;

-- Check orders without items (should investigate these)
SELECT 
  o.id, 
  o.order_id, 
  o.products,
  o.created_at
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE oi.id IS NULL
LIMIT 10;

-- Verify profit calculations match
SELECT 
  o.id,
  o.order_id,
  o.profit as order_profit,
  SUM(oi.profit) as items_profit,
  ABS(o.profit - SUM(oi.profit)) as difference
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id
HAVING ABS(difference) > 1
LIMIT 10;

-- Sample data check
SELECT 
  oi.*,
  o.order_id,
  o.total_amount
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
LIMIT 5;
