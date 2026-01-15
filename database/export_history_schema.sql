-- Export History Table
CREATE TABLE IF NOT EXISTS export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    order_count INTEGER NOT NULL,
    order_ids TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    downloaded_at INTEGER,
    updated_at INTEGER
);

CREATE INDEX idx_export_history_created_at ON export_history(created_at DESC);
CREATE INDEX idx_export_history_status ON export_history(status);
