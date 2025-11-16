# Database Migrations

## Hướng dẫn chạy migration cho D1 Database

### Bước 1: Kết nối với D1 Database

```bash
# Kiểm tra database hiện có
wrangler d1 list

# Kết nối với database "vdt"
wrangler d1 execute vdt --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Bước 2: Chạy migration tạo bảng commission_payments

```bash
# Chạy migration file
wrangler d1 execute vdt --remote --file=./migrations/004_create_commission_payments.sql
```

### Bước 3: Kiểm tra bảng đã tạo thành công

```bash
# Xem cấu trúc bảng
wrangler d1 execute vdt --remote --command "PRAGMA table_info(commission_payments);"

# Xem danh sách indexes
wrangler d1 execute vdt --remote --command "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='commission_payments';"
```

### Bước 4: Deploy Worker

```bash
# Deploy worker với code mới
wrangler deploy
```

## Kiểm tra hệ thống

1. Truy cập: `https://your-domain.com/admin/payments.html`
2. Chọn tháng hiện tại
3. Click "Tính hoa hồng"
4. Kiểm tra danh sách CTV hiển thị

## Rollback (nếu cần)

```bash
# Xóa bảng commission_payments
wrangler d1 execute vdt --remote --command "DROP TABLE IF EXISTS commission_payments;"

# Xóa indexes
wrangler d1 execute vdt --remote --command "DROP INDEX IF EXISTS idx_commission_referral;"
wrangler d1 execute vdt --remote --command "DROP INDEX IF EXISTS idx_commission_month;"
wrangler d1 execute vdt --remote --command "DROP INDEX IF EXISTS idx_commission_status;"
wrangler d1 execute vdt --remote --command "DROP INDEX IF EXISTS idx_commission_month_referral;"
```

## Lưu ý

- Database name: `vdt`
- Sử dụng `--remote` để chạy trên production database
- Bỏ `--remote` nếu muốn test trên local database
