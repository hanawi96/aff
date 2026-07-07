# 📦 Hướng Dẫn Sử Dụng Backup & Restore Database

## 🎯 Tổng Quan

Hệ thống backup & restore cho phép bạn:
- ✅ Sao lưu toàn bộ database thành file SQL
- ✅ Khôi phục dữ liệu từ file backup
- ✅ Tự động backup an toàn trước khi restore
- ✅ Validate file backup trước khi import

---

## 📁 Cấu Trúc Files Đã Tạo

### Backend Services
```
src/services/backup/
├── backup-service.js      # Tạo backup, export SQL
└── restore-service.js     # Restore, validate backup
```

### Handlers (Routes)
```
src/handlers/
├── get-handler.js         # Routes: createBackup, getBackupMetadata
└── post-handler.js        # Routes: restoreBackup, validateBackup
```

### Frontend
```
public/admin/
├── settings.html          # UI section backup & restore
└── assets/js/settings.js  # JavaScript functions
```

---

## 🚀 Cách Sử Dụng

### 1️⃣ Truy cập trang Settings

Mở: `https://shopvd.store/admin/settings`

### 2️⃣ Tạo Backup

**Bước 1:** Xem thông tin database
- Tổng số bảng
- Tổng số dòng
- Dung lượng ước tính

**Bước 2:** Click nút **"Tạo & Tải Backup"**
- Hệ thống sẽ export toàn bộ database
- File SQL tự động download về máy
- Tên file: `shopvd_backup_YYYYMMDD_HHMMSS.sql`

### 3️⃣ Khôi Phục Database

**Bước 1:** Chọn file backup
- Kéo thả file vào vùng drop zone
- Hoặc click để chọn file
- Chấp nhận: `.sql` hoặc `.sql.gz`

**Bước 2:** Validate file (tự động)
- Hệ thống kiểm tra file hợp lệ
- Hiển thị thông tin: số bảng, số dòng

**Bước 3:** Click **"Khôi phục Database"**
- Xác nhận 2 lần để đảm bảo an toàn
- Hệ thống tự động tạo backup trước khi restore
- Chờ quá trình restore hoàn tất

---

## 🔒 An Toàn & Bảo Mật

### ✅ Các Biện Pháp Bảo Vệ

1. **Confirm 2 lần** trước khi restore
2. **Backup tự động** trước khi ghi đè dữ liệu
3. **Validate SQL** - Chặn các lệnh nguy hiểm:
   - DROP DATABASE
   - GRANT / REVOKE
   - CREATE USER
4. **Foreign keys** tự động tắt/bật khi restore

### ⚠️ Lưu Ý Quan Trọng

- ❌ **KHÔNG THỂ HOÀN TÁC** sau khi restore
- ❌ Dữ liệu hiện tại sẽ **BỊ GHI ĐÈ**
- ✅ Luôn giữ backup ở nơi an toàn
- ✅ Test restore trên database test trước

---

## 🎨 UI/UX Design

### Backup Card (Cyan/Teal)
- Hiển thị metadata database
- Nút download với icon và animation
- Progress indicator khi đang tạo backup

### Restore Card (Rose/Pink)
- Drag & drop zone với hover effect
- Warning box với icon cảnh báo
- Disabled state cho nút restore

### Toast Notifications
- ⏳ Info: Đang xử lý
- ✅ Success: Thành công
- ⚠️ Warning: Cảnh báo
- ❌ Error: Lỗi

---

## 🔧 API Endpoints

### GET Endpoints

#### 1. Tạo Backup
```
GET /api?action=createBackup
```
**Response:** File SQL download

**Headers:**
- `Content-Type: application/sql`
- `Content-Disposition: attachment; filename="..."`
- `X-Backup-Tables: 24`
- `X-Backup-Rows: 45678`

#### 2. Lấy Metadata
```
GET /api?action=getBackupMetadata
```
**Response:**
```json
{
  "success": true,
  "metadata": {
    "tables": 24,
    "totalRows": 45678,
    "estimatedSize": "15 KB",
    "tableInfo": [
      { "name": "orders", "rows": 1234 },
      { "name": "products", "rows": 567 }
    ]
  }
}
```

### POST Endpoints

#### 3. Restore Backup
```
POST /api?action=restoreBackup
Content-Type: multipart/form-data

Body: { backup_file: File }
```
**Response:**
```json
{
  "success": true,
  "message": "Khôi phục database thành công",
  "details": {
    "totalStatements": 5000,
    "successCount": 4998,
    "errorCount": 2,
    "tablesRestored": 24
  }
}
```

#### 4. Validate Backup
```
POST /api?action=validateBackup
Content-Type: multipart/form-data

Body: { backup_file: File }
```
**Response:**
```json
{
  "success": true,
  "valid": true,
  "info": {
    "fileName": "backup.sql",
    "fileSize": 1500000,
    "totalStatements": 5000,
    "tables": 24,
    "inserts": 4976
  }
}
```

---

## 📊 Format File Backup

### Cấu trúc SQL File

```sql
-- Database Backup
-- Generated: 2026-07-07T09:35:00.000Z
-- Database: CTV System (Turso)
-- Total Tables: 24

-- Disable foreign keys during restore
PRAGMA foreign_keys = OFF;

-- ============================================
-- Table: orders
-- ============================================

-- Schema
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (...);

-- Data (1234 rows)
INSERT INTO orders (id, customer_name, ...) VALUES (1, 'Nguyễn Văn A', ...);
INSERT INTO orders (id, customer_name, ...) VALUES (2, 'Trần Thị B', ...);
...

-- ============================================
-- Table: products
-- ============================================
...

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;

-- Backup completed successfully
-- Total rows: 45678
```

---

## 🐛 Xử Lý Lỗi

### Lỗi Thường Gặp

#### 1. "File rỗng hoặc không hợp lệ"
- **Nguyên nhân:** File không phải SQL
- **Giải pháp:** Kiểm tra lại file backup

#### 2. "Quá nhiều lỗi khi restore"
- **Nguyên nhân:** File backup không tương thích
- **Giải pháp:** Sử dụng backup từ cùng version

#### 3. "Không thể tạo backup"
- **Nguyên nhân:** Database connection lỗi
- **Giải pháp:** Kiểm tra Turso connection

---

## 🧪 Testing

### Test Checklist

- [x] Tạo backup thành công
- [x] Download file SQL về máy
- [x] File SQL đúng format
- [x] Validate file backup
- [x] Restore database thành công
- [x] Verify số lượng records
- [x] Test với file lớn (>10MB)
- [x] Test drag & drop
- [x] Test error handling

### Test Script

```javascript
// Test trong browser console
// 1. Test tạo backup
await fetch('/api?action=getBackupMetadata').then(r => r.json())

// 2. Test validate
const formData = new FormData();
formData.append('backup_file', fileInput.files[0]);
await fetch('/api?action=validateBackup', {
  method: 'POST',
  body: formData
}).then(r => r.json())
```

---

## 📈 Performance

### Cloudflare Workers Limits

- **CPU Time:** 10ms (free), 50ms (paid)
- **Memory:** 128MB
- **Request Size:** 100MB

### Optimization Tips

1. **Backup lớn:** Chia nhỏ hoặc nén với gzip
2. **Timeout:** Tăng CPU time limit nếu cần
3. **Streaming:** Xử lý từng chunk thay vì toàn bộ

---

## 🎓 Best Practices

### 1. Backup Thường Xuyên
- Backup trước khi deploy
- Backup trước khi update lớn
- Backup hàng tuần/tháng

### 2. Lưu Trữ An Toàn
- Lưu nhiều bản backup
- Upload lên cloud (Google Drive, Dropbox)
- Encrypt backup quan trọng

### 3. Test Restore
- Test restore định kỳ
- Test trên database test
- Verify data integrity

### 4. Documentation
- Ghi chú lý do backup
- Tag version/date rõ ràng
- Lưu changelog quan trọng

---

## 🚧 Tính Năng Tương Lai (Optional)

- [ ] Auto backup hàng ngày (cronjob)
- [ ] Backup lịch sử (danh sách 30 bản gần nhất)
- [ ] Upload backup lên Google Drive tự động
- [ ] Incremental backup (chỉ backup thay đổi)
- [ ] Encrypt/decrypt backup với password
- [ ] Restore partial (chỉ restore 1 vài bảng)
- [ ] Email notification khi backup xong
- [ ] Backup size optimization (compression)

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console log (F12)
2. Xem network requests
3. Check Turso database connection
4. Review file backup format

---

## ✅ Checklist Triển Khai

- [x] Backend services hoàn chỉnh
- [x] Routes đã thêm vào handlers
- [x] UI đẹp, responsive, hiện đại
- [x] JavaScript functions đầy đủ
- [x] Validation & error handling
- [x] Security measures
- [x] User confirmations
- [x] Toast notifications
- [x] Drag & drop support
- [x] Documentation đầy đủ

---

**🎉 Chúc mừng! Hệ thống Backup & Restore đã sẵn sàng sử dụng!**

*Tạo bởi: AI Assistant*  
*Ngày: 07/07/2026*  
*Version: 1.0.0*
