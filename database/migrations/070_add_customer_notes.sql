-- Migration: Add customer_notes table for storing customer notes
-- This allows admin users to add notes like "Khách hay hỏi về size XL", "Bạn của anh A", etc.

CREATE TABLE IF NOT EXISTS customer_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    created_by TEXT,
    updated_by TEXT
);

-- Index for fast lookups by phone
CREATE INDEX IF NOT EXISTS idx_customer_notes_phone ON customer_notes(phone);

-- Unique constraint: one note per customer (expandable later for multiple notes)
-- For now, we use single note per customer. If multiple notes needed, consider a separate table.
