-- Migration 056: Create discount campaigns table
-- Purpose: Manage discount codes by events/campaigns (Tet, 8/3, Black Friday, etc.)

CREATE TABLE IF NOT EXISTS discount_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Basic info
  name TEXT NOT NULL,                    -- "Tết Nguyên Đán 2025"
  slug TEXT UNIQUE NOT NULL,             -- "tet-2025"
  icon TEXT DEFAULT '🎉',                -- Emoji icon
  description TEXT,
  
  -- Time range
  start_date TEXT NOT NULL,              -- ISO date: "2025-01-28"
  end_date TEXT NOT NULL,                -- ISO date: "2025-02-05"
  
  -- Targets (optional)
  target_orders INTEGER,                 -- Target number of orders
  target_revenue REAL,                   -- Target revenue
  
  -- Status
  is_active INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at_unix INTEGER NOT NULL,
  updated_at_unix INTEGER NOT NULL
);

-- Add campaign_id to discounts table
ALTER TABLE discounts ADD COLUMN campaign_id INTEGER REFERENCES discount_campaigns(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_discounts_campaign_id ON discounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON discount_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON discount_campaigns(is_active);
