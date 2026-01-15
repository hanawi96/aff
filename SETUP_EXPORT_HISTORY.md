# Setup Export History - Hướng dẫn nhanh

## ✅ Đã cấu hình sẵn

- R2 Bucket: `excel-orders` (đã tồn tại)
- Binding: `R2_EXCEL_BUCKET`
- API endpoint: `https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/excel-orders`

## 🚀 Chỉ cần làm 2 bước:

### Bước 1: Chạy migration

```bash
node database/run-export-history-migration.js
```

### Bước 2: Deploy

```bash
npm run deploy
```

## ✅ Xong! Test ngay:

1. Vào trang quản lý đơn hàng
2. Chọn vài đơn hàng
3. Click nút "Export"
4. Modal "Lịch sử Export" sẽ hiện ra
5. Click "Tải xuống" → File download + Trạng thái cập nhật

## 📁 Files đã thay đổi:

### Backend
- ✅ `src/services/orders/export-service.js` - Service mới
- ✅ `src/handlers/get-handler.js` - Thêm routes
- ✅ `src/handlers/post-handler.js` - Thêm routes
- ✅ `database/export_history_schema.sql` - Schema
- ✅ `database/run-export-history-migration.js` - Migration

### Frontend
- ✅ `public/assets/js/spx-export.js` - Thêm hàm lưu R2
- ✅ `public/assets/js/orders.js` - Thêm UI modal
- ✅ `public/admin/index.html` - Thêm nút "Lịch sử"

### Config
- ✅ `wrangler.toml` - Thêm R2_EXCEL_BUCKET

## 🎯 Tính năng mới:

- ✅ Export không bị đơ trang
- ✅ File lưu vào R2, tải lại bất cứ lúc nào
- ✅ **Chỉ cập nhật trạng thái khi user tải file**
- ✅ Có lịch sử đầy đủ
- ✅ Chi phí ~0đ

## ❓ Troubleshooting

### Lỗi "R2_EXCEL_BUCKET is not defined"
→ Chưa deploy, chạy `npm run deploy`

### File không lưu được
→ Kiểm tra bucket `excel-orders` có tồn tại không:
```bash
wrangler r2 bucket list
```

### Modal không hiện
→ Hard refresh (Ctrl+Shift+R) để clear cache

## 📖 Chi tiết đầy đủ

Xem file `docs/EXPORT_HISTORY_GUIDE.md`
