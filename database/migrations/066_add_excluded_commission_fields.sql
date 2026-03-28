-- Migration: Thêm cột loại khỏi thanh toán vào bảng hoa hồng
-- Ngày: 2026-03-28
-- Mục đích: Cho phép admin loại một hoa hồng cụ thể khỏi danh sách thanh toán
--            khi đơn hàng giao không thành công (admin kiểm tra thủ công)

-- Thêm cột is_excluded: đánh dấu hoa hồng bị loại khỏi thanh toán
ALTER TABLE commission_payment_details
ADD COLUMN is_excluded INTEGER NOT NULL DEFAULT 0;

-- Thêm cột excluded_at_unix: thời điểm bị loại (timestamp unix milliseconds)
ALTER TABLE commission_payment_details
ADD COLUMN excluded_at_unix INTEGER DEFAULT NULL;

-- Thêm cột excluded_by: username của admin đã loại hoa hồng
ALTER TABLE commission_payment_details
ADD COLUMN excluded_by TEXT DEFAULT NULL;

-- Thêm cột exclude_reason: lý do loại (tùy chọn, admin có thể ghi chú)
ALTER TABLE commission_payment_details
ADD COLUMN exclude_reason TEXT DEFAULT NULL;

-- Tạo index để tối ưu truy vấn lọc theo is_excluded
-- (D1 SQLite không hỗ trợ index trên boolean trực tiếp, nhưng INTEGER là OK)
CREATE INDEX IF NOT EXISTS idx_cpd_is_excluded ON commission_payment_details(is_excluded);

-- Kết quả:
--   0 = hoa hồng bình thường, tính vào tổng thanh toán
--   1 = hoa hồng bị loại (đơn giao thất bại / hoàn tiền)
