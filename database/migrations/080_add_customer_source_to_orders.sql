-- Nguồn khách: zalo | facebook | tiktok (nullable).
-- Đơn cũ trước khi có cột → mặc định facebook (khách chủ yếu từ Facebook).
ALTER TABLE orders ADD COLUMN customer_source TEXT DEFAULT NULL;

UPDATE orders
SET customer_source = 'facebook'
WHERE customer_source IS NULL OR TRIM(customer_source) = '';
