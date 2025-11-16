# 🚀 Hướng dẫn Deploy UTC Migration

## ✅ Đã kiểm tra xong

Tất cả code đã được cập nhật và test thành công:
- ✅ Backend lưu UTC timestamps
- ✅ Frontend hiển thị giờ Việt Nam
- ✅ Tất cả test đều pass
- ✅ 15 files đã được cập nhật

## 📋 Các bước Deploy

### Bước 1: Backup Database (QUAN TRỌNG!)
```bash
wrangler d1 backup create vdt
```

### Bước 2: Deploy Frontend
```bash
wrangler pages deploy public
```

### Bước 3: Deploy Worker
```bash
wrangler deploy
```

### Bước 4: Chạy Migration
```bash
wrangler d1 execute vdt --remote --file=database/migrations/018_standardize_utc_timestamps.sql
```

### Bước 5: Kiểm tra
```bash
# Xem timestamps trong database
wrangler d1 execute vdt --remote --command="SELECT created_at FROM orders LIMIT 5"

# Kết quả mong đợi: 2024-01-15T10:30:45.123Z
```

## 🔍 Kiểm tra sau Deploy

1. **Mở trang Orders**
   - Cột "Ngày đặt" phải hiển thị giờ Việt Nam (không phải UTC)
   - Ví dụ: "15/01/2024, 17:30:45" (không phải "15/01/2024, 10:30:45")

2. **Test Filter "Hôm nay"**
   - Phải hiển thị đúng đơn hàng của hôm nay theo giờ VN
   - Không bị lệch múi giờ

3. **Tạo đơn hàng mới**
   - Timestamp phải được lưu ở format UTC
   - Hiển thị phải đúng giờ VN

4. **Kiểm tra các trang khác**
   - CTV Detail
   - Profit Report
   - Customers

## ⚠️ Lưu ý

- Migration có thể mất 2-5 phút
- Không làm mất dữ liệu
- Tất cả timestamps sẽ được convert tự động
- Frontend tự động hiển thị đúng múi giờ

## 🆘 Nếu có lỗi

1. **Timestamps hiển thị sai giờ**
   - Clear browser cache (Ctrl + Shift + Delete)
   - Refresh trang (Ctrl + F5)

2. **Filter không hoạt động**
   - Kiểm tra console log (F12)
   - Verify timezone-utils.js đã load

3. **Migration failed**
   - Restore từ backup:
     ```bash
     wrangler d1 restore vdt [backup-id]
     ```

## 📞 Hỗ trợ

Nếu gặp vấn đề, check:
1. Console log trong browser (F12)
2. Wrangler logs: `wrangler tail`
3. Database format: Phải có chữ "Z" ở cuối timestamp

## 🎯 Kết quả

**Trước:**
- Database: `2024-01-15 10:30:45` (không rõ timezone)
- Hiển thị: Không nhất quán

**Sau:**
- Database: `2024-01-15T03:30:45.000Z` (UTC rõ ràng)
- Hiển thị: `15/01/2024, 10:30:45` (VN timezone)

---

**Thời gian ước tính:** 10-15 phút
**Độ rủi ro:** Thấp (có backup)
**Trạng thái:** ✅ Sẵn sàng deploy
