# 📋 Hướng dẫn Quản lý Khách hàng

## 🎯 Tổng quan

Hệ thống quản lý khách hàng **Virtual Customers** - tự động tổng hợp từ đơn hàng, không cần tạo bảng riêng.

## 🚀 Truy cập

Mở trình duyệt: `http://127.0.0.1:5500/public/admin/customers.html`

## 📊 Thống kê

### 4 Thẻ Thống kê Chính:

1. **Tổng khách hàng** - Số lượng khách hàng unique (theo SĐT)
2. **Khách mới (30 ngày)** - Khách có đơn đầu tiên trong 30 ngày qua
3. **Tổng doanh thu** - Tổng chi tiêu của tất cả khách hàng
4. **Giá trị TB/đơn** - Average Order Value (AOV)

## 🏷️ Phân khúc Khách hàng

Hệ thống tự động phân loại khách hàng:

| Phân khúc | Điều kiện | Badge |
|-----------|-----------|-------|
| 🌟 **VIP** | ≥5 đơn hàng | Vàng |
| 💚 **Regular** | 2-4 đơn hàng | Xanh lá |
| 🆕 **New** | 1 đơn hàng | Xanh dương |
| ⚠️ **At Risk** | Không mua >60 ngày | Cam |
| 💤 **Churned** | Không mua >90 ngày | Xám |

## ✨ Tính năng

### 1. Xem Danh sách Khách hàng

Bảng hiển thị:
- STT
- Tên khách hàng (với avatar initials)
- Số điện thoại
- Phân khúc (badge màu)
- Số đơn hàng
- Tổng chi tiêu + Giá trị TB
- Đơn gần nhất
- Nút "Chi tiết"

### 2. Tìm kiếm

- Tìm theo **tên** hoặc **số điện thoại**
- Real-time search (debounced 300ms)
- Phím tắt: `Ctrl/Cmd + K`

### 3. Lọc theo Phân khúc

Dropdown filter:
- Tất cả phân khúc
- VIP
- Regular
- New
- At Risk
- Churned

### 4. Chi tiết Khách hàng

Click "Chi tiết" để xem modal với:

**Thông tin tổng quan:**
- Avatar với initials
- Tên + SĐT
- Phân khúc
- Tổng đơn
- Tổng chi tiêu
- Giá trị TB/đơn

**Thông tin chi tiết:**
- Địa chỉ
- Đơn gần nhất
- Khách hàng từ (ngày đầu tiên)
- CTV giới thiệu

**Lịch sử đơn hàng:**
- Danh sách tất cả đơn
- Mã đơn + Trạng thái
- Giá trị đơn
- Ngày đặt
- CTV xử lý

## 🎨 Giao diện

### Layout
```
┌─────────────────────────────────────────────┐
│ Sidebar │ Header: Quản Lý Khách Hàng       │
│         │ [Refresh]                         │
├─────────┼───────────────────────────────────┤
│         │ Stats Cards (4 cards)             │
│  Menu   │ ┌──────┬──────┬──────┬──────┐    │
│         │ │Total │ New  │Revenue│ AOV  │    │
│ - CTV   │ └──────┴──────┴──────┴──────┘    │
│ - Orders│                                    │
│ - Prod  │ Search & Filter                   │
│ - Cust ✓│ [Search...] [Segment Filter]     │
│         │                                    │
│         │ Customers Table                   │
│         │ ┌────────────────────────────┐   │
│         │ │ Name │ Phone │ Segment │ $ │   │
│         │ ├────────────────────────────┤   │
│         │ │ ...  │ ...   │ ...     │...│   │
│         │ └────────────────────────────┘   │
└─────────┴───────────────────────────────────┘
```

### Màu sắc
- **Primary**: Indigo (#6366f1)
- **Secondary**: Purple (#8b5cf6)
- **Success**: Green (#10b981)
- **Warning**: Orange (#f59e0b)
- **Danger**: Red (#ef4444)

## 🔧 Cách hoạt động (Technical)

### Virtual Customers Approach

Không tạo bảng `customers` riêng, thay vào đó:

1. **Query tổng hợp từ orders:**
```sql
SELECT 
    customer_phone as phone,
    customer_name as name,
    MAX(address) as address,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_spent,
    MAX(order_date) as last_order_date,
    MIN(order_date) as first_order_date,
    GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
FROM orders
WHERE customer_phone IS NOT NULL
GROUP BY customer_phone
ORDER BY total_spent DESC
```

2. **Tính toán metrics:**
- `avg_order_value` = total_spent / total_orders
- `days_since_last_order` = Số ngày từ đơn gần nhất
- `days_since_first_order` = Số ngày từ đơn đầu tiên
- `segment` = Phân loại dựa trên total_orders và days_since_last_order

3. **Lợi ích:**
- ✅ Không cần migration
- ✅ Dữ liệu luôn đồng bộ
- ✅ Không duplicate data
- ✅ Tự động cập nhật khi có đơn mới

## 📡 API Endpoints

### 1. Get All Customers
```
GET /api?action=getAllCustomers
Response: {
  success: true,
  customers: [
    {
      phone: "0912345678",
      name: "Nguyễn Văn A",
      address: "Hà Nội",
      total_orders: 5,
      total_spent: 1500000,
      avg_order_value: 300000,
      last_order_date: "2024-01-15",
      first_order_date: "2023-10-01",
      days_since_last_order: 2,
      days_since_first_order: 106,
      segment: "VIP",
      ctv_codes: "CTV001,CTV002"
    }
  ]
}
```

### 2. Get Customer Detail
```
GET /api?action=getCustomerDetail&phone=0912345678
Response: {
  success: true,
  customer: {
    ...summary,
    orders: [
      {
        id: 1,
        order_id: "ORD123",
        order_date: "2024-01-15",
        total_amount: 200000,
        status: "delivered",
        referral_code: "CTV001",
        commission: 20000,
        products: "[...]"
      }
    ]
  }
}
```

### 3. Search Customers
```
GET /api?action=searchCustomers&q=Nguyen
Response: { success: true, customers: [...] }
```

## ⌨️ Phím tắt

| Phím | Chức năng |
|------|-----------|
| `Ctrl/Cmd + K` | Focus vào ô tìm kiếm |
| `Escape` | Đóng modal chi tiết |

## 📈 Metrics & KPIs

### Hiển thị:
- **Total Customers**: Tổng số khách hàng unique
- **New Customers**: Khách mới trong 30 ngày
- **Total Revenue**: Tổng doanh thu từ tất cả khách
- **AOV**: Average Order Value
- **Repeat Rate**: % khách mua lại (≥2 đơn)
- **Churn Rate**: % khách không mua >90 ngày

### Phân tích:
- **RFM Score**: Recency, Frequency, Monetary
- **Customer Lifetime Value**: Tổng chi tiêu
- **Purchase Frequency**: Số đơn / thời gian
- **Days Since Last Order**: Ngày từ đơn gần nhất

## 🎯 Use Cases

### 1. Chăm sóc khách VIP
- Filter: VIP
- Xem lịch sử mua hàng
- Chuẩn bị ưu đãi đặc biệt

### 2. Tìm khách At Risk
- Filter: At Risk
- Liên hệ để tái kích hoạt
- Gửi promotion

### 3. Phân tích khách Churned
- Filter: Churned
- Tìm nguyên nhân
- Chiến dịch win-back

### 4. Theo dõi khách mới
- Filter: New
- Chăm sóc đặc biệt
- Tăng conversion sang Regular

## 🔮 Future Enhancements

### Phase 2 (Có thể thêm):
- [ ] Export to CSV/Excel
- [ ] Customer notes/tags
- [ ] Bulk SMS/Email
- [ ] Customer segments
- [ ] Loyalty points
- [ ] Birthday tracking
- [ ] Email collection
- [ ] Customer portal

### Phase 3 (Advanced):
- [ ] RFM Analysis dashboard
- [ ] Predictive churn model
- [ ] Recommendation engine
- [ ] Customer journey map
- [ ] Cohort analysis
- [ ] LTV prediction

## 🐛 Troubleshooting

### Không hiển thị khách hàng
- Kiểm tra có đơn hàng trong DB chưa
- Kiểm tra `customer_phone` không null
- Xem console log để debug

### Stats không chính xác
- Refresh lại trang
- Kiểm tra API response
- Verify data trong orders table

### Modal không mở
- Kiểm tra console errors
- Verify API endpoint
- Check phone number format

## 💡 Tips

1. **Tìm kiếm nhanh**: Dùng `Ctrl+K` thay vì click
2. **Phân tích VIP**: Focus vào top 20% khách hàng
3. **Chăm sóc At Risk**: Ưu tiên khách >60 ngày không mua
4. **Track trends**: Theo dõi New customers hàng tháng
5. **CTV performance**: Xem CTV nào giới thiệu khách tốt nhất

## 📝 Notes

- Dữ liệu real-time từ orders table
- Không cần sync hay cron job
- Performance tốt với <10,000 khách
- Có thể scale bằng cách thêm indexes
- Dễ dàng migrate sang Customers Table sau này

---

**Tạo bởi**: Kiro AI Assistant  
**Ngày**: 2024  
**Version**: 1.0.0
