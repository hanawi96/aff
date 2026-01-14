# 📊 Báo cáo Import Database sang Turso

**Ngày thực hiện:** 14/01/2026  
**Database:** vdt-yendev96  
**Region:** AWS ap-northeast-1 (Tokyo - gần Việt Nam)

## ✅ Kết quả Import

### Tổng quan
- **Tổng số bảng:** 12 bảng
- **Import thành công:** 11 bảng
- **Lỗi:** 1 bảng (customers - không tồn tại trong D1)
- **Tổng số records:** 421 rows
- **Indexes:** 70 indexes
- **Triggers:** 18 triggers

### Chi tiết từng bảng

| Bảng | Số rows | Status | Ghi chú |
|------|---------|--------|---------|
| **ctv** | 67 | ✅ | CTV/Collaborators |
| **orders** | 11 | ✅ | Đơn hàng |
| **order_items** | 11 | ✅ | Chi tiết sản phẩm trong đơn |
| **products** | 130 | ✅ | Sản phẩm |
| **categories** | 17 | ✅ | Danh mục |
| **product_categories** | 132 | ✅ | Liên kết sản phẩm-danh mục |
| **cost_config** | 10 | ✅ | Cấu hình chi phí |
| **discounts** | 17 | ✅ | Mã giảm giá |
| **discount_usage** | 6 | ✅ | Lịch sử sử dụng mã |
| **users** | 1 | ✅ | Tài khoản admin |
| **sessions** | 19 | ✅ | Phiên đăng nhập |
| **customers** | 0 | ⚠️ | Bảng không tồn tại trong D1 |

### Bảng phụ (tự động tạo)
- **commission_payments** - Thanh toán hoa hồng
- **commission_payment_details** - Chi tiết thanh toán
- **discount_auto_rules** - Quy tắc tự động áp dụng mã

## 🔧 Indexes đã import (70 indexes)

### CTV Indexes
- idx_ctv_referral_code
- idx_ctv_phone
- idx_ctv_created_at_unix

### Orders Indexes
- idx_orders_referral_code
- idx_orders_order_date
- idx_orders_status
- idx_orders_created_at
- idx_orders_total_amount
- idx_orders_province_id
- idx_orders_district_id
- idx_orders_ward_id
- idx_orders_discount_code
- idx_orders_commission_rate

### Products Indexes
- idx_products_name
- idx_products_sku
- idx_products_is_active
- idx_products_category_id
- idx_products_purchases
- idx_products_active_purchases

### Order Items Indexes
- idx_order_items_order_id
- idx_order_items_product_id
- idx_order_items_created_at
- idx_order_items_product_name
- idx_order_items_order_product

### Discounts Indexes
- idx_discounts_code
- idx_discounts_active
- idx_discounts_dates
- idx_discounts_type
- idx_discount_usage_discount
- idx_discount_usage_order
- idx_discount_usage_customer

## ⚡ Triggers đã import (18 triggers)

### Timestamp Triggers
- update_ctv_timestamp
- update_cost_config_timestamp
- update_discounts_timestamp

### Product Purchases Triggers
- increment_purchases_on_order_item_insert
- decrement_purchases_on_order_item_delete
- update_purchases_on_order_item_update

### Order Total Amount Triggers
- trg_order_items_insert_update_total
- trg_order_items_update_update_total
- trg_order_items_delete_update_total
- trg_orders_shipping_fee_update_total
- trg_orders_discount_update_total

### Discount Usage Triggers
- increment_discount_usage
- decrement_discount_usage

### Product Categories Triggers
- ensure_single_primary_category
- ensure_single_primary_category_update
- sync_primary_category_to_products
- sync_primary_category_update
- handle_primary_category_delete

## 📁 Files đã tạo

### Backup Files
- `d1_remote_export.sql` (107.81 KB) - Export từ D1 production
- `backups/d1_production_20260114_124843.sql` - Backup an toàn

### Scripts
- `scripts/import-to-turso.js` - Script import chính
- `scripts/fix-triggers.js` - Fix và tạo lại triggers
- `scripts/fix-order-items.js` - Import order_items
- `scripts/verify-migration.js` - Verify sau import
- `scripts/check-schema.js` - Kiểm tra schema

### Configuration
- `.env` - Chứa TURSO_DATABASE_URL và TURSO_AUTH_TOKEN

## 🔍 Sample Data

### CTV (3 records đầu)
```
ID: 1, Name: Văn Yên, Phone: 0901234567, Code: CTV865123, Rate: 21%
ID: 2, Name: Test, Phone: 0901234567, Code: CTV481406, Rate: 15%
ID: 3, Name: yên, Phone: 0386190596, Code: CTV230201, Rate: 18%
```

### Orders (3 records đầu)
```
ID: 146, Order: DH1763726958831, Customer: Nguyễn Văn A, Total: 379,000đ
ID: 147, Order: DH1763738668149, Customer: Nguyễn Văn A, Total: 379,000đ
ID: 148, Order: DH1763739210479, Customer: Nguyễn Văn A, Total: 379,000đ
```

### Products (3 records đầu)
```
ID: 8, Name: Vòng trơn buộc mối, Price: 79,000đ, Cost: 21,000đ
ID: 9, Name: Trơn mix 1 bi bạc, Price: 69,000đ, Cost: 27,500đ
ID: 10, Name: Trơn mix 2 bi bạc, Price: 79,000đ, Cost: 34,000đ
```

## 🎯 Thông tin kết nối Turso

```
Database URL: libsql://vdt-yendev96.aws-ap-northeast-1.turso.io
Region: AWS Tokyo (ap-northeast-1)
Auth Token: Đã lưu trong .env và Wrangler secrets
```

## ✅ Các bước đã hoàn thành

1. ✅ Export database từ D1 (remote)
2. ✅ Tạo database trên Turso
3. ✅ Import schema và data
4. ✅ Fix và tạo lại 18 triggers
5. ✅ Import order_items (11 records)
6. ✅ Verify toàn bộ database
7. ✅ Kiểm tra indexes (70 indexes)
8. ✅ Kiểm tra triggers (18 triggers)

## 📝 Lưu ý

### Bảng customers
Bảng `customers` không tồn tại trong D1 export. Nếu cần, có thể tạo bảng này sau:

```sql
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
```

### Timestamps
- Tất cả timestamps đã được chuyển sang UTC
- Sử dụng cả `created_at` (DATETIME) và `created_at_unix` (INTEGER milliseconds)
- Frontend cần convert sang timezone Việt Nam (UTC+7)

### Foreign Keys
Tất cả foreign key constraints đã được giữ nguyên:
- order_items.order_id → orders.id (CASCADE DELETE)
- order_items.product_id → products.id (SET NULL)
- orders.referral_code → ctv.referral_code
- discount_usage.discount_id → discounts.id (CASCADE)

## 🚀 Bước tiếp theo

### 1. Cập nhật Worker code
```javascript
import { initTurso } from './database/turso-client.js';

export default {
  async fetch(request, env, ctx) {
    const DB = initTurso(env);
    env.DB = DB;
    // ... rest of code
  }
}
```

### 2. Cập nhật wrangler.toml
```toml
[vars]
TURSO_DATABASE_URL = "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io"
```

### 3. Thêm auth token vào secrets
```bash
npx wrangler secret put TURSO_AUTH_TOKEN
```

### 4. Test local
```bash
npm run dev
```

### 5. Deploy production
```bash
npx wrangler deploy
```

## 🎨 Tối ưu hóa (Optional)

### Tạo replica gần Việt Nam hơn
```bash
# Singapore (gần VN nhất)
turso db replicas create vdt-yendev96 sin

# Hoặc Hong Kong
turso db replicas create vdt-yendev96 hkg
```

### Tạo staging database
```bash
turso db create vdt-staging --from-db vdt-yendev96
```

## 📊 So sánh D1 vs Turso

| Tính năng | D1 | Turso |
|-----------|----|----|
| Truy cập | Chỉ từ Workers | ✅ Từ mọi nơi |
| Replicas | ❌ | ✅ Multi-region |
| Backup | Thủ công | ✅ Tự động |
| Point-in-time recovery | ❌ | ✅ |
| Database branching | ❌ | ✅ |
| CLI | Cơ bản | ✅ Mạnh mẽ |

## ✨ Kết luận

Migration thành công! Database đã được import đầy đủ vào Turso với:
- ✅ 421 records
- ✅ 70 indexes
- ✅ 18 triggers
- ✅ Tất cả foreign keys
- ✅ Tất cả constraints

Database sẵn sàng để sử dụng!

---

**Người thực hiện:** Kiro AI  
**Thời gian:** ~15 phút  
**Status:** ✅ Hoàn thành
