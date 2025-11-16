-- Migration: Add packaging cost tracking to orders
-- Created: 2024-11-15
-- Description: Track packaging costs at order creation time for accurate historical profit calculation

-- Add packaging_cost column (total packaging cost for this order)
ALTER TABLE orders ADD COLUMN packaging_cost REAL DEFAULT 0;

-- Add packaging_details column (JSON with breakdown)
ALTER TABLE orders ADD COLUMN packaging_details TEXT;

-- Verify the migration
SELECT 'Migration completed. Added packaging_cost and packaging_details columns to orders table.' AS status;

-- Example packaging_details structure:
-- {
--   "per_product": {
--     "bag_zip": 500,
--     "bag_red": 1000,
--     "thank_card": 300
--   },
--   "per_order": {
--     "box": 5000
--   },
--   "total_products": 3,
--   "total_cost": 10400
-- }
