# Flash Sales - Bug Fix: Product Selection Not Updating

## 🐛 Bug Report

**Issue**: When clicking on a product checkbox in Step 2 (Product Selection), the checkbox gets checked but:
1. Price input modal doesn't appear
2. Selected products panel doesn't update
3. Product count stays at 0

**User Impact**: Cannot add products to flash sale, blocking the entire create/edit flow.

## 🔍 Root Cause Analysis

### Problem 1: Checkbox Click Handler Missing
**Location**: `renderAllProducts()` function

**Issue**:
```javascript
// BEFORE (BROKEN)
<input type="checkbox" onclick="event.stopPropagation()">
```

The checkbox had `event.stopPropagation()` to prevent the card click from firing, but it didn't call `toggleProductSelection()` itself. So clicking the checkbox did nothing.

**Why it happened**: 
- Card has `onclick="toggleProductSelection(id)"`
- Checkbox has `onclick="event.stopPropagation()"` to prevent card click
- But checkbox didn't trigger selection itself
- Result: Checkbox visual changes but no logic runs

### Problem 2: Duplicate Event Listeners
**Location**: `showPriceModal()` function

**Issue**:
```javascript
// BEFORE (BROKEN)
function showPriceModal(product, currentPrice = null) {
    // ... setup modal ...
    input.addEventListener('input', updateDiscountPercentage); // ❌ Added every time!
}
```

Every time the modal opened, a new event listener was added to the input. After opening the modal 5 times, there would be 5 listeners, causing the discount calculation to run 5 times.

**Why it happened**:
- Event listener added in modal open function
- Never removed
- Accumulated over multiple modal opens

### Problem 3: Unchecked State Not Restored
**Location**: `closePriceModal()` function

**Issue**: When user closes the price modal without confirming (clicks "Hủy"), the checkbox stays checked even though the product wasn't added.

**Why it happened**:
- Modal closes but doesn't re-render product list
- Checkbox state not synced with `selectedProducts` Map

## ✅ Solutions Applied

### Fix 1: Add Checkbox Click Handler
```javascript
// AFTER (FIXED)
<input type="checkbox" 
    onclick="event.stopPropagation(); toggleProductSelection(${product.id})">
```

**What changed**:
- Added `toggleProductSelection(${product.id})` call after `event.stopPropagation()`
- Now clicking checkbox triggers the same logic as clicking the card
- Price modal appears correctly

### Fix 2: Move Event Listener to Setup
```javascript
// AFTER (FIXED)
function setupEventListeners() {
    // ... other listeners ...
    
    // Price input - calculate discount percentage (ONCE)
    document.getElementById('flashSalePriceInput')
        .addEventListener('input', updateDiscountPercentage);
}

function showPriceModal(product, currentPrice = null) {
    // ... setup modal ...
    // No event listener here anymore!
    setTimeout(() => input.focus(), 100);
}
```

**What changed**:
- Moved event listener to `setupEventListeners()` (runs once on page load)
- Removed from `showPriceModal()` (runs every time modal opens)
- No more duplicate listeners

### Fix 3: Restore Unchecked State on Cancel
```javascript
// AFTER (FIXED)
function closePriceModal() {
    document.getElementById('priceInputModal').classList.add('hidden');
    
    // If product was not added (no price confirmed), uncheck it
    if (currentPriceProduct && !selectedProducts.has(currentPriceProduct.id)) {
        renderAllProducts(); // Re-render to uncheck the checkbox
    }
    
    currentPriceProduct = null;
}
```

**What changed**:
- Check if product was actually added to `selectedProducts`
- If not (user cancelled), re-render to restore checkbox state
- Checkbox now correctly unchecks when modal is cancelled

## 🧪 Testing

### Test Case 1: Click Checkbox
**Steps**:
1. Open Create Flash Sale modal
2. Go to Step 2
3. Click a product checkbox

**Expected**:
- ✅ Price input modal appears
- ✅ Product name and price shown
- ✅ Can enter flash price
- ✅ Discount % calculates automatically

### Test Case 2: Click Product Card
**Steps**:
1. Click anywhere on product card (not checkbox)

**Expected**:
- ✅ Same behavior as clicking checkbox
- ✅ Price modal appears

### Test Case 3: Confirm Price
**Steps**:
1. Select product
2. Enter valid flash price
3. Click "Xác nhận"

**Expected**:
- ✅ Modal closes
- ✅ Product appears in "Sản phẩm đã chọn" panel
- ✅ Counter updates: "Sản phẩm đã chọn (1)"
- ✅ Checkbox stays checked
- ✅ Product card shows "selected" style

### Test Case 4: Cancel Price Input
**Steps**:
1. Select product
2. Price modal appears
3. Click "Hủy" without entering price

**Expected**:
- ✅ Modal closes
- ✅ Product NOT added to selected list
- ✅ Checkbox unchecks automatically
- ✅ Counter stays at 0

### Test Case 5: Multiple Selections
**Steps**:
1. Select product A → Enter price → Confirm
2. Select product B → Enter price → Confirm
3. Select product C → Cancel

**Expected**:
- ✅ Products A and B in selected list
- ✅ Product C not in list
- ✅ Counter shows "2"
- ✅ A and B checkboxes checked
- ✅ C checkbox unchecked

### Test Case 6: Discount Calculation
**Steps**:
1. Select product with price 100,000đ
2. Enter flash price: 80,000đ

**Expected**:
- ✅ Shows "Giảm 20%" in green
- ✅ Updates in real-time as you type
- ✅ No duplicate calculations

## 📁 Files Modified

- `public/assets/js/flash-sales.js`
  - Fixed `renderAllProducts()` - Added checkbox click handler
  - Fixed `showPriceModal()` - Removed duplicate event listener
  - Fixed `closePriceModal()` - Restore unchecked state on cancel
  - Updated `setupEventListeners()` - Added price input listener once

## 🎯 Impact

**Before Fix**:
- ❌ Product selection completely broken
- ❌ Cannot create or edit flash sales
- ❌ Feature unusable

**After Fix**:
- ✅ Product selection works perfectly
- ✅ Price modal appears correctly
- ✅ Selected products update in real-time
- ✅ Cancel behavior works correctly
- ✅ No duplicate event listeners
- ✅ Feature fully functional

## 🔑 Key Learnings

1. **Event Propagation**: When stopping propagation, make sure to still call the intended handler
2. **Event Listeners**: Add listeners once in setup, not in functions that run repeatedly
3. **State Sync**: Always sync UI state (checkboxes) with data state (selectedProducts Map)
4. **User Experience**: Handle cancel/close actions properly - don't leave UI in inconsistent state

## ✅ Verification

All test cases pass. Product selection now works flawlessly:
- Click checkbox → Modal appears
- Click card → Modal appears
- Enter price → Product added
- Cancel → Checkbox unchecks
- Multiple selections → All work correctly
- Discount calculation → No duplicates

**Status**: BUG FIXED ✅
