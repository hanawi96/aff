-- Đơn gửi bù: không thu COD, không ghi doanh thu / hoa hồng / chi phí SP.
-- is_makeup = 1 → Excel *Thu COD = N, Số tiền COD = 0.
ALTER TABLE orders ADD COLUMN is_makeup INTEGER DEFAULT 0;
