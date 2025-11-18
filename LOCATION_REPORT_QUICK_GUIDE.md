# 📍 Location Report - Quick User Guide

## 🎯 Tính năng chính

### 1. **AI Insights Banner** (Phân tích thông minh)
Tự động hiển thị 5 insights quan trọng nhất:
- 📈 Tăng/giảm doanh thu so với kỳ trước
- 🎯 Tập trung doanh thu (TOP N chiếm X%)
- 👑 Khu vực dẫn đầu
- 💎 Khu vực có giá trị đơn cao
- ⚡ Phát hiện bất thường

### 2. **KPI Cards với So sánh**
4 chỉ số chính với % thay đổi:
- 📦 Tổng đơn hàng
- 💰 Tổng doanh thu
- 👥 Khách hàng
- 📊 Giá trị trung bình

**Màu sắc:**
- 🟢 Xanh = Tăng
- 🔴 Đỏ = Giảm
- ⚪ Xám = Không đổi

### 3. **Time Period Filter**
Chọn khoảng thời gian:
- Hôm nay (so với hôm qua)
- Tuần này (so với tuần trước)
- Tháng này (so với tháng trước)
- Năm nay (so với năm trước)
- Tất cả (không so sánh)

### 4. **Charts**

#### TOP 10 Khu vực (Bar Chart)
- Xếp hạng theo doanh thu
- Màu indigo đồng nhất
- Hover để xem chi tiết

#### Phân bố Doanh thu (Pie Chart)
- Tỷ lệ % của TOP 10
- Màu sắc phân biệt
- Legend ở dưới

#### Xu hướng Doanh thu (Line Chart)
- TOP 5 locations
- 7 ngày gần nhất
- Chọn metric: Revenue/Orders/Customers
- Multi-line comparison

#### Tăng trưởng nhanh (Growth List)
- TOP 5 khu vực tăng mạnh nhất
- Emoji ranking: 🚀⭐✨📈
- % tăng trưởng với badge xanh

### 5. **Data Table**

#### Columns:
1. **Hạng** - 🥇🥈🥉 hoặc số
2. **Tên** - Tỉnh/Quận/Phường
3. **Đơn hàng** - Số lượng
4. **Doanh thu** - Tổng tiền
5. **Khách hàng** - Unique customers
6. **Giá trị TB** - Average order value
7. **% Tổng** - % của tổng doanh thu
8. **Tăng trưởng** - % so với kỳ trước
9. **Thao tác** - Xem chi tiết

#### Features:
- ✅ Sort theo bất kỳ cột nào
- ✅ Search/filter real-time
- ✅ Click để drill-down (Tỉnh → Quận → Phường)
- ✅ Breadcrumb navigation

### 6. **Drill-down Navigation**

#### Level 1: Tỉnh/Thành phố
- Hiển thị 63 tỉnh/TP
- Click để xem quận/huyện

#### Level 2: Quận/Huyện
- Filter theo tỉnh đã chọn
- Click để xem phường/xã
- Breadcrumb: Tỉnh/TP > Quận

#### Level 3: Phường/Xã
- Filter theo quận đã chọn
- Không drill-down thêm
- Breadcrumb: Tỉnh/TP > Quận > Phường

**Quay lại:** Click vào breadcrumb

---

## 🎨 Color Coding

### Growth Indicators
- 🟢 **Green** (↑X%): Tăng trưởng tốt
- 🔴 **Red** (↓X%): Giảm sút
- ⚪ **Gray** (~): Không đổi

### Revenue Percentage
- 🟢 **Green** (>10%): Đóng góp lớn
- 🔵 **Blue** (5-10%): Đóng góp trung bình
- ⚪ **Gray** (<5%): Đóng góp nhỏ

### Ranking
- 🥇 **Gold**: #1
- 🥈 **Silver**: #2
- 🥉 **Bronze**: #3
- 🔢 **Number**: #4+

---

## 💡 Use Cases

### 1. Phát hiện thị trường tiềm năng
**Cách làm:**
1. Chọn "Tất cả" để xem toàn bộ
2. Xem AI Insights → tìm "cơ hội mở rộng"
3. Sort theo "Tăng trưởng" → tìm khu vực tăng nhanh
4. Drill-down để xem chi tiết quận/phường

### 2. Tối ưu marketing budget
**Cách làm:**
1. Xem "TOP 10 Khu vực" chart
2. Check AI Insights → "TOP N chiếm X%"
3. Focus budget vào TOP locations
4. Monitor growth của các khu vực khác

### 3. Phát hiện vấn đề
**Cách làm:**
1. Chọn "Tháng này"
2. Xem KPI cards → tìm số đỏ (giảm)
3. Check AI Insights → tìm "bất thường"
4. Drill-down vào khu vực có vấn đề

### 4. So sánh performance
**Cách làm:**
1. Chọn period (tuần/tháng/năm)
2. Xem "Xu hướng" chart → compare TOP 5
3. Sort table theo "Tăng trưởng"
4. Identify winners & losers

### 5. Báo cáo cho leadership
**Cách làm:**
1. Chọn period phù hợp
2. Screenshot AI Insights banner
3. Screenshot TOP 10 chart
4. Export table (coming soon)

---

## ⚡ Performance Tips

### Tăng tốc độ load:
1. ✅ Dữ liệu được cache tự động
2. ✅ Chỉ load khi cần (lazy loading)
3. ✅ Click "Làm mới" để update

### Khi nào nên refresh:
- Sau khi có đơn hàng mới
- Khi chuyển period
- Khi drill-down level mới
- Mỗi 5-10 phút (manual)

---

## 🐛 Troubleshooting

### Không thấy AI Insights?
- ✅ Cần có dữ liệu previous period
- ✅ Chọn period khác "Tất cả"
- ✅ Đảm bảo có đủ data

### Không thấy % Tăng trưởng?
- ✅ Cần có dữ liệu kỳ trước
- ✅ Period "Tất cả" không có comparison
- ✅ Khu vực mới sẽ hiển thị "-"

### Chart không hiển thị?
- ✅ Cần có ít nhất 1 location có data
- ✅ Refresh trang
- ✅ Check console log

### Table trống?
- ✅ Chọn period khác
- ✅ Check filter/search
- ✅ Đảm bảo có đơn hàng trong period

---

## 🎓 Best Practices

### 1. Daily Monitoring
- Check "Hôm nay" mỗi sáng
- Review AI Insights
- Monitor growth list

### 2. Weekly Review
- Compare "Tuần này" vs tuần trước
- Identify trends
- Adjust strategy

### 3. Monthly Planning
- Deep dive "Tháng này"
- Drill-down to district level
- Plan next month budget

### 4. Quarterly Analysis
- Review "Năm nay" data
- Compare quarters
- Strategic decisions

---

## 📊 Metrics Explained

### Doanh thu (Revenue)
- Tổng tiền từ đơn hàng
- Không bao gồm đơn hủy
- Tính theo created_at

### Đơn hàng (Orders)
- Số lượng đơn hàng
- Mỗi đơn đếm 1 lần
- Không phân biệt trạng thái

### Khách hàng (Customers)
- Unique customers (theo phone)
- 1 khách nhiều đơn = 1 customer
- Đếm distinct

### Giá trị TB (Avg Order Value)
- Doanh thu / Số đơn
- Chỉ số quan trọng
- Cao = khách hàng chất lượng

### Tăng trưởng (Growth)
- % thay đổi vs kỳ trước
- Formula: (Current - Previous) / Previous × 100
- Positive = tốt, Negative = cần cải thiện

---

## 🔮 Coming Soon

- [ ] Export to Excel
- [ ] Vietnam Map Heatmap
- [ ] Predictive Analytics
- [ ] Real-time Updates
- [ ] Advanced Filters
- [ ] Custom Date Range
- [ ] Email Reports
- [ ] Mobile App

---

**Last Updated:** 2024-11-18
**Version:** 2.0
**Support:** Check LOCATION_REPORT_UPGRADE.md for technical details
