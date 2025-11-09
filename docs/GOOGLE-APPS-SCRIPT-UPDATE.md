# Cập Nhật Google Apps Script - Thêm API Đơn Hàng Mới Nhất

## ✅ ĐÃ CẬP NHẬT

File `google-apps-script/order-handler.js` đã được cập nhật với API mới!

## Cách Deploy

### 1. Mở Google Apps Script

- Vào Google Sheets chứa **đơn hàng** (không phải sheet CTV)
- Chọn **Extensions** > **Apps Script**

### 2. Copy Code Mới

**Copy toàn bộ nội dung** từ file `google-apps-script/order-handler.js` và paste vào Apps Script Editor (thay thế code cũ hoàn toàn).

### 3. Kiểm Tra Cấu Hình

Đảm bảo trong phần CONFIG đã đúng:

```javascript
const CONFIG = {
  // Sheet ID của danh sách CTV
  CTV_SHEET_ID: '1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o',
  CTV_SHEET_NAME: 'DS REF',

  // Sheet ID của đơn hàng
  ORDER_SHEET_ID: '1CmfyZg1MCPCv0_RnlBOOf0HIev4RPg4DK43veMGyPJM',
  ORDER_SHEET_NAME: 'Form responses 1',
  
  // ... các config khác
};
```

### 4. Test Trước Khi Deploy

Chạy function test trong Apps Script Editor:

1. Chọn function `runAllTests` từ dropdown
2. Nhấn **Run** (▶️)
3. Xem kết quả trong **Execution log**

Kết quả mong đợi:
```
✅ CTV Sheet: OK
✅ Order Sheet: OK
✅ Recent Orders: OK
✅ Search Orders: OK
```

### 5. Deploy

- Nhấn **Deploy** > **Manage deployments**
- Chọn deployment hiện tại
- Nhấn **Edit** (icon bút chì)
- Chọn **New version**
- Nhấn **Deploy**

### 6. Test API

**Test API đơn hàng mới nhất:**
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getRecentOrders&limit=10
```

**Test API tra cứu theo mã CTV:**
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getOrders&referralCode=PARTNER001
```

Kết quả mong đợi:
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "ORD001",
      "orderDate": "09/11/2024",
      "referralCode": "PARTNER001",
      "customerName": "Nguyễn Văn A",
      "customerPhone": "0901234567",
      "products": "Sữa XYZ",
      "totalAmount": 500000,
      "status": "Hoàn thành"
    }
  ],
  "total": 1
}
```

## Cấu Trúc Sheet Đơn Hàng

File `order-handler.js` đã được cấu hình sẵn theo cấu trúc:

| Cột | Tên Cột | Mô Tả |
|-----|---------|-------|
| A | Mã Đơn Hàng | Order ID |
| B | Ngày Đặt | Order Date |
| C | Tên Khách Hàng | Customer Name |
| D | Số Điện Thoại | Customer Phone |
| E | Địa Chỉ | Address |
| F | Chi Tiết Sản Phẩm | Products |
| G | TỔNG KHÁCH PHẢI TRẢ | Total Amount |
| H | Hướng Thanh Toán | Payment Method |
| I | Ghi Chú | Status/Notes |
| J | Mã Referral | Referral Code |

Nếu sheet của bạn khác, cập nhật `ORDER_COLUMNS` trong CONFIG.

## Troubleshooting

**Lỗi "Sheet not found":**
- Kiểm tra `ORDER_SHEET_NAME` trong CONFIG
- Đảm bảo tên sheet khớp chính xác (có phân biệt hoa thường)

**Không có dữ liệu:**
- Chạy function `testOrderSheet()` để kiểm tra kết nối
- Kiểm tra sheet có dữ liệu không (ít nhất 2 dòng: header + 1 dòng data)

**Số tiền hiển thị sai:**
- Function `parseAmount()` đã xử lý format Việt Nam (139.000 đ)
- Nếu vẫn sai, kiểm tra format trong sheet

**Mã CTV không tìm thấy:**
- Kiểm tra cột J có chứa mã Referral không
- Đảm bảo mã CTV khớp chính xác (không phân biệt hoa thường)
