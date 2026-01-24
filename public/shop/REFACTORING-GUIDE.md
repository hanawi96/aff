# 🏗️ REFACTORING GUIDE - Modular Architecture

## 📋 Tổng quan

Tài liệu này hướng dẫn cách refactor code từ **monolithic** (`app.js` duy nhất) sang **modular architecture** (nhiều module nhỏ, dễ quản lý).

---

## 🎯 Mục tiêu

✅ **Dễ maintain** - Mỗi module có trách nhiệm rõ ràng
✅ **Dễ debug** - Tìm lỗi nhanh hơn, scope nhỏ hơn
✅ **Dễ test** - Test từng module độc lập
✅ **Dễ collaborate** - Nhiều người làm cùng lúc không conflict
✅ **Reusable** - Tái sử dụng code dễ dàng
✅ **Scalable** - Dễ mở rộng tính năng mới

---

## 📁 Cấu trúc thư mục mới

```
public/shop/
├── index.html
├── cart.html
├── checkout.html
│
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── components.css
│   │   ├── cart.css
│   │   └── checkout.css
│   │
│   └── js/
│       ├── app.js                    # Entry point (MINIMAL)
│       │
│       ├── config/
│       │   └── constants.js          # ✅ CREATED
│       │
│       ├── services/
│       │   ├── api.service.js        # ✅ CREATED
│       │   ├── cart.service.js       # ✅ CREATED
│       │   └── storage.service.js    # ✅ CREATED
│       │
│       ├── components/
│       │   ├── product-card.js       # TODO
│       │   ├── flash-sale.js         # TODO
│       │   ├── quick-checkout.js     # TODO
│       │   └── category-grid.js      # TODO
│       │
│       ├── utils/
│       │   ├── formatters.js         # ✅ CREATED
│       │   ├── validators.js         # ✅ CREATED
│       │   └── helpers.js            # ✅ CREATED
│       │
│       └── pages/
│           ├── home.js               # TODO
│           ├── cart.js               # TODO
│           └── checkout.js           # TODO
```

---

## 🔧 Modules đã tạo

### **1. Config Module** ✅
**File:** `config/constants.js`

**Chứa:**
- API URLs
- CDN URLs
- Configuration values
- Constants (shipping fee, thresholds, etc.)
- Discount codes
- Category images mapping

**Sử dụng:**
```javascript
import { CONFIG, DISCOUNT_CODES } from './config/constants.js';

console.log(CONFIG.API_BASE_URL);
console.log(CONFIG.SHIPPING_FEE);
```

---

### **2. Utils Modules** ✅

#### **formatters.js**
**Chứa:**
- `formatPrice()` - Format giá tiền
- `formatDate()` - Format ngày
- `escapeHtml()` - Escape HTML
- `generateStars()` - Generate star rating
- `debounce()` - Debounce function

**Sử dụng:**
```javascript
import { formatPrice, generateStars } from './utils/formatters.js';

const priceText = formatPrice(300000); // "300.000đ"
const stars = generateStars(4.5); // HTML stars
```

#### **validators.js**
**Chứa:**
- `validatePhone()` - Validate số điện thoại
- `validateRequired()` - Validate required field
- `validateEmail()` - Validate email
- `validateCheckoutForm()` - Validate checkout form

**Sử dụng:**
```javascript
import { validatePhone, validateCheckoutForm } from './utils/validators.js';

if (validatePhone('0123456789')) {
    // Valid phone
}

const result = validateCheckoutForm(formData);
if (result.isValid) {
    // Submit form
} else {
    // Show errors
    console.log(result.errors);
}
```

#### **helpers.js**
**Chứa:**
- `showNotification()` - Show toast notification
- `showToast()` - Alias for showNotification
- `calculateDiscount()` - Calculate discount percentage
- `isMobile()` - Check if mobile
- `scrollToElement()` - Smooth scroll

**Sử dụng:**
```javascript
import { showToast, isMobile } from './utils/helpers.js';

showToast('Thành công!', 'success');
if (isMobile()) {
    // Mobile specific code
}
```

---

### **3. Services Modules** ✅

#### **api.service.js**
**Chứa:**
- `get()` - Generic GET request
- `post()` - Generic POST request
- `getAllProducts()` - Get all products
- `getProductById()` - Get product by ID
- `getAllCategories()` - Get all categories
- `getActiveFlashSales()` - Get active flash sales
- `createOrder()` - Create order

**Sử dụng:**
```javascript
import { apiService } from './services/api.service.js';

// Get products
const products = await apiService.getAllProducts();

// Get categories
const categories = await apiService.getAllCategories();

// Create order
const order = await apiService.createOrder(orderData);
```

#### **storage.service.js**
**Chứa:**
- `get()` - Get from localStorage
- `set()` - Set to localStorage
- `remove()` - Remove from localStorage
- `clear()` - Clear localStorage
- `getCart()` - Get cart
- `saveCart()` - Save cart
- `getDiscount()` - Get discount
- `saveDiscount()` - Save discount

**Sử dụng:**
```javascript
import { storageService } from './services/storage.service.js';

// Cart operations
const cart = storageService.getCart();
storageService.saveCart(updatedCart);

// Discount operations
const discount = storageService.getDiscount();
storageService.saveDiscount(discountCode);
```

#### **cart.service.js**
**Chứa:**
- `getCart()` - Get cart items
- `getItemCount()` - Get total item count
- `getTotal()` - Get cart total
- `addItem()` - Add item to cart
- `updateQuantity()` - Update item quantity
- `removeItem()` - Remove item from cart
- `clear()` - Clear cart
- `save()` - Save cart to storage

**Sử dụng:**
```javascript
import { cartService } from './services/cart.service.js';

// Add to cart
cartService.addItem(product, 1);

// Update quantity
cartService.updateQuantity(productId, 2);

// Get cart info
const itemCount = cartService.getItemCount();
const total = cartService.getTotal();
```

---

## 🚀 Cách refactor từng bước

### **Bước 1: Import modules vào app.js**

**Trước:**
```javascript
// app.js - Monolithic
const API_BASE_URL = '...';
function formatPrice(price) { ... }
function loadProducts() { ... }
```

**Sau:**
```javascript
// app.js - Modular
import { CONFIG } from './config/constants.js';
import { formatPrice } from './utils/formatters.js';
import { apiService } from './services/api.service.js';
import { cartService } from './services/cart.service.js';

// Use imported modules
const products = await apiService.getAllProducts();
const priceText = formatPrice(product.price);
cartService.addItem(product);
```

---

### **Bước 2: Tạo Component modules**

**Ví dụ: product-card.js**
```javascript
// components/product-card.js
import { formatPrice, generateStars, escapeHtml } from '../utils/formatters.js';
import { calculateDiscount } from '../utils/helpers.js';
import { CONFIG } from '../config/constants.js';

export function createProductCard(product) {
    const discount = calculateDiscount(product.original_price, product.price);
    const stars = generateStars(product.rating || 4.5);
    
    return `
        <div class="product-card">
            <img src="${product.image_url || CONFIG.DEFAULT_IMAGE}">
            <h3>${escapeHtml(product.name)}</h3>
            <div class="stars">${stars}</div>
            <div class="price">${formatPrice(product.price)}</div>
            <button onclick="buyNow(${product.id})">Mua ngay</button>
        </div>
    `;
}

export function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = products.map(createProductCard).join('');
}
```

**Sử dụng:**
```javascript
// app.js
import { renderProducts } from './components/product-card.js';

const products = await apiService.getAllProducts();
renderProducts(products, 'productsGrid');
```

---

### **Bước 3: Tạo Page modules**

**Ví dụ: home.js**
```javascript
// pages/home.js
import { apiService } from '../services/api.service.js';
import { renderProducts } from '../components/product-card.js';
import { renderCategories } from '../components/category-grid.js';
import { initFlashSale } from '../components/flash-sale.js';

export async function initHomePage() {
    try {
        // Load data
        const [products, categories, flashSales] = await Promise.all([
            apiService.getAllProducts(),
            apiService.getAllCategories(),
            apiService.getActiveFlashSales()
        ]);
        
        // Render components
        renderCategories(categories, 'categoriesGrid');
        renderProducts(products, 'productsGrid');
        initFlashSale(flashSales);
        
    } catch (error) {
        console.error('Home page init error:', error);
    }
}
```

**Sử dụng:**
```javascript
// app.js - MINIMAL!
import { initHomePage } from './pages/home.js';

document.addEventListener('DOMContentLoaded', () => {
    initHomePage();
});
```

---

## 📝 Checklist Refactoring

### **Phase 1: Foundation** ✅
- [x] Create directory structure
- [x] Create config/constants.js
- [x] Create utils/formatters.js
- [x] Create utils/validators.js
- [x] Create utils/helpers.js
- [x] Create services/api.service.js
- [x] Create services/storage.service.js
- [x] Create services/cart.service.js

### **Phase 2: Components** 🔄
- [ ] Create components/product-card.js
- [ ] Create components/flash-sale.js
- [ ] Create components/quick-checkout.js
- [ ] Create components/category-grid.js

### **Phase 3: Pages** 🔄
- [ ] Create pages/home.js
- [ ] Create pages/cart.js
- [ ] Create pages/checkout.js

### **Phase 4: Integration** 🔄
- [ ] Update index.html to use modules
- [ ] Update app.js to minimal entry point
- [ ] Test all functionality
- [ ] Remove old code

---

## 🎯 Lợi ích sau khi refactor

### **Trước (Monolithic):**
```
app.js (1000+ lines)
├── Config
├── API calls
├── Rendering
├── Cart logic
├── Flash sale
├── Quick checkout
├── Event listeners
└── Utils
```
❌ Khó tìm code
❌ Khó debug
❌ Khó test
❌ Conflict khi collaborate

### **Sau (Modular):**
```
app.js (50 lines) - Entry point only
├── config/constants.js (100 lines)
├── services/
│   ├── api.service.js (150 lines)
│   ├── cart.service.js (100 lines)
│   └── storage.service.js (80 lines)
├── components/
│   ├── product-card.js (120 lines)
│   ├── flash-sale.js (200 lines)
│   └── quick-checkout.js (250 lines)
├── utils/
│   ├── formatters.js (80 lines)
│   ├── validators.js (60 lines)
│   └── helpers.js (70 lines)
└── pages/
    ├── home.js (150 lines)
    ├── cart.js (200 lines)
    └── checkout.js (180 lines)
```
✅ Dễ tìm code (biết file nào chứa gì)
✅ Dễ debug (scope nhỏ)
✅ Dễ test (test từng module)
✅ Không conflict (mỗi người 1 file)

---

## 🚀 Next Steps

1. **Tạo Component modules** (product-card, flash-sale, etc.)
2. **Tạo Page modules** (home, cart, checkout)
3. **Update HTML** để load modules
4. **Test thoroughly**
5. **Remove old code**

---

## 💡 Best Practices

1. **One responsibility per module** - Mỗi module làm 1 việc
2. **Export only what's needed** - Không export internal functions
3. **Use named exports** - Dễ tree-shaking
4. **Document your code** - Comment rõ ràng
5. **Keep modules small** - < 300 lines per file
6. **Use consistent naming** - service.js, component.js, etc.

---

## 📚 Resources

- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [JavaScript Design Patterns](https://www.patterns.dev/posts/classic-design-patterns/)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

---

**Bạn muốn tôi tiếp tục tạo các Component và Page modules không?**
