# 🔧 FIX: Tổng Hoa Hồng Hiển Thị 0đ

## ❌ VẤN ĐỀ

Ở trang danh sách đơn hàng, phần "Tổng hoa hồng" hiển thị **0đ** mặc dù có đơn hàng từ CTV.

## 🔍 NGUYÊN NHÂN

Sau khi đơn giản hóa query `getRecentOrders` (bỏ JOIN với order_items), API không trả về `product_total` nữa.

**Code cũ:**
```javascript
// ❌ SAI: product_total = undefined
const totalCommission = allOrdersData.reduce((sum, order) => {
    if (order.referral_code && order.ctv_commission_rate !== undefined) {
        const productTotal = order.product_total || 0;  // ❌ undefined!
        return sum + Math.round(productTotal * order.ctv_commission_rate);
    }
    return sum + (order.commission || 0);
}, 0);
```

**Kết quả:**
- `product_total` = `undefined`
- `productTotal` = 0
- `commission` = 0 × commission_rate = **0đ** ❌

## ✅ GIẢI PHÁP

Tính `product_total` từ `total_amount - shipping_fee`:

**Công thức:**
```
product_total = total_amount - shipping_fee
commission = product_total × ctv_commission_rate
```

**Lý do:** 
- `total_amount` = giá sản phẩm + phí ship (trigger đã tính)
- Commission chỉ tính trên giá sản phẩm (không tính trên phí ship)
- Vì vậy: `product_total = total_amount - shipping_fee`

## 📝 CHI TIẾT THAY ĐỔI

### 1. Function `updateStats` (dòng ~270)

**TRƯỚC:**
```javascript
const totalCommission = allOrdersData.reduce((sum, order) => {
    if (order.referral_code && order.ctv_commission_rate !== undefined) {
        const productTotal = order.product_total || 0;  // ❌ undefined
        return sum + Math.round(productTotal * order.ctv_commission_rate);
    }
    return sum + (order.commission || 0);
}, 0);
```

**SAU:**
```javascript
const totalCommission = allOrdersData.reduce((sum, order) => {
    if (order.referral_code && order.ctv_commission_rate !== undefined) {
        // ✅ Tính product_total từ total_amount - shipping_fee
        const totalAmount = order.total_amount || 0;
        const shippingFee = order.shipping_fee || 0;
        const productTotal = totalAmount - shippingFee;
        return sum + Math.round(productTotal * order.ctv_commission_rate);
    }
    return sum + (order.commission || 0);
}, 0);
```

### 2. Function `createOrderRow` (dòng ~450)

**TRƯỚC:**
```javascript
let displayCommission = order.commission || 0;
if (order.referral_code && order.ctv_commission_rate !== undefined) {
    const productTotal = order.product_total || 0;  // ❌ undefined
    displayCommission = Math.round(productTotal * order.ctv_commission_rate);
}
```

**SAU:**
```javascript
let displayCommission = order.commission || 0;
if (order.referral_code && order.ctv_commission_rate !== undefined) {
    // ✅ Tính product_total từ total_amount - shipping_fee
    const totalAmount = order.total_amount || 0;
    const shippingFee = order.shipping_fee || 0;
    const productTotal = totalAmount - shippingFee;
    displayCommission = Math.round(productTotal * order.ctv_commission_rate);
}
```

### 3. Function `calculateOrderTotals` (dòng ~29)

**TRƯỚC:**
```javascript
function calculateOrderTotals(order) {
    if (order.product_total !== undefined) {
        return {
            totalAmount: order.product_total || 0,  // ❌ undefined
            productCost: order.product_cost || 0
        };
    }
    // ...
}
```

**SAU:**
```javascript
function calculateOrderTotals(order) {
    // ✅ Tính product_total từ total_amount - shipping_fee
    const orderTotalAmount = order.total_amount || 0;
    const shippingFee = order.shipping_fee || 0;
    const productTotal = orderTotalAmount - shippingFee;
    
    if (order.product_cost !== undefined) {
        return {
            totalAmount: productTotal,
            productCost: order.product_cost || 0
        };
    }
    // ...
}
```

### 4. Các chỗ tính revenue (nhiều chỗ)

**TRƯỚC:**
```javascript
const totalRevenue = orders.reduce((sum, order) => {
    const productTotal = order.product_total || 0;  // ❌ undefined
    const shippingFee = order.shipping_fee || 0;
    return sum + productTotal + shippingFee;
}, 0);
```

**SAU:**
```javascript
const totalRevenue = orders.reduce((sum, order) => {
    // ✅ Dùng total_amount trực tiếp (đã bao gồm products + ship)
    return sum + (order.total_amount || 0);
}, 0);
```

## 🎯 KẾT QUẢ

### Trước Fix:
- Tổng hoa hồng: **0đ** ❌
- Hoa hồng từng đơn: **0đ** ❌

### Sau Fix:
- Tổng hoa hồng: **Hiển thị đúng** ✅
- Hoa hồng từng đơn: **Hiển thị đúng** ✅

**Ví dụ:**
- Đơn hàng: 39k sản phẩm + 30k ship = 69k
- Commission rate: 10%
- Commission = 39k × 10% = **3,900đ** ✅

## 📊 SUMMARY

**Root Cause:**
- API không trả về `product_total` sau khi đơn giản hóa query
- Code vẫn dùng `order.product_total` → undefined → commission = 0

**Solution:**
- Tính `product_total = total_amount - shipping_fee`
- Áp dụng cho tất cả chỗ tính commission

**Files Changed:**
- `public/assets/js/orders.js` - 5 chỗ sửa

**Impact:**
- ✅ Fix bug tổng hoa hồng hiển thị 0đ
- ✅ Fix bug hoa hồng từng đơn hiển thị 0đ
- ✅ Consistent với logic backend
- ✅ Không cần thay đổi API

**Status:** ✅ COMPLETED

---

**Date:** 2024-11-16  
**Fixed by:** Kiro AI
