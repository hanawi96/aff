-- Migration 057: Add special_event column to discounts
-- Purpose: Tag discounts with special events (Tết, 8/3, Black Friday, etc.)
-- Simple approach: 1 event = 1 discount code

-- Add special_event column
ALTER TABLE discounts ADD COLUMN special_event TEXT;

-- Create index for filtering by event
CREATE INDEX IF NOT EXISTS idx_discounts_special_event ON discounts(special_event);

-- Add event_icon column for emoji
ALTER TABLE discounts ADD COLUMN event_icon TEXT;

-- Add event_date column for sorting
ALTER TABLE discounts ADD COLUMN event_date TEXT;
