# Fix: Hiển thị Ngày Đơn Gần Nhất Trong Trang Quản Lý Khách Hàng

## 🐛 Vấn đề
Trong trang quản lý khách hàng (`/admin/customers.html`), cột "Đơn gần nhất" hiển thị sai:
- Hiển thị "Chưa có đơn" cho khách hàng đã có đơn hàng
- Hoặc hiển thị "X ngày trước" thay vì ngày cụ thể

## ✅ Giải pháp
Đã sửa file `public/assets/js/customers.js` để:
1. Hiển thị ngày đơn hàng gần nhất thực tế (ví dụ: "15/11/2024")
2. Chỉ hiển thị "Chưa có đơn" khi thực sự chưa có đơn hàng

## 📝 Thay đổi chi tiết

### File: `public/assets/js/customers.js`

#### 1. Trong hàm `createCustomerRow()` (dòng ~155-165)
**TRƯỚC:**
```javascript
const lastOrderText = customer.days_since_last_order !== null
    ? formatDaysAgo(customer.days_since_last_order)
    : 'Chưa có đơn';
```

**SAU:**
```javascript
// Show actual date of last order instead of "days ago"
const lastOrderText = customer.last_order_date
    ? formatDate(customer.last_order_date)
    : 'Chưa có đơn';
```

#### 2. Trong hàm `showCustomerModal()` (dòng ~240-250)
**TRƯỚC:**
```javascript
const lastOrderText = customer.days_since_last_order !== null
    ? formatDaysAgo(customer.days_since_last_order)
    : 'Chưa có đơn';

const firstOrderText = customer.days_since_first_order !== null
    ? formatDaysAgo(customer.days_since_first_order)
    : 'Chưa rõ';
```

**SAU:**
```javascript
// Show actual date instead of "days ago"
const lastOrderText = customer.last_order_date
    ? formatDate(customer.last_order_date)
    : 'Chưa có đơn';

const firstOrderText = customer.first_order_date
    ? formatDate(customer.first_order_date)
    : 'Chưa rõ';
```

## 🔍 Giải thích
- Backend (`worker.js`) đã trả về đúng dữ liệu `last_order_date` và `first_order_date`
- Frontend đang sử dụng `days_since_last_order` để tính "X ngày trước"
- Thay đổi này sử dụng trực tiếp `last_order_date` và format thành ngày tháng năm

## 🧪 Cách test

### 1. Deploy thay đổi
```bash
wrangler deploy
```

### 2. Kiểm tra trang Khách hàng
1. Mở trình duyệt và truy cập: `https://your-domain.com/admin/customers.html`
2. Kiểm tra cột "Đơn gần nhất"
3. Xác nhận rằng:
   - Hiển thị ngày cụ thể (ví dụ: "15/11/2024") thay vì "X ngày trước"
   - Chỉ hiển thị "Chưa có đơn" cho khách hàng thực sự chưa có đơn

### 3. Kiểm tra modal chi tiết
1. Click vào nút "Chi tiết" của một khách hàng
2. Xác nhận rằng:
   - "Đơn gần nhất" hiển thị ngày cụ thể
   - "Khách hàng từ" hiển thị ngày cụ thể

## 📊 Kết quả mong đợi

### Trước khi sửa:
```
| Khách hàng | Đơn gần nhất |
|------------|--------------|
| Nguyễn A   | 5 ngày trước |
| Trần B     | Chưa có đơn  | ❌ (sai - khách này có đơn)
```

### Sau khi sửa:
```
| Khách hàng | Đơn gần nhất |
|------------|--------------|
| Nguyễn A   | 15/11/2024   | ✅
| Trần B     | 10/11/2024   | ✅
```

## 🎯 Lợi ích
1. **Rõ ràng hơn**: Hiển thị ngày cụ thể giúp admin dễ theo dõi
2. **Chính xác hơn**: Không còn hiển thị sai "Chưa có đơn"
3. **Nhất quán**: Cùng format ngày với các trang khác trong hệ thống

## 🔧 Sửa lỗi hiển thị timestamp

Database lưu `order_date` dưới dạng Unix timestamp (milliseconds), nên cần xử lý đặc biệt:

**Vấn đề:** Hiển thị số `1763463689214.0` thay vì ngày tháng

**Giải pháp:** Cập nhật hàm `formatDate()` để:
1. Phát hiện và xử lý Unix timestamp (số)
2. Xử lý cả date string (ISO format)
3. Format thành DD/MM/YYYY

```javascript
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        let date;
        
        // Check if it's a timestamp (number)
        if (typeof dateString === 'number' || !isNaN(Number(dateString))) {
            // It's a Unix timestamp in milliseconds
            date = new Date(Number(dateString));
        } else {
            // It's a date string
            date = new Date(dateString);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateString);
            return dateString;
        }
        
        // Format as DD/MM/YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('Error formatting date:', e, dateString);
        return dateString;
    }
}
```

## ✨ Hoàn thành
- [x] Sửa hiển thị trong bảng danh sách khách hàng
- [x] Sửa hiển thị trong modal chi tiết khách hàng
- [x] Sửa lỗi "Invalid Date"
- [x] Kiểm tra syntax không có lỗi
- [ ] Deploy và test trên production

---
**Ngày sửa:** 19/11/2024
**File thay đổi:** `public/assets/js/customers.js`
