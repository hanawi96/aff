# Tính năng Biểu đồ Quản lý CTV

## Tổng quan
Đã thêm 2 biểu đồ trực quan vào trang quản lý cộng tác viên để giúp admin dễ dàng theo dõi và phân tích hiệu suất CTV.

## Các biểu đồ

### 1. Biểu đồ Top CTV (Bar Chart - Ngang)
**Vị trí:** Cột trái, phía trên bảng danh sách CTV

**Chức năng:**
- Hiển thị top 10 CTV xuất sắc nhất
- 2 chế độ xem:
  - **Doanh thu**: Xếp hạng theo tổng hoa hồng (màu indigo)
  - **Đơn hàng**: Xếp hạng theo số lượng đơn hàng (màu xanh lá)

**Tương tác:**
- Click nút "Doanh thu" hoặc "Đơn hàng" để chuyển đổi chế độ
- Hover vào cột để xem chi tiết
- Tự động cập nhật khi filter dữ liệu thay đổi

**Thiết kế:**
- Biểu đồ cột ngang (horizontal bar) để dễ đọc tên CTV
- Màu sắc phân biệt rõ ràng giữa 2 chế độ
- Chiều cao cố định 280px, gọn gàng

### 2. Biểu đồ Xu hướng Đăng ký (Line Chart)
**Vị trí:** Cột phải, phía trên bảng danh sách CTV

**Chức năng:**
- Hiển thị số lượng CTV mới đăng ký theo thời gian
- 3 khoảng thời gian:
  - **7 ngày**: Xem xu hướng tuần gần nhất
  - **30 ngày**: Xem xu hướng tháng (mặc định)
  - **90 ngày**: Xem xu hướng quý

**Tương tác:**
- Chọn dropdown để thay đổi khoảng thời gian
- Hover vào điểm để xem số CTV đăng ký trong ngày
- Luôn hiển thị toàn bộ dữ liệu (không bị ảnh hưởng bởi filter)

**Thiết kế:**
- Đường cong mượt mà (tension: 0.4)
- Màu tím gradient với fill nhẹ
- Điểm dữ liệu rõ ràng với viền trắng
- Trục Y chỉ hiển thị số nguyên

## Tích hợp với Filter

### Biểu đồ Top CTV
- **Đồng bộ với filter**: Khi filter theo trạng thái, thời gian, hoặc tìm kiếm, biểu đồ sẽ cập nhật để chỉ hiển thị top CTV trong dữ liệu đã lọc
- Giúp admin phân tích hiệu suất trong các nhóm CTV cụ thể

### Biểu đồ Xu hướng Đăng ký
- **Không bị ảnh hưởng bởi filter**: Luôn hiển thị toàn bộ dữ liệu đăng ký
- Mục đích: Theo dõi tốc độ tăng trưởng tổng thể của mạng lưới CTV

## Dữ liệu sử dụng

### Nguồn dữ liệu
- `created_at_unix`: Timestamp đăng ký CTV (milliseconds)
- `totalCommission`: Tổng hoa hồng đã tạo
- `orderCount`: Số lượng đơn hàng
- `fullName`: Tên CTV

### Xử lý timezone
- Sử dụng `timezone-utils.js` để chuyển đổi UTC sang giờ Việt Nam
- Hàm `toVNShortDate()` để format ngày tháng
- Đảm bảo dữ liệu hiển thị chính xác theo múi giờ VN (UTC+7)

## Công nghệ

### Chart.js v4.4.0
- Thư viện biểu đồ JavaScript mạnh mẽ, nhẹ
- Responsive, tự động điều chỉnh theo kích thước màn hình
- Hỗ trợ animation mượt mà

### Cấu hình tối ưu
- `maintainAspectRatio: false`: Chiều cao cố định
- `responsive: true`: Tự động scale theo chiều rộng
- Animation: `update('none')` khi filter để tránh lag
- Tooltip tùy chỉnh với format tiền tệ VN

## Layout & Responsive

### Desktop (≥1024px)
- 2 biểu đồ nằm ngang, mỗi biểu đồ chiếm 50% chiều rộng
- Grid layout: `grid-cols-2`
- Khoảng cách: `gap-6`

### Mobile (<1024px)
- 2 biểu đồ xếp dọc, mỗi biểu đồ full width
- Grid layout: `grid-cols-1`
- Vẫn giữ chiều cao 280px cho mỗi biểu đồ

## Performance

### Tối ưu hóa
- Chỉ update biểu đồ khi dữ liệu thay đổi
- Sử dụng `update('none')` để tắt animation khi filter
- Giới hạn top 10 CTV để tránh biểu đồ quá dài
- Cache chart instances để tránh tạo lại

### Xử lý dữ liệu
- Sort và slice trên client-side
- Không cần API call thêm
- Tận dụng dữ liệu đã load từ `getAllCTV`

## Màu sắc

### Biểu đồ Top CTV
- **Doanh thu**: Indigo (#6366f1) - Đồng bộ với màu chủ đạo admin
- **Đơn hàng**: Green (#10b981) - Màu success, dễ phân biệt

### Biểu đồ Xu hướng
- **Đường**: Purple (#8b5cf6) - Màu secondary của admin
- **Fill**: Purple với opacity 0.1
- **Điểm**: Purple với viền trắng

## Cải tiến trong tương lai

### Có thể thêm
1. Export biểu đồ thành hình ảnh
2. So sánh nhiều khoảng thời gian
3. Biểu đồ phân bố theo khu vực
4. Biểu đồ tỷ lệ chuyển đổi (CTV mới → CTV active)
5. Biểu đồ tăng trưởng doanh thu theo thời gian

### Tối ưu thêm
1. Lazy load Chart.js khi cần
2. Web Worker cho xử lý dữ liệu lớn
3. Cache kết quả tính toán
4. Virtual scrolling cho danh sách dài

## Files thay đổi

### Modified
- `public/admin/index.html`: Thêm Chart.js CDN và HTML cho 2 biểu đồ
- `public/assets/js/admin.js`: Thêm logic xử lý biểu đồ

### Dependencies
- Chart.js v4.4.0 (CDN)
- timezone-utils.js (đã có sẵn)

## Testing

### Kiểm tra
1. ✅ Biểu đồ hiển thị đúng khi load trang
2. ✅ Chuyển đổi giữa Doanh thu/Đơn hàng hoạt động
3. ✅ Dropdown thời gian cập nhật biểu đồ xu hướng
4. ✅ Filter dữ liệu cập nhật biểu đồ Top CTV
5. ✅ Responsive trên mobile
6. ✅ Tooltip hiển thị đúng format
7. ✅ Timezone VN chính xác

### Edge cases
- Không có dữ liệu: Biểu đồ trống, không lỗi
- 1 CTV: Hiển thị 1 cột/điểm
- Dữ liệu lớn: Chỉ hiển thị top 10, không lag
