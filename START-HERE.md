# 🎉 BẮT ĐẦU NGAY - CHỈ 1 LỆNH!

## ⚡ Cách chạy đơn giản nhất

### Mở terminal và chạy:

```bash
npm run dev
```

**Hoặc:**

```bash
wrangler dev --port 8787
```

### Mở browser:

```
http://localhost:8787/
```

**XONG! Chỉ vậy thôi!** 🎉

---

## 🌟 Điểm khác biệt

### ❌ Trước đây (phức tạp):
- Phải chạy backend: `wrangler dev`
- Phải chạy frontend: Live Server
- 2 ports khác nhau: 8787 và 5500
- Phải config CORS
- Phải config API URL

### ✅ Bây giờ (đơn giản):
- **Chỉ 1 lệnh**: `npm run dev`
- **Chỉ 1 port**: 8787
- **Tự động serve** cả frontend + backend
- **Không cần config** gì thêm!

---

## 📂 Cấu trúc URL

Tất cả đều trên `http://localhost:8787`:

```
http://localhost:8787/                          → Landing page
http://localhost:8787/shop/index.html           → Shop frontend
http://localhost:8787/admin/index.html          → Admin panel
http://localhost:8787/?action=getAllProducts    → API endpoint
```

---

## 🔧 Cách hoạt động

**Wrangler Dev + Workers Sites:**
- Serve static files từ thư mục `public/`
- Xử lý API requests (có `?action=xxx`)
- Tất cả trên cùng 1 port

**Cấu hình trong `wrangler.toml`:**
```toml
[site]
bucket = "./public"
```

---

## 💻 Workflow

1. **Mở terminal** → `npm run dev`
2. **Mở browser** → `http://localhost:8787/`
3. **Chọn trang**:
   - 🛍️ Cửa Hàng → Shop
   - ⚙️ Quản Trị → Admin
4. **Code** → Sửa file → Refresh browser
5. **Done!** 🎉

---

## 🐛 Troubleshooting

### Port 8787 bị chiếm?
```bash
# Đổi port
wrangler dev --port 8788
```

### Không thấy static files?
```bash
# Kiểm tra wrangler.toml có [site] section
# Kiểm tra thư mục public/ có tồn tại
```

### API không hoạt động?
```bash
# Test API trực tiếp
curl http://localhost:8787/?action=getAllProducts
```

---

## 🚀 Deploy Production

### Backend + Frontend:
```bash
# Deploy backend
wrangler deploy

# Deploy frontend (Cloudflare Pages)
wrangler pages publish public --project-name=vdt-shop
```

---

## 📚 Tài liệu

- [QUICK-START.md](QUICK-START.md) - Hướng dẫn nhanh
- [LOCALHOST-GUIDE.md](LOCALHOST-GUIDE.md) - Hướng dẫn chi tiết
- [README.md](README.md) - Tổng quan dự án

---

**Chúc bạn code vui vẻ!** 🎊
