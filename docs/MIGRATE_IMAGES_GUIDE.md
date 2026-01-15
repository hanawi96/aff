# Hướng dẫn migrate ảnh lên R2

## 📋 Tổng quan
- **Tổng số ảnh**: 149 files
- **Tổng dung lượng**: 14.40 MB
- **Thời gian ước tính**: 5-10 phút

## 🚀 Các bước thực hiện

### Bước 1: Upload ảnh lên R2 (Windows)

**Cách 1: Upload từng file (Chậm nhưng chắc chắn)**
```powershell
# Mở PowerShell và chạy từng dòng trong file:
Get-Content migrations\r2-upload-commands.sh | ForEach-Object { Invoke-Expression $_ }
```

**Cách 2: Upload hàng loạt (Nhanh hơn)**
```powershell
# Chạy script PowerShell
.\migrations\r2-upload-commands.sh
```

**Cách 3: Upload thủ công (Nếu gặp lỗi)**
Mở file `migrations/r2-upload-commands.sh` và copy-paste từng dòng vào terminal.

### Bước 2: Verify upload thành công

Kiểm tra một vài ảnh đã upload:
```powershell
wrangler r2 object get vdt-image/assets/images/banner.webp
wrangler r2 object get vdt-image/assets/images/product_img/tat-ca-mau.webp
```

Hoặc truy cập trực tiếp URL:
```
https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image/assets/images/banner.webp
```

### Bước 3: Update database

**Chạy script update URLs trong database:**
```bash
node scripts/update-image-urls-in-db.js
```

Script sẽ:
- Đọc mapping từ `migrations/image-url-mapping.json`
- Tìm tất cả products có URL local
- Update sang URL R2
- Hiển thị báo cáo

### Bước 4: Verify trên website

1. Mở trang quản lý sản phẩm
2. Kiểm tra ảnh hiển thị đúng
3. Thử tạo/sửa sản phẩm với ảnh mới

### Bước 5: Cleanup (Tùy chọn)

**Sau khi verify mọi thứ OK:**
```bash
# Backup thư mục images
xcopy public\assets\images backups\images\ /E /I

# Xóa ảnh local (cẩn thận!)
# rmdir /s /q public\assets\images\product_img
```

## 📊 Cấu trúc URL

**Trước (Local):**
```
../assets/images/product_img/bi-bac/bi-bac-ta-3ly.webp
```

**Sau (R2):**
```
https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image/assets/images/product_img/bi-bac/bi-bac-ta-3ly.webp
```

## ⚠️ Lưu ý

1. **Không xóa ảnh local** cho đến khi verify xong
2. **Backup database** trước khi chạy update script
3. **Test trên staging** trước nếu có
4. Upload có thể mất vài phút, đừng ngắt kết nối

## 🔧 Troubleshooting

### Lỗi: "command not found: wrangler"
```bash
npm install -g wrangler
```

### Lỗi: "Access denied"
```bash
wrangler login
```

### Lỗi: "File not found"
Kiểm tra đường dẫn trong file commands có đúng không.

### Ảnh không hiển thị sau khi update
1. Kiểm tra URL trong database
2. Kiểm tra ảnh đã upload lên R2chưa
3. Kiểm tra CORS settings của R2 bucket

## 📁 Files liên quan

- `migrations/r2-upload-commands.sh` - Commands upload
- `migrations/image-url-mapping.json` - Mapping URLs
- `scripts/migrate-images-to-r2.js` - Script generate commands
- `scripts/update-image-urls-in-db.js` - Script update database
