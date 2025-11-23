# Tính năng Bộ lọc Ngày Tùy chỉnh - Trang Thanh toán CTV

## Tổng quan

Đã thêm tính năng chọn ngày cụ thể và khoảng thời gian tùy chỉnh vào trang Thanh toán CTV, tương tự như trang Thống kê Đơn hàng.

## Tính năng

### 1. Bộ lọc Preset (Giữ nguyên)
- **Hôm nay**: Thanh toán trong ngày hôm nay
- **Tuần này**: Thanh toán trong tuần này
- **Tháng này**: Thanh toán trong tháng này (mặc định)
- **3 tháng**: Thanh toán trong 3 tháng gần nhất
- **6 tháng**: Thanh toán trong 6 tháng gần nhất
- **Tất cả**: Hiển thị tất cả thanh toán

### 2. Bộ lọc Ngày Tùy chỉnh (MỚI)

#### Chế độ "Một ngày"
- Chọn một ngày cụ thể để xem thanh toán của ngày đó
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
2. Modal date picker sẽ hiện ra với ngày hôm nay đã được chọn sẵn

### Bước 2: Chọn chế độ
- **Một ngày**: Chọn tab "Một ngày" để lọc theo một ngày cụ thể
- **Khoảng thời gian**: Chọn tab "Khoảng thời gian" để lọc theo khoảng

### Bước 3: Chọn ngày
- Input date đã có sẵn giá trị là ngày hôm nay
- Điều chỉnh ngày/tháng/năm theo nhu cầu
- Không thể chọn ngày trong tương lai (max = hôm nay)

### Bước 4: Áp dụng
- Nhấn **"Áp dụng"** để lọc dữ liệu
- Nhấn **"Xóa bộ lọc"** để reset về "Tháng này"
- Nhấn X hoặc click ngoài modal để đóng mà không áp dụng

### Kết quả
- Nút "Chọn ngày" sẽ hiển thị ngày/khoảng thời gian đã chọn
- Danh sách thanh toán sẽ được lọc theo thời gian đã chọn
- Thống kê summary cũng được cập nhật theo bộ lọc
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

## Kỹ thuật Implementation

### Files thay đổi

#### 1. `public/admin/payments.html`
- Thêm nút "Chọn ngày" vào phần bộ lọc (desktop)
- Thêm hidden inputs: `customDateStartPayments`, `customDateEndPayments`
- Thêm CSS cho date picker modal (tái sử dụng từ orders)

#### 2. `public/assets/js/payments.js`
- Thêm các hàm mới:
  - `showCustomDatePickerPayments()`: Hiển thị modal
  - `closeCustomDatePickerPayments()`: Đóng modal
  - `switchDateModePayments()`: Chuyển đổi giữa single/range
  - `applyCustomDatePayments()`: Áp dụng bộ lọc
  - `clearCustomDatePayments()`: Xóa bộ lọc
  - `updateCustomDateLabelPayments()`: Cập nhật label nút
  - `getVNStartOfDate()`: Lấy start of date (VN timezone)
  - `getVNEndOfDate()`: Lấy end of date (VN timezone)

- Cập nhật hàm `filterByPeriod()`:
  - Reset custom date values khi chọn preset khác
  - Xử lý case 'custom' cho date filter

### State Management
```javascript
// Global variables
let currentDateModePayments = 'single'; // 'single' or 'range'
let customDatePickerModalPayments = null;

// Hidden inputs store values
<input type="hidden" id="customDateStartPayments" value="">
<input type="hidden" id="customDateEndPayments" value="">
```

### Tích hợp với hệ thống hiện có
- Sử dụng `currentFilters.dateRange` để lưu khoảng thời gian custom
- Tích hợp với hàm `applyFilters()` hiện có
- Không ảnh hưởng đến các bộ lọc khác (status, search)

### Validation
1. **Ngày bắt đầu <= Ngày kết thúc**: Kiểm tra trong `applyCustomDatePayments()`
2. **Không chọn ngày tương lai**: Sử dụng `max` attribute trong input
3. **Phải chọn đầy đủ**: Kiểm tra empty values trước khi apply

## UI/UX

### Design
- Modal với backdrop mờ (rgba(0,0,0,0.5))
- Animation: fadeIn cho backdrop, slideUp cho content
- Tabs để chuyển đổi giữa single/range mode
- Date input với border focus effect (ring-2 ring-primary)
- Buttons với gradient background và hover effects
- **Input date tự động có giá trị là ngày hôm nay** để tiện chỉnh sửa

### Accessibility
- Keyboard navigation: Tab, Enter, Escape
- Click outside để đóng modal
- Clear visual feedback khi chọn ngày
- Toast notifications cho các actions

### Responsive
- Modal responsive với max-width: 400px
- Width: 90% trên mobile
- Date inputs full width trong modal
- Desktop: Hiển thị nút "Chọn ngày" trong toolbar
- Mobile: Có thể thêm vào dropdown nếu cần

## Testing

### Test Cases

#### 1. Chọn một ngày cụ thể
- Chọn ngày 20/11/2025
- Kết quả: Chỉ hiển thị thanh toán của ngày 20/11/2025

#### 2. Chọn khoảng thời gian
- Chọn từ 15/11/2025 đến 20/11/2025
- Kết quả: Hiển thị thanh toán từ 15/11 đến 20/11 (bao gồm cả 2 ngày)

#### 3. Chọn ngày hôm nay
- Mở modal → Ngày hôm nay đã được chọn sẵn → Nhấn "Áp dụng"
- Kết quả: Giống với preset "Hôm nay"

#### 4. Validation
- Chọn ngày bắt đầu > ngày kết thúc → Hiển thị warning
- Không chọn ngày → Hiển thị warning
- Chọn ngày tương lai → Input không cho phép

#### 5. Kết hợp với bộ lọc khác
- Chọn ngày + chọn trạng thái "Đã thanh toán"
- Kết quả: Thanh toán đã hoàn thành trong ngày đã chọn

#### 6. Reset filter
- Chọn ngày custom → Nhấn "Xóa bộ lọc"
- Kết quả: Quay về "Tháng này", label reset về "Chọn ngày"

#### 7. Chuyển đổi preset
- Chọn ngày custom → Nhấn preset "Hôm nay"
- Kết quả: Custom date bị clear, áp dụng preset "Hôm nay"

#### 8. Input date có giá trị mặc định
- Mở modal lần đầu → Input date hiển thị ngày hôm nay
- Dễ dàng điều chỉnh thay vì chọn từ đầu

## Performance

### Optimization
- Không reload data từ server khi filter
- Chỉ filter trên client-side từ `allCommissions`
- Modal được tạo mới mỗi lần mở để đảm bảo state fresh
- Sử dụng lại CSS và logic từ trang orders

### Memory
- Modal được remove khỏi DOM khi đóng
- Event listeners được cleanup khi modal remove
- Không có memory leaks

## So sánh với Orders Page

### Giống nhau
- UI/UX hoàn toàn giống nhau
- Logic xử lý timezone giống nhau
- Validation giống nhau
- Animation và styling giống nhau

### Khác nhau
- Tên biến và hàm có suffix "Payments" để tránh conflict
- Tích hợp với `currentFilters` object của payments
- Reset về "Tháng này" thay vì "Tất cả"
- Không có mobile dropdown (có thể thêm sau)

## Tương lai

### Có thể mở rộng
1. **Mobile dropdown**: Thêm option "Chọn ngày" vào mobile select
2. **Quick presets trong modal**: Thêm các nút "Tuần trước", "Tháng trước"
3. **Save favorite ranges**: Lưu các khoảng thời gian thường dùng
4. **Export với date range**: Export thanh toán theo khoảng thời gian đã chọn
5. **Compare periods**: So sánh thanh toán giữa 2 khoảng thời gian

### Áp dụng cho các trang khác
- ✅ Orders page (đã hoàn thành)
- ✅ Payments page (đã hoàn thành)
- 🔄 Profit Report page (có thể áp dụng)
- 🔄 CTV Results page (có thể áp dụng)

## Changelog

### Version 1.0 (23/11/2025)
- ✅ Thêm nút "Chọn ngày" vào bộ lọc payments
- ✅ Implement date picker modal với 2 modes (single/range)
- ✅ Xử lý timezone VN chính xác
- ✅ Validation và error handling
- ✅ Update UI với date label
- ✅ Kết hợp với các bộ lọc khác
- ✅ Toast notifications
- ✅ Input date tự động có giá trị ngày hôm nay
- ✅ Responsive design

## Hỗ trợ

Nếu có vấn đề:
1. Kiểm tra console log để debug
2. Kiểm tra timezone utils đã load chưa
3. Kiểm tra format ngày trong database (phải là UTC ISO string)
4. Kiểm tra browser support cho input type="date"
5. Đảm bảo không có conflict với orders page (do dùng tên biến khác)
