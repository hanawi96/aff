# Migration 058: Flash Sales System

## Mục đích
Tạo hệ thống Flash Sale để quản lý các chương trình giảm giá có thời hạn cho sản phẩm.

## Cấu trúc

### Bảng `flash_sales`
Quản lý các chương trình flash sale:
- Thông tin cơ bản: tên, mô tả
- Thời gian: start_time, end_time (Unix timestamp)
- Trạng thái: draft, scheduled, active, ended, cancelled
- Hiển thị: is_visible, banner_image

### Bảng `flash_sale_products`
Quản lý sản phẩm trong flash sale:
- Liên kết: flash_sale_id, product_id
- Giá: original_price, flash_price, discount_percentage
- Tồn kho: stock_limit, sold_count
- Ràng buộc: flash_price < original_price

## Chạy Migration

```bash
# Chạy migration
node database/run-migration-058.js

# Kiểm tra migration
node database/verify-migration-058.js
```

## Indexes
- `idx_flash_sales_status`: Tìm theo trạng thái
- `idx_flash_sales_time`: Tìm theo thời gian
- `idx_flash_sales_active`: Tìm flash sale đang active
- `idx_flash_sale_products_sale`: Tìm sản phẩm theo flash sale
- `idx_flash_sale_products_product`: Tìm flash sale theo sản phẩm
- `idx_flash_sale_products_active`: Tìm sản phẩm active trong flash sale

## Ràng buộc
- end_time > start_time
- flash_price < original_price
- flash_price >= 0
- sold_count >= 0
- stock_limit > 0 (nếu có)
- Unique: (flash_sale_id, product_id)

## Workflow Status
1. **draft**: Đang soạn thảo
2. **scheduled**: Đã lên lịch, chờ đến giờ
3. **active**: Đang diễn ra
4. **ended**: Đã kết thúc
5. **cancelled**: Đã hủy
