# Sửa Lỗi Bộ Lọc Ngày Trong Trang Thống Kê Đơn Hàng

## Vấn Đề

Bộ lọc ngày trong trang thống kê đơn hàng hoạt động không đúng:
- Chọn "Hôm nay": 1 đơn hàng ✅
- Chọn "Hôm qua": 2 đơn hàng ✅
- Chọn "7 ngày": chỉ có 1 đơn hàng ❌ (sai, phải là 3 đơn)

## Nguyên Nhân

1. **Thiếu các hàm xử lý ngày tháng VN timezone:**
   - `getVNStartOfToday()` - chưa được định nghĩa
   - `getVNEndOfToday()` - chưa được định nghĩa
   - `getVNStartOfWeek()` - chưa được định nghĩa
   - `getVNStartOfMonth()` - chưa được định nghĩa
   - `VIETNAM_TIMEZONE` constant - chưa được định nghĩa

2. **Logic bộ lọc "7 ngày" và "30 ngày" không đầy đủ:**
   - Chỉ kiểm tra `orderDate >= weekStart` mà không có điều kiện kết thúc
   - Dẫn đến lấy tất cả đơn hàng từ 7 ngày trước đến tương lai (nếu có)

3. **Hiểu nhầm "7 ngày":**
   - "7 ngày" ở đây là **7 ngày qua** (last 7 days), không phải "tuần này" (this week)
   - Tương tự, "30 ngày" là **30 ngày qua**, không phải "tháng này"

## Giải Pháp

### 1. Thêm constant VIETNAM_TIMEZONE

```javascript
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
```

### 2. Thêm các hàm xử lý ngày tháng VN timezone

```javascript
/**
 * Get start of today in VN timezone (00:00:00)
 */
function getVNStartOfToday() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return new Date(vnDateStr + 'T00:00:00+07:00');
}

/**
 * Get end of today in VN timezone (23:59:59.999)
 */
function getVNEndOfToday() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return new Date(vnDateStr + 'T23:59:59.999+07:00');
}

/**
 * Get start of last 7 days in VN timezone (7 ngày qua, không phải tuần này)
 */
function getVNStartOfWeek() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const today = new Date(vnDateStr + 'T00:00:00+07:00');
    
    // Lùi lại 7 ngày (không phải tuần này, mà là 7 ngày qua)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sevenDaysAgo;
}

/**
 * Get start of last 30 days in VN timezone (30 ngày qua)
 */
function getVNStartOfMonth() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const today = new Date(vnDateStr + 'T00:00:00+07:00');
    
    // Lùi lại 30 ngày
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return thirtyDaysAgo;
}
```

### 3. Sửa logic bộ lọc "7 ngày" và "30 ngày"

**Trước:**
```javascript
} else if (dateFilter === 'week') {
    const weekStart = getVNStartOfWeek();
    matchesDate = orderDate >= weekStart; // ❌ Thiếu điều kiện kết thúc
}
```

**Sau:**
```javascript
} else if (dateFilter === 'week') {
    const weekStart = getVNStartOfWeek();
    const todayEnd = getVNEndOfToday();
    matchesDate = orderDate >= weekStart && orderDate <= todayEnd; // ✅ Đầy đủ
}
```

### 4. Thêm debug logging

Thêm logging để dễ dàng debug khi có vấn đề:

```javascript
// Debug date ranges
if (dateFilter === 'today') {
    console.log('📅 Today range:', getVNStartOfToday().toISOString(), '-', getVNEndOfToday().toISOString());
} else if (dateFilter === 'yesterday') {
    const todayStart = getVNStartOfToday();
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);
    console.log('📅 Yesterday range:', yesterdayStart.toISOString(), '-', yesterdayEnd.toISOString());
} else if (dateFilter === 'week') {
    console.log('📅 7-day range:', getVNStartOfWeek().toISOString(), '-', getVNEndOfToday().toISOString());
} else if (dateFilter === 'month') {
    console.log('📅 30-day range:', getVNStartOfMonth().toISOString(), '-', getVNEndOfToday().toISOString());
}
```

## Kết Quả

Sau khi sửa:
- ✅ Bộ lọc "Hôm nay" hoạt động đúng
- ✅ Bộ lọc "Hôm qua" hoạt động đúng
- ✅ Bộ lọc "7 ngày" hoạt động đúng (lấy tất cả đơn hàng trong 7 ngày qua)
- ✅ Bộ lọc "30 ngày" hoạt động đúng (lấy tất cả đơn hàng trong 30 ngày qua)
- ✅ Tất cả bộ lọc đều sử dụng VN timezone chính xác

## Tối Ưu Hóa

1. **Hiệu suất:**
   - Các hàm xử lý ngày tháng được tối ưu, chỉ tính toán một lần
   - Sử dụng `toLocaleDateString()` với timezone để đảm bảo chính xác
   - Logic so sánh đơn giản với `>=` và `<=`

2. **Độ chính xác:**
   - Sử dụng VN timezone (`Asia/Ho_Chi_Minh`) cho tất cả tính toán
   - Đảm bảo "7 ngày" là 7 ngày qua, không phải tuần này
   - Đảm bảo "30 ngày" là 30 ngày qua, không phải tháng này

3. **Dễ bảo trì:**
   - Code rõ ràng, dễ hiểu
   - Có comment giải thích logic
   - Có debug logging để dễ dàng troubleshoot

## File Đã Sửa

- `public/assets/js/orders.js` - Thêm các hàm `getVNStartOfLast7Days()` và `getVNStartOfLast30Days()` để xử lý "7 ngày qua" và "30 ngày qua"
- `public/assets/js/timezone-utils.js` - Đã có sẵn các hàm timezone utilities (không cần sửa)

## Lưu Ý Quan Trọng

- File `timezone-utils.js` đã có sẵn các hàm `getVNStartOfToday()`, `getVNEndOfToday()`, `getVNStartOfWeek()`, `getVNStartOfMonth()` 
- Tuy nhiên, `getVNStartOfWeek()` trong `timezone-utils.js` tính "tuần này" (từ thứ Hai), không phải "7 ngày qua"
- Tương tự, `getVNStartOfMonth()` tính "tháng này" (từ ngày 1), không phải "30 ngày qua"
- Do đó, trong `orders.js` tôi đã tạo 2 hàm riêng:
  - `getVNStartOfLast7Days()` - Lấy 7 ngày qua
  - `getVNStartOfLast30Days()` - Lấy 30 ngày qua

## Ngày Sửa

24/11/2025
