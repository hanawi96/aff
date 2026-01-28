# Bundle Products Service - Hướng dẫn sử dụng

## 📦 Mục đích

Service tập trung để quản lý sản phẩm bán kèm (cross-sell/bundle products) được hiển thị ở:
- ✅ Trang giỏ hàng (cart.html)
- ✅ Modal mua nhanh (quick checkout)

## 🎯 Lợi ích

### ✅ Đầy đủ thông tin từ database
- Tất cả thông tin sản phẩm (name, price, description, categories, badges, stock...)
- Tự động cập nhật khi thay đổi trong database
- Tracking lượt bán chính xác

### ✅ Đồng bộ 100%
- Cả cart và modal đều dùng chung 1 service
- Không còn hardcode ở nhiều nơi
- Dễ bảo trì và mở rộng

### ✅ Performance tốt
- Cache 5 phút để giảm API calls
- Fallback khi API lỗi
- Load nhanh, không blocking UI

## 🔧 Cách sử dụng

### Import service

```javascript
import { bundleProductsService } from './shared/services/bundle-products.service.js';
```

### Load sản phẩm

```javascript
// Load bundle products
const products = await bundleProductsService.loadBundleProducts();

// products sẽ là array chứa 2 sản phẩm (ID 133, 134)
// với đầy đủ thông tin từ database
```

### Kết quả trả về

```javascript
[
  {
    // Basic info
    id: 133,
    name: "Bó đầu 7 CÀNH (bé trai)",
    description: "...",
    
    // Pricing
    price: 42000,
    originalPrice: null,
    
    // Images
    image: "https://...",
    
    // Stock
    stock_quantity: 99,
    maxQuantity: 99,
    is_active: 1,
    
    // Categories (full data)
    categories: [...],
    category_name: "Sản phẩm bán kèm",
    category_id: 23,
    
    // Badges
    badges: [...],
    
    // Metadata
    isBundleProduct: true,
    
    // ... all other fields from database
  },
  // ... product 134
]
```

## ⚙️ Cấu hình

### Thay đổi sản phẩm hiển thị

Nếu muốn hiển thị sản phẩm khác (không phải 133, 134):

```javascript
// Thay đổi IDs
bundleProductsService.setBundleProductIds([135, 136, 137]);

// Load lại
const products = await bundleProductsService.loadBundleProducts();
```

### Xóa cache

```javascript
// Xóa cache để load lại từ API
bundleProductsService.clearCache();
```

### Lấy danh sách IDs hiện tại

```javascript
const ids = bundleProductsService.getBundleProductIds();
console.log(ids); // [133, 134]
```

## 🔄 Cách hoạt động

1. **Load từ API**: Gọi `/api/shop/products` để lấy tất cả sản phẩm
2. **Filter by ID**: Chỉ lấy sản phẩm có ID trong `BUNDLE_PRODUCT_IDS` (133, 134)
3. **Transform data**: Chuẩn hóa format để dùng chung
4. **Cache**: Lưu cache 5 phút để tối ưu performance
5. **Fallback**: Nếu API lỗi, dùng dữ liệu minimal để UI không bị break

## 📊 Ví dụ thực tế

### Trong cart.js

```javascript
// Load bundle products
loadBundleProducts: async () => {
    try {
        state.bundleProducts = await bundleProductsService.loadBundleProducts();
        console.log('✅ Loaded:', state.bundleProducts.length);
    } catch (error) {
        console.error('Error:', error);
        state.bundleProducts = [];
    }
}
```

### Trong quick-checkout.js

```javascript
// Load cross-sell products
async loadCrossSellProducts() {
    try {
        this.crossSellProducts = await bundleProductsService.loadBundleProducts();
        console.log('✅ Loaded:', this.crossSellProducts.length);
    } catch (error) {
        console.error('Error:', error);
        this.crossSellProducts = [];
    }
}
```

## 🎨 UI/UX không thay đổi

- Giao diện giữ nguyên 100%
- Chỉ thay đổi nguồn dữ liệu (từ hardcode → API)
- Render logic không đổi

## 🐛 Troubleshooting

### Không hiển thị sản phẩm?

1. Kiểm tra console log: `📦 [BUNDLE] Loading products from API...`
2. Kiểm tra sản phẩm có tồn tại trong database với ID 133, 134
3. Kiểm tra `is_active = 1`
4. Kiểm tra API endpoint `/api/shop/products` hoạt động

### Hiển thị sai giá?

- Service load trực tiếp từ database, nên giá luôn đúng
- Nếu sai, kiểm tra giá trong database

### Muốn thêm sản phẩm thứ 3?

```javascript
// Thêm ID 135 vào danh sách
bundleProductsService.setBundleProductIds([133, 134, 135]);
```

## 📝 Notes

- **Cache duration**: 5 phút (có thể thay đổi trong `CACHE_DURATION`)
- **Fallback**: Luôn có dữ liệu minimal để UI không bị lỗi
- **Singleton**: Chỉ có 1 instance duy nhất trong toàn app
- **Thread-safe**: Cache được quản lý đúng cách

## 🚀 Tương lai

Có thể mở rộng:
- Load từ localStorage để offline support
- A/B testing với các sản phẩm khác nhau
- Personalization dựa trên lịch sử mua hàng
- Dynamic pricing dựa trên inventory
