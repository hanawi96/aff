# Discount Usage Fix Summary

## Problem
Khi tạo đơn hàng mới với mã giảm giá, dữ liệu không được thêm vào bảng `discount_usage` trong database.

## Root Causes Found

### 1. **Case Mismatch in order-service.js** (FIXED)
- **File**: `src/services/orders/order-service.js` (line 170-172)
- **Issue**: Frontend gửi `discount_id` (snake_case) nhưng backend kiểm tra `data.discountId` (camelCase)
- **Fix**: Thêm fallback để hỗ trợ cả hai format:
  ```javascript
  const discountCode = data.discountCode || data.discount_code || null;
  const discountAmount = data.discountAmount || data.discount_amount || 0;
  const discountId = data.discountId || data.discount_id || null;
  ```

### 2. **Missing Discount Data in post-handler.js** (FIXED)
- **File**: `src/handlers/post-handler.js` (line 217-219)
- **Issue**: Khi xử lý action 'createOrder', chỉ lấy camelCase, không lấy snake_case
- **Fix**: Thêm fallback cho discount fields:
  ```javascript
  discountCode: data.discountCode || data.discount_code || null,
  discountAmount: data.discountAmount || data.discount_amount || 0,
  discountId: data.discountId || data.discount_id || null,
  ```

### 3. **Missing Migration for discount_usage Table** (CREATED)
- **File**: `database/migrations/043_ensure_discount_usage_table.sql` (NEW)
- **Issue**: discount_usage table có thể chưa được tạo trong database
- **Fix**: Tạo migration file để đảm bảo table tồn tại với schema đúng

## Files Modified

1. ✅ `src/services/orders/order-service.js` - Fixed case mismatch
2. ✅ `src/handlers/post-handler.js` - Fixed discount data extraction
3. ✅ `database/migrations/043_ensure_discount_usage_table.sql` - NEW migration
4. ✅ `database/migrations/run_ensure_discount_usage.bat` - NEW script to run migration

## How to Apply Fix

### Step 1: Deploy Code Changes
The code changes in `order-service.js` and `post-handler.js` are already applied.

### Step 2: Run Migration (IMPORTANT)
```bash
# Run the migration to ensure discount_usage table exists
wrangler d1 execute vdt --file=database/migrations/043_ensure_discount_usage_table.sql
```

Or use the batch file:
```bash
database/migrations/run_ensure_discount_usage.bat
```

## Testing

After applying the fix:

1. Create a new order with a discount code
2. Check the `discount_usage` table in database:
   ```sql
   SELECT * FROM discount_usage ORDER BY used_at DESC LIMIT 1;
   ```
3. Verify that:
   - `discount_id` is populated
   - `discount_code` is populated
   - `order_id` is populated
   - `discount_amount` is populated
   - `order_amount` is populated

## Expected Behavior After Fix

✅ When creating an order with discount:
- Discount data is correctly extracted from frontend
- discount_usage record is inserted into database
- Discount usage_count is auto-incremented via trigger
- Discount total_discount_amount is auto-updated via trigger

## Performance Notes

- No performance impact - all changes are data format fixes
- Triggers handle auto-updates efficiently
- Indexes on discount_usage table ensure fast queries
