-- ============================================
-- ADD USED_AT_UNIX COLUMN TO DISCOUNT_USAGE
-- ============================================
-- This migration adds a Unix timestamp column for proper Vietnam timezone handling
-- used_at_unix stores milliseconds since epoch (same format as order_date in orders table)

ALTER TABLE discount_usage 
ADD COLUMN used_at_unix INTEGER;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_discount_usage_used_at_unix ON discount_usage(used_at_unix);
