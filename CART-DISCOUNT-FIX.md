# Fix Mã Giảm Giá Trang Giỏ Hàng

## Vấn Đề
Phần "Mã khả dụng cho mẹ" ở trang giỏ hàng hiển thị "Không có mã giảm giá khả dụng" mặc dù có mã.

## Nguyên Nhân
`cart.loadAvailableDiscounts()` được gọi nhưng không `await`, dẫn đến:
1. Hàm chạy async trong background
2. `renderAvailableCodes()` được gọi trước khi discounts load xong
3. `state.availableDiscounts` vẫn là `[]` → hiển thị "Không có mã"

## Các Thay Đổi

### 1. Fix Async Loading (cart.js)

**Trước:**
```javascript
// Load available discounts in background (non-blocking)
cart.loadAvailableDiscounts();
```

**Sau:**
```javascript
// Load available discounts (await to ensure it completes)
await cart.loadAvailableDiscounts();
```

### 2. Thêm Dòng Mẹo (cart.html)

```html
<div class="available-codes">
    <p class="codes-title">💝 Mã khả dụng cho mẹ:</p>
    <div class="code-list" id="availableCodes"></div>
    <p class="discount-tip">💡 <strong>Mẹo:</strong> Mua thêm bó dâu tằm để được miễn phí vận chuyển</p>
    <button class="btn-view-all-codes hidden" id="viewAllCodesBtn">
```

### 3. Thêm CSS Style (cart.css)

```css
.discount-tip {
    margin-top: 0.875rem;
    padding: 0.625rem 0.875rem;
    background: linear-gradient(135deg, #fff5e6 0%, #ffe8cc 100%);
    border-left: 3px solid #f4a261;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #5a4a3a;
    line-height: 1.5;
}

.discount-tip strong {
    color: #d97706;
    font-weight: 600;
}
```

## Kết Quả

### Trang Giỏ Hàng
✅ Hiển thị đúng top 3 mã giảm giá tốt nhất
✅ Sắp xếp: Áp dụng được lên đầu, tiết kiệm nhiều nhất
✅ Mã chưa đủ: Hiển thị "Mua thêm Xđ để áp dụng"
✅ Dòng mẹo: "💡 Mẹo: Mua thêm bó dâu tằm để được miễn phí vận chuyển"

### Modal Mua Ngay
✅ Đã có sẵn tất cả tính năng trên
✅ Dòng mẹo đã được thêm trước đó

## Hiển Thị Giống Nhau

Cả 2 nơi giờ đều có:
1. **Top 3 mã tốt nhất** - Sắp xếp thông minh
2. **Tiết kiệm/Mua thêm** - Hiển thị rõ ràng
3. **Dòng mẹo** - Khuyến khích mua thêm
4. **Nút "Xem tất cả"** - Mở modal đầy đủ

## Files Modified
- ✅ `public/shop/cart.js` - Fix async loading
- ✅ `public/shop/cart.html` - Thêm dòng mẹo
- ✅ `public/shop/cart.css` - Thêm style

## Status
🟢 **COMPLETED** - Trang giỏ hàng giờ hiển thị mã giảm giá giống modal mua ngay
