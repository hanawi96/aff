# Quick Checkout CTV Fix - Lưu Thông Tin CTV Vào Database

## Vấn Đề
Khi đặt hàng từ modal "Mua ngay" (Quick Checkout), các cột CTV trong bảng orders không được lưu:
- `referral_code`: NULL
- `commission`: 0
- `commission_rate`: 0
- `ctv_phone`: NULL

## Nguyên Nhân

### 1. Quick Checkout không gọi CTV tracking
File `quick-checkout.js` không import và gọi `getCTVInfoForOrder()` để lấy thông tin CTV từ cookie.

### 2. Backend hardcode NULL
File `order.service.js` hardcode các giá trị CTV thành `null` và `0` thay vì đọc từ request data.

## Các Thay Đổi

### File 1: `public/shop/assets/js/features/checkout/quick-checkout.js`

**Thêm import:**
```javascript
import { getCTVInfoForOrder, calculateCommission } from '../../shared/utils/ctv-tracking.js';
```

**Thêm logic lấy CTV info trong hàm `submit()` (trước khi prepare orderData):**
```javascript
// Get CTV info from cookie (if exists)
console.log('📞 [Quick Checkout] Getting CTV info...');
const ctvInfo = await getCTVInfoForOrder();
console.log('📦 [Quick Checkout] CTV Info:', ctvInfo);

// Calculate commission if CTV exists
let commission = 0;
let commissionRate = 0;
let referralCode = null;
let ctvPhone = null;

if (ctvInfo) {
    // Commission = (total - shipping) × rate
    const revenue = totalAmount - shippingFee;
    commission = calculateCommission(totalAmount, shippingFee, ctvInfo.commissionRate);
    commissionRate = ctvInfo.commissionRate;
    referralCode = ctvInfo.referralCode;
    ctvPhone = ctvInfo.ctvPhone;
    
    console.log('💰 [Quick Checkout] Commission calculated:', {
        revenue,
        rate: commissionRate,
        commission,
        referralCode,
        ctvPhone
    });
} else {
    console.log('ℹ️ [Quick Checkout] No CTV tracking found');
}
```

**Cập nhật orderData:**
```javascript
const orderData = {
    // ... other fields ...
    referralCode: referralCode,
    referral_code: referralCode,
    commission: commission,
    commission_rate: commissionRate,
    ctv_phone: ctvPhone,
    // ... rest of fields ...
};
```

### File 2: `public/shop/api/services/order.service.js`

**Trước:**
```javascript
orderDate,
0, // is_priority
null, // referral_code (shop orders don't have CTV)
0, // commission
0, // commission_rate
null, // ctv_phone
packagingDetails.total_cost,
```

**Sau:**
```javascript
orderDate,
0, // is_priority
data.referral_code || data.referralCode || null,
data.commission || 0,
data.commission_rate || 0,
data.ctv_phone || null,
packagingDetails.total_cost,
```

## Cách Test

### 1. Truy cập link CTV
```
http://127.0.0.1:5500/public/shop/index.html?ref=CTV009726
```

### 2. Kiểm tra CTV Debug Panel
- Nút tròn màu tím "CTV" xuất hiện góc dưới phải
- Click để mở panel
- Xác nhận thấy:
  - ✅ Cookie: CTV009726
  - Tên CTV: Yên
  - SĐT: 0386190596
  - Tỷ lệ: 7%

### 3. Đặt hàng qua Modal Mua Ngay
1. Click "Mua ngay" trên bất kỳ sản phẩm nào
2. Điền đầy đủ thông tin:
   - Họ tên
   - Số điện thoại
   - Cân nặng bé (nếu cần)
   - Địa chỉ đầy đủ
3. Click "Đặt hàng"

### 4. Kiểm tra Console Logs
Bạn sẽ thấy:
```
📞 [Quick Checkout] Getting CTV info...
📦 [Quick Checkout] CTV Info: {referralCode: "CTV009726", commissionRate: 0.07, ...}
💰 [Quick Checkout] Commission calculated: {
    revenue: 470000,
    rate: 0.07,
    commission: 32900,
    referralCode: "CTV009726",
    ctvPhone: "0386190596"
}
```

### 5. Kiểm tra Database
Vào admin panel → Orders, xem đơn hàng vừa tạo:
- `referral_code`: CTV009726 ✅
- `commission`: 32900 ✅
- `commission_rate`: 0.07 ✅
- `ctv_phone`: 0386190596 ✅

## Công Thức Tính Hoa Hồng

```
Commission = (Total Amount - Shipping Fee) × Commission Rate
```

**Ví dụ:**
- Tổng đơn hàng: 500,000đ
- Phí ship: 30,000đ
- Tỷ lệ hoa hồng: 7%
- **Hoa hồng = (500,000 - 30,000) × 0.07 = 32,900đ**

## Lưu Ý

### Cookie Hoạt Động Toàn Site
- Cookie `vdt_ctv_ref` hoạt động trên tất cả các trang
- Thời hạn: 7 ngày
- Khi click link CTV mới → ghi đè cookie cũ

### Áp Dụng Cho Cả 2 Cách Đặt Hàng
1. ✅ **Modal Mua Ngay** (Quick Checkout) - VỪA FIX
2. ✅ **Trang Giỏ Hàng** (Cart Page) - ĐÃ CÓ SẴN

### Discount Không Ảnh Hưởng Hoa Hồng
- Hoa hồng tính trên tổng đơn hàng GỐC (trước giảm giá)
- Chỉ trừ phí ship

## Files Đã Sửa
- ✅ `public/shop/assets/js/features/checkout/quick-checkout.js` - Thêm CTV tracking
- ✅ `public/shop/api/services/order.service.js` - Đọc CTV data từ request

## Status
🟢 **READY TO TEST** - Quick checkout giờ đã lưu đầy đủ thông tin CTV vào database
