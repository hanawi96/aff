-- Migration: Update total_amount triggers to include discount
-- Created: 2024-11-21
-- Description: Modify triggers to calculate total_amount with discount deduction
--              total_amount = SUM(order_items.product_price * quantity) + shipping_fee - discount_amount

-- ============================================
-- Step 1: Drop old triggers
-- ============================================
DROP TRIGGER IF EXISTS trg_order_items_insert_update_total;
DROP TRIGGER IF EXISTS trg_order_items_update_update_total;
DROP TRIGGER IF EXISTS trg_order_items_delete_update_total;
DROP TRIGGER IF EXISTS trg_orders_shipping_fee_update_total;

-- ============================================
-- Step 2: Create new triggers with discount
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
    ) + COALESCE(shipping_fee, 0) - COALESCE(discount_amount, 0)
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
    ) + COALESCE(shipping_fee, 0) - COALESCE(discount_amount, 0)
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
    ) + COALESCE(shipping_fee, 0) - COALESCE(discount_amount, 0)
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
    ) + COALESCE(NEW.shipping_fee, 0) - COALESCE(NEW.discount_amount, 0)
    WHERE id = NEW.id;
END;

-- Trigger 5: NEW - When orders.discount_amount is UPDATED
CREATE TRIGGER IF NOT EXISTS trg_orders_discount_update_total
AFTER UPDATE OF discount_amount ON orders
BEGIN
    UPDATE orders 
    SET total_amount = (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = NEW.id
    ) + COALESCE(NEW.shipping_fee, 0) - COALESCE(NEW.discount_amount, 0)
    WHERE id = NEW.id;
END;

-- ============================================
-- Step 3: Recalculate existing orders
-- ============================================
UPDATE orders 
SET total_amount = (
    SELECT COALESCE(SUM(product_price * quantity), 0)
    FROM order_items 
    WHERE order_items.order_id = orders.id
) + COALESCE(orders.shipping_fee, 0) - COALESCE(orders.discount_amount, 0);

-- ============================================
-- Verification
-- ============================================

-- Check triggers exist
SELECT name FROM sqlite_master 
WHERE type='trigger' 
AND (tbl_name='orders' OR tbl_name='order_items')
ORDER BY name;

-- Sample verification: Check total_amount calculation
SELECT 
    o.order_id,
    o.total_amount as stored_total,
    (
        SELECT COALESCE(SUM(product_price * quantity), 0)
        FROM order_items 
        WHERE order_id = o.id
    ) + COALESCE(o.shipping_fee, 0) - COALESCE(o.discount_amount, 0) as calculated_total,
    o.discount_amount,
    CASE 
        WHEN ABS(o.total_amount - (
            SELECT COALESCE(SUM(product_price * quantity), 0)
            FROM order_items 
            WHERE order_id = o.id
        ) - COALESCE(o.shipping_fee, 0) + COALESCE(o.discount_amount, 0)) < 0.01 
        THEN '✅ OK' 
        ELSE '❌ MISMATCH' 
    END as status
FROM orders o
LIMIT 10;

-- ============================================
-- NOTES:
-- ============================================
-- 1. NEW FORMULA: total_amount = SUM(items) + shipping_fee - discount_amount
-- 2. Added new trigger for discount_amount updates
-- 3. All existing orders recalculated with discount
-- 4. total_amount now represents the actual amount customer pays
-- 5. This is the final amount after all discounts applied
