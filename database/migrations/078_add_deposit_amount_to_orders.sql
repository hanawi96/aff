-- Tiền cọc trước (VNĐ). Khi COD: số thu khi giao = total_amount - deposit_amount.
-- Đơn cũ không có cọc → deposit_amount = 0 (mặc định).
ALTER TABLE orders ADD COLUMN deposit_amount INTEGER DEFAULT 0;
