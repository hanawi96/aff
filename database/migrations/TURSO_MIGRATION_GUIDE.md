# Turso Migration Guide - Remove created_at Column

## Chuẩn bị

### 1. Kiểm tra database name
```bash
# Xem database URL trong .env
cat .env | grep TURSO_DATABASE_URL
# hoặc
type .env | findstr TURSO_DATABASE_URL
```

Database name là phần sau `libsql://` và trước `.turso.io`
Ví dụ: `libsql://vdt-db-xxx.turso.io` → database name là `vdt-db`

### 2. Verify dữ liệu
```bash
turso db shell vdt-db "SELECT COUNT(*) as total, COUNT(created_at_unix) as has_unix, COUNT(*) - COUNT(created_at_unix) as missing FROM orders;"
```

Kết quả mong đợi: `missing = 0` (tất cả orders đều có created_at_unix)

## Chạy Migration

### Option 1: Chạy từng lệnh (Recommended)

```bash
# 1. Backup trước (quan trọng!)
turso db shell vdt-db "CREATE TABLE orders_backup_20260119 AS SELECT * FROM orders;"

# 2. Verify backup
turso db shell vdt-db "SELECT COUNT(*) FROM orders_backup_20260119;"

# 3. Drop column created_at
turso db shell vdt-db "ALTER TABLE orders DROP COLUMN created_at;"

# 4. Verify
turso db shell vdt-db "PRAGMA table_info(orders);"

# 5. Check data
turso db shell vdt-db "SELECT COUNT(*) FROM orders;"
```

### Option 2: Chạy script tự động

```bash
cd database/migrations
run_remove_created_at_turso.bat
```

## Verify sau Migration

### 1. Kiểm tra cột
```bash
turso db shell vdt-db "PRAGMA table_info(orders);"
```
→ Không còn cột `created_at`, chỉ còn `created_at_unix`

### 2. Kiểm tra dữ liệu
```bash
turso db shell vdt-db "SELECT COUNT(*) as total, MIN(created_at_unix) as oldest, MAX(created_at_unix) as newest FROM orders;"
```

### 3. Kiểm tra timestamp format
```bash
turso db shell vdt-db "SELECT order_id, created_at_unix, datetime(created_at_unix / 1000, 'unixepoch') as readable_date FROM orders LIMIT 5;"
```

### 4. Test frontend
- Tạo đơn hàng mới
- Kiểm tra hiển thị giờ đúng
- Kiểm tra filter theo ngày
- Kiểm tra sorting

## Rollback (nếu cần)

```bash
# 1. Drop bảng orders hiện tại
turso db shell vdt-db "DROP TABLE orders;"

# 2. Rename backup thành orders
turso db shell vdt-db "ALTER TABLE orders_backup_20260119 RENAME TO orders;"

# 3. Verify
turso db shell vdt-db "SELECT COUNT(*) FROM orders;"
```

## Xóa Backup (sau khi verify OK)

```bash
# Sau 1-2 ngày test OK, xóa backup để tiết kiệm dung lượng
turso db shell vdt-db "DROP TABLE orders_backup_20260119;"
```

## Troubleshooting

### Lỗi: "no such column: created_at"
→ Migration đã thành công! Đây là lỗi từ code cũ chưa update.
→ Kiểm tra lại tất cả files đã fix chưa.

### Lỗi: "table orders_backup_20260119 already exists"
→ Backup đã tồn tại, có thể:
- Xóa backup cũ: `DROP TABLE orders_backup_20260119;`
- Hoặc đổi tên backup mới: `orders_backup_20260119_v2`

### Dữ liệu bị mất sau migration
→ Restore từ backup:
```bash
turso db shell vdt-db "DROP TABLE orders; ALTER TABLE orders_backup_20260119 RENAME TO orders;"
```

## Notes

- ✅ Turso hỗ trợ `ALTER TABLE DROP COLUMN` trực tiếp
- ✅ Không cần tạo bảng mới và copy dữ liệu
- ✅ Migration nhanh và đơn giản
- ⚠️ Luôn backup trước khi chạy migration
- ⚠️ Test kỹ trên local trước khi chạy production
