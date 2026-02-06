# 🔧 Fix Lỗi Quick Checkout Modal

## ❌ Các Lỗi Đã Gặp

### 1. `fillDemoData is not a function`
```
quick-checkout.js:609 Uncaught (in promise) TypeError: 
this.addressSelector.fillDemoData is not a function
```

**Nguyên nhân:** `HierarchicalAddressSelector` không có method `fillDemoData()`

### 2. "Thiếu thông tin khách hàng"
```
8787/api/shop/order:1 Failed to load resource: 
the server responded with a status of 400 (Bad Request)
Checkout error: Error: Thiếu thông tin khách hàng
```

**Nguyên nhân:** Field names không khớp giữa validator và code xử lý

### 3. Validation Failed cho Baby Weight Range
```
❌ Form validation failed:
{checkoutBabyWeight: 'Cân nặng phải có dạng: 5kg, 10kg... hoặc "Chưa sinh"'}
```

**Nguyên nhân:** Validation pattern không chấp nhận format khoảng (ví dụ: "6-8kg")

## ✅ Các Fix Đã Thực Hiện

### Fix 1: Xóa `fillDemoData()` Call

**File:** `public/shop/assets/js/features/checkout/quick-checkout.js`

**Trước:**
```javascript
// Fill address
if (this.addressSelector) {
    await this.addressSelector.fillDemoData();
}

showToast('Đã điền dữ liệu demo!', 'success');
```

**Sau:**
```javascript
// Fill address - HierarchicalAddressSelector doesn't have fillDemoData method
// User needs to select address manually

showToast('Đã điền dữ liệu demo! Vui lòng chọn địa chỉ.', 'success');
```

### Fix 2: Map Field Names

**File:** `public/shop/assets/js/features/checkout/quick-checkout.js`

**Vấn đề:**
- Validator field names: `checkoutPhone`, `checkoutName`, `checkoutBabyWeight`...
- Code đang dùng: `formData.phone`, `formData.name`, `formData.babyWeight`...

**Fix:**
```javascript
// Get form data (already validated)
const rawFormData = this.validator.getFormData();

// Map field names (remove "checkout" prefix)
const formData = {
    name: rawFormData.checkoutName || '',
    phone: rawFormData.checkoutPhone || '',
    babyWeight: rawFormData.checkoutBabyWeight || '',
    babyName: rawFormData.checkoutBabyName || '',
    note: rawFormData.checkoutNote || ''
};

// Validate customer info
if (!formData.name || !formData.phone) {
    console.error('❌ Missing customer info');
    showToast('Thiếu thông tin khách hàng', 'error');
    return;
}
```

### Fix 3: Cập Nhật Validation Pattern

**File:** `public/shop/assets/js/shared/constants/validation-rules.js`

**Trước:**
```javascript
babyWeight: {
    required: false,
    pattern: /^(Chưa sinh|\d+kg)$/i,
    message: 'Cân nặng phải có dạng: 5kg, 10kg... hoặc "Chưa sinh"'
},
```

**Sau:**
```javascript
babyWeight: {
    required: false,
    pattern: /^(Chưa sinh|unborn|\d+kg|\d+-\d+kg)$/i,
    message: 'Cân nặng phải có dạng: 5kg, 6-8kg... hoặc "Chưa sinh"'
},
```

**Pattern mới chấp nhận:**
- ✅ `Chưa sinh` (tiếng Việt)
- ✅ `unborn` (English)
- ✅ `5kg`, `10kg`, `18kg` (single weight)
- ✅ `3-4kg`, `6-8kg`, `10-12kg` (range weight)

### Fix 4: Thêm Debug Logs

**File:** `public/shop/assets/js/features/checkout/quick-checkout.js`

Thêm console.log để dễ debug:
```javascript
console.log('🚀 Starting checkout submission...');
console.log('📋 Validation result:', validationResult);
console.log('📍 Address validation:', addressValidation);
console.log('📝 Raw form data:', rawFormData);
console.log('📝 Mapped form data:', formData);
console.log('📍 Address data:', addressData);
```

## 🧪 Test Cases

### Test 1: Chọn Khoảng Cân Nặng
1. Mở modal "Mua ngay"
2. Điền thông tin: Tên, SĐT, Địa chỉ
3. Chọn cân nặng: "6-8kg"
4. Click "Đặt hàng"
5. ✅ Validation pass
6. ✅ Đơn hàng được tạo thành công

### Test 2: Chọn "Chưa Sinh"
1. Mở modal "Mua ngay"
2. Điền thông tin đầy đủ
3. Chọn "❤️ Chưa sinh"
4. Click "Đặt hàng"
5. ✅ Validation pass
6. ✅ Đơn hàng có size "unborn"

### Test 3: Nhập Cân Nặng Custom
1. Mở modal "Mua ngay"
2. Điền thông tin đầy đủ
3. Click "➕ Nhập khác"
4. Nhập "18"
5. Click "Đặt hàng"
6. ✅ Validation pass (format: "18kg")
7. ✅ Đơn hàng được tạo

### Test 4: Thiếu Thông Tin
1. Mở modal "Mua ngay"
2. Chỉ điền tên, không điền SĐT
3. Click "Đặt hàng"
4. ✅ Hiển thị lỗi validation
5. ✅ Không gửi request lên server

## 📊 Validation Pattern Details

### Regex Breakdown

```javascript
/^(Chưa sinh|unborn|\d+kg|\d+-\d+kg)$/i
```

**Giải thích:**
- `^` - Bắt đầu string
- `(...)` - Group
- `Chưa sinh` - Match chính xác "Chưa sinh"
- `|` - Hoặc
- `unborn` - Match chính xác "unborn"
- `|` - Hoặc
- `\d+kg` - Match 1 hoặc nhiều số + "kg" (ví dụ: 5kg, 18kg)
- `|` - Hoặc
- `\d+-\d+kg` - Match số-số+kg (ví dụ: 3-4kg, 6-8kg)
- `$` - Kết thúc string
- `i` - Case insensitive

### Valid Examples

| Input | Valid? | Note |
|-------|--------|------|
| `Chưa sinh` | ✅ | Vietnamese |
| `chưa sinh` | ✅ | Case insensitive |
| `unborn` | ✅ | English |
| `UNBORN` | ✅ | Case insensitive |
| `5kg` | ✅ | Single weight |
| `18kg` | ✅ | Single weight |
| `3-4kg` | ✅ | Range weight |
| `6-8kg` | ✅ | Range weight |
| `10-12kg` | ✅ | Range weight |
| `35-45kg` | ✅ | Adult range |
| `5` | ❌ | Missing "kg" |
| `5 kg` | ❌ | Space not allowed |
| `6~8kg` | ❌ | Wrong separator |

## 🎯 Kết Quả

Sau khi fix:
- ✅ Modal "Mua ngay" hoạt động bình thường
- ✅ Chấp nhận cả single weight và range weight
- ✅ Validation chính xác
- ✅ Không còn lỗi "Thiếu thông tin khách hàng"
- ✅ Đơn hàng được tạo thành công

## 📝 Files Đã Sửa

1. `public/shop/assets/js/features/checkout/quick-checkout.js`
   - Xóa `fillDemoData()` call
   - Thêm field name mapping
   - Thêm validation cho customer info
   - Thêm debug logs

2. `public/shop/assets/js/shared/constants/validation-rules.js`
   - Cập nhật pattern cho `babyWeight`
   - Hỗ trợ range format

---

**Phiên bản:** 1.0.0  
**Ngày fix:** 2025-01-27  
**Developer:** Kiro AI
