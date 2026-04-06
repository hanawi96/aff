-- Migration 075: Optional cover image URL for product categories (R2 public URL)
ALTER TABLE categories ADD COLUMN image_url TEXT;
