# 🚀 Setup Nhanh Telegram Notification

## ✅ Đã Hoàn Thành

Hệ thống thông báo Telegram đã được tích hợp sẵn vào code!

---

## 📋 Checklist

- ✅ Tạo file `src/services/notifications/telegram-service.js`
- ✅ Tích hợp vào `src/services/orders/order-service.js`
- ✅ Thêm config vào `.env` và `wrangler.toml`
- ✅ Sử dụng Bot Token từ Google Apps Script cũ

---

## 🧪 Test Ngay

### Cách 1: Test bằng script

```bash
npm run test:telegram
```

Nếu thành công, bạn sẽ nhận được tin nhắn test trên Telegram!

### Cách 2: Test trên local dev

```bash
# Chạy dev server
npm run dev

# Mở website và đặt hàng thử
# http://localhost:8787/shop
```

### Cách 3: Deploy và test thật

```bash
# Deploy lên Cloudflare
npm run deploy

# Đặt hàng thật trên website production
```

---

## 🔍 Kiểm Tra Logs

```bash
# Xem logs realtime
npm run logs

# Tìm dòng này:
✅ Telegram notification sent: VDT001
```

---

## ⚠️ Nếu Không Nhận Được Thông Báo

### 1. Kiểm tra Bot đã start chưa?
- Mở Telegram
- Tìm bot của bạn
- Nhắn `/start`

### 2. Kiểm tra Token & Chat ID
```bash
# Xem file .env
cat .env

# Phải có:
TELEGRAM_BOT_TOKEN=7585519498:AAFHt6QMqI-zfVVnbQW1E_fxzQ1kNUsiEQU
TELEGRAM_CHAT_ID=5816975483
```

### 3. Test bằng script
```bash
npm run test:telegram
```

---

## 🎉 Xong!

Mỗi khi có đơn hàng mới, bạn sẽ nhận thông báo ngay trên Telegram! 🚀

**Xem hướng dẫn chi tiết:** `TELEGRAM-NOTIFICATION-GUIDE.md`
