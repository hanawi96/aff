# Hướng Dẫn Sử Dụng Trang Thống Kê Đơn Hàng

## Tổng Quan

Trang thống kê đơn hàng cho phép admin xem và quản lý tất cả đơn hàng từ các CTV trong hệ thống.

## Các Tính Năng

### 1. Thống Kê Tổng Quan
- **Tổng đơn hàng**: Hiển thị tổng số đơn hàng trong hệ thống
- **Tổng doanh thu**: Tổng giá trị của tất cả đơn hàng
- **Tổng hoa hồng**: Tổng số tiền hoa hồng đã phát sinh
- **Đơn hôm nay**: Số lượng đơn hàng được tạo trong ngày hôm nay

### 2. Tìm Kiếm & Lọc
- **Tìm kiếm**: Tìm theo mã đơn, tên khách hàng, số điện thoại, hoặc mã CTV
- **Lọc theo thời gian**:
  - Tất cả thời gian
  - Hôm nay
  - Hôm qua
  - 7 ngày qua
  - 30 ngày qua

### 3. Sắp Xếp
- **Sắp xếp theo ngày**: Click vào tiêu đề "Ngày đặt" để sắp xếp
  - Mới nhất trước (mặc định)
  - Cũ nhất trước
  - Không sắp xếp
- **Sắp xếp theo giá trị**: Click vào tiêu đề "Giá trị" để sắp xếp
  - Cao nhất trước
  - Thấp nhất trước
  - Không sắp xếp

### 4. Hiển Thị Sản Phẩm
Cột sản phẩm được thiết kế đẹp mắt và chuyên nghiệp:
- **Hiển thị tối đa 3 sản phẩm** với badges màu gradient tím-hồng
- **Icon giỏ hàng** bên cạnh mỗi sản phẩm
- **Số lượng** hiển thị trong badge tròn màu tím (nếu > 1)
- **Tên sản phẩm dài** sẽ được cắt ngắn với tooltip khi hover
- **Nhiều hơn 3 sản phẩm**: Hiển thị "+X sản phẩm khác" với badge màu xám
- **Không có sản phẩm**: Hiển thị text "Không có thông tin" màu xám nhạt

### 5. Xem Chi Tiết Đơn Hàng
Click vào icon "mắt" để xem chi tiết đơn hàng bao gồm:
- Thông tin đơn hàng (mã đơn, ngày đặt, giá trị, hoa hồng)
- Thông tin khách hàng (tên, SĐT, địa chỉ)
- Thông tin CTV (mã CTV, SĐT CTV)
- Danh sách sản phẩm đầy đủ
- Phương thức thanh toán và trạng thái

### 6. Phân Trang
- Hiển thị 15 đơn hàng mỗi trang
- Điều hướng dễ dàng giữa các trang

## Format Dữ Liệu Sản Phẩm

Hệ thống hỗ trợ nhiều format dữ liệu sản phẩm:

### Format 1: JSON Array (Khuyến nghị)
```json
[
  {"name": "Áo thun nam basic", "quantity": 2},
  {"name": "Quần jean slim fit", "quantity": 1}
]
```

### Format 2: Text với số lượng
```
Áo thun nam basic x2, Quần jean slim fit x1, Giày thể thao x1
```

### Format 3: Text đơn giản (mỗi dòng 1 sản phẩm)
```
Áo thun nam basic
Quần jean slim fit
Giày thể thao
```

### Format 4: Text tự do
```
Áo thun nam basic màu trắng size M, Quần jean nam slim fit màu xanh
```

Hệ thống sẽ tự động parse và hiển thị đẹp mắt cho tất cả các format trên.

## Cách Sử Dụng

### Truy Cập Trang
1. Đăng nhập vào Admin Dashboard
2. Click vào menu "Đơn hàng" ở sidebar
3. Trang thống kê đơn hàng sẽ được hiển thị

### Tìm Kiếm Đơn Hàng
1. Nhập từ khóa vào ô tìm kiếm
2. Hệ thống sẽ tự động lọc kết quả trong vòng 300ms

### Lọc Theo Thời Gian
1. Click vào dropdown "Tất cả thời gian"
2. Chọn khoảng thời gian mong muốn
3. Danh sách đơn hàng sẽ được cập nhật tự động

### Sắp Xếp Dữ Liệu
1. Click vào tiêu đề cột có icon mũi tên
2. Icon sẽ thay đổi để hiển thị trạng thái sắp xếp hiện tại
3. Click lại để thay đổi thứ tự sắp xếp

### Xem Chi Tiết
1. Click vào icon "mắt" ở cột "Thao tác"
2. Modal chi tiết sẽ hiển thị
3. Click "Đóng" hoặc click bên ngoài modal để đóng

### Copy Mã Đơn
1. Click vào icon "copy" bên cạnh mã đơn
2. Mã đơn sẽ được copy vào clipboard
3. Thông báo xác nhận sẽ hiển thị

## Kết Nối API

Trang này sử dụng API endpoint sau:
- `GET ?action=getRecentOrders&limit=1000` - Lấy danh sách đơn hàng

API URL được cấu hình trong file `config.js`:
```javascript
API_URL: 'https://ctv-api.yendev96.workers.dev'
```

## Cấu Trúc File

```
public/
├── admin/
│   ├── orders.html          # Trang thống kê đơn hàng
│   ├── ctv-detail.html      # Trang chi tiết CTV
│   └── index.html           # Trang danh sách CTV
└── assets/
    └── js/
        ├── orders.js        # Logic xử lý trang đơn hàng
        ├── ctv-detail.js    # Logic xử lý trang chi tiết CTV
        ├── admin.js         # Logic xử lý trang admin
        └── config.js        # Cấu hình API
```

## Lưu Ý

1. **Dữ liệu realtime**: Dữ liệu được load từ Cloudflare D1 database
2. **Phân trang**: Mặc định hiển thị 15 đơn hàng/trang để tối ưu hiệu suất
3. **Tìm kiếm**: Sử dụng debounce 300ms để tránh gọi API quá nhiều
4. **Sắp xếp**: Chỉ có thể sắp xếp theo 1 tiêu chí tại một thời điểm

## Troubleshooting

### Không tải được dữ liệu
- Kiểm tra kết nối internet
- Kiểm tra API URL trong `config.js`
- Kiểm tra console log để xem lỗi chi tiết

### Tìm kiếm không hoạt động
- Đảm bảo đã nhập ít nhất 1 ký tự
- Chờ 300ms để debounce hoàn tất
- Kiểm tra console log

### Sắp xếp không đúng
- Click lại icon sắp xếp để reset
- Kiểm tra dữ liệu có đầy đủ không
- Refresh trang nếu cần

## Hỗ Trợ

Nếu gặp vấn đề, vui lòng liên hệ:
- Zalo: 0972483892 hoặc 0386190596
- Email: admin@ctv.com
