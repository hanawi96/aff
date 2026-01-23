# Flash Sales Update Issue - Debug Guide

## Vấn đề
Khi cập nhật flash sale (xóa bớt sản phẩm), dữ liệu không được lưu vào database. Load lại vẫn hiển thị như cũ.

## Nguyên nhân có thể

### 1. ❌ Backend chưa được deploy
API `removeAllProductsFromFlashSale` là API MỚI, cần deploy lên Cloudflare Workers.

**Kiểm tra:**
```bash
# Deploy backend
npm run deploy
# hoặc
wrangler deploy
```

### 2. ❌ API trả về lỗi 400 Bad Request
Frontend không kiểm tra response của API xóa sản phẩm.

**Đã fix:** Thêm error checking trong frontend.

### 3. ❌ Parameter không đúng
API nhận `flashSaleId` nhưng frontend gửi sai tên parameter.

**Đã fix:** Đã kiểm tra và đúng.

## Cách Debug

### Bước 1: Kiểm tra Console Log

Mở DevTools Console khi cập nhật flash sale, xem:

```javascript
// Frontend logs
console.log('Deleted products:', deleteData.deletedCount);

// Backend logs (trong Wrangler)
console.log('Removing all products from flash sale:', flashSaleId);
console.log('Delete result:', result.meta);
```

### Bước 2: Kiểm tra Network Tab

1. Mở DevTools → Network tab
2. Nhấn "Cập nhật Flash Sale"
3. Tìm request `removeAllProductsFromFlashSale`
4. Kiểm tra:
   - Status code (phải là 200)
   - Request payload: `{"flashSaleId": 1}`
   - Response: `{"success": true, "deletedCount": 50}`

### Bước 3: Test API trực tiếp

```bash
# Run test script
node database/test-remove-all-products.js
```

Hoặc dùng curl:

```bash
curl -X POST https://your-api.workers.dev/api?action=removeAllProductsFromFlashSale \
  -H "Content-Type: application/json" \
  -d '{"flashSaleId": 1}'
```

### Bước 4: Kiểm tra Database

```sql
-- Xem số lượng sản phẩm trong flash sale
SELECT COUNT(*) FROM flash_sale_products WHERE flash_sale_id = 1;

-- Xem chi tiết
SELECT * FROM flash_sale_products WHERE flash_sale_id = 1;
```

## Flow Cập Nhật (Đúng)

```
1. User clicks "Cập nhật Flash Sale"
   ↓
2. Frontend: submitFlashSale()
   ↓
3. API: updateFlashSale (cập nhật thông tin)
   ✅ Response: {success: true}
   ↓
4. API: removeAllProductsFromFlashSale (xóa sản phẩm cũ)
   ✅ Response: {success: true, deletedCount: 50}
   ↓
5. API: addMultipleProductsToFlashSale (thêm sản phẩm mới)
   ✅ Response: {success: true, added: 30}
   ↓
6. Frontend: closeModal() + loadFlashSales()
   ↓
7. Toast: "✅ Cập nhật Flash Sale thành công với 30 sản phẩm!"
```

## Checklist Fix

- [x] Thêm API `removeAllProductsFromFlashSale` trong backend
- [x] Export function trong `index.js`
- [x] Thêm handler trong `post-handler.js`
- [x] Thêm import trong `post-handler.js`
- [x] Frontend: Kiểm tra response của API xóa
- [x] Thêm validation `flashSaleId` trong backend
- [x] Thêm console.log để debug
- [ ] **DEPLOY backend lên Cloudflare Workers** ⚠️

## Solution

### Nếu API trả về 400:

**Nguyên nhân:** Backend chưa được deploy hoặc có lỗi validation.

**Fix:**
```bash
# Deploy backend
wrangler deploy

# Hoặc
npm run deploy
```

### Nếu API trả về 200 nhưng deletedCount = 0:

**Nguyên nhân:** `flashSaleId` không đúng hoặc không có sản phẩm nào.

**Fix:** Kiểm tra database:
```sql
SELECT * FROM flash_sale_products WHERE flash_sale_id = ?;
```

### Nếu API thành công nhưng UI không update:

**Nguyên nhân:** Frontend không reload data.

**Fix:** Đã có `loadFlashSales()` sau khi update thành công.

## Code Changes Summary

### Frontend: `public/assets/js/flash-sales.js`

```javascript
// Thêm error checking
const deleteResponse = await fetch(`${API_BASE}/api?action=removeAllProductsFromFlashSale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flashSaleId: flashSaleId })
});

const deleteData = await deleteResponse.json();

if (!deleteData.success) {
    console.error('Failed to delete products:', deleteData);
    throw new Error(deleteData.error || 'Không thể xóa sản phẩm cũ');
}

console.log('Deleted products:', deleteData.deletedCount);
```

### Backend: `src/services/flash-sales/flash-sale-products.js`

```javascript
export async function removeAllProductsFromFlashSale(flashSaleId, env, corsHeaders) {
    try {
        // Validate flashSaleId
        if (!flashSaleId) {
            return jsonResponse({
                success: false,
                error: 'flashSaleId is required'
            }, 400, corsHeaders);
        }
        
        console.log('Removing all products from flash sale:', flashSaleId);
        
        const result = await env.DB.prepare(`
            DELETE FROM flash_sale_products WHERE flash_sale_id = ?
        `).bind(flashSaleId).run();

        console.log('Delete result:', result.meta);

        return jsonResponse({
            success: true,
            deletedCount: result.meta.changes || 0,
            message: `Đã xóa ${result.meta.changes || 0} sản phẩm`
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
```

## Next Steps

1. **Deploy backend:**
   ```bash
   wrangler deploy
   ```

2. **Test lại:**
   - Edit flash sale
   - Xóa bớt sản phẩm
   - Nhấn "Cập nhật"
   - Kiểm tra Console logs
   - Kiểm tra Network tab
   - Load lại trang

3. **Verify database:**
   ```sql
   SELECT COUNT(*) FROM flash_sale_products WHERE flash_sale_id = 1;
   ```

---

**Expected Result:** Sau khi cập nhật, số lượng sản phẩm trong database phải khớp với số sản phẩm đã chọn.

**Date:** January 23, 2026
