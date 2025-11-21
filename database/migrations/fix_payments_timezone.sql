-- Migration: Fix Payments Timezone
-- Purpose: Add created_at_unix and payment_date_unix for commission payments
-- Date: 2024-11-21

-- ============================================
-- COMMISSION_PAYMENTS TABLE
-- ============================================

-- Step 1: Add created_at_unix column
ALTER TABLE commission_payments ADD COLUMN created_at_unix INTEGER;

-- Step 2: Add updated_at_unix column
ALTER TABLE commission_payments ADD COLUMN updated_at_unix INTEGER;

-- Step 3: Add payment_date_unix column
ALTER TABLE commission_payments ADD COLUMN payment_date_unix INTEGER;

-- Step 4: Update created_at_unix from created_at
UPDATE commission_payments 
SET created_at_unix = CAST(strftime('%s', created_at) AS INTEGER) * 1000
WHERE created_at_unix IS NULL 
  AND created_at IS NOT NULL;

-- Step 5: Update updated_at_unix from updated_at
UPDATE commission_payments 
SET updated_at_unix = CAST(strftime('%s', updated_at) AS INTEGER) * 1000
WHERE updated_at_unix IS NULL 
  AND updated_at IS NOT NULL;

-- Step 6: Update payment_date_unix from payment_date
-- payment_date is stored as 'YYYY-MM-DD', convert to Unix timestamp at midnight UTC
UPDATE commission_payments 
SET payment_date_unix = CAST(strftime('%s', payment_date || ' 00:00:00') AS INTEGER) * 1000
WHERE payment_date_unix IS NULL 
  AND payment_date IS NOT NULL;

-- Step 7: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commission_payments_created_at_unix ON commission_payments(created_at_unix);
CREATE INDEX IF NOT EXISTS idx_commission_payments_payment_date_unix ON commission_payments(payment_date_unix);

-- ============================================
-- COMMISSION_PAYMENT_DETAILS TABLE
-- ============================================

-- Step 8: Add created_at_unix column
ALTER TABLE commission_payment_details ADD COLUMN created_at_unix INTEGER;

-- Step 9: Update created_at_unix from created_at
UPDATE commission_payment_details 
SET created_at_unix = CAST(strftime('%s', created_at) AS INTEGER) * 1000
WHERE created_at_unix IS NULL 
  AND created_at IS NOT NULL;

-- Step 10: Create index
CREATE INDEX IF NOT EXISTS idx_commission_payment_details_created_at_unix ON commission_payment_details(created_at_unix);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify commission_payments
SELECT 
    'commission_payments' as table_name,
    COUNT(*) as total_records,
    COUNT(created_at_unix) as records_with_unix,
    COUNT(*) - COUNT(created_at_unix) as records_missing_unix
FROM commission_payments;

-- Verify commission_payment_details
SELECT 
    'commission_payment_details' as table_name,
    COUNT(*) as total_records,
    COUNT(created_at_unix) as records_with_unix,
    COUNT(*) - COUNT(created_at_unix) as records_missing_unix
FROM commission_payment_details;

-- Sample data verification
SELECT 
    id,
    referral_code,
    month,
    payment_date,
    payment_date_unix,
    datetime(payment_date_unix/1000, 'unixepoch') as payment_date_utc,
    datetime(payment_date_unix/1000, 'unixepoch', '+7 hours') as payment_date_vn,
    created_at,
    datetime(created_at_unix/1000, 'unixepoch', '+7 hours') as created_at_vn
FROM commission_payments
ORDER BY id DESC
LIMIT 5;
