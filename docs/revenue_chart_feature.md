# Biểu Đồ Doanh Thu - Revenue Chart

## Tổng quan
Tính năng biểu đồ doanh thu cho phép so sánh trực quan doanh thu, lợi nhuận và số đơn hàng giữa kỳ hiện tại và kỳ trước.

## Vị trí
- **Trang**: `/public/admin/profit-report.html`
- **URL**: `http://127.0.0.1:5500/public/admin/profit-report.html`

## Tính năng

### 1. Bộ lọc thời gian (4 options)
- **Hôm nay**: So sánh hôm nay vs hôm qua (24 điểm theo giờ)
- **Tuần**: So sánh tuần này vs tuần trước (7 điểm theo ngày)
- **Tháng**: So sánh tháng này vs tháng trước (30 điểm theo ngày)
- **Năm**: So sánh năm nay vs năm trước (12 điểm theo tháng)

### 2. Biểu đồ Line Chart
- **Đường chính** (xanh dương đậm): Kỳ hiện tại
- **Đường so sánh** (xám, đứt nét): Kỳ trước
- **Hover tooltip**: Hiển thị doanh thu, số đơn, lợi nhuận
- **Smooth curve**: Đường cong mượt mà
- **Responsive**: Tự động scale theo màn hình

### 3. Cards so sánh
Hiển thị % thay đổi so với kỳ trước:
- Doanh thu
- Lợi nhuận  
- Đơn hàng

Màu sắc:
- Xanh lá: Tăng (+)
- Đỏ: Giảm (-)

## API Endpoint

### `getRevenueChart`
**Method**: GET  
**URL**: `${CONFIG.API_URL}?action=getRevenueChart&period={period}`

**Parameters**:
- `period`: `today` | `week` | `month` | `year`

**Response**:
```json
{
  "success": true,
  "period": "week",
  "labels": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  "currentPeriod": {
    "revenue": [5000000, 7000000, ...],
    "profit": [1500000, 2100000, ...],
    "orders": [12, 18, ...],
    "total": {
      "revenue": 45000000,
      "profit": 13500000,
      "orders": 105
    }
  },
  "previousPeriod": {
    "revenue": [4500000, 6000000, ...],
    "profit": [1350000, 1800000, ...],
    "orders": [10, 15, ...],
    "total": {
      "revenue": 39000000,
      "profit": 11700000,
      "orders": 87
    }
  },
  "comparison": {
    "revenueChange": 15.4,
    "profitChange": 15.4,
    "ordersChange": 20.7
  }
}
```

## Performance

### Caching
- **TTL**: 5 phút
- Cache riêng cho mỗi period
- Tự động refresh khi hết hạn

### Optimization
- Query database 1 lần cho cả 2 kỳ
- Group data ở backend (không phải frontend)
- Sử dụng Chart.js (lightweight, 60KB)

## Timezone
- Sử dụng `timezone-utils.js` để xử lý VN timezone (UTC+7)
- Tính toán chính xác start/end của mỗi kỳ
- Đảm bảo consistency với các trang khác

## Files liên quan

### Backend
- `worker.js`: Hàm `getRevenueChart()` (line ~4043)

### Frontend
- `public/admin/profit-report.html`: UI biểu đồ
- `public/assets/js/profit-report.js`: Logic biểu đồ
- `public/assets/js/timezone-utils.js`: Xử lý timezone

## UI/UX

### Design
- Minimalist, clean
- Gradient buttons cho period filter
- Smooth animations
- Professional color scheme

### Responsive
- Desktop: Full width chart
- Mobile: Scrollable, touch-friendly

### Accessibility
- Clear labels
- High contrast colors
- Keyboard navigation support

## Testing

### Test cases
1. ✅ Chuyển đổi giữa các period
2. ✅ Hover tooltip hiển thị đúng
3. ✅ Comparison cards cập nhật đúng
4. ✅ Cache hoạt động
5. ✅ Error handling khi API fail
6. ✅ Responsive trên mobile

## Future enhancements
- Export chart as PNG
- Toggle giữa Revenue/Profit/Orders
- Zoom vào khoảng thời gian cụ thể
- Compare custom date ranges
