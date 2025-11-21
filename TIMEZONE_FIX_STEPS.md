# Các Bước Fix Vấn Đề Timezone

## Tóm Tắt Vấn Đề

Bạn thêm đơn hàng lúc **22h39 ngày 21/11** (giờ VN), nhưng database hiển thị giờ khác, khiến bộ lọc thời gian không chính xác.

**Nguyên nhân**: Hệ thống lưu UTC timestamp nhưng một số chỗ chưa chuyển đổi đúng sang múi giờ Việt Nam (UTC+7).

## Giải Pháp Đã Thực Hiện

### ✅ 1. Đã Có Sẵn
- File `public/assets/js/timezone-utils.js` với đầy đủ hàm chuyển đổi timezone
- File đã được import vào `public/admin/orders.html`
- Backend đang lưu `created_at_unix` (Unix timestamp UTC)
- Frontend đang dùng `getVNStartOfToday()`, `getVNEndOfToday()` cho bộ lọc

### ✅ 2. Đã Fix
- **Thêm hàm `toVNDate()`** vào `timezone-utils.js` (hàm này bị thiếu)
- **Tạo migration script** để đảm bảo tất cả đơn hàng có `created_at_unix`
- **Tạo debug tool** để kiểm tra timestamp

### ✅ 3. Files Mới Tạo
1. `docs/TIMEZONE_FIX_GUIDE.md` - Hướng dẫn chi tiết về timezone
2. `database/migrations/fix_timezone_timestamps.sql` - Migration SQL
3. `database/run-timezone-migration.js` - Script chạy migration
4. `test_timezone_debug.html` - Tool debug timestamp
5. `TIMEZONE_FIX_STEPS.md` - File này

## Các Bước Thực Hiện

### Bước 1: Chạy Migration (Quan Trọng!)

Migration này sẽ đảm bảo tất cả đơn hàng cũ đều có `created_at_unix`:

```bash
# Chạy migration
node database/run-timezone-migration.js
```

**Lưu ý**: Nếu gặp lỗi với Node.js, bạn có thể chạy trực tiếp bằng wrangler:

```bash
# Chạy từng lệnh SQL
wrangler d1 execute ctv-management --file="database/migrations/fix_timezone_timestamps.sql" --local
```

### Bước 2: Test Hệ Thống

#### 2.1. Mở Debug Tool

Mở file `test_timezone_debug.html` trong trình duyệt:

```bash
# Nếu dùng VS Code Live Server
# Right-click -> Open with Live Server

# Hoặc mở trực tiếp
# file:///path/to/your/project/test_timezone_debug.html
```

**Kiểm tra**:
- ✅ Giờ VN và UTC chênh nhau đúng 7 giờ
- ✅ Click "Tải 10 Đơn Hàng Gần Nhất" - cột "Chênh lệch" phải hiển thị "7h" (màu xanh)
- ✅ Thử chuyển đổi timestamp - kết quả phải đúng

#### 2.2. Test Trang Orders

1. Mở `public/admin/orders.html`
2. Tạo một đơn hàng mới
3. **Kiểm tra**:
   - Thời gian hiển thị phải đúng giờ VN (ví dụ: 22:39)
   - Lọc "Hôm nay" phải hiển thị đơn vừa tạo
   - Lọc "Tuần này", "Tháng này" phải hoạt động đúng

#### 2.3. Test Bộ Lọc

Thử các bộ lọc sau:
- ✅ **Hôm nay**: Chỉ hiển thị đơn từ 00:00 đến 23:59 (giờ VN)
- ✅ **Hôm qua**: Đơn của ngày hôm qua
- ✅ **Tuần này**: Từ thứ 2 tuần này
- ✅ **Tháng này**: Từ ngày 1 tháng này

### Bước 3: Verify Database

Kiểm tra trong database xem timestamp có đúng không:

```bash
# Xem 10 đơn hàng gần nhất
wrangler d1 execute ctv-management --command="
SELECT 
  order_id,
  datetime(created_at_unix/1000, 'unixepoch') as utc_time,
  datetime(created_at_unix/1000, 'unixepoch', '+7 hours') as vn_time
FROM orders 
ORDER BY id DESC 
LIMIT 10
" --local
```

**Expected**: 
- `utc_time` là giờ UTC (ví dụ: 15:39)
- `vn_time` là giờ VN (ví dụ: 22:39)
- Chênh lệch đúng 7 giờ

## Cách Hoạt Động

### Khi Tạo Đơn Hàng

```javascript
// Frontend (orders.js)
const requestData = {
  // Không gửi orderDate, backend tự tạo UTC timestamp
  customer: {...},
  products: [...],
  ...
};

// Backend (worker.js)
const orderDate = data.orderDate || new Date().getTime(); // UTC
const orderTimestamp = new Date(orderDate).getTime();

INSERT INTO orders (
  order_date,        // UTC timestamp
  created_at_unix,   // UTC timestamp (milliseconds)
  ...
)
```

### Khi Hiển Thị

```javascript
// Frontend (orders.js)
function formatDateTime(dateString) {
  // Chuyển UTC sang VN timezone
  return toVNDateString(dateString); // "21/11/2024, 22:39:15"
}
```

### Khi Lọc

```javascript
// Frontend (orders.js)
if (dateFilter === 'today') {
  const todayStart = getVNStartOfToday();  // 00:00:00 VN = 17:00:00 UTC (ngày hôm trước)
  const todayEnd = getVNEndOfToday();      // 23:59:59 VN = 16:59:59 UTC (ngày hôm nay)
  
  matchesDate = orderDate >= todayStart && orderDate <= todayEnd;
}
```

## Troubleshooting

### Vấn đề: Thời gian vẫn sai

**Giải pháp**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Kiểm tra console có lỗi không
4. Verify `timezone-utils.js` đã được load: mở Console và gõ `typeof getVNStartOfToday` (phải là "function")

### Vấn đề: Bộ lọc không hoạt động

**Giải pháp**:
1. Mở Console (F12)
2. Xem log khi click bộ lọc
3. Kiểm tra `filteredOrdersData.length`
4. Verify `created_at_unix` có giá trị trong database

### Vấn đề: Migration thất bại

**Giải pháp**:
1. Chạy từng lệnh SQL riêng lẻ
2. Kiểm tra database có cột `created_at_unix` chưa:
   ```bash
   wrangler d1 execute ctv-management --command="PRAGMA table_info(orders)" --local
   ```
3. Nếu thiếu, chạy:
   ```bash
   wrangler d1 execute ctv-management --command="ALTER TABLE orders ADD COLUMN created_at_unix INTEGER" --local
   ```

## Kiểm Tra Cuối Cùng

Sau khi hoàn thành tất cả các bước:

- [ ] Migration chạy thành công
- [ ] Debug tool hiển thị đúng (chênh lệch 7h)
- [ ] Tạo đơn hàng mới, thời gian hiển thị đúng giờ VN
- [ ] Bộ lọc "Hôm nay" hoạt động chính xác
- [ ] Bộ lọc "Tuần này", "Tháng này" hoạt động đúng
- [ ] Không có lỗi trong Console

## Kết Luận

Hệ thống của bạn đã được chuẩn hóa theo best practice:

✅ **Backend**: Lưu UTC timestamp (chuẩn quốc tế)
✅ **Database**: Có `created_at_unix` cho tất cả đơn hàng
✅ **Frontend**: Tự động chuyển đổi sang VN timezone
✅ **Bộ lọc**: Chính xác theo múi giờ Việt Nam

**Lợi ích**:
- Dễ mở rộng quốc tế
- Không bị lỗi Daylight Saving Time
- Dễ debug và maintain
- Thống kê chính xác

## Tài Liệu Tham Khảo

- `docs/TIMEZONE_FIX_GUIDE.md` - Hướng dẫn chi tiết
- `public/assets/js/timezone-utils.js` - Các hàm timezone
- `test_timezone_debug.html` - Debug tool

## Hỗ Trợ

Nếu vẫn gặp vấn đề, hãy:
1. Mở `test_timezone_debug.html` và chụp màn hình
2. Mở Console (F12) và copy toàn bộ log
3. Chạy query kiểm tra database và copy kết quả
