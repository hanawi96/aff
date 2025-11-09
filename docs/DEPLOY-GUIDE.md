# Hướng Dẫn Deploy - Tính Năng Đơn Hàng Mới Nhất

## 🎯 Tổng Quan

Đã thêm tính năng hiển thị 10 đơn hàng **CÓ MÃ REFERRAL** mới nhất trên trang tra cứu CTV.

**Lưu ý:** Chỉ hiển thị đơn hàng có mã CTV (đơn qua cộng tác viên), không hiển thị đơn hàng trực tiếp.

## 📋 Các Bước Deploy

### Bước 1: Cập Nhật Google Apps Script

1. **Mở Google Sheet đơn hàng** (ID: `1CmfyZg1MCPCv0_RnlBOOf0HIev4RPg4DK43veMGyPJM`)

2. **Vào Apps Script:**
   - Extensions → Apps Script

3. **Copy code mới:**
   - Mở file `google-apps-script/order-handler.js`
   - Copy toàn bộ nội dung
   - Paste vào Apps Script Editor (thay thế code cũ)

4. **Test trước khi deploy:**
   ```
   - Chọn function: runAllTests
   - Nhấn Run (▶️)
   - Xem kết quả trong Execution log
   ```
   
   Kết quả mong đợi:
   ```
   ✅ CTV Sheet: OK
   ✅ Order Sheet: OK
   ✅ Recent Orders: OK
   ✅ Search Orders: OK
   ```

5. **Deploy:**
   - Nhấn **Deploy** → **Manage deployments**
   - Chọn deployment hiện tại
   - Nhấn **Edit** (icon bút chì)
   - Chọn **New version**
   - Nhấn **Deploy**
   - Copy URL mới (nếu có)

### Bước 2: Kiểm Tra Config

Đảm bảo file `public/assets/js/config.js` có đúng URL:

```javascript
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    // ... các config khác
};
```

### Bước 3: Test Trên Website

1. **Mở trang tra cứu:** `https://your-domain.com/ctv/`

2. **Kiểm tra:**
   - ✅ Trang tự động hiển thị 10 đơn hàng mới nhất
   - ✅ Click vào mã CTV → tự động search đơn của CTV đó
   - ✅ Khi search CTV → hiển thị kết quả + nút "Sao chép link"
   - ✅ Nút sao chép link hoạt động

3. **Test API trực tiếp:**
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getRecentOrders&limit=10
   ```

## 🔧 Cấu Trúc Sheet Đơn Hàng

| Cột | Nội Dung | Ví Dụ |
|-----|----------|-------|
| A | Mã Đơn Hàng | ORD001 |
| B | Ngày Đặt | 09/11/2024 |
| C | Tên Khách Hàng | Nguyễn Văn A |
| D | Số Điện Thoại | 0901234567 |
| E | Địa Chỉ | Hà Nội |
| F | Chi Tiết Sản Phẩm | Sữa XYZ |
| G | TỔNG KHÁCH PHẢI TRẢ | 139.000 đ |
| H | Hướng Thanh Toán | COD |
| I | Ghi Chú | Hoàn thành |
| J | Mã Referral | PARTNER001 |

## ✨ Tính Năng Mới

### 1. Hiển Thị Đơn Hàng Referral Mới Nhất
- Tự động load 10 đơn **CÓ MÃ REFERRAL** gần nhất khi vào trang
- **Chỉ hiển thị đơn qua CTV**, bỏ qua đơn hàng trực tiếp (không có mã referral)
- Hiển thị: Mã CTV, Mã đơn, Ngày, Sản phẩm, Tổng tiền, Trạng thái
- Mã CTV có thể click để xem chi tiết

### 2. URL Động
- Khi search CTV: URL tự động thêm `?code=MA_CTV`
- Có thể chia sẻ link trực tiếp cho CTV
- CTV click link → tự động load đơn hàng

### 3. Nút Sao Chép Link
- Xuất hiện sau khi search thành công
- Click để copy link chia sẻ
- Feedback trực quan (✓ Đã sao chép!)

## 🐛 Troubleshooting

### Không hiển thị đơn hàng mới nhất

**Nguyên nhân:**
- API chưa được deploy
- Sheet không có dữ liệu
- Sheet không có đơn hàng CÓ MÃ REFERRAL
- CONFIG sai

**Giải pháp:**
1. Kiểm tra cột J (Mã Referral) có dữ liệu không
2. Mở Console (F12) → xem lỗi
3. Test API trực tiếp bằng URL
4. Chạy `runAllTests()` trong Apps Script

**Lưu ý:** Nếu tất cả đơn hàng đều không có mã Referral, trang sẽ không hiển thị gì (đây là hành vi đúng).

### Số tiền hiển thị sai

**Nguyên nhân:**
- Format trong sheet không đúng

**Giải pháp:**
- Đảm bảo cột G có format: `139.000 đ` hoặc `139000`
- Function `parseAmount()` sẽ tự động xử lý

### Mã CTV không tìm thấy

**Nguyên nhân:**
- Cột J không có mã Referral
- Mã CTV không khớp

**Giải pháp:**
- Kiểm tra cột J có dữ liệu không
- Mã CTV không phân biệt hoa thường

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Xem log trong Apps Script: View → Execution log
2. Xem Console trong browser: F12 → Console
3. Chạy test functions để debug

## 🎉 Hoàn Tất!

Sau khi deploy xong, trang tra cứu sẽ:
- Hiển thị 10 đơn hàng mới nhất ngay khi load
- Cho phép search theo mã CTV
- Có thể chia sẻ link cho từng CTV
- Giao diện đẹp và dễ sử dụng
