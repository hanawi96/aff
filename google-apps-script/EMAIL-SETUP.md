# Hướng Dẫn Cấu Hình Email Chào Mừng Cộng Tác Viên

## Tính Năng

Khi cộng tác viên đăng ký thành công, hệ thống sẽ tự động gửi email chào mừng bao gồm:

✅ Thông báo chúc mừng và chào mừng  
✅ Mã referral của cộng tác viên  
✅ Link giới thiệu sản phẩm  
✅ Button để kiểm tra danh sách đơn hàng  
✅ Hướng dẫn cách thức hoạt động  
✅ Ví dụ tính hoa hồng  
✅ Thông tin liên hệ hỗ trợ  

## Yêu Cầu

- Cộng tác viên phải nhập email khi đăng ký
- Google Apps Script đã được cấu hình và deploy

## Cấu Hình

### 1. Kiểm Tra Quyền Gửi Email

Google Apps Script sử dụng `MailApp` để gửi email. Bạn cần đảm bảo:

1. Script đã được ủy quyền (authorize) khi chạy lần đầu
2. Tài khoản Google có thể gửi email (không bị giới hạn)

### 2. Giới Hạn Gửi Email

Google Apps Script có giới hạn gửi email:
- **Tài khoản Gmail thường**: 100 email/ngày
- **Google Workspace**: 1,500 email/ngày

### 3. Tùy Chỉnh Email Admin (Optional)

Nếu bạn muốn nhận thông báo khi có CTV mới đăng ký, hãy thay đổi email trong hàm `sendNotificationEmail`:

```javascript
const emailAddress = 'your-email@gmail.com'; // Thay bằng email của bạn
```

Thành:

```javascript
const emailAddress = 'admin@shopvd.store'; // Email thực của bạn
```

## Kiểm Tra

### Test Gửi Email

Chạy hàm test trong Google Apps Script Editor:

```javascript
function testWelcomeEmail() {
  const testData = {
    fullName: 'Nguyễn Thị Test',
    phone: '0901234567',
    email: 'test@example.com', // Thay bằng email test của bạn
    city: 'Hà Nội',
    age: '26-30',
    experience: 'Mới bắt đầu',
    motivation: 'Muốn có thêm thu nhập',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  const refCode = 'CTV123456';
  const refUrl = 'https://shopvd.store/?ref=CTV123456';
  const orderCheckUrl = 'https://shopvd.store/ctv/?code=CTV123456';

  sendWelcomeEmailToCTV(testData, refCode, refUrl, orderCheckUrl);
  
  Logger.log('✅ Test email sent!');
}
```

## Xử Lý Lỗi

### Email Không Được Gửi

**Nguyên nhân có thể:**

1. **Không có email**: CTV không nhập email khi đăng ký
   - ✅ Hệ thống sẽ bỏ qua và không báo lỗi

2. **Chưa ủy quyền**: Script chưa được authorize
   - ✅ Chạy hàm test lần đầu để ủy quyền

3. **Vượt giới hạn**: Đã gửi quá 100 email/ngày
   - ✅ Chờ 24h hoặc nâng cấp lên Google Workspace

4. **Email không hợp lệ**: Email sai định dạng
   - ✅ Hệ thống sẽ bỏ qua và ghi log

### Kiểm Tra Log

Xem log trong Google Apps Script:
1. Mở Apps Script Editor
2. Click **Executions** (biểu tượng đồng hồ)
3. Xem chi tiết execution để kiểm tra lỗi

## Tùy Chỉnh Email Template

### Thay Đổi Màu Sắc

Tìm và thay đổi các giá trị màu trong `htmlBody`:

```javascript
// Header gradient
background: linear-gradient(135deg, #e91e63 0%, #9c27b0 100%);

// Referral code box
background: linear-gradient(135deg, #f3e5f5 0%, #fce4ec 100%);
border: 2px solid #e91e63;
```

### Thay Đổi Nội Dung

Chỉnh sửa text trong các thẻ `<p>`, `<h1>`, `<h2>`, `<h3>` trong hàm `sendWelcomeEmailToCTV`.

### Thêm Logo

Thêm logo vào header:

```html
<img src="https://your-domain.com/logo.png" alt="Logo" style="width: 120px; margin-bottom: 20px;">
```

## Lưu Ý Quan Trọng

⚠️ **Email được gửi từ tài khoản Google của bạn**
- Email gửi đi sẽ có địa chỉ người gửi là tài khoản Google đang chạy script
- Nên sử dụng tài khoản chuyên dụng cho việc này

⚠️ **Không spam**
- Chỉ gửi email khi CTV đăng ký thành công
- Không gửi email marketing hoặc quảng cáo

⚠️ **Bảo mật**
- Không lưu mật khẩu email trong code
- Sử dụng Google Apps Script để gửi email an toàn

## Hỗ Trợ

Nếu gặp vấn đề, kiểm tra:
1. Log trong Google Apps Script
2. Spam folder của email nhận
3. Giới hạn gửi email của tài khoản

---

**Cập nhật**: 12/11/2024  
**Phiên bản**: 1.0
