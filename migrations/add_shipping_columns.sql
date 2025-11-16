-- Add shipping columns to orders table
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN tracking_url TEXT;

-- Create index for faster tracking lookup
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);
