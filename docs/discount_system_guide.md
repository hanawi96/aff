# Hệ Thống Mã Giảm Giá - Hướng Dẫn Sử Dụng

## 🎯 Tính Năng Chính

### 1. Các Loại Mã Giảm Giá

- **fixed**: Giảm giá cố định (VD: giảm 10.000đ)
- **percentage**: Giảm theo % (VD: giảm 10%, tối đa 50.000đ)
- **gift**: Tặng quà (VD: tặng bó dâu 7 cành)
- **freeship**: Miễn phí vận chuyển

### 2. Kiểm Soát Linh Hoạt

#### Giới hạn sử dụng:
- `max_total_uses`: Tổng số lần dùng (VD: chỉ 100 người đầu tiên)
- `max_uses_per_customer`: Mỗi khách dùng tối đa bao nhiêu lần

#### Điều kiện áp dụng:
- `min_order_amount`: Giá trị đơn hàng tối thiểu
- `min_items`: Số lượng sản phẩm tối thiểu
- `customer_type`: Loại khách hàng (all/new/existing/vip)
- `allowed_customer_phones`: Chỉ cho số điện thoại cụ thể

#### Áp dụng cho sản phẩm:
- `applicable_products`: Chỉ áp dụng cho sản phẩm cụ thể
- `applicable_categories`: Chỉ áp dụng cho danh mục cụ thể
- `excluded_products`: Loại trừ sản phẩm

#### Kết hợp mã:
- `combinable_with_other_discounts`: Cho phép dùng cùng mã khác
- `priority`: Thứ tự ưu tiên khi có nhiều mã

### 3. Tự Động Áp Dụng

Bảng `discount_auto_rules` cho phép tự động áp dụng mã khi:
- Giỏ hàng đạt giá trị nhất định
- Mua số lượng sản phẩm nhất định
- Đơn hàng đầu tiên
- Sinh nhật khách hàng
- Ngày đặc biệt (Tết, 8/3, 20/10...)

## 📊 Ví Dụ Sử Dụng

### Ví dụ 1: Mã giảm giá cố định
```sql
INSERT INTO discounts (
  code, title, description, type, discount_value,
  min_order_amount, max_uses_per_customer,
  active, visible, expiry_date
) VALUES (
  'GIAM50K', 'Giảm 50.000đ', 'Giảm 50K cho đơn từ 500K',
  'fixed', 50000,
  500000, 1,
  1, 1, '2025-12-31'
);
```

### Ví dụ 2: Mã giảm % có giới hạn
```sql
INSERT INTO discounts (
  code, title, description, type, discount_value, max_discount_amount,
  min_order_amount, max_total_uses, max_uses_per_customer,
  active, visible, expiry_date
) VALUES (
  'GIAM10PT', 'Giảm 10%', 'Giảm 10% tối đa 100K',
  'percentage', 10, 100000,
  200000, 1000, 1,
  1, 1, '2025-12-31'
);
```

### Ví dụ 3: Mã tặng quà
```sql
INSERT INTO discounts (
  code, title, description, type,
  gift_product_id, gift_product_name, gift_quantity,
  min_order_amount, min_items,
  active, visible, expiry_date
) VALUES (
  'QUATANG', 'Tặng Bó Dâu', 'Tặng bó dâu 7 cành khi mua từ 2 SP',
  'gift',
  'addon_bo_dau_tam_7_canh', 'Bó dâu 7 cành (bé trai)', 1,
  300000, 2,
  1, 1, '2025-12-31'
);
```

### Ví dụ 4: Mã VIP chỉ cho khách hàng cụ thể
```sql
INSERT INTO discounts (
  code, title, description, type, discount_value,
  customer_type, allowed_customer_phones,
  max_uses_per_customer,
  active, visible, expiry_date
) VALUES (
  'VIP100K', 'Mã VIP giảm 100K', 'Dành riêng cho khách VIP',
  'fixed', 100000,
  'vip', '["0901234567", "0912345678"]',
  3,
  1, 0, '2025-12-31'
);
```

### Ví dụ 5: Mã chỉ áp dụng cho sản phẩm cụ thể
```sql
INSERT INTO discounts (
  code, title, description, type, discount_value,
  applicable_products,
  active, visible, expiry_date
) VALUES (
  'DAUONLY', 'Giảm 20K cho Dâu', 'Chỉ áp dụng cho sản phẩm dâu tằm',
  'fixed', 20000,
  '["product_dau_tam_1", "product_dau_tam_2"]',
  1, 1, '2025-12-31'
);
```

## 🔍 Query Thông Dụng

### Kiểm tra mã có hợp lệ không
```sql
SELECT * FROM discounts
WHERE code = 'GIAM50K'
  AND active = 1
  AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
  AND expiry_date >= CURRENT_TIMESTAMP
  AND (max_total_uses IS NULL OR usage_count < max_total_uses);
```

### Kiểm tra khách hàng đã dùng mã chưa
```sql
SELECT COUNT(*) as usage_count
FROM discount_usage
WHERE discount_code = 'GIAM50K'
  AND customer_phone = '0901234567';
```

### Lấy top mã được dùng nhiều nhất
```sql
SELECT code, title, usage_count, total_discount_amount
FROM discounts
WHERE active = 1
ORDER BY usage_count DESC
LIMIT 10;
```

### Thống kê mã giảm giá theo tháng
```sql
SELECT 
  strftime('%Y-%m', used_at) as month,
  COUNT(*) as total_uses,
  SUM(discount_amount) as total_discount
FROM discount_usage
GROUP BY month
ORDER BY month DESC;
```

## 🚀 Migration Steps

1. Tạo bảng:
```bash
wrangler d1 execute vdt --file=database/discounts_schema.sql
```

2. Generate migration từ JSON:
```bash
node database/migrate_discounts.js
```

3. Import dữ liệu:
```bash
wrangler d1 execute vdt --file=database/migrate_discounts.sql
```

## 📝 API Endpoints Cần Thêm

### GET /api/discounts
- Lấy danh sách mã giảm giá (public)
- Filter: active, visible, type

### POST /api/discount/validate
- Validate mã giảm giá
- Input: code, customer_phone, cart_items, cart_total
- Output: valid, discount_amount, message

### POST /api/discount/apply
- Áp dụng mã vào đơn hàng
- Tự động tạo record trong discount_usage

### GET /api/discount/stats
- Thống kê mã giảm giá (admin)

### POST /api/discount/create
- Tạo mã mới (admin)

### PUT /api/discount/update
- Cập nhật mã (admin)

### DELETE /api/discount/delete
- Xóa mã (admin)
