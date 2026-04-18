-- Ngày giờ dự kiến gửi (đơn trạng thái send_later / «Gửi sau»)
ALTER TABLE orders ADD COLUMN planned_send_at_unix INTEGER;
