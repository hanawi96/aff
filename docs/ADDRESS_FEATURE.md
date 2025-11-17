# 📍 Tính Năng Địa Chỉ 4 Cấp & Thống Kê Địa Lý

## 🎯 Tổng Quan

Hệ thống đã được nâng cấp với tính năng quản lý địa chỉ 4 cấp (Tỉnh/Thành → Quận/Huyện → Phường/Xã → Địa chỉ nhà) để:
- ✅ Tích hợp với API vận chuyển (yêu cầu 4 trường riêng biệt)
- ✅ Thống kê khách hàng theo địa lý
- ✅ Chuẩn hóa dữ liệu địa chỉ

## 📊 Cấu Trúc Database

### Bảng `orders` - 7 cột địa chỉ mới:

```sql
province_id      TEXT  -- Mã tỉnh (VD: "01" = Hà Nội)
province_name    TEXT  -- Tên tỉnh (VD: "Thành phố Hà Nội")
district_id      TEXT  -- Mã quận (VD: "001" = Ba Đình)
district_name    TEXT  -- Tên quận (VD: "Quận Ba Đình")
ward_id          TEXT  -- Mã phường (VD: "00001" = Phúc Xá)
ward_name        TEXT  -- Tên phường (VD: "Phường Phúc Xá")
street_address   TEXT  -- Địa chỉ nhà (VD: "123 Nguyễn Trãi")
address          TEXT  -- Địa chỉ đầy đủ (auto-generated)
```

### Index (Tối ưu query):
```sql
idx_orders_province_id
idx_orders_district_id
idx_orders_ward_id
```

## 🚀 Cách Sử Dụng

### 1. Chạy Migration

```bash
# Chạy migration để thêm 7 cột mới
wrangler d1 execute DB --file=database/migrations/020_add_structured_address.sql
```

### 2. Tạo Đơn Hàng Mới

**Trang:** `public/admin/orders.html`

**Bước:**
1. Click nút "Thêm đơn hàng"
2. Nhập thông tin khách hàng
3. Chọn địa chỉ theo thứ tự:
   - Tỉnh/Thành phố (dropdown)
   - Quận/Huyện (cascade từ Tỉnh)
   - Phường/Xã (cascade từ Quận)
   - Địa chỉ nhà (nhập tự do)
4. Preview địa chỉ đầy đủ sẽ hiển thị real-time
5. Thêm sản phẩm và submit

### 3. Dữ Liệu Địa Chỉ

**File:** `public/assets/data/vietnamAddress.json`

**Cấu trúc:**
```json
[
  {
    "Id": "01",
    "Name": "Thành phố Hà Nội",
    "Districts": [
      {
        "Id": "001",
        "Name": "Quận Ba Đình",
        "Wards": [
          {
            "Id": "00001",
            "Name": "Phường Phúc Xá",
            "Level": "Phường"
          }
        ]
      }
    ]
  }
]
```

## 💻 API

### Tạo Đơn Hàng

**Endpoint:** `POST /api`

**Body:**
```json
{
  "action": "createOrder",
  "customer_name": "Nguyễn Văn A",
  "customer_phone": "0901234567",
  "province_id": "01",
  "province_name": "Thành phố Hà Nội",
  "district_id": "001",
  "district_name": "Quận Ba Đình",
  "ward_id": "00001",
  "ward_name": "Phường Phúc Xá",
  "street_address": "123 Nguyễn Trãi",
  "address": "123 Nguyễn Trãi, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội",
  "products": "[...]",
  "total_amount": 500000
}
```

### Thống Kê Theo Tỉnh

**Endpoint:** `GET /api?action=getCustomersByProvince`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "province_id": "01",
      "province_name": "Thành phố Hà Nội",
      "total_customers": 45,
      "total_orders": 123,
      "total_revenue": 125000000
    }
  ]
}
```

### Thống Kê Theo Quận

**Endpoint:** `GET /api?action=getCustomersByDistrict&province_id=01`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "province_id": "01",
      "province_name": "Thành phố Hà Nội",
      "district_id": "001",
      "district_name": "Quận Ba Đình",
      "total_customers": 15,
      "total_orders": 35,
      "total_revenue": 38000000
    }
  ]
}
```

## 🔧 JavaScript Module

### AddressSelector Class

**File:** `public/assets/js/address-selector.js`

**Sử dụng:**
```javascript
// Init
await window.addressSelector.init();

// Render provinces
window.addressSelector.renderProvinces(provinceSelect);

// Setup cascade
window.addressSelector.setupCascade(
  provinceSelect,
  districtSelect,
  wardSelect,
  onChangeCallback
);

// Get names from IDs
const provinceName = window.addressSelector.getProvinceName('01');
const districtName = window.addressSelector.getDistrictName('01', '001');
const wardName = window.addressSelector.getWardName('01', '001', '00001');

// Generate full address
const fullAddress = window.addressSelector.generateFullAddress(
  '123 Nguyễn Trãi',
  '01',
  '001',
  '00001'
);
// => "123 Nguyễn Trãi, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội"
```

## 📈 Thống Kê Địa Lý (Coming Soon)

### Trang Thống Kê

**Trang:** `public/admin/customers.html`

**Tính năng:**
- 📊 Biểu đồ Top 10 Tỉnh/Thành
- 📊 Biểu đồ Top 10 Quận/Huyện
- 📊 Bảng chi tiết: Tỉnh → Quận → Phường
- 🔍 Filter theo địa lý
- 📥 Export báo cáo theo vùng

### Metrics

- Số khách hàng theo tỉnh/quận/phường
- Doanh thu theo địa lý
- AOV (Average Order Value) theo vùng
- Tỷ lệ khách hàng mới/cũ theo địa lý

## 🎨 UI/UX

### Cascade Dropdown

- **Tỉnh** → Enable Quận
- **Quận** → Enable Phường
- **Phường** → Enable Submit

### Preview Real-time

Địa chỉ đầy đủ được hiển thị ngay khi user chọn:
```
123 Nguyễn Trãi, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội
```

### Validation

- ✅ Tất cả 4 trường bắt buộc
- ✅ Không cho submit nếu thiếu thông tin
- ✅ Disable dropdown khi chưa chọn cấp trên

## ⚡ Performance

### Tối ưu hóa:

1. **Map Lookup O(1)**
   - Không dùng Array.find() → Dùng Map.get()
   - Index data 1 lần khi load

2. **Lazy Loading**
   - Chỉ load vietnamAddress.json khi cần
   - Cache data sau lần load đầu

3. **Database Index**
   - Index trên province_id, district_id, ward_id
   - Query nhanh cho thống kê

4. **Lưu cả ID và Name**
   - Không cần join với JSON mỗi lần query
   - Trade-off: Tốn ~100 bytes/đơn

## 🔄 Backward Compatibility

### Đơn hàng cũ:

- Cột `address` cũ vẫn giữ nguyên
- 7 cột mới sẽ NULL cho đơn cũ
- Không ảnh hưởng đến logic hiện tại

### Migration data cũ (Optional):

Có thể parse địa chỉ cũ để fill vào cột mới:
```javascript
// Script migration (chạy 1 lần)
async function migrateOldAddresses() {
  const oldOrders = await db.query(`
    SELECT id, address 
    FROM orders 
    WHERE province_id IS NULL AND address IS NOT NULL
  `);
  
  for (const order of oldOrders) {
    const parsed = parseAddress(order.address);
    if (parsed) {
      await db.update(order.id, parsed);
    }
  }
}
```

## 🚢 Tích Hợp Shipping API

### Export cho đơn vị vận chuyển:

```javascript
const shippingData = {
  receiver_name: order.customer_name,
  receiver_phone: order.customer_phone,
  province: order.province_name,
  district: order.district_name,
  ward: order.ward_name,
  address: order.street_address
};
```

## 📝 Notes

- File `vietnamAddress.json` có 63 tỉnh/thành, ~700 quận/huyện, ~11,000 phường/xã
- Dung lượng file: ~1.5MB (nén gzip: ~150KB)
- Load time: <100ms trên 4G

## 🐛 Troubleshooting

### Dropdown không hiển thị:
```javascript
// Check if addressSelector loaded
console.log(window.addressSelector.loaded);

// Re-init
await window.addressSelector.init();
```

### Địa chỉ không đầy đủ:
```javascript
// Check IDs
console.log({
  province: document.getElementById('province').value,
  district: document.getElementById('district').value,
  ward: document.getElementById('ward').value
});
```

---

**Tạo bởi:** Kiro AI Assistant  
**Ngày:** 2024-11-17  
**Version:** 1.0.0
