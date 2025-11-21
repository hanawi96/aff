# ✅ Test Checklist - Bulk Actions cho Mã Giảm Giá

## 🎯 Các tính năng cần test:

### 1. Checkbox Selection
- [ ] Checkbox "Select All" ở header hoạt động
- [ ] Click "Select All" → tất cả checkbox được chọn
- [ ] Uncheck "Select All" → tất cả checkbox bỏ chọn
- [ ] Click từng checkbox riêng lẻ hoạt động
- [ ] Selections được giữ khi filter/search

### 2. Bulk Actions Bar
- [ ] Bar xuất hiện khi chọn ít nhất 1 mã
- [ ] Bar hiển thị đúng số lượng mã đã chọn
- [ ] Animation smooth khi show/hide
- [ ] Bar ở vị trí bottom center, fixed
- [ ] Gradient màu indigo-purple đẹp

### 3. Bulk Activate
- [ ] Nút "Kích hoạt" hiển thị đúng
- [ ] Click hiện confirm dialog
- [ ] Kích hoạt thành công → hiện success message
- [ ] Reload data sau khi kích hoạt
- [ ] Clear selections sau khi thành công
- [ ] Xử lý lỗi đúng (nếu có)

### 4. Bulk Deactivate
- [ ] Nút "Tạm dừng" hiển thị đúng
- [ ] Click hiện confirm dialog
- [ ] Tạm dừng thành công → hiện success message
- [ ] Reload data sau khi tạm dừng
- [ ] Clear selections sau khi thành công
- [ ] Xử lý lỗi đúng (nếu có)

### 5. Bulk Export
- [ ] Nút "Export" hiển thị đúng
- [ ] Export tạo file CSV
- [ ] File CSV có đúng format
- [ ] File CSV có BOM UTF-8 (hiển thị tiếng Việt đúng)
- [ ] Tên file có timestamp
- [ ] Chỉ export các mã đã chọn

### 6. Bulk Delete
- [ ] Nút "Xóa" hiển thị đúng màu đỏ
- [ ] Click hiện warning dialog
- [ ] Xóa thành công → hiện success message
- [ ] Xử lý đúng khi mã đã được sử dụng (không cho xóa)
- [ ] Reload data sau khi xóa
- [ ] Clear selections sau khi thành công

### 7. Clear Selection
- [ ] Nút "X" hiển thị đúng
- [ ] Click clear tất cả selections
- [ ] Bar biến mất sau khi clear
- [ ] Select All checkbox bỏ chọn

### 8. Edge Cases
- [ ] Chọn 0 mã → bar không hiện
- [ ] Chọn 1 mã → hiển thị "1 mã"
- [ ] Chọn nhiều mã → hiển thị đúng số
- [ ] Filter sau khi chọn → selections vẫn giữ
- [ ] Reload page → selections bị clear
- [ ] Xóa mã đang được chọn → selection tự động remove

## 🎨 UI/UX Check:

- [ ] Checkbox align center đẹp
- [ ] Hover effect trên checkbox
- [ ] Bulk bar có shadow đẹp
- [ ] Buttons có hover scale effect
- [ ] Icons hiển thị đúng
- [ ] Màu sắc consistent với theme
- [ ] Responsive trên mobile
- [ ] Animation mượt mà

## 🔧 Technical Check:

- [ ] Không có console errors
- [ ] API calls hoạt động đúng
- [ ] State management đúng
- [ ] Memory không leak
- [ ] Performance tốt với nhiều mã

## 📝 Test Scenarios:

### Scenario 1: Basic Flow
1. Vào trang discounts
2. Check 3 mã bất kỳ
3. Click "Kích hoạt"
4. Confirm
5. Verify: 3 mã được kích hoạt, selections cleared

### Scenario 2: Select All
1. Click "Select All"
2. Verify: Tất cả mã được chọn
3. Click "Tạm dừng"
4. Confirm
5. Verify: Tất cả mã bị tạm dừng

### Scenario 3: Export
1. Check 5 mã
2. Click "Export"
3. Verify: File CSV được download
4. Mở file → check encoding UTF-8
5. Verify: Có đúng 5 mã trong file

### Scenario 4: Delete with Error
1. Check 1 mã đã được sử dụng
2. Click "Xóa"
3. Confirm
4. Verify: Hiện error message
5. Verify: Mã không bị xóa

### Scenario 5: Mixed Actions
1. Check 10 mã
2. Click "Kích hoạt" → 10 mã active
3. Check 5 mã khác
4. Click "Export" → export 5 mã
5. Check 3 mã
6. Click "Xóa" → xóa 3 mã

## ✨ Expected Results:

- ✅ Tất cả checkboxes hoạt động mượt mà
- ✅ Bulk bar xuất hiện/biến mất smooth
- ✅ Tất cả actions thực hiện đúng
- ✅ Error handling tốt
- ✅ UI đẹp, professional
- ✅ UX trực quan, dễ dùng
- ✅ Performance tốt

---

**Test Date:** _____________  
**Tester:** _____________  
**Status:** [ ] PASS / [ ] FAIL  
**Notes:** _____________
