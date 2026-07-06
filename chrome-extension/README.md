# ShopVD Order Helper - Chrome Extension

Extension giúp tạo đơn hàng nhanh từ pancake.vn sang hệ thống ShopVD.

## ✨ Tính năng

- ✅ Sidebar xuất hiện tự động khi vào pancake.vn
- ✅ Parse thông tin khách hàng từ text được chọn (tên, SĐT, địa chỉ)
- ✅ Form tạo đơn đơn giản, dễ sử dụng
- ✅ Tự động tính tổng tiền
- ✅ Gọi API ShopVD để tạo đơn ngay lập tức
- ✅ Responsive, thu gọn được

## 🚀 Cài đặt

### Cách 1: Load Extension trực tiếp (Developer Mode)

1. Mở Chrome → Vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **Load unpacked**
4. Chọn thư mục `D:\CTV\chrome-extension`
5. Xong! Extension đã sẵn sàng

### Cách 2: Đóng gói Extension (Production)

```bash
# Zip toàn bộ thư mục chrome-extension
# Sau đó upload lên Chrome Web Store
```

## 📖 Hướng dẫn sử dụng

### Bước 1: Vào pancake.vn
- Mở trang pancake.vn
- Sidebar ShopVD sẽ tự động xuất hiện bên phải

### Bước 2: Lấy thông tin khách hàng
**Cách A: Parse tự động**
1. Khách gửi tin nhắn với thông tin:
   ```
   Tên: Nguyễn Văn A
   SĐT: 0901234567
   Địa chỉ: 123 Đường ABC, Quận 1, TP.HCM
   ```
2. Bôi đen (select) toàn bộ text
3. Click nút **"✨ Lấy thông tin từ text đã chọn"**
4. Extension sẽ tự động điền vào form

**Cách B: Nhập tay**
- Điền thông tin trực tiếp vào các ô input

### Bước 3: Thêm sản phẩm
1. Click **"➕ Thêm sản phẩm"**
2. Nhập tên, giá, số lượng
3. Thêm nhiều sản phẩm nếu cần
4. Click **"✕"** để xóa sản phẩm

### Bước 4: Tạo đơn
1. Kiểm tra phí ship
2. Chọn phương thức thanh toán (COD / Chuyển khoản)
3. Thêm ghi chú (nếu có)
4. Click **"🚀 Tạo đơn hàng"**
5. Đợi thông báo thành công!

## 🔧 Cấu hình

### Thay đổi API URL

Mở file `content.js`, tìm dòng:

```javascript
const API_BASE_URL = 'https://ctv-api.yendev96.workers.dev';
```

Thay bằng URL API của bạn.

### Thay đổi domain target

Mở file `manifest.json`, tìm:

```json
"matches": [
  "https://*.pancake.vn/*"
]
```

Thay bằng domain bạn muốn extension hoạt động.

## 🎨 Tùy chỉnh giao diện

Chỉnh sửa file `sidebar.css` để thay đổi màu sắc, kích thước, font chữ...

### Ví dụ: Thay đổi màu chủ đạo

```css
.shopvd-sidebar-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* Đổi thành màu khác, ví dụ: */
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
```

## 📝 Cấu trúc file

```
chrome-extension/
├── manifest.json       # Cấu hình extension
├── content.js          # Logic chính (inject sidebar, parse, API)
├── sidebar.css         # Styles cho sidebar
├── popup.html          # Popup khi click icon extension
├── icon.png            # Icon extension (cần thêm)
└── README.md           # File này
```

## 🐛 Troubleshooting

### Sidebar không xuất hiện?
1. Kiểm tra đã vào đúng domain pancake.vn chưa
2. F12 → Console → Xem có lỗi không
3. Reload lại trang (Ctrl+R)

### Parse thông tin không chính xác?
- Format text phải có cấu trúc rõ ràng
- Hoặc nhập tay vào form

### API trả về lỗi?
1. Kiểm tra URL API trong `content.js`
2. Kiểm tra CORS đã được config chưa
3. Xem Network tab trong DevTools

## 🔐 Bảo mật

- Extension chỉ hoạt động trên domain pancake.vn
- Không lưu trữ thông tin khách hàng
- Không gửi dữ liệu đến bên thứ ba (trừ API ShopVD)

## 📦 API Endpoint

Extension gọi API:

```
POST https://ctv-api.yendev96.workers.dev/api/order/create

Body:
{
  "orderId": "DH1234567890",
  "customer": {
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "address": "123 Đường ABC, Quận 1, TP.HCM"
  },
  "cart": [
    {
      "name": "Sản phẩm A",
      "price": 100000,
      "quantity": 2
    }
  ],
  "totalAmount": 230000,
  "paymentMethod": "cod",
  "status": "pending",
  "shippingFee": 30000
}
```

## 🎯 Roadmap

- [ ] Thêm autocomplete cho sản phẩm từ database
- [ ] Lưu draft đơn hàng
- [ ] Tích hợp với nhiều nguồn chat khác
- [ ] Export lịch sử đơn đã tạo
- [ ] Dark mode

## 👨‍💻 Phát triển

Extension được viết bằng Vanilla JavaScript, không dependencies.

Để dev:
1. Sửa code
2. Vào `chrome://extensions/`
3. Click nút **reload** (icon tròn)
4. Refresh trang pancake.vn

## 📄 License

MIT License - Tự do sử dụng và chỉnh sửa

---

**Developed with ❤️ for ShopVD Team**
