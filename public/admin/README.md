# 📋 Trang Quản Trị Cộng Tác Viên

## 🎯 Tính năng

### Trang Danh Sách CTV (`index.html`)
- ✅ Hiển thị danh sách tất cả cộng tác viên
- ✅ Thống kê tổng quan (Tổng CTV, Đang hoạt động, Mới tháng này, Tổng hoa hồng)
- ✅ Tìm kiếm theo tên, SĐT, mã CTV, email
- ✅ Lọc theo trạng thái (Tất cả, Đang hoạt động, Mới, Không hoạt động)
- ✅ Xuất Excel/CSV
- ✅ Copy mã CTV
- ✅ Nhắn tin Zalo trực tiếp
- ✅ Xem chi tiết CTV (sẽ làm tiếp)

## 🚀 Cách sử dụng

### 1. Deploy Google Apps Script

Trước tiên, bạn cần cập nhật code trong Google Apps Script:

1. Mở Google Apps Script của bạn
2. Copy toàn bộ nội dung file `google-apps-script/order-handler.js`
3. Paste vào Apps Script Editor
4. Lưu và Deploy lại Web App
5. Copy URL mới (nếu có)

### 2. Cấu hình URL

Mở file `public/assets/js/config.js` và đảm bảo `GOOGLE_SCRIPT_URL` đúng:

```javascript
GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
```

### 3. Truy cập trang Admin

Mở file `public/admin/index.html` trong trình duyệt hoặc deploy lên hosting:

```
https://your-domain.com/admin/
```

## 📊 API Endpoints

### GET: getAllCTV
Lấy danh sách tất cả CTV kèm thống kê

**Request:**
```
GET https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getAllCTV
```

**Response:**
```json
{
  "success": true,
  "ctvList": [
    {
      "timestamp": "13/11/2024 10:30:00",
      "fullName": "Nguyễn Văn A",
      "phone": "0901234567",
      "email": "email@example.com",
      "city": "Hà Nội",
      "referralCode": "CTV123456",
      "status": "Mới",
      "hasOrders": true,
      "orderCount": 5,
      "totalRevenue": 5000000,
      "totalCommission": 500000
    }
  ],
  "stats": {
    "totalCTV": 100,
    "activeCTV": 45,
    "newCTV": 12,
    "totalCommission": 15000000
  }
}
```

## 🎨 Thiết kế

- **Framework CSS:** Tailwind CSS
- **Icons:** Heroicons (SVG)
- **Màu chủ đạo:** 
  - Primary: Indigo (#6366f1)
  - Success: Green (#10b981)
  - Warning: Orange (#f59e0b)
  - Danger: Red (#ef4444)

## 📱 Responsive

Trang được thiết kế responsive, hoạt động tốt trên:
- 💻 Desktop
- 📱 Mobile
- 📱 Tablet

## 🔜 Tính năng tiếp theo

- [ ] Trang chi tiết CTV với bộ lọc thời gian
- [ ] Tính hoa hồng theo khoảng thời gian
- [ ] Xuất báo cáo PDF
- [ ] Gửi thông báo cho CTV
- [ ] Quản lý trạng thái CTV

## 🐛 Debug

Nếu không load được dữ liệu:

1. Mở Console (F12) để xem lỗi
2. Kiểm tra URL API trong `config.js`
3. Kiểm tra Google Apps Script đã deploy chưa
4. Test API trực tiếp trong Apps Script bằng hàm `testGetAllCTVForAdmin()`

## 📞 Hỗ trợ

Nếu cần hỗ trợ, liên hệ:
- Zalo: 0972.483.892 hoặc 0386.190.596
