# 🔍 DEBUG NGAY - Tìm Nguyên Nhân

## 📊 Tình Trạng Hiện Tại

Từ console log, tôi thấy:
```
⚠️ No CTV info from backend, using fallback
```

Điều này có nghĩa backend **KHÔNG** trả về `ctvInfo` hoặc trả về giá trị không hợp lệ.

## 🚀 BƯỚC 1: Test Backend (QUAN TRỌNG!)

### Chạy Hàm Test Trong Apps Script

1. Mở Google Apps Script
2. Chọn hàm: `testCTVInfoDebug`
3. Click Run (▶️)
4. Xem Logs (View > Logs hoặc Ctrl+Enter)

**Kết quả mong đợi:**

```
═══════════════════════════════════════
🔍 DEBUG: Kiểm tra getCTVInfoByReferralCode
═══════════════════════════════════════

🎯 Testing with code: PARTNER001

📊 RESULT:
  Type: object
  Is null: false
  Is undefined: false
  JSON: {
    "name": "yên",
    "phone": "386190596",
    "address": "TP.HCM"
  }

📋 DETAILS:
  name: "yên"
  phone: "386190596"
  address: "TP.HCM"

✅ VALIDATION:
  Has name: true
  Has phone: true
  Has address: true

═══════════════════════════════════════
```

### Nếu Thấy "Không tìm thấy" hoặc "Chưa cập nhật"

**Nguyên nhân**: Mã CTV không tồn tại trong sheet "DS REF"

**Giải pháp**:
1. Mở sheet "DS REF"
2. Kiểm tra cột "Mã Ref" có chứa "PARTNER001" không
3. Kiểm tra có khoảng trắng thừa không
4. Kiểm tra viết hoa/thường có đúng không

## 🚀 BƯỚC 2: Test API Endpoint

### Chạy Hàm Test API

1. Trong Apps Script, chọn hàm: `testCTVInfoQuick`
2. Click Run
3. Xem Logs

**Kết quả mong đợi:**

```
📋 Test 3: API getOrders với PARTNER001
API Response:
  success: true
  orders count: 1
  ctvInfo: {
    "name": "yên",
    "phone": "386190596",
    "address": "TP.HCM"
  }

╔════════════════════════════════════════╗
║   ✅ THÀNH CÔNG - CTV INFO FOUND      ║
║   Name: yên
║   Phone: 386190596
║   Address: TP.HCM
╚════════════════════════════════════════╝
```

### Nếu Thấy "❌ THẤT BẠI"

**Nguyên nhân**: Hàm `getCTVInfoByReferralCode` không hoạt động đúng

**Giải pháp**: Xem logs chi tiết để biết lỗi ở đâu

## 🚀 BƯỚC 3: Kiểm Tra Frontend

### Xem Console Browser

Sau khi chạy test backend, nếu backend OK, kiểm tra frontend:

1. Mở website
2. Nhấn F12 > Console
3. Nhập mã: PARTNER001
4. Xem logs

**Logs mới (chi tiết hơn):**

```javascript
📦 Full API Response: {success: true, orders: [...], ctvInfo: {...}}
📋 CTV Info from backend: {name: "yên", phone: "386190596", address: "TP.HCM"}
📊 CTV Info type: object
📊 CTV Info is null? false
📊 CTV Info is undefined? false

🔍 Checking ctvInfo validity...
  - ctvInfo exists? true
  - ctvInfo.name: yên
  - ctvInfo.phone: 386190596
  - ctvInfo.address: TP.HCM

✅ Using backend ctvInfo: {name: "yên", phone: "386190596", address: "TP.HCM"}
```

### Nếu Thấy "⚠️ No CTV info from backend"

Xem lý do cụ thể:
```javascript
⚠️ No CTV info from backend, using fallback
   Reason: ctvInfo is null/undefined
   // HOẶC
   Reason: ctvInfo.name is empty
   // HOẶC
   Reason: ctvInfo.name is "Chưa cập nhật"
```

## 🎯 CÁC TRƯỜNG HỢP VÀ GIẢI PHÁP

### Trường Hợp 1: Backend Test OK, Frontend Vẫn Fallback

**Nguyên nhân**: Chưa deploy lại Apps Script

**Giải pháp**:
```
1. Apps Script > Deploy > Manage deployments
2. Edit > New version > Deploy
3. Clear cache browser (Ctrl+Shift+R)
4. Test lại
```

### Trường Hợp 2: Backend Test FAIL (Không tìm thấy)

**Nguyên nhân**: Mã CTV không có trong sheet

**Giải pháp**:
```
1. Mở sheet "DS REF"
2. Tìm dòng có mã "PARTNER001"
3. Kiểm tra:
   - Cột "Mã Ref" có đúng không?
   - Có khoảng trắng thừa không?
   - Viết hoa/thường có đúng không?
4. Sửa nếu cần
5. Test lại
```

### Trường Hợp 3: Backend Test OK, Nhưng Trả Về "Chưa cập nhật"

**Nguyên nhân**: Các cột khác (Họ Tên, SĐT, Địa Chỉ) bị trống

**Giải pháp**:
```
1. Mở sheet "DS REF"
2. Tìm dòng có mã "PARTNER001"
3. Kiểm tra các cột:
   - Họ Tên: Có giá trị không?
   - Số Điện Thoại: Có giá trị không?
   - Tỉnh/Thành: Có giá trị không?
4. Điền thông tin nếu thiếu
5. Test lại
```

## 📋 Checklist Debug

- [ ] Chạy `testCTVInfoDebug()` trong Apps Script
- [ ] Xem kết quả có "yên", "386190596", "TP.HCM" không
- [ ] Nếu không → Kiểm tra sheet "DS REF"
- [ ] Nếu có → Chạy `testCTVInfoQuick()`
- [ ] Xem API có trả về ctvInfo không
- [ ] Nếu không → Deploy lại Apps Script
- [ ] Nếu có → Clear cache browser
- [ ] Test trên website
- [ ] Xem console logs chi tiết

## 🆘 Nếu Vẫn Không Được

Gửi cho tôi:

1. **Log từ `testCTVInfoDebug()`** (copy toàn bộ)
2. **Log từ `testCTVInfoQuick()`** (copy toàn bộ)
3. **Screenshot Console browser** (phần logs chi tiết)
4. **Screenshot sheet "DS REF"** (dòng có PARTNER001, che thông tin nhạy cảm)

---

**Hãy chạy `testCTVInfoDebug()` NGAY và cho tôi biết kết quả!** 🔍
