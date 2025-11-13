-- Thêm cột commission_rate vào bảng ctv
-- Giá trị mặc định là 0.1 (10%)
ALTER TABLE ctv ADD COLUMN commission_rate REAL DEFAULT 0.1;

-- Update các CTV hiện có với commission_rate mặc định
UPDATE ctv SET commission_rate = 0.1 WHERE commission_rate IS NULL;
