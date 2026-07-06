# 🧪 HƯỚNG DẪN TEST EXTENSION

## 🚀 CÁCH TEST NHANH NHẤT (HOT RELOAD)

### ⚡ **Chỉ cần load extension 1 LẦN DUY NHẤT!**

#### Bước 1: Load lần đầu
```
1. Mở Chrome
2. Vào: chrome://extensions/
3. Bật "Developer mode" (toggle góc trên phải)
4. Click "Load unpacked"
5. Chọn thư mục: D:\CTV\chrome-extension
```

#### Bước 2: Mỗi khi sửa code
```
1. Sửa file content.js, sidebar.css...
2. Lưu file (Ctrl+S)
3. Vào chrome://extensions/
4. Click nút "⟳ Reload" (icon tròn) trên extension
5. Refresh trang test (Ctrl+R)
6. XONG! Không cần xóa/cài lại!
```

**Lưu ý:** Chỉ cần reload khi sửa code JavaScript/CSS. Không cần khi chỉ xem.

---

## 🧪 3 CÁCH TEST

### **1️⃣ Test với Test Page (KHÔNG CẦN PANCAKE.VN)**

```bash
# Mở file test trong Chrome:
file:///D:/CTV/chrome-extension/test.html
```

**Ưu điểm:**
- ✅ Không cần vào pancake.vn thật
- ✅ Có sẵn text mẫu để test parse
- ✅ Mock chat box giả lập
- ✅ Checklist đầy đủ
- ✅ Debug instructions

**Cách dùng:**
1. Mở `test.html` trong Chrome
2. Sidebar tự động xuất hiện bên phải
3. Bôi đen text mẫu → Click "Lấy thông tin"
4. Test các tính năng

---

### **2️⃣ Test với Pancake.vn thật**

```
Vào: https://pancake.vn
→ Sidebar xuất hiện
→ Chat với khách thật
→ Test luôn!
```

**Ưu điểm:**
- ✅ Test môi trường thật
- ✅ Tương tác với customer thật

**Nhược điểm:**
- ❌ Cần có tài khoản pancake.vn
- ❌ Phụ thuộc vào khách gửi tin

---

### **3️⃣ Test với DevTools Console**

```javascript
// Mở DevTools (F12) → Console

// Test parse function
const testText = `
Tên: Nguyễn Văn A
SĐT: 0901234567
Địa chỉ: 123 ABC, Q1, TP.HCM
`;

const selection = {toString: () => testText};
// ... Test các function
```

---

## 📋 CHECKLIST TEST ĐẦY ĐỦ

### ✅ UI & Layout
- [ ] Sidebar xuất hiện bên phải
- [ ] Header màu tím gradient
- [ ] Button "Thu gọn" hoạt động
- [ ] Scroll mượt mà
- [ ] Responsive với màn hình nhỏ

### ✅ Parse thông tin
- [ ] Parse format có label (Tên:, SĐT:, Địa chỉ:)
- [ ] Parse format tự do (không label)
- [ ] Parse SĐT +84 → convert 0xxx
- [ ] Parse SĐT có space → remove space
- [ ] Parse địa chỉ dài
- [ ] Parse địa chỉ ngắn
- [ ] Parse text lẫn lộn với text khác

### ✅ Form thông tin khách
- [ ] Input tên hoạt động
- [ ] Input SĐT validation
- [ ] Textarea địa chỉ hoạt động
- [ ] Required fields validate

### ✅ Sản phẩm
- [ ] Thêm sản phẩm mới
- [ ] Xóa sản phẩm
- [ ] Sửa tên, giá, SL
- [ ] Hiển thị đúng số thứ tự
- [ ] Có ít nhất 1 SP mặc định

### ✅ Thanh toán
- [ ] Phí ship mặc định 30,000đ
- [ ] Chi phí ship input hoạt động
- [ ] Dropdown payment method (COD/Bank)
- [ ] Tiền cọc input
- [ ] Validate tiền cọc ≤ tổng tiền
- [ ] Tổng tiền tự động tính

### ✅ Thông tin thêm (MỚI)
- [ ] Dropdown nguồn khách (3 options)
- [ ] Input mã CTV
- [ ] Input mã giảm giá
- [ ] Input số tiền giảm
- [ ] Checkbox "Đơn ưu tiên"
- [ ] Checkbox "Gửi sau"
- [ ] Datetime picker hiện khi tick "Gửi sau"
- [ ] Datetime default = ngày mai 9h

### ✅ Tính tổng tiền
- [ ] Tổng = Sản phẩm + Phí ship
- [ ] Tổng = Tổng - Giảm giá
- [ ] Update realtime khi thay đổi
- [ ] Format VNĐ đúng (xxx,xxxđ)

### ✅ Validation
- [ ] Tên khách không trống
- [ ] SĐT không trống + đúng format
- [ ] Địa chỉ không trống + min 10 ký tự
- [ ] Có ít nhất 1 sản phẩm
- [ ] Sản phẩm có tên + giá
- [ ] Tiền cọc ≤ tổng tiền
- [ ] Nếu "Gửi sau" → Phải chọn ngày giờ
- [ ] Hiển thị lỗi rõ ràng

### ✅ Submit & API
- [ ] Click "Tạo đơn" → Show loading
- [ ] Gọi API đúng URL
- [ ] POST data đúng format
- [ ] Hiển thị success message
- [ ] Form reset sau success
- [ ] Hiển thị error nếu API fail
- [ ] Network tab thấy request

### ✅ Reset & Clear
- [ ] Form reset về trạng thái ban đầu
- [ ] Products reset về 1 SP trống
- [ ] Checkboxes unchecked
- [ ] Datetime picker ẩn
- [ ] Các input về giá trị mặc định

---

## 🐛 TROUBLESHOOTING

### ❌ Sidebar không xuất hiện

**Nguyên nhân:**
- Extension chưa load
- Sai domain (chỉ hoạt động trên pancake.vn hoặc test.html)

**Giải pháp:**
```
1. Kiểm tra chrome://extensions/
2. Extension có bật không?
3. Click "Reload" extension
4. F12 → Console → Xem có lỗi không
```

---

### ❌ Parse không chính xác

**Nguyên nhân:**
- Text format không đúng
- Regex không match

**Giải pháp:**
```
1. Test với text mẫu trong test.html
2. F12 → Console → Xem log parseCustomerInfo()
3. Adjust regex trong content.js nếu cần
```

---

### ❌ API lỗi 403/500

**Nguyên nhân:**
- URL API sai
- CORS chưa config
- API server down

**Giải pháp:**
```
1. Kiểm tra URL trong content.js dòng 7
2. Test API với Postman/curl
3. Check CORS headers
4. F12 → Network → Xem response detail
```

---

### ❌ Form không reset sau submit

**Nguyên nhân:**
- Code reset thiếu
- Event listener bị duplicate

**Giải pháp:**
```
1. Check hàm createOrder() → success block
2. Thêm log để debug
3. Reload extension
```

---

## 📊 TEST CASES MẪU

### Test Case 1: Đơn thường
```
Input:
- Tên: Nguyễn Văn A
- SĐT: 0901234567
- Địa chỉ: 123 ABC, Q1, TP.HCM
- 1 sản phẩm: Bình sữa 200k x 2
- Phí ship: 30k

Expected:
- Tổng: 430,000đ
- Status: success
- API call OK
```

### Test Case 2: Đơn ưu tiên + Gửi sau
```
Input:
- Thông tin khách
- Tick "Đơn ưu tiên"
- Tick "Gửi sau" → Chọn ngày mai 9h
- Sản phẩm

Expected:
- API payload có:
  is_priority: 1
  status: 'send_later'
  planned_send_at_unix: [timestamp]
```

### Test Case 3: Đơn có giảm giá
```
Input:
- Sản phẩm: 200k
- Phí ship: 30k
- Giảm giá: 20k

Expected:
- Tổng hiển thị: 210,000đ (200+30-20)
- API payload có discount_amount: 20000
```

### Test Case 4: Đơn cọc trước
```
Input:
- Tổng: 500k
- Tiền cọc: 100k

Expected:
- Validate OK (cọc < tổng)
- API payload có deposit_amount: 100000

Input Invalid:
- Tổng: 500k
- Tiền cọc: 600k

Expected:
- Show error "Tiền cọc không được lớn hơn tổng tiền"
```

---

## 🎯 WORKFLOW TEST HOÀN CHỈNH

```
1. Sửa code trong content.js
2. Lưu file (Ctrl+S)
3. Vào chrome://extensions/ → Click "Reload"
4. Mở test.html (hoặc refresh nếu đang mở)
5. F12 → Console → Xem logs
6. Test từng tính năng theo checklist
7. Nếu OK → Test trên pancake.vn thật
8. Nếu lỗi → Quay lại bước 1
```

---

## ⚡ TIPS TEST NHANH

### 1. Dùng Chrome DevTools Workspace
```
1. F12 → Sources → Filesystem
2. Add folder → Chọn D:\CTV\chrome-extension
3. Sửa code trực tiếp trong DevTools
4. Ctrl+S → Auto sync với file
```

### 2. Live Reload Extension
```bash
# Cài extension "Extensions Reloader"
# Auto reload khi file thay đổi
```

### 3. Console shortcuts
```javascript
// Shortcut test parse
window.testParse = (text) => {
  console.log(parseCustomerInfo(text));
};

// Usage: testParse("Tên: ABC\nSĐT: 0901234567")
```

---

## 📖 TÀI LIỆU THÊM

- **test.html**: Trang test đầy đủ với mock data
- **CHANGELOG.md**: Chi tiết các tính năng đã bổ sung
- **README.md**: Tài liệu tổng quan
- **INSTALL.md**: Hướng dẫn cài đặt

---

**Happy Testing! 🚀**
