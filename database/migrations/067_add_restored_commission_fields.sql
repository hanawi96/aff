-- Migration: Thêm cột theo dõi khôi phục hoa hồng
-- Ngày: 2026-03-28
-- Mục đích: Theo dõi ai đã khôi phục hoa hồng và khi nào

-- Thêm cột restored_at_unix: thời điểm khôi phục
ALTER TABLE commission_payment_details
ADD COLUMN restored_at_unix INTEGER DEFAULT NULL;

-- Thêm cột restored_by: username admin khôi phục
ALTER TABLE commission_payment_details
ADD COLUMN restored_by TEXT DEFAULT NULL;
