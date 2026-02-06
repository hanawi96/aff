# 🔍 CTV Debug Panel - Hướng Dẫn Sử Dụng

## 📋 Tổng Quan

CTV Debug Panel là một công cụ debug nhỏ gọn giúp bạn kiểm tra CTV tracking ngay trên trang web.

## 🎯 Khi Nào Panel Hiện?

Panel tự động hiện khi:
1. **Localhost:** `http://localhost:5500/shop/`
2. **URL có ?debug=ctv:** `https://shopvd.store/?debug=ctv`
3. **URL có ?ref=:** `https://shopvd.store/?ref=CTV123456`

## 🎨 Giao Diện Panel

### Nút Toggle (Floating Button)
- Vị trí: Góc dưới bên phải
- Màu: Gradient tím
- Icon: Biểu đồ tròn
- Text: "CTV"

### Panel Chính

```
┌─────────────────────────────────────┐
│ 🔍 CTV Tracking Debug           [×] │
├─────────────────────────────────────┤
│ 🍪 Cookie Status:                   │
│    ✅ Active: CTV865123              │
│                                     │
│ 👤 CTV Info:                        │
│    Văn Yên                          │
│    📞 0901234567                    │
│    🔗 CTV865123                     │
│                                     │
│ 💰 Tỷ lệ hoa hồng:                  │
│    21.0%                            │
│                                     │
│ 🧪 Test hoa hồng (500k - 30k ship):│
│    98,700đ                          │
│                                     │
│ ⏰ Cookie expires:                  │
│    ~7 ngày (estimate)               │
│                                     │
│ [🔄 Refresh] [🗑️ Clear] [💻 Console]│
└─────────────────────────────────────┘
```

## 🔧 Các Chức Năng

### 1. Cookie Status
- **✅ Active:** Có cookie CTV
- **❌ No cookie:** Chưa có cookie
- Hiển thị referral code hiện tại

### 2. CTV Info
Hiển thị thông tin CTV:
- Tên CTV
- Số điện thoại
- Referral code

### 3. Tỷ lệ Hoa Hồng
- Hiển thị % hoa hồng của CTV
- Ví dụ: 21.0%, 10.0%

### 4. Test Hoa Hồng
- Tính hoa hồng với đơn hàng mẫu:
  - Tổng: 500,000đ
  - Ship: 30,000đ
  - Doanh thu: 470,000đ
- Hiển thị số tiền hoa hồng

### 5. Cookie Expires
- Ước tính thời gian hết hạn (~7 ngày)

### 6. Nút Actions

#### 🔄 Refresh
- Cập nhật lại thông tin
- Gọi API để lấy CTV info mới nhất

#### 🗑️ Clear Cookie
- Xóa cookie CTV
- Có confirm trước khi xóa
- Dùng để test lại từ đầu

#### 💻 Console Log
- In thông tin debug ra console
- Hiển thị:
  - Cookie name
  - Referral code
  - Expiry days
  - Has cookie status

## 🧪 Cách Test

### Test 1: Truy Cập Link CTV

**Steps:**
1. Mở: `http://localhost:5500/shop/?ref=CTV865123`
2. Panel tự động hiện (vì có ?ref=)
3. Kiểm tra panel:
   - ✅ Cookie Status: Active
   - ✅ CTV Info: Hiển thị tên, SĐT
   - ✅ Tỷ lệ hoa hồng: Hiển thị %
   - ✅ Test hoa hồng: Hiển thị số tiền

**Expected:**
- Panel hiện ngay
- Tất cả thông tin đầy đủ
- Cookie được lưu

### Test 2: Refresh Thông Tin

**Steps:**
1. Đang ở trang có CTV cookie
2. Click nút "🔄 Refresh"
3. Chờ 1-2 giây

**Expected:**
- Thông tin được cập nhật
- Không có lỗi
- Data vẫn chính xác

### Test 3: Clear Cookie

**Steps:**
1. Đang có CTV cookie
2. Click nút "🗑️ Clear Cookie"
3. Confirm "OK"

**Expected:**
- Alert: "✅ Đã xóa cookie!"
- Cookie Status: ❌ No cookie
- CTV Info: "Không có CTV"
- Tỷ lệ hoa hồng: "-"

### Test 4: Console Log

**Steps:**
1. Mở Console (F12)
2. Click nút "💻 Console Log"
3. Xem console

**Expected:**
```javascript
🔍 CTV Tracking Debug: {
  hasCookie: true,
  referralCode: "CTV865123",
  cookieName: "vdt_ctv_ref",
  expiryDays: 7
}
```

### Test 5: Auto Update

**Steps:**
1. Mở panel
2. Để yên 2 giây
3. Quan sát

**Expected:**
- Panel tự động refresh mỗi 2 giây
- Thông tin luôn mới nhất

### Test 6: Đặt Hàng Với CTV

**Steps:**
1. Truy cập link CTV
2. Kiểm tra panel (có cookie)
3. Thêm sản phẩm vào giỏ
4. Checkout
5. Kiểm tra console log khi submit

**Expected:**
- Console log hiển thị CTV info
- Order data có:
  - `referral_code`
  - `commission`
  - `commission_rate`
  - `ctv_phone`

## 📱 Responsive

### Desktop
- Panel: 350px width
- Vị trí: Bottom-right
- Toggle button: 56x56px

### Mobile
- Panel: Full width (trừ margin)
- Vị trí: Bottom (full width)
- Toggle button: 48x48px
- Actions: Stack vertical

## 🎨 Màu Sắc

### Panel
- Header: Gradient tím (#667eea → #764ba2)
- Background: White
- Border: Shadow

### Status
- Active: Green (#27ae60)
- Inactive: Gray (#95a5a6)
- Rate: Red (#e74c3c)
- Commission: Green (#27ae60)
- Expiry: Orange (#f39c12)

### Buttons
- Refresh: Gradient tím
- Clear: Gradient hồng
- Console: Gradient xanh

## 🔒 Bảo Mật

### Chỉ Hiện Khi:
1. Localhost (development)
2. URL có ?debug=ctv (manual enable)
3. URL có ?ref= (có CTV tracking)

### Không Hiện Khi:
- Production thông thường
- Không có query params
- User không cần debug

## 💡 Tips

### Tip 1: Bật Panel Trên Production
```
https://shopvd.store/?debug=ctv
```

### Tip 2: Test Nhiều CTV
1. Clear cookie
2. Click link CTV khác
3. Kiểm tra panel
4. Cookie mới ghi đè cookie cũ

### Tip 3: Debug Order
1. Mở panel
2. Mở Console (F12)
3. Đặt hàng
4. Xem console log
5. Kiểm tra order data

### Tip 4: Ẩn Panel
- Click nút [×] ở góc panel
- Hoặc click toggle button lại

## 📊 Auto-Update Logic

```javascript
// Panel tự động update mỗi 2 giây
setInterval(() => {
    if (this.isVisible) {
        this.updateInfo();
    }
}, 2000);
```

## 🚀 Production Usage

### Enable Debug Panel
```html
<!-- Thêm vào URL -->
?debug=ctv

<!-- Hoặc trong code -->
window.ctvDebugPanel = new CTVDebugPanel();
```

### Disable Debug Panel
- Xóa `?debug=ctv` khỏi URL
- Panel tự động ẩn

## 📝 Files

1. **JavaScript:** `public/shop/assets/js/shared/components/ctv-debug-panel.js`
2. **CSS:** `public/shop/assets/css/ctv-debug-panel.css`
3. **Import:** 
   - `public/shop/assets/js/app.js`
   - `public/shop/cart.js`
4. **HTML:**
   - `public/shop/index.html`
   - `public/shop/cart.html`

---

**Phiên bản:** 1.0.0  
**Ngày tạo:** 2025-01-27  
**Developer:** Kiro AI
