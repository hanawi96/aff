-- Migration: Create backup_history table
-- Date: 2026-07-07
-- Description: Store backup metadata and R2 file paths

CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,           -- Unix timestamp in milliseconds
    file_name TEXT NOT NULL,               -- Original filename (e.g., shopvd_backup_20260707_093500.sql)
    file_path TEXT NOT NULL,               -- R2 storage path (e.g., backups/1720329000_backup.sql)
    file_size INTEGER,                     -- File size in bytes
    tables_count INTEGER,                  -- Number of tables backed up
    rows_count INTEGER,                    -- Total number of rows backed up
    status TEXT DEFAULT 'completed',       -- completed, failed, in_progress
    downloaded_at INTEGER,                 -- Last download timestamp (null if never downloaded from R2)
    created_by TEXT,                       -- Admin username who created the backup
    notes TEXT,                            -- Optional notes about this backup
    
    -- Indexes for performance
    CONSTRAINT backup_history_created_at_idx UNIQUE (created_at)
);

-- Index for quick retrieval of recent backups
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);

-- Insert initial comment
INSERT INTO backup_history (created_at, file_name, file_path, file_size, tables_count, rows_count, status, notes)
VALUES (
    strftime('%s', 'now') * 1000,
    'initial_migration.sql',
    'backups/migration.sql',
    0,
    0,
    0,
    'completed',
    'Backup history table created - this is a placeholder record'
);
