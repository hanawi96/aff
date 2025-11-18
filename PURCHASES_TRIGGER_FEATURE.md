# Tính năng Tự động Cập nhật Purchases

## 📋 Tổng quan
Đã thêm trigger SQL để tự động cập nhật cột `purchases` trong bảng `products` khi có thay đổi trong bảng `order_items`.

## ✅ Kết quả kiểm tra
- ✅ Trigger đã được tạo thành công trên database remote `vdt`
- ✅ Dữ liệu hiện tại đã được đồng bộ (purchases = calculated_purchases)
- ✅ Các sản phẩm có đơn hàng đã có số lượt bán chính xác

### Ví dụ dữ liệu sau khi sync:
```
┌─────┬─────────────────────────┬───────────────────┬──────────────────────┐
│ id  │ name                    │ current_purchases │ calculated_purchases │
├─────┼─────────────────────────┼───────────────────┼──────────────────────┤
│ 84  │ Móc chìa khóa dâu tằm   │ 5                 │ 5                    │
│ 133 │ Bó dâu 7 CÀNH (bé trai) │ 5                 │ 5                    │
│ 83  │ Túi Dâu Tằm Để Giường   │ 3                 │ 3                    │
│ 134 │ Bó dâu 9 CÀNH (bé gái)  │ 1                 │ 1                    │
└─────┴─────────────────────────┴───────────────────┴──────────────────────┘
```

## 🔧 Trigger đã tạo

### 1. **increment_purchases_on_order_item_insert**
- Tự động **tăng** `purchases` khi thêm sản phẩm vào đơn hàng
- Tăng theo số lượng (`quantity`) của sản phẩm

### 2. **decrement_purchases_on_order_item_delete**
- Tự động **giảm** `purchases` khi xóa sản phẩm khỏi đơn hàng
- Đảm bảo không bị âm (minimum = 0)

### 3. **update_purchases_on_order_item_update**
- Tự động **cập nhật** `purchases` khi thay đổi số lượng sản phẩm
- Xử lý cả tăng và giảm số lượng

## 📝 Cách hoạt động

### Khi tạo đơn hàng mới:
```javascript
// Trong hàm createOrder() - worker.js
// Khi insert vào order_items:
await env.DB.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, ...)
    VALUES (?, ?, ?, ...)
`).bind(orderId, productId, quantity, ...).run();

// ✅ Trigger tự động chạy:
// UPDATE products SET purchases = purchases + quantity WHERE id = productId
```

### Khi xóa đơn hàng:
```javascript
// Khi delete từ order_items:
await env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(orderId).run();

// ✅ Trigger tự động chạy:
// UPDATE products SET purchases = purchases - quantity WHERE id = productId
```

### Khi cập nhật số lượng:
```javascript
// Khi update quantity trong order_items:
await env.DB.prepare(`
    UPDATE order_items SET quantity = ? WHERE id = ?
`).bind(newQuantity, itemId).run();

// ✅ Trigger tự động chạy:
// UPDATE products SET purchases = purchases + (newQuantity - oldQuantity)
```

## 🎯 Lợi ích

1. **Tự động**: Không cần code thủ công để cập nhật purchases
2. **Chính xác**: Luôn đồng bộ với order_items
3. **Hiệu quả**: Chạy ở database level, nhanh hơn
4. **An toàn**: Xử lý edge cases (không bị âm, null-safe)

## 📂 Files liên quan

- `database/migrations/023_add_purchases_trigger.sql` - Migration file
- `database/migrations/run_add_purchases_trigger.bat` - Script chạy migration
- `database/migrations/test_purchases_trigger.sql` - Script test trigger

## 🧪 Cách test

### Test thủ công:
```bash
# 1. Kiểm tra purchases hiện tại
wrangler d1 execute vdt --remote --command="SELECT id, name, purchases FROM products WHERE id = 84"

# 2. Tạo đơn hàng mới với sản phẩm id=84, quantity=2

# 3. Kiểm tra lại purchases (phải tăng thêm 2)
wrangler d1 execute vdt --remote --command="SELECT id, name, purchases FROM products WHERE id = 84"
```

### Test tự động:
```bash
cd database/migrations
wrangler d1 execute vdt --remote --file=test_purchases_trigger.sql
```

## ⚠️ Lưu ý

- Trigger chỉ hoạt động khi `product_id IS NOT NULL`
- Đã sync dữ liệu cũ (recalculate từ order_items)
- Purchases không bao giờ âm (có check CASE WHEN)

## 🚀 Deployment

Migration đã được apply lên database remote `vdt`:
```
✅ 4 queries executed
✅ 47 rows read, 7 rows written
✅ Database size: 0.29 MB
```

## 🔧 Sửa lỗi dữ liệu cũ

### Vấn đề phát hiện:
- Cột `purchases` trong bảng `products` có dữ liệu cũ/giả không khớp với thực tế
- Ví dụ: Sản phẩm có `purchases = 345` nhưng `actual_sold = 0` trong `order_items`
- Trang thống kê hiển thị đúng (từ `order_items`) nhưng cột `purchases` sai

### Giải pháp:
Đã tạo migration `024_reset_purchases_from_order_items.sql` để:
1. Reset tất cả `purchases` về 0
2. Tính lại từ `order_items` (nguồn dữ liệu chính xác)
3. Verify kết quả

### Kết quả sau khi fix:
```
┌─────┬─────────────────────────┬───────────┐
│ id  │ name                    │ purchases │
├─────┼─────────────────────────┼───────────┤
│ 84  │ Móc chìa khóa dâu tằm   │ 5         │
│ 133 │ Bó dâu 7 CÀNH (bé trai) │ 5         │
│ 83  │ Túi Dâu Tằm Để Giường   │ 3         │
│ 134 │ Bó dâu 9 CÀNH (bé gái)  │ 1         │
└─────┴─────────────────────────┴───────────┘
```

✅ Tất cả sản phẩm giờ có `purchases = actual_sold`
✅ Không còn sản phẩm nào có dữ liệu sai lệch

---
**Ngày tạo**: 2024-11-18  
**Database**: vdt (remote)  
**Status**: ✅ Hoàn thành, đã test và fix dữ liệu cũ
