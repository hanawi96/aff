-- Migration 068: Tạo bảng chỉ tiêu CTV theo tháng
-- Bảng lưu chỉ tiêu doanh thu và % thưởng cho từng CTV mỗi tháng

CREATE TABLE IF NOT EXISTS ctv_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referral_code TEXT NOT NULL,
    month TEXT NOT NULL,                  -- YYYY-MM
    target_revenue INTEGER NOT NULL DEFAULT 0,   -- chỉ tiêu doanh thu (VNĐ)
    bonus_percent REAL NOT NULL DEFAULT 10,      -- % thưởng khi đạt chỉ tiêu
    note TEXT DEFAULT '',                       -- ghi chú (tùy chọn)
    created_at_unix INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at_unix INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(referral_code, month)
);

CREATE INDEX IF NOT EXISTS idx_ctv_targets_month ON ctv_targets(month);
CREATE INDEX IF NOT EXISTS idx_ctv_targets_referral ON ctv_targets(referral_code);
