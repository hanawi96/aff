-- Migration: Add weight, size, and notes columns to order_items table
-- Date: 2024-01-XX
-- Description: Add product details (weight, size, notes) to order_items for better tracking

-- Add weight column
ALTER TABLE order_items ADD COLUMN weight TEXT;

-- Add size column
ALTER TABLE order_items ADD COLUMN size TEXT;

-- Add notes column
ALTER TABLE order_items ADD COLUMN notes TEXT;

-- Verify columns were added
SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items';
