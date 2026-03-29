-- Migration 069: Thêm cột ảnh QR ngân hàng cho CTV
-- Dùng để thanh toán hoa hồng qua quét mã QR

ALTER TABLE ctv ADD COLUMN qr_image_url TEXT;
ALTER TABLE ctv ADD COLUMN qr_image_updated_at_unix INTEGER;
