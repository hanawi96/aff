# Hướng dẫn tích hợp Shopee Express API

## ✅ Đã hoàn thành

### 1. **Cấu hình SPX**
- File: `public/assets/js/config/spx-config.js`
- Thông tin:
  - Partner ID: `162695267691149`
  - Secret Key: `c6744cab-e5e7-4f35-b1ac-2980adb0b9c2`
  - Account ID: `750794417`
  - Người gửi: Ánh Lê - 0386190596

### 2. **Frontend**
- ✅ SPX Client: `public/assets/js/shipping/spx-client.js`
- ✅ Modal tạo vận đơn: `public/assets/js/shipping/spx-modal.js`
- ✅ Nút "Tạo vận đơn SPX" trong bảng đơn hàng (màu cam)
- ✅ Nút "Copy format SPX" (màu tím)

### 3. **Backend**
- ✅ API handler trong `worker.js`:
  - `createSPXOrder` - Tạo vận đơn
  - `getSPXTracking` - Tra cứu trạng thái
- ✅ HMAC-SHA256 signature authentication
- ✅ Lưu mã tracking vào database

### 4. **Database**
- ✅ Migration: `migrations/add_shipping_columns.sql`
- Cột mới:
  - `tracking_number` - Mã vận đơn SPX
  - `shipping_status` - Trạng thái vận chuyển
  - `tracking_url` - Link tra cứu

---

## 🚀 Cách sử dụng

### **Tạo vận đơn SPX:**

1. Vào trang **Quản lý đơn hàng** (`/admin/orders.html`)
2. Click icon **📦 màu cam** "Tạo vận đơn SPX" ở cột thao tác
3. Modal sẽ hiện ra với thông tin đơn hàng đã điền sẵn:
   - Thông tin người nhận (tên, SĐT, địa chỉ)
   - Thông tin hàng hóa (mô tả, cân nặng, kích thước, COD)
4. Kiểm tra và chỉnh sửa thông tin nếu cần
5. Click **"Tạo vận đơn"**
6. Hệ thống sẽ:
   - Gọi SPX API tạo vận đơn
   - Lưu mã tracking vào database
   - Hiển thị thông báo thành công + mã vận đơn

### **Copy format SPX (thủ công):**

1. Click icon **📋 màu tím** "Copy format SPX"
2. Thông tin sẽ được copy theo format:
```
Họ và tên
Số điện thoại
Địa chỉ đầy đủ
[Sản phẩm 1 - Số lượng: X - Size: Y - Lưu ý: Z] ----- [Sản phẩm 2...] ----- Lưu ý tổng: ...
```
3. Paste vào form SPX web

---

## 📋 Cần làm tiếp

### **Bước 1: Chạy migration database**
```bash
# Nếu dùng Wrangler D1
wrangler d1 execute DB --file=migrations/add_shipping_columns.sql

# Hoặc chạy SQL trực tiếp trong D1 console
```

### **Bước 2: Test tính năng**
1. Tạo 1 đơn hàng test
2. Click "Tạo vận đơn SPX"
3. Kiểm tra:
   - Modal hiển thị đúng thông tin?
   - API call thành công?
   - Mã tracking được lưu vào DB?

### **Bước 3: Xử lý lỗi (nếu có)**

**Lỗi thường gặp:**

1. **"Invalid signature"**
   - Kiểm tra Partner ID và Secret Key
   - Kiểm tra timestamp

2. **"Invalid address"**
   - Địa chỉ phải đầy đủ: số nhà, đường, phường/xã, quận/huyện, tỉnh/TP
   - SPX yêu cầu địa chỉ chuẩn

3. **"COD amount invalid"**
   - COD phải > 0
   - Kiểm tra giá trị đơn hàng

---

## 🔧 Tùy chỉnh

### **Thay đổi thông tin người gửi:**
Sửa file `public/assets/js/config/spx-config.js`:
```javascript
sender: {
    name: 'Tên mới',
    phone: 'SĐT mới',
    address: 'Địa chỉ mới'
}
```

### **Thay đổi kích thước mặc định:**
```javascript
defaultParcel: {
    weight: 500,  // gram
    length: 20,   // cm
    width: 15,
    height: 10
}
```

---

## 📞 Hỗ trợ

**Shopee Express:**
- Hotline: 1900 1221
- Email: support@spx.vn
- Website: https://spx.vn

**API Documentation:**
- https://open-api.spx.vn/docs

---

## ✨ Tính năng tiếp theo (tùy chọn)

1. **Tạo vận đơn hàng loạt** - Chọn nhiều đơn, tạo tất cả cùng lúc
2. **Đồng bộ trạng thái tự động** - Webhook từ SPX
3. **In nhãn vận đơn** - In nhãn để dán lên hàng
4. **Trang tra cứu khách hàng** - Khách tự tra cứu đơn hàng
5. **Thống kê vận chuyển** - Dashboard vận chuyển

---

**Chúc bạn sử dụng thành công! 🎉**
