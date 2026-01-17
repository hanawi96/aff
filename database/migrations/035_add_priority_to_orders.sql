-- Migration: Add priority flag to orders table
-- Created: 2026-01-17
-- Purpose: Allow marking orders as priority for better management

-- Add is_priority column (0 = normal, 1 = priority)
ALTER TABLE orders ADD COLUMN is_priority INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(is_priority);

-- Update existing orders to normal priority
UPDATE orders SET is_priority = 0 WHERE is_priority IS NULL;
