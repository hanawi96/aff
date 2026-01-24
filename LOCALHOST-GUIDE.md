# 🚀 HƯỚNG DẪN CHẠY LOCALHOST

## Cách 1: Dùng Live Server (VS Code) - ĐƠN GIẢN NHẤT ✅

### Bước 1: Chạy Backend
Mở terminal và chạy:
```bash
wrangler dev --port 8787
```
**Để terminal này chạy!** Backend sẽ ở `http://localhost:8787`

### Bước 2: Chạy Frontend với Live Server
1. Mở file `public/shop/index.html` trong VS Code
2. Click chuột phải → **"Open with Live Server"** (hoặc click icon "Go Live" ở góc dưới)
3. Browser sẽ tự động mở `http://127.0.0.1:5500/public/shop/index.html`

### Bước 3: Test Admin Panel (nếu cần)
1. Mở file `public/admin/index.html`
2. Click "Go Live"
3. Hoặc truy cập: `http://127.0.0.1:5500/public/admin/index.html`

---

## Cách 2: Dùng Script (Tự động) 🤖

Chỉ cần double-click file `start-dev.bat`

Sẽ tự động mở:
- Backend: `http://localhost:8787`
- Frontend: `http://localhost:8080`

---

## 📝 LƯU Ý

### ✅ Đã tự động cấu hình:
- Frontend sẽ **tự động phát hiện** đang chạy localhost
- API sẽ gọi đến `http://localhost:8787` khi ở local
- Khi deploy production, sẽ tự động dùng domain thật

### 🔍 Kiểm tra Backend đang chạy:
Mở browser và truy cập:
```
http://localhost:8787/?action=getAllProducts
```
Nếu thấy JSON response → Backend OK ✅

### ⚠️ Nếu gặp lỗi CORS:
Backend đã có CORS headers, nhưng nếu vẫn lỗi:
1. Kiểm tra `src/config/cors.js`
2. Restart backend: `Ctrl+C` rồi chạy lại `wrangler dev`

---

## 🎯 URL Tổng Hợp

### Local Development:
- **Backend API**: http://localhost:8787
- **Frontend Shop**: http://127.0.0.1:5500/public/shop/index.html (Live Server)
- **Admin Panel**: http://127.0.0.1:5500/public/admin/index.html (Live Server)

### Production:
- **Backend API**: https://ctv-api.yendev96.workers.dev
- **Frontend Shop**: (Deploy lên Cloudflare Pages)
- **Admin Panel**: (Deploy lên Cloudflare Pages)

---

## 🐛 Troubleshooting

### Backend không chạy?
```bash
# Kiểm tra port 8787 có bị chiếm không
netstat -ano | findstr :8787

# Nếu bị chiếm, kill process hoặc đổi port
wrangler dev --port 8788
# Nhớ update port trong config.js
```

### Frontend không gọi được API?
1. Mở DevTools (F12) → Console
2. Xem có lỗi CORS không?
3. Kiểm tra Network tab → Request có đúng URL không?

### Live Server không hoạt động?
1. Install extension "Live Server" trong VS Code
2. Hoặc dùng: `npx http-server public -p 8080`

---

## 💡 Tips

### Hot Reload:
- **Backend**: Wrangler tự động reload khi sửa code
- **Frontend**: Live Server tự động reload khi sửa HTML/CSS/JS

### Debug:
- Backend logs: Xem trong terminal đang chạy `wrangler dev`
- Frontend logs: Mở DevTools (F12) → Console

### Test API trực tiếp:
Dùng Postman hoặc curl:
```bash
# Get products
curl http://localhost:8787/?action=getAllProducts

# Get categories
curl http://localhost:8787/?action=getAllCategories
```

---

## ✨ Workflow Khuyến Nghị

1. **Sáng**: Mở VS Code → Chạy `wrangler dev` → Click "Go Live"
2. **Code**: Sửa code → Tự động reload
3. **Test**: Mở browser → Test tính năng
4. **Tối**: Commit code → Push lên Git
5. **Deploy**: `wrangler deploy` (backend) + `wrangler pages publish` (frontend)

---

Chúc bạn code vui vẻ! 🎉
