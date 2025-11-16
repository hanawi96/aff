-- Migration: Merge weight column into size column in order_items table
-- Date: 2024-01-XX
-- Description: Consolidate weight and size into single size column

-- Step 1: Migrate data from weight to size (where size is NULL)
UPDATE order_items 
SET size = weight 
WHERE weight IS NOT NULL AND (size IS NULL OR size = '');

-- Step 2: Drop the weight column
ALTER TABLE order_items DROP COLUMN weight;

-- Verification query (run after migration)
-- SELECT id, product_name, size FROM order_items LIMIT 10;
