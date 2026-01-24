# 📍 TÍNH NĂNG CHỌN ĐỊA CHỈ (ADDRESS SELECTOR)

## 📋 TỔNG QUAN

### **Mục đích:**
Thay thế textarea địa chỉ bằng 4 dropdown cascading để chọn địa chỉ chính xác theo cấu trúc Việt Nam

### **Cấu trúc:**
1. **Tỉnh/Thành phố** → 2. **Quận/Huyện** → 3. **Phường/Xã** → 4. **Số nhà, tên đường**

---

## 🎯 THIẾT KẾ

### **Layout:**
```
┌─────────────────────────────────────────────┐
│ Địa chỉ giao hàng *                         │
├─────────────────────────────────────────────┤
│ [Tỉnh/TP ▼]        [Quận/Huyện ▼]          │
│ [Phường/Xã ▼]                               │
│ [Số nhà, tên đường ___________________]    │
├─────────────────────────────────────────────┤
│ Địa chỉ đầy đủ:                            │
│ 123 Nguyễn Trãi, Phường Thanh Xuân Trung,  │
│ Quận Thanh Xuân, Thành phố Hà Nội          │
└─────────────────────────────────────────────┘
```

### **Đặc điểm:**
- ✅ Cascading dropdowns (chọn tỉnh → mở quận → mở phường → mở ô nhập)
- ✅ Hiển thị địa chỉ đầy đủ real-time
- ✅ Validation đầy đủ
- ✅ Responsive mobile (1 cột)
- ✅ Dữ liệu từ `tree.json`

---

## 🔧 IMPLEMENTATION

### **Files Created:**

#### **1. address.service.js**
```javascript
// Service quản lý dữ liệu địa chỉ
- loadAddressData()      // Load tree.json
- getProvinces()         // Lấy danh sách tỉnh
- getDistricts(code)     // Lấy quận theo tỉnh
- getWards(pCode, dCode) // Lấy phường theo quận
- getFullAddress(...)    // Tạo địa chỉ đầy đủ
```

#### **2. address-selector.js**
```javascript
// Component address selector
- init()                 // Khởi tạo
- render()               // Render HTML
- setupEventListeners()  // Setup events
- updateDistricts()      // Cập nhật quận
- updateWards()          // Cập nhật phường
- updateFullAddress()    // Cập nhật địa chỉ đầy đủ
- getAddressData()       // Lấy dữ liệu
- validate()             // Validate
- reset()                // Reset form
```

#### **3. quick-checkout.js (Updated)**
```javascript
// Tích hợp address selector
- this.addressSelector = new AddressSelector()
- await this.addressSelector.init()
- addressData = this.addressSelector.getAddressData()
- validation = this.addressSelector.validate()
```

---

## 💾 DATA STRUCTURE

### **tree.json Format:**
```json
{
  "01": {
    "name": "Hà Nội",
    "name_with_type": "Thành phố Hà Nội",
    "code": "01",
    "quan-huyen": {
      "001": {
        "name": "Ba Đình",
        "name_with_type": "Quận Ba Đình",
        "code": "001",
        "xa-phuong": {
          "00001": {
            "name": "Phúc Xá",
            "name_with_type": "Phường Phúc Xá",
            "code": "00001"
          }
        }
      }
    }
  }
}
```

### **Address Data Output:**
```javascript
{
  provinceCode: "01",
  districtCode: "001",
  wardCode: "00001",
  street: "123 Nguyễn Trãi",
  fullAddress: "123 Nguyễn Trãi, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội"
}
```

---

## 📊 ORDER DATA STRUCTURE

### **Order Object:**
```javascript
{
  product: {...},
  quantity: 1,
  crossSellProducts: [...],
  customer: {
    phone: "0912345678",
    name: "Nguyễn Văn A",
    note: "Giao giờ hành chính"
  },
  address: {
    provinceCode: "01",
    districtCode: "001",
    wardCode: "00001",
    street: "123 Nguyễn Trãi",
    fullAddress: "123 Nguyễn Trãi, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội"
  },
  subtotal: 100000,
  crossSellTotal: 35000,
  shippingFee: 0,
  total: 135000,
  isFlashSale: false,
  hasFreeShipping: true
}
```

---

## 🗄️ DATABASE SCHEMA

### **orders Table:**
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  province_code TEXT NOT NULL,
  district_code TEXT NOT NULL,
  ward_code TEXT NOT NULL,
  street TEXT NOT NULL,
  full_address TEXT NOT NULL,
  note TEXT,
  subtotal INTEGER NOT NULL,
  shipping_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  has_free_shipping INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
```

### **order_items Table:**
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  is_cross_sell INTEGER DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

---

## 🔄 WORKFLOW

### **User Flow:**
```
1. Click "Mua ngay"
   ↓
2. Modal mở, address selector khởi tạo
   ↓
3. Chọn Tỉnh/Thành phố
   ↓ (load quận)
4. Chọn Quận/Huyện
   ↓ (load phường)
5. Chọn Phường/Xã
   ↓ (enable ô nhập)
6. Nhập số nhà, tên đường
   ↓ (update địa chỉ đầy đủ)
7. Điền thông tin khác
   ↓
8. Click "Đặt hàng ngay"
   ↓ (validate)
9. Submit order với đầy đủ thông tin
```

### **Cascading Logic:**
```javascript
// Province selected
provinceCode = "01"
→ Load districts for province "01"
→ Enable district dropdown
→ Disable ward dropdown
→ Disable street input

// District selected
districtCode = "001"
→ Load wards for district "001"
→ Enable ward dropdown
→ Disable street input

// Ward selected
wardCode = "00001"
→ Enable street input
→ Focus street input
→ Update full address

// Street entered
street = "123 Nguyễn Trãi"
→ Update full address display
```

---

## ✅ VALIDATION

### **Validation Rules:**
```javascript
1. Province: Required
   → "Vui lòng chọn Tỉnh/Thành phố"

2. District: Required
   → "Vui lòng chọn Quận/Huyện"

3. Ward: Required
   → "Vui lòng chọn Phường/Xã"

4. Street: Required
   → "Vui lòng nhập số nhà, tên đường"
```

### **Validation Timing:**
- On submit: Validate all fields
- On change: Update full address
- Real-time: Show full address preview

---

## 🎨 STYLING

### **Grid Layout:**
```css
.address-selector-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* Street input spans full width */
.address-selector-item:nth-child(4) {
  grid-column: 1 / -1;
}
```

### **Address Display:**
```css
.address-display {
  background: #f9f9f9;
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
```

### **Responsive:**
```css
@media (max-width: 768px) {
  .address-selector-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 🧪 TESTING

### **Test Cases:**

#### **1. Load Address Data**
```
1. Open quick checkout modal
2. Address selector initializes
3. Province dropdown populated
✅ PASS if provinces load
```

#### **2. Cascading Selection**
```
1. Select province
2. District dropdown enables and populates
3. Select district
4. Ward dropdown enables and populates
5. Select ward
6. Street input enables
✅ PASS if cascading works
```

#### **3. Full Address Display**
```
1. Select province → Address updates
2. Select district → Address updates
3. Select ward → Address updates
4. Enter street → Address updates
✅ PASS if real-time update works
```

#### **4. Validation**
```
1. Leave all empty, submit
2. Error: "Vui lòng chọn Tỉnh/Thành phố"
3. Select province, submit
4. Error: "Vui lòng chọn Quận/Huyện"
5. Select district, submit
6. Error: "Vui lòng chọn Phường/Xã"
7. Select ward, submit
8. Error: "Vui lòng nhập số nhà, tên đường"
9. Enter street, submit
10. Order submits successfully
✅ PASS if validation works
```

#### **5. Reset**
```
1. Fill all address fields
2. Close modal
3. Open modal again
4. All fields reset
✅ PASS if reset works
```

#### **6. Mobile Responsive**
```
1. Resize to mobile
2. Grid becomes 1 column
3. All dropdowns readable
4. Touch interaction works
✅ PASS if mobile works
```

---

## 📈 BENEFITS

### **For Customers:**
- ✅ Dễ chọn địa chỉ (không cần nhớ mã)
- ✅ Không sai chính tả
- ✅ Địa chỉ chuẩn hóa
- ✅ Xem trước địa chỉ đầy đủ

### **For Business:**
- ✅ Dữ liệu địa chỉ chuẩn
- ✅ Dễ tính phí ship theo vùng
- ✅ Dễ phân tích theo khu vực
- ✅ Giảm lỗi giao hàng

---

## 🔮 FUTURE ENHANCEMENTS

### **Phase 2:**
- [ ] Tính phí ship theo khu vực
- [ ] Gợi ý địa chỉ đã dùng
- [ ] Lưu nhiều địa chỉ
- [ ] Đánh dấu địa chỉ mặc định

### **Phase 3:**
- [ ] Tích hợp Google Maps
- [ ] Autocomplete địa chỉ
- [ ] Xác thực địa chỉ
- [ ] Tối ưu phí ship

---

## 📝 API INTEGRATION

### **Submit Order Endpoint:**
```javascript
POST /api/orders

Body:
{
  customer: {
    name: "Nguyễn Văn A",
    phone: "0912345678",
    note: "..."
  },
  address: {
    provinceCode: "01",
    districtCode: "001",
    wardCode: "00001",
    street: "123 Nguyễn Trãi",
    fullAddress: "..."
  },
  items: [
    {
      productId: 1,
      quantity: 1,
      price: 100000,
      isCrossSell: false
    },
    {
      productId: 133,
      quantity: 1,
      price: 15000,
      isCrossSell: true
    }
  ],
  subtotal: 115000,
  shippingFee: 0,
  total: 115000,
  hasFreeShipping: true
}
```

---

**Feature Status:** ✅ COMPLETE
**Ready for Testing:** ✅ YES
**Database Integration:** ⏳ PENDING

---

**Created:** 2025-01-24
**Version:** 1.0
