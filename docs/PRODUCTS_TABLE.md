# Products Table Documentation

## Cấu trúc bảng

### Table: `products`

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | INTEGER | ID tự động tăng | PRIMARY KEY, AUTOINCREMENT |
| `name` | TEXT | Tên sản phẩm | NOT NULL |
| `price` | REAL | Giá sản phẩm (VNĐ) | NOT NULL, DEFAULT 0 |
| `weight` | TEXT | Cân nặng (VD: 500g, 1kg) | NULL |
| `size` | TEXT | Size/Tay (VD: Size M, Tay 3) | NULL |
| `sku` | TEXT | Mã SKU duy nhất | UNIQUE, NULL |
| `description` | TEXT | Mô tả sản phẩm | NULL |
| `image_url` | TEXT | URL ảnh sản phẩm | NULL |
| `category_id` | INTEGER | ID danh mục (FK to categories) | NULL |
| `is_active` | INTEGER | Trạng thái (1=active, 0=inactive) | DEFAULT 1 |
| `created_at` | TEXT | Thời gian tạo | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TEXT | Thời gian cập nhật | DEFAULT CURRENT_TIMESTAMP |

## Indexes

- `idx_products_name` - Index trên cột `name` (tìm kiếm nhanh)
- `idx_products_sku` - Index trên cột `sku` (tìm kiếm theo mã)
- `idx_products_is_active` - Index trên cột `is_active` (filter active)
- `idx_products_category_id` - Index trên cột `category_id` (filter theo danh mục)

## Dữ liệu mẫu

Bảng đã được tạo với 7 sản phẩm mẫu:

1. Hạt dẻ tẩm loại đẹp + chi đỏ - 50.000đ
2. Vòng trơn cỡ điện dây đỏ - 79.000đ
3. Trộn mix bị bạc 3ly combo - 69.000đ
4. Túi Dâu Tằm Để Giường - 39.000đ
5. Móc chia khóa dầu tầm - 29.000đ
6. Bó dâu 7 CÀNH (bé trai) - 35.000đ
7. Bó dâu 9 CÀNH (bé gái) - 35.000đ

## API Endpoints (Sẽ implement)

### 1. Get All Products
```
GET /api?action=getAllProducts
Response: { success: true, products: [...] }
```

### 2. Get Product by ID
```
GET /api?action=getProduct&id=1
Response: { success: true, product: {...} }
```

### 3. Search Products
```
GET /api?action=searchProducts&q=hạt
Response: { success: true, products: [...] }
```

### 4. Create Product
```
POST /api?action=createProduct
Body: { name, price, weight, size, category, description }
Response: { success: true, productId: 1 }
```

### 5. Update Product
```
POST /api?action=updateProduct
Body: { id, name, price, weight, size, category, description }
Response: { success: true }
```

### 6. Delete Product
```
POST /api?action=deleteProduct
Body: { id }
Response: { success: true }
```

## Tích hợp với Orders

### Cấu trúc sản phẩm trong đơn hàng (mới)

```json
{
  "products": [
    {
      "product_id": 1,           // Link đến bảng products
      "name": "Hạt dẻ...",       // Snapshot tên
      "price": 50000,            // Snapshot giá tại thời điểm đặt
      "quantity": 14,
      "weight": "500g",          // Snapshot weight
      "size": null
    },
    {
      "product_id": null,        // Sản phẩm tùy chỉnh (không có trong catalog)
      "name": "Combo đặc biệt",
      "price": 100000,
      "quantity": 1
    }
  ]
}
```

### Lợi ích

1. **Tự động tính giá**: Khi thêm sản phẩm từ catalog → tự động lấy giá
2. **Snapshot**: Lưu giá tại thời điểm đặt → không ảnh hưởng khi đổi giá sau
3. **Linh hoạt**: Vẫn cho phép sản phẩm tùy chỉnh (product_id = null)
4. **Báo cáo**: Dễ dàng thống kê sản phẩm bán chạy

## Migration dữ liệu cũ

Sẽ tạo tool để:
1. Phân tích tên sản phẩm trong đơn hàng cũ
2. Gợi ý match với products trong catalog
3. Cho phép map thủ công
4. Cập nhật product_id vào đơn hàng

## Next Steps

- [ ] Tạo API endpoints trong worker.js
- [ ] Tạo UI quản lý sản phẩm
- [ ] Tích hợp autocomplete vào form thêm sản phẩm
- [ ] Tạo migration tool cho đơn hàng cũ
