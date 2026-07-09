-- Migration 084: Dedupe pending_unsaved_orders + harden unique open phone
-- Giữ 1 dòng open mới nhất / SĐT; đóng các bản trùng.

UPDATE pending_unsaved_orders
SET status = 'dismissed',
    updated_at_unix = CAST(strftime('%s','now') AS INTEGER) * 1000,
    resolved_at_unix = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE status = 'open'
  AND id NOT IN (
    SELECT MAX(id)
    FROM pending_unsaved_orders
    WHERE status = 'open'
    GROUP BY customer_phone
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_unsaved_open_phone
    ON pending_unsaved_orders(customer_phone)
    WHERE status = 'open';
