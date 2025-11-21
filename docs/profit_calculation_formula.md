# Công thức tính toán Lãi/Lỗ đơn hàng

## 📊 Cấu trúc hiển thị (ĐÚNG - Mã giảm giá trong Doanh thu)

```
┌─────────────────────────────────────────┐
│ TỔNG TIỀN                     99.000đ   │ ← Số tiền khách trả (sau giảm)
│ Sản phẩm + Phí ship    74.000đ + 30.000đ│
└─────────────────────────────────────────┘

CHI TIẾT:

Doanh thu                       99.000đ   ← Có thể mở rộng xem chi tiết
  • Sản phẩm                    74.000đ
  • Phí ship khách trả          30.000đ
  • Mã giảm giá                 -5.000đ   ← Trừ vào doanh thu (màu tím)

CHI PHÍ:
- Giá vốn                       39.500đ
- Chi phí                       12.150đ   ← Có thể mở rộng xem chi tiết
  • Dây đỏ + Công                2.150đ
  • Đóng gói                    10.000đ
- Phí ship thực tế              25.000đ
- Hoa hồng                       7.900đ

= Doanh thu sau chi phí         14.450đ   ← Doanh thu - Chi phí

- Thuế (1.5%)                    1.485đ

┌─────────────────────────────────────────┐
│ LÃI RÒNG                      12.965đ   │
│                              (13.1%)    │
└─────────────────────────────────────────┘
```

## 🧮 Công thức chi tiết

### 1. Doanh thu (Revenue) - ĐÃ BAO GỒM GIẢM GIÁ
```javascript
revenue = productTotal + shippingFee - discountAmount
```

**Ví dụ:**
- Sản phẩm: 74.000đ
- Phí ship khách trả: 30.000đ
- Mã giảm giá: -5.000đ (trừ vào doanh thu, KHÔNG phải chi phí)
- **Doanh thu = 74.000 + 30.000 - 5.000 = 99.000đ**

**Lưu ý quan trọng:**
- Mã giảm giá là **giảm doanh thu**, không phải chi phí
- Doanh thu = Số tiền thực tế thu được từ khách
- Hiển thị trong breakdown của Doanh thu với dấu trừ (-5.000đ)

### 2. Tổng chi phí
```javascript
totalCosts = productCost + packagingCost + shippingCost + commission
```

**Ví dụ:**
- Giá vốn: 39.500đ
- Chi phí đóng gói: 12.150đ
- Phí ship thực tế: 25.000đ
- Hoa hồng CTV: 7.900đ
- **Tổng chi phí = 39.500 + 12.150 + 25.000 + 7.900 = 84.550đ**

### 3. Doanh thu sau chi phí (trước thuế)
```javascript
revenueAfterCosts = revenue - totalCosts
```

**Ví dụ:**
- Doanh thu: 99.000đ
- Tổng chi phí: 84.550đ
- **Doanh thu sau chi phí = 99.000 - 84.550 = 14.450đ**

### 4. Thuế
```javascript
tax = Math.round(revenue * taxRate)
// taxRate mặc định = 1.5% = 0.015
```

**Ví dụ:**
- Doanh thu: 99.000đ
- Thuế suất: 1.5%
- **Thuế = 99.000 × 0.015 = 1.485đ ≈ 1.560đ** (làm tròn)

### 5. Lãi ròng (Net Profit)
```javascript
profit = revenueAfterCosts - tax
// hoặc
profit = revenue - productCost - packagingCost - shippingCost - commission - tax
```

**Ví dụ:**
- Doanh thu sau chi phí: 14.450đ
- Thuế: 1.560đ
- **Lãi ròng = 14.450 - 1.560 = 12.890đ**

### 6. Tỷ suất lợi nhuận (Profit Margin)
```javascript
profitMargin = (profit / revenue) × 100
```

**Ví dụ:**
- Lãi ròng: 12.890đ
- Doanh thu: 99.000đ
- **Tỷ suất = (12.890 / 99.000) × 100 = 13.0%**

## 📝 Lưu ý quan trọng

### 1. Mã giảm giá - QUAN TRỌNG!
- **KHÔNG phải chi phí** - Là giảm doanh thu
- Hiển thị trong breakdown của "Doanh thu" (có thể collapse)
- Có dấu trừ (-5.000đ) và màu tím để phân biệt
- **Đã trừ vào revenue** - Không trừ lại khi tính "Doanh thu sau chi phí"
- Về mặt kế toán: Giảm giá = Giảm thu nhập, không phải tăng chi phí

### 2. Phí ship
- **Phí ship khách trả:** Cộng vào doanh thu (thu từ khách)
- **Phí ship thực tế:** Trừ vào chi phí (trả cho đơn vị vận chuyển)
- **Lãi từ ship:** shippingFee - shippingCost

### 3. Thuế
- Tính trên **doanh thu** (sau giảm giá)
- Không tính trên lãi
- Thuế suất có thể thay đổi trong settings

### 4. Hoa hồng CTV
- Tính trên **giá trị sản phẩm** (không bao gồm ship)
- Tỷ lệ % lấy từ thông tin CTV
- Chỉ áp dụng khi có mã CTV

## 🎯 Ví dụ đầy đủ

**Đơn hàng:**
- 2 sản phẩm: 37.000đ × 2 = 74.000đ
- Phí ship khách trả: 30.000đ
- Mã giảm giá GG5K: -5.000đ
- Mã CTV (10%): CTV001

**Chi phí:**
- Giá vốn: 19.750đ × 2 = 39.500đ
- Đóng gói: 12.150đ
- Ship thực tế: 25.000đ
- Hoa hồng: 74.000 × 10% = 7.400đ
- Thuế: 99.000 × 1.5% = 1.485đ

**Tính toán:**
```
Doanh thu = 74.000 + 30.000 - 5.000 = 99.000đ

Chi phí:
  - Giá vốn:        39.500đ
  - Đóng gói:       12.150đ
  - Ship thực tế:   25.000đ
  - Hoa hồng:        7.400đ
  ─────────────────────────
  Tổng chi phí:     84.050đ

Doanh thu sau chi phí = 99.000 - 84.050 = 14.950đ

- Thuế:             1.485đ
─────────────────────────
Lãi ròng:          13.465đ (13.6%)
```

## 🔍 Debug & Verify

Để kiểm tra tính toán đúng:
1. Mở Console (F12)
2. Xem log khi tạo đơn hàng
3. Verify từng bước:
   - Product total
   - Revenue (after discount)
   - Each cost component
   - Revenue after costs
   - Tax
   - Final profit

## 📱 UI Elements

**IDs quan trọng:**
- `orderTotalAmount` - Tổng tiền (revenue)
- `profitRevenue` - Doanh thu
- `profitProductTotal` - Tổng sản phẩm
- `profitShippingFee` - Phí ship khách trả
- `profitCost` - Giá vốn
- `profitPackaging` - Chi phí đóng gói
- `profitShipping` - Phí ship thực tế
- `profitCommission` - Hoa hồng
- `profitDiscount` - Mã giảm giá
- `profitRevenueAfterCosts` - Doanh thu sau chi phí ← MỚI
- `profitTax` - Thuế
- `profitAmount` - Lãi ròng
- `profitMargin` - Tỷ suất lợi nhuận
