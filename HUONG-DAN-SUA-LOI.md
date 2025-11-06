# Hướng Dẫn Sửa Lỗi Google Sheet Không Lưu Dữ Liệu

## Vấn đề tìm thấy:
1. ❌ Google Apps Script chưa được deploy đúng cách
2. ❌ Script chưa có quyền truy cập vào Google Sheet
3. ❌ Frontend gửi request với mode 'no-cors' nên không biết có lỗi hay không

## Giải pháp:

### Bước 1: Cập nhật Google Apps Script

1. Mở Google Apps Script tại: https://script.google.com
2. Tìm project của bạn hoặc tạo mới
3. Copy toàn bộ code từ file `google-apps-script.js` (đã được sửa)
4. Paste vào Google Apps Script Editor

### Bước 2: Cấu hình quyền truy cập

1. Trong Google Apps Script, click vào biểu tượng **⚙️ Project Settings**
2. Scroll xuống phần "Google Cloud Platform (GCP) Project"
3. Đảm bảo project đã được liên kết

### Bước 3: Deploy Web App

1. Click nút **Deploy** > **New deployment**
2. Chọn type: **Web app**
3. Cấu hình như sau:
   - **Description**: "Referral Form Handler"
   - **Execute as**: **Me** (email của bạn)
   - **Who has access**: **Anyone** (quan trọng!)
4. Click **Deploy**
5. Cho phép quyền truy cập khi được hỏi:
   - Click **Review permissions**
   - Chọn tài khoản Google của bạn
   - Click **Advanced** > **Go to [Project name] (unsafe)**
   - Click **Allow**

### Bước 4: Lấy URL mới

1. Sau khi deploy, copy **Web app URL** mới
2. URL sẽ có dạng: `https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec`
3. Thay thế URL cũ trong file `script.js` (dòng 42)

### Bước 5: Kiểm tra Google Sheet

1. Mở Google Sheet: https://docs.google.com/spreadsheets/d/1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o
2. Đảm bảo có sheet tên **"DS REF"** (đúng tên này)
3. Nếu chưa có, tạo sheet mới với tên **"DS REF"**
4. Script sẽ tự động tạo headers khi có dữ liệu đầu tiên

### Bước 6: Test

1. Trong Google Apps Script, chạy function `testFunction()`:
   - Chọn function `testFunction` từ dropdown
   - Click **Run**
   - Kiểm tra logs và Google Sheet
2. Nếu test thành công, thử submit form từ website

### Bước 7: Cập nhật email thông báo (Optional)

Trong file `google-apps-script.js`, dòng 95, thay đổi:
```javascript
const emailAddress = 'your-email@gmail.com'; // Thay bằng email của bạn
```

## Kiểm tra lỗi:

### Nếu vẫn không hoạt động:

1. **Kiểm tra Console Log**:
   - Mở website
   - Nhấn F12 để mở Developer Tools
   - Vào tab Console
   - Submit form và xem có lỗi gì không

2. **Kiểm tra Google Apps Script Logs**:
   - Vào Google Apps Script Editor
   - Click **Executions** (biểu tượng đồng hồ bên trái)
   - Xem các lần chạy gần đây và lỗi (nếu có)

3. **Kiểm tra quyền truy cập**:
   - Đảm bảo Google Sheet không bị khóa
   - Đảm bảo tài khoản deploy script có quyền edit sheet

## Lỗi thường gặp:

### Lỗi 1: "Authorization required"
**Giải pháp**: Deploy lại và cho phép quyền truy cập đầy đủ

### Lỗi 2: "Cannot find sheet 'DS REF'"
**Giải pháp**: Tạo sheet với tên chính xác "DS REF" (không có khoảng trắng thừa)

### Lỗi 3: "CORS error"
**Giải pháp**: Đảm bảo deploy với "Who has access" = "Anyone"

### Lỗi 4: "Script timeout"
**Giải pháp**: Kiểm tra kết nối mạng và thử lại

## Liên hệ hỗ trợ:

Nếu vẫn gặp vấn đề, gửi cho tôi:
1. Screenshot của Console Log (F12)
2. Screenshot của Google Apps Script Executions
3. Screenshot của Google Sheet (có sheet "DS REF" chưa)
