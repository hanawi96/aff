# Hướng Dẫn Kết Nối Form với Google Sheets

## Bước 1: Tạo Google Sheets

1. Truy cập [Google Sheets](https://sheets.google.com)
2. Tạo spreadsheet mới với tên "Referral Registrations"
3. Tạo header row với các cột sau:
   - A1: "Thời Gian"
   - B1: "Họ Tên"
   - C1: "Số Điện Thoại"
   - D1: "Email"
   - E1: "Tỉnh/Thành"
   - F1: "Tuổi"
   - G1: "Kinh Nghiệm"
   - H1: "Facebook"
   - I1: "Lý Do"
   - J1: "Trạng Thái"

4. **Lấy Spreadsheet ID:**
   - Từ URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy phần SPREADSHEET_ID

## Bước 2: Thiết lập Google Apps Script

1. Truy cập [Google Apps Script](https://script.google.com)
2. Tạo project mới
3. Xóa code mặc định và paste code từ file `google-apps-script.js`
4. **Cập nhật thông tin:**
   ```javascript
   const spreadsheetId = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
   const emailAddress = 'your-email@gmail.com';
   ```

## Bước 3: Deploy Web App

1. Trong Google Apps Script, click **"Deploy"** → **"New deployment"**
2. Chọn type: **"Web app"**
3. Cấu hình:
   - **Description:** "Referral Form Handler"
   - **Execute as:** "Me"
   - **Who has access:** "Anyone"
4. Click **"Deploy"**
5. **Copy Web App URL** (dạng: https://script.google.com/macros/s/.../exec)

## Bước 4: Cập nhật Frontend

1. Mở file `script.js`
2. Tìm dòng:
   ```javascript
   const GOOGLE_SCRIPT_URL = 'YOUR_WEB_APP_URL';
   ```
3. Thay `YOUR_WEB_APP_URL` bằng URL từ bước 3

## Bước 5: Test và Deploy

1. **Test Google Apps Script:**
   - Trong Apps Script, chạy function `testFunction()`
   - Kiểm tra Google Sheets có dữ liệu test không

2. **Test Frontend:**
   - Mở website và thử submit form
   - Kiểm tra dữ liệu có xuất hiện trong Google Sheets

3. **Deploy lên Cloudflare Pages:**
   ```bash
   git add .
   git commit -m "Add Google Sheets integration"
   git push
   ```

## Bước 6: Cấu hình Email Thông báo (Tùy chọn)

1. Trong Google Apps Script, function `sendNotificationEmail` sẽ gửi email thông báo
2. Thay đổi email trong biến `emailAddress`
3. Có thể tùy chỉnh template email trong function này

## Troubleshooting

### Lỗi CORS
Nếu gặp lỗi CORS, thêm vào đầu function `doPost`:
```javascript
// Add CORS headers
const output = ContentService.createTextOutput();
output.setMimeType(ContentService.MimeType.JSON);
```

### Lỗi Permission
1. Trong Google Apps Script, vào **"Permissions"**
2. Authorize các quyền cần thiết
3. Redeploy web app

### Kiểm tra Logs
1. Trong Google Apps Script, vào **"Executions"**
2. Xem logs để debug lỗi

## Cấu trúc Dữ liệu

Form sẽ gửi JSON với cấu trúc:
```json
{
  "fullName": "Nguyễn Thị Lan",
  "phone": "0901234567",
  "email": "example@gmail.com",
  "city": "Hà Nội",
  "age": "26-30",
  "experience": "Mới bắt đầu",
  "facebook": "https://facebook.com/profile",
  "motivation": "Muốn có thêm thu nhập",
  "timestamp": "06/11/2024, 10:30:00"
}
```

## Bảo mật

- Web App được deploy với quyền "Anyone" để có thể nhận POST request
- Dữ liệu được validate trước khi lưu
- Email thông báo chỉ gửi đến email đã cấu hình
- Không lưu trữ thông tin nhạy cảm

## Tùy chỉnh

Bạn có thể tùy chỉnh:
- Thêm/bớt trường dữ liệu
- Thay đổi format email thông báo
- Thêm validation rules
- Tích hợp với các dịch vụ khác (Slack, Discord, etc.)