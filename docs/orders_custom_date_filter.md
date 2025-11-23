# Tính năng Bộ lọc Ngày Tùy chỉnh - Trang Thống kê Đơn hàng

## Tổng quan

Đã thêm tính năng chọn ngày cụ thể và khoảng thời gian tùy chỉnh vào trang thống kê đơn hàng, cho phép xem số liệu thống kê của một ngày cụ thể hoặc một khoảng thời gian bất kỳ.

## Tính năng

### 1. Bộ lọc Preset (Giữ nguyên)
- **Tất cả**: Hiển thị tất cả đơn hàng
- **Hôm nay**: Đơn hàng trong ngày hôm nay (theo giờ VN)
- **Hôm qua**: Đơn hàng của ngày hôm qua
- **7 ngày**: Đơn hàng trong 7 ngày gần nhất
- **30 ngày**: Đơn hàng trong 30 ngày gần nhất

### 2. Bộ lọc Ngày Tùy chỉnh (MỚI)

#### Chế độ "Một ngày"
- Chọn một ngày cụ thể để xem tất cả đơn hàng trong ngày đó
- Hiển thị định dạng: `DD/MM/YYYY` (ví dụ: 23/11/2025)
- Tự động lọc từ 00:00:00 đến 23:59:59 của ngày đã chọn (giờ VN)

#### Chế độ "Khoảng thời gian"
- Chọn khoảng thời gian từ ngày A đến ngày B
- Hiển thị định dạng:
  - Cùng tháng: `DD-DD/MM/YYYY` (ví dụ: 15-20/11/2025)
  - Khác tháng: `DD/MM-DD/MM/YYYY` (ví dụ: 25/10-05/11/2025)
- Validation: Ngày bắt đầu phải trước hoặc bằng ngày kết thúc

## Cách sử dụng

### Bước 1: Mở Date Picker
1. Nhấn vào nút **"Chọn ngày"** (có icon lịch) trong phần bộ lọc
2. Modal date picker sẽ hiện ra

### Bước 2: Chọn chế độ
- **Một ngày**: Chọn tab "Một ngày" để lọc theo một ngày cụ thể
- **Khoảng thời gian**: Chọn tab "Khoảng thời gian" để lọc theo khoảng

### Bước 3: Chọn ngày
- Sử dụng date input để chọn ngày
- Không thể chọn ngày trong tương lai (max = hôm nay)

### Bước 4: Áp dụng
- Nhấn **"Áp dụng"** để lọc dữ liệu
- Nhấn **"Xóa bộ lọc"** để reset về "Tất cả"
- Nhấn X hoặc click ngoài modal để đóng mà không áp dụng

### Kết quả
- Nút "Chọn ngày" sẽ hiển thị ngày/khoảng thời gian đã chọn
- Danh sách đơn hàng sẽ được lọc theo thời gian đã chọn
- Có thể kết hợp với bộ lọc trạng thái và tìm kiếm

## Xử lý Timezone

### Quan trọng
- Tất cả ngày giờ được xử lý theo **múi giờ Việt Nam (UTC+7)**
- Backend lưu timestamp ở UTC, frontend tự động convert sang VN timezone
- Bộ lọc ngày sử dụng các hàm timezone-aware:
  - `getVNStartOfDate(dateStr)`: Lấy 00:00:00 của ngày (VN time)
  - `getVNEndOfDate(dateStr)`: Lấy 23:59:59.999 của ngày (VN time)

### Ví dụ
Khi chọn ngày **23/11/2025**:
- Start: `2025-11-23T00:00:00+07:00` (UTC: `2025-11-22T17:00:00Z`)
- End: `2025-11-23T23:59:59.999+07:00` (UTC: `2025-11-23T16:59:59.999Z`)

## Thống kê

### Cập nhật động theo bộ lọc
- **Thống kê** (4 card ở đầu trang) sẽ **cập nhật theo bộ lọc ngày** đã chọn
- Khi chọn "Tất cả": Hiển thị tổng của tất cả đơn hàng
- Khi chọn ngày cụ thể: Hiển thị số liệu của ngày đó
- Label của các card sẽ thay đổi động để phản ánh khoảng thời gian đang xem

### 4 chỉ số thống kê
1. **Đơn hàng**: Tổng số đơn hàng trong khoảng thời gian
2. **Doanh thu**: Tổng doanh thu (bao gồm sản phẩm + phí ship)
3. **Hoa hồng**: Tổng hoa hồng CTV
4. **Giá trị TB/đơn**: Giá trị trung bình mỗi đơn hàng (Doanh thu / Số đơn)

### Ví dụ label động
- Tất cả: "Tổng đơn hàng", "Tổng doanh thu"
- Hôm nay: "Hôm nay - Đơn hàng", "Hôm nay - Doanh thu"
- Ngày 23/11: "23/11 - Đơn hàng", "23/11 - Doanh thu"
- Khoảng 15-20/11: "15-20/11 - Đơn hàng", "15-20/11 - Doanh thu"

## Kỹ thuật Implementation

### Files thay đổi

#### 1. `public/admin/orders.html`
- Thêm nút "Chọn ngày" vào phần bộ lọc
- Thêm hidden inputs: `customDateStart`, `customDateEnd`
- Thêm CSS cho date picker modal

#### 2. `public/assets/js/orders.js`
- Thêm các hàm mới:
  - `showCustomDatePicker()`: Hiển thị modal
  - `closeCustomDatePicker()`: Đóng modal
  - `switchDateMode()`: Chuyển đổi giữa single/range
  - `applyCustomDate()`: Áp dụng bộ lọc
  - `clearCustomDate()`: Xóa bộ lọc
  - `updateCustomDateLabel()`: Cập nhật label nút
  - `updateStatLabels()`: Cập nhật label của stats cards động
  - `getTodayDateString()`: Lấy ngày hôm nay (YYYY-MM-DD)
  - `getVNStartOfDate()`: Lấy start of date (VN timezone)
  - `getVNEndOfDate()`: Lấy end of date (VN timezone)

- Cập nhật hàm `updateStats()`:
  - Sử dụng `filteredOrdersData` thay vì `allOrdersData`
  - Tính toán dựa trên dữ liệu đã lọc
  - Thay đổi card thứ 4 từ "Đơn hôm nay" sang "Giá trị TB/đơn"
  - Gọi `updateStatLabels()` để cập nhật label động

- Cập nhật hàm `filterOrdersData()`:
  - Thêm case `'custom'` cho date filter
  - Sử dụng `getVNStartOfDate()` và `getVNEndOfDate()` để lọc chính xác
  - Gọi `updateStats()` sau khi lọc để cập nhật thống kê

- Cập nhật hàm `selectDateFilterPreset()`:
  - Reset custom date values khi chọn preset khác

### State Management
```javascript
// Global variables
let currentDateMode = 'single'; // 'single' or 'range'
let customDatePickerModal = null;

// Hidden inputs store values
<input type="hidden" id="dateFilter" value="all">
<input type="hidden" id="customDateStart" value="">
<input type="hidden" id="customDateEnd" value="">
```

### Validation
1. **Ngày bắt đầu <= Ngày kết thúc**: Kiểm tra trong `applyCustomDate()`
2. **Không chọn ngày tương lai**: Sử dụng `max` attribute trong input
3. **Phải chọn đầy đủ**: Kiểm tra empty values trước khi apply

## Testing

### Test Cases

#### 1. Chọn một ngày cụ thể
- Chọn ngày 20/11/2025
- Kết quả: Chỉ hiển thị đơn hàng của ngày 20/11/2025

#### 2. Chọn khoảng thời gian
- Chọn từ 15/11/2025 đến 20/11/2025
- Kết quả: Hiển thị đơn hàng từ 15/11 đến 20/11 (bao gồm cả 2 ngày)

#### 3. Chọn ngày hôm nay
- Chọn ngày hôm nay
- Kết quả: Giống với preset "Hôm nay"

#### 4. Validation
- Chọn ngày bắt đầu > ngày kết thúc → Hiển thị warning
- Không chọn ngày → Hiển thị warning
- Chọn ngày tương lai → Input không cho phép

#### 5. Kết hợp với bộ lọc khác
- Chọn ngày + chọn trạng thái "Đã giao hàng"
- Kết quả: Đơn hàng đã giao trong ngày đã chọn

#### 6. Reset filter
- Chọn ngày custom → Nhấn "Xóa bộ lọc"
- Kết quả: Quay về "Tất cả", label reset về "Chọn ngày"

#### 7. Chuyển đổi preset
- Chọn ngày custom → Nhấn preset "Hôm nay"
- Kết quả: Custom date bị clear, áp dụng preset "Hôm nay"

## UI/UX

### Design
- Modal với backdrop mờ (rgba(0,0,0,0.5))
- Animation: fadeIn cho backdrop, slideUp cho content
- Tabs để chuyển đổi giữa single/range mode
- Date input với border focus effect (ring-2 ring-primary)
- Buttons với gradient background và hover effects

### Accessibility
- Keyboard navigation: Tab, Enter, Escape
- Click outside để đóng modal
- Clear visual feedback khi chọn ngày
- Toast notifications cho các actions

### Responsive
- Modal responsive với max-width: 400px
- Width: 90% trên mobile
- Date inputs full width trong modal

## Performance

### Optimization
- Không reload data từ server khi filter
- Chỉ filter trên client-side từ `allOrdersData`
- Debounce không cần thiết vì user action (click button)
- Modal được tạo mới mỗi lần mở để đảm bảo state fresh

### Memory
- Modal được remove khỏi DOM khi đóng
- Event listeners được cleanup khi modal remove
- Không có memory leaks

## Tương lai

### Có thể mở rộng
1. **Quick presets trong modal**: Thêm các nút "Tuần này", "Tháng này" trong modal
2. **Date range shortcuts**: "7 ngày qua", "30 ngày qua" trong range mode
3. **Save favorite ranges**: Lưu các khoảng thời gian thường dùng
4. **Export với date range**: Export đơn hàng theo khoảng thời gian đã chọn
5. **Compare periods**: So sánh số liệu giữa 2 khoảng thời gian

### Tích hợp với các trang khác
- Áp dụng tương tự cho trang Payments
- Áp dụng cho trang Profit Report
- Áp dụng cho trang CTV Results

## Changelog

### Version 1.1 (23/11/2025) - Stats Update
- ✅ Thống kê cập nhật động theo bộ lọc ngày
- ✅ Label của stats cards thay đổi theo khoảng thời gian
- ✅ Thay đổi card thứ 4 từ "Đơn hôm nay" sang "Giá trị TB/đơn"
- ✅ Tính toán chính xác dựa trên dữ liệu đã lọc

### Version 1.0 (23/11/2025) - Initial Release
- ✅ Thêm nút "Chọn ngày" vào bộ lọc
- ✅ Implement date picker modal với 2 modes (single/range)
- ✅ Xử lý timezone VN chính xác
- ✅ Validation và error handling
- ✅ Update UI với date label
- ✅ Kết hợp với các bộ lọc khác
- ✅ Toast notifications
- ✅ Responsive design

## Hỗ trợ

Nếu có vấn đề:
1. Kiểm tra console log để debug
2. Kiểm tra timezone utils đã load chưa
3. Kiểm tra format ngày trong database (phải là UTC ISO string)
4. Kiểm tra browser support cho input type="date"
