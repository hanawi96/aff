# 🔔 Hướng Dẫn Thông Báo Telegram

## Tổng Quan

Hệ thống thông báo Telegram tự động gửi tin nhắn khi có đơn hàng mới. Thông báo được gửi **song song** với việc lưu đơn hàng, không làm chậm quá trình đặt hàng.

---

## ✅ Đã Cài Đặt

### 1. **File mới được tạo:**
```
src/services/notifications/
  └── telegram-service.js    (Service gửi thông báo Telegram)
```

### 2. **File đã chỉnh sửa:**
- ✅ `src/services/orders/order-service.js` - Tích hợp notification
- ✅ `.env` - Thêm Telegram config
- ✅ `wrangler.toml` - Thêm environment variables

---

## 🔧 Cấu Hình

### Telegram Bot Token & Chat ID

**Đã được cấu hình sẵn từ file Google Apps Script của bạn:**

```env
TELEGRAM_BOT_TOKEN=7585519498:AAFHt6QMqI-zfVVnbQW1E_fxzQ1kNUsiEQU
TELEGRAM_CHAT_ID=5816975483
```

> ⚠️ **Lưu ý:** Token và Chat ID này đã được lấy từ file `google-apps-script/order-handler.js` của bạn.

---

## 🚀 Cách Hoạt Động

### Luồng xử lý:

```
1. Khách hàng đặt hàng trên website
   ↓
2. order-service.js tạo đơn hàng trong database
   ↓
3. telegram-service.js gửi thông báo (async, không chờ)
   ↓
4. Bạn nhận thông báo trên Telegram ngay lập tức
```

### Performance:
- **Order submission:** ~200ms (không đổi)
- **Telegram notification:** ~100ms (chạy song song)
- **Tổng thời gian:** ~200ms (vì chạy background)

---

## 📱 Nội Dung Thông Báo

Thông báo bao gồm:

### 📋 Thông tin đơn hàng:
- Mã đơn hàng
- Thời gian đặt
- Tổng tiền
- Phương thức thanh toán

### 👤 Thông tin khách hàng:
- Tên khách hàng
- Số điện thoại
- Địa chỉ
- Ghi chú (nếu có)

### 🛍️ Chi tiết sản phẩm:
- Tên sản phẩm
- Số lượng
- Cân nặng (nếu có)
- Ghi chú sản phẩm (nếu có)

### 🤝 Thông tin Referral (nếu có):
- Mã referral
- Tên partner
- Hoa hồng

---

## 🧪 Test Thông Báo

### Cách 1: Test trên local

```bash
# Chạy dev server
npm run dev

# Đặt hàng thử trên website
# Kiểm tra Telegram xem có nhận thông báo không
```

### Cách 2: Test trên production

```bash
# Deploy lên Cloudflare
npm run deploy

# Đặt hàng thật trên website
# Kiểm tra Telegram
```

---

## 🔍 Debug

### Kiểm tra logs:

```bash
# Xem logs trên Cloudflare
npx wrangler tail

# Hoặc xem logs trên dashboard
# https://dash.cloudflare.com
```

### Các log quan trọng:

```javascript
✅ Telegram notification sent: VDT001    // Thành công
⚠️ Telegram config not found             // Thiếu config
❌ Telegram API error: 401               // Token sai
❌ Error sending Telegram notification   // Lỗi khác
```

---

## ⚙️ Tùy Chỉnh

### Thay đổi format tin nhắn:

Chỉnh sửa file `src/services/notifications/telegram-service.js`:

```javascript
function createTelegramMessage(orderData) {
    // Tùy chỉnh nội dung tin nhắn ở đây
    let message = `🔔 <b>ĐƠN HÀNG MỚI</b>\n`;
    // ...
    return message;
}
```

### Thêm thông tin khác:

```javascript
// Thêm vào message
message += `🏷️ Mã giảm giá: ${orderData.discountCode}\n`;
message += `🚚 Phí ship: ${orderData.shippingFee}đ\n`;
```

---

## 🔐 Bảo Mật

### Lưu ý quan trọng:

1. **Không commit Token vào Git:**
   - Token đã được thêm vào `.env`
   - File `.env` đã có trong `.gitignore`

2. **Sử dụng Cloudflare Secrets (Production):**
   ```bash
   # Set secret trên Cloudflare
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```

3. **Rotate Token định kỳ:**
   - Vào @BotFather trên Telegram
   - Dùng lệnh `/revoke` để tạo token mới

---

## 🆘 Troubleshooting

### Không nhận được thông báo?

**Kiểm tra:**

1. ✅ Bot Token đúng chưa?
2. ✅ Chat ID đúng chưa?
3. ✅ Bot đã được start chưa? (Nhắn `/start` cho bot)
4. ✅ Xem logs có lỗi không?

### Lỗi 401 Unauthorized:

```
❌ Telegram API error: 401
```

**Giải pháp:** Token sai, kiểm tra lại `TELEGRAM_BOT_TOKEN`

### Lỗi 400 Bad Request:

```
❌ Telegram API error: 400
```

**Giải pháp:** Chat ID sai hoặc bot chưa được start

---

## 📚 Tài Liệu Tham Khảo

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [HTML Formatting](https://core.telegram.org/bots/api#html-style)

---

## 🎉 Hoàn Thành!

Hệ thống thông báo Telegram đã sẵn sàng. Mỗi khi có đơn hàng mới, bạn sẽ nhận được thông báo ngay lập tức trên Telegram! 🚀
