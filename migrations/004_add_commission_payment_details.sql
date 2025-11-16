-- Migration 004: Add commission_payment_details table
-- Purpose: Track individual order payments for flexible commission payment
-- Date: 2025-11-16

-- Create commission_payment_details table
CREATE TABLE IF NOT EXISTS commission_payment_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    commission_amount REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES commission_payments(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_details_payment_id ON commission_payment_details(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_details_order_id ON commission_payment_details(order_id);

-- Add unique constraint to prevent duplicate payments for same order
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_details_order_unique ON commission_payment_details(order_id);

-- Update commission_payments table to add more fields if needed
-- Note: This is optional, the existing structure is already good
