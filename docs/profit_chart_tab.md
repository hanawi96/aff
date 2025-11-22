# Biểu đồ Lợi nhuận - Tab mới trong Trang Thống kê

## 📊 Tổng quan

Đã thêm tab **Lợi nhuận** vào trang thống kê (`profit-report.html`) để phân tích chi tiết lợi nhuận ròng theo thời gian.

## ✨ Tính năng

### 1. Tab Navigation (3 tabs)
- **📈 Doanh thu**: So sánh doanh thu kỳ này vs kỳ trước
- **💰 Lợi nhuận**: Phân tích lợi nhuận ròng (MỚI)
- **📦 Đơn hàng**: Xu hướng đơn hàng theo thời gian

### 2. Biểu đồ Lợi nhuận
- Line chart so sánh lợi nhuận kỳ hiện tại vs kỳ trước
- Màu xanh lá (emerald) - biểu thị lợi nhuận
- Gradient background: emerald-to-green
- Hiển thị theo: giờ (today), ngày (week/month), tháng (year)

### 3. Comparison Cards (3 thẻ)

#### Card 1: Lợi nhuận ròng
- % thay đổi so với kỳ trước
- Màu xanh nếu tăng, đỏ nếu giảm

#### Card 2: Tỷ suất lợi nhuận
- Profit Margin = (Lợi nhuận / Doanh thu) × 100%
- Màu coding:
  - ≥30%: emerald (xuất sắc)
  - ≥15%: green (tốt)
  - <15%: yellow (cần cải thiện)

#### Card 3: Lợi nhuận TB/đơn
- Lợi nhuận trung bình mỗi đơn hàng
- Màu xanh nếu dương, đỏ nếu âm

## 🧮 Công thức tính Lợi nhuận ròng

```javascript
Lợi nhuận ròng = Doanh thu - Tổng chi phí

Trong đó:
- Doanh thu = product_total + shipping_fee - discount_amount
- Tổng chi phí = product_cost + shipping_cost + packaging_cost + commission + tax_amount
```

### Chi tiết các khoản chi phí:
- `product_cost`: Giá vốn sản phẩm
- `shipping_cost`: Chi phí vận chuyển thực tế
- `packaging_cost`: Chi phí đóng gói (túi, hộp, dây, thiệp, giấy)
- `commission`: Hoa hồng CTV
- `tax_amount`: Thuế

## 🔧 Implementation

### Backend API
- Sử dụng API `getRevenueChart` (đã có sẵn)
- API này đã tính sẵn profit data:
  - `currentPeriod.profit[]`
  - `previousPeriod.profit[]`
  - `comparison.profitChange`

### Frontend Files
- **HTML**: `public/admin/profit-report.html`
  - Thêm tab button "Lợi nhuận"
  - Thêm `profitTabContent` section
  
- **JavaScript**: `public/assets/js/profit-report.js`
  - `loadProfitChart()`: Load dữ liệu
  - `renderProfitChart()`: Render biểu đồ Chart.js
  - `updateProfitComparisonCards()`: Update 3 thẻ comparison
  - `switchChartTab()`: Xử lý chuyển tab

## 🎨 Thiết kế

### Màu sắc
- Primary: Emerald (#10B981)
- Gradient: emerald-50 to green-50
- Border active: emerald-600
- Text: emerald-600/700

### Icons
- SVG icon: Dollar sign trong vòng tròn
- Consistent với các tab khác

## 📱 Responsive
- Tabs flex layout, tự động điều chỉnh
- Chart responsive với Chart.js
- Cards grid 3 cột, collapse trên mobile

## 🚀 Cách sử dụng

1. Truy cập trang thống kê: `/admin/profit-report.html`
2. Click tab **"Lợi nhuận"**
3. Xem biểu đồ và 3 thẻ comparison
4. Hover vào điểm trên biểu đồ để xem chi tiết:
   - Lợi nhuận kỳ này/kỳ trước
   - Số đơn hàng
   - Doanh thu
   - Tỷ suất lợi nhuận

## ⚡ Performance

- **Caching**: Dữ liệu được cache 5 phút (TTL)
- **Lazy loading**: Chỉ load chart khi user click vào tab
- **Reuse data**: Dùng chung cache với tab Doanh thu

## 🎯 Lợi ích

1. **Tiết kiệm không gian**: 3 biểu đồ trong 1 container
2. **Phân tích sâu**: Focus vào lợi nhuận ròng
3. **So sánh dễ dàng**: Kỳ này vs kỳ trước
4. **Insight nhanh**: 3 metrics quan trọng ngay đầu
5. **UX tốt**: Tab switching mượt mà, trực quan

## 📝 Notes

- Tab "Lợi nhuận" không hiển thị khi chọn period "Tất cả" (vì không có comparison)
- Dữ liệu được tính theo timezone VN (UTC+7)
- Chart height: 80px (consistent với các tab khác)
