# 🔄 CẬP NHẬT: EXTENSION ĐỒNG BỘ 100% VỚI DESKTOP

## ✅ **ĐÃ BỔ SUNG ĐẦY ĐỦ:**

| Tính năng | Desktop | Extension (Cũ) | Extension (Mới) | API Field |
|-----------|---------|----------------|-----------------|-----------|
| **Đơn ưu tiên** | ✅ | ❌ | ✅ | `is_priority` |
| **Gửi sau** | ✅ | ❌ | ✅ | `planned_send_at_unix`, `status: 'send_later'` |
| **Tiền cọc** | ✅ | ❌ | ✅ | `deposit_amount` |
| **Nguồn khách** | ✅ | ❌ | ✅ | `customer_source` (facebook/zalo/tiktok) |
| **Mã CTV** | ✅ | ❌ | ✅ | `referralCode` |
| **Mã giảm giá** | ✅ | ❌ | ✅ | `discount_code`, `discount_amount` |
| **Chi phí ship** | ✅ | ❌ | ✅ | `shippingCost` |
| **Xác nhận trùng** | ✅ | ❌ | ✅ | `acknowledgeDuplicate` |
| Tên khách | ✅ | ✅ | ✅ | `customer.name` |
| Số điện thoại | ✅ | ✅ | ✅ | `customer.phone` |
| Địa chỉ | ✅ | ✅ | ✅ | `customer.address` |
| Sản phẩm | ✅ | ✅ | ✅ | `cart[]` |
| Phí ship (khách trả) | ✅ | ✅ | ✅ | `shippingFee` |
| Phương thức TT | ✅ | ✅ | ✅ | `paymentMethod` |
| Ghi chú | ✅ | ✅ | ✅ | `notes` |

---

## 🎯 **CHI TIẾT CÁC TRƯỜNG MỚI:**

### 1. ⭐ **Đơn ưu tiên** (`is_priority`)
```html
<input type="checkbox" id="is-priority">
⭐ Đánh dấu đơn ưu tiên
```
- Checkbox tick = đơn ưu tiên
- Đơn ưu tiên sẽ hiện đầu danh sách

---

### 2. 🕐 **Gửi sau** (`status: 'send_later'`, `planned_send_at_unix`)
```html
<input type="checkbox" id="send-later">
🕐 Gửi sau (chọn ngày giờ)

<input type="datetime-local" id="planned-send-time">
```
- Tick checkbox → Hiện trường chọn ngày giờ
- Mặc định: Ngày mai 9h sáng
- API nhận `status: 'send_later'` + timestamp

---

### 3. 💰 **Tiền cọc** (`deposit_amount`)
```html
<label>Tiền cọc trước (nếu có)</label>
<input type="number" id="deposit-amount">
```
- Validate: Tiền cọc ≤ Tổng tiền
- API tính COD collect = Total - Deposit

---

### 4. 📱 **Nguồn khách** (`customer_source`)
```html
<select id="customer-source">
  <option value="facebook">Facebook</option>
  <option value="zalo">Zalo</option>
  <option value="tiktok">TikTok</option>
</select>
```
- Giúp phân tích nguồn khách hiệu quả
- Hiển thị badge màu trên desktop

---

### 5. 🤝 **Mã CTV** (`referralCode`)
```html
<label>Mã CTV (nếu có)</label>
<input type="text" id="referral-code">
```
- Tự động tính commission cho CTV
- API lookup commission_rate từ database

---

### 6. 🎟️ **Mã giảm giá** (`discount_code`, `discount_amount`)
```html
<label>Mã giảm giá</label>
<input type="text" id="discount-code">

<label>Số tiền giảm (đ)</label>
<input type="number" id="discount-amount">
```
- Nhập code hoặc nhập số tiền trực tiếp
- Tổng tiền tự động trừ discount
- API ghi vào `discount_usage` table

---

### 7. 🚚 **Chi phí ship** (`shippingCost`)
```html
<label>Chi phí ship (cost)</label>
<input type="number" id="shipping-cost">
```
- `shippingFee` = khách trả
- `shippingCost` = chi phí thực tế
- Profit = shippingFee - shippingCost

---

### 8. ⚠️ **Xác nhận đơn trùng** (`acknowledgeDuplicate`)
```javascript
acknowledgeDuplicate: true
```
- Extension tự động set = `true`
- Bỏ qua check trùng vì parse từ chat (thủ công)

---

## 📊 **TÍNH TỔNG TIỀN (CẬP NHẬT):**

```javascript
Tổng tiền = (Sản phẩm) + (Phí ship) - (Giảm giá)
         = productsTotal + shippingFee - discountAmount

Tiền COD thu = Tổng tiền - Tiền cọc
```

**Validate:**
- Tiền cọc ≤ Tổng tiền
- Tổng tiền ≥ 0 (sau khi trừ discount)

---

## 🎨 **GIAO DIỆN MỚI:**

### Form có thêm 3 sections:

#### 1. 💰 **Thanh toán** (Đã mở rộng)
- Phí ship (khách trả)
- **Chi phí ship (cost)** ← MỚI
- Phương thức TT
- **Tiền cọc** ← MỚI
- Tổng cộng (tự động)

#### 2. 📋 **Thông tin thêm** ← SECTION MỚI
- **Nguồn khách** (dropdown)
- **Mã CTV**
- **Mã giảm giá** + Số tiền giảm
- **☑️ Đơn ưu tiên** (checkbox)
- **☑️ Gửi sau** (checkbox)
  - → Datetime picker (ẩn mặc định)

---

## 🔄 **FLOW TẠO ĐỚN CẬP NHẬT:**

### **Kịch bản 1: Đơn thường (COD)**
```
1. Parse thông tin khách → Điền form
2. Thêm sản phẩm
3. Chọn nguồn: Facebook
4. Phí ship: 30,000đ
5. → Tạo đơn
   status: 'pending'
   is_priority: 0
```

### **Kịch bản 2: Đơn ưu tiên + Gửi sau**
```
1. Parse thông tin
2. Thêm sản phẩm
3. Tick ⭐ Đơn ưu tiên
4. Tick 🕐 Gửi sau → Chọn ngày mai 9h
5. → Tạo đơn
   status: 'send_later'
   is_priority: 1
   planned_send_at_unix: 1720234800000
```

### **Kịch bản 3: Đơn có giảm giá + CTV**
```
1. Parse thông tin
2. Thêm sản phẩm (200,000đ)
3. Phí ship: 30,000đ
4. Mã CTV: CTV001
5. Giảm giá: GIAM20 → 20,000đ
6. Tổng = 200k + 30k - 20k = 210,000đ
7. → Tạo đơn (có commission cho CTV)
```

### **Kịch bản 4: Đơn cọc trước**
```
1. Parse thông tin
2. Thêm sản phẩm (500,000đ)
3. Phí ship: 30,000đ
4. Tiền cọc: 100,000đ
5. Tổng: 530,000đ
6. COD thu: 430,000đ (530k - 100k)
7. → Tạo đơn
   deposit_amount: 100000
```

---

## 🎯 **API REQUEST MẪU:**

```json
{
  "orderId": "DH1720234567890",
  "orderDate": 1720234567890,
  "customer": {
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "address": "123 Đường ABC, Quận 1, TP.HCM"
  },
  "cart": [
    {
      "id": 1,
      "product_id": null,
      "name": "Bình sữa Comotomo 250ml",
      "price": 200000,
      "cost_price": 0,
      "quantity": 2,
      "image_url": ""
    }
  ],
  "totalAmount": 410000,
  "paymentMethod": "cod",
  "status": "send_later",
  "shippingFee": 30000,
  "shippingCost": 20000,
  "depositAmount": 100000,
  "customerSource": "facebook",
  "referralCode": "CTV001",
  "discountCode": "GIAM20",
  "discountAmount": 20000,
  "isPriority": 1,
  "is_priority": 1,
  "plannedSendAtUnix": 1720320000000,
  "planned_send_at_unix": 1720320000000,
  "acknowledgeDuplicate": true,
  "notes": "Giao giờ hành chính"
}
```

---

## ✅ **VALIDATION:**

Extension tự động validate:

1. ✅ Tên, SĐT, địa chỉ không trống
2. ✅ Có ít nhất 1 sản phẩm
3. ✅ Sản phẩm có tên + giá hợp lệ
4. ✅ Tiền cọc ≤ Tổng tiền
5. ✅ Nếu "Gửi sau" → Phải chọn ngày giờ
6. ✅ Tổng tiền ≥ 0

---

## 🚀 **CẬP NHẬT & TEST:**

### Bước 1: Reload extension
```
1. Vào chrome://extensions/
2. Click nút "Reload" (icon tròn) trên ShopVD Order Helper
3. Refresh trang pancake.vn (Ctrl+R)
```

### Bước 2: Kiểm tra form mới
```
✅ Có thêm section "Thông tin thêm"
✅ Có dropdown "Nguồn khách"
✅ Có checkbox "Đơn ưu tiên"
✅ Có checkbox "Gửi sau"
```

### Bước 3: Test từng tính năng
```
1. Đơn thường → OK
2. Đơn ưu tiên → Tick checkbox → OK
3. Gửi sau → Tick → Hiện datetime picker → OK
4. Mã giảm giá → Nhập → Tổng tiền tự động trừ → OK
5. Tiền cọc → Nhập 100k → Validate OK
```

---

## 📈 **SO SÁNH TRƯỚC/SAU:**

| Chỉ số | Trước | Sau |
|--------|-------|-----|
| Số trường form | 7 | 15 |
| Tính năng | 50% | 100% |
| Đồng bộ Desktop | ❌ | ✅ |
| Validation | Cơ bản | Đầy đủ |
| Tổng tiền | Đơn giản | Chính xác |

---

## 🎉 **KẾT LUẬN:**

Extension **BÂY GIỜ ĐỒNG BỘ 100%** với hệ thống desktop!

### ✅ Đã bổ sung:
- ⭐ Đơn ưu tiên
- 🕐 Gửi sau (+ datetime picker)
- 💰 Tiền cọc trước
- 📱 Nguồn khách (Facebook/Zalo/TikTok)
- 🤝 Mã CTV (commission)
- 🎟️ Mã giảm giá
- 🚚 Chi phí ship thực tế
- ⚠️ Xác nhận đơn trùng

### ✅ Validation hoàn chỉnh
### ✅ Tính tổng tiền chính xác
### ✅ API payload đầy đủ
### ✅ UI responsive, dễ dùng

---

**Giờ extension có thể thay thế hoàn toàn việc mở tab desktop để tạo đơn!** 🚀

---

_Cập nhật lúc: 6/7/2026 15:10_
