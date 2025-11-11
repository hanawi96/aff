# Hướng Dẫn Cập Nhật - Hiển Thị Thông Tin Cộng Tác Viên

## 📋 Tổng Quan

Đã thêm tính năng hiển thị thông tin cộng tác viên (họ tên, số điện thoại, địa chỉ) phía trên phần filter tabs khi tra cứu đơn hàng.

## ✨ Tính Năng Mới

### 1. Box Thông Tin CTV
- Hiển thị phía trên phần filter tabs
- Thiết kế đẹp, chuyên nghiệp với gradient màu tím-hồng-xanh
- Bố cục responsive, hiển thị tốt trên mobile và desktop

### 2. Thông Tin Hiển Thị
- **Họ và Tên**: Tên đầy đủ của cộng tác viên
- **Số Điện Thoại**: Che 4 số cuối để bảo mật (VD: 0386****** thay vì 0386190596)
- **Địa Chỉ**: Tỉnh/Thành phố của CTV (giới hạn 2 dòng)

### 3. Bảo Mật
- Số điện thoại được che 4 số cuối tự động
- Chỉ hiển thị thông tin cơ bản, không lộ thông tin nhạy cảm

## 🔧 Các File Đã Cập Nhật

### 1. Frontend (HTML)
**File**: `public/ctv/index.html`

Đã thêm:
- Box thông tin CTV với 3 cột: Họ tên, SĐT, Địa chỉ
- Icons đẹp cho từng loại thông tin
- CSS cho `line-clamp-2` để giới hạn địa chỉ 2 dòng

### 2. Frontend (JavaScript)
**File**: `public/assets/js/ctv.js`

Đã thêm:
- Hàm `displayCollaboratorInfo(ctvInfo)`: Hiển thị thông tin CTV
- Hàm `maskPhone(phone)`: Che 4 số cuối của số điện thoại
- Cập nhật `searchOrders()` và `searchOrdersByPhone()` để gọi `displayCollaboratorInfo()`

### 3. Backend (Google Apps Script)
**File**: `google-apps-script/order-handler.js`

Đã thêm:
- Hàm `getCTVInfoByPhone(normalizedPhone)`: Lấy thông tin CTV theo SĐT
- Hàm `getCTVInfoByReferralCode(referralCode)`: Lấy thông tin CTV theo mã CTV
- Cập nhật API `getOrders` và `getOrdersByPhone` để trả về `ctvInfo`

## 📝 Cách Deploy

### Bước 1: Cập Nhật Google Apps Script

1. Mở Google Apps Script của bạn
2. Thay thế toàn bộ nội dung file `order-handler.js` bằng file mới
3. Lưu lại (Ctrl+S hoặc Cmd+S)
4. Deploy lại Web App:
   - Click **Deploy** > **Manage deployments**
   - Click biểu tượng ✏️ (Edit) ở deployment hiện tại
   - Chọn **New version** trong dropdown "Version"
   - Click **Deploy**
   - Copy URL mới (nếu có thay đổi)

### Bước 2: Kiểm Tra Cấu Trúc Sheet

Đảm bảo sheet **"DS REF"** có các cột sau:
- **Họ Tên**: Tên đầy đủ của CTV
- **Số Điện Thoại**: SĐT của CTV
- **Tỉnh/Thành**: Địa chỉ của CTV
- **Mã Ref**: Mã CTV (VD: CTV123456)

### Bước 3: Test Chức Năng

Chạy các hàm test trong Google Apps Script:

```javascript
// Test lấy thông tin CTV theo mã
function testGetCTVInfo() {
  const ctvInfo = getCTVInfoByReferralCode('CTV123456');
  Logger.log(JSON.stringify(ctvInfo, null, 2));
}

// Test lấy thông tin CTV theo SĐT
function testGetCTVInfoByPhone() {
  const ctvInfo = getCTVInfoByPhone('386190596');
  Logger.log(JSON.stringify(ctvInfo, null, 2));
}
```

### Bước 4: Deploy Frontend

1. Upload các file đã cập nhật lên server:
   - `public/ctv/index.html`
   - `public/assets/js/ctv.js`

2. Clear cache trình duyệt (Ctrl+Shift+R hoặc Cmd+Shift+R)

3. Test trên website:
   - Nhập mã CTV hoặc SĐT
   - Kiểm tra box thông tin CTV hiển thị đúng
   - Kiểm tra số điện thoại đã được che 4 số cuối

## 🎨 Giao Diện

### Desktop
```
┌─────────────────────────────────────────────────────────┐
│ 👤 Thông Tin Cộng Tác Viên                              │
├─────────────────────────────────────────────────────────┤
│  👤 Họ và Tên    │  📱 Số Điện Thoại  │  📍 Địa Chỉ    │
│  Nguyễn Văn A    │  0386******        │  Hà Nội        │
└─────────────────────────────────────────────────────────┘
```

### Mobile
```
┌───────────────────────┐
│ 👤 Thông Tin CTV      │
├───────────────────────┤
│ 👤 Họ và Tên          │
│ Nguyễn Văn A          │
│                       │
│ 📱 Số Điện Thoại      │
│ 0386******            │
│                       │
│ 📍 Địa Chỉ            │
│ Hà Nội                │
└───────────────────────┘
```

## 🔍 Troubleshooting

### Lỗi: Không hiển thị thông tin CTV

**Nguyên nhân**: Backend không trả về `ctvInfo`

**Giải pháp**:
1. Kiểm tra Google Apps Script đã deploy phiên bản mới chưa
2. Kiểm tra sheet "DS REF" có đúng cấu trúc không
3. Chạy hàm test trong Apps Script để debug

### Lỗi: Số điện thoại không được che

**Nguyên nhân**: Hàm `maskPhone()` không hoạt động

**Giải pháp**:
1. Kiểm tra console browser (F12) xem có lỗi JavaScript không
2. Clear cache và reload trang
3. Kiểm tra file `ctv.js` đã được upload đúng chưa

### Lỗi: Địa chỉ quá dài

**Nguyên nhân**: CSS `line-clamp-2` không hoạt động

**Giải pháp**:
1. Kiểm tra file HTML đã có CSS `line-clamp-2` chưa
2. Clear cache và reload trang
3. Thử trên trình duyệt khác

## 📞 Hỗ Trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra console browser (F12) để xem lỗi
2. Kiểm tra Logs trong Google Apps Script
3. Đảm bảo tất cả file đã được deploy đúng phiên bản

## ✅ Checklist Deploy

- [ ] Cập nhật Google Apps Script
- [ ] Deploy phiên bản mới
- [ ] Kiểm tra cấu trúc sheet "DS REF"
- [ ] Chạy test functions
- [ ] Upload file HTML và JS
- [ ] Clear cache trình duyệt
- [ ] Test trên website
- [ ] Test trên mobile
- [ ] Kiểm tra số điện thoại đã được che
- [ ] Kiểm tra địa chỉ hiển thị đúng

---

**Ngày cập nhật**: 11/11/2025
**Phiên bản**: 2.0
