-- Migration: Add commission_rate to orders table
-- Created: 2024-11-21
-- Description: Store CTV commission rate at order creation time for accurate reporting

-- Add commission_rate column
ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 0;

-- Update existing orders with calculated rate
UPDATE orders 
SET commission_rate = CASE 
    WHEN commission > 0 AND (
        SELECT SUM(product_price * quantity) 
        FROM order_items 
        WHERE order_items.order_id = orders.id
    ) > 0 
    THEN CAST(commission AS REAL) / (
        SELECT SUM(product_price * quantity) 
        FROM order_items 
        WHERE order_items.order_id = orders.id
    )
    ELSE 0 
END;

-- Create index
CREATE INDEX IF NOT EXISTS idx_orders_commission_rate ON orders(commission_rate);

-- Verification
SELECT 
    order_id,
    commission,
    commission_rate,
    ROUND(commission_rate * 100, 1) as rate_percent
FROM orders 
WHERE commission > 0
LIMIT 5;
