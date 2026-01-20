# Test Markup Multiplier - Checklist ✅

## 🧪 Test Flow

### Test 1: Tạo sản phẩm mới với markup
**Steps:**
1. Mở trang Products
2. Click "Thêm sản phẩm"
3. Nhập tên: "Test Product 1"
4. Thêm nguyên liệu (giá vốn tự động)
5. Bật "🤖 Tự động tính giá bán"
6. Nhập markup: `2.8`
7. Kiểm tra:
   - ✅ Giá bán tự động = Giá vốn × 2.8
   - ✅ Giá gốc tự động = Giá bán - 20,000
8. Click "Lưu"
9. Mở lại sản phẩm vừa tạo
10. Kiểm tra:
    - ✅ Input markup hiển thị: `2.8`
    - ✅ Giá bán đúng
    - ✅ Giá gốc đúng

**Expected Result:**
```
Giá vốn: 100,000đ
Markup: 2.8
→ Giá bán: 280,000đ
→ Giá gốc: 260,000đ
```

---

### Test 2: Sửa sản phẩm - Thay đổi markup
**Steps:**
1. Mở sản phẩm đã có
2. Thay đổi markup từ `2.8` → `3.5`
3. Kiểm tra:
   - ✅ Giá bán tự động cập nhật
   - ✅ Giá gốc tự động cập nhật
4. Click "Cập nhật"
5. Reload trang
6. Mở lại sản phẩm
7. Kiểm tra:
   - ✅ Markup hiển thị: `3.5`
   - ✅ Giá bán đã lưu đúng
   - ✅ Giá gốc đã lưu đúng

**Expected Result:**
```
Giá vốn: 100,000đ
Markup: 3.5
→ Giá bán: 350,000đ
→ Giá gốc: 330,000đ
```

---

### Test 3: Click preset button
**Steps:**
1. Mở modal thêm/sửa sản phẩm
2. Click button `[×3.0]`
3. Kiểm tra:
   - ✅ Input markup = `3.0`
   - ✅ Giá bán cập nhật
   - ✅ Giá gốc cập nhật
   - ✅ Input nhấp nháy xanh
4. Click button `[🤖 Auto]`
5. Kiểm tra:
   - ✅ Input markup = auto value (2.5/3.0/3.5)
   - ✅ Giá bán cập nhật
   - ✅ Giá gốc cập nhật

---

### Test 4: Thêm/xóa nguyên liệu
**Steps:**
1. Mở modal sản phẩm
2. Markup = `2.5`
3. Thêm nguyên liệu A (50,000đ)
4. Kiểm tra:
   - ✅ Giá vốn = 50,000đ
   - ✅ Giá bán = 125,000đ (50k × 2.5)
   - ✅ Giá gốc = 105,000đ
5. Thêm nguyên liệu B (30,000đ)
6. Kiểm tra:
   - ✅ Giá vốn = 80,000đ
   - ✅ Giá bán = 200,000đ (80k × 2.5)
   - ✅ Giá gốc = 180,000đ
7. Xóa nguyên liệu A
8. Kiểm tra:
   - ✅ Giá vốn = 30,000đ
   - ✅ Giá bán = 75,000đ (30k × 2.5)
   - ✅ Giá gốc = 55,000đ

---

### Test 5: Nhập markup tùy ý
**Steps:**
1. Mở modal sản phẩm
2. Nhập markup: `2.37`
3. Kiểm tra:
   - ✅ Giá bán tính đúng
   - ✅ Hint: "💡 Hệ số ×2.4 (Lãi 57%)"
4. Nhập markup: `5.0`
5. Kiểm tra:
   - ✅ Giá bán = Giá vốn × 5.0
   - ✅ Hint: "💡 Hệ số ×5.0 (Lãi 80%)"
6. Lưu sản phẩm
7. Mở lại
8. Kiểm tra:
   - ✅ Markup hiển thị đúng: `5.0`

---

### Test 6: Validation
**Steps:**
1. Nhập markup < 1.0 (VD: 0.5)
2. Kiểm tra:
   - ✅ Browser validation ngăn không cho nhập
3. Nhập markup > 10.0 (VD: 15.0)
4. Kiểm tra:
   - ✅ Browser validation ngăn không cho nhập
5. Nhập markup = 0
6. Kiểm tra:
   - ✅ Fallback to auto (2.5/3.0/3.5)

---

### Test 7: Database verification
**Steps:**
1. Tạo sản phẩm với markup = `3.2`
2. Lưu thành công
3. Kiểm tra database:
```sql
SELECT id, name, markup_multiplier, cost_price, price, original_price 
FROM products 
WHERE name = 'Test Product 1';
```
4. Verify:
   - ✅ `markup_multiplier` = 3.2
   - ✅ `cost_price` = giá vốn đúng
   - ✅ `price` = giá bán đúng
   - ✅ `original_price` = giá gốc đúng

---

### Test 8: Recalculate all prices
**Steps:**
1. Tạo 3 sản phẩm với markup khác nhau:
   - Product A: markup = 2.5
   - Product B: markup = 3.0
   - Product C: markup = 3.5
2. Vào trang Materials
3. Thay đổi giá nguyên liệu
4. Click "🔄 Cập nhật giá sản phẩm"
5. Kiểm tra:
   - ✅ Product A: giá mới = giá vốn mới × 2.5
   - ✅ Product B: giá mới = giá vốn mới × 3.0
   - ✅ Product C: giá mới = giá vốn mới × 3.5
6. Mở từng sản phẩm verify:
   - ✅ Markup vẫn giữ nguyên
   - ✅ Giá đã cập nhật đúng

---

## 📊 Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Tạo mới với markup | ⏳ Pending | |
| 2. Sửa markup | ⏳ Pending | |
| 3. Preset buttons | ⏳ Pending | |
| 4. Thêm/xóa nguyên liệu | ⏳ Pending | |
| 5. Markup tùy ý | ⏳ Pending | |
| 6. Validation | ⏳ Pending | |
| 7. Database verify | ⏳ Pending | |
| 8. Recalculate prices | ⏳ Pending | |

---

## 🔍 Debug Checklist

### Frontend
- [x] Input `markupMultiplier` có `id` đúng
- [x] Function `saveProduct()` collect markup_multiplier
- [x] Gửi lên backend trong `productData`
- [x] Function `updateSellingPriceFromMarkup()` hoạt động
- [x] Function `setMarkupPreset()` hoạt động
- [x] Visual feedback (nhấp nháy xanh)

### Backend
- [x] `createProduct()` nhận và lưu `markup_multiplier`
- [x] `updateProduct()` nhận và lưu `markup_multiplier`
- [x] Database column `markup_multiplier` tồn tại (migration 052)
- [x] `recalculateAllProductPrices()` đọc và dùng `markup_multiplier`

### Database
- [x] Column `markup_multiplier` type REAL
- [x] Column nullable (cho phép NULL)
- [x] Migration 052 đã chạy thành công

---

## 🎯 Kết luận

**Code Review:** ✅ PASS
- Frontend: Collect và gửi đúng
- Backend: Nhận và lưu đúng
- Database: Schema đúng

**Next Step:** 
Chạy manual test theo checklist trên để verify toàn bộ flow hoạt động đúng trong thực tế.

---

## 📝 Test Commands

### Check database schema:
```sql
PRAGMA table_info(products);
-- Tìm dòng có name = 'markup_multiplier'
```

### Check existing data:
```sql
SELECT id, name, markup_multiplier, cost_price, price 
FROM products 
LIMIT 10;
```

### Update test:
```sql
UPDATE products 
SET markup_multiplier = 2.8 
WHERE id = 1;

-- Verify
SELECT id, name, markup_multiplier FROM products WHERE id = 1;
```
