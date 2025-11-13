# Tính năng Modal Thông tin Cộng tác viên

## Mô tả
Tính năng cho phép xem thông tin chi tiết của cộng tác viên (CTV) và danh sách đơn hàng của họ bằng cách click vào icon CTV trước mã đơn hàng.

## Các tính năng chính

### 1. Icon CTV có thể click
- Icon CTV hiển thị trước mã đơn hàng (nếu đơn hàng có referral_code)
- Click vào icon sẽ mở modal thông tin CTV
- Hover vào icon hiển thị tooltip với thông tin cơ bản

### 2. Modal Thông tin CTV
Modal hiển thị với thiết kế đẹp, chuyên nghiệp bao gồm:

#### Header gradient
- Màu gradient từ xanh dương → tím → hồng
- Icon CTV lớn với hiệu ứng backdrop blur
- Nút đóng với animation xoay khi hover

#### Thống kê nhanh (3 cards)
- **Tổng đơn hàng**: Số lượng đơn hàng của CTV
- **Tổng doanh thu**: Tổng giá trị đơn hàng
- **Tổng hoa hồng**: Tổng hoa hồng đã tạo ra

#### Thông tin chi tiết
- Họ và tên
- Số điện thoại
- Mã CTV
- Tỷ lệ hoa hồng
- Thông tin ngân hàng (nếu có)

#### Button "Xem đơn hàng của CTV"
- Thiết kế gradient với hiệu ứng hover
- Icon mũi tên có animation
- Click để xem danh sách đơn hàng

### 3. Modal Danh sách Đơn hàng
Modal hiển thị danh sách đơn hàng của CTV với:

#### Header
- Nút quay lại modal thông tin CTV
- Hiển thị mã CTV và số lượng đơn hàng
- Nút đóng

#### Thống kê tổng quan (3 cards)
- Tổng đơn hàng
- Tổng doanh thu
- Tổng hoa hồng

#### Danh sách đơn hàng
Mỗi đơn hàng hiển thị trong card với:
- Số thứ tự với badge gradient
- Mã đơn hàng (có thể copy)
- Ngày đặt hàng
- Giá trị đơn hàng và hoa hồng
- Thông tin khách hàng
- Địa chỉ giao hàng
- Danh sách sản phẩm (nếu có)
- Nút "Xem chi tiết" để mở modal chi tiết đơn hàng

## Thiết kế UI/UX

### Màu sắc
- **Primary**: Gradient xanh dương → tím → hồng
- **Success**: Xanh lá (doanh thu)
- **Warning**: Cam (hoa hồng)
- **Info**: Xanh dương (đơn hàng)

### Animation
- Fade in khi mở modal
- Hover scale trên các button
- Rotate animation trên nút đóng
- Translate animation trên icon mũi tên

### Responsive
- Modal tự động điều chỉnh kích thước
- Scroll nội dung khi quá dài
- Padding phù hợp trên mobile

## API Endpoint mới

### GET /api?action=getCollaboratorInfo&referralCode={code}

**Response:**
```json
{
  "success": true,
  "collaborator": {
    "id": 1,
    "name": "Nguyễn Văn A",
    "phone": "0123456789",
    "email": "email@example.com",
    "referral_code": "CTV123456",
    "commission_rate": 0.1,
    "bank_info": null
  },
  "stats": {
    "totalOrders": 10,
    "totalRevenue": 5000000,
    "totalCommission": 500000
  },
  "recentOrders": [...]
}
```

## Cách sử dụng

1. Vào trang **Đơn hàng** trong admin dashboard
2. Tìm đơn hàng có icon CTV (hình người dùng màu gradient)
3. Click vào icon CTV
4. Modal thông tin CTV sẽ hiển thị
5. Click nút "Xem đơn hàng của CTV" để xem danh sách đơn hàng
6. Click "Xem chi tiết" trên từng đơn hàng để xem thông tin đầy đủ

## Files đã thay đổi

1. **public/assets/js/orders.js**
   - Thêm event click vào icon CTV
   - Thêm function `showCollaboratorModal()`
   - Thêm function `showCollaboratorOrders()`
   - Thêm function `closeCollaboratorModal()`
   - Thêm function `closeCollaboratorOrdersModal()`

2. **worker.js**
   - Thêm endpoint `getCollaboratorInfo`
   - Thêm function `getCollaboratorInfo()`

## Tương thích
- ✅ Chrome, Edge, Firefox, Safari (phiên bản mới)
- ✅ Mobile responsive
- ✅ Tailwind CSS 3.x
- ✅ ES6+ JavaScript

## Lưu ý
- Modal sử dụng backdrop blur effect (cần trình duyệt hỗ trợ)
- Animation sử dụng CSS transitions
- Click vào backdrop để đóng modal
- Dữ liệu được lấy từ D1 Database qua Cloudflare Worker
