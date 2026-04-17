-- Thời điểm gửi hàng (ms, cùng đơn vị created_at_unix). Ghi một lần khi chuyển sang shipped.
ALTER TABLE orders ADD COLUMN shipped_at_unix INTEGER;
