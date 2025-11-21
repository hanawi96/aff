# 📊 Hướng Dẫn Sử Dụng Tính Năng Lịch Sử Mã Giảm Giá

## 🎯 Tổng Quan

Tính năng **Lịch sử sử dụng mã giảm giá** đã được tích hợp vào trang quản lý discount với thiết kế tab-based hiện đại, giúp bạn theo dõi chi tiết việc sử dụng các mã giảm giá.

## 🚀 Truy Cập

**URL:** `http://127.0.0.1:5500/public/admin/discounts.html`

Trang quản lý có 2 tabs chính:
1. **Quản lý mã** - Tạo, sửa, xóa mã giảm giá
2. **Lịch sử sử dụng** - Xem chi tiết lịch sử sử dụng mã

## 📈 Thống Kê Tổng Quan

Khi vào tab "Lịch sử sử dụng", bạn sẽ thấy 4 thẻ thống kê:

1. **Tổng lượt dùng** - Tổng số lần mã được sử dụng
2. **Tổng tiền giảm** - Tổng số tiền đã giảm cho khách hàng
3. **Giá trị đơn hàng** - Tổng giá trị các đơn hàng có dùng mã
4. **Khách hàng** - Số lượng khách hàng unique đã dùng mã

## 🔍 Tìm Kiếm & Lọc

### Tìm kiếm
Nhập vào ô tìm kiếm để tìm theo:
- Mã giảm giá (VD: GIAM2K)
- Số điện thoại khách hàng
- Mã đơn hàng
- Tên khách hàng

### Bộ lọc
- **Loại mã**: Lọc theo loại (Giảm cố định, Giảm %, Tặng quà, Freeship)
- **Ngày sử dụng**: Lọc theo ngày cụ thể

## 📋 Bảng Lịch Sử

Bảng hiển thị các thông tin:
- **Thời gian** - Thời điểm sử dụng mã (có hiển thị "X giờ trước")
- **Mã giảm giá** - Mã được sử dụng + loại mã
- **Đơn hàng** - Mã đơn hàng (click để xem chi tiết đơn)
- **Khách hàng** - Tên và SĐT
- **Giá trị đơn** - Tổng giá trị đơn hàng
- **Giảm giá** - Số tiền được giảm
- **Quà tặng** - Quà tặng kèm theo (nếu có)
- **Thao tác** - Nút xem chi tiết

## 👁️ Xem Chi Tiết

Click vào icon mắt (👁️) để xem chi tiết đầy đủ:
- Thông tin mã giảm giá
- Chi tiết đơn hàng (giá trị, giảm giá, thành tiền)
- Thông tin khách hàng
- Thời gian sử dụng
- Nút "Xem đơn hàng" để chuyển sang trang orders

## 🎨 Thiết Kế UI

### Màu sắc theo loại mã:
- **Giảm cố định**: Xanh dương (Blue)
- **Giảm %**: Tím (Purple)
- **Tặng quà**: Hồng (Pink)
- **Freeship**: Xanh lá (Green)

### Hiệu ứng:
- Fade-in animation khi load dữ liệu
- Hover effects trên các hàng
- Skeleton loading state
- Responsive design cho mobile

## 🔧 API Endpoint

**Endpoint mới đã được thêm:**
```
GET https://ctv-api.yendev96.workers.dev?action=getDiscountUsageHistory
```

**Response:**
```json
{
  "success": true,
  "usageHistory": [
    {
      "id": 1,
      "discount_id": 1,
      "discount_code": "GIAM2K",
      "order_id": "DH1763721451168",
      "customer_name": "Nguyễn Văn A",
      "customer_phone": "0901234567",
      "order_amount": 250000,
      "discount_amount": 2000,
      "gift_received": null,
      "used_at": "2025-11-21 10:08:29",
      "discount_title": "Giảm 2.000đ",
      "discount_type": "fixed"
    }
  ]
}
```

## 📊 Database Schema

Dữ liệu được lấy từ bảng `discount_usage` với JOIN `discounts`:

```sql
SELECT 
    du.id,
    du.discount_id,
    du.discount_code,
    du.order_id,
    du.customer_name,
    du.customer_phone,
    du.order_amount,
    du.discount_amount,
    du.gift_received,
    du.used_at,
    d.title as discount_title,
    d.type as discount_type
FROM discount_usage du
LEFT JOIN discounts d ON du.discount_id = d.id
ORDER BY du.used_at DESC
LIMIT 1000
```

## ✨ Tính Năng Nổi Bật

1. **Real-time Stats** - Thống kê tự động cập nhật
2. **Smart Search** - Tìm kiếm thông minh đa trường
3. **Date Filter** - Lọc theo ngày cụ thể
4. **Quick View** - Xem nhanh chi tiết trong modal
5. **Direct Link** - Link trực tiếp đến đơn hàng
6. **Time Ago** - Hiển thị thời gian tương đối (2 giờ trước, 1 ngày trước)
7. **Empty State** - Giao diện đẹp khi chưa có dữ liệu
8. **Loading State** - Skeleton loading chuyên nghiệp

## 🎯 Use Cases

### 1. Kiểm tra hiệu quả mã giảm giá
- Xem mã nào được dùng nhiều nhất
- Tổng tiền đã giảm cho từng mã
- Số lượng khách hàng sử dụng

### 2. Phân tích hành vi khách hàng
- Khách hàng nào dùng mã nhiều lần
- Giá trị đơn hàng trung bình khi dùng mã
- Thời điểm khách hay dùng mã

### 3. Audit & Tracking
- Theo dõi lịch sử sử dụng mã
- Kiểm tra gian lận (nếu có)
- Báo cáo cho kế toán

### 4. Customer Support
- Tra cứu nhanh lịch sử dùng mã của khách
- Xác minh khách đã dùng mã chưa
- Hỗ trợ giải quyết khiếu nại

## 🚀 Cải Tiến Trong Tương Lai

- [ ] Export lịch sử ra Excel/CSV
- [ ] Biểu đồ thống kê theo thời gian
- [ ] So sánh hiệu quả giữa các mã
- [ ] Thông báo khi mã được dùng
- [ ] Phân tích ROI của từng mã
- [ ] Gợi ý tối ưu mã giảm giá

## 📝 Ghi Chú

- Dữ liệu được giới hạn 1000 records gần nhất
- Thời gian hiển thị theo múi giờ Việt Nam
- Tự động refresh khi switch tab
- Hỗ trợ đầy đủ trên mobile

---

**Phát triển bởi:** Kiro AI Assistant  
**Ngày cập nhật:** 21/11/2025  
**Version:** 1.0.0
