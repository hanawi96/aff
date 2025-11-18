-- Migration: Add trigger to auto-update purchases count
-- Created: 2024-11-18
-- Purpose: Automatically increment/decrement purchases when order_items are added/removed

-- Trigger 1: Increment purchases when order_item is inserted
CREATE TRIGGER IF NOT EXISTS increment_purchases_on_order_item_insert
AFTER INSERT ON order_items
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL
BEGIN
    UPDATE products 
    SET purchases = purchases + NEW.quantity
    WHERE id = NEW.product_id;
END;

-- Trigger 2: Decrement purchases when order_item is deleted
CREATE TRIGGER IF NOT EXISTS decrement_purchases_on_order_item_delete
AFTER DELETE ON order_items
FOR EACH ROW
WHEN OLD.product_id IS NOT NULL
BEGIN
    UPDATE products 
    SET purchases = CASE 
        WHEN purchases >= OLD.quantity THEN purchases - OLD.quantity
        ELSE 0
    END
    WHERE id = OLD.product_id;
END;

-- Trigger 3: Update purchases when order_item quantity is changed
CREATE TRIGGER IF NOT EXISTS update_purchases_on_order_item_update
AFTER UPDATE OF quantity ON order_items
FOR EACH ROW
WHEN NEW.product_id IS NOT NULL AND OLD.quantity != NEW.quantity
BEGIN
    UPDATE products 
    SET purchases = CASE 
        WHEN NEW.quantity > OLD.quantity THEN purchases + (NEW.quantity - OLD.quantity)
        WHEN NEW.quantity < OLD.quantity THEN CASE 
            WHEN purchases >= (OLD.quantity - NEW.quantity) THEN purchases - (OLD.quantity - NEW.quantity)
            ELSE 0
        END
        ELSE purchases
    END
    WHERE id = NEW.product_id;
END;

-- Optional: Recalculate all purchases from existing order_items (one-time sync)
-- This ensures existing data is accurate
UPDATE products 
SET purchases = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    WHERE oi.product_id = products.id
)
WHERE id IN (SELECT DISTINCT product_id FROM order_items WHERE product_id IS NOT NULL);
