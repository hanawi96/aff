# Fix CTV Timestamp Timezone Issue

## Vấn đề

Khi chọn bộ lọc "Hôm nay" ở trang danh sách CTV, dữ liệu trong summary và bảng danh sách không khớp nhau.

## Nguyên nhân

1. **Database Schema**: Bảng `ctv` sử dụng `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
   - SQLite lưu timestamp dưới dạng `YYYY-MM-DD HH:MM:SS` (UTC)
   - Ví dụ: `2024-11-22 10:30:00`

2. **Backend Query**: Hàm `getAllCTV()` trong `worker.js` query trực tiếp:
   ```sql
   SELECT created_at as timestamp FROM ctv
   ```
   - Trả về string `2024-11-22 10:30:00` (không có timezone indicator)

3. **Frontend Parsing**: JavaScript parse string này theo local timezone
   - `new Date('2024-11-22 10:30:00')` → Được hiểu là local time, không phải UTC
   - Dẫn đến sai lệch 7 giờ khi so sánh với VN timezone

## Giải pháp

### 1. Database Migration (030_add_unix_timestamp_to_ctv.sql)

Thêm cột `created_at_unix` để lưu Unix timestamp (milliseconds):

```sql
ALTER TABLE ctv ADD COLUMN created_at_unix INTEGER;

UPDATE ctv 
SET created_at_unix = CAST(strftime('%s', created_at) AS INTEGER) * 1000
WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ctv_created_at_unix ON ctv(created_at_unix);
```

### 2. Backend Fix (worker.js)

**Query sử dụng `created_at_unix`:**

```sql
SELECT created_at_unix as timestamp FROM ctv
```

**Insert CTV mới:**

```javascript
const now = Date.now(); // Unix timestamp in milliseconds
INSERT INTO ctv (..., created_at_unix) VALUES (..., ?)
```

- Unix timestamp luôn là UTC (theo định nghĩa)
- Không cần convert hay thêm timezone indicator
- JavaScript `new Date(timestamp)` tự động parse đúng

### 2. Frontend Enhancement (admin.js)

Đã có sẵn các hàm timezone helper trong `timezone-utils.js`:
- `getVNStartOfToday()` - Lấy 00:00:00 VN time hôm nay
- `getVNStartOfWeek()` - Lấy thứ 2 tuần này
- `getVNStartOfMonth()` - Lấy ngày 1 tháng này

Hàm `applyTimeFilter()` sử dụng các helper này để so sánh đúng timezone.

### 3. Summary Sync

Hàm `updateStats()` được cập nhật để:
- Tính toán dựa trên `filteredCTVData` thay vì `allCTVData`
- Đồng bộ với bộ lọc hiện tại
- Cập nhật ngay khi filter thay đổi

## Kết quả

✅ Timestamp được parse đúng timezone UTC
✅ So sánh thời gian chính xác với VN timezone
✅ Summary đồng bộ với dữ liệu đã lọc
✅ Hiệu suất tốt (không cần gọi API thêm)

## Testing

1. Mở trang danh sách CTV
2. Click button "Hôm nay"
3. Kiểm tra console log để xem timestamp parsing
4. Verify summary numbers khớp với số dòng trong bảng

## Debug Commands

```javascript
// Check timestamp format from API
console.log('Raw timestamp:', ctv.timestamp);
console.log('Parsed date:', new Date(ctv.timestamp).toISOString());
console.log('VN time:', new Date(ctv.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
```

## Related Files

- `database/schema.sql` - Database schema
- `worker.js` - Backend API (getAllCTV function)
- `public/assets/js/admin.js` - Frontend logic
- `public/assets/js/timezone-utils.js` - Timezone helper functions
