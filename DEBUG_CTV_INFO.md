# 🔧 Hướng Dẫn Debug - Thông Tin CTV Không Hiển Thị

## ❌ Vấn Đề

Box thông tin CTV chỉ hiển thị "Đang tải..." và không cập nhật thông tin thực tế.

## 🔍 Nguyên Nhân Có Thể

1. **Backend chưa được deploy lại** - Code mới chưa được áp dụng
2. **Cột trong sheet không khớp** - Tên cột khác với code tìm kiếm
3. **Mã CTV không khớp** - Mã trong sheet khác với mã tìm kiếm
4. **Lỗi trong hàm getCTVInfo** - Backend gặp lỗi khi lấy dữ liệu

## 🛠️ Các Bước Debug

### Bước 1: Kiểm Tra Console Browser

1. Mở trang web tra cứu CTV
2. Nhấn F12 để mở Developer Tools
3. Chọn tab "Console"
4. Nhập mã CTV và tìm kiếm
5. Xem log trong console:

```javascript
// Bạn sẽ thấy các log như:
📋 displayCollaboratorInfo called with: {...}
✅ CTV info displayed: {...}
```

6. Kiểm tra xem `ctvInfo` có giá trị gì:
   - Nếu `null` hoặc `undefined` → Backend không trả về dữ liệu
   - Nếu có object nhưng các field là "Chưa cập nhật" → Backend không tìm thấy CTV
   - Nếu có object với dữ liệu → Frontend có vấn đề

### Bước 2: Kiểm Tra Response từ Backend

1. Trong Console browser, xem response từ API:

```javascript
// Tìm log:
Result: {success: true, orders: [...], ctvInfo: {...}}
```

2. Kiểm tra `ctvInfo`:
   - Có tồn tại không?
   - Các field có giá trị gì?

### Bước 3: Test Backend trong Google Apps Script

1. Mở Google Apps Script của bạn
2. Copy toàn bộ nội dung file `google-apps-script/test-ctv-info.js`
3. Paste vào một file mới trong Apps Script
4. Chạy hàm `runAllCTVTests()`
5. Xem kết quả trong Logs (View > Logs hoặc Ctrl+Enter)

**Các test sẽ kiểm tra:**
- ✅ Cấu trúc sheet CTV
- ✅ Headers và column indexes
- ✅ Dữ liệu mẫu
- ✅ Hàm getCTVInfoByReferralCode
- ✅ Hàm getCTVInfoByPhone
- ✅ API endpoint

### Bước 4: Kiểm Tra Cấu Trúc Sheet

Chạy hàm `testCTVSheetStructure()` trong Apps Script để xem:

```
📋 Headers:
  [0] Thời Gian
  [1] Họ Tên
  [2] Số Điện Thoại
  [3] Tỉnh/Thành
  [4] Tuổi
  [5] Kinh Nghiệm
  [6] Lý Do
  [7] Mã Ref
  [8] Trạng Thái
  [9] Đơn Hàng Của Bạn

🔍 Finding important columns:
  Mã Ref column index: 7 (Mã Ref)
  Họ Tên column index: 1 (Họ Tên)
  SĐT column index: 2 (Số Điện Thoại)
  Địa chỉ column index: 3 (Tỉnh/Thành)
```

**Nếu thấy "NOT FOUND"** → Tên cột trong sheet không khớp với code

### Bước 5: Test với Mã CTV Cụ Thể

1. Lấy một mã CTV từ sheet (VD: `CTV119439` từ ảnh)
2. Sửa trong file test:

```javascript
const testRefCode = 'CTV119439'; // Thay bằng mã thực tế của bạn
```

3. Chạy hàm `testGetCTVInfoByCode()`
4. Xem kết quả:

```javascript
📋 Result:
{
  "name": "yên",
  "phone": "386190596",
  "address": "TP.HCM"
}
```

**Nếu thấy "Không tìm thấy"** → Mã CTV không tồn tại hoặc không khớp

### Bước 6: Kiểm Tra Deploy

1. Trong Google Apps Script, click **Deploy** > **Manage deployments**
2. Kiểm tra:
   - ✅ Có deployment nào đang active không?
   - ✅ Version có phải là mới nhất không?
   - ✅ URL có đúng với `CONFIG.GOOGLE_SCRIPT_URL` trong frontend không?

3. Nếu chưa deploy:
   - Click **New deployment**
   - Chọn type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
   - Copy URL mới

4. Nếu đã deploy nhưng code chưa cập nhật:
   - Click biểu tượng ✏️ (Edit)
   - Chọn **New version**
   - Click **Deploy**

## 🔧 Các Giải Pháp

### Giải Pháp 1: Deploy Lại Backend

```
1. Mở Google Apps Script
2. Thay thế code trong order-handler.js
3. Lưu (Ctrl+S)
4. Deploy > Manage deployments
5. Edit deployment > New version > Deploy
6. Clear cache browser (Ctrl+Shift+R)
7. Test lại
```

### Giải Pháp 2: Sửa Tên Cột Không Khớp

Nếu test cho thấy cột không tìm thấy, sửa code tìm kiếm:

```javascript
// Trong getCTVInfoByReferralCode
const nameColumnIndex = headers.findIndex(h =>
  h && (h.toString().toLowerCase().includes('họ tên') || 
        h.toString().toLowerCase().includes('họ và tên') ||
        h.toString().toLowerCase().includes('tên') ||
        h.toString().toLowerCase() === 'họ tên') // Thêm exact match
);
```

### Giải Pháp 3: Thêm Fallback Data

Nếu không tìm thấy CTV, hiển thị thông tin từ đơn hàng:

```javascript
// Trong searchOrders()
if (!result.ctvInfo || result.ctvInfo.name === 'Không tìm thấy') {
  // Lấy thông tin từ đơn hàng đầu tiên
  if (result.orders && result.orders.length > 0) {
    const firstOrder = result.orders[0];
    result.ctvInfo = {
      name: 'CTV ' + referralCode,
      phone: firstOrder.ctvPhone || 'Chưa cập nhật',
      address: 'Xem trong đơn hàng'
    };
  }
}
```

## 📝 Checklist Debug

- [ ] Kiểm tra Console browser có log gì
- [ ] Kiểm tra Response từ API có `ctvInfo` không
- [ ] Chạy `testCTVSheetStructure()` trong Apps Script
- [ ] Kiểm tra column indexes có đúng không
- [ ] Chạy `testGetCTVInfoByCode()` với mã thực tế
- [ ] Kiểm tra kết quả có đúng không
- [ ] Kiểm tra deployment có active không
- [ ] Kiểm tra version có mới nhất không
- [ ] Deploy lại nếu cần
- [ ] Clear cache browser
- [ ] Test lại trên website

## 🆘 Nếu Vẫn Không Được

Gửi cho tôi:

1. **Screenshot Console browser** khi tìm kiếm
2. **Log từ Apps Script** khi chạy `runAllCTVTests()`
3. **Screenshot sheet CTV** (che thông tin nhạy cảm)
4. **URL deployment** hiện tại

## 📞 Quick Fix

Nếu cần fix nhanh, thêm code này vào `displayResults()`:

```javascript
// Trong displayResults(), sau dòng hideAllStates()
// Force update CTV info nếu chưa có
if (!document.getElementById('ctvName').textContent || 
    document.getElementById('ctvName').textContent === 'Đang tải...') {
  
  displayCollaboratorInfo({
    name: 'CTV ' + referralCode,
    phone: 'Liên hệ admin',
    address: 'Xem trong đơn hàng'
  });
}
```

---

**Lưu ý**: Đảm bảo đã deploy lại Google Apps Script với code mới trước khi test!
