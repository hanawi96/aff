# 🎯 Hướng Dẫn Sử Dụng Hệ Thống Tracking CTV

## 📋 Tổng Quan

Hệ thống tracking CTV cho phép theo dõi đơn hàng từ link giới thiệu của cộng tác viên và tự động tính hoa hồng.

## 🔗 Cách Hoạt Động

### 1. Link Giới Thiệu

CTV có thể chia sẻ link theo 2 format:

**Format 1: Sử dụng Referral Code**
```
https://shopvd.store/?ref=CTV123456
https://shopvd.store/shop/?ref=CTV123456
https://shopvd.store/shop/cart.html?ref=CTV123456
```

**Format 2: Sử dụng Custom Slug (nếu có)**
```
https://shopvd.store/?ref=ten-ctv
https://shopvd.store/shop/?ref=nguyen-van-a
```

### 2. Cookie Tracking

- Khi khách hàng click vào link CTV, hệ thống lưu cookie `vdt_ctv_ref`
- Cookie có hiệu lực **7 ngày**
- Cookie hoạt động trên **toàn bộ website**
- Nếu khách click vào link CTV khác, cookie sẽ được **cập nhật** (ghi đè)

### 3. Tính Hoa Hồng

**Công thức:**
```
Hoa hồng = (Tổng đơn hàng - Phí ship) × Tỷ lệ hoa hồng
```

**Ví dụ:**
- Tổng đơn hàng: 500,000đ
- Phí ship: 30,000đ
- Tỷ lệ hoa hồng CTV: 10%
- **Hoa hồng = (500,000 - 30,000) × 0.1 = 47,000đ**

### 4. Lưu Thông Tin Vào Đơn Hàng

Khi khách hàng đặt hàng, hệ thống tự động lưu:
- `referral_code` - Mã CTV
- `commission` - Số tiền hoa hồng (VNĐ)
- `commission_rate` - Tỷ lệ hoa hồng (0.1 = 10%)
- `ctv_phone` - Số điện thoại CTV

## 🛠️ Các File Đã Thay Đổi

### Frontend

1. **`public/shop/assets/js/shared/utils/ctv-tracking.js`** (MỚI)
   - Module quản lý cookie tracking
   - Validate referral code
   - Tính hoa hồng

2. **`public/shop/assets/js/app.js`**
   - Thêm tracking khi load trang chủ

3. **`public/shop/cart.js`**
   - Thêm tracking khi load trang giỏ hàng
   - Gửi thông tin CTV khi checkout

### Backend

4. **`src/services/ctv/ctv-service.js`**
   - Thêm function `validateReferralCode()` - Validate cả code và slug

5. **`src/handlers/get-handler.js`**
   - Thêm endpoint `/api/ctv/validateReferral`

6. **`src/services/orders/order-service.js`**
   - Cập nhật logic tính hoa hồng theo công thức mới
   - Ưu tiên sử dụng data từ frontend

## 🧪 Test Chức Năng

### Test 1: Tracking Cookie

```javascript
// Mở console trên trang shop
import { debugCTVTracking } from './assets/js/shared/utils/ctv-tracking.js';
debugCTVTracking();
```

### Test 2: Validate Referral Code

```bash
# Test với referral code
curl "http://localhost:8787/api/ctv/validateReferral?ref=CTV123456"

# Test với custom slug
curl "http://localhost:8787/api/ctv/validateReferral?ref=ten-ctv"
```

### Test 3: Đặt Hàng Từ Link CTV

1. Truy cập: `http://localhost:5500/shop/?ref=CTV865123`
2. Thêm sản phẩm vào giỏ
3. Checkout
4. Kiểm tra console log xem có thông tin CTV không
5. Kiểm tra database bảng `orders` xem có lưu đúng không

### Test 4: Kiểm Tra Database

```javascript
// Chạy script kiểm tra
node database/check-ctv-table.js
node database/check-orders-schema.js
```

## 📊 Xem Thống Kê CTV

### Admin Panel

Truy cập: `https://shopvd.store/admin/ctv.html`

Xem được:
- Danh sách CTV
- Tổng đơn hàng của mỗi CTV
- Tổng doanh thu
- Tổng hoa hồng

### API Endpoints

```bash
# Lấy tất cả CTV với thống kê
GET /api/ctv/getAllCTV

# Lấy thông tin chi tiết 1 CTV
GET /api/ctv/getCollaboratorInfo?referralCode=CTV123456

# Validate referral code
GET /api/ctv/validateReferral?ref=CTV123456
```

## 🔍 Debug

### Kiểm tra cookie hiện tại

```javascript
// Trong console
document.cookie
```

### Xem thông tin CTV từ cookie

```javascript
import { getCTVInfoForOrder } from './assets/js/shared/utils/ctv-tracking.js';
const info = await getCTVInfoForOrder();
console.log(info);
```

### Xóa cookie (test lại)

```javascript
import { clearCTVCookie } from './assets/js/shared/utils/ctv-tracking.js';
clearCTVCookie();
```

## ⚠️ Lưu Ý

1. **Cookie chỉ hoạt động trên HTTPS** (production) hoặc localhost (development)
2. **Cookie bị ghi đè** khi khách click vào link CTV khác
3. **Hoa hồng không tính trên phí ship** - chỉ tính trên giá trị sản phẩm
4. **CTV phải có status "Mới" hoặc "Đang hoạt động"** mới được tracking
5. **Discount không ảnh hưởng** đến hoa hồng (tính trên total_amount - shipping_fee)

## 🚀 Triển Khai Production

1. Deploy code lên Cloudflare Workers
2. Test link CTV trên production
3. Kiểm tra cookie hoạt động đúng
4. Đặt thử 1 đơn hàng test
5. Verify data trong database

## 📞 Hỗ Trợ

Nếu có vấn đề, kiểm tra:
1. Console log có lỗi không
2. Network tab xem API call có thành công không
3. Database có lưu đúng không
4. Cookie có được set không

---

**Phiên bản:** 1.0.0  
**Ngày tạo:** 2025-01-27
