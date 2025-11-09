# Hướng Dẫn Deploy Hệ Thống

## 📦 Chuẩn Bị

### 1. Cấu Hình Config

Mở file `public/assets/js/config.js` và cập nhật:

```javascript
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL',
    SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
    COMMISSION_RATE: 0.1,  // 10%
    DEMO_MODE: false       // Tắt demo mode khi production
};
```

### 2. Deploy Google Apps Script

1. Mở Google Sheets
2. **Extensions > Apps Script**
3. Copy code từ `google-apps-script/order-handler.js`
4. **Deploy > New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Web app URL** và paste vào `config.js`

## 🚀 Deploy lên Hosting

### Option 1: Static Hosting (Netlify, Vercel, GitHub Pages)

Upload thư mục `public/`:

```bash
# Netlify
netlify deploy --dir=public --prod

# Vercel
vercel --prod public

# GitHub Pages
# Push thư mục public/ lên branch gh-pages
```

### Option 2: Traditional Hosting (cPanel, FTP)

1. Upload toàn bộ nội dung thư mục `public/` lên `public_html/`
2. Cấu trúc sau khi upload:

```
public_html/
├── index.html
├── ctv/
│   └── index.html
└── assets/
    ├── js/
    ├── css/
    └── avatar.jpg
```

### Option 3: Cloudflare Pages

```bash
# Install Wrangler
npm install -g wrangler

# Deploy
wrangler pages publish public --project-name=ctv-system
```

## 🔧 Cấu Hình URL Routing

### Apache (.htaccess)

Tạo file `public/.htaccess`:

```apache
RewriteEngine On

# Redirect /ctv to /ctv/
RewriteRule ^ctv$ /ctv/ [R=301,L]

# Enable clean URLs
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /$1.html [L]
```

### Nginx

Thêm vào config:

```nginx
location /ctv {
    try_files $uri $uri/ /ctv/index.html;
}

location / {
    try_files $uri $uri.html $uri/ =404;
}
```

### Cloudflare Workers

File `worker.js` đã có sẵn, chỉ cần deploy:

```bash
wrangler publish
```

## ✅ Kiểm Tra Sau Deploy

1. **Trang đăng ký CTV:** `https://yourdomain.com/`
2. **Trang tra cứu:** `https://yourdomain.com/ctv/`
3. Test form đăng ký
4. Test tra cứu với mã Referral thật

## 🔐 Bảo Mật

### HTTPS

Đảm bảo site chạy trên HTTPS (bắt buộc cho Google Apps Script)

### CORS

Google Apps Script đã xử lý CORS, không cần cấu hình thêm

### Rate Limiting

Nếu cần, thêm rate limiting trong Cloudflare hoặc server

## 📊 Monitoring

### Google Apps Script Logs

Xem logs tại: **Apps Script > Executions**

### Analytics

Thêm Google Analytics vào `public/index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🐛 Troubleshooting

### Lỗi: "Failed to fetch"

- Kiểm tra GOOGLE_SCRIPT_URL trong config.js
- Đảm bảo Google Apps Script đã deploy đúng
- Kiểm tra quyền truy cập (phải là "Anyone")

### Lỗi: "CORS policy"

- Đảm bảo site chạy trên HTTPS
- Kiểm tra Google Apps Script có return đúng headers

### Lỗi: 404 Not Found

- Kiểm tra cấu trúc thư mục
- Kiểm tra routing config (.htaccess hoặc nginx)

## 📞 Hỗ Trợ

Nếu gặp vấn đề, kiểm tra:
1. Browser Console (F12)
2. Google Apps Script Execution Log
3. Network tab trong DevTools
