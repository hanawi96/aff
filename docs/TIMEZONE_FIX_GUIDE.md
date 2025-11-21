# Hướng Dẫn Chuẩn Hóa Timezone Cho Hệ Thống

## Vấn Đề Hiện Tại

Hệ thống đang gặp vấn đề **timezone mismatch**:
- Bạn thêm đơn hàng lúc 22h39 ngày 21/11 (giờ VN)
- Database hiển thị giờ khác (UTC - chênh lệch 7 giờ)
- Bộ lọc thời gian không chính xác

## Nguyên Nhân

1. **Backend (worker.js)**: Lưu timestamp theo UTC (Coordinated Universal Time)
2. **Frontend**: Một số chỗ chưa chuyển đổi sang múi giờ Việt Nam (UTC+7)
3. **Database**: Có nhiều cột timestamp khác nhau (`order_date`, `created_at`, `created_at_unix`)

## Giải Pháp Chuẩn (Best Practice)

### Nguyên Tắc Vàng:
- ✅ **Backend**: Luôn lưu UTC timestamp
- ✅ **Database**: Lưu UTC timestamp
- ✅ **Frontend**: Chuyển đổi sang VN timezone khi hiển thị và lọc
- ✅ **API**: Gửi/nhận UTC, frontend tự chuyển đổi

### Lợi Ích:
- Dễ dàng mở rộng ra quốc tế
- Tránh lỗi Daylight Saving Time
- Dễ debug và maintain
- Chuẩn quốc tế

## Cấu Trúc Timestamp Trong Hệ Thống

### Database Schema (SQLite)

```sql
-- Bảng orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  order_date TEXT,                    -- Timestamp từ frontend (có thể local time)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- SQLite auto UTC
  created_at_unix INTEGER,            -- Unix timestamp (milliseconds)
  ...
);
```

### Backend (worker.js)

```javascript
// Khi tạo đơn hàng
const orderDate = data.orderDate || new Date().getTime(); // UTC timestamp
const orderTimestamp = new Date(orderDate).getTime();

// Lưu vào database
INSERT INTO orders (
  order_date,        -- Lưu timestamp từ frontend
  created_at_unix,   -- Lưu Unix timestamp (UTC)
  ...
) VALUES (?, ?, ...)
```

### Frontend (orders.js)

```javascript
// Import timezone-utils.js
<script src="../assets/js/timezone-utils.js"></script>

// Lọc đơn hàng hôm nay (VN timezone)
const todayStart = getVNStartOfToday();  // 00:00:00 VN time
const todayEnd = getVNEndOfToday();      // 23:59:59 VN time

const todayOrders = orders.filter(order => {
  const orderDate = new Date(order.created_at);
  return orderDate >= todayStart && orderDate <= todayEnd;
});

// Hiển thị thời gian (VN timezone)
const displayTime = toVNDateString(order.created_at);
```

## Các Hàm Timezone Utilities

File: `public/assets/js/timezone-utils.js`

### Hiển Thị Thời Gian

```javascript
// Hiển thị đầy đủ: "21/11/2024, 22:39:15"
toVNDateString(utcDate)

// Hiển thị ngắn: "21/11/2024"
toVNShortDate(utcDate)

// Chỉ giờ: "22:39"
toVNTime(utcDate)

// Thời gian tương đối: "5 phút trước"
getVNRelativeTime(utcDate)
```

### Lọc Theo Thời Gian

```javascript
// Hôm nay (00:00:00 - 23:59:59 VN time)
const todayStart = getVNStartOfToday();
const todayEnd = getVNEndOfToday();

// Tuần này (Thứ 2 00:00:00 VN time)
const weekStart = getVNStartOfWeek();

// Tháng này (Ngày 1 00:00:00 VN time)
const monthStart = getVNStartOfMonth();
const monthEnd = getVNEndOfMonth();

// Năm này
const yearStart = getVNStartOfYear();
const yearEnd = getVNEndOfYear();
```

### Chuyển Đổi

```javascript
// Chuyển VN datetime input sang UTC
const utcISO = vnDateTimeToUTC("2024-11-21T22:39");

// Lấy thời gian hiện tại UTC
const now = getCurrentUTC();

// Parse bất kỳ date string nào
const date = parseToUTC(dateString);
```

## Checklist Chuẩn Hóa

### ✅ Backend (worker.js)

- [x] Lưu `created_at_unix` khi tạo đơn hàng
- [x] Sử dụng `created_at_unix` cho tất cả queries thống kê
- [ ] **CẦN FIX**: Đảm bảo `order_date` luôn là UTC timestamp

### ✅ Frontend (orders.js)

- [x] Import `timezone-utils.js`
- [x] Sử dụng `getVNStartOfToday()` cho bộ lọc
- [x] Sử dụng `toVNDateString()` cho hiển thị
- [ ] **CẦN FIX**: Khi tạo đơn hàng, gửi UTC timestamp

### ✅ Database

- [x] Có cột `created_at_unix` (Unix timestamp)
- [x] Có index trên `created_at_unix`
- [ ] **CẦN FIX**: Migration để đồng bộ `created_at_unix` cho đơn hàng cũ

## Code Cần Fix

### 1. Frontend - Khi Tạo Đơn Hàng

**File**: `public/assets/js/orders.js` (hoặc file tạo đơn hàng)

```javascript
// ❌ SAI - Gửi local time
const orderData = {
  orderDate: new Date().getTime(), // Local time
  ...
};

// ✅ ĐÚNG - Gửi UTC
const orderData = {
  orderDate: getCurrentUTC(), // UTC ISO string
  // hoặc
  orderDate: new Date().toISOString(), // UTC ISO string
  ...
};
```

### 2. Backend - Đảm Bảo Lưu Đúng

**File**: `worker.js` - Function `createOrder`

```javascript
// ✅ ĐÃ ĐÚNG - Đang lưu created_at_unix
const orderDate = data.orderDate || new Date().getTime();
const orderTimestamp = new Date(orderDate).getTime();

INSERT INTO orders (
  order_date,
  created_at_unix,  // ✅ Đã có
  ...
) VALUES (?, ?, ...)
```

### 3. Queries - Sử Dụng created_at_unix

**File**: `worker.js` - Tất cả queries thống kê

```javascript
// ❌ SAI - Dùng created_at (có thể không chính xác)
WHERE DATE(created_at) = ?

// ✅ ĐÚNG - Dùng created_at_unix
WHERE created_at_unix >= ? AND created_at_unix <= ?
```

## Migration Script

Nếu có đơn hàng cũ chưa có `created_at_unix`, chạy script sau:

```sql
-- Update created_at_unix từ created_at
UPDATE orders 
SET created_at_unix = strftime('%s', created_at) * 1000
WHERE created_at_unix IS NULL;

-- Hoặc từ order_date
UPDATE orders 
SET created_at_unix = CAST(order_date AS INTEGER)
WHERE created_at_unix IS NULL AND order_date IS NOT NULL;
```

## Testing

### Test Case 1: Tạo Đơn Hàng

```javascript
// Tạo đơn lúc 22:39 ngày 21/11/2024 (VN time)
// Expected: Database lưu UTC timestamp tương ứng (15:39 UTC)

const orderData = {
  orderDate: new Date().toISOString(), // "2024-11-21T15:39:00.000Z"
  ...
};

// Verify trong database:
// created_at_unix = 1732203540000 (UTC)
// Hiển thị frontend: "21/11/2024, 22:39" (VN time)
```

### Test Case 2: Lọc Hôm Nay

```javascript
// Lọc đơn hàng hôm nay (21/11/2024 VN time)
const todayStart = getVNStartOfToday(); // 2024-11-21T00:00:00+07:00 = 2024-11-20T17:00:00Z
const todayEnd = getVNEndOfToday();     // 2024-11-21T23:59:59+07:00 = 2024-11-21T16:59:59Z

// Query:
WHERE created_at_unix >= 1732118400000 AND created_at_unix <= 1732204799999
```

### Test Case 3: Hiển Thị Thời Gian

```javascript
// UTC timestamp: 1732203540000 (2024-11-21T15:39:00Z)
const display = toVNDateString(1732203540000);
// Expected: "21/11/2024, 22:39:00"
```

## Debug Tips

### 1. Kiểm Tra Timestamp Trong Database

```sql
-- Xem timestamp của đơn hàng
SELECT 
  order_id,
  order_date,
  created_at,
  created_at_unix,
  datetime(created_at_unix/1000, 'unixepoch') as readable_utc,
  datetime(created_at_unix/1000, 'unixepoch', '+7 hours') as readable_vn
FROM orders
ORDER BY id DESC
LIMIT 10;
```

### 2. Console Log Trong Frontend

```javascript
console.log('🕐 Current VN time:', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
console.log('🕐 Current UTC time:', new Date().toISOString());
console.log('🕐 Today start (VN):', getVNStartOfToday());
console.log('🕐 Today end (VN):', getVNEndOfToday());
```

### 3. API Debug Endpoint

Thêm vào `worker.js`:

```javascript
case 'debugTimezone':
  const now = new Date();
  return jsonResponse({
    success: true,
    serverTime: {
      utc: now.toISOString(),
      unix: now.getTime(),
      readable: now.toUTCString()
    },
    note: 'Server always uses UTC'
  }, 200, corsHeaders);
```

## Kết Luận

Sau khi áp dụng các fix trên:

✅ **Backend**: Luôn lưu UTC timestamp vào `created_at_unix`
✅ **Frontend**: Tự động chuyển đổi sang VN timezone khi hiển thị
✅ **Bộ lọc**: Chính xác theo múi giờ Việt Nam
✅ **Thống kê**: Đồng nhất trên tất cả các trang

**Lưu ý**: Không cần thay đổi múi giờ server hay database. Chỉ cần frontend biết cách chuyển đổi đúng!
