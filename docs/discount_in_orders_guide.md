# Hướng dẫn sử dụng Mã giảm giá trong Đơn hàng

## 📋 Tổng quan

Hệ thống đã được tích hợp mã giảm giá vào quy trình tạo đơn hàng, cho phép áp dụng các chương trình khuyến mãi trực tiếp khi tạo đơn.

## 🎯 Tính năng

### 1. Thêm mã giảm giá khi tạo đơn hàng

**Vị trí:** Modal "Thêm đơn hàng mới" → Phần "Mã giảm giá" (sau phần Phí vận chuyển)

**Cách sử dụng:**
1. Nhập mã giảm giá vào ô input (VD: GIAM50K)
2. Click nút "Áp dụng"
3. Hệ thống sẽ validate và hiển thị:
   - ✅ **Thành công:** Hiển thị thông tin mã, số tiền giảm
   - ❌ **Lỗi:** Hiển thị lý do không hợp lệ

### 2. Hiển thị trong Tổng quan đơn hàng

Khi áp dụng mã giảm giá, phần "Tổng quan đơn hàng" sẽ hiển thị:

```
Doanh thu:        500,000đ
- Giá vốn:        200,000đ
- Chi phí:         50,000đ
- Phí ship:        25,000đ
- Hoa hồng:        30,000đ
- Mã giảm giá:     50,000đ  ← MỚI
- Thuế:            7,500đ
= Lãi ròng:       137,500đ
```

### 3. Validation tự động

Hệ thống kiểm tra:
- ✅ Mã có tồn tại và đang active
- ✅ Chưa hết hạn (expiry_date)
- ✅ Đã đến ngày bắt đầu (start_date)
- ✅ Đơn hàng đủ giá trị tối thiểu (min_order_amount)
- ✅ Chưa hết lượt sử dụng (max_total_uses)
- ✅ Khách hàng chưa dùng quá số lần cho phép (max_uses_per_customer)
- ✅ Số điện thoại được phép (allowed_customer_phones)

## 🗄️ Cấu trúc Database

### Bảng `orders` - Đã thêm 2 cột:

```sql
discount_code TEXT          -- Mã giảm giá đã áp dụng
discount_amount INTEGER     -- Số tiền được giảm
```

### Bảng `discount_usage` - Tracking lịch sử:

Mỗi khi áp dụng mã, hệ thống tự động insert vào bảng này để:
- Tracking lịch sử sử dụng
- Tự động tăng `usage_count` trong bảng `discounts` (qua trigger)
- Báo cáo hiệu quả chiến dịch

## 💡 Các loại mã giảm giá

### 1. Fixed (Giảm cố định)
```
Ví dụ: GIAM50K
- Giảm: 50,000đ
- Hiển thị: "Giảm 50,000đ"
```

### 2. Percentage (Giảm theo %)
```
Ví dụ: GIAM20
- Giảm: 20%
- Max: 100,000đ
- Hiển thị: "Giảm 20% (tối đa 100,000đ)"
```

### 3. Freeship (Miễn phí ship)
```
Ví dụ: FREESHIP
- Giảm: Bằng phí ship khách trả
- Hiển thị: "Miễn phí vận chuyển"
```

### 4. Gift (Tặng quà)
```
Ví dụ: TANGQUA
- Tặng: Sản phẩm X
- Hiển thị: "Tặng [Tên sản phẩm]"
```

## 📊 Công thức tính toán

### Tổng tiền đơn hàng:
```javascript
total_amount = (product_total + shipping_fee) - discount_amount
```

### Lãi ròng:
```javascript
profit = total_amount 
         - product_cost 
         - packaging_cost 
         - shipping_cost 
         - commission 
         - discount_amount  // ← Đã tính vào
         - tax
```

## 🔄 Luồng xử lý

### Khi tạo đơn hàng có mã giảm giá:

1. **Frontend (orders.js):**
   - Validate mã qua API `validateDiscount`
   - Tính discount_amount
   - Hiển thị preview real-time
   - Gửi discount_code + discount_amount + discount_id khi submit

2. **Backend (worker.js):**
   - Lưu discount_code + discount_amount vào bảng `orders`
   - Insert vào bảng `discount_usage` (nếu có discount_id)
   - Trigger tự động tăng `usage_count` trong bảng `discounts`

3. **Hiển thị:**
   - Danh sách đơn hàng: Hiển thị icon/badge nếu có mã
   - Modal phân tích lãi/lỗ: Hiển thị dòng "Mã giảm giá"
   - Báo cáo: Tính toán profit đã trừ discount

## 🎨 UI/UX

### Thiết kế:
- **Màu sắc:** Gradient purple-pink (phù hợp với theme giảm giá)
- **Icon:** Tag icon (biểu tượng mã giảm giá)
- **States:**
  - Loading: Spinner + "Đang kiểm tra..."
  - Success: Green checkmark + thông tin mã
  - Error: Red alert + lý do lỗi

### Vị trí:
- Sau phần "Phí vận chuyển"
- Trước phần "Ghi chú đơn hàng"
- Lý do: Liên quan đến tiền, ảnh hưởng tổng tiền cuối

## 📝 Lưu ý

1. **Không cần ALTER TABLE nếu đã chạy migration 026**
2. **Discount_amount luôn là số dương** (số tiền được giảm)
3. **Total_amount đã bao gồm giảm giá** (giá sau giảm)
4. **Công thức giá gốc:** `original_amount = total_amount + discount_amount`
5. **Trigger tự động:** Không cần manually update usage_count

## 🚀 Migration đã chạy

```bash
# File: database/migrations/026_add_discount_to_orders.sql
# Status: ✅ Đã chạy thành công trên remote database "vdt"
# Date: 2024-11-21
# Queries: 9 executed, 14 rows written
```

## 🔗 API Endpoints

### Validate Discount
```
GET /api?action=validateDiscount&code=GIAM50K&customerPhone=0123456789&orderAmount=500000
```

**Response:**
```json
{
  "success": true,
  "discount": {
    "id": 1,
    "code": "GIAM50K",
    "title": "Giảm 50K cho đơn từ 300K",
    "type": "fixed",
    "discount_value": 50000,
    ...
  }
}
```

## 📞 Hỗ trợ

Nếu có vấn đề:
1. Kiểm tra console log (F12)
2. Xem file: `docs/discount_system_guide.md`
3. Kiểm tra bảng `discount_usage` để xem lịch sử
