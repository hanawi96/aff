-- Remove old TEXT timestamp columns from products table
-- These have been replaced with unix timestamp columns

ALTER TABLE products DROP COLUMN created_at;
ALTER TABLE products DROP COLUMN updated_at;
