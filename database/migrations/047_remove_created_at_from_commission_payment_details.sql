-- Remove old TEXT timestamp column from commission_payment_details table
-- This has been replaced with created_at_unix column

ALTER TABLE commission_payment_details DROP COLUMN created_at;
