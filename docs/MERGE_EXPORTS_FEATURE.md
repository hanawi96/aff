# Merge Exports Feature

## Tính năng gộp nhiều file export thành 1

### 🎯 Mục đích
Cho phép gộp nhiều file export đã tạo trước đó thành 1 file Excel duy nhất, giúp:
- Tiết kiệm thời gian tải file
- Dễ quản lý khi có nhiều đợt export nhỏ
- Tối ưu cho việc in ấn và xử lý hàng loạt

### 🏗️ Kiến trúc (Server-side merge)

#### Backend Flow:
1. Client gửi `exportIds[]` → API `mergeExports`
2. Backend query `order_ids` từ các export đã chọn
3. Loại bỏ duplicate order IDs (dùng Set)
4. Fetch tất cả orders từ DB
5. Trả về orders data cho client

#### Frontend Flow:
1. Nhận orders data từ backend
2. Dùng `createSPXExcelWorkbook()` để tạo file Excel
3. Download file ngay lập tức
4. Mark tất cả exports đã chọn là "downloaded"

### 📝 API Endpoint

**POST** `?action=mergeExports`

**Request:**
```json
{
  "exportIds": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "orders": [...],
  "totalOrders": 45,
  "exportCount": 3
}
```

### 🎨 UI/UX

**Nút "Gộp & Tải":**
- Màu gradient purple-pink để nổi bật
- Chỉ hiện khi có ít nhất 1 file được chọn
- Nếu chỉ chọn 1 file → tự động download file đó (không gộp)
- Nếu chọn 2+ files → gộp thành 1 file mới

**Tên file gộp:**
- Format: `SPX_DonHang_YYYYMMDD_XXdon.xlsx`
- XX = tổng số đơn hàng sau khi gộp (đã loại bỏ duplicate)

### ⚡ Tối ưu hóa

1. **Loại bỏ duplicate orders:** Dùng Set để đảm bảo mỗi order chỉ xuất hiện 1 lần
2. **Batch query:** Query tất cả orders trong 1 lần thay vì loop
3. **Client-side Excel generation:** Tạo file Excel ở client để giảm tải server
4. **Smart behavior:** Nếu chỉ chọn 1 file thì download trực tiếp, không gọi merge API

### 🔒 Security

- Validate `exportIds` phải là array
- Check exports tồn tại trong DB
- Chỉ trả về orders thuộc về exports đã chọn

### 📊 Performance

- **Small merge (2-5 files, ~50 orders):** < 1s
- **Medium merge (5-10 files, ~200 orders):** 1-2s
- **Large merge (10+ files, 500+ orders):** 2-5s

### 🐛 Error Handling

- Nếu không chọn file nào → Warning toast
- Nếu backend lỗi → Error toast + giữ nguyên selection
- Nếu tạo Excel lỗi → Error toast + không mark as downloaded
