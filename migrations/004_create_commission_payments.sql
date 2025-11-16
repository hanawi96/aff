-- Migration: Create commission_payments table
-- Database: vdt (remote)
-- Purpose: Track commission payments to CTVs

CREATE TABLE IF NOT EXISTS commission_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referral_code TEXT NOT NULL,
    month TEXT NOT NULL,  -- Format: "2025-11"
    commission_amount REAL NOT NULL,
    order_count INTEGER NOT NULL,
    payment_date TEXT,
    payment_method TEXT,  -- "bank_transfer", "cash", "momo"
    status TEXT DEFAULT 'pending',  -- "pending", "paid"
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commission_referral ON commission_payments(referral_code);
CREATE INDEX IF NOT EXISTS idx_commission_month ON commission_payments(month);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_month_referral ON commission_payments(month, referral_code);
