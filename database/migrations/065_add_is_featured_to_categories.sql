-- Migration 065: Add featured flag to categories
ALTER TABLE categories ADD COLUMN is_featured INTEGER DEFAULT 0;

-- Optional index for filtering featured categories on storefront/admin
CREATE INDEX IF NOT EXISTS idx_categories_featured ON categories(is_featured);
