# 🚀 Hướng Dẫn Nhanh: Test Email Chào Mừng CTV

## Bước 1: Mở Google Apps Script

1. Vào Google Sheets của bạn
2. Click **Extensions** > **Apps Script**
3. Bạn sẽ thấy file `order-handler.gs` (hoặc `Code.gs`)

## Bước 2: Thêm File Test

1. Click dấu **+** bên cạnh "Files"
2. Chọn **Script**
3. Đặt tên: `test-email`
4. Copy toàn bộ nội dung file `test-email.js` vào đây
5. Click **Save** (Ctrl+S)

## Bước 3: Thay Đổi Email Test

Tìm dòng này trong hàm `testWelcomeEmail()`:

```javascript
email: 'test@example.com', // ⭐ THAY ĐỔI EMAIL NÀY THÀNH EMAIL CỦA BẠN
```

Thay thành email thật của bạn:

```javascript
email: 'your-real-email@gmail.com', // Email của bạn
```

## Bước 4: Chạy Test

1. Chọn hàm **testWelcomeEmail** từ dropdown (ở giữa toolbar)
2. Click nút **Run** (▶️)
3. Lần đầu chạy sẽ yêu cầu ủy quyền:
   - Click **Review permissions**
   - Chọn tài khoản Google của bạn
   - Click **Advanced** > **Go to [Project name] (unsafe)**
   - Click **Allow**

## Bước 5: Kiểm Tra Email

1. Mở email của bạn
2. Kiểm tra **Inbox** và **Spam folder**
3. Bạn sẽ nhận được email với tiêu đề: **"🎉 Chào mừng bạn trở thành Cộng Tác Viên!"**

## Bước 6: Kiểm Tra Log

Xem log để đảm bảo email đã được gửi:

1. Click **View** > **Logs** (hoặc Ctrl+Enter)
2. Bạn sẽ thấy: `✅ Đã gửi email chào mừng đến: your-email@gmail.com`

## 🎯 Các Test Khác

### Test Email Quota (Kiểm tra số email còn lại)

```javascript
function checkEmailQuota() {
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log('📧 Số email còn lại: ' + quota);
}
```

Chạy hàm này để xem còn bao nhiêu email có thể gửi hôm nay.

### Test Full Flow (Đăng ký + Email)

```javascript
testFullRegistrationFlow()
```

Test toàn bộ quy trình đăng ký CTV kèm gửi email.

### Test Không Có Email

```javascript
testRegistrationWithoutEmail()
```

Test trường hợp CTV không nhập email (hệ thống sẽ bỏ qua gửi email).

## ❓ Xử Lý Lỗi

### Lỗi: "Exception: Service invoked too many times"

**Nguyên nhân:** Đã gửi quá nhiều email trong ngày (giới hạn 100 email/ngày)

**Giải pháp:** Chờ 24h hoặc nâng cấp lên Google Workspace

### Lỗi: "Exception: Authorization is required"

**Nguyên nhân:** Chưa ủy quyền cho script

**Giải pháp:** Làm theo Bước 4 để ủy quyền

### Không Nhận Được Email

**Kiểm tra:**
1. ✅ Email có đúng không?
2. ✅ Kiểm tra spam folder
3. ✅ Xem log có thông báo "✅ Đã gửi email" không?
4. ✅ Chạy `checkEmailQuota()` để xem còn quota không

## 📊 Giới Hạn Gửi Email

- **Gmail thường:** 100 email/ngày
- **Google Workspace:** 1,500 email/ngày

## 🎨 Tùy Chỉnh Email

Để thay đổi nội dung email, chỉnh sửa hàm `sendWelcomeEmailToCTV()` trong file `order-handler.gs`:

```javascript
// Thay đổi tiêu đề
const subject = '🎉 Chào mừng bạn trở thành Cộng Tác Viên!';

// Thay đổi nội dung HTML
const htmlBody = `...`;
```

## ✅ Checklist

- [ ] Đã thêm file `test-email.gs` vào Apps Script
- [ ] Đã thay đổi email test thành email thật
- [ ] Đã chạy `testWelcomeEmail()` thành công
- [ ] Đã nhận được email test
- [ ] Đã kiểm tra email quota
- [ ] Email hiển thị đẹp trên mobile và desktop

## 🚀 Sẵn Sàng Production

Khi đã test thành công, hệ thống sẽ tự động gửi email khi:
1. CTV đăng ký thành công
2. CTV có nhập email
3. Còn email quota

**Không cần làm gì thêm!** Email sẽ được gửi tự động.

---

**Cần hỗ trợ?** Xem file `EMAIL-SETUP.md` để biết thêm chi tiết.
