# ✅ Checklist Cài Đặt Hệ Thống

## Giai Đoạn 1: Chuẩn Bị (5 phút)

- [ ] Có Google Sheets danh sách CTV
- [ ] Có Google Sheets đơn hàng (riêng biệt)
- [ ] Sheet đơn hàng có cột "Mã Referral"
- [ ] Đã copy ID của cả 2 sheets

## Giai Đoạn 2: Cấu Hình Google Apps Script (10 phút)

- [ ] Mở Google Sheets CTV > Extensions > Apps Script
- [ ] Copy code từ `google-apps-script/order-handler.js`
- [ ] Cập nhật `CONFIG.ORDER_SHEET_ID` (ID sheet đơn hàng)
- [ ] Cập nhật `CONFIG.ORDER_SHEET_NAME` (tên sheet)
- [ ] Cập nhật `CONFIG.ORDER_COLUMNS` (nếu cần)
- [ ] Lưu script (Ctrl+S)

## Giai Đoạn 3: Test Cấu Hình (5 phút)

- [ ] Chạy function `runAllTests()`
- [ ] Authorize quyền truy cập (nếu được hỏi)
- [ ] Kiểm tra Execution log:
  - [ ] ✅ CTV Sheet: OK
  - [ ] ✅ Order Sheet: OK
  - [ ] ✅ Tìm thấy đơn hàng test

## Giai Đoạn 4: Deploy (5 phút)

- [ ] Click **Deploy > New deployment**
- [ ] Chọn type: **Web app**
- [ ] Execute as: **Me**
- [ ] Who has access: **Anyone**
- [ ] Click **Deploy**
- [ ] Copy **Web app URL**

## Giai Đoạn 5: Cấu Hình Frontend (2 phút)

- [ ] Mở `public/assets/js/config.js`
- [ ] Paste Web app URL vào `GOOGLE_SCRIPT_URL`
- [ ] Đặt `DEMO_MODE: false`
- [ ] Lưu file

## Giai Đoạn 6: Deploy Website (10 phút)

- [ ] Upload thư mục `public/` lên hosting
- [ ] Kiểm tra URL:
  - [ ] `https://yourdomain.com/` - Trang đăng ký
  - [ ] `https://yourdomain.com/ctv/` - Trang tra cứu

## Giai Đoạn 7: Test Hệ Thống (10 phút)

### Test Đăng Ký CTV
- [ ] Mở trang đăng ký
- [ ] Điền form và submit
- [ ] Kiểm tra Google Sheets CTV có dữ liệu mới
- [ ] Nhận được mã Referral

### Test Tra Cứu Đơn Hàng
- [ ] Thêm 1 đơn test vào Google Sheets đơn hàng
- [ ] Điền mã Referral vào đơn test
- [ ] Mở trang tra cứu
- [ ] Nhập mã Referral
- [ ] Kiểm tra hiển thị đơn hàng
- [ ] Kiểm tra tính hoa hồng đúng (10%)

## Giai Đoạn 8: Hoàn Thiện (5 phút)

- [ ] Cập nhật thông tin liên hệ trong `config.js`
- [ ] Thay avatar.jpg bằng logo của bạn
- [ ] Test trên mobile
- [ ] Chia sẻ link với CTV

## 🎉 Hoàn Thành!

Tổng thời gian: ~50 phút

## 📞 Gặp Vấn Đề?

Nếu có bước nào không hoạt động:
1. Xem lại `docs/CAU-HINH-NHANH.md`
2. Check Browser Console (F12)
3. Check Apps Script Execution Log
4. Xem `docs/HUONG-DAN-SUA-LOI.md`
