# 📱 Hướng Dẫn Tra Cứu Đơn Hàng Bằng Số Điện Thoại

## 🎯 Tính Năng Mới

Hệ thống giờ đây hỗ trợ tra cứu đơn hàng bằng **2 cách**:
1. ✅ **Mã CTV** (như trước): VD: `CTV123456`
2. ✅ **Số điện thoại** (MỚI): VD: `0386190596` hoặc `386190596`

## 🔧 Cách Hoạt Động

### 1. Tự Động Nhận Diện
Hệ thống tự động nhận diện input của người dùng:
- Nếu là **số điện thoại** (9-10 chữ số): Tra cứu theo SĐT
- Nếu là **mã CTV** (bắt đầu bằng CTV): Tra cứu theo mã

### 2. Xử Lý Số Điện Thoại Thông Minh
- Người dùng nhập: `0386190596` → Hệ thống tự động bỏ số 0 → Tìm kiếm: `386190596`
- Người dùng nhập: `386190596` → Tìm kiếm trực tiếp: `386190596`
- Hỗ trợ cả khoảng trắng: `0901 234 567` → `901234567`

### 3. Quy Trình Tra Cứu Theo SĐT
```
Người dùng nhập SĐT
    ↓
Chuẩn hóa SĐT (bỏ số 0 đầu)
    ↓
Tìm mã CTV trong sheet "DS REF"
    ↓
Lấy đơn hàng theo mã CTV tìm được
    ↓
Hiển thị kết quả
```

## 📋 Cấu Trúc Dữ Liệu

### Sheet "DS REF" (Danh sách CTV)
Cần có 2 cột:
- **Số Điện Thoại**: Lưu không có số 0 đầu (VD: `386190596`)
- **Mã Ref**: Mã CTV (VD: `CTV123456`)

### Sheet "Đơn Hàng"
Cần có cột:
- **Mã Referral**: Mã CTV của đơn hàng

## 🚀 Cách Deploy

### Bước 1: Cập nhật Google Apps Script
1. Mở Google Apps Script của bạn
2. Copy toàn bộ code từ file `google-apps-script/order-handler.js`
3. Paste vào Apps Script
4. **Deploy lại** Web App:
   - Click **Deploy** → **Manage deployments**
   - Click biểu tượng ✏️ (Edit) ở deployment hiện tại
   - Chọn **New version**
   - Click **Deploy**

### Bước 2: Test Chức Năng
Chạy các hàm test trong Apps Script:

```javascript
// Test chuẩn hóa số điện thoại
testPhoneFeature()

// Hoặc test riêng từng phần
testGetOrdersByPhone()
```

### Bước 3: Deploy Frontend
1. Upload các file đã cập nhật:
   - `public/ctv/index.html`
   - `public/assets/js/ctv.js`
2. Clear cache trình duyệt
3. Test trên website

## 🧪 Cách Test

### Test 1: Tra cứu bằng mã CTV (như cũ)
```
Nhập: CTV123456
Kết quả: Hiển thị đơn hàng của CTV123456
```

### Test 2: Tra cứu bằng SĐT có số 0
```
Nhập: 0386190596
Kết quả: 
  - Hệ thống tự động bỏ số 0 → 386190596
  - Tìm CTV có SĐT 386190596
  - Hiển thị đơn hàng của CTV đó
```

### Test 3: Tra cứu bằng SĐT không có số 0
```
Nhập: 386190596
Kết quả: Tìm và hiển thị đơn hàng
```

### Test 4: SĐT không tồn tại
```
Nhập: 0999999999
Kết quả: Hiển thị thông báo "Không tìm thấy cộng tác viên với số điện thoại..."
```

## 💡 Lưu Ý Quan Trọng

### 1. Định Dạng Số Điện Thoại Trong Sheet
- ✅ **ĐÚNG**: `386190596` (không có số 0 đầu)
- ❌ **SAI**: `0386190596` (có số 0 đầu)

### 2. Nếu Dữ Liệu Cũ Có Số 0
Chạy script này để chuẩn hóa:

```javascript
function normalizeAllPhones() {
  const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID')
    .getSheetByName('DS REF');
  
  const data = sheet.getDataRange().getValues();
  const phoneCol = 2; // Cột C (index 2)
  
  for (let i = 1; i < data.length; i++) {
    let phone = data[i][phoneCol].toString();
    if (phone.startsWith('0')) {
      phone = phone.substring(1);
      sheet.getRange(i + 1, phoneCol + 1).setValue(phone);
    }
  }
  
  Logger.log('✅ Đã chuẩn hóa ' + (data.length - 1) + ' số điện thoại');
}
```

### 3. URL Parameters
Hỗ trợ cả 2 loại trong URL:
- `https://shopvd.store/ctv/?code=CTV123456` (mã CTV)
- `https://shopvd.store/ctv/?code=0386190596` (số điện thoại)

## 🎨 Giao Diện

### Thay Đổi
- **Label**: "Mã CTV của bạn" → "Mã CTV hoặc Số Điện Thoại"
- **Placeholder**: Thêm ví dụ số điện thoại
- **Hint**: Thêm text hướng dẫn phía dưới ô input

### Thông Báo Lỗi
- Mã CTV không có đơn: "Mã CTV XXX chưa có đơn hàng nào..."
- SĐT không có đơn: "Số điện thoại XXX chưa có đơn hàng nào..."
- SĐT không tồn tại: "Không tìm thấy cộng tác viên với số điện thoại XXX..."

## 🐛 Troubleshooting

### Lỗi: "Không tìm thấy cộng tác viên"
**Nguyên nhân**: Số điện thoại trong sheet có số 0 đầu
**Giải pháp**: Chạy script `normalizeAllPhones()` ở trên

### Lỗi: "Server trả về dữ liệu không đúng định dạng"
**Nguyên nhân**: Chưa deploy lại Apps Script
**Giải pháp**: Deploy lại với version mới

### Không tự động nhận diện SĐT
**Nguyên nhân**: SĐT không đúng format (9-10 chữ số)
**Giải pháp**: Kiểm tra regex trong code: `/^0?\d{9,10}$/`

## 📊 API Endpoints

### Mới: Get Orders By Phone
```
GET {GOOGLE_SCRIPT_URL}?action=getOrdersByPhone&phone=0386190596

Response:
{
  "success": true,
  "orders": [...],
  "referralCode": "CTV123456",
  "phone": "0386190596"
}
```

### Cũ: Get Orders By Referral Code (vẫn hoạt động)
```
GET {GOOGLE_SCRIPT_URL}?action=getOrders&referralCode=CTV123456

Response:
{
  "success": true,
  "orders": [...],
  "referralCode": "CTV123456"
}
```

## ✅ Checklist Deploy

- [ ] Cập nhật code Google Apps Script
- [ ] Deploy lại Web App với version mới
- [ ] Test hàm `testPhoneFeature()` trong Apps Script
- [ ] Chuẩn hóa số điện thoại trong sheet (nếu cần)
- [ ] Upload file HTML và JS mới
- [ ] Clear cache trình duyệt
- [ ] Test tra cứu bằng mã CTV
- [ ] Test tra cứu bằng SĐT có số 0
- [ ] Test tra cứu bằng SĐT không có số 0
- [ ] Test SĐT không tồn tại
- [ ] Test URL với parameter `?code=`

## 🎉 Hoàn Thành!

Giờ đây cộng tác viên có thể tra cứu đơn hàng bằng cả **mã CTV** và **số điện thoại** một cách dễ dàng!
