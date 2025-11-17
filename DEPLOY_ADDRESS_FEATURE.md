# 🚀 Hướng Dẫn Deploy Tính Năng Địa Chỉ 4 Cấp

## ✅ Checklist Triển Khai

### Bước 1: Chạy Migration Database

```bash
# Local development
wrangler d1 execute DB --local --file=database/migrations/020_add_structured_address.sql

# Production
wrangler d1 execute DB --file=database/migrations/020_add_structured_address.sql
```

**Kết quả mong đợi:**
```
✅ Đã thêm 7 cột mới vào bảng orders
✅ Đã tạo 3 index mới
```

### Bước 2: Verify Migration

```bash
# Kiểm tra schema
wrangler d1 execute DB --command="PRAGMA table_info(orders);"
```

**Kiểm tra các cột mới:**
- province_id
- province_name
- district_id
- district_name
- ward_id
- ward_name
- street_address

### Bước 3: Deploy Code

```bash
# Deploy lên Cloudflare Workers
wrangler deploy
```

**Files đã thay đổi:**
- ✅ `database/migrations/020_add_structured_address.sql` (NEW)
- ✅ `public/assets/js/address-selector.js` (NEW)
- ✅ `public/admin/orders.html` (UPDATED - thêm modal)
- ✅ `public/assets/js/orders.js` (UPDATED - thêm functions)
- ✅ `worker.js` (UPDATED - hỗ trợ 7 cột mới)
- ✅ `docs/ADDRESS_FEATURE.md` (NEW)

### Bước 4: Test Chức Năng

#### 4.1. Test Modal Thêm Đơn Hàng

1. Mở `https://your-domain.com/admin/orders.html`
2. Click nút "Thêm đơn hàng"
3. Kiểm tra:
   - ✅ Modal hiển thị
   - ✅ Dropdown Tỉnh/Thành có dữ liệu
   - ✅ Chọn Tỉnh → Quận enable
   - ✅ Chọn Quận → Phường enable
   - ✅ Preview địa chỉ cập nhật real-time

#### 4.2. Test Tạo Đơn Hàng

1. Điền đầy đủ thông tin:
   - Tên: "Test User"
   - SĐT: "0901234567"
   - Tỉnh: "Hà Nội"
   - Quận: "Ba Đình"
   - Phường: "Phúc Xá"
   - Địa chỉ: "123 Test Street"
   - Sản phẩm: "Test Product" - SL: 1 - Giá: 100000
2. Click "Tạo đơn hàng"
3. Kiểm tra:
   - ✅ Đơn hàng được tạo thành công
   - ✅ Modal đóng
   - ✅ Danh sách đơn hàng reload

#### 4.3. Verify Database

```bash
# Kiểm tra đơn hàng vừa tạo
wrangler d1 execute DB --command="
  SELECT 
    order_id, customer_name, 
    province_name, district_name, ward_name, street_address,
    address
  FROM orders 
  ORDER BY id DESC 
  LIMIT 1;
"
```

**Kết quả mong đợi:**
```
order_id: DH1234567890
customer_name: Test User
province_name: Thành phố Hà Nội
district_name: Quận Ba Đình
ward_name: Phường Phúc Xá
street_address: 123 Test Street
address: 123 Test Street, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội
```

### Bước 5: Test API (Optional)

```bash
# Test API tạo đơn hàng
curl -X POST https://your-domain.com/api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "createOrder",
    "customer_name": "API Test",
    "customer_phone": "0901111111",
    "province_id": "01",
    "province_name": "Thành phố Hà Nội",
    "district_id": "001",
    "district_name": "Quận Ba Đình",
    "ward_id": "00001",
    "ward_name": "Phường Phúc Xá",
    "street_address": "456 API Street",
    "address": "456 API Street, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội",
    "products": "[{\"name\":\"Test\",\"quantity\":1,\"price\":100000}]",
    "total_amount": 100000
  }'
```

## 🔍 Troubleshooting

### Lỗi: "Column not found"

**Nguyên nhân:** Migration chưa chạy

**Giải pháp:**
```bash
wrangler d1 execute DB --file=database/migrations/020_add_structured_address.sql
```

### Lỗi: "addressSelector is not defined"

**Nguyên nhân:** File `address-selector.js` chưa load

**Giải pháp:** Kiểm tra thứ tự script trong `orders.html`:
```html
<script src="../assets/js/address-selector.js"></script>
<script src="../assets/js/orders.js"></script>
```

### Dropdown không có dữ liệu

**Nguyên nhân:** File `vietnamAddress.json` không load được

**Giải pháp:**
1. Kiểm tra file tồn tại: `public/assets/data/vietnamAddress.json`
2. Kiểm tra console log: `F12 → Console`
3. Test fetch:
```javascript
fetch('/assets/data/vietnamAddress.json')
  .then(r => r.json())
  .then(data => console.log('Loaded:', data.length, 'provinces'));
```

### Modal không hiển thị

**Nguyên nhân:** Function `showAddOrderModal()` chưa được định nghĩa

**Giải pháp:** Kiểm tra file `orders.js` đã có function này chưa

## 📊 Monitoring

### Metrics cần theo dõi:

1. **Tỷ lệ đơn hàng có địa chỉ đầy đủ:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(province_id) as with_address,
  ROUND(COUNT(province_id) * 100.0 / COUNT(*), 2) as percentage
FROM orders;
```

2. **Top 10 tỉnh/thành có nhiều đơn nhất:**
```sql
SELECT 
  province_name,
  COUNT(*) as total_orders,
  SUM(total_amount) as total_revenue
FROM orders
WHERE province_id IS NOT NULL
GROUP BY province_name
ORDER BY total_orders DESC
LIMIT 10;
```

## 🎯 Next Steps

### Phase 2: Thống Kê Địa Lý (Coming Soon)

1. Tạo trang thống kê mới: `public/admin/location-stats.html`
2. Thêm API endpoints:
   - `getCustomersByProvince`
   - `getCustomersByDistrict`
   - `getCustomersByWard`
3. Tạo biểu đồ với Chart.js
4. Export báo cáo Excel

### Phase 3: Tích Hợp Shipping API

1. Tự động tính phí ship theo địa lý
2. Tạo đơn vận chuyển tự động
3. Tracking đơn hàng

## 📝 Rollback Plan

Nếu có vấn đề, rollback bằng cách:

### 1. Rollback Code
```bash
git revert HEAD
wrangler deploy
```

### 2. Rollback Database (Không khuyến khích)
```sql
-- Xóa 7 cột mới (CHỈ nếu thực sự cần thiết)
ALTER TABLE orders DROP COLUMN province_id;
ALTER TABLE orders DROP COLUMN province_name;
ALTER TABLE orders DROP COLUMN district_id;
ALTER TABLE orders DROP COLUMN district_name;
ALTER TABLE orders DROP COLUMN ward_id;
ALTER TABLE orders DROP COLUMN ward_name;
ALTER TABLE orders DROP COLUMN street_address;

-- Xóa index
DROP INDEX IF EXISTS idx_orders_province_id;
DROP INDEX IF EXISTS idx_orders_district_id;
DROP INDEX IF EXISTS idx_orders_ward_id;
```

**Lưu ý:** Rollback database sẽ mất dữ liệu địa chỉ đã nhập!

## ✅ Checklist Hoàn Thành

- [ ] Migration database chạy thành công
- [ ] Verify schema có 7 cột mới
- [ ] Deploy code lên production
- [ ] Test modal "Thêm đơn hàng"
- [ ] Test cascade dropdown
- [ ] Test tạo đơn hàng mới
- [ ] Verify data trong database
- [ ] Test API (optional)
- [ ] Monitor metrics
- [ ] Update documentation

---

**Thời gian ước tính:** 15-30 phút  
**Downtime:** 0 (zero downtime deployment)  
**Risk level:** Thấp (backward compatible)
