-- Migration: Add tax management system
-- Created: 2024-11-15
-- Description: Add tax_amount and tax_rate to orders, create tax_config table

-- ============================================
-- 1. Add tax columns to orders table
-- ============================================

-- Add tax_amount column (actual tax paid for this order)
ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0;

-- Add tax_rate column (snapshot of tax rate at order creation time)
ALTER TABLE orders ADD COLUMN tax_rate REAL DEFAULT 0.015;

-- ============================================
-- 2. Create tax_config table
-- ============================================

CREATE TABLE IF NOT EXISTS tax_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_rate REAL NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tax_config_effective_from ON tax_config(effective_from);
CREATE INDEX IF NOT EXISTS idx_tax_config_is_active ON tax_config(is_active);

-- ============================================
-- 3. Insert default tax rate
-- ============================================

INSERT INTO tax_config (tax_rate, effective_from, description, is_active) 
VALUES (0.015, '2024-01-01', 'Thuế 1.5% trên doanh thu (bao gồm phí ship)', 1);

-- ============================================
-- 4. Update existing orders with calculated tax
-- ============================================

-- Calculate and update tax for existing orders
-- Tax = (product_total + shipping_fee) * 0.015
UPDATE orders 
SET 
    tax_amount = ROUND((
        COALESCE((
            SELECT SUM(product_price * quantity) 
            FROM order_items 
            WHERE order_items.order_id = orders.id
        ), 0) + COALESCE(shipping_fee, 0)
    ) * 0.015),
    tax_rate = 0.015
WHERE tax_amount = 0 OR tax_amount IS NULL;

-- ============================================
-- 5. Create indexes for orders table
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_tax_amount ON orders(tax_amount);
CREATE INDEX IF NOT EXISTS idx_orders_tax_rate ON orders(tax_rate);

-- ============================================
-- 6. Verification
-- ============================================

-- Verify tax_config table
SELECT 'Tax config table created' as status, COUNT(*) as records FROM tax_config;

-- Verify orders updated
SELECT 
    'Orders updated with tax' as status,
    COUNT(*) as total_orders,
    SUM(tax_amount) as total_tax,
    AVG(tax_rate) as avg_tax_rate
FROM orders;

-- Show sample of updated orders
SELECT 
    order_id,
    tax_amount,
    tax_rate,
    created_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;
