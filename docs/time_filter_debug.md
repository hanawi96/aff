# Debug Bộ Lọc Thời Gian

## Vấn đề đã sửa

### 1. Lỗi Duplicate Constant
**Lỗi:** `Identifier 'VIETNAM_TIMEZONE' has already been declared`
**Nguyên nhân:** Constant đã được định nghĩa trong `timezone-utils.js`
**Giải pháp:** Xóa duplicate constant trong `admin.js`

### 2. Sai tên field dữ liệu
**Lỗi:** Dùng `ctv.createdAt` nhưng backend trả về `ctv.timestamp`
**Giải pháp:** Đổi thành `ctv.timestamp`

### 3. Timezone không đồng nhất
**Trước:** Sử dụng `new Date()` local time, không xử lý timezone VN
**Sau:** Sử dụng `timezone-utils.js` với múi giờ VN (UTC+7)

## Cấu trúc dữ liệu CTV từ Backend

```javascript
{
    id: 1,
    fullName: "Nguyễn Văn A",
    phone: "0123456789",
    email: "email@example.com",
    city: "Hà Nội",
    age: 25,
    bankAccountNumber: "1234567890",
    bankName: "Vietcombank",
    experience: "Có kinh nghiệm",
    referralCode: "ABC123",
    status: "Đang hoạt động",
    commissionRate: 0.1,
    timestamp: "2024-01-15T10:30:00.000Z",  // ← Field này dùng để lọc!
    hasOrders: true,
    orderCount: 10,
    totalRevenue: 5000000,
    totalCommission: 500000,
    todayCommission: 50000
}
```

## Cách Debug

### Bước 1: Mở Console trong trang Admin
Truy cập: http://127.0.0.1:5500/public/admin/index.html

### Bước 2: Kiểm tra dữ liệu CTV
```javascript
// Xem tất cả CTV
console.log('All CTV:', allCTVData);

// Xem CTV đầu tiên
console.log('First CTV:', allCTVData[0]);

// Kiểm tra timestamp
console.log('Timestamp:', allCTVData[0]?.timestamp);
```

### Bước 3: Test các hàm timezone
```javascript
// Hôm nay
console.log('Start of today VN:', getVNStartOfToday());

// Tuần này (thứ Hai)
console.log('Start of week VN:', getVNStartOfWeek());

// Tháng này (ngày 1)
console.log('Start of month VN:', getVNStartOfMonth());
```

### Bước 4: Test bộ lọc
```javascript
// Chọn bộ lọc và xem log
filterByRegistrationTime('today');
// Sẽ thấy log: 🔍 Time filter changed to: today
// Và: 📅 Filter debug: {...}
```

### Bước 5: Kiểm tra kết quả
```javascript
// Xem số lượng sau khi lọc
console.log('Filtered count:', filteredCTVData.length);
console.log('Total count:', allCTVData.length);
```

## Log Messages

Khi chạy bộ lọc, bạn sẽ thấy các log sau:

1. **🔍 Time filter changed to: [filter]** - Khi chọn bộ lọc
2. **📅 Filter debug:** - Thông tin chi tiết về việc so sánh thời gian
3. **⚠️ CTV missing timestamp:** - Cảnh báo nếu CTV không có timestamp

## Files đã cập nhật

1. **public/assets/js/admin.js**
   - ✅ Xóa duplicate `VIETNAM_TIMEZONE`
   - ✅ Đổi `ctv.createdAt` → `ctv.timestamp`
   - ✅ Thêm debug logs
   - ✅ Sử dụng timezone-utils functions

2. **public/assets/js/ctv-results.js**
   - ✅ Sử dụng timezone-utils functions

3. **public/ctv/results.html**
   - ✅ Thêm `<script src="../assets/js/timezone-utils.js"></script>`

## Lưu ý quan trọng

- ✅ Backend lưu timestamps ở UTC (ISO 8601)
- ✅ Frontend hiển thị và lọc theo giờ VN (UTC+7)
- ✅ Field dùng để lọc: `timestamp` (không phải `createdAt`)
- ✅ Hàm `getVNStartOfXXX()` trả về Date object UTC đại diện cho thời điểm VN
- ✅ Debug logs chỉ hiển thị cho CTV đầu tiên để tránh spam console
