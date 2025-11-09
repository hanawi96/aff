# ⚡ Cấu Hình Nhanh - 5 Phút

## Bước 1: Lấy ID Google Sheets Đơn Hàng

1. Mở Google Sheets đơn hàng của bạn
2. Copy ID từ URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID_NÀY]/edit
   ```

## Bước 2: Kiểm Tra Cấu Trúc Sheet Đơn Hàng

Đảm bảo sheet có các cột sau (thứ tự có thể khác):

| Cột | Tên Cột | Ví Dụ |
|-----|---------|-------|
| A | Mã Đơn | DH001 |
| B | Ngày Đặt | 1/11/2025 |
| C | Tên Khách | Nguyễn Văn A |
| D | SĐT | 0901234567 |
| E | Sản Phẩm | Bỉm Pampers |
| F | Tổng Tiền | 500000 |
| G | Trạng Thái | Hoàn thành |
| H | **Mã Referral** | PARTNER001 |

**⚠️ QUAN TRỌNG:** Phải có cột "Mã Referral" (hoặc "Mã Ref", "Referral")

## Bước 3: Cập Nhật Google Apps Script

1. Mở file `google-apps-script/order-handler.js`
2. Tìm phần CONFIG ở đầu file:

```javascript
const CONFIG = {
  // Sheet ID của danh sách CTV
  CTV_SHEET_ID: '1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o',
  CTV_SHEET_NAME: 'DS REF',
  
  // Sheet ID của đơn hàng - THAY ĐỔI Ở ĐÂY ⬇️
  ORDER_SHEET_ID: 'PASTE_ORDER_SHEET_ID_HERE',
  ORDER_SHEET_NAME: 'Orders', // Tên sheet đơn hàng
  
  // Mapping cột - ĐIỀU CHỈNH NẾU CẦN ⬇️
  ORDER_COLUMNS: {
    orderId: 0,        // Cột A
    orderDate: 1,      // Cột B
    customerName: 2,   // Cột C
    customerPhone: 3,  // Cột D
    products: 4,       // Cột E
    totalAmount: 5,    // Cột F
    status: 6,         // Cột G
    referralCode: 7    // Cột H - Mã Referral
  }
};
```

3. **Thay đổi:**
   - `ORDER_SHEET_ID`: Paste ID sheet đơn hàng (Bước 1)
   - `ORDER_SHEET_NAME`: Tên sheet (VD: "Orders", "Đơn Hàng", "Sheet1")
   - `ORDER_COLUMNS`: Điều chỉnh số thứ tự cột (0 = A, 1 = B, 2 = C...)

## Bước 4: Deploy Google Apps Script

1. Vào Google Sheets CTV
2. **Extensions > Apps Script**
3. Xóa code cũ, paste code mới từ `google-apps-script/order-handler.js`
4. **Deploy > New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. **Authorize** (cho phép truy cập cả 2 sheets)
6. Copy **Web app URL**

## Bước 5: Cập Nhật Config Frontend

Mở file `public/assets/js/config.js`:

```javascript
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'PASTE_WEB_APP_URL_HERE', // ⬅️ Paste URL từ Bước 4
    COMMISSION_RATE: 0.1,
    DEMO_MODE: false
};
```

## ✅ Test Hệ Thống

### Test 1: Đăng ký CTV
1. Mở `public/index.html` trong browser
2. Điền form và submit
3. Kiểm tra Google Sheets CTV có dữ liệu mới

### Test 2: Tra cứu đơn hàng
1. Thêm 1 đơn hàng test vào Google Sheets đơn hàng với mã Referral
2. Mở `public/ctv/index.html`
3. Nhập mã Referral
4. Kiểm tra có hiển thị đơn hàng không

## 🐛 Nếu Gặp Lỗi

### Lỗi: "Không tìm thấy đơn hàng"

**Nguyên nhân:** Cột Referral không đúng

**Giải pháp:**
1. Mở Google Apps Script
2. Vào **View > Execution log**
3. Chạy test: `getOrdersByReferralCode('PARTNER001')`
4. Xem log để biết cột nào đang được sử dụng
5. Điều chỉnh `ORDER_COLUMNS.referralCode` trong CONFIG

### Lỗi: "Permission denied"

**Nguyên nhân:** Chưa authorize truy cập sheet đơn hàng

**Giải pháp:**
1. Trong Apps Script, chạy function `getOrdersByReferralCode('TEST')`
2. Click **Review permissions**
3. Cho phép truy cập

### Lỗi: "Cannot find sheet"

**Nguyên nhân:** Tên sheet không đúng

**Giải pháp:**
1. Kiểm tra tên sheet trong Google Sheets đơn hàng
2. Cập nhật `ORDER_SHEET_NAME` trong CONFIG
3. Deploy lại

## 📞 Cần Hỗ Trợ?

Nếu vẫn gặp vấn đề:
1. Check Browser Console (F12)
2. Check Apps Script Execution Log
3. Đảm bảo cả 2 sheets đều có quyền truy cập
