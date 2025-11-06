# Hướng Dẫn Setup Cloudflare Workers với Google Sheets

## Tổng quan
Sử dụng Cloudflare Workers để xử lý form submission và lưu dữ liệu vào Google Sheets thông qua Google Sheets API.

## Bước 1: Chuẩn bị Google Sheets

### 1.1 Tạo Google Sheets
1. Truy cập [Google Sheets](https://sheets.google.com)
2. Tạo spreadsheet mới với tên "Referral Registrations"
3. Tạo header row:
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

### 1.2 Lấy Spreadsheet ID
- Từ URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
- Copy phần `SPREADSHEET_ID`

### 1.3 Tạo Google API Key
1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Tạo project mới hoặc chọn project có sẵn
3. Enable **Google Sheets API**:
   - Vào "APIs & Services" → "Library"
   - Tìm "Google Sheets API" và enable
4. Tạo API Key:
   - Vào "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy API Key

### 1.4 Chia sẻ Google Sheets
1. Mở Google Sheets
2. Click "Share" → "Change to anyone with the link"
3. Set permission: "Editor" (để Worker có thể ghi dữ liệu)

## Bước 2: Setup Cloudflare Workers

### 2.1 Cài đặt Wrangler CLI
```bash
npm install -g wrangler
```

### 2.2 Login Cloudflare
```bash
wrangler login
```

### 2.3 Deploy Worker
```bash
wrangler deploy
```

### 2.4 Set Environment Variables
```bash
# Set Google Sheets API Key
wrangler secret put GOOGLE_API_KEY
# Nhập API Key khi được hỏi

# Set Google Spreadsheet ID  
wrangler secret put GOOGLE_SPREADSHEET_ID
# Nhập Spreadsheet ID khi được hỏi

# Set notification email (optional)
wrangler secret put NOTIFICATION_EMAIL
# Nhập email để nhận thông báo

# Set SendGrid API Key (optional - for email notifications)
wrangler secret put SENDGRID_API_KEY
# Nhập SendGrid API key nếu muốn gửi email

# Set From Email (optional)
wrangler secret put FROM_EMAIL
# Nhập email gửi đi
```

## Bước 3: Kết nối với Cloudflare Pages

### 3.1 Cấu hình Pages Functions
1. Trong Cloudflare Pages dashboard
2. Vào project của bạn
3. Vào "Functions" tab
4. Worker sẽ tự động handle requests đến `/api/submit`

### 3.2 Hoặc sử dụng Custom Domain
Nếu muốn sử dụng custom domain, uncomment và cập nhật trong `wrangler.toml`:
```toml
[[routes]]
pattern = "yourdomain.com/api/*"
zone_name = "yourdomain.com"
```

## Bước 4: Test Setup

### 4.1 Test Worker trực tiếp
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "phone": "0901234567", 
    "email": "test@example.com",
    "city": "Hà Nội",
    "timestamp": "06/11/2024, 10:30:00"
  }'
```

### 4.2 Test từ Website
1. Mở website và submit form
2. Kiểm tra Google Sheets có dữ liệu mới
3. Kiểm tra email thông báo (nếu đã setup)

## Bước 5: Monitoring và Debugging

### 5.1 Xem Logs
```bash
wrangler tail
```

### 5.2 Cloudflare Dashboard
1. Vào Cloudflare Dashboard → Workers & Pages
2. Click vào worker name
3. Xem "Metrics" và "Logs"

## Troubleshooting

### Lỗi CORS
- Worker đã handle CORS headers
- Nếu vẫn lỗi, kiểm tra domain trong browser

### Lỗi Google Sheets API
1. Kiểm tra API Key có đúng không
2. Kiểm tra Google Sheets API đã enable chưa
3. Kiểm tra Spreadsheet ID có đúng không
4. Kiểm tra quyền share của Google Sheets

### Lỗi Environment Variables
```bash
# List all secrets
wrangler secret list

# Delete và tạo lại secret
wrangler secret delete GOOGLE_API_KEY
wrangler secret put GOOGLE_API_KEY
```

## Cấu trúc Request/Response

### Request Format
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

### Success Response
```json
{
  "success": true,
  "message": "Data saved successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Tính năng

✅ **Tự động lưu vào Google Sheets**
✅ **CORS handling**
✅ **Data validation**
✅ **Error handling**
✅ **Email notifications (optional)**
✅ **Vietnamese timezone**
✅ **Secure environment variables**

## Chi phí

- **Cloudflare Workers**: 100,000 requests/day miễn phí
- **Google Sheets API**: 100 requests/100 seconds/user miễn phí
- **SendGrid**: 100 emails/day miễn phí (optional)

## Bảo mật

- API Keys được lưu trữ an toàn trong Cloudflare Secrets
- HTTPS encryption cho tất cả requests
- Input validation và sanitization
- Rate limiting tự động từ Cloudflare