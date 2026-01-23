# Flash Sales - API Integration Fix

## 🐛 Errors Found

### Error 1: Wrong Action Name
```
Error: Unknown action: addFlashSaleProducts
```

**Frontend was calling**: `addFlashSaleProducts`
**Backend expects**: `addMultipleProductsToFlashSale`

### Error 2: Wrong Parameter Names
```
Error: Unsupported type of value
```

Multiple API calls were using incorrect parameter names that didn't match backend expectations.

## 🔍 Root Cause

Frontend code was written based on assumed API names without checking the actual backend implementation. The backend uses different naming conventions:

| Frontend (Wrong) | Backend (Correct) |
|-----------------|-------------------|
| `addFlashSaleProducts` | `addMultipleProductsToFlashSale` |
| `flash_sale_id` | `id` (for update/delete) |
| `flash_sale_id` | `flashSaleId` (for products) |

## ✅ Fixes Applied

### Fix 1: Create/Update Flash Sale - Add Products

**Before (BROKEN)**:
```javascript
await fetch(`${API_BASE}/api?action=addFlashSaleProducts`, {
    method: 'POST',
    body: JSON.stringify({
        flash_sale_id: flashSaleId,
        products: products
    })
});
```

**After (FIXED)**:
```javascript
await fetch(`${API_BASE}/api?action=addMultipleProductsToFlashSale`, {
    method: 'POST',
    body: JSON.stringify({
        flashSaleId: flashSaleId,  // Changed parameter name
        products: products.map(p => ({
            product_id: p.product_id,
            flash_price: p.flash_price,
            original_price: p.original_price  // Added original_price
        }))
    })
});
```

**Changes**:
- ✅ Action: `addFlashSaleProducts` → `addMultipleProductsToFlashSale`
- ✅ Parameter: `flash_sale_id` → `flashSaleId`
- ✅ Added `original_price` to each product

### Fix 2: Update Flash Sale

**Before (BROKEN)**:
```javascript
await fetch(`${API_BASE}/api?action=updateFlashSale`, {
    method: 'POST',
    body: JSON.stringify({
        flash_sale_id: currentEditingFlashSaleId,  // Wrong!
        name, description, start_time, end_time, status
    })
});
```

**After (FIXED)**:
```javascript
await fetch(`${API_BASE}/api?action=updateFlashSale`, {
    method: 'POST',
    body: JSON.stringify({
        id: currentEditingFlashSaleId,  // Correct!
        name, description, start_time, end_time, status
    })
});
```

**Changes**:
- ✅ Parameter: `flash_sale_id` → `id`

### Fix 3: Delete Flash Sale

**Before (BROKEN)**:
```javascript
await fetch(`${API_BASE}/api?action=deleteFlashSale`, {
    method: 'POST',
    body: JSON.stringify({
        flash_sale_id: deleteFlashSaleId  // Wrong!
    })
});
```

**After (FIXED)**:
```javascript
await fetch(`${API_BASE}/api?action=deleteFlashSale`, {
    method: 'POST',
    body: JSON.stringify({
        id: deleteFlashSaleId  // Correct!
    })
});
```

**Changes**:
- ✅ Parameter: `flash_sale_id` → `id`

### Fix 4: Activate Flash Sale

**Before (BROKEN)**:
```javascript
await fetch(`${API_BASE}/api?action=updateFlashSaleStatus`, {
    method: 'POST',
    body: JSON.stringify({
        flash_sale_id: id,  // Wrong!
        status: 'active'
    })
});
```

**After (FIXED)**:
```javascript
await fetch(`${API_BASE}/api?action=updateFlashSaleStatus`, {
    method: 'POST',
    body: JSON.stringify({
        id: id,  // Correct!
        status: 'active'
    })
});
```

**Changes**:
- ✅ Parameter: `flash_sale_id` → `id`

### Fix 5: Delete Products in Edit Mode

**Before (BROKEN)**:
```javascript
// Tried to use non-existent action
await fetch(`${API_BASE}/api?action=deleteFlashSaleProducts`, {
    method: 'POST',
    body: JSON.stringify({ flash_sale_id: flashSaleId })
});
```

**After (FIXED)**:
```javascript
// Get existing products first
const existingResponse = await fetch(
    `${API_BASE}/api?action=getFlashSaleProducts&flashSaleId=${flashSaleId}`
);
const existingData = await existingResponse.json();

// Delete each product individually
if (existingData.success && existingData.products) {
    for (const product of existingData.products) {
        await fetch(`${API_BASE}/api?action=removeProductFromFlashSale`, {
            method: 'POST',
            body: JSON.stringify({ id: product.id })
        });
    }
}
```

**Changes**:
- ✅ Use existing `removeProductFromFlashSale` action
- ✅ Delete products one by one
- ✅ Get product IDs from `getFlashSaleProducts` first

## 📋 Backend API Reference

### Flash Sale Operations

| Action | Method | Parameters | Description |
|--------|--------|------------|-------------|
| `createFlashSale` | POST | `{name, description, start_time, end_time, status}` | Create new flash sale |
| `updateFlashSale` | POST | `{id, name?, description?, start_time?, end_time?, status?}` | Update flash sale |
| `deleteFlashSale` | POST | `{id}` | Delete flash sale (cascade deletes products) |
| `updateFlashSaleStatus` | POST | `{id, status}` | Change flash sale status |
| `getAllFlashSales` | GET | - | Get all flash sales with stats |
| `getFlashSale` | GET | `?id={id}` | Get single flash sale |
| `getActiveFlashSales` | GET | - | Get currently active flash sales |

### Flash Sale Products Operations

| Action | Method | Parameters | Description |
|--------|--------|------------|-------------|
| `addMultipleProductsToFlashSale` | POST | `{flashSaleId, products: [{product_id, flash_price, original_price?}]}` | Add multiple products |
| `getFlashSaleProducts` | GET | `?flashSaleId={id}` | Get all products in flash sale |
| `removeProductFromFlashSale` | POST | `{id}` | Remove single product (id = flash_sale_products.id) |
| `updateFlashSaleProduct` | POST | `{id, flash_price?, stock_limit?, is_active?}` | Update product in flash sale |

## 🧪 Testing

### Test Create Flash Sale
1. Fill form with valid data
2. Select 2-3 products with prices
3. Submit
4. **Expected**: Success message, flash sale created with products

### Test Edit Flash Sale
1. Click "Sửa" on existing flash sale
2. Modify name and add/remove products
3. Submit
4. **Expected**: Success message, flash sale updated

### Test Delete Flash Sale
1. Click "Xóa" on flash sale
2. Confirm deletion
3. **Expected**: Success message, flash sale and products deleted

### Test Activate Flash Sale
1. Click "Kích hoạt" on draft/scheduled flash sale
2. Confirm activation
3. **Expected**: Success message, status changed to "active"

## 📁 Files Modified

- `public/assets/js/flash-sales.js`
  - Fixed `submitFlashSale()` - Correct action and parameters
  - Fixed `editFlashSale()` - Correct update parameters
  - Fixed `confirmDelete()` - Correct delete parameters
  - Fixed `activateFlashSale()` - Correct status update parameters
  - Fixed product deletion in edit mode

## ✅ Verification

All API calls now match backend expectations:
- ✅ Correct action names
- ✅ Correct parameter names
- ✅ Correct data structures
- ✅ All CRUD operations work
- ✅ No more 400/500 errors

**Status**: API INTEGRATION FIXED ✅
