-- Migration: Fix order_items prices by matching with products table
-- Date: 2024-11-15
-- Description: Update product_price and product_cost in order_items by matching product names with products table

-- Step 1: Update items that have product_id
UPDATE order_items
SET 
    product_price = (SELECT price FROM products WHERE products.id = order_items.product_id),
    product_cost = (SELECT cost_price FROM products WHERE products.id = order_items.product_id)
WHERE product_id IS NOT NULL
  AND product_id IN (SELECT id FROM products);

-- Step 2: Update items without product_id but can match by name
UPDATE order_items
SET 
    product_id = (SELECT id FROM products WHERE LOWER(products.name) = LOWER(order_items.product_name) LIMIT 1),
    product_price = (SELECT price FROM products WHERE LOWER(products.name) = LOWER(order_items.product_name) LIMIT 1),
    product_cost = (SELECT cost_price FROM products WHERE LOWER(products.name) = LOWER(order_items.product_name) LIMIT 1)
WHERE product_id IS NULL
  AND EXISTS (SELECT 1 FROM products WHERE LOWER(products.name) = LOWER(order_items.product_name));

-- Step 3: Recalculate subtotal, cost_total, and profit
UPDATE order_items
SET 
    subtotal = product_price * quantity,
    cost_total = product_cost * quantity,
    profit = (product_price * quantity) - (product_cost * quantity)
WHERE product_price > 0;

-- Step 4: Delete items with invalid data (price = 0 and can't match)
DELETE FROM order_items
WHERE product_price = 0 
  AND product_cost = 0
  AND product_id IS NULL;

-- Verification
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN product_id IS NOT NULL THEN 1 END) as with_product_id,
    COUNT(CASE WHEN product_price > 0 THEN 1 END) as with_price,
    COUNT(CASE WHEN product_cost > 0 THEN 1 END) as with_cost,
    ROUND(AVG(profit), 0) as avg_profit,
    ROUND(SUM(profit), 0) as total_profit
FROM order_items;

-- Sample data check
SELECT 
    product_id,
    product_name,
    product_price,
    product_cost,
    quantity,
    subtotal,
    cost_total,
    profit,
    ROUND(profit * 100.0 / NULLIF(subtotal, 0), 1) as profit_margin
FROM order_items
WHERE product_price > 0
LIMIT 10;
