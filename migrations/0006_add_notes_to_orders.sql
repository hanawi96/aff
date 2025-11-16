-- Migration: Add notes column to orders table
-- Created: 2024-11-14
-- Reason: Store order notes and product notes

-- Add notes column for order-level notes
ALTER TABLE orders ADD COLUMN notes TEXT;
