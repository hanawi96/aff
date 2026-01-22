# Migration 056: Discount Campaigns

## Mục đích
Tạo hệ thống quản lý mã giảm giá theo sự kiện/chiến dịch (Tết, 8/3, Black Friday, v.v.)

## Thay đổi
1. Tạo bảng `discount_campaigns` để lưu thông tin sự kiện
2. Thêm cột `campaign_id` vào bảng `discounts` để liên kết mã với sự kiện
3. Tạo indexes để tối ưu performance

## Cách chạy migration

### Bước 1: Chạy migration
```bash
node database/run-migration-056.js
```

### Bước 2: Kiểm tra kết quả
```bash
# Kiểm tra bảng đã được tạo
turso db shell <your-database> "SELECT name FROM sqlite_master WHERE type='table' AND name='discount_campaigns';"

# Kiểm tra cột campaign_id đã được thêm
turso db shell <your-database> "PRAGMA table_info(discounts);"
```

## Rollback (nếu cần)
```sql
-- Xóa cột campaign_id từ discounts
ALTER TABLE discounts DROP COLUMN campaign_id;

-- Xóa bảng campaigns
DROP TABLE discount_campaigns;

-- Xóa indexes
DROP INDEX IF EXISTS idx_discounts_campaign_id;
DROP INDEX IF EXISTS idx_campaigns_dates;
DROP INDEX IF EXISTS idx_campaigns_active;
```

## Cấu trúc bảng discount_campaigns

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Tên sự kiện (VD: "Tết 2025") |
| slug | TEXT | URL-friendly slug (VD: "tet-2025") |
| icon | TEXT | Emoji icon (VD: "🧧") |
| description | TEXT | Mô tả sự kiện |
| start_date | TEXT | Ngày bắt đầu (ISO format) |
| end_date | TEXT | Ngày kết thúc (ISO format) |
| target_orders | INTEGER | Mục tiêu số đơn hàng |
| target_revenue | REAL | Mục tiêu doanh thu |
| is_active | INTEGER | Trạng thái (0/1) |
| created_at_unix | INTEGER | Timestamp tạo |
| updated_at_unix | INTEGER | Timestamp cập nhật |

## Ví dụ sử dụng

### Tạo sự kiện Tết
```sql
INSERT INTO discount_campaigns (
    name, slug, icon, description,
    start_date, end_date,
    target_orders, target_revenue,
    is_active, created_at_unix, updated_at_unix
) VALUES (
    'Tết Nguyên Đán 2025',
    'tet-2025',
    '🧧',
    'Chương trình khuyến mãi Tết Nguyên Đán 2025',
    '2025-01-28',
    '2025-02-05',
    500,
    50000000,
    1,
    1737619200000,
    1737619200000
);
```

### Gán mã giảm giá vào sự kiện
```sql
UPDATE discounts 
SET campaign_id = 1 
WHERE code IN ('TET2025', 'TETLON', 'TETMOI');
```

### Query mã theo sự kiện
```sql
SELECT d.* 
FROM discounts d
JOIN discount_campaigns c ON d.campaign_id = c.id
WHERE c.slug = 'tet-2025';
```

## Lưu ý
- Mã giảm giá có thể tồn tại mà không thuộc sự kiện nào (campaign_id = NULL)
- Khi xóa sự kiện, campaign_id của các mã sẽ được set về NULL (ON DELETE SET NULL)
- Slug phải unique để tránh trùng lặp
