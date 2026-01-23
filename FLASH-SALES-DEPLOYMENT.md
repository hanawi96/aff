# Flash Sales System - Deployment Guide

Hướng dẫn triển khai hệ thống Flash Sale từ đầu đến cuối.

## 📋 Tổng quan

Hệ thống Flash Sale cho phép tạo các chương trình giảm giá có thời hạn cho sản phẩm với các tính năng:
- Quản lý flash sale campaigns (tạo, sửa, xóa, kích hoạt)
- Thêm/xóa sản phẩm vào flash sale
- Tự động áp dụng giá flash sale khi đặt hàng
- Giới hạn số lượng sản phẩm (stock limit)
- Tracking số lượng đã bán
- Thống kê hiệu suất flash sale

## 🚀 Bước 1: Chạy Migration

### 1.1. Kiểm tra kết nối database
```bash
# Đảm bảo file .env có đầy đủ thông tin
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
```

### 1.2. Chạy migration
```bash
node database/run-migration-058.js
```

### 1.3. Verify migration
```bash
node database/verify-migration-058.js
```

### 1.4. Cập nhật database.json (optional)
```bash
node database/update-database-json.js
```

## 🧪 Bước 2: Test API

### 2.1. Test database operations
```bash
node database/test-flash-sales-api.js
```

Nếu tất cả tests pass, backend đã sẵn sàng!

## 📦 Bước 3: Deploy Backend

### 3.1. Test local (optional)
```bash
npm run dev
# hoặc
wrangler dev
```

### 3.2. Deploy to Cloudflare Workers
```bash
npm run deploy
# hoặc
wrangler deploy
```

## 🎨 Bước 4: Tạo Frontend (Tiếp theo)

Sau khi backend hoàn tất, các bước tiếp theo:

1. **Tạo HTML page**: `public/admin/flash-sales.html`
2. **Tạo CSS**: `public/assets/css/flash-sales.css`
3. **Tạo JavaScript modules**: `public/assets/js/flash-sales/`
4. **Thêm link vào sidebar**: Cập nhật các file admin HTML

## 📊 Database Schema

### Bảng `flash_sales`
```sql
- id: INTEGER PRIMARY KEY
- name: TEXT (tên flash sale)
- description: TEXT
- start_time: INTEGER (Unix timestamp)
- end_time: INTEGER (Unix timestamp)
- status: TEXT (draft, scheduled, active, ended, cancelled)
- is_visible: INTEGER (hiển thị công khai)
- banner_image: TEXT (URL ảnh banner)
- created_at_unix: INTEGER
- updated_at_unix: INTEGER
```

### Bảng `flash_sale_products`
```sql
- id: INTEGER PRIMARY KEY
- flash_sale_id: INTEGER (FK)
- product_id: INTEGER (FK)
- original_price: REAL
- flash_price: REAL
- discount_percentage: REAL
- stock_limit: INTEGER (NULL = unlimited)
- sold_count: INTEGER
- is_active: INTEGER
- created_at_unix: INTEGER
- updated_at_unix: INTEGER
```

## 🔌 API Endpoints

### GET Endpoints
- `?action=getAllFlashSales` - Danh sách tất cả flash sales
- `?action=getFlashSale&id={id}` - Chi tiết 1 flash sale
- `?action=getActiveFlashSales` - Flash sales đang active
- `?action=getFlashSaleProducts&flashSaleId={id}` - Sản phẩm trong flash sale
- `?action=checkProductInFlashSale&productId={id}` - Kiểm tra sản phẩm
- `?action=getFlashSaleStats&flashSaleId={id}` - Thống kê flash sale

### POST Endpoints
```javascript
// Tạo flash sale
{
  "action": "createFlashSale",
  "name": "Flash Sale Cuối Tuần",
  "description": "Giảm giá sốc cuối tuần",
  "start_time": 1706000000,
  "end_time": 1706086400,
  "status": "draft",
  "is_visible": 1
}

// Cập nhật flash sale
{
  "action": "updateFlashSale",
  "id": 1,
  "name": "Flash Sale Updated",
  "status": "active"
}

// Xóa flash sale
{
  "action": "deleteFlashSale",
  "id": 1
}

// Thêm sản phẩm
{
  "action": "addProductToFlashSale",
  "flashSaleId": 1,
  "product_id": 10,
  "flash_price": 80000,
  "original_price": 100000,
  "stock_limit": 50
}

// Thêm nhiều sản phẩm
{
  "action": "addMultipleProductsToFlashSale",
  "flashSaleId": 1,
  "products": [
    {
      "product_id": 10,
      "flash_price": 80000,
      "stock_limit": 50
    },
    {
      "product_id": 11,
      "flash_price": 120000,
      "stock_limit": 30
    }
  ]
}

// Cập nhật sản phẩm
{
  "action": "updateFlashSaleProduct",
  "id": 1,
  "flash_price": 75000,
  "stock_limit": 100
}

// Xóa sản phẩm
{
  "action": "removeProductFromFlashSale",
  "id": 1
}

// Đổi trạng thái
{
  "action": "updateFlashSaleStatus",
  "id": 1,
  "status": "active"
}
```

## 🔄 Status Workflow

```
draft → scheduled → active → ended
          ↓
      cancelled
```

- **draft**: Đang soạn thảo
- **scheduled**: Đã lên lịch, chờ đến giờ
- **active**: Đang diễn ra
- **ended**: Đã kết thúc
- **cancelled**: Đã hủy

## ⚠️ Business Rules

1. **Giá flash sale** phải nhỏ hơn giá gốc
2. **Thời gian kết thúc** phải sau thời gian bắt đầu
3. **Không thể xóa** flash sale đang active
4. **Không thể sửa** flash sale đã ended hoặc cancelled
5. **Một sản phẩm** chỉ có thể có trong 1 flash sale tại 1 thời điểm
6. **Sold count** tự động tăng khi có đơn hàng
7. **Stock limit** = NULL nghĩa là không giới hạn

## 🔍 Validation

### Flash Sale Validation
- Tên không được trống, tối đa 200 ký tự
- Thời gian bắt đầu và kết thúc bắt buộc
- Status phải hợp lệ (draft, scheduled, active, ended, cancelled)

### Product Validation
- Product ID bắt buộc
- Flash price bắt buộc, phải >= 0
- Flash price < original price
- Stock limit > 0 (nếu có)

## 📈 Performance

### Indexes đã tạo
- `idx_flash_sales_status` - Tìm theo status
- `idx_flash_sales_time` - Tìm theo thời gian
- `idx_flash_sales_active_time` - Tìm active flash sales
- `idx_flash_sale_products_sale` - Tìm sản phẩm theo flash sale
- `idx_flash_sale_products_product` - Tìm flash sale theo sản phẩm
- `idx_flash_sale_products_lookup` - Tối ưu check product in flash sale

## 🐛 Troubleshooting

### Migration fails
```bash
# Kiểm tra kết nối database
node database/turso-client.js

# Xem log chi tiết
node database/run-migration-058.js
```

### API không hoạt động
```bash
# Test local
wrangler dev

# Kiểm tra logs
wrangler tail
```

### Dữ liệu không đúng
```bash
# Verify database
node database/verify-migration-058.js

# Test API
node database/test-flash-sales-api.js
```

## 📝 Next Steps

Sau khi backend hoàn tất:

1. ✅ Migration database
2. ✅ Service layer
3. ✅ API endpoints
4. ✅ Deploy backend
5. ⏳ Tạo frontend UI
6. ⏳ Tích hợp vào order flow
7. ⏳ Testing end-to-end

## 📚 Documentation

- Migration: `database/migrations/README-058.md`
- Service: `src/services/flash-sales/README.md`
- API: Xem file này

## 🎯 Integration với Orders

Khi tạo đơn hàng, cần:

1. Check sản phẩm có trong flash sale active không
2. Nếu có, áp dụng flash_price thay vì giá thường
3. Increment sold_count sau khi đơn hàng thành công
4. Check stock_limit trước khi cho phép đặt hàng

```javascript
// Pseudo code
const flashSaleProduct = await checkProductInFlashSale(productId);
if (flashSaleProduct.inFlashSale) {
  price = flashSaleProduct.flash_price;
  // Check stock
  if (flashSaleProduct.stock_limit && 
      flashSaleProduct.sold_count >= flashSaleProduct.stock_limit) {
    throw new Error('Sản phẩm đã hết trong flash sale');
  }
}
```

## ✅ Checklist

- [ ] Chạy migration thành công
- [ ] Verify migration pass
- [ ] Test API pass
- [ ] Deploy backend thành công
- [ ] Tạo frontend UI
- [ ] Test end-to-end
- [ ] Deploy production

---

**Tác giả**: Kiro AI Assistant  
**Ngày tạo**: 2025-01-23  
**Version**: 1.0.0
