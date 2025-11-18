# 🔥 Tính năng Thêm nhanh Sản phẩm Bán chạy

## 📋 Tổng quan
Đã tạo box hiển thị 6 sản phẩm bán chạy nhất để thêm nhanh vào đơn hàng.

## ✅ Tính năng

### 1. **Box Sản phẩm Bán chạy**
- Hiển thị top 6 sản phẩm có `purchases` cao nhất
- Layout: 3 hàng x 2 cột (grid 2 columns)
- Thiết kế gradient cam-đỏ nổi bật
- Icon 🔥 và badge "Top 6"

### 2. **Card Sản phẩm**
Mỗi card bao gồm:
- **Avatar**: Chữ cái đầu của tên sản phẩm
- **Tên sản phẩm**: Line-clamp 2 dòng
- **Giá bán**: Màu xanh lá, font bold
- **Số lượng đã bán**: Badge cam với icon 🔥
- **Điều chỉnh số lượng**: Nút +/- và input
- **Nút Thêm**: Gradient cam-đỏ

### 3. **Tương tác**
- Click vào card: Thêm sản phẩm với số lượng 1
- Điều chỉnh số lượng: Dùng nút +/- hoặc nhập trực tiếp
- Click "Thêm": Thêm với số lượng đã chọn
- Sau khi thêm: Reset số lượng về 1

## 📁 Files đã tạo

### `public/assets/js/best-selling-products.js`
File JavaScript chứa toàn bộ logic:
- `loadBestSellingProducts()` - Load top 6 sản phẩm
- `renderBestSellingProductsBox()` - Render HTML box
- `createQuickProductCard()` - Tạo card sản phẩm
- `quickAddProduct()` - Thêm sản phẩm vào giỏ
- `incrementQuickQty()` / `decrementQuickQty()` - Điều chỉnh số lượng

## 🔧 Cách tích hợp vào Modal

### Bước 1: Thêm script vào orders.html
```html
<!-- Thêm trước thẻ </body> -->
<script src="../assets/js/best-selling-products.js"></script>
```

### Bước 2: Thêm box vào modal
Trong modal "Thêm đơn hàng mới", thêm code sau **TRƯỚC** phần "Danh sách sản phẩm":

```javascript
// Trong hàm tạo modal (ví dụ: showCreateOrderModal)
const modalHTML = `
    <div class="modal-content">
        <!-- ... Thông tin đơn hàng ... -->
        
        <!-- ✨ THÊM BOX NÀY ✨ -->
        <div id="bestSellingBox"></div>
        
        <!-- Danh sách sản phẩm -->
        <div class="product-list">
            ...
        </div>
    </div>
`;

// Sau khi modal được render, load box
document.getElementById('bestSellingBox').innerHTML = renderBestSellingProductsBox();
```

### Bước 3: Kết nối với giỏ hàng
Đảm bảo có một trong các hàm sau để thêm sản phẩm:

**Option 1**: Hàm global
```javascript
function addProductToCart(product) {
    // Logic thêm sản phẩm vào giỏ
    currentOrderProducts.push(product);
    updateCartDisplay();
}
```

**Option 2**: Hàm window
```javascript
window.addToOrderCart = function(product) {
    // Logic thêm sản phẩm vào giỏ
    currentOrderProducts.push(product);
    updateCartDisplay();
};
```

## 🎨 Thiết kế

### Colors
- **Background**: Gradient từ orange-50 đến red-50
- **Border**: orange-200 (hover: orange-400)
- **Header Icon**: Gradient orange-500 đến red-500
- **Badge**: orange-100 với text orange-700
- **Add Button**: Gradient orange-500 đến red-500

### Layout
```
┌─────────────────────────────────────┐
│ 🔥 Sản phẩm bán chạy        Top 6  │
├─────────────────┬───────────────────┤
│ [Product 1]     │ [Product 2]       │
├─────────────────┼───────────────────┤
│ [Product 3]     │ [Product 4]       │
├─────────────────┼───────────────────┤
│ [Product 5]     │ [Product 6]       │
└─────────────────┴───────────────────┘
```

### Card Structure
```
┌──────────────────────────┐
│ [A] Tên sản phẩm...     │
│                          │
│ 69.000đ          🔥 25   │
│                          │
│ [-] [1] [+]    [+ Thêm]  │
└──────────────────────────┘
```

## 📊 Logic sắp xếp

Sản phẩm được sắp xếp theo:
1. `is_active !== 0` (chỉ lấy sản phẩm đang hoạt động)
2. `purchases > 0` (chỉ lấy sản phẩm đã có bán)
3. Sắp xếp giảm dần theo `purchases`
4. Lấy top 6

## 🔄 Auto-refresh

Box tự động load khi:
- Trang được load (`DOMContentLoaded`)
- Modal được mở (cần gọi `loadBestSellingProducts()`)

## 🐛 Troubleshooting

### Box không hiển thị?
1. Kiểm tra console: `console.log(bestSellingProducts)`
2. Đảm bảo API trả về `purchases` field
3. Kiểm tra có sản phẩm nào có `purchases > 0`

### Không thêm được vào giỏ?
1. Kiểm tra console có lỗi: "Cart function not found"
2. Implement hàm `addProductToCart()` hoặc `window.addToOrderCart()`
3. Đảm bảo hàm nhận đúng format object

### Số lượng không thay đổi?
1. Kiểm tra ID input: `quick-qty-${productId}`
2. Đảm bảo `event.stopPropagation()` được gọi
3. Kiểm tra console có lỗi JavaScript

## 📝 Example Integration

```javascript
// Trong orders.js, khi mở modal thêm đơn hàng
function showCreateOrderModal() {
    // 1. Tạo modal
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal-dialog">
            <h2>Thêm đơn hàng mới</h2>
            
            <!-- Customer info -->
            <div class="customer-section">...</div>
            
            <!-- ✨ Best Selling Products Box ✨ -->
            <div id="bestSellingBox"></div>
            
            <!-- Product list -->
            <div class="product-list">...</div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 2. Load và render box
    loadBestSellingProducts().then(() => {
        document.getElementById('bestSellingBox').innerHTML = renderBestSellingProductsBox();
    });
}

// 3. Implement cart function
function addProductToCart(product) {
    // Thêm vào mảng sản phẩm hiện tại
    currentOrderProducts.push({
        id: product.id,
        name: product.name,
        price: product.price,
        cost_price: product.cost_price,
        quantity: product.quantity,
        size: product.size || null,
        notes: product.notes || null
    });
    
    // Update UI
    renderProductList();
    calculateTotal();
}
```

## 🎯 Kết quả

Sau khi tích hợp, modal sẽ có:
- ✅ Box sản phẩm bán chạy ở trên cùng
- ✅ 6 sản phẩm được hiển thị gọn gàng (3x2)
- ✅ Có thể điều chỉnh số lượng trực tiếp
- ✅ Thêm nhanh chỉ với 1 click
- ✅ Thiết kế đẹp, chuyên nghiệp, nổi bật

---
**Ngày tạo**: 2024-11-18  
**Status**: ✅ Hoàn thành  
**Cần làm**: Tích hợp vào modal trong orders.js
