# 🔧 Fix Reorder Error - Database Schema Missing

## Vấn đề
Khi di chuyển vị trí sản phẩm nổi bật, gặp lỗi:
```
SQL_PARSE_ERROR: SQL string could not be parsed: near ID, "Some("undefined")": syntax error
```

## Nguyên nhân
Database thiếu các cột cần thiết cho featured products:
- `is_featured` - Đánh dấu sản phẩm nổi bật
- `featured_order` - Thứ tự hiển thị
- `featured_at_unix` - Thời gian thêm vào featured

## Giải pháp

### Bước 1: Thêm cột vào database
Chạy SQL sau trong database của bạn:

```sql
-- Add is_featured column (0 = not featured, 1 = featured)
ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0;

-- Add featured_order column (thứ tự hiển thị)
ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT NULL;

-- Add featured_at_unix column (thời gian thêm vào featured)
ALTER TABLE products ADD COLUMN featured_at_unix INTEGER DEFAULT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, featured_order);
```

### Bước 2: Kiểm tra cột đã được thêm
```sql
PRAGMA table_info(products);
```

Bạn sẽ thấy các cột mới:
- `is_featured` (INTEGER, DEFAULT 0)
- `featured_order` (INTEGER, DEFAULT NULL)  
- `featured_at_unix` (INTEGER, DEFAULT NULL)

### Bước 3: Test chức năng
1. Refresh trang admin
2. Vào "Sản phẩm Nổi bật"
3. Thêm một vài sản phẩm vào featured
4. Test di chuyển lên/xuống

## Cách chạy SQL

### Nếu dùng SQLite Browser:
1. Mở file `local.db` bằng DB Browser for SQLite
2. Vào tab "Execute SQL"
3. Paste SQL ở trên và chạy

### Nếu dùng command line:
```bash
sqlite3 local.db < database/add-featured-columns.sql
```

### Nếu dùng Turso:
```bash
turso db shell your-database-name < database/add-featured-columns.sql
```

## Kiểm tra sau khi fix

### 1. Kiểm tra cấu trúc bảng
```sql
SELECT sql FROM sqlite_master WHERE name = 'products';
```

### 2. Test thêm sản phẩm featured
```sql
UPDATE products SET is_featured = 1, featured_order = 1 WHERE id = 1;
SELECT id, name, is_featured, featured_order FROM products WHERE is_featured = 1;
```

### 3. Test API reorder
Mở browser console và chạy:
```javascript
// Test data
const testData = {
    product_orders: [
        { product_id: 1, display_order: 1 },
        { product_id: 2, display_order: 2 }
    ]
};

// Test API
fetch('http://127.0.0.1:8787/?action=reorderFeaturedProducts', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('session_token')}`
    },
    body: JSON.stringify(testData)
}).then(r => r.json()).then(console.log);
```

## Kết quả mong đợi
- ✅ Không còn lỗi SQL parsing
- ✅ Có thể thêm/xóa sản phẩm featured
- ✅ Có thể di chuyển lên/xuống
- ✅ Thứ tự được lưu và hiển thị đúng

## Lưu ý
- Backup database trước khi chạy migration
- Kiểm tra kỹ SQL trước khi execute
- Test trên môi trường dev trước khi deploy production

## Files liên quan
- `database/add-featured-columns.sql` - Migration SQL
- `src/services/featured/featured-service.js` - Backend logic
- `public/assets/js/featured-admin.js` - Frontend logic
- `public/admin/featured-products.html` - Admin UI