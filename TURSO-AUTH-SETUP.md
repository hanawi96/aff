# 🔑 THIẾU TURSO AUTH TOKEN!

## ❌ Vấn đề:
API trả về lỗi 401 vì thiếu `TURSO_AUTH_TOKEN` trong file `.dev.vars`

## ✅ Giải pháp:

### Bước 1: Lấy Turso Auth Token

Chạy lệnh sau để lấy token:

```bash
turso db tokens create vdt-yendev96
```

Hoặc nếu chưa login:

```bash
turso auth login
turso db tokens create vdt-yendev96
```

### Bước 2: Thêm vào file `.dev.vars`

Mở file `.dev.vars` và thêm dòng này:

```
TURSO_AUTH_TOKEN=your_token_here
```

**Ví dụ:**
```
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### Bước 3: Restart Wrangler Dev

1. Dừng wrangler dev (Ctrl+C)
2. Chạy lại: `npm run dev:backend`

---

## 🔍 Kiểm tra file `.dev.vars` hiện tại:

File nên có 2 dòng:
```
TURSO_AUTH_TOKEN=your_actual_token_here
# Các biến khác nếu có
```

---

## 📝 Lưu ý:

- Token này là **SECRET**, không commit lên Git
- File `.dev.vars` đã có trong `.gitignore`
- Token có thể expire, cần tạo lại nếu lỗi 401 xuất hiện sau này

---

## 🚀 Sau khi thêm token:

1. Restart wrangler dev
2. Test API: http://localhost:8787/?action=getAllProducts
3. Nếu thấy JSON với products → OK! ✅
