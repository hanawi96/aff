# 🚀 Hướng Dẫn Deploy - Dành Riêng Cho Bạn

## ✅ Đã Cấu Hình Sẵn

- ✅ Sheet CTV: `1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o`
- ✅ Sheet Đơn Hàng: `1CmfyZg1MCPCv0_RnlBOOf0HIev4RPg4DK43veMGyPJM`
- ✅ Mapping cột đã đúng theo ảnh
- ✅ Hoa hồng: 10%
- ✅ Thông tin liên hệ đã có

## 📝 Các Bước Tiếp Theo

### Bước 1: Deploy Google Apps Script (10 phút)

1. **Mở Google Sheets CTV:**
   - Truy cập: https://docs.google.com/spreadsheets/d/1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o/edit

2. **Vào Apps Script:**
   - Click **Extensions** > **Apps Script**

3. **Copy Code:**
   - Mở file `google-apps-script/order-handler.js` trong project
   - Copy TOÀN BỘ nội dung
   - Paste vào Apps Script editor (xóa code cũ nếu có)

4. **Lưu:**
   - Click icon 💾 hoặc Ctrl+S
   - Đặt tên project: "CTV System"

5. **Test Cấu Hình:**
   - Chọn function: `runAllTests`
   - Click **Run** (▶️)
   - Lần đầu sẽ yêu cầu authorize:
     - Click **Review permissions**
     - Chọn tài khoản Google
     - Click **Advanced** > **Go to CTV System (unsafe)**
     - Click **Allow**
   - Xem **Execution log** (View > Logs):
     - Phải thấy: ✅ CTV Sheet: OK
     - Phải thấy: ✅ Order Sheet: OK

6. **Deploy:**
   - Click **Deploy** > **New deployment**
   - Click ⚙️ > Chọn **Web app**
   - Cấu hình:
     - Description: "CTV System v1.0"
     - Execute as: **Me**
     - Who has access: **Anyone**
   - Click **Deploy**
   - **QUAN TRỌNG:** Copy **Web app URL** (dạng: https://script.google.com/macros/s/...)

### Bước 2: Cập Nhật URL Frontend (2 phút)

1. **Mở file:** `public/assets/js/config.js`

2. **Thay URL:**
   ```javascript
   GOOGLE_SCRIPT_URL: 'PASTE_URL_VỪA_COPY_Ở_ĐÂY',
   ```

3. **Lưu file**

### Bước 3: Test Local (5 phút)

1. **Chạy local server:**
   ```bash
   npm run dev
   ```
   Hoặc dùng Live Server trong VS Code

2. **Test Đăng Ký CTV:**
   - Mở: http://localhost:8080/
   - Điền form và submit
   - Kiểm tra Google Sheets CTV có dữ liệu mới
   - Nhận được mã Referral

3. **Test Tra Cứu:**
   - Mở: http://localhost:8080/ctv/
   - Nhập mã Referral từ sheet đơn hàng (VD: PARTNER001)
   - Kiểm tra hiển thị đơn hàng

### Bước 4: Deploy lên Hosting (10 phút)

**Option A: Netlify (Khuyến nghị - Miễn phí)**

1. Tạo tài khoản tại: https://netlify.com
2. Kéo thả thư mục `public/` vào Netlify
3. Hoặc dùng CLI:
   ```bash
   npm install -g netlify-cli
   netlify deploy --dir=public --prod
   ```

**Option B: Vercel (Miễn phí)**

1. Tạo tài khoản tại: https://vercel.com
2. Install CLI:
   ```bash
   npm install -g vercel
   vercel --prod public
   ```

**Option C: Hosting Truyền Thống (cPanel/FTP)**

1. Upload toàn bộ nội dung thư mục `public/` lên `public_html/`
2. Đảm bảo cấu trúc:
   ```
   public_html/
   ├── index.html
   ├── ctv/
   │   └── index.html
   └── assets/
   ```

### Bước 5: Kiểm Tra Final (5 phút)

- [ ] Trang đăng ký: `https://yourdomain.com/`
- [ ] Trang tra cứu: `https://yourdomain.com/ctv/`
- [ ] Test đăng ký CTV mới
- [ ] Test tra cứu với mã Referral thật
- [ ] Test trên mobile

## 🎉 Hoàn Thành!

Hệ thống đã sẵn sàng sử dụng!

## 📊 Cấu Trúc Dữ Liệu

### Sheet Đơn Hàng (Đã Map)
```
A: Mã Đơn Hàng
B: Ngày Đặt
C: Tên Khách Hàng
D: Số Điện Thoại
E: Địa Chỉ
F: Chi Tiết Sản Phẩm
G: TỔNG KHÁCH PHẢI TRẢ
H: Hướng Thanh Toán
I: Ghi Chú (Status)
J: Mã Referral ⭐
```

### Lưu Ý Quan Trọng

1. **Cột J (Mã Referral) phải có dữ liệu** để CTV tra cứu được
2. **Cột G (Tổng Tiền)** phải là số để tính hoa hồng
3. Hoa hồng = Tổng Tiền × 10%

## 🐛 Xử Lý Lỗi

### Lỗi: "Permission denied"
- Chạy lại `runAllTests()` trong Apps Script
- Authorize lại quyền truy cập

### Lỗi: "Không tìm thấy đơn hàng"
- Kiểm tra cột J có mã Referral chưa
- Kiểm tra mã Referral có đúng không (phân biệt hoa thường)

### Lỗi: "Cannot read properties"
- Kiểm tra tên sheet: "Form responses 1"
- Nếu khác, cập nhật `ORDER_SHEET_NAME` trong `order-handler.js`

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Check Browser Console (F12)
2. Check Apps Script Execution Log
3. Xem file `docs/HUONG-DAN-SUA-LOI.md`

---

**Thời gian ước tính:** 30-40 phút
**Độ khó:** ⭐⭐☆☆☆ (Dễ)
