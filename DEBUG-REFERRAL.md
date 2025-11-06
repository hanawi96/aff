# 🔍 Hướng Dẫn Debug Hệ Thống Referral

## Vấn Đề
Khi đăng ký thành công, mã giới thiệu hiển thị "N/A" và link giới thiệu chỉ hiển thị "https://shopvd.store" thay vì có mã referral.

## Nguyên Nhân Có Thể
1. Google Apps Script không trả về đúng format JSON
2. Response bị redirect và mất dữ liệu
3. CORS issues
4. Parse JSON error

## Các Bước Debug

### Bước 1: Test Google Apps Script
1. Mở file `test-referral.html` trong trình duyệt
2. Click nút "Test Đăng Ký"
3. Kiểm tra kết quả:
   - ✅ Nếu thấy `referralCode` và `referralUrl` → Google Apps Script hoạt động tốt
   - ❌ Nếu thiếu dữ liệu → Cần fix Google Apps Script

### Bước 2: Kiểm Tra Console Log
1. Mở trang đăng ký chính (`index.html`)
2. Mở Developer Tools (F12)
3. Vào tab Console
4. Điền form và submit
5. Kiểm tra các log:
   ```
   Sending data to Google Apps Script: {...}
   Response status: 200
   Raw response: {...}
   Parsed response: {...}
   ✓ Referral Code: XXX
   ✓ Referral URL: https://shopvd.store/?ref=XXX
   ```

### Bước 3: Kiểm Tra Google Apps Script
1. Mở Google Apps Script editor
2. Chạy function `testFunction()` để test
3. Kiểm tra Logs (View → Logs hoặc Ctrl+Enter)
4. Đảm bảo response có format:
   ```json
   {
     "success": true,
     "referralCode": "NVT12345",
     "referralUrl": "https://shopvd.store/?ref=NVT12345",
     "timestamp": "..."
   }
   ```

### Bước 4: Kiểm Tra Network Tab
1. Mở Developer Tools → Network tab
2. Submit form
3. Tìm request đến Google Apps Script
4. Kiểm tra:
   - Request payload
   - Response headers
   - Response body

## Các Thay Đổi Đã Thực Hiện

### 1. Cải Thiện Error Handling trong `script.js`
```javascript
// Thay vì:
const refCode = result.referralCode || 'N/A';
const refUrl = result.referralUrl || 'https://shopvd.store';

// Bây giờ:
if (!result.referralCode || !result.referralUrl) {
    throw new Error('Server did not return referral information');
}
const refCode = result.referralCode;
const refUrl = result.referralUrl;
```

### 2. Thêm Debug Logs
- Log raw response text
- Log parsed JSON
- Log referral code và URL
- Log khi gọi showSuccessModal

### 3. Parse Response Tốt Hơn
```javascript
const responseText = await response.text();
let result = JSON.parse(responseText);
```

## Giải Pháp Nếu Vẫn Lỗi

### Giải Pháp 1: Kiểm Tra Google Apps Script Deployment
1. Vào Google Apps Script
2. Deploy → Manage deployments
3. Đảm bảo:
   - Execute as: Me
   - Who has access: Anyone
4. Copy lại Web App URL mới (nếu có)

### Giải Pháp 2: Test Trực Tiếp Google Apps Script
Dùng curl hoặc Postman:
```bash
curl -X POST \
  'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec' \
  -H 'Content-Type: text/plain' \
  -d '{"fullName":"Test","phone":"0901234567","email":"test@test.com","city":"HN"}'
```

### Giải Pháp 3: Fallback với Local Storage
Nếu Google Apps Script không trả về referral code, có thể generate ở client:
```javascript
// Thêm vào script.js nếu cần
function generateLocalRefCode(fullName) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const name = fullName.split(' ')[0].substring(0, 3).toUpperCase();
    return name + random + timestamp.substring(0, 4).toUpperCase();
}
```

## Checklist
- [ ] Test với `test-referral.html`
- [ ] Kiểm tra Console logs
- [ ] Kiểm tra Network tab
- [ ] Test function trong Google Apps Script
- [ ] Verify deployment settings
- [ ] Kiểm tra Sheet có nhận được data không
- [ ] Kiểm tra cột "Mã Ref" trong Sheet có giá trị không

## Liên Hệ Support
Nếu vẫn gặp vấn đề, cung cấp:
1. Screenshot console logs
2. Screenshot Network tab (request/response)
3. Screenshot Google Apps Script logs
4. Screenshot Sheet data
