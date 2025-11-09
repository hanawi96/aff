# Link Tra Cứu Đơn Hàng Cho CTV

## 🎯 Tính Năng Mới

Khi CTV đăng ký thành công, hệ thống sẽ:
1. ✅ Tạo cột "Đơn Hàng Của Bạn" trong Google Sheet
2. ✅ Thêm link "🔍 Xem ngay" dạng: `https://shopvd.store/ctv/?code=PARTNER001`
3. ✅ Hiển thị nút "Đơn Hàng" trong modal đăng ký thành công
4. ✅ CTV click vào → xem ngay đơn hàng của mình

## 📋 Cách Hoạt Động

### 1. CTV Đăng Ký
```
Họ tên: Nguyễn Thị Yến
SĐT: 0901234567
...
```

### 2. Hệ Thống Tạo Mã CTV
```
Mã CTV: NYY12345
```

### 3. Tạo Link Tra Cứu
```
Link: https://shopvd.store/ctv/?code=NYY12345
```

### 4. Lưu Vào Google Sheet

| Họ Tên | SĐT | ... | Mã Ref | Trạng Thái | Đơn Hàng Của Bạn |
|--------|-----|-----|--------|------------|------------------|
| Nguyễn Thị Yến | 0901... | ... | NYY12345 | Mới | 🔍 Xem ngay |

**Cột "Đơn Hàng Của Bạn":**
- Text hiển thị: "🔍 Xem ngay"
- Link: `https://shopvd.store/ctv/?code=NYY12345`
- Format: Màu xanh lá, in đậm, căn giữa

### 5. Modal Đăng Ký Thành Công

Sau khi đăng ký, CTV thấy modal với 3 nút:

```
┌─────────────────────────────────────────┐
│  🎉 Đăng ký thành công!                 │
├─────────────────────────────────────────┤
│  [Cửa Hàng] [Đơn Hàng] [DS CTV]       │
└─────────────────────────────────────────┘
```

**Nút "Đơn Hàng":**
- Màu xanh lá
- Icon giỏ hàng
- Link đến: `https://shopvd.store/ctv/?code=NYY12345`

## 🔧 Cấu Trúc Google Sheet

### Cột Mới: "Đơn Hàng Của Bạn" (Cột 10)

```javascript
// Trong order-handler.js
const headers = [
  'Thời Gian',      // Cột 1
  'Họ Tên',         // Cột 2
  'Số Điện Thoại',  // Cột 3
  'Tỉnh/Thành',     // Cột 4
  'Tuổi',           // Cột 5
  'Kinh Nghiệm',    // Cột 6
  'Lý Do',          // Cột 7
  'Mã Ref',         // Cột 8
  'Trạng Thái',     // Cột 9
  'Đơn Hàng Của Bạn' // Cột 10 ⭐ MỚI
];
```

### Format Cột 10

```javascript
// Tạo hyperlink
const linkFormula = '=HYPERLINK("' + orderCheckUrl + '", "🔍 Xem ngay")';

// Format đẹp
orderLinkCell.setBackground('#d1f2eb'); // Màu xanh lá nhạt
orderLinkCell.setFontColor('#0d6832');  // Chữ xanh đậm
orderLinkCell.setFontWeight('bold');
orderLinkCell.setHorizontalAlignment('center');
```

## 📱 Giao Diện

### Desktop
```
┌──────────────────────────────────────────────────┐
│  [🏪 Cửa Hàng]  [🛒 Đơn Hàng]  [📋 DS CTV]     │
└──────────────────────────────────────────────────┘
```

### Mobile
```
┌────────────────────────────────────┐
│  [Shop]  [Đơn]  [CTV]             │
└────────────────────────────────────┘
```

## 🎨 Màu Sắc Nút

| Nút | Màu | Gradient |
|-----|-----|----------|
| Cửa Hàng | Hồng | `from-pink-600 to-rose-600` |
| Đơn Hàng | Xanh lá | `from-green-600 to-emerald-600` ⭐ |
| DS CTV | Tím | `from-purple-600 to-indigo-600` |

## 🚀 Deploy

### 1. Cập Nhật Google Apps Script

Copy toàn bộ file `google-apps-script/order-handler.js` vào Apps Script Editor.

**Thay đổi:**
- ✅ Thêm cột "Đơn Hàng Của Bạn" vào header
- ✅ Tạo link `orderCheckUrl`
- ✅ Thêm hyperlink vào cột 10
- ✅ Format đẹp cho cột 10
- ✅ Trả về `orderCheckUrl` trong response

### 2. Cập Nhật Frontend

File `public/assets/js/referral-form.js` đã được cập nhật:
- ✅ Nhận `orderCheckUrl` từ response
- ✅ Truyền vào `showSuccessModal`
- ✅ Thêm nút "Đơn Hàng" vào modal

### 3. Test

**Test 1: Đăng ký CTV mới**
1. Vào trang đăng ký
2. Điền form và submit
3. Kiểm tra modal có nút "Đơn Hàng" không
4. Click nút → chuyển đến trang tra cứu với mã CTV

**Test 2: Kiểm tra Google Sheet**
1. Mở Google Sheet CTV
2. Kiểm tra cột 10 "Đơn Hàng Của Bạn"
3. Click "🔍 Xem ngay" → mở trang tra cứu

**Test 3: Link hoạt động**
1. Copy link từ sheet
2. Paste vào browser
3. Kiểm tra trang tự động load đơn hàng

## ✅ Checklist

- [ ] Deploy Google Apps Script
- [ ] Test đăng ký CTV mới
- [ ] Kiểm tra cột mới trong sheet
- [ ] Test click link trong sheet
- [ ] Test nút "Đơn Hàng" trong modal
- [ ] Test trên mobile
- [ ] Test trên desktop

## 💡 Lợi Ích

### Cho CTV
- ✅ Dễ dàng tra cứu đơn hàng
- ✅ Không cần nhớ mã CTV
- ✅ Bookmark link để xem thường xuyên
- ✅ Chia sẻ link cho team (nếu cần)

### Cho Admin
- ✅ Dễ hỗ trợ CTV (gửi link trực tiếp)
- ✅ Giảm câu hỏi "Làm sao xem đơn?"
- ✅ Tăng trải nghiệm người dùng
- ✅ Chuyên nghiệp hơn

## 🎯 Kết Luận

Tính năng này giúp CTV dễ dàng truy cập trang tra cứu đơn hàng ngay sau khi đăng ký, không cần nhớ mã CTV hay tìm kiếm link.
