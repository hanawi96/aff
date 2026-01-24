# Hướng dẫn Badges Sản phẩm

## Tổng quan
Đã thêm 2 badges đặc biệt cho các sản phẩm vòng đầu tằm:
- 🟡 **Thủ công 100%** (màu cam/vàng)
- 🟢 **Không hóa chất** (màu xanh lá)

## Cấu trúc Database

### Cột mới trong bảng `products`:
- `is_handmade` (INTEGER): 1 = có badge "Thủ công 100%", 0 = không có
- `is_chemical_free` (INTEGER): 1 = có badge "Không hóa chất", 0 = không có

## Hiển thị trên Frontend

### Vị trí badges:
- Badge giảm giá (-X%): góc trên bên trái (top: 10px, left: 10px)
- Badge "Thủ công 100%": góc trên bên trái (top: 10px, left: 10px)
- Badge "Không hóa chất": bên dưới badge "Thủ công 100%" (top: 45px, left: 10px)

### Màu sắc:
- **Thủ công 100%**: Gradient cam (#f39c12 → #e67e22)
- **Không hóa chất**: Gradient xanh (#27ae60 → #229954)

### Responsive:
- Desktop: font-size 0.8rem, padding 0.3rem 0.8rem
- Mobile: font-size 0.7rem, padding 0.25rem 0.6rem
- Mobile: top positions điều chỉnh (8px và 38px)

## Cách cập nhật badges cho sản phẩm

### Cập nhật thủ công qua SQL:
```sql
-- Thêm badge "Thủ công 100%" cho sản phẩm
UPDATE products SET is_handmade = 1 WHERE id = ?;

-- Thêm badge "Không hóa chất" cho sản phẩm
UPDATE products SET is_chemical_free = 1 WHERE id = ?;

-- Thêm cả 2 badges
UPDATE products SET is_handmade = 1, is_chemical_free = 1 WHERE id = ?;

-- Xóa badges
UPDATE products SET is_handmade = 0, is_chemical_free = 0 WHERE id = ?;
```

### Cập nhật hàng loạt:
```bash
# Chạy script để cập nhật tất cả sản phẩm vòng
node database/update-product-badges.js
```

## Logic hiển thị trong code

File: `public/shop/app.js`

```javascript
// Check if product has special badges
const hasHandmadeBadge = product.is_handmade === 1 || product.tags?.includes('handmade');
const hasChemicalFreeBadge = product.is_chemical_free === 1 || product.tags?.includes('chemical-free');
```

## Thống kê hiện tại

- Tổng sản phẩm active: 129
- Sản phẩm có badge "Thủ công 100%": 70
- Sản phẩm có badge "Không hóa chất": 70

## Scripts đã tạo

1. `database/add-product-badges.js` - Thêm cột vào database
2. `database/update-product-badges.js` - Cập nhật badges cho sản phẩm
3. `test-product-badges.js` - Test và xem thống kê badges

## Lưu ý

- Badges chỉ hiển thị khi `is_handmade = 1` hoặc `is_chemical_free = 1`
- Có thể có 1 hoặc 2 badges cùng lúc
- Badge giảm giá (-X%) vẫn hiển thị độc lập
- Badges tự động responsive trên mobile
- Z-index = 2 để hiển thị trên ảnh sản phẩm
