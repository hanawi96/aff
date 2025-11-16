-- Migration: Normalize order status from Vietnamese to English
-- Date: 2024-01-15
-- Description: Update all order statuses to use English values for consistency

-- Update status values
UPDATE orders SET status = 'pending' WHERE status = 'Mới' OR status = 'Chờ xử lý' OR status IS NULL;
UPDATE orders SET status = 'processing' WHERE status = 'Đang xử lý';
UPDATE orders SET status = 'shipped' WHERE status = 'Đã gửi hàng' OR status = 'Đang giao';
UPDATE orders SET status = 'delivered' WHERE status = 'Đã giao hàng' OR status = 'Hoàn thành';
UPDATE orders SET status = 'cancelled' WHERE status = 'Đã hủy' OR status = 'Hủy';

-- Verify the update
SELECT status, COUNT(*) as count FROM orders GROUP BY status;
