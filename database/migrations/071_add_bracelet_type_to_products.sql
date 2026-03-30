-- Add bracelet_type to products for admin selection:
-- elastic = dây co giãn (default), adjustable = dây rút, other = loại khác
ALTER TABLE products ADD COLUMN bracelet_type TEXT DEFAULT 'elastic' CHECK (bracelet_type IN ('elastic', 'adjustable', 'other'));

-- Ensure old rows are backfilled with default value
UPDATE products
SET bracelet_type = 'elastic'
WHERE bracelet_type IS NULL OR TRIM(bracelet_type) = '';
