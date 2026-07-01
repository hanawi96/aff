-- Migration 081: Daily ad spend + default budget in cost_config
-- Lưu chi quảng cáo theo ngày (YYYY-MM-DD, múi giờ VN) và ngân sách mặc định

CREATE TABLE IF NOT EXISTS daily_ad_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spend_date TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_ad_spend_date ON daily_ad_spend(spend_date);

INSERT INTO cost_config (item_name, item_cost, is_default, display_name)
VALUES ('default_ad_spend', 210000, 1, 'Ngân sách quảng cáo mặc định/ngày')
ON CONFLICT(item_name) DO NOTHING;
