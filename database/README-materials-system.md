# Product Materials System

Hệ thống quản lý nguyên liệu và tính giá vốn tự động cho sản phẩm.

## 📋 Tổng quan

Thay vì lưu giá vốn cố định cho từng sản phẩm, hệ thống này:
- Lưu **công thức** (nguyên liệu + số lượng) cho mỗi sản phẩm
- Lưu **giá nguyên liệu** tập trung trong bảng `cost_config`
- **Tự động tính** giá vốn = SUM(số lượng × giá nguyên liệu)
- **Tự động cập nhật** tất cả sản phẩm khi giá nguyên liệu thay đổi

## 🗄️ Cấu trúc Database

### Bảng `cost_config` (Nguyên liệu)
```sql
id              INTEGER PRIMARY KEY
item_name       TEXT UNIQUE          -- Tên nguyên liệu (bi_bac_s999, ho_phach_vang...)
item_cost       REAL                 -- Giá nguyên liệu (15000, 50000...)
is_default      INTEGER              -- Nguyên liệu mặc định
created_at      DATETIME
updated_at      DATETIME
```

### Bảng `product_materials` (Công thức sản phẩm)
```sql
id              INTEGER PRIMARY KEY
product_id      INTEGER              -- ID sản phẩm
material_name   TEXT                 -- Tên nguyên liệu (khớp với cost_config.item_name)
quantity        REAL                 -- Số lượng (7, 0.5, 2...)
unit            TEXT                 -- Đơn vị (viên, mét, cái...)
notes           TEXT                 -- Ghi chú
created_at_unix INTEGER
updated_at_unix INTEGER
```

## 🚀 Cách sử dụng

### 1. Chạy Migration (Lần đầu tiên)

```bash
# Tạo bảng và triggers
node database/run-migration-048.js
```

### 2. Seed dữ liệu mẫu (Tùy chọn)

```bash
# Thêm công thức mẫu cho một số sản phẩm
node database/seed-sample-materials.js
```

### 3. Thêm công thức cho sản phẩm

```javascript
// Ví dụ: Vòng 7 bi bạc + charm rồng
const productId = 123;

// Thêm nguyên liệu
await client.execute({
    sql: 'INSERT INTO product_materials (product_id, material_name, quantity, unit) VALUES (?, ?, ?, ?)',
    args: [productId, 'bi_bac_s999', 7, 'viên']
});

await client.execute({
    sql: 'INSERT INTO product_materials (product_id, material_name, quantity, unit) VALUES (?, ?, ?, ?)',
    args: [productId, 'charm_rong', 1, 'cái']
});

await client.execute({
    sql: 'INSERT INTO product_materials (product_id, material_name, quantity, unit) VALUES (?, ?, ?, ?)',
    args: [productId, 'day_tron', 0.5, 'mét']
});

// Giá vốn tự động tính = (7 × 15000) + (1 × 25000) + (0.5 × 5000) = 132.500đ
```

### 4. Cập nhật giá nguyên liệu

```javascript
// Khi bi bạc tăng giá từ 15k → 18k
await client.execute({
    sql: 'UPDATE cost_config SET item_cost = ? WHERE item_name = ?',
    args: [18000, 'bi_bac_s999']
});

// Trigger tự động cập nhật tất cả sản phẩm có bi bạc
// Sản phẩm trên sẽ tự động thành: (7 × 18000) + (1 × 25000) + (0.5 × 5000) = 153.500đ
```

### 5. Cập nhật thủ công tất cả sản phẩm

```bash
# Nếu cần force update tất cả
node database/update-all-product-costs.js
```

## 📊 Queries hữu ích

### Xem công thức của 1 sản phẩm
```sql
SELECT 
  p.name AS product_name,
  pm.material_name,
  pm.quantity,
  pm.unit,
  cc.item_cost AS unit_price,
  (pm.quantity * cc.item_cost) AS subtotal
FROM products p
JOIN product_materials pm ON p.id = pm.product_id
JOIN cost_config cc ON pm.material_name = cc.item_name
WHERE p.id = 123;
```

### Xem tất cả sản phẩm dùng 1 nguyên liệu
```sql
SELECT 
  p.id,
  p.name,
  pm.quantity,
  pm.unit,
  p.cost_price
FROM products p
JOIN product_materials pm ON p.id = pm.product_id
WHERE pm.material_name = 'bi_bac_s999'
ORDER BY pm.quantity DESC;
```

### Tính tổng nguyên liệu cần cho tất cả sản phẩm
```sql
SELECT 
  pm.material_name,
  SUM(pm.quantity) as total_quantity,
  pm.unit,
  cc.item_cost,
  SUM(pm.quantity * cc.item_cost) as total_cost
FROM product_materials pm
JOIN cost_config cc ON pm.material_name = cc.item_name
GROUP BY pm.material_name
ORDER BY total_cost DESC;
```

### Sản phẩm nào chưa có công thức
```sql
SELECT 
  p.id,
  p.name,
  p.cost_price
FROM products p
LEFT JOIN product_materials pm ON p.id = pm.product_id
WHERE p.is_active = 1 AND pm.id IS NULL;
```

## 🔧 Triggers tự động

Hệ thống có 4 triggers tự động:

1. **update_product_cost_after_material_insert**: Khi thêm nguyên liệu vào sản phẩm
2. **update_product_cost_after_material_update**: Khi sửa số lượng nguyên liệu
3. **update_product_cost_after_material_delete**: Khi xóa nguyên liệu khỏi sản phẩm
4. **update_all_products_cost_after_material_price_change**: Khi thay đổi giá nguyên liệu

## 💡 Ví dụ thực tế

### Sản phẩm mix nhiều nguyên liệu
```
Vòng mix 5 bi bạc + 2 hổ phách + charm rồng + dây ngũ sắc

Công thức:
- bi_bac_s999: 5 viên × 18.000đ = 90.000đ
- ho_phach_vang: 2 viên × 50.000đ = 100.000đ
- charm_rong: 1 cái × 25.000đ = 25.000đ
- day_ngu_sac: 0.5 mét × 8.000đ = 4.000đ
─────────────────────────────────────────────
Tổng giá vốn: 219.000đ
```

### Khi nguyên liệu tăng giá
```
Bi bạc tăng: 18.000đ → 20.000đ (+2.000đ)
Hổ phách tăng: 50.000đ → 55.000đ (+5.000đ)

Sản phẩm trên tự động cập nhật:
- bi_bac_s999: 5 viên × 20.000đ = 100.000đ (+10.000đ)
- ho_phach_vang: 2 viên × 55.000đ = 110.000đ (+10.000đ)
- charm_rong: 1 cái × 25.000đ = 25.000đ
- day_ngu_sac: 0.5 mét × 8.000đ = 4.000đ
─────────────────────────────────────────────
Tổng giá vốn: 239.000đ (+20.000đ)
```

## 🎯 Lợi ích

✅ **Tiết kiệm thời gian**: Chỉ cần update giá nguyên liệu 1 lần thay vì sửa 200 sản phẩm

✅ **Chính xác**: Không bỏ sót sản phẩm nào khi tăng giá

✅ **Minh bạch**: Biết rõ sản phẩm làm từ nguyên liệu gì, số lượng bao nhiêu

✅ **Linh hoạt**: Dễ dàng thêm/bớt nguyên liệu trong công thức

✅ **Tự động**: Trigger tự động tính toán, không cần can thiệp thủ công

## 📝 Danh sách nguyên liệu mặc định

```
bi_bac_s999       - Bi bạc S999 (15.000đ/viên)
ho_phach_vang     - Hổ phách vàng (50.000đ/viên)
ho_phach_nau      - Hổ phách nâu (45.000đ/viên)
da_do             - Đá đỏ (30.000đ/viên)
da_xanh           - Đá xanh (28.000đ/viên)
day_tron          - Dây trơn (5.000đ/mét)
day_ngu_sac       - Dây ngũ sắc (8.000đ/mét)
day_vang          - Dây vàng (6.000đ/mét)
charm_ran         - Charm rắn (12.000đ/cái)
charm_rong        - Charm rồng (25.000đ/cái)
charm_hoa_sen     - Charm hoa sen (15.000đ/cái)
charm_co_4_la     - Charm cỏ 4 lá (10.000đ/cái)
chuong            - Chuông (3.000đ/cái)
the_ten_tron      - Thẻ tên tròn (8.000đ/cái)
the_hinh_ran      - Thẻ hình rắn (10.000đ/cái)
thanh_gia         - Thanh giá (12.000đ/cái)
```

## 🔗 Next Steps

1. Tạo UI admin để quản lý nguyên liệu
2. Tạo UI để thêm công thức vào sản phẩm
3. Tạo báo cáo phân tích nguyên liệu
4. Tích hợp với hệ thống đơn hàng để tracking nguyên liệu

---

**Tạo bởi:** Migration 048
**Ngày:** 2026-01-20
