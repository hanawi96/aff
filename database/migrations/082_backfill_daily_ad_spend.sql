-- Migration 082: Backfill daily_ad_spend for past days (210.000đ/ngày)
-- Chỉ INSERT ngày chưa có bản ghi — không ghi đè snapshot đã lưu tay.
-- Ngày hôm nay (VN) không backfill — vẫn dùng default live cho đến khi chốt.

-- Ghi chú: backfill thực tế chạy qua run-migration-082.js (enumerate từng ngày VN).
