-- Tối ưu tốc độ load danh sách đơn hàng (admin/index.html → getRecentOrders).
-- 1) Tăng tốc tính giá vốn (SUM theo order_items.order_id) — loại bỏ full scan order_items mỗi đơn.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 2) Tăng tốc ORDER BY created_at_unix DESC khi lấy đơn mới nhất.
CREATE INDEX IF NOT EXISTS idx_orders_created_at_unix ON orders(created_at_unix DESC);

-- 3) Tăng tốc JOIN ctv theo referral_code.
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON orders(referral_code);
