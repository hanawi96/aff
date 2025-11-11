# 📱 Thêm Số 0 Đầu Tiên - Số Điện Thoại

## ✅ ĐÃ CẬP NHẬT

Số điện thoại bị mất số 0 đầu tiên trong sheet sẽ được tự động thêm lại trước khi che.

## 📊 Logic Mới

### Trước Khi Che

1. **Kiểm tra số điện thoại**: Chỉ chứa số (0-9)
2. **Kiểm tra độ dài**: Nếu có 9 số
3. **Kiểm tra số đầu**: Nếu không bắt đầu bằng "0"
4. **Thêm số 0**: Thêm "0" vào đầu
5. **Che 4 số cuối**: Che 4 số cuối

### Code

```javascript
const maskPhone = (phone) => {
    if (!phone) return '****';
    
    let phoneStr = phone.toString().trim();
    
    // Nếu là số điện thoại (chỉ chứa số)
    if (/^\d+$/.test(phoneStr)) {
        // Thêm số 0 ở đầu nếu chưa có (số điện thoại VN)
        if (!phoneStr.startsWith('0') && phoneStr.length === 9) {
            phoneStr = '0' + phoneStr;
        }
        
        // Che 4 số cuối
        if (phoneStr.length >= 4) {
            return phoneStr.slice(0, -4) + '****';
        }
    }
    
    return '****';
};
```

## 🧪 Test Cases

### Test 1: Số Điện Thoại Thiếu Số 0 (9 số)

**Input**: `386190596`  
**Xử lý**: Thêm "0" → `0386190596`  
**Output**: `03861****` ✅

**Input**: `901234567`  
**Xử lý**: Thêm "0" → `0901234567`  
**Output**: `09012****` ✅

### Test 2: Số Điện Thoại Đã Có Số 0 (10 số)

**Input**: `0386190596`  
**Xử lý**: Giữ nguyên  
**Output**: `03861****` ✅

**Input**: `0901234567`  
**Xử lý**: Giữ nguyên  
**Output**: `09012****` ✅

### Test 3: Số Điện Thoại Khác (Không Phải 9 Hoặc 10 Số)

**Input**: `12345678` (8 số)  
**Xử lý**: Không thêm 0, che 4 số cuối  
**Output**: `1234****` ✅

**Input**: `12345678901` (11 số)  
**Xử lý**: Không thêm 0, che 4 số cuối  
**Output**: `1234567****` ✅

### Test 4: Không Phải Số

**Input**: `"Liên hệ admin"`  
**Output**: `****` ✅

**Input**: `null`  
**Output**: `****` ✅

## 📋 Kết Quả Trên Website

### Trường Hợp 1: Sheet Có Số Thiếu 0 (386190596)

```
┌─────────────────────────────────────────┐
│ 👤 Thông Tin Cộng Tác Viên              │
├─────────────────────────────────────────┤
│ 👤 Họ và Tên: yên                       │
│ 📱 Số Điện Thoại: 03861****  ← Đã thêm 0│
│ 📍 Địa Chỉ: TP.HCM                      │
└─────────────────────────────────────────┘
```

### Trường Hợp 2: Sheet Có Số Đầy Đủ (0386190596)

```
┌─────────────────────────────────────────┐
│ 👤 Thông Tin Cộng Tác Viên              │
├─────────────────────────────────────────┤
│ 👤 Họ và Tên: yên                       │
│ 📱 Số Điện Thoại: 03861****  ← Giữ nguyên│
│ 📍 Địa Chỉ: TP.HCM                      │
└─────────────────────────────────────────┘
```

## 🔍 Console Logs

Khi thêm số 0, bạn sẽ thấy log:

```javascript
📱 Added leading 0 to phone: 0386190596
```

## 🧪 Test Ngay

Mở file `test-ctv-info-display.html` và chạy:

```javascript
// Test với số thiếu 0
testCase1(); // Input: 386190596 → Output: 03861****
```

## 📦 Deploy

### Bước 1: Upload File

Upload file `public/assets/js/ctv.js` lên server

### Bước 2: Clear Cache

Nhấn `Ctrl+Shift+R` (Windows) hoặc `Cmd+Shift+R` (Mac)

### Bước 3: Test

1. Nhập mã CTV: `PARTNER001`
2. Xem số điện thoại: Phải là `03861****` (có số 0 đầu)
3. Xem console: Có log "Added leading 0" không?

## ✅ Checklist

- [x] Code đã cập nhật
- [x] Tự động thêm số 0 cho số 9 chữ số
- [x] Giữ nguyên số 0 nếu đã có
- [x] Che 4 số cuối sau khi thêm 0
- [x] Test file HTML đã cập nhật
- [ ] Upload file JS lên server
- [ ] Clear cache browser
- [ ] Test trên website
- [ ] Xác nhận số điện thoại có số 0 đầu

## 🎯 Tóm Tắt

| Input (Sheet) | Xử Lý | Output (Website) |
|---------------|-------|------------------|
| `386190596` (9 số) | Thêm "0" | `03861****` ✅ |
| `0386190596` (10 số) | Giữ nguyên | `03861****` ✅ |
| `901234567` (9 số) | Thêm "0" | `09012****` ✅ |
| `0901234567` (10 số) | Giữ nguyên | `09012****` ✅ |
| `12345678` (8 số) | Không thêm | `1234****` ✅ |
| `"Liên hệ admin"` | N/A | `****` ✅ |

---

**Upload file `public/assets/js/ctv.js` và clear cache là xong!** 📱
