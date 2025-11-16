-- Migration: Add total_amount column to orders table
-- Created: 2024-11-16
-- Description: Add total_amount column to store pre-calculated order total
--              total_amount = SUM(order_items.product_price * quantity) + shipping_fee
--
-- Benefits:
-- - Simplify queries (no need to JOIN order_items for total)
-- - Improve performance (no need to calculate SUM every time)
-- - Easier to maintain and less prone to bugs

-- ============================================
-- Step 1: Add total_amount column
-- ============================================
ALTER TABLE orders ADD COLUMN total_amount REAL DEFAULT 0;

-- ============================================
-- Step 2: Populate existing data
-- ============================================
-- Calculate total_amount for all existing orders
UPDATE orders 
SET total_amount = (
    SELECT COALESCE(SUM(order_items.product_price * order_items.quantity), 0)
    FROM order_items 
    WHERE order_items.order_id = orders.id
) + COALESCE(orders.shipping_fee, 0);

-- ============================================
-- Step 3: Create index for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);

-- ============================================
-- Step 4: Create triggers to auto-update total_amount
-- ============================================

-- Trigger 1: When order_items is INSERTED
CREATE TRIGGER IF NOT EXISTS trg_order_items_insert_update_total
AFTER INSERT ON order_items
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = NEW.order_id
    ) + COALESCE(shipping_fee, 0)
    WHERE id = NEW.order_id;
END;

-- Trigger 2: When order_items is UPDATED (price or quantity changed)
CREATE TRIGGER IF NOT EXISTS trg_order_items_update_update_total
AFTER UPDATE ON order_items
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = NEW.order_id
    ) + COALESCE(shipping_fee, 0)
    WHERE id = NEW.order_id;
END;

-- Trigger 3: When order_items is DELETED
CREATE TRIGGER IF NOT EXISTS trg_order_items_delete_update_total
AFTER DELETE ON order_items
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = OLD.order_id
    ) + COALESCE(shipping_fee, 0)
    WHERE id = OLD.order_id;
END;

-- Trigger 4: When orders.shipping_fee is UPDATED
CREATE TRIGGER IF NOT EXISTS trg_orders_shipping_fee_update_total
AFTER UPDATE OF shipping_fee ON orders
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = NEW.id
    ) + COALESCE(NEW.shipping_fee, 0)
    WHERE id = NEW.id;
END;

-- ============================================
-- Verification
-- ============================================

-- Check column exists
PRAGMA table_info(orders);

-- Check index exists
SELECT name FROM sqlite_master WHERE type='index' AND name='idx_orders_total_amount';

-- Check triggers exist
SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='orders' OR tbl_name='order_items';

-- Sample verification: Compare calculated vs stored total_amount
SELECT 
    orders.id,
    orders.order_id,
    orders.total_amount as stored_total,
    (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = orders.id
    ) + COALESCE(orders.shipping_fee, 0) as calculated_total,
    -- Check if they match
    CASE 
        WHEN ABS(orders.total_amount - (
            SELECT COALESCE(SUM(product_price * quantity), 0)
            FROM order_items 
            WHERE order_id = orders.id
        ) - COALESCE(orders.shipping_fee, 0)) < 0.01 
        THEN '✅ OK' 
        ELSE '❌ MISMATCH' 
    END as status
FROM orders
LIMIT 10;

-- ============================================
-- NOTES:
-- ============================================
-- 1. total_amount = SUM(order_items.product_price * quantity) + shipping_fee
-- 2. Triggers automatically update total_amount when:
--    - order_items are inserted/updated/deleted
--    - shipping_fee is updated
-- 3. This is a denormalization for performance
-- 4. Single source of truth is still order_items + shipping_fee
-- 5. Triggers ensure data consistency
