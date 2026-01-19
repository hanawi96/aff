# Remove created_at Column Migration

## Tổng quan
Migration này loại bỏ cột `created_at` (UTC ISO string) khỏi bảng `orders` và chỉ sử dụng `created_at_unix` (Unix timestamp Vietnam time).

## Lý do
1. **Cột created_at (cũ)**: Lưu dạng ISO string UTC → Gây nhầm lẫn về timezone
2. **Cột created_at_unix (mới)**: Lưu Unix timestamp milliseconds → Chính xác giờ Việt Nam
3. Giữ 2 cột gây dư thừa và có thể gây lỗi khi query

## Các file đã fix

### Backend Services (src/services/)

#### 1. payments/payment-service.js
- ✅ `getCommissionsByMonth()`: Đổi `DATE(o.created_at)` → `DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime')`
- ✅ `calculateMonthlyCommissions()`: Đổi `DATE(created_at)` → `DATE(created_at_unix / 1000, 'unixepoch', 'localtime')`
- ✅ `getUnpaidOrders()`: Đổi `o.created_at` → `o.created_at_unix`, ORDER BY `created_at_unix`
- ✅ `getUnpaidOrdersByMonth()`: Đổi `DATE(o.created_at)` → `DATE(o.created_at_unix / 1000, 'unixepoch', 'localtime')`

#### 2. orders/order-queries.js
- ✅ `getOrdersByReferralCode()`: ORDER BY `created_at_unix DESC`
- ✅ `getOrdersByPhone()`: ORDER BY `created_at_unix DESC`
- ✅ `getRecentOrders()`: ORDER BY `orders.created_at_unix DESC`

#### 3. ctv/ctv-service.js
- ✅ `getCollaboratorInfo()`: SELECT `created_at_unix`, ORDER BY `created_at_unix DESC`
- ✅ `getAllCTV()`: Đổi `DATE(created_at)` → `DATE(created_at_unix / 1000, 'unixepoch', 'localtime')`

#### 4. ctv/ctv-stats.js
- ✅ `getCTVOrdersOptimized()`: ORDER BY `o.created_at_unix DESC`
- ✅ `getCTVOrdersByPhoneOptimized()`: ORDER BY `o.created_at_unix DESC`

#### 5. orders/export-service.js
- ✅ `exportOrdersToExcel()`: ORDER BY `created_at_unix DESC`

#### 6. analytics/profit-report.js
- ✅ `getProfitReport()`: ORDER BY `orders.created_at_unix DESC`

#### 7. analytics/product-stats.js
- ✅ `getProductStats()`: ORDER BY `oi.created_at_unix DESC`

#### 8. analytics/detailed-analytics.js
- ✅ Debug query: SELECT `created_at_unix`

### Frontend (public/assets/js/)

#### 1. orders/orders-table.js
- ✅ Ưu tiên `order.created_at_unix` thay vì `order.created_at`

#### 2. orders/orders-filters.js
- ✅ Date filter: Dùng `order.created_at_unix` thay vì `order.created_at`

#### 3. orders/orders-sorting.js
- ✅ Date sorting: Dùng `created_at_unix` thay vì `created_at`

#### 4. orders/orders-utils.js
- ✅ `formatDateTimeSplit()`: Xử lý cả Unix timestamp và ISO string

## Migration Script

### File: database/migrations/037_remove_created_at_column.sql

**Các bước:**
1. Verify tất cả orders có `created_at_unix`
2. Tạo bảng `orders_new` không có cột `created_at`
3. Copy dữ liệu từ `orders` sang `orders_new`
4. Drop bảng `orders` cũ
5. Rename `orders_new` thành `orders`
6. Recreate indexes

## Cách chạy Migration

### Local Development:
```bash
cd database/migrations
run_remove_created_at.bat
```

### Production (Turso):
```bash
# Backup trước
turso db shell vdt-db "CREATE TABLE orders_backup AS SELECT * FROM orders;"

# Chạy migration
turso db shell vdt-db < database/migrations/037_remove_created_at_column.sql

# Verify
turso db shell vdt-db "SELECT COUNT(*) FROM orders;"
```

## Verify sau khi Migration

1. **Kiểm tra cột:**
```sql
PRAGMA table_info(orders);
-- Không còn cột 'created_at'
```

2. **Kiểm tra dữ liệu:**
```sql
SELECT 
    COUNT(*) as total_orders,
    MIN(created_at_unix) as oldest_timestamp,
    MAX(created_at_unix) as newest_timestamp
FROM orders;
```

3. **Test frontend:**
- Tạo đơn hàng mới
- Kiểm tra hiển thị giờ đúng (không còn sai 7 giờ)
- Kiểm tra filter theo ngày hoạt động
- Kiểm tra sorting theo ngày hoạt động

## Rollback (nếu cần)

```sql
-- Restore từ backup
DROP TABLE orders;
ALTER TABLE orders_backup RENAME TO orders;

-- Recreate indexes
CREATE INDEX idx_orders_referral_code ON orders(referral_code);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
-- ... (các indexes khác)
```

## Notes

- ✅ Tất cả queries đã được update để dùng `created_at_unix`
- ✅ Frontend đã được update để hiển thị đúng timezone
- ✅ SQLite date functions: `DATE(created_at_unix / 1000, 'unixepoch', 'localtime')`
- ✅ Backup tự động được tạo trước khi migration
- ⚠️ Sau khi migration, không thể rollback mà không mất dữ liệu mới

## Kết quả mong đợi

- ❌ Không còn cột `created_at` trong bảng `orders`
- ✅ Chỉ còn cột `created_at_unix` (Unix timestamp)
- ✅ Tất cả queries hoạt động bình thường
- ✅ Hiển thị giờ chính xác (Vietnam timezone)
- ✅ Filter và sorting theo ngày hoạt động đúng
