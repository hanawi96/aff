# 🎯 CÁC BƯỚC CUỐI CÙNG - Hiển Thị Thông Tin CTV

## ✅ Tình Trạng Hiện Tại

Tất cả tests cơ bản đã PASS:
- ✅ Kết nối CTV Sheet
- ✅ Kết nối Order Sheet  
- ✅ Lấy đơn hàng mới nhất
- ✅ Tra cứu đơn hàng theo mã CTV

## 🚀 BẠN CẦN LÀM NGAY (3 BƯỚC)

### Bước 1: Chạy Test Thông Tin CTV

Trong Google Apps Script, chạy hàm này:

```javascript
testCTVInfoQuick()
```

**Cách chạy:**
1. Mở Google Apps Script
2. Chọn hàm `testCTVInfoQuick` từ dropdown
3. Click nút ▶️ Run
4. Xem kết quả trong Logs (View > Logs)

**Kết quả mong đợi:**

```
╔════════════════════════════════════════╗
║   TEST NHANH - THÔNG TIN CTV          ║
╚════════════════════════════════════════╝

📋 Test 1: getCTVInfoByReferralCode("PARTNER001")
Result: {
  "name": "yên",
  "phone": "386190596",
  "address": "TP.HCM"
}

📋 Test 2: getCTVInfoByPhone("386190596")
Result: {
  "name": "yên",
  "phone": "386190596",
  "address": "TP.HCM"
}

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
╚════════════════════════════════════════╝
```

### Bước 2: Deploy Lại Web App

**QUAN TRỌNG**: Phải deploy lại để áp dụng code mới!

1. Trong Google Apps Script, click **Deploy** > **Manage deployments**
2. Click biểu tượng ✏️ (Edit) ở deployment hiện tại
3. Trong dropdown "Version", chọn **New version**
4. Click **Deploy**
5. Đợi vài giây để deployment hoàn tất
6. Click **Done**

### Bước 3: Test Trên Website

1. **Mở website** tra cứu CTV
2. **Clear cache**: Nhấn `Ctrl+Shift+R` (Windows) hoặc `Cmd+Shift+R` (Mac)
3. **Mở Console**: Nhấn `F12` > chọn tab "Console"
4. **Nhập mã CTV**: `PARTNER001`
5. **Click "Tra cứu"**

**Kết quả mong đợi:**

Bạn sẽ thấy box thông tin CTV hiển thị:

```
┌─────────────────────────────────────────────────────────┐
│ 👤 Thông Tin Cộng Tác Viên                              │
├─────────────────────────────────────────────────────────┤
│  👤 Họ và Tên    │  📱 Số Điện Thoại  │  📍 Địa Chỉ    │
│  yên             │  3861******        │  TP.HCM        │
└─────────────────────────────────────────────────────────┘
```

**Trong Console, bạn sẽ thấy:**

```javascript
📋 displayCollaboratorInfo called with: {name: "yên", phone: "386190596", address: "TP.HCM"}
✅ CTV info displayed: {name: "yên", phone: "3861******", address: "TP.HCM"}
```

## 🔍 Nếu Không Hiển Thị

### Kiểm Tra 1: Console Browser

Xem log trong Console (F12):
- Có thấy `displayCollaboratorInfo called with:` không?
- `ctvInfo` có giá trị gì?

### Kiểm Tra 2: Network Tab

1. Mở tab "Network" trong Developer Tools
2. Tìm kiếm lại
3. Tìm request đến Google Apps Script
4. Click vào request đó
5. Xem tab "Response"
6. Kiểm tra có `ctvInfo` trong response không?

**Response mẫu:**

```json
{
  "success": true,
  "orders": [...],
  "referralCode": "PARTNER001",
  "ctvInfo": {
    "name": "yên",
    "phone": "386190596",
    "address": "TP.HCM"
  }
}
```

### Kiểm Tra 3: Deployment URL

Đảm bảo URL trong `public/assets/js/config.js` khớp với deployment URL:

```javascript
const CONFIG = {
  GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  COMMISSION_RATE: 0.1
};
```

## 🐛 Debug Nhanh

Nếu vẫn không được, thêm code debug này vào Console browser:

```javascript
// Kiểm tra elements có tồn tại không
console.log('ctvName element:', document.getElementById('ctvName'));
console.log('ctvPhone element:', document.getElementById('ctvPhone'));
console.log('ctvAddress element:', document.getElementById('ctvAddress'));

// Kiểm tra giá trị hiện tại
console.log('Current values:', {
  name: document.getElementById('ctvName')?.textContent,
  phone: document.getElementById('ctvPhone')?.textContent,
  address: document.getElementById('ctvAddress')?.textContent
});
```

## 📊 Checklist Hoàn Chỉnh

- [ ] Chạy `testCTVInfoQuick()` trong Apps Script
- [ ] Thấy kết quả "✅ THÀNH CÔNG - CTV INFO FOUND"
- [ ] Deploy lại Web App (New version)
- [ ] Clear cache browser (Ctrl+Shift+R)
- [ ] Mở Console browser (F12)
- [ ] Nhập mã PARTNER001
- [ ] Thấy box thông tin CTV hiển thị
- [ ] Số điện thoại đã được che 4 số cuối (3861******)

## 🎉 Khi Thành Công

Bạn sẽ thấy:
1. ✅ Box thông tin CTV hiển thị đẹp
2. ✅ Họ tên: "yên"
3. ✅ SĐT: "3861******" (đã che 4 số cuối)
4. ✅ Địa chỉ: "TP.HCM"
5. ✅ Danh sách đơn hàng bên dưới

## 📞 Nếu Cần Hỗ Trợ

Gửi cho tôi:
1. **Log từ `testCTVInfoQuick()`** (copy toàn bộ)
2. **Screenshot Console browser** khi search
3. **Screenshot Network tab** (Response của API call)
4. **Screenshot box thông tin CTV** (nếu có hiển thị)

---

**Chúc bạn thành công!** 🚀
