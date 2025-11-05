# Referral Form - Mẹ & Bé Affiliate

Form đăng ký cộng tác viên dành cho mẹ bỉm sữa với giao diện đẹp, hiện đại và thân thiện.

## 🌟 Tính Năng

- **Giao diện đẹp**: Thiết kế hiện đại với màu sắc nhẹ nhàng phù hợp với mẹ bỉm sữa
- **Responsive**: Tương thích mọi thiết bị (desktop, tablet, mobile)
- **Validation**: Kiểm tra dữ liệu đầu vào real-time
- **Animation**: Hiệu ứng mượt mà và celebration khi submit thành công
- **Google Sheets**: Tự động lưu dữ liệu vào Google Sheets
- **Cloudflare Workers**: Backend serverless nhanh và ổn định

## 🚀 Cài Đặt

### 1. Setup Google Sheets

1. Tạo Google Spreadsheet mới
2. Copy Spreadsheet ID từ URL
3. Tạo Google Apps Script project:
   - Mở [script.google.com](https://script.google.com)
   - Tạo project mới
   - Copy code từ `google-apps-script.js`
   - Thay `YOUR_SPREADSHEET_ID` bằng ID thật
   - Deploy as Web App với quyền "Anyone"

### 2. Setup Cloudflare Workers

1. Cài đặt Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login Cloudflare:
```bash
wrangler login
```

3. Deploy worker:
```bash
wrangler deploy
```

4. Cấu hình environment variables trong Cloudflare Dashboard:
   - `GOOGLE_SPREADSHEET_ID`: ID của Google Sheet
   - `GOOGLE_API_KEY`: Google API Key (hoặc dùng Web App URL)
   - `GOOGLE_WEB_APP_URL`: URL của Google Apps Script Web App

### 3. Deploy Static Files

1. Upload các file HTML, CSS, JS lên Cloudflare Pages
2. Cấu hình custom domain nếu cần
3. Cập nhật route trong `wrangler.toml`

## 📁 Cấu Trúc Project

```
referral-form/
├── index.html              # Trang chủ với form đăng ký
├── script.js               # JavaScript xử lý form
├── _worker.js              # Cloudflare Worker backend
├── wrangler.toml           # Cấu hình Cloudflare
├── google-apps-script.js   # Code cho Google Apps Script
└── README.md               # Hướng dẫn này
```

## 🎨 Thiết Kế

### Màu Sắc
- **Mom Pink**: `#f8b4cb` - Màu hồng nhẹ nhàng
- **Mom Blue**: `#a8d8ea` - Màu xanh dương pastel  
- **Mom Purple**: `#d4a5d4` - Màu tím lavender
- **Warm Beige**: `#f5f1eb` - Màu be ấm áp

### Typography
- Font chính: System fonts (San Francisco, Segoe UI, etc.)
- Font icons: Font Awesome 6

### Layout
- Container max-width: 768px
- Responsive breakpoints: sm, md, lg
- Grid system: Tailwind CSS

## 📋 Form Fields

### Bắt Buộc
- Họ và Tên
- Số Điện Thoại  
- Email
- Tỉnh/Thành Phố

### Tùy Chọn
- Tuổi
- Kinh nghiệm bán hàng
- Link Facebook
- Lý do tham gia

## 🔧 Customization

### Thay Đổi Màu Sắc
Chỉnh sửa trong `tailwind.config` ở `index.html`:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        'mom-pink': '#your-color',
        'mom-blue': '#your-color',
        // ...
      }
    }
  }
}
```

### Thêm Fields
1. Thêm HTML input trong form
2. Cập nhật validation trong `script.js`
3. Cập nhật backend xử lý trong `_worker.js`
4. Thêm column trong Google Sheets

### Custom Domain
1. Cấu hình DNS trỏ về Cloudflare
2. Cập nhật routes trong `wrangler.toml`
3. Enable SSL/TLS

## 📊 Google Sheets Structure

| Column | Field | Type |
|--------|-------|------|
| A | Thời Gian | Timestamp |
| B | Họ Tên | Text |
| C | Số Điện Thoại | Text |
| D | Email | Email |
| E | Tỉnh/Thành | Text |
| F | Tuổi | Text |
| G | Kinh Nghiệm | Text |
| H | Facebook | URL |
| I | Lý Do | Text |
| J | Trạng Thái | Text |

## 🔒 Security

- CORS headers được cấu hình
- Input validation client & server side
- Rate limiting (có thể thêm)
- Sanitization dữ liệu đầu vào

## 📱 Mobile Optimization

- Touch-friendly buttons (min 44px)
- Responsive typography
- Optimized form layout
- Fast loading với CDN

## 🎯 Performance

- Tailwind CSS từ CDN
- Minimal JavaScript
- Cloudflare global network
- Lazy loading images (nếu có)

## 📈 Analytics

Có thể tích hợp:
- Google Analytics
- Cloudflare Analytics  
- Custom tracking events

## 🐛 Troubleshooting

### Form không submit được
1. Kiểm tra console browser
2. Verify Cloudflare Worker đã deploy
3. Kiểm tra CORS headers
4. Test Google Apps Script riêng

### Google Sheets không nhận data
1. Kiểm tra Spreadsheet ID
2. Verify Web App permissions
3. Test Apps Script function
4. Kiểm tra API quotas

### Styling bị lỗi
1. Kiểm tra Tailwind CSS CDN
2. Verify custom CSS syntax
3. Test trên browsers khác nhau

## 📞 Support

Nếu cần hỗ trợ, hãy kiểm tra:
1. Browser console errors
2. Cloudflare Worker logs
3. Google Apps Script execution logs
4. Network tab trong DevTools