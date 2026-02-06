# Fix Sắp Xếp Mã Giảm Giá - Tối Ưu UX

## Vấn Đề Cũ
Modal "Tất cả mã giảm giá" sắp xếp không hợp lý:
- Mã áp dụng được: Chỉ sắp theo tiết kiệm nhiều nhất
- Mã chưa đủ: Không có thứ tự rõ ràng
- Không hiển thị "cần mua thêm bao nhiêu"

## Logic Mới

### 1. Sắp Xếp Thông Minh

**Nhóm 1: Mã Áp Dụng Được** (lên đầu)
- Sắp xếp: Tiết kiệm nhiều nhất → ít nhất
- Hiển thị: "💰 Tiết kiệm XXXđ"
- Nút: "Áp dụng ngay" (enabled)

**Nhóm 2: Mã Chưa Đủ Điều Kiện** (xuống cuối)
- Sắp xếp: Cần mua thêm ít nhất → nhiều nhất
- Hiển thị: "Mua thêm XXXđ để được giảm"
- Nút: "Chưa đủ điều kiện" (disabled)

### 2. Công Thức Tính

```javascript
// Mã áp dụng được
isApplicable = orderAmount >= min_order_amount
savings = calculateDiscountAmount(discount, orderAmount)

// Mã chưa đủ
amountNeeded = min_order_amount - orderAmount
```

### 3. Ví Dụ Thực Tế

**Giỏ hàng: 300,000đ**

**Hiển thị theo thứ tự:**
1. ✅ GIAM50K - Giảm 50K (áp dụng được, tiết kiệm 50K)
2. ✅ FREESHIP - Miễn phí ship (áp dụng được, tiết kiệm 30K)
3. ❌ GIAM100K - Mua thêm 200,000đ để được giảm (cần 500K)
4. ❌ GIAM200K - Mua thêm 700,000đ để được giảm (cần 1M)

## Code Changes

### File 1: `public/shop/assets/js/features/checkout/quick-checkout.js`

**Thêm tính toán `amountNeeded`:**
```javascript
.map(d => {
    const isApplicable = !d.min_order_amount || orderAmount >= d.min_order_amount;
    const savings = isApplicable ? discountService.calculateDiscountAmount(d, orderAmount) : 0;
    const amountNeeded = isApplicable ? 0 : (d.min_order_amount - orderAmount);
    return { ...d, isApplicable, savings, amountNeeded };
})
```

**Sắp xếp thông minh:**
```javascript
.sort((a, b) => {
    // Mã áp dụng được lên đầu
    if (a.isApplicable && !b.isApplicable) return -1;
    if (!a.isApplicable && b.isApplicable) return 1;
    
    // Trong nhóm áp dụng được: tiết kiệm nhiều nhất lên đầu
    if (a.isApplicable && b.isApplicable) {
        return b.savings - a.savings;
    }
    
    // Trong nhóm chưa đủ: cần mua thêm ít nhất lên đầu
    return a.amountNeeded - b.amountNeeded;
})
```

**Hiển thị động:**
```javascript
if (code.min_order_amount) {
    const isEnough = orderAmount >= code.min_order_amount;
    const amountNeeded = isEnough ? 0 : (code.min_order_amount - orderAmount);
    
    detailsHtml += '<div class="discount-card-detail">' +
        '<span>' + 
        (isEnough 
            ? 'Đơn tối thiểu: ' + formatPrice(code.min_order_amount)
            : 'Mua thêm ' + formatPrice(amountNeeded) + ' để được giảm'
        ) +
        '</span>' +
        '</div>';
}
```

### File 2: `public/shop/cart.js`

**Logic tương tự** - đã có sẵn trong `getBestDiscounts()`, chỉ cần fix hiển thị:

```javascript
if (code.min_order_amount) {
    const isEnough = state.subtotal >= code.min_order_amount;
    const amountNeeded = isEnough ? 0 : (code.min_order_amount - state.subtotal);
    
    detailsHtml += '<div class="discount-card-detail">' +
        '<span>' + 
        (isEnough 
            ? 'Đơn tối thiểu: ' + utils.formatPrice(code.min_order_amount)
            : 'Mua thêm ' + utils.formatPrice(amountNeeded) + ' để được giảm'
        ) +
        '</span>' +
        '</div>';
}
```

## Lợi Ích UX

### 1. Khách Hàng Thấy Ngay Lợi Ích
- Mã tốt nhất lên đầu
- Biết chính xác tiết kiệm được bao nhiêu
- Không phải scroll tìm mã phù hợp

### 2. Khuyến Khích Mua Thêm
- "Mua thêm 50,000đ để được giảm 100K"
- Tạo động lực tăng giá trị đơn hàng
- Mã gần đạt được hiển thị trước

### 3. Trải Nghiệm Mượt Mà
- Không hiển thị mã không liên quan
- Thứ tự logic, dễ hiểu
- Nút disabled rõ ràng cho mã chưa đủ

## Test Cases

### Case 1: Giỏ 200K
```
✅ GIAM20K (min 100K) - Tiết kiệm 20K
✅ FREESHIP (min 150K) - Tiết kiệm 30K
❌ GIAM50K (min 300K) - Mua thêm 100K
❌ GIAM100K (min 500K) - Mua thêm 300K
```

### Case 2: Giỏ 600K
```
✅ GIAM100K (min 500K) - Tiết kiệm 100K
✅ GIAM50K (min 300K) - Tiết kiệm 50K
✅ FREESHIP (min 150K) - Tiết kiệm 30K
❌ GIAM200K (min 1M) - Mua thêm 400K
```

### Case 3: Giỏ 50K
```
❌ FREESHIP (min 150K) - Mua thêm 100K
❌ GIAM50K (min 300K) - Mua thêm 250K
❌ GIAM100K (min 500K) - Mua thêm 450K
```

## Files Modified
- ✅ `public/shop/assets/js/features/checkout/quick-checkout.js` - Quick checkout modal
- ✅ `public/shop/cart.js` - Cart page modal

## Status
🟢 **COMPLETED** - Mã giảm giá giờ sắp xếp thông minh và hiển thị rõ ràng
