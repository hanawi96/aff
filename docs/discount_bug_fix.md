# Bug Fix: Discount không được lưu vào database

## 🐛 Vấn đề

Khi tạo đơn hàng có mã giảm giá:
- Frontend hiển thị đúng: `99.000đ` (đã trừ discount)
- Database lưu sai: `104.000đ` (chưa trừ discount)
- Danh sách đơn hàng hiển thị sai: `104.000đ`

## 🔍 Nguyên nhân

### 1. Frontend gửi đúng data:
```javascript
{
  "totalAmount": 99000,        // ✅ Đã trừ discount
  "discountCode": "GG5K",      // ✅ Có gửi
  "discountAmount": 5000,      // ✅ Có gửi
  "discountId": 6              // ✅ Có gửi
}
```

### 2. Backend transform data nhưng QUÊN copy discount:
```javascript
// ❌ SAI - Thiếu discount fields
const orderData = {
    orderId: 'DH' + Date.now(),
    customer: data.customer,
    cart: data.products,
    totalAmount: data.totalAmount,
    // ... các field khác
    // ❌ THIẾU: discountCode, discountAmount, discountId
};
```

### 3. Kết quả trong database:
```sql
discount_code = NULL
discount_amount = 0
```

### 4. Trigger tính total_amount:
```sql
total_amount = SUM(items) + shipping_fee - discount_amount
             = 74.000 + 30.000 - 0  -- discount_amount = 0!
             = 104.000đ  -- ❌ SAI!
```

## ✅ Giải pháp

### Fix trong worker.js (dòng 294-318):

**TRƯỚC:**
```javascript
const orderData = {
    orderId: 'DH' + Date.now(),
    customer: data.customer,
    cart: data.products,
    totalAmount: data.totalAmount,
    paymentMethod: data.paymentMethod,
    status: data.status,
    referralCode: data.referralCode,
    notes: data.notes,
    shippingFee: data.shippingFee || 0,
    shippingCost: data.shippingCost || 0,
    // Address 4 levels
    province_id: data.province_id,
    // ...
};
```

**SAU:**
```javascript
const orderData = {
    orderId: 'DH' + Date.now(),
    customer: data.customer,
    cart: data.products,
    totalAmount: data.totalAmount,
    paymentMethod: data.paymentMethod,
    status: data.status,
    referralCode: data.referralCode,
    notes: data.notes,
    shippingFee: data.shippingFee || 0,
    shippingCost: data.shippingCost || 0,
    // ✅ THÊM: Discount data
    discountCode: data.discountCode || null,
    discountAmount: data.discountAmount || 0,
    discountId: data.discountId || null,
    // Address 4 levels
    province_id: data.province_id,
    // ...
};
```

## 🔄 Luồng hoạt động SAU KHI FIX

```
1. Frontend tính:
   totalAmount = 74.000 + 30.000 - 5.000 = 99.000đ
   
2. Frontend gửi:
   {
     totalAmount: 99000,
     discountCode: "GG5K",
     discountAmount: 5000,
     discountId: 6
   }
   
3. Backend transform (✅ ĐÃ FIX):
   orderData = {
     ...data,
     discountCode: "GG5K",      // ✅ Copy từ data
     discountAmount: 5000,      // ✅ Copy từ data
     discountId: 6              // ✅ Copy từ data
   }
   
4. Backend INSERT vào orders:
   discount_code = "GG5K"       // ✅ Có giá trị
   discount_amount = 5000       // ✅ Có giá trị
   
5. Trigger tính total_amount:
   total_amount = 74.000 + 30.000 - 5.000 = 99.000đ  // ✅ ĐÚNG!
   
6. Hiển thị danh sách:
   "99.000đ"  // ✅ ĐÚNG!
```

## 📝 Files đã sửa

1. **worker.js** (dòng 294-318)
   - Thêm 3 dòng copy discount data

2. **Đã deploy:**
   - Version: 511272e5-cc5c-4500-9afb-d23a0476af70
   - Date: 2024-11-21

## ✅ Kết quả

- ✅ Discount được lưu đúng vào database
- ✅ Trigger tính total_amount chính xác
- ✅ Danh sách đơn hàng hiển thị đúng số tiền
- ✅ Modal phân tích lãi/lỗ chính xác
- ✅ Báo cáo thống kê đúng

## 🧪 Test

Tạo đơn hàng mới với mã giảm giá:
- Sản phẩm: 74.000đ
- Phí ship: 30.000đ
- Mã GG5K: -5.000đ
- **Kỳ vọng:** 99.000đ
- **Kết quả:** ✅ 99.000đ

## 📚 Bài học

**Khi transform data giữa các layer:**
1. ✅ Luôn copy TẤT CẢ fields cần thiết
2. ✅ Kiểm tra kỹ data structure
3. ✅ Test với data thực tế
4. ✅ Log để debug dễ dàng

**Root cause:**
- Không phải logic tính toán sai
- Không phải trigger sai
- Mà là **data transformation thiếu fields**
