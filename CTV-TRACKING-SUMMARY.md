# 📦 Tóm Tắt: Hệ Thống Tracking CTV

## ✅ Đã Hoàn Thành

### 🎯 Chức Năng Chính

1. **Cookie Tracking (7 ngày)**
   - Tự động lưu referral code khi khách click vào link CTV
   - Cookie mới nhất ghi đè cookie cũ
   - Hoạt động trên toàn bộ website

2. **Hỗ Trợ 2 Format Link**
   - `?ref=CTV123456` (referral code)
   - `?ref=custom-slug` (slug tùy chỉnh)

3. **Tính Hoa Hồng Tự Động**
   - Công thức: `(total_amount - shipping_fee) × commission_rate`
   - Tính ở frontend, validate ở backend
   - Lưu vào database khi đặt hàng

4. **Lưu Thông Tin CTV Vào Đơn Hàng**
   - `referral_code` - Mã CTV
   - `commission` - Số tiền hoa hồng
   - `commission_rate` - Tỷ lệ hoa hồng
   - `ctv_phone` - SĐT CTV

## 📁 Files Đã Tạo/Sửa

### Files Mới

1. **`public/shop/assets/js/shared/utils/ctv-tracking.js`**
   - Module quản lý cookie và tracking
   - 6 functions chính:
     - `setCTVCookie()` - Lưu cookie
     - `getCTVCookie()` - Đọc cookie
     - `clearCTVCookie()` - Xóa cookie
     - `checkAndSaveReferralFromURL()` - Kiểm tra URL và lưu
     - `getCTVInfoForOrder()` - Lấy info để gửi order
     - `calculateCommission()` - Tính hoa hồng

2. **`database/check-ctv-table.js`**
   - Script kiểm tra cấu trúc bảng CTV

3. **`database/check-orders-schema.js`**
   - Script kiểm tra cấu trúc bảng orders

4. **`database/test-ctv-tracking.js`**
   - Script test toàn bộ chức năng

5. **`CTV-TRACKING-GUIDE.md`**
   - Hướng dẫn chi tiết sử dụng

6. **`CTV-TRACKING-SUMMARY.md`**
   - File này - tóm tắt dự án

### Files Đã Sửa

7. **`public/shop/assets/js/app.js`**
   - Thêm `checkAndSaveReferralFromURL()` khi init

8. **`public/shop/cart.js`**
   - Import CTV tracking module
   - Thêm tracking khi init
   - Lấy CTV info và tính commission khi checkout
   - Gửi data CTV lên backend

9. **`src/services/ctv/ctv-service.js`**
   - Thêm function `validateReferralCode()` mới
   - Hỗ trợ validate cả referral_code và custom_slug

10. **`src/handlers/get-handler.js`**
    - Thêm endpoint `/api/ctv/validateReferral`

11. **`src/services/orders/order-service.js`**
    - Cập nhật logic tính hoa hồng
    - Ưu tiên data từ frontend
    - Fallback tính ở backend nếu cần

## 🧪 Test

### Chạy Test Scripts

```bash
# Kiểm tra bảng CTV
node database/check-ctv-table.js

# Kiểm tra bảng orders
node database/check-orders-schema.js

# Test toàn bộ chức năng
node database/test-ctv-tracking.js
```

### Test Thủ Công

1. **Test tracking cookie:**
   ```
   http://localhost:5500/shop/?ref=CTV865123
   ```
   - Mở Console → Application → Cookies
   - Kiểm tra cookie `vdt_ctv_ref`

2. **Test đặt hàng:**
   - Truy cập link CTV
   - Thêm sản phẩm vào giỏ
   - Checkout
   - Kiểm tra console log
   - Kiểm tra database

3. **Test API:**
   ```bash
   curl "http://localhost:8787/api/ctv/validateReferral?ref=CTV865123"
   ```

## 📊 Kết Quả Test

### Database Schema

**Bảng CTV:**
- ✅ 63 CTV trong hệ thống
- ✅ Tất cả có `referral_code` và `commission_rate`
- ✅ Hỗ trợ `custom_slug`

**Bảng Orders:**
- ✅ Có đầy đủ 4 cột CTV:
  - `referral_code` (TEXT)
  - `commission` (INTEGER)
  - `commission_rate` (REAL)
  - `ctv_phone` (TEXT)

### Test Tính Hoa Hồng

**Ví dụ với CTV "Văn Yên" (21% commission):**
- Tổng đơn: 500,000đ
- Phí ship: 30,000đ
- Doanh thu: 470,000đ
- **Hoa hồng: 98,700đ** ✅

## 🚀 Cách Sử Dụng

### Cho CTV

1. Lấy link giới thiệu:
   ```
   https://shopvd.store/?ref=CTV123456
   ```

2. Chia sẻ link cho khách hàng

3. Khách hàng click vào link → Cookie được lưu 7 ngày

4. Khách đặt hàng trong 7 ngày → CTV được hưởng hoa hồng

### Cho Admin

1. Xem thống kê CTV tại: `/admin/ctv.html`

2. Xem đơn hàng có CTV trong bảng orders:
   - Cột `referral_code` - Mã CTV
   - Cột `commission` - Hoa hồng

3. Tính tổng hoa hồng cho CTV:
   ```sql
   SELECT 
     referral_code,
     SUM(commission) as total_commission,
     COUNT(*) as total_orders
   FROM orders
   WHERE referral_code = 'CTV123456'
   ```

## 🔄 Flow Hoạt Động

```
1. Khách click link CTV
   ↓
2. Frontend validate referral code (API)
   ↓
3. Lưu cookie 7 ngày
   ↓
4. Khách browse sản phẩm
   ↓
5. Khách thêm vào giỏ
   ↓
6. Khách checkout
   ↓
7. Frontend đọc cookie → Lấy CTV info
   ↓
8. Frontend tính commission
   ↓
9. Gửi order + CTV data lên backend
   ↓
10. Backend validate và lưu vào database
```

## ⚙️ Cấu Hình

### Cookie Settings

```javascript
const CTV_COOKIE_NAME = 'vdt_ctv_ref';
const CTV_COOKIE_DAYS = 7;
```

### API Endpoints

```
GET /api/ctv/validateReferral?ref={code}
GET /api/ctv/verifyCTV?code={code}
GET /api/ctv/getAllCTV
GET /api/ctv/getCollaboratorInfo?referralCode={code}
```

## 📝 Lưu Ý Quan Trọng

1. ✅ Cookie mới nhất ghi đè cookie cũ
2. ✅ Hoa hồng tính trên (total - shipping)
3. ✅ Discount không ảnh hưởng hoa hồng
4. ✅ CTV phải có status "Mới" hoặc "Đang hoạt động"
5. ✅ Cookie hoạt động trên toàn bộ domain
6. ✅ Hỗ trợ cả referral_code và custom_slug

## 🎉 Hoàn Thành

Hệ thống tracking CTV đã sẵn sàng sử dụng!

**Các bước tiếp theo:**
1. Deploy lên production
2. Test với đơn hàng thật
3. Theo dõi và điều chỉnh nếu cần

---

**Phiên bản:** 1.0.0  
**Ngày hoàn thành:** 2025-01-27  
**Developer:** Kiro AI
