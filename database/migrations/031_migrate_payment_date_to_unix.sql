-- Migration: Migrate payment_date to payment_date_unix
-- Date: 2024-01-15
-- Reason: Convert existing payment_date (text) to payment_date_unix (timestamp)

-- Update all records that have payment_date but no payment_date_unix
-- Convert YYYY-MM-DD to Unix timestamp (milliseconds)
UPDATE commission_payments
SET payment_date_unix = CAST(
    (julianday(payment_date || ' 00:00:00') - 2440587.5) * 86400000 AS INTEGER
)
WHERE payment_date IS NOT NULL 
AND payment_date != ''
AND (payment_date_unix IS NULL OR payment_date_unix = 0);

-- Verify the migration
SELECT 
    id,
    referral_code,
    payment_date,
    payment_date_unix,
    datetime(payment_date_unix / 1000, 'unixepoch') as converted_date
FROM commission_payments
WHERE status = 'paid'
LIMIT 10;
