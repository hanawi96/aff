# Shop Frontend Structure

## 📁 Cấu trúc thư mục

```
public/shop/
├── index.html              # Trang chủ (Hero, Flash Sale, Categories, Products, Features)
├── cart.html               # Trang giỏ hàng
├── checkout.html           # Trang thanh toán (TODO)
│
├── partials/               # Các phần HTML dùng chung
│   ├── header.html         # Header - Navigation
│   ├── footer.html         # Footer - Links & Contact
│   └── modals/             # Các modal
│       ├── cart-sidebar.html       # Sidebar giỏ hàng
│       ├── quick-checkout.html     # Modal mua nhanh
│       └── discount-selector.html  # Modal chọn mã giảm giá
│
├── assets/
│   ├── js/
│   │   ├── app.js                  # Entry point chính
│   │   ├── pages/                  # Logic từng trang
│   │   │   ├── home.page.js        # Logic trang chủ
│   │   │   ├── cart.page.js        # Logic giỏ hàng (TODO)
│   │   │   └── checkout.page.js    # Logic checkout (TODO)
│   │   ├── components/             # Components UI
│   │   │   ├── Header.js
│   │   │   ├── FlashSale.js
│   │   │   ├── ProductGrid.js
│   │   │   └── QuickCheckout.js
│   │   ├── services/               # API services
│   │   │   ├── api.service.js
│   │   │   ├── cart.service.js
│   │   │   └── product.service.js
│   │   ├── shared/                 # Utilities dùng chung
│   │   │   ├── partials-loader.js  # Load HTML partials
│   │   │   └── utils.js
│   │   └── utils/
│   │       ├── dom.js
│   │       └── formatter.js
│   │
│   └── css/
│       ├── main.css                # Global styles
│       ├── pages/
│       │   ├── home.css
│       │   ├── cart.css
│       │   └── checkout.css
│       └── components/
│           ├── modal.css
│           └── sidebar.css
│
├── styles.css              # Main stylesheet (trang chủ)
├── cart.css                # Cart page stylesheet
└── cart.js                 # Cart page logic (standalone)
```

## 🎯 Nguyên tắc tổ chức

### 1. **Pages** (Trang)
- Mỗi trang = 1 file HTML
- Chứa nội dung chính của trang
- Load partials (header/footer/modals) tự động

### 2. **Partials** (Phần dùng chung)
- Header, Footer: Dùng chung cho tất cả trang
- Modals: Các popup/dialog có thể tái sử dụng
- Load động qua JavaScript

### 3. **JavaScript Modules**
- **app.js**: Entry point, khởi tạo app
- **pages/**: Logic riêng cho từng trang
- **components/**: UI components có thể tái sử dụng
- **services/**: API calls và business logic
- **shared/**: Utilities dùng chung

## 🚀 Cách sử dụng

### Tạo trang mới

1. **Tạo file HTML**:
```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <title>Trang mới</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Header Placeholder -->
    <div id="header-placeholder"></div>

    <!-- Nội dung trang -->
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

2. **Tạo file JS logic** (nếu cần):
```javascript
// assets/js/pages/new-page.page.js
export class NewPage {
    async init() {
        console.log('New page initialized');
        // Your logic here
    }
}
```

3. **Update app.js**:
```javascript
import { NewPage } from './pages/new-page.page.js';

// Trong detectPage()
if (path.includes('new-page.html')) {
    return 'new-page';
}

// Trong init()
case 'new-page':
    this.currentPage = new NewPage();
    await this.currentPage.init();
    break;
```

### Tạo modal mới

1. **Tạo file HTML**:
```html
<!-- partials/modals/my-modal.html -->
<div class="my-modal hidden" id="myModal">
    <div class="modal-content">
        <!-- Modal content -->
    </div>
</div>
```

2. **Load trong partials-loader.js**:
```javascript
export async function loadCommonPartials() {
    await loadPartials([
        // ... existing partials
        { path: '/shop/partials/modals/my-modal.html', containerId: 'modals-placeholder' }
    ]);
}
```

## 📝 Migration từ cấu trúc cũ

### Trước (index.html cũ):
- 803 dòng code
- Tất cả HTML trong 1 file
- Khó maintain và debug

### Sau (index-new.html):
- ~400 dòng code (chỉ nội dung chính)
- Header/Footer/Modals tách riêng
- Dễ maintain, tái sử dụng
- Load động qua JavaScript

## 🔧 Công cụ hỗ trợ

### partials-loader.js
```javascript
import { loadCommonPartials } from './shared/partials-loader.js';

// Load tất cả partials chung
await loadCommonPartials();

// Load partial riêng lẻ
await loadPartial('/shop/partials/header.html', 'header-placeholder');

// Append partial (không replace)
await appendPartial('/shop/partials/modal.html', 'modals-placeholder');
```

## ⚡ Performance

- **Lazy loading**: Partials chỉ load khi cần
- **Caching**: Browser cache HTML partials
- **Parallel loading**: Load nhiều partials cùng lúc
- **Minimal JS**: Chỉ load logic cần thiết cho từng trang

## 🎨 Styling

- **Global styles**: `styles.css` (Tailwind + custom)
- **Page-specific**: `cart.css`, `checkout.css`
- **Component styles**: Inline trong partials hoặc component CSS files

## 📦 Dependencies

- **Tailwind CSS**: Utility-first CSS framework
- **Font Awesome**: Icons
- **ES6 Modules**: Native JavaScript modules

## 🔄 Next Steps

1. ✅ Tách header, footer, modals
2. ✅ Tạo partials-loader utility
3. ✅ Refactor index.html
4. ⏳ Tạo checkout.html
5. ⏳ Migrate cart.html sang cấu trúc mới (optional)
6. ⏳ Tạo product-detail.html
7. ⏳ Optimize CSS (tách components)

## 📚 Best Practices

1. **Một trang = Một file HTML**: Dễ tìm và maintain
2. **Partials cho phần dùng chung**: Header, Footer, Modals
3. **JavaScript modules**: Tách logic theo chức năng
4. **CSS scoped**: Mỗi page/component có CSS riêng
5. **Lazy loading**: Chỉ load khi cần thiết
