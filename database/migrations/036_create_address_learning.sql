-- Create address_learning table for smart address prediction
-- This table learns from user's address input history to improve auto-fill accuracy

CREATE TABLE IF NOT EXISTS address_learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Search keys (normalized, no diacritics)
    keywords TEXT NOT NULL,           -- Space-separated keywords: "hau duong sau dinh"
    district_id INTEGER NOT NULL,     -- District ID for scoping
    
    -- Learned result
    ward_id INTEGER NOT NULL,         -- Ward ID that was selected
    ward_name TEXT NOT NULL,          -- Ward name for quick display
    
    -- Confidence tracking
    match_count INTEGER DEFAULT 1,    -- Number of times this mapping was used
    last_used_at INTEGER NOT NULL,    -- Unix timestamp of last use
    created_at INTEGER NOT NULL,      -- Unix timestamp of creation
    
    -- Indexes for fast lookup
    UNIQUE(keywords, district_id)     -- One mapping per keyword+district combo
);

-- Index for fast keyword search
CREATE INDEX IF NOT EXISTS idx_address_learning_keywords 
ON address_learning(keywords);

-- Index for district filtering
CREATE INDEX IF NOT EXISTS idx_address_learning_district 
ON address_learning(district_id);

-- Index for sorting by confidence
CREATE INDEX IF NOT EXISTS idx_address_learning_confidence 
ON address_learning(match_count DESC, last_used_at DESC);
