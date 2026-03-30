-- Expand bracelet_type to support 3 values:
-- elastic = dây co giãn, adjustable = dây rút, other = loại khác
--
-- Why this migration:
-- - Existing DB already has bracelet_type CHECK(... IN ('elastic', 'adjustable'))
-- - SQLite cannot directly alter CHECK constraint
-- - We recreate the column via temp column + copy + drop + rename

ALTER TABLE products
ADD COLUMN bracelet_type_new TEXT DEFAULT 'elastic' CHECK (bracelet_type_new IN ('elastic', 'adjustable', 'other'));

UPDATE products
SET bracelet_type_new = CASE
    WHEN bracelet_type IN ('elastic', 'adjustable', 'other') THEN bracelet_type
    ELSE 'elastic'
END;

ALTER TABLE products DROP COLUMN bracelet_type;

ALTER TABLE products RENAME COLUMN bracelet_type_new TO bracelet_type;
