-- Remove old TEXT timestamp columns from commission_payments table
-- These have been replaced with unix timestamp columns

ALTER TABLE commission_payments DROP COLUMN created_at;
ALTER TABLE commission_payments DROP COLUMN updated_at;
