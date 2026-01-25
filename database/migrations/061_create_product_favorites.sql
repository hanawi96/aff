-- Migration 061: Create product_favorites table
-- Date: 2026-01-25
-- Description: Track which users/sessions have favorited which products

CREATE TABLE IF NOT EXISTS product_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    user_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_product_favorites_product_id ON product_favorites(product_id);

CREATE INDEX IF NOT EXISTS idx_product_favorites_session_id ON product_favorites(session_id);

CREATE INDEX IF NOT EXISTS idx_product_favorites_user_id ON product_favorites(user_id);
