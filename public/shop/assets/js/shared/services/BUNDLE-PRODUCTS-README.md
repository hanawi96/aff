# Bundle Products Service - Hardcoded Data

## 📦 Tổng quan

Service này quản lý 2 sản phẩm "Mua kèm - Miễn phí ship" hiển thị trong:
- Modal mua ngay (Quick Checkout)
- Trang giỏ hàng (Cart)

## ⚡ Tối ưu hiệu suất

**Dữ liệu được HARDCODE trực tiếp trong code** thay vì gọi API, giúp:
- ✅ Load tức thì (0ms delay)
- ✅ Không cần chờ API response
- ✅ Giảm tải server
- ✅ Trải nghiệm người dùng mượt mà hơn

## 🔧 Cách cập nhật sản phẩm

### Bước 1: Lấy dữ liệu mới từ database

```bash
node database/get-bundle-products.js
```

Script này sẽ:
1. Kết nối database
2. Lấy thông tin đầy đủ của sản phẩm ID 133 và 134
3. In ra JSON formatted data

### Bước 2: Copy dữ liệu vào code

Mở file `bundle-products.service.js` và thay thế mảng `HARDCODED_PRODUCTS` bằng dữ liệu mới.

### Bước 3: Thay đổi sản phẩm khác

Nếu muốn đổi sang sản phẩm khác (không phải 133, 134):

1. Sửa file `database/get-bundle-products.js`:
   ```javascript
   WHERE p.id IN (133, 134)  // Đổi thành ID mới
   ```

2. Chạy lại script:
   ```bash
   node database/get-bundle-products.js
   ```

3. Copy JSON output vào `HARDCODED_PRODUCTS`

## 📝 Cấu trúc dữ liệu

```javascript
{
    id: 133,                    // Product ID
    name: "Tên sản phẩm",       // Tên hiển thị
    description: "Mô tả...",    // Mô tả chi tiết
    price: 42000,               // Giá bán
    originalPrice: 62000,       // Giá gốc (để tính % giảm)
    image: "https://...",       // URL hình ảnh
    stock_quantity: 99,         // Số lượng tồn kho
    maxQuantity: 99,            // Số lượng tối đa có thể mua
    is_active: 1,               // Trạng thái (1 = active)
    categories: [...],          // Danh mục
    category_name: "...",       // Tên danh mục chính
    category_id: 23,            // ID danh mục chính
    badges: [],                 // Badges (nếu có)
    isBundleProduct: true       // Flag đánh dấu bundle product
}
```

## 🎯 Sản phẩm hiện tại

- **ID 133:** Bó dâu 7 CÀNH (bé trai) - 42,000đ (giảm từ 62,000đ)
- **ID 134:** Bó dâu 9 CÀNH (bé gái) - 47,000đ (giảm từ 67,000đ)

## 🔄 Cập nhật runtime (không cần deploy)

Nếu cần cập nhật tạm thời mà không deploy lại:

```javascript
// Trong browser console
bundleProductsService.updateHardcodedProducts([
    { id: 133, name: "...", price: 42000, ... },
    { id: 134, name: "...", price: 47000, ... }
]);
```

**Lưu ý:** Cập nhật này chỉ tồn tại trong session hiện tại, refresh page sẽ mất.

## 📊 Performance Metrics

- **Trước (API call):** ~200-500ms
- **Sau (Hardcoded):** ~0ms (instant)
- **Cải thiện:** 100x nhanh hơn

## ⚠️ Lưu ý quan trọng

1. **Đồng bộ dữ liệu:** Khi thay đổi giá/tên sản phẩm trong database, nhớ cập nhật lại hardcoded data
2. **Cache browser:** Sau khi cập nhật, user cần hard refresh (Ctrl+F5) để thấy thay đổi
3. **Backup:** Luôn backup dữ liệu cũ trước khi thay đổi

## 🛠️ Troubleshooting

**Q: Sản phẩm không hiển thị?**
- Kiểm tra `is_active: 1`
- Kiểm tra URL hình ảnh có hợp lệ không

**Q: Giá không đúng?**
- Chạy lại script `get-bundle-products.js` để lấy giá mới nhất
- Cập nhật vào `HARDCODED_PRODUCTS`

**Q: Muốn thêm sản phẩm thứ 3?**
- Thêm ID vào query trong `get-bundle-products.js`
- Chạy script và copy thêm object vào mảng

---

**Last updated:** 2025-02-03  
**Data source:** Turso Database (products table)
