# Fix Lỗi Cột "Đơn Hàng Của Bạn"

## 🐛 Các Lỗi Đã Sửa

### 1. Lỗi "Lỗi phân tích cú pháp công thức"

**Nguyên nhân:**
- Emoji "🔍" trong công thức HYPERLINK gây lỗi
- Dấu phẩy `,` trong công thức (Google Sheets VN dùng `;`)

**Giải pháp:**
```javascript
// ❌ Cũ (Lỗi)
const linkFormula = '=HYPERLINK("' + orderCheckUrl + '", "🔍 Xem ngay")';

// ✅ Mới (Dùng RichText - An toàn nhất)
const richText = SpreadsheetApp.newRichTextValue()
  .setText('Xem ngay')
  .setLinkUrl(orderCheckUrl)
  .build();
orderLinkCell.setRichTextValue(richText);
```

### 2. Cột Mới Không Xuất Hiện

**Nguyên nhân:**
- Sheet đã có header cũ (9 cột)
- Code chỉ tạo header khi sheet trống
- Không có logic cập nhật header khi thiếu cột

**Giải pháp:**
```javascript
// Kiểm tra số cột hiện tại
const lastColumn = sheet.getLastColumn();

if (lastColumn < headers.length) {
  // Thiếu cột → Cập nhật header
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format cột mới
  const newColumnRange = sheet.getRange(1, lastColumn + 1, 1, headers.length - lastColumn);
  newColumnRange.setBackground('#e91e63');
  newColumnRange.setFontWeight('bold');
  // ...
}
```

## 🔧 Cách Deploy Lại

### Bước 1: Cập Nhật Code

1. Mở Google Sheet CTV
2. Extensions → Apps Script
3. Copy toàn bộ file `google-apps-script/order-handler.js` mới
4. Paste vào Apps Script Editor (thay thế code cũ)

### Bước 2: Test

Chạy function test:
```javascript
function testCTVSheet() {
  // Test kết nối và kiểm tra header
}
```

Xem log:
```
✅ Kết nối CTV Sheet thành công!
Số cột hiện tại: 9, Số cột cần có: 10
⚠️ Thiếu cột! Đang cập nhật header...
✅ Đã thêm cột mới vào header!
```

### Bước 3: Deploy

1. Nhấn **Deploy** → **Manage deployments**
2. Chọn deployment hiện tại
3. Nhấn **Edit** (icon bút chì)
4. Chọn **New version**
5. Nhấn **Deploy**

### Bước 4: Test Đăng Ký

1. Vào trang đăng ký CTV
2. Điền form và submit
3. Kiểm tra Google Sheet:
   - ✅ Có cột "Đơn Hàng Của Bạn"
   - ✅ Có link "Xem ngay"
   - ✅ Click link → mở trang tra cứu

## 🎯 Kết Quả Mong Đợi

### Google Sheet

| ... | Mã Ref | Trạng Thái | Đơn Hàng Của Bạn |
|-----|--------|------------|------------------|
| ... | NYY123 | Mới        | [Xem ngay]       |

**Cột "Đơn Hàng Của Bạn":**
- ✅ Màu nền: Xanh lá nhạt (#d1f2eb)
- ✅ Chữ: Xanh đậm (#0d6832), in đậm
- ✅ Link: `https://shopvd.store/ctv/?code=NYY123`
- ✅ Click vào → mở trang tra cứu

### Modal Đăng Ký

```
┌─────────────────────────────────────┐
│  🎉 Đăng ký thành công!             │
├─────────────────────────────────────┤
│  [Cửa Hàng] [Đơn Hàng] [DS CTV]   │
└─────────────────────────────────────┘
```

## 🐛 Troubleshooting

### Vẫn Không Thấy Cột Mới

**Giải pháp 1: Xóa và tạo lại header**
1. Xóa dòng 1 (header) trong sheet
2. Đăng ký CTV mới
3. Header sẽ được tạo lại với đầy đủ 10 cột

**Giải pháp 2: Thêm cột thủ công**
1. Mở Google Sheet
2. Click cột J (sau cột I "Trạng Thái")
3. Nhập header: "Đơn Hàng Của Bạn"
4. Format: màu hồng, chữ trắng, in đậm

### Link Không Hoạt Động

**Kiểm tra:**
1. Xem log trong Apps Script:
   ```
   Generated OrderCheckUrl: https://shopvd.store/ctv/?code=NYY123
   ```

2. Test link trực tiếp trong browser

3. Kiểm tra cell có công thức không:
   - Click vào cell
   - Xem thanh công thức có `=HYPERLINK(...)` không

### Lỗi "RichText not supported"

**Fallback tự động:**
Code đã có fallback, nếu RichText lỗi sẽ dùng công thức HYPERLINK:
```javascript
try {
  // Dùng RichText
} catch (e) {
  // Fallback: Dùng HYPERLINK
  const linkFormula = '=HYPERLINK("' + orderCheckUrl + '","Xem ngay")';
  orderLinkCell.setFormula(linkFormula);
}
```

## ✅ Checklist

- [ ] Deploy code mới
- [ ] Test đăng ký CTV
- [ ] Kiểm tra cột mới xuất hiện
- [ ] Test click link trong sheet
- [ ] Test nút "Đơn Hàng" trong modal
- [ ] Xác nhận không còn lỗi

## 📞 Hỗ Trợ

Nếu vẫn gặp lỗi:
1. Xem log trong Apps Script: View → Execution log
2. Chạy function `testCTVSheet()` để debug
3. Kiểm tra quyền truy cập Google Sheet
