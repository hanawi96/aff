# Categories Table Documentation

## Cấu trúc bảng

### Table: `categories`

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | INTEGER | ID tự động tăng | PRIMARY KEY, AUTOINCREMENT |
| `name` | TEXT | Tên danh mục | NOT NULL, UNIQUE |
| `description` | TEXT | Mô tả danh mục | NULL |
| `icon` | TEXT | Icon emoji | NULL |
| `color` | TEXT | Màu sắc (hex code) | NULL |
| `display_order` | INTEGER | Thứ tự hiển thị | DEFAULT 0 |
| `is_active` | INTEGER | Trạng thái (1=active, 0=inactive) | DEFAULT 1 |
| `created_at` | TEXT | Thời gian tạo | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TEXT | Thời gian cập nhật | DEFAULT CURRENT_TIMESTAMP |

## Indexes

- `idx_categories_name` - Index trên cột `name`
- `idx_categories_is_active` - Index trên cột `is_active`
- `idx_categories_display_order` - Index trên cột `display_order`

## Danh mục mặc định

| ID | Name | Icon | Color | Description |
|----|------|------|-------|-------------|
| 1 | Hạt | 🌰 | #f59e0b | Các loại hạt tẩm |
| 2 | Vòng | ⭕ | #ef4444 | Vòng trang trí các loại |
| 3 | Mix | 🎁 | #8b5cf6 | Combo trộn mix |
| 4 | Túi | 👜 | #06b6d4 | Túi đựng các loại |
| 5 | Móc | 🔑 | #10b981 | Móc khóa, móc treo |
| 6 | Bó | 💐 | #ec4899 | Bó hoa, bó trang trí |
| 7 | Khác | 📦 | #6b7280 | Sản phẩm khác |

## Kết nối với Products

### Cấu trúc mới của Products table:

- Thêm cột `category_id` (INTEGER) - Foreign key đến `categories.id`
- Giữ lại cột `category` (TEXT) cũ để tương thích ngược
- Khi query products, JOIN với categories để lấy thông tin đầy đủ

### Query example:

```sql
SELECT 
    p.*,
    c.name as category_name,
    c.icon as category_icon,
    c.color as category_color
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = 1
```

## API Endpoints

### 1. Get All Categories
```
GET /api?action=getAllCategories
Response: { success: true, categories: [...] }
```

### 2. Get Category by ID
```
GET /api?action=getCategory&id=1
Response: { success: true, category: {...} }
```

### 3. Create Category
```
POST /api?action=createCategory
Body: { name, description, icon, color, display_order }
Response: { success: true, categoryId: 1 }
```

### 4. Update Category
```
POST /api?action=updateCategory
Body: { id, name, description, icon, color, display_order }
Response: { success: true }
```

### 5. Delete Category
```
POST /api?action=deleteCategory
Body: { id }
Response: { success: true }
Note: Không thể xóa danh mục đang có sản phẩm
```

## Lợi ích

1. **Quản lý tập trung**: Danh mục được quản lý ở 1 nơi
2. **Nhất quán**: Tên danh mục không bị sai lệch
3. **Dễ thay đổi**: Đổi tên danh mục → tất cả sản phẩm tự động cập nhật
4. **Thêm metadata**: Icon, màu sắc, thứ tự hiển thị
5. **Báo cáo tốt hơn**: Thống kê theo danh mục chính xác

## Migration

Dữ liệu cũ đã được migrate tự động:
- Sản phẩm có `category` text → map sang `category_id`
- Sản phẩm không có category → gán vào "Khác"
- Cột `category` text vẫn giữ lại để tương thích
