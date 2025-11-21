-- Migration: Add discount columns to orders table
-- Created: 2024-11-21
-- Description: Add discount_code and discount_amount columns to track discount applied to orders
--
-- Benefits:
-- - Store discount information directly in orders for fast access
-- - No need to JOIN discount_usage for profit calculation
-- - Easier to display in order list and profit analysis modal
-- - Maintain data integrity with discount_usage table

-- ============================================
-- Step 1: Add discount columns
-- ============================================
ALTER TABLE orders ADD COLUMN discount_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;

-- ============================================
-- Step 2: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_discount_code ON orders(discount_code);
CREATE INDEX IF NOT EXISTS idx_orders_discount_amount ON orders(discount_amount);

-- ============================================
-- Step 3: Populate existing data from discount_usage
-- ============================================
-- Sync discount data from discount_usage table to orders
UPDATE orders 
SET 
    discount_code = (
        SELECT discount_code 
        FROM discount_usage 
        WHERE discount_usage.order_id = orders.order_id 
        LIMIT 1
    ),
    discount_amount = (
        SELECT discount_amount 
        FROM discount_usage 
        WHERE discount_usage.order_id = orders.order_id 
        LIMIT 1
    )
WHERE EXISTS (
    SELECT 1 
    FROM discount_usage 
    WHERE discount_usage.order_id = orders.order_id
);

-- ============================================
-- Verification
-- ============================================

-- Check columns exist
PRAGMA table_info(orders);

-- Check indexes exist
SELECT name FROM sqlite_master 
WHERE type='index' 
AND (name='idx_orders_discount_code' OR name='idx_orders_discount_amount');

-- Sample verification: Compare orders with discount_usage
SELECT 
    o.order_id,
    o.discount_code as orders_code,
    du.discount_code as usage_code,
    o.discount_amount as orders_amount,
    du.discount_amount as usage_amount,
    CASE 
        WHEN o.discount_code = du.discount_code 
        AND o.discount_amount = du.discount_amount 
        THEN '✅ SYNCED' 
        ELSE '⚠️ MISMATCH' 
    END as status
FROM orders o
LEFT JOIN discount_usage du ON o.order_id = du.order_id
WHERE o.discount_code IS NOT NULL
LIMIT 10;

-- Count orders with discounts
SELECT 
    COUNT(*) as total_orders,
    COUNT(discount_code) as orders_with_discount,
    ROUND(COUNT(discount_code) * 100.0 / COUNT(*), 2) as discount_percentage
FROM orders;

-- ============================================
-- NOTES:
-- ============================================
-- 1. discount_code: Mã giảm giá đã áp dụng (NULL nếu không có)
-- 2. discount_amount: Số tiền được giảm (0 nếu không có)
-- 3. total_amount: Đã bao gồm giảm giá (giá sau giảm)
-- 4. Công thức: original_amount = total_amount + discount_amount
-- 5. Profit calculation: profit = revenue - costs - discount_amount
-- 6. Data sync: orders.discount_* synced from discount_usage table
-- 7. When creating new order with discount:
--    - Save discount_code + discount_amount in orders
--    - Also insert into discount_usage for tracking
