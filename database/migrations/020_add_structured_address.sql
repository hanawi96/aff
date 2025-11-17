-- Migration: Thêm cấu trúc địa chỉ 4 cấp cho orders
-- Ngày: 2024-11-17
-- Mục đích: Hỗ trợ thống kê địa lý và tích hợp shipping API

-- Thêm 7 cột địa chỉ mới
ALTER TABLE orders ADD COLUMN province_id TEXT;
ALTER TABLE orders ADD COLUMN province_name TEXT;
ALTER TABLE orders ADD COLUMN district_id TEXT;
ALTER TABLE orders ADD COLUMN district_name TEXT;
ALTER TABLE orders ADD COLUMN ward_id TEXT;
ALTER TABLE orders ADD COLUMN ward_name TEXT;
ALTER TABLE orders ADD COLUMN street_address TEXT;

-- Tạo index để tăng tốc query thống kê
CREATE INDEX IF NOT EXISTS idx_orders_province_id ON orders(province_id);
CREATE INDEX IF NOT EXISTS idx_orders_district_id ON orders(district_id);
CREATE INDEX IF NOT EXISTS idx_orders_ward_id ON orders(ward_id);

-- Cột address cũ vẫn giữ để backward compatibility
-- address sẽ được auto-generate từ: street_address + ward_name + district_name + province_name
