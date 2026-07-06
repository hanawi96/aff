# 🚀 HƯỚNG DẪN CÀI ĐẶT NHANH

## Bước 1: Chuẩn bị Icon (Tùy chọn)

Extension đã có `icon.svg` nhưng Chrome cần PNG. Bạn có 2 cách:

### Cách A: Dùng luôn (không cần icon)
Bỏ qua bước này, Chrome sẽ dùng icon mặc định.

### Cách B: Tạo icon PNG (khuyên dùng)
1. Mở `icon.svg` bằng trình duyệt
2. Screenshot hoặc dùng tool online: https://cloudconvert.com/svg-to-png
3. Convert thành `icon.png` (128x128px)
4. Copy file `icon.png` vào thư mục `D:\CTV\chrome-extension\`

## Bước 2: Load Extension vào Chrome

1. Mở Chrome
2. Vào: `chrome://extensions/`
3. Bật **Developer mode** (toggle góc trên bên phải)
4. Click nút **"Load unpacked"**
5. Chọn thư mục: `D:\CTV\chrome-extension`
6. ✅ Xong! Extension xuất hiện trong danh sách

## Bước 3: Test thử

1. Vào trang: https://pancake.vn
2. **Sidebar màu tím sẽ xuất hiện bên phải** 🎉
3. Test các tính năng:
   - Bôi đen text → Click "Lấy thông tin"
   - Thêm sản phẩm
   - Tạo đơn hàng

## Lỗi thường gặp

### ❌ "Manifest file is missing or unreadable"
→ Kiểm tra đường dẫn thư mục đúng chưa

### ❌ Sidebar không hiện
→ Reload trang (Ctrl+R) hoặc F12 xem Console

### ❌ API lỗi
→ Kiểm tra URL API trong `content.js` dòng 6

## Nâng cấp

Muốn sửa code:
1. Chỉnh sửa file `content.js`, `sidebar.css`...
2. Vào `chrome://extensions/`
3. Click nút **reload** (icon tròn trên extension)
4. Refresh lại trang pancake.vn

---

**Cần hỗ trợ? Liên hệ dev team!** 💪
