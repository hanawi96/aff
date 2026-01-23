# Flash Sales Service

Service quản lý hệ thống Flash Sale - giảm giá có thời hạn cho sản phẩm.

## Cấu trúc

### `flash-sale-service.js`
Quản lý flash sale campaigns:
- `getAllFlashSales()` - Lấy danh sách tất cả flash sales
- `getFlashSale(id)` - Lấy chi tiết 1 flash sale
- `getActiveFlashSales()` - Lấy flash sales đang active
- `createFlashSale(data)` - Tạo flash sale mới
- `updateFlashSale(id, data)` - Cập nhật flash sale
- `deleteFlashSale(id)` - Xóa flash sale
- `updateFlashSaleStatus(id, status)` - Đổi trạng thái

### `flash-sale-products.js`
Quản lý sản phẩm trong flash sale:
- `getFlashSaleProducts(flashSaleId)` - Lấy sản phẩm trong flash sale
- `addProductToFlashSale(flashSaleId, data)` - Thêm 1 sản phẩm
- `addMultipleProductsToFlashSale(flashSaleId, products)` - Thêm nhiều sản phẩm
- `updateFlashSaleProduct(id, data)` - Cập nhật sản phẩm
- `removeProductFromFlashSale(id)` - Xóa sản phẩm
- `checkProductInFlashSale(productId)` - Kiểm tra sản phẩm có trong flash sale active
- `incrementSoldCount(id, quantity)` - Tăng số lượng đã bán
- `getFlashSaleStats(flashSaleId)` - Thống kê flash sale

### `flash-sale-validation.js`
Validation và utilities:
- `checkTimeConflicts()` - Kiểm tra xung đột thời gian
- `validateFlashSaleData()` - Validate dữ liệu flash sale
- `validateFlashSaleProductData()` - Validate dữ liệu sản phẩm
- `autoUpdateFlashSaleStatus()` - Tự động cập nhật trạng thái
- `canDeleteFlashSale()` - Kiểm tra có thể xóa
- `canEditFlashSale()` - Kiểm tra có thể sửa

## Workflow

### Tạo Flash Sale
1. Validate dữ liệu (tên, thời gian)
2. Xác định status dựa trên thời gian
3. Insert vào database
4. Trả về flashSaleId

### Thêm Sản phẩm
1. Validate flash sale tồn tại
2. Validate sản phẩm tồn tại
3. Check duplicate
4. Validate giá (flash_price < original_price)
5. Tính discount_percentage
6. Insert vào flash_sale_products

### Khi khách mua hàng
1. Check sản phẩm có trong flash sale active
2. Áp dụng flash_price
3. Increment sold_count
4. Check stock_limit

## Status Flow
```
draft → scheduled → active → ended
              ↓
          cancelled
```

## Ràng buộc
- `flash_price < original_price`
- `end_time > start_time`
- `sold_count >= 0`
- `stock_limit > 0` (nếu có)
- Unique: (flash_sale_id, product_id)

## Indexes
- `idx_flash_sales_status` - Tìm theo status
- `idx_flash_sales_time` - Tìm theo thời gian
- `idx_flash_sales_active_time` - Tìm active flash sales
- `idx_flash_sale_products_sale` - Tìm sản phẩm theo flash sale
- `idx_flash_sale_products_product` - Tìm flash sale theo sản phẩm
- `idx_flash_sale_products_lookup` - Tối ưu check product in flash sale
