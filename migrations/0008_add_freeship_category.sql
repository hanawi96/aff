-- Migration: Add Freeship category for bundle products
-- Created: 2024-11-15

-- Insert Freeship category with specific ID
INSERT INTO categories (id, name, description, icon, color, display_order, is_active) 
VALUES (23, 'Freeship', 'Sản phẩm bán kèm (Freeship)', '⚡', '#f59e0b', 10, 1)
ON CONFLICT(id) DO UPDATE SET 
    name = 'Freeship',
    description = 'Sản phẩm bán kèm (Freeship)',
    icon = '⚡',
    color = '#f59e0b',
    display_order = 10,
    is_active = 1;

-- Update existing products to Freeship category if they match the pattern
-- You can manually update products that should be in Freeship category
-- Example:
-- UPDATE products SET category_id = 23 WHERE name LIKE '%bó%' OR name LIKE '%túi%' OR name LIKE '%móc%';
