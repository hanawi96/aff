# Hướng Dẫn Cấu Hình Hệ Thống Tra Cứu Đơn Hàng CTV

## 📋 Tổng Quan

Hệ thống cho phép cộng tác viên tra cứu đơn hàng của mình thông qua mã Referral.

## 🚀 Các Bước Cài Đặt

### 1. Cấu Trúc Google Sheets

Đảm bảo Google Sheets đơn hàng của bạn có cấu trúc như sau:

**Sheet "Orders" (hoặc tên khác):**

| Mã Đơn | Ngày Đặt | Tên Khách Hàng | Số Điện Thoại | Sản Phẩm | Tổng Tiền | Trạng Thái | Mã Referral |
|--------|----------|----------------|---------------|----------|-----------|------------|-------------|
| DH001  | 1/11/2025| Nguyễn Văn A   | 0901234567    | Sản phẩm X | 500000 | Hoàn thành | PARTNER001 |

**Lưu ý:**
- Cột "Mã Referral" là BẮT BUỘC (có thể đặt tên: "Mã Ref", "Referral", "Ma Referral")
- Thứ tự các cột có thể thay đổi, nhưng cần điều chỉnh code trong `google-apps-script.js`

### 2. Cập Nhật Google Apps Script

1. Mở Google Sheets đơn hàng của bạn
2. Vào **Extensions > Apps Script**
3. Copy toàn bộ nội dung file `google-apps-script.js` vào editor
4. **QUAN TRỌNG:** Điều chỉnh mapping cột trong hàm `getOrdersByReferralCode()`:

```javascript
orders.push({
  orderId: row[0],        // Cột A - Mã Đơn
  orderDate: row[1],      // Cột B - Ngày Đặt
  customerName: row[2],   // Cột C - Tên Khách Hàng
  customerPhone: row[3],  // Cột D - Số Điện Thoại
  products: row[4],       // Cột E - Sản Phẩm
  totalAmount: parseFloat(row[5]) || 0,  // Cột F - Tổng Tiền
  status: row[6],         // Cột G - Trạng Thái
  referralCode: rowRefCode // Cột H - Mã Referral
});
```

5. Lưu và Deploy:
   - Click **Deploy > New deployment**
   - Chọn type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
   - Copy **Web app URL**

### 3. Cập Nhật URL trong ctv.js

Mở file `ctv.js` và thay thế URL:

```javascript
const GOOGLE_SCRIPT_URL = 'YOUR_WEB_APP_URL_HERE';
```

### 4. Upload Files lên Server

Upload các file sau lên server của bạn:
- `ctv.html`
- `ctv.js`
- `avatar.jpg` (nếu chưa có)

Đảm bảo file có thể truy cập tại: `https://yourdomain.com/ctv.html`

### 5. Cấu Hình Routing (Tùy chọn)

Nếu bạn muốn URL là `/ctv` thay vì `/ctv.html`:

**Với Apache (.htaccess):**
```apache
RewriteEngine On
RewriteRule ^ctv$ ctv.html [L]
```

**Với Nginx:**
```nginx
location /ctv {
    try_files /ctv.html =404;
}
```

**Với Cloudflare Workers (worker.js):**
```javascript
if (url.pathname === '/ctv') {
    return fetch(new Request(url.origin + '/ctv.html', request));
}
```

## 🎨 Tùy Chỉnh

### Thay Đổi Tỷ Lệ Hoa Hồng

Trong file `ctv.js`, tìm và thay đổi:

```javascript
totalCommission += amount * 0.1; // 10% commission
```

Thay `0.1` thành tỷ lệ mong muốn (VD: `0.15` = 15%)

### Thay Đổi Cấu Trúc Bảng

Chỉnh sửa hàm `createOrderRow()` trong `ctv.js` để thay đổi cách hiển thị dữ liệu.

## 🧪 Test Hệ Thống

1. Truy cập: `https://yourdomain.com/ctv`
2. Nhập mã Referral test (VD: PARTNER001)
3. Kiểm tra xem dữ liệu có hiển thị đúng không

## ❗ Xử Lý Lỗi Thường Gặp

### Lỗi: "Không thể kết nối đến server"
- Kiểm tra URL Google Apps Script đã đúng chưa
- Kiểm tra quyền truy cập Web App (phải là "Anyone")

### Lỗi: "Không tìm thấy đơn hàng"
- Kiểm tra mã Referral có đúng không (phân biệt hoa thường)
- Kiểm tra cột "Mã Referral" trong Google Sheets có dữ liệu không

### Lỗi: "Không tìm thấy cột Referral"
- Đảm bảo sheet có cột chứa từ "ref" trong tên
- Kiểm tra tên sheet trong code (mặc định là "Orders")

## 📞 Hỗ Trợ

Nếu gặp vấn đề, kiểm tra:
1. Console log trong trình duyệt (F12)
2. Execution log trong Google Apps Script
3. Cấu trúc dữ liệu trong Google Sheets

## 🔐 Bảo Mật

**Lưu ý:** Hệ thống hiện tại không có xác thực. Bất kỳ ai biết mã Referral đều có thể xem đơn hàng.

Để tăng cường bảo mật, có thể:
- Thêm xác thực OTP qua SMS
- Yêu cầu đăng nhập bằng số điện thoại
- Thêm CAPTCHA để chống spam

## 📊 Mở Rộng Tính Năng

Có thể thêm:
- Xuất báo cáo Excel
- Biểu đồ thống kê
- Lọc theo ngày tháng
- Thông báo đơn hàng mới qua email/SMS
- Lịch sử thanh toán hoa hồng
