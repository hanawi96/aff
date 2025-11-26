# Kiểm tra và cập nhật hình ảnh sản phẩm

## Vấn đề
Hình ảnh sản phẩm không hiển thị trong modal đơn hàng mặc dù đã có cột `image_url` trong database.

## Nguyên nhân có thể
1. Dữ liệu trong cột `image_url` đang NULL hoặc rỗng
2. URL ảnh không hợp lệ hoặc bị lỗi 404
3. API không trả về đúng dữ liệu

## Giải pháp đã thực hiện

### 1. Cải thiện Layout
- Tăng kích thước ảnh từ 56x56px lên 64x64px cho dễ nhìn
- Thay đổi từ `truncate` sang `line-clamp-2` để hiển thị đầy đủ tên sản phẩm
- Tách riêng phần ảnh và thông tin sản phẩm

### 2. Cải thiện Fallback Logic
```javascript
const imageUrl = p.image_url && p.image_url.trim() !== '' 
    ? p.image_url 
    : 'https://via.placeholder.com/80x80?text=No+Image';
```

### 3. Thêm Debug Logging
```javascript
console.log('📸 Sample product with image_url:', bestSellingProducts[0]);
console.log('📸 First product image_url:', product.image_url, '-> Using:', imageUrl);
```

## Kiểm tra Database

### Kiểm tra cột image_url có tồn tại không
```sql
PRAGMA table_info(products);
```

### Kiểm tra dữ liệu image_url
```sql
-- Xem các sản phẩm có image_url
SELECT id, name, image_url, purchases 
FROM products 
WHERE image_url IS NOT NULL AND image_url != ''
ORDER BY purchases DESC
LIMIT 10;

-- Đếm số sản phẩm có/không có ảnh
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) as with_image,
    SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as without_image
FROM products
WHERE is_active = 1;
```

### Cập nhật image_url mẫu (nếu cần)
```sql
-- Cập nhật ảnh mẫu cho các sản phẩm bán chạy nhất
UPDATE products 
SET image_url = 'https://via.placeholder.com/300x300?text=' || REPLACE(name, ' ', '+')
WHERE (image_url IS NULL OR image_url = '')
AND purchases > 0
AND is_active = 1;
```

### Cập nhật từ nguồn thực tế
Nếu bạn có ảnh thực tế, cập nhật theo format:
```sql
UPDATE products SET image_url = 'https://your-cdn.com/images/product-1.jpg' WHERE id = 1;
UPDATE products SET image_url = 'https://your-cdn.com/images/product-2.jpg' WHERE id = 2;
-- ...
```

## Kiểm tra API Response

### Mở Console trong Browser
1. Mở DevTools (F12)
2. Vào tab Console
3. Mở modal thêm đơn hàng
4. Xem log:
   - `📸 Sample product with image_url:` - Xem object sản phẩm đầu tiên
   - `📸 First product image_url:` - Xem URL ảnh được sử dụng

### Kiểm tra Network Tab
1. Mở DevTools (F12)
2. Vào tab Network
3. Filter: `getAllProducts`
4. Xem Response:
   ```json
   {
     "success": true,
     "products": [
       {
         "id": 1,
         "name": "Sản phẩm A",
         "image_url": "https://...",
         ...
       }
     ]
   }
   ```

## Cấu trúc URL ảnh đề xuất

### Cloudflare Images (Recommended)
```
https://imagedelivery.net/[account-hash]/[image-id]/public
```

### Cloudflare R2 Storage
```
https://[bucket-name].[account-id].r2.cloudflarestorage.com/products/[image-name].jpg
```

### External CDN
```
https://cdn.example.com/products/[image-name].jpg
```

## Testing Checklist

- [ ] Kiểm tra cột `image_url` tồn tại trong database
- [ ] Kiểm tra dữ liệu có giá trị trong `image_url`
- [ ] Kiểm tra API trả về `image_url` trong response
- [ ] Kiểm tra URL ảnh có thể truy cập được (không 404)
- [ ] Kiểm tra ảnh hiển thị trong phần "Sản phẩm bán chạy"
- [ ] Kiểm tra ảnh hiển thị trong "Danh sách sản phẩm trong đơn"
- [ ] Kiểm tra fallback placeholder khi không có ảnh
- [ ] Kiểm tra responsive trên mobile

## Lưu ý

### CORS Issues
Nếu ảnh từ domain khác, đảm bảo server cho phép CORS:
```
Access-Control-Allow-Origin: *
```

### Image Optimization
- Kích thước đề xuất: 300x300px hoặc 400x400px
- Format: WebP (fallback to JPG/PNG)
- Compression: 80-85% quality
- Lazy loading: Tự động bởi browser

### Performance
- Sử dụng CDN để tăng tốc độ load
- Cache ảnh ở browser
- Sử dụng responsive images nếu cần

## Cập nhật ngày
25/11/2025
