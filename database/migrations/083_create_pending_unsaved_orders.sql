-- Migration 083: Pending unsaved orders (extension intent vs real ShopVD orders)
-- Badge "chưa lưu" lấy từ bảng này; mọi kênh tạo đơn đều resolve theo SĐT.

CREATE TABLE IF NOT EXISTS pending_unsaved_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    conversation_key TEXT,
    address TEXT,
    province_id TEXT,
    province_name TEXT,
    ward_id TEXT,
    ward_name TEXT,
    street_address TEXT,
    source TEXT DEFAULT 'extension',
    status TEXT NOT NULL DEFAULT 'open',
    resolved_order_db_id INTEGER,
    resolved_order_code TEXT,
    created_at_unix INTEGER NOT NULL,
    updated_at_unix INTEGER NOT NULL,
    resolved_at_unix INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_unsaved_open_phone
    ON pending_unsaved_orders(customer_phone)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_pending_unsaved_status
    ON pending_unsaved_orders(status);

CREATE INDEX IF NOT EXISTS idx_pending_unsaved_conversation
    ON pending_unsaved_orders(conversation_key);

CREATE INDEX IF NOT EXISTS idx_pending_unsaved_updated
    ON pending_unsaved_orders(updated_at_unix);
