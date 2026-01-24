# 🔄 Hướng dẫn Refactoring - Shop Frontend

## ✅ Đã hoàn thành

### 1. Tạo cấu trúc Partials
```
public/shop/partials/
├── header.html                      ✅ Đã tạo
├── footer.html                      ✅ Đã tạo
└── modals/
    ├── cart-sidebar.html            ✅ Đã tạo
    ├── quick-checkout.html          ✅ Đã tạo
    └── discount-selector.html       ✅ Đã tạo
```

### 2. Tạo Partials Loader Utility
```
public/shop/assets/js/shared/
└── partials-loader.js               ✅ Đã tạo
```

**Functions:**
- `loadPartial(path, containerId)` - Load 1 partial
- `loadPartials(array)` - Load nhiều partials
- `appendPartial(path, containerId)` - Append partial
- `loadCommonPartials()` - Load tất cả partials chung

### 3. Update app.js
```javascript
// ✅ Đã update để load partials tự động
import { loadCommonPartials } from './shared/partials-loader.js';

async init() {
    // Load common partials for all pages except cart
    if (page !== 'cart') {
        await loadCommonPartials();
    }
    // ...
}
```

### 4. Tạo Documentation
- ✅ `README.md` - Hướng dẫn cấu trúc mới
- ✅ `REFACTORING-GUIDE.md` - Hướng dẫn migration

## 📋 Cách sử dụng cấu trúc mới

### Bước 1: Tạo file HTML mới với placeholders

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <title>Trang mới</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Header sẽ được load tự động -->
    <div id="header-placeholder"></div>

    <!-- Nội dung chính của trang -->
    <main>
        <section>
            <!-- Your content here -->
        </section>
    </main>

    <!-- Footer sẽ được load tự động -->
    <div id="footer-placeholder"></div>

    <!-- Modals sẽ được load tự động -->
    <div id="modals-placeholder"></div>

    <!-- Load app.js để khởi tạo -->
    <script type="module" src="assets/js/app.js"></script>
</body>
</html>
```

### Bước 2: app.js sẽ tự động load partials

Khi trang load, `app.js` sẽ:
1. Detect trang hiện tại
2. Load header, footer, modals vào placeholders
3. Khởi tạo logic cho trang đó

**Không cần code thêm gì!** Partials được load tự động.

## 🔧 Migration từ index.html cũ

### File cũ (index.html - 803 dòng)
```html
<!DOCTYPE html>
<html>
<head>...</head>
<body>
    <!-- Header - 80 dòng -->
    <header>...</header>
    
    <!-- Hero - 30 dòng -->
    <section>...</section>
    
    <!-- Flash Sale - 150 dòng -->
    <section>...</section>
    
    <!-- Categories - 100 dòng -->
    <section>...</section>
    
    <!-- Products - 150 dòng -->
    <section>...</section>
    
    <!-- Features - 50 dòng -->
    <section>...</section>
    
    <!-- Footer - 80 dòng -->
    <footer>...</footer>
    
    <!-- Cart Sidebar - 50 dòng -->
    <div>...</div>
    
    <!-- Quick Checkout Modal - 250 dòng -->
    <div>...</div>
    
    <!-- Discount Modal - 30 dòng -->
    <div>...</div>
    
    <script src="app.js"></script>
</body>
</html>
```

### File mới (index.html - ~400 dòng)
```html
<!DOCTYPE html>
<html>
<head>...</head>
<body>
    <!-- Header Placeholder - 1 dòng -->
    <div id="header-placeholder"></div>
    
    <!-- Hero - 30 dòng -->
    <section>...</section>
    
    <!-- Flash Sale - 150 dòng -->
    <section>...</section>
    
    <!-- Categories - 100 dòng -->
    <section>...</section>
    
    <!-- Products - 150 dòng -->
    <section>...</section>
    
    <!-- Features - 50 dòng -->
    <section>...</section>
    
    <!-- Footer Placeholder - 1 dòng -->
    <div id="footer-placeholder"></div>
    
    <!-- Modals Placeholder - 1 dòng -->
    <div id="modals-placeholder"></div>
    
    <script type="module" src="assets/js/app.js"></script>
</body>
</html>
```

**Giảm từ 803 dòng xuống ~400 dòng!**

## 📊 So sánh

| Tiêu chí | Cũ | Mới | Cải thiện |
|----------|-----|-----|-----------|
| Số dòng index.html | 803 | ~400 | -50% |
| Header/Footer | Duplicate mỗi trang | Dùng chung | Tái sử dụng 100% |
| Modals | Duplicate mỗi trang | Dùng chung | Tái sử dụng 100% |
| Maintainability | Khó | Dễ | ⭐⭐⭐⭐⭐ |
| Debug | Khó tìm lỗi | Dễ tìm lỗi | ⭐⭐⭐⭐⭐ |
| Load time | Tất cả cùng lúc | Lazy load | Nhanh hơn |

## 🎯 Lợi ích

### 1. **Dễ maintain**
- Sửa header → Chỉ sửa 1 file `partials/header.html`
- Sửa modal → Chỉ sửa 1 file trong `partials/modals/`
- Không cần sửa từng trang

### 2. **Tái sử dụng**
- Header, Footer, Modals dùng chung cho tất cả trang
- Tạo trang mới chỉ cần copy template

### 3. **Dễ debug**
- Biết ngay lỗi ở file nào
- Không bị lẫn lộn giữa các phần

### 4. **Performance**
- Lazy load partials khi cần
- Browser cache partials
- Giảm kích thước HTML chính

### 5. **Team collaboration**
- Nhiều người làm song song
- Không conflict code
- Clear ownership

## 🚀 Các bước tiếp theo

### Bước 1: Test cấu trúc mới
```bash
# Mở index.html mới trong browser
# Kiểm tra header, footer, modals có load không
```

### Bước 2: Migrate các trang khác
- ✅ index.html (trang chủ)
- ⏳ cart.html (giỏ hàng) - Optional, đã tốt rồi
- ⏳ checkout.html (thanh toán) - Chưa có
- ⏳ product-detail.html (chi tiết SP) - Chưa có

### Bước 3: Optimize CSS
```
assets/css/
├── main.css              # Global
├── pages/
│   ├── home.css
│   ├── cart.css
│   └── checkout.css
└── components/
    ├── header.css
    ├── footer.css
    ├── modal.css
    └── sidebar.css
```

### Bước 4: Tạo thêm components
```javascript
// components/ProductCard.js
export class ProductCard {
    render(product) {
        return `<div class="product-card">...</div>`;
    }
}

// components/FlashSaleCard.js
export class FlashSaleCard {
    render(product) {
        return `<div class="flash-sale-card">...</div>`;
    }
}
```

## 📝 Template cho trang mới

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tên Trang - Vòng Đầu Tam</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#d4af37',
                        secondary: '#8b7355',
                        accent: '#c9a961',
                    }
                }
            }
        }
    </script>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Header Placeholder -->
    <div id="header-placeholder"></div>

    <!-- Main Content -->
    <main>
        <!-- Your content here -->
    </main>

    <!-- Footer Placeholder -->
    <div id="footer-placeholder"></div>

    <!-- Modals Placeholder -->
    <div id="modals-placeholder"></div>

    <script type="module" src="assets/js/app.js"></script>
</body>
</html>
```

## ⚠️ Lưu ý quan trọng

### 1. File paths
- Partials paths phải đúng: `/shop/partials/...`
- Relative paths trong partials cũng phải đúng

### 2. JavaScript modules
- Phải dùng `type="module"` trong script tag
- Import/export phải đúng syntax ES6

### 3. Browser compatibility
- Fetch API: IE11 không support
- ES6 modules: IE11 không support
- Nếu cần support IE11, phải dùng polyfills

### 4. CORS issues
- Nếu test local bằng `file://`, fetch sẽ bị CORS
- Phải dùng local server (Live Server, http-server, etc.)

## 🔍 Troubleshooting

### Partials không load?
```javascript
// Check console for errors
// Kiểm tra paths có đúng không
// Kiểm tra server có chạy không
```

### Modals không hoạt động?
```javascript
// Đảm bảo partials đã load xong
// Check event listeners có được attach không
// Kiểm tra CSS classes có đúng không
```

### Styles bị lỗi?
```css
/* Kiểm tra CSS paths
/* Đảm bảo Tailwind config đúng
/* Check responsive breakpoints
*/
```

## 📚 Resources

- [README.md](./README.md) - Cấu trúc chi tiết
- [partials-loader.js](./assets/js/shared/partials-loader.js) - Source code
- [app.js](./assets/js/app.js) - Entry point

## ✨ Kết luận

Cấu trúc mới giúp:
- ✅ Code sạch hơn, dễ đọc hơn
- ✅ Maintain dễ dàng hơn
- ✅ Debug nhanh hơn
- ✅ Tái sử dụng code tốt hơn
- ✅ Performance tốt hơn
- ✅ Team collaboration tốt hơn

**Đã sẵn sàng để sử dụng!** 🚀
