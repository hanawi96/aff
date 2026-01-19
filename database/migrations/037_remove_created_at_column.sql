-- Migration 037: Remove created_at column from orders table
-- All queries now use created_at_unix instead

-- Step 1: Verify all orders have created_at_unix
-- This should return 0 if all orders have timestamps
SELECT COUNT(*) as missing_timestamps 
FROM orders 
WHERE created_at_unix IS NULL;

-- Step 2: Drop the old created_at column
-- Note: SQLite doesn't support DROP COLUMN directly in older versions
-- We need to recreate the table without the column

-- Create new orders table without created_at
CREATE TABLE orders_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    referral_code TEXT,
    commission REAL DEFAULT 0,
    commission_rate REAL,
    ctv_phone TEXT,
    notes TEXT,
    shipping_fee REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    packaging_cost REAL DEFAULT 0,
    packaging_details TEXT,
    tax_amount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    created_at_unix INTEGER,
    province_id TEXT,
    province_name TEXT,
    district_id TEXT,
    district_name TEXT,
    ward_id TEXT,
    ward_name TEXT,
    street_address TEXT,
    discount_amount REAL DEFAULT 0,
    discount_code TEXT,
    customer_shipping_fee REAL DEFAULT 0,
    is_priority INTEGER DEFAULT 0
);

-- Copy data from old table to new table
INSERT INTO orders_new SELECT 
    id, order_id, customer_name, customer_phone, customer_address,
    total_amount, status, referral_code, commission, commission_rate,
    ctv_phone, notes, shipping_fee, shipping_cost, packaging_cost,
    packaging_details, tax_amount, tax_rate, created_at_unix,
    province_id, province_name, district_id, district_name,
    ward_id, ward_name, street_address, discount_amount, discount_code,
    customer_shipping_fee, is_priority
FROM orders;

-- Drop old table
DROP TABLE orders;

-- Rename new table
ALTER TABLE orders_new RENAME TO orders;

-- Recreate indexes
CREATE INDEX idx_orders_referral_code ON orders(referral_code);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_ctv_phone ON orders(ctv_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at_unix ON orders(created_at_unix);
CREATE INDEX idx_orders_province ON orders(province_id);
CREATE INDEX idx_orders_district ON orders(district_id);
CREATE INDEX idx_orders_ward ON orders(ward_id);

-- Verify migration
SELECT 
    COUNT(*) as total_orders,
    MIN(created_at_unix) as oldest_timestamp,
    MAX(created_at_unix) as newest_timestamp
FROM orders;
