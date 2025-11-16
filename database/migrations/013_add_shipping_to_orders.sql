-- Migration: Add shipping columns to orders table
-- Created: 2024-11-15
-- Description: Add shipping_fee (charged to customer) and shipping_cost (actual cost)

-- Add shipping_fee column (amount charged to customer)
ALTER TABLE orders ADD COLUMN shipping_fee REAL DEFAULT 0;

-- Add shipping_cost column (actual shipping cost paid to carrier)
ALTER TABLE orders ADD COLUMN shipping_cost REAL DEFAULT 0;

-- Add notes column for shipping notes if not exists
-- ALTER TABLE orders ADD COLUMN shipping_notes TEXT;

-- Verify the migration
SELECT 'Migration completed. Added shipping_fee and shipping_cost columns to orders table.' AS status;

-- Example usage:
-- shipping_fee = 30000 (customer pays 30k)
-- shipping_cost = 25000 (you pay carrier 25k)
-- profit includes: (shipping_fee - shipping_cost) = 5k profit from shipping
