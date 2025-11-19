-- Migration: Add bank information to CTV table
-- Date: 2024
-- Description: Add bank_account_number and bank_name columns for payment processing

-- Add bank_account_number column
ALTER TABLE ctv ADD COLUMN bank_account_number TEXT;

-- Add bank_name column
ALTER TABLE ctv ADD COLUMN bank_name TEXT;

-- Add comment (SQLite doesn't support comments, but we document here)
-- bank_account_number: Số tài khoản ngân hàng của CTV
-- bank_name: Tên ngân hàng (VD: Vietcombank, Techcombank, MB Bank, etc.)
