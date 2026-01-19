# Discount Usage Implementation Guide

## 🔍 Problem Analysis

Khi tạo đơn hàng mới với mã giảm giá, bảng `discount_usage` không nhận được dữ liệu mới.

### Root Causes Identified

#### 1. **Data Format Mismatch** ❌
- **Frontend** (orders-submit.js): Gửi `discount_id`, `discount_code`, `discount_amount` (snake_case)
- **Backend** (order-service.js): Kiểm tra `data.discountId`, `data.discountCode`, `data.discountAmount` (camelCase)
- **Result**: Điều kiện `if (discountCode && discountAmount > 0 && data.discountId)` luôn false → không insert

#### 2. **Missing Fallback in post-handler.js** ❌
- Khi xử lý action 'createOrder', chỉ lấy camelCase format
- Không có fallback cho snake_case format
- Dữ liệu discount bị mất khi đi qua post-handler

#### 3. **Potential Missing Table** ⚠️
- discount_usage table có thể chưa được tạo trong database
- Schema cần được đảm bảo tồn tại

## ✅ Solutions Applied

### Fix 1: order-service.js (Line 170-172)
```javascript
// BEFORE (WRONG)
const discountCode = data.discountCode || null;
const discountAmount = data.discountAmount || 0;

// AFTER (CORRECT)
const discountCode = data.discountCode || data.discount_code || null;
const discountAmount = data.discountAmount || data.discount_amount || 0;
const discountId = data.discountId || data.discount_id || null;
```

**Why**: Hỗ trợ cả hai format (camelCase từ post-handler, snake_case từ frontend)

### Fix 2: post-handler.js (Line 227-229)
```javascript
// BEFORE (INCOMPLETE)
discountCode: data.discountCode || null,
discountAmount: data.discountAmount || 0,
discountId: data.discountId || null,

// AFTER (COMPLETE)
discountCode: data.discountCode || data.discount_code || null,
discountAmount: data.discountAmount || data.discount_amount || 0,
discountId: data.discountId || data.discount_id || null,
```

**Why**: Đảm bảo discount data không bị mất khi đi qua post-handler

### Fix 3: New Migration File
**File**: `database/migrations/043_ensure_discount_usage_table.sql`

Tạo discount_usage table với:
- Proper schema (discount_id, discount_code, order_id, customer_name, customer_phone, order_amount, discount_amount)
- Foreign keys (discount_id → discounts, order_id → orders)
- Indexes (discount_id, order_id, customer_phone, used_at)
- Triggers (auto-increment usage_count, auto-update total_discount_amount)

## 🚀 Implementation Steps

### Step 1: Verify Code Changes
✅ Already applied in:
- `src/services/orders/order-service.js`
- `src/handlers/post-handler.js`

### Step 2: Run Migration (CRITICAL)
```bash
# Option 1: Direct command
wrangler d1 execute vdt --file=database/migrations/043_ensure_discount_usage_table.sql

# Option 2: Using batch file
database/migrations/run_ensure_discount_usage.bat
```

### Step 3: Verify Table Exists
```sql
-- Check if discount_usage table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='discount_usage';

-- Check table structure
PRAGMA table_info(discount_usage);

-- Check triggers
SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='discount_usage';
```

### Step 4: Test the Flow

**Test Case 1: Create order with discount**
1. Go to Orders page
2. Click "Thêm đơn hàng mới"
3. Fill in customer info
4. Add products
5. Enter discount code and click "Áp dụng"
6. Submit order

**Verify in Database**:
```sql
-- Check if discount_usage record was created
SELECT * FROM discount_usage 
WHERE order_id = 'DH<your_order_id>' 
ORDER BY used_at DESC;

-- Check if discount stats were updated
SELECT id, code, usage_count, total_discount_amount 
FROM discounts 
WHERE code = '<your_discount_code>';
```

**Expected Results**:
- ✅ discount_usage has 1 new record
- ✅ discount.usage_count increased by 1
- ✅ discount.total_discount_amount increased by discount_amount

## 📊 Data Flow Diagram

```
Frontend (orders-submit.js)
    ↓
    Sends: {discount_id, discount_code, discount_amount, ...}
    ↓
POST /api/order/create
    ↓
post-handler.js
    ↓
    Transforms to: {discountId, discountCode, discountAmount, ...}
    ↓
order-service.js
    ↓
    Extracts: discountId = data.discountId || data.discount_id
    ↓
    Condition: if (discountCode && discountAmount > 0 && discountId)
    ↓
    INSERT INTO discount_usage (...)
    ↓
Database
    ↓
    Trigger: increment_discount_usage
    ↓
    UPDATE discounts SET usage_count = usage_count + 1
```

## 🔧 Troubleshooting

### Issue: discount_usage still empty after creating order

**Check 1**: Verify discount data is being sent
```javascript
// Add to orders-submit.js before fetch
console.log('📦 Order data:', orderData);
// Look for discount_id, discount_code, discount_amount
```

**Check 2**: Verify backend receives data
```javascript
// Add to order-service.js at start of createOrder
console.log('📥 Received data:', data);
console.log('💰 Discount:', {discountCode, discountAmount, discountId});
```

**Check 3**: Verify table exists
```sql
SELECT * FROM sqlite_master WHERE type='table' AND name='discount_usage';
```

**Check 4**: Verify triggers exist
```sql
SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%discount%';
```

### Issue: Discount applied but usage_count not updated

**Cause**: Trigger not working
**Solution**: 
1. Check trigger syntax: `PRAGMA table_info(discount_usage);`
2. Re-run migration: `wrangler d1 execute vdt --file=database/migrations/043_ensure_discount_usage_table.sql`

## 📈 Performance Considerations

✅ **Optimized for Speed**:
- Indexes on frequently queried columns (discount_id, order_id, customer_phone, used_at)
- Triggers handle auto-updates efficiently
- No blocking operations in order creation flow
- Error handling doesn't fail order creation

✅ **Scalable**:
- Supports unlimited discount usage records
- Efficient trigger-based statistics
- Proper foreign key constraints

## 🎯 Success Criteria

After implementing this fix:

1. ✅ When creating order with discount → discount_usage record created
2. ✅ discount.usage_count auto-incremented
3. ✅ discount.total_discount_amount auto-updated
4. ✅ No errors in browser console
5. ✅ No errors in server logs
6. ✅ Order creation completes successfully
7. ✅ Discount validation still works correctly

## 📝 Notes

- All changes are backward compatible
- No breaking changes to existing APIs
- Supports both camelCase and snake_case formats
- Error handling ensures order creation never fails due to discount_usage insert
- Triggers provide real-time statistics updates
