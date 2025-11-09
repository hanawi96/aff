# Hệ Thống Cộng Tác Viên - Mẹ & Bé

## 📁 Cấu Trúc Thư Mục

```
CTV/
├── public/                          # Thư mục public (deploy lên hosting)
│   ├── index.html                   # Trang đăng ký CTV
│   ├── ctv/                         # Module tra cứu đơn hàng CTV
│   │   └── index.html               # Trang tra cứu đơn hàng
│   ├── assets/                      # Tài nguyên tĩnh
│   │   ├── js/                      # JavaScript files
│   │   │   ├── config.js            # Cấu hình hệ thống ⚙️
│   │   │   ├── referral-form.js     # Logic form đăng ký CTV
│   │   │   └── ctv.js               # Logic tra cứu đơn hàng
│   │   ├── css/                     # CSS files (nếu cần)
│   │   └── avatar.jpg               # Hình đại diện
│   └── data/                        # Dữ liệu tĩnh
│       ├── products.json            # Danh sách sản phẩm
│       └── discounts.json           # Mã giảm giá
│
├── google-apps-script/              # Google Apps Script code
│   └── order-handler.js             # Xử lý đơn hàng & tra cứu CTV
│
├── functions/                       # Cloudflare Workers / Serverless
│   └── api/                         # API endpoints
│
├── docs/                            # Tài liệu hướng dẫn
│   ├── DEPLOY.md                    # Hướng dẫn deploy ⭐
│   ├── HUONG-DAN-CTV.md             # Hướng dẫn cấu hình CTV
│   └── HUONG-DAN-SUA-LOI.md         # Hướng dẫn sửa lỗi
│
├── .gitignore                       # Git ignore file
├── package.json                     # NPM dependencies
├── worker.js                        # Cloudflare Worker routing
└── README.md                        # File này

```

## 🚀 Cài Đặt Nhanh (5 Phút)

### ⚡ Xem hướng dẫn chi tiết: `docs/CAU-HINH-NHANH.md`

**TL;DR:**
1. Lấy ID Google Sheets đơn hàng
2. Cập nhật CONFIG trong `google-apps-script/order-handler.js`
3. Deploy Google Apps Script
4. Cập nhật URL trong `public/assets/js/config.js`
5. Test hệ thống

## 🚀 Cài Đặt & Triển Khai

### 1. Cấu Hình Google Apps Script

1. Mở Google Sheets CTV
2. Vào **Extensions > Apps Script**
3. Copy nội dung file `google-apps-script/order-handler.js`
4. **Cập nhật CONFIG** (Sheet ID đơn hàng, tên sheet, mapping cột)
5. **Chạy test:** `runAllTests()` để kiểm tra cấu hình
6. Deploy as Web App
7. Copy URL và cập nhật vào `public/assets/js/config.js`

### 2. Deploy lên Hosting

Upload toàn bộ thư mục `public/` lên hosting của bạn.

**URL truy cập:**
- Đăng ký CTV: `https://yourdomain.com/`
- Tra cứu đơn hàng: `https://yourdomain.com/ctv/`

### 3. Cấu Hình Routing (Tùy chọn)

Nếu muốn URL ngắn gọn hơn (`/ctv` thay vì `/ctv/`), cấu hình trong `worker.js`

## 📖 Hướng Dẫn Chi Tiết

- **Deploy hệ thống:** Xem file `docs/DEPLOY.md` ⭐
- **Cấu hình hệ thống CTV:** Xem file `docs/HUONG-DAN-CTV.md`
- **Xử lý lỗi:** Xem file `docs/HUONG-DAN-SUA-LOI.md`

## 🔗 Liên Kết Quan Trọng

- Google Sheets: [Link đến sheet của bạn]
- Google Apps Script: [Link đến script]
- Website: [Link website]

## 📞 Liên Hệ

- Zalo: 0972.483.892 / 0386.190.596
- Nhóm Zalo CTV: https://zalo.me/g/gvqvxu828
