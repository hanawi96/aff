-- Migration: Drop payment_date column from commission_payments
-- Date: 2024-01-15
-- Reason: Consolidate to use only payment_date_unix for consistent timezone handling

-- Drop the payment_date column (keeping only payment_date_unix)
ALTER TABLE commission_payments DROP COLUMN payment_date;

-- Verify the change
SELECT sql FROM sqlite_master WHERE type='table' AND name='commission_payments';
