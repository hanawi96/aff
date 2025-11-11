# 🚀 Hướng Dẫn Fix Nhanh - Thông Tin CTV

## 📊 Tình Trạng Hiện Tại

Từ log test, tôi thấy:
- ✅ CTV Sheet: Kết nối OK (3 dòng = 1 header + 2 CTV)
- ✅ Order Sheet: Kết nối OK (2 dòng = 1 header + 1 đơn hàng)
- ✅ Recent Orders: OK (tìm thấy 1 đơn với mã PARTNER001)
- ❌ Search Orders: FAILED (lỗi code)

## 🔧 Các Bước Fix

### Bước 1: Deploy Code Mới (ĐÃ SỬA LỖI)

Tôi đã sửa lỗi trong hàm `testGetOrders()`. Bây giờ bạn cần:

1. **Copy toàn bộ code mới** từ `google-apps-script/order-handler.js`
2. **Paste vào Google Apps Script** (thay thế toàn bộ)
3. **Lưu** (Ctrl+S hoặc Cmd+S)
4. **Deploy lại**:
   - Click **Deploy** > **Manage deployments**
   - Click ✏️ (Edit) ở deployment hiện tại
   - Chọn **New version**
   - Click **Deploy**

### Bước 2: Chạy Test Đơn Giản

1. **Copy code** từ `google-apps-script/test-ctv-simple.js`
2. **Paste vào Apps Script** (tạo file mới)
3. **Chạy hàm**: `runSimpleCTVTests()`
4. **Xem Logs** (View > Logs hoặc Ctrl+Enter)

### Bước 3: Test Với Mã Thực Tế

Từ ảnh bạn gửi, tôi thấy có 2 mã CTV:
- `CTV119439` (SĐT: 386190596, Tên: yên, Địa chỉ: TP.HCM)
- `PARTNER001` (SĐT: 386190596, Tên: yên, Địa chỉ: TP.HCM)

**Chạy test riêng lẻ:**

```javascript
// Test 1: Với CTV119439
function quickTest1() {
  const info = getCTVInfoByReferralCode('CTV119439');
  Logger.log(JSON.stringify(info, null, 2));
}

// Test 2: Với PARTNER001
function quickTest2() {
  const info = getCTVInfoByReferralCode('PARTNER001');
  Logger.log(JSON.stringify(info, null, 2));
}

// Test 3: Với SĐT
function quickTest3() {
  const info = getCTVInfoByPhone('386190596');
  Logger.log(JSON.stringify(info, null, 2));
}
```

### Bước 4: Test API Endpoint

```javascript
function testAPIQuick() {
  // Test với PARTNER001 (có đơn hàng)
  const mockEvent = {
    parameter: {
      action: 'getOrders',
      referralCode: 'PARTNER001'
    }
  };

  const response = doGet(mockEvent);
  const result = JSON.parse(response.getContent());

  Logger.log('Success: ' + result.success);
  Logger.log('Orders: ' + result.orders.length);
  Logger.log('CTV Info: ' + JSON.stringify(result.ctvInfo, null, 2));
}
```

### Bước 5: Test Trên Website

1. **Clear cache**: Ctrl+Shift+R (hoặc Cmd+Shift+R)
2. **Mở Console**: F12 > Console tab
3. **Nhập mã**: `PARTNER001` (mã có đơn hàng)
4. **Xem log**:

```javascript
// Bạn sẽ thấy:
📋 displayCollaboratorInfo called with: {name: "yên", phone: "386190596", address: "TP.HCM"}
✅ CTV info displayed: {name: "yên", phone: "3861******", address: "TP.HCM"}
```

## 🎯 Kết Quả Mong Đợi

### Trong Apps Script Logs:

```
✅ Found CTV info: {
  "name": "yên",
  "phone": "386190596",
  "address": "TP.HCM"
}
```

### Trên Website:

```
┌─────────────────────────────────────────┐
│ 👤 Thông Tin Cộng Tác Viên              │
├─────────────────────────────────────────┤
│ 👤 Họ và Tên: yên                       │
│ 📱 Số Điện Thoại: 3861******            │
│ 📍 Địa Chỉ: TP.HCM                      │
└─────────────────────────────────────────┘
```

## ❓ Nếu Vẫn Không Hiển Thị

### Kiểm Tra 1: Backend có trả về ctvInfo không?

Trong Console browser, tìm log:
```javascript
Result: {success: true, orders: [...], ctvInfo: {...}}
```

- **Nếu `ctvInfo` là `null`** → Backend không tìm thấy CTV
- **Nếu `ctvInfo` có data** → Frontend có vấn đề

### Kiểm Tra 2: Mã CTV có đúng không?

Trong sheet "DS REF", kiểm tra:
- Cột "Mã Ref" có chứa `CTV119439` hoặc `PARTNER001` không?
- Có khoảng trắng thừa không?
- Có ký tự đặc biệt không?

### Kiểm Tra 3: Headers có đúng không?

Chạy test này:

```javascript
function checkHeaders() {
  const ss = SpreadsheetApp.openById('1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o');
  const sheet = ss.getSheetByName('DS REF');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  Logger.log('Headers:');
  headers.forEach((h, i) => {
    Logger.log(`  [${i}] "${h}"`);
  });
}
```

Kết quả mong đợi:
```
[0] "Thời Gian"
[1] "Họ Tên"
[2] "Số Điện Thoại"
[3] "Tỉnh/Thành"
[7] "Mã Ref"
```

## 🔍 Debug Nhanh

Thêm code này vào `getCTVInfoByReferralCode()` để debug:

```javascript
// Sau dòng: const headers = data[0];
Logger.log('🔍 DEBUG - Headers: ' + JSON.stringify(headers));
Logger.log('🔍 DEBUG - Looking for: ' + referralCode);

// Trong vòng for:
Logger.log('🔍 DEBUG - Row ' + i + ': ' + rowRefCode + ' vs ' + referralCode);
```

## 📞 Liên Hệ

Nếu sau tất cả các bước trên vẫn không được, gửi cho tôi:

1. **Log từ `runSimpleCTVTests()`**
2. **Screenshot Console browser** khi search
3. **Screenshot sheet "DS REF"** (che thông tin nhạy cảm)

---

**Lưu ý quan trọng**: 
- Đảm bảo đã **deploy lại** Apps Script với code mới
- Đảm bảo đã **clear cache** browser
- Đảm bảo mã CTV trong sheet **khớp chính xác** với mã tìm kiếm
