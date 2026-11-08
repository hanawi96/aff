-- Migration 087: Marketing landing pages (+ tracking stored in system_meta)
-- Tracking JSON key: marketing_tracking_v1 (created lazily by API)

CREATE TABLE IF NOT EXISTS marketing_landing_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT,
    cta_url TEXT,
    hero_image_url TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketing_landing_slug
ON marketing_landing_pages(slug);
