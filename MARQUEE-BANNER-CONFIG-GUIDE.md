# Hướng Dẫn Bật/Tắt Marquee Banner

## Tổng quan
Marquee banner có thể được bật/tắt dễ dàng thông qua inline script trong HTML, không có FOUC (flash).

## ⚡ Cách Nhanh Nhất (Khuyên dùng)

### Bật/Tắt Marquee Banner

Mở file HTML và tìm dòng này (ngay đầu `<body>`):

**File: `public/shop/cart.html`**
```html
<body>
    <script>
        window.MARQUEE_ENABLED = true; // ← THAY ĐỔI Ở ĐÂY
    </script>
```

**File: `public/shop/index.html`**
```html
<body class="bg-warm">
    <script>
        window.MARQUEE_ENABLED = true; // ← THAY ĐỔI Ở ĐÂY
    </script>
```

### Để TẮT marquee:
```javascript
window.MARQUEE_ENABLED = false; // false = ẩn
```

### Để BẬT marquee:
```javascript
window.MARQUEE_ENABLED = true; // true = hiển thị
```

## ✅ Ưu điểm của phương pháp này

1. **Không có FOUC**: Banner không bao giờ flash khi load trang
2. **Instant**: Áp dụng ngay lập tức trước khi HTML render
3. **Đơn giản**: Chỉ cần thay đổi 1 dòng code
4. **Đồng bộ**: Thay đổi ở 2 file (cart.html và index.html) để áp dụng toàn site

## Cách Hoạt Động

### Khi `MARQUEE_ENABLED = true`:
```
✅ Marquee banner hiển thị
✅ Body có padding-top: 40px
✅ Header sticky ở top: 40px
```

### Khi `MARQUEE_ENABLED = false`:
```
❌ Marquee banner ẩn hoàn toàn
✅ Body có padding-top: 0
✅ Header sticky ở top: 0
✅ Không có flash khi load
```

## Thay Đổi Nội Dung

Nếu muốn thay đổi text hiển thị, edit trực tiếp trong HTML:

```html
<div class="marquee-banner">
    <div class="marquee-content">
        <span class="marquee-text">
            🎁 NỘI DUNG MỚI Ở ĐÂY 🚚
        </span>
        <span class="marquee-text" aria-hidden="true">
            🎁 NỘI DUNG MỚI Ở ĐÂY 🚚
        </span>
    </div>
</div>
```

**Lưu ý**: Phải thay đổi ở cả 2 `<span>` để animation loop hoạt động đúng.

## Files Cần Chỉnh Sửa

### Để bật/tắt toàn site:
1. `public/shop/cart.html` - Trang giỏ hàng
2. `public/shop/index.html` - Trang chủ

### CSS (không cần chỉnh):
- `public/shop/cart.css` - Styles tự động điều chỉnh

## Ví Dụ Thực Tế

### Ví dụ 1: Tắt marquee cho Black Friday

```html
<!-- cart.html và index.html -->
<script>
    window.MARQUEE_ENABLED = false; // Tắt banner thông thường
</script>
```

Sau đó thêm banner Black Friday riêng ở vị trí khác.

### Ví dụ 2: Thay đổi nội dung cho Tết

```html
<span class="marquee-text">
    🧧 CHÚC MỪNG NĂM MỚI - GIẢM 30% TẤT CẢ SẢN PHẨM 🎊
</span>
```

### Ví dụ 3: Tắt tạm thời để test

```html
<script>
    window.MARQUEE_ENABLED = false; // Test layout không có banner
</script>
```

## Troubleshooting

### Vẫn thấy flash khi load?

1. ✅ Check inline script phải ở **NGAY SAU** thẻ `<body>`
2. ✅ Không được có bất kỳ HTML nào giữa `<body>` và `<script>`
3. ✅ Clear cache (Ctrl+Shift+R)

### Layout bị lỗi sau khi tắt?

1. Check console có lỗi không
2. Inspect element xem class `marquee-disabled` có trên `<html>` không
3. Check CSS file có đầy đủ rules không

### Muốn tắt chỉ trên mobile?

```html
<script>
    // Tắt marquee trên mobile
    window.MARQUEE_ENABLED = window.innerWidth >= 768;
</script>
```

## Best Practices

1. ✅ Thay đổi ở cả 2 file (cart.html và index.html) để đồng bộ
2. ✅ Test trên cả desktop và mobile
3. ✅ Clear cache sau khi thay đổi
4. ✅ Commit với message rõ ràng (ví dụ: "Disable marquee banner for maintenance")
5. ❌ Không xóa HTML của marquee, chỉ cần set `false`

## So Sánh Với Cách Cũ

### ❌ Cách cũ (có FOUC):
```
1. HTML load → Banner hiện
2. JavaScript load → Banner ẩn
3. User thấy flash 😞
```

### ✅ Cách mới (không FOUC):
```
1. Inline script chạy → Set class ngay
2. HTML load → Banner đã ẩn sẵn
3. User không thấy flash 😊
```

## Lưu Ý Quan Trọng

- **Inline script** chạy đồng bộ (blocking) nên sẽ áp dụng trước khi HTML render
- **Module script** chạy bất đồng bộ (async) nên không dùng được cho việc này
- Phải thay đổi ở **cả 2 file** để toàn site đồng bộ

