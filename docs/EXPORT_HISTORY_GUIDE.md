# Export History Feature - Hướng dẫn

## Tổng quan

Tính năng "Lịch sử Export" cho phép:
- Lưu file Excel export vào Cloudflare R2
- Xem lại và tải lại file bất cứ lúc nào
- **Chỉ cập nhật trạng thái đơn hàng khi user thực sự tải file**

## Cài đặt

### 1. Chạy Migration

```bash
node database/run-export-history-migration.js
```

### 2. Cấu hình R2 Bucket

Bucket `excel-orders` đã được cấu hình trong `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "R2_EXCEL_BUCKET"
bucket_name = "excel-orders"
```

✅ Bucket đã tồn tại, không cần tạo mới!

## Cách sử dụng

### 1. Export đơn hàng

1. Chọn các đơn hàng cần export
2. Click nút "Export"
3. File sẽ được tạo và lưu vào R2
4. Modal "Lịch sử Export" tự động hiện ra

### 2. Xem lịch sử export

- Click nút "Lịch sử" trên thanh bulk actions
- Hoặc tự động hiện sau khi export

### 3. Tải file và cập nhật trạng thái

1. Trong modal "Lịch sử Export", click "Tải xuống"
2. File sẽ được download
3. **Trạng thái đơn hàng tự động cập nhật sang "Đã gửi hàng"**
4. Trang tự động reload để hiển thị trạng thái mới

### 4. Xóa file export

- Click icon thùng rác bên cạnh file
- Confirm xóa
- File sẽ bị xóa khỏi R2 và database

## Luồng hoạt động

```
Click Export
    ↓
Tạo file Excel
    ↓
Upload lên R2
    ↓
Lưu metadata vào database
    ↓
Hiện modal "Lịch sử Export"
    ↓
User click "Tải xuống"
    ↓
Download file từ R2
    ↓
Cập nhật trạng thái export = "downloaded"
    ↓
Cập nhật trạng thái đơn hàng = "shipped"
    ↓
Reload trang
```

## Database Schema

```sql
CREATE TABLE export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    order_count INTEGER NOT NULL,
    order_ids TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    downloaded_at INTEGER,
    updated_at INTEGER
);
```

## API Endpoints

### GET

- `?action=getExportHistory` - Lấy danh sách export
- `?action=downloadExport&id={exportId}` - Download file

### POST

- `?action=saveExport` - Lưu file export mới
- `?action=markExportDownloaded` - Đánh dấu đã tải và cập nhật trạng thái
- `?action=deleteExport` - Xóa file export

## Files đã thay đổi

### Backend
- `src/services/orders/export-service.js` - Service mới
- `src/handlers/get-handler.js` - Thêm routes
- `src/handlers/post-handler.js` - Thêm routes
- `database/export_history_schema.sql` - Schema mới
- `database/run-export-history-migration.js` - Migration script

### Frontend
- `public/assets/js/spx-export.js` - Thêm `exportToSPXExcelAndSave()`
- `public/assets/js/orders.js` - Thêm export history functions
- `public/admin/index.html` - Thêm nút "Lịch sử"

## Troubleshooting

### File không upload được lên R2

- Kiểm tra R2_BUCKET binding trong wrangler.toml
- Kiểm tra bucket đã được tạo chưa
- Xem logs trong Cloudflare dashboard

### Trạng thái không cập nhật

- Kiểm tra API response trong console
- Xem database có order_ids đúng không
- Kiểm tra quyền update orders table

### Modal không hiện

- Kiểm tra console có lỗi JavaScript không
- Xem API getExportHistory có trả về data không
- Kiểm tra Tailwind CSS đã load chưa

## Chi phí ước tính

- Storage: ~$0.015/GB/tháng
- Egress: **FREE** (R2 không tính phí egress)
- Ví dụ: 100 file × 50KB = 5MB = ~$0.0001/tháng ≈ **0đ**

## Tính năng tương lai

- [ ] Auto-delete file sau 30 ngày
- [ ] Export lại từ order_ids
- [ ] Filter theo ngày/trạng thái
- [ ] Bulk download nhiều file
- [ ] Thống kê số lần tải
