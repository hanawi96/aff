# Logic Lọc Đơn Hàng Referral

## 🎯 Yêu Cầu

Hiển thị **10 đơn hàng CÓ MÃ REFERRAL mới nhất**, không phải tất cả đơn hàng.

## 🔍 Tại Sao Cần Lọc?

Trong sheet đơn hàng có 2 loại đơn:

### 1. Đơn Hàng Qua CTV (Có Mã Referral)
```
| Mã Đơn | Ngày      | Khách Hàng | ... | Mã Referral |
|--------|-----------|------------|-----|-------------|
| ORD001 | 09/11/2024| Nguyễn A   | ... | PARTNER001  | ✅
| ORD002 | 09/11/2024| Trần B     | ... | SHOP123     | ✅
```

### 2. Đơn Hàng Trực Tiếp (Không Có Mã Referral)
```
| Mã Đơn | Ngày      | Khách Hàng | ... | Mã Referral |
|--------|-----------|------------|-----|-------------|
| ORD003 | 09/11/2024| Lê C       | ... |             | ❌ Bỏ qua
| ORD004 | 09/11/2024| Phạm D     | ... |             | ❌ Bỏ qua
```

## 💡 Logic Lọc

### Trước Đây (SAI)
```javascript
// Lấy tất cả đơn hàng, kể cả không có mã referral
for (let i = data.length - 1; i >= 1; i--) {
  const row = data[i];
  
  if (!row[cols.orderId]) continue;
  
  orders.push({
    orderId: row[cols.orderId],
    referralCode: row[cols.referralCode] || '' // ❌ Có thể rỗng
  });
  
  if (orders.length >= limit) break;
}
```

**Vấn đề:** Lấy cả đơn không có mã referral → Hiển thị đơn trực tiếp lẫn với đơn CTV.

### Bây Giờ (ĐÚNG)
```javascript
// Chỉ lấy đơn hàng CÓ MÃ REFERRAL
for (let i = data.length - 1; i >= 1; i--) {
  const row = data[i];
  
  if (!row[cols.orderId]) continue;
  
  // ⭐ Kiểm tra có mã referral không
  const refCode = row[cols.referralCode];
  if (!refCode || refCode.toString().trim() === '') {
    continue; // ✅ Bỏ qua đơn không có mã referral
  }
  
  orders.push({
    orderId: row[cols.orderId],
    referralCode: refCode.toString().trim()
  });
  
  if (orders.length >= limit) break;
}
```

**Kết quả:** Chỉ lấy đơn có mã CTV → Hiển thị đúng đơn qua cộng tác viên.

## 📊 Ví Dụ Thực Tế

### Sheet Có 20 Đơn Hàng
```
Dòng 20: ORD020 | 10/11/2024 | PARTNER005 ✅
Dòng 19: ORD019 | 10/11/2024 |            ❌ Bỏ qua
Dòng 18: ORD018 | 10/11/2024 | SHOP123    ✅
Dòng 17: ORD017 | 09/11/2024 |            ❌ Bỏ qua
Dòng 16: ORD016 | 09/11/2024 | PARTNER001 ✅
Dòng 15: ORD015 | 09/11/2024 |            ❌ Bỏ qua
Dòng 14: ORD014 | 09/11/2024 | PARTNER002 ✅
...
```

### Kết Quả Hiển Thị (10 Đơn CÓ MÃ REFERRAL)
```
1. ORD020 - PARTNER005
2. ORD018 - SHOP123
3. ORD016 - PARTNER001
4. ORD014 - PARTNER002
5. ORD012 - PARTNER003
6. ORD010 - SHOP456
7. ORD008 - PARTNER001
8. ORD006 - PARTNER004
9. ORD004 - SHOP789
10. ORD002 - PARTNER005
```

**Lưu ý:** Các đơn ORD019, ORD017, ORD015... không có mã referral nên bị bỏ qua.

## 🧪 Cách Test

### 1. Test Trong Apps Script
```javascript
function testGetRecentOrders() {
  const orders = getRecentOrders(10);
  
  Logger.log('Số đơn tìm thấy: ' + orders.length);
  
  // Kiểm tra tất cả đều có mã referral
  orders.forEach(order => {
    Logger.log(order.orderId + ' - ' + order.referralCode);
  });
}
```

### 2. Test Qua API
```
https://script.google.com/.../exec?action=getRecentOrders&limit=10
```

Kiểm tra response:
- Tất cả đơn đều có `referralCode` không rỗng
- Không có đơn nào có `referralCode: ""`

## ✅ Checklist

- [x] Chỉ lấy đơn có mã referral (cột J không rỗng)
- [x] Lấy 10 đơn mới nhất (từ cuối sheet lên)
- [x] Bỏ qua đơn không có Order ID
- [x] Bỏ qua đơn không có mã referral
- [x] Trim whitespace từ mã referral
- [x] Dừng khi đủ 10 đơn

## 🎯 Kết Luận

Logic mới đảm bảo:
- ✅ Chỉ hiển thị đơn qua CTV
- ✅ Không hiển thị đơn trực tiếp
- ✅ Lấy đúng 10 đơn mới nhất có mã referral
- ✅ Trang không bị trống nếu có đơn CTV
- ✅ Trang ẩn section nếu không có đơn CTV nào
