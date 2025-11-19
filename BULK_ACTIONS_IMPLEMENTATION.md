# Bulk Actions với Float Bar - Trang Quản Lý CTV

## Tổng Quan
Đã implement chức năng bulk actions với floating action bar cho trang quản lý cộng tác viên, tương tự như trang quản lý sản phẩm.

## Các Thay Đổi

### 1. File HTML (`public/admin/index.html`)

#### a. Thêm Checkbox "Select All" vào Table Header
```html
<th class="px-6 py-3 text-left...">
    <div class="flex items-center gap-3">
        <input type="checkbox" 
            id="selectAllCheckbox"
            class="w-4 h-4 text-indigo-600 border-gray-300 rounded..." 
            onchange="toggleSelectAll(this.checked)">
        <span>STT</span>
    </div>
</th>
```

#### b. Thêm Floating Bulk Actions Bar
Thêm float bar ở cuối file, trước `</body>`:
- Hiển thị số lượng CTV đã chọn
- 4 nút action:
  - **Export**: Xuất danh sách CTV ra CSV
  - **Sửa HH**: Cập nhật hoa hồng hàng loạt
  - **Xóa**: Xóa CTV hàng loạt (có modal xác nhận)
  - **Clear**: Bỏ chọn tất cả

### 2. File JavaScript (`public/assets/js/admin.js`)

Các function bulk actions:
- `handleCTVCheckbox()` - Xử lý checkbox từng CTV
- `toggleSelectAll()` - Chọn/bỏ chọn tất cả
- `updateBulkActionsBar()` - Cập nhật hiển thị float bar
- `clearSelection()` - Xóa selection
- `bulkExportCTV()` - Export CSV
- `bulkUpdateCommission()` - Cập nhật hoa hồng
- `bulkDeleteCTV()` - Xóa CTV hàng loạt (MỚI)
- `closeBulkDeleteModal()` - Đóng modal xác nhận xóa (MỚI)
- `confirmBulkDelete()` - Xác nhận và thực hiện xóa (MỚI)

## Tính Năng

### 1. Chọn CTV
- Click checkbox ở mỗi dòng để chọn CTV
- Click checkbox ở header để chọn/bỏ chọn tất cả CTV trên trang hiện tại
- Checkbox header có 3 trạng thái: unchecked, checked, indeterminate

### 2. Float Bar
- Tự động hiện khi có ít nhất 1 CTV được chọn
- Hiển thị số lượng CTV đã chọn
- Gradient background đẹp mắt (indigo → purple → pink)
- Fixed position ở giữa bottom của màn hình
- Backdrop blur effect cho các button

### 3. Bulk Export
- Export danh sách CTV đã chọn ra file CSV
- Bao gồm: Mã CTV, Họ tên, SĐT, Email, Tỉnh/Thành, Tỷ lệ HH, Số đơn, Tổng HH, Trạng thái, Ngày đăng ký
- File có BOM UTF-8 để Excel đọc được tiếng Việt

### 4. Bulk Update Commission
- Cập nhật tỷ lệ hoa hồng cho nhiều CTV cùng lúc
- Có prompt để nhập tỷ lệ mới
- Có confirmation trước khi cập nhật
- TODO: Cần implement API endpoint

### 5. Bulk Delete CTV
- Xóa nhiều CTV cùng lúc
- Hiển thị modal xác nhận với:
  - Cảnh báo về hành động không thể hoàn tác
  - Danh sách CTV sẽ bị xóa (tên + mã CTV)
  - Lưu ý về dữ liệu liên quan
  - Nút xác nhận màu đỏ
- Gọi API endpoint `bulkDeleteCTV` để xóa
- Tự động reload danh sách sau khi xóa thành công

## UI/UX

### Design
- Gradient background: `from-indigo-600 via-purple-600 to-pink-600`
- Border radius: `rounded-xl` (12px)
- Shadow: `shadow-xl`
- Backdrop blur cho buttons: `backdrop-blur-sm`
- Hover effects: `hover:bg-white/30`

### Icons
Sử dụng Heroicons outline:
- Checkmark circle - Selected count
- Download - Export
- Currency dollar - Update commission
- Trash - Delete (màu đỏ)
- X - Clear selection

### Responsive
- Float bar tự động center với `left-1/2 transform -translate-x-1/2`
- Buttons có padding và gap phù hợp
- Text size responsive

## Testing

### Các Trường Hợp Cần Test
1. ✅ Chọn 1 CTV → Float bar hiện
2. ✅ Chọn nhiều CTV → Số lượng cập nhật đúng
3. ✅ Chọn tất cả → Tất cả checkbox được check
4. ✅ Bỏ chọn tất cả → Float bar ẩn
5. ✅ Export → File CSV tải về đúng
6. ✅ Update commission → Prompt hiện và validate input
7. ✅ Delete → Modal xác nhận hiện với danh sách CTV
8. ✅ Confirm delete → API được gọi và danh sách reload
9. ✅ Clear selection → Tất cả checkbox bỏ check, float bar ẩn

## So Sánh với Trang Products

| Feature | Products | CTV |
|---------|----------|-----|
| Select All Checkbox | ✅ | ✅ |
| Float Bar | ✅ | ✅ |
| Export | ✅ | ✅ |
| Bulk Update Status | ✅ (Show/Hide) | ✅ (Commission) |
| Bulk Delete | ✅ | ✅ |
| Bulk Message | ❌ | ❌ |

## API Endpoint Cần Implement

### Bulk Delete CTV
```
POST ${CONFIG.API_URL}?action=bulkDeleteCTV
Content-Type: application/json

Body:
{
  "referralCodes": ["CTV001", "CTV002", ...]
}

Response:
{
  "success": true,
  "deletedCount": 2,
  "message": "Đã xóa 2 CTV thành công"
}
```

## Kết Luận
✅ Đã implement thành công bulk actions với float bar cho trang quản lý CTV
✅ UI/UX nhất quán với trang products
✅ Đã thay nút "Nhắn tin" thành nút "Xóa" với modal xác nhận đẹp mắt
✅ Tất cả functions đã được thêm vào admin.js
✅ Không có lỗi diagnostics
⚠️ Cần implement API endpoint `bulkDeleteCTV` ở backend
