# Fix: Markup Selector Auto-Update Price ✅

## Vấn đề
Khi người dùng thay đổi hệ số markup trong dropdown (×2.0, ×2.5, ×3.0, v.v.), giá bán không tự động cập nhật.

## Nguyên nhân
1. Dropdown `markupMultiplier` không có event handler `onchange`
2. Function `autoCalculateSellingPrice()` không đọc giá trị từ dropdown
3. Không có function để cập nhật giá khi markup thay đổi

## Giải pháp đã thực hiện

### 1. Sửa function `autoCalculateSellingPrice()` ✅
**File**: `public/assets/js/products.js`

**Trước:**
```javascript
function autoCalculateSellingPrice(costPrice, materialCount = 0) {
    const markupPercent = getSmartMarkup(materialCount);
    const calculatedPrice = costPrice * (1 + markupPercent / 100);
    return smartRound(calculatedPrice);
}
```

**Sau:**
```javascript
function autoCalculateSellingPrice(costPrice, materialCount = 0) {
    // Lấy giá trị markup từ dropdown
    const markupSelector = document.getElementById('markupMultiplier');
    const markupValue = markupSelector ? markupSelector.value : 'auto';
    
    let multiplier;
    if (markupValue === 'auto') {
        // Tự động dựa trên số lượng nguyên liệu
        if (materialCount <= 3) multiplier = 2.5;
        else if (materialCount <= 6) multiplier = 3.0;
        else multiplier = 3.5;
    } else {
        // Dùng giá trị cố định từ dropdown
        multiplier = parseFloat(markupValue);
    }
    
    const calculatedPrice = costPrice * multiplier;
    return smartRound(calculatedPrice);
}
```

### 2. Thêm event handler cho dropdown ✅
**File**: `public/assets/js/products.js`

Thêm `onchange="updateSellingPriceFromMarkup()"` vào cả 2 modal (Add và Edit):

```html
<select id="markupMultiplier" 
    onchange="updateSellingPriceFromMarkup()"
    class="...">
```

### 3. Tạo function `updateSellingPriceFromMarkup()` ✅
**File**: `public/assets/js/products.js`

```javascript
function updateSellingPriceFromMarkup() {
    const checkbox = document.getElementById('autoPricingEnabled');
    if (!checkbox || !checkbox.checked) return;
    
    const costPriceInput = document.getElementById('productCostPrice');
    if (!costPriceInput) return;
    
    const costPrice = parseFormattedNumber(costPriceInput.value);
    if (!costPrice || costPrice <= 0) return;
    
    // Lấy số lượng nguyên liệu
    const selectedMaterials = typeof window.getSelectedMaterials === 'function' 
        ? window.getSelectedMaterials() 
        : [];
    const materialCount = selectedMaterials.length;
    
    // Tính giá bán mới
    const newSellingPrice = autoCalculateSellingPrice(costPrice, materialCount);
    
    // Cập nhật vào input với visual feedback
    const sellingPriceInput = document.getElementById('productPrice');
    if (sellingPriceInput) {
        sellingPriceInput.value = formatNumber(newSellingPrice);
        updatePriceHint(materialCount);
        
        if (typeof calculateExpectedProfit === 'function') {
            calculateExpectedProfit();
        }
        
        // Visual feedback
        sellingPriceInput.classList.add('bg-green-50', 'border-green-300');
        setTimeout(() => {
            sellingPriceInput.classList.remove('bg-green-50', 'border-green-300');
        }, 500);
    }
}
```

### 4. Tạo function `updatePriceHint()` ✅
**File**: `public/assets/js/products.js`

```javascript
function updatePriceHint(materialCount = 0) {
    const priceHint = document.getElementById('priceHint');
    if (!priceHint) return;
    
    const markupSelector = document.getElementById('markupMultiplier');
    const markupValue = markupSelector ? markupSelector.value : 'auto';
    
    if (markupValue === 'auto') {
        let multiplier;
        if (materialCount <= 3) multiplier = '×2.5';
        else if (materialCount <= 6) multiplier = '×3.0';
        else multiplier = '×3.5';
        priceHint.textContent = `💡 Tự động ${multiplier} (${materialCount} nguyên liệu)`;
    } else {
        const multiplier = parseFloat(markupValue);
        const profit = ((multiplier - 1) * 100).toFixed(0);
        priceHint.textContent = `💡 Cố định ×${multiplier} (Lãi ${profit}%)`;
    }
}
```

### 5. Cập nhật `toggleMarkupSelector()` ✅
**File**: `public/assets/js/products.js`

Thêm auto-update khi bật checkbox:

```javascript
function toggleMarkupSelector() {
    const checkbox = document.getElementById('autoPricingEnabled');
    const container = document.getElementById('markupSelectorContainer');
    
    if (container) {
        if (checkbox && checkbox.checked) {
            container.classList.remove('hidden');
            updateSellingPriceFromMarkup(); // Tự động cập nhật
        } else {
            container.classList.add('hidden');
        }
    }
}
```

### 6. Đơn giản hóa `calculateTotalCost()` ✅
**File**: `public/assets/js/product-materials.js`

Thay thế logic phức tạp bằng gọi function từ products.js:

```javascript
function calculateTotalCost() {
    // ... tính total cost ...
    
    // Auto-calculate selling price if enabled
    const autoPricingCheckbox = document.getElementById('autoPricingEnabled');
    if (autoPricingCheckbox && autoPricingCheckbox.checked) {
        if (typeof updateSellingPriceFromMarkup === 'function') {
            updateSellingPriceFromMarkup();
        }
    }
}
```

## Kết quả

### ✅ Các tình huống hoạt động:

1. **Thay đổi markup dropdown**
   - Chọn ×2.0 → Giá bán = Giá vốn × 2.0
   - Chọn ×3.5 → Giá bán = Giá vốn × 3.5
   - Chọn Auto → Giá bán tự động theo số nguyên liệu

2. **Thêm/xóa nguyên liệu**
   - Giá vốn tự động cập nhật
   - Giá bán tự động cập nhật theo markup đã chọn

3. **Bật/tắt auto-pricing**
   - Bật → Hiện dropdown markup và tự động tính giá
   - Tắt → Ẩn dropdown, cho phép nhập giá thủ công

4. **Visual feedback**
   - Input giá bán nhấp nháy màu xanh khi cập nhật
   - Hint text hiển thị markup đang dùng
   - Profit tự động tính lại

## Files đã sửa

1. ✅ `public/assets/js/products.js`
   - Sửa `autoCalculateSellingPrice()`
   - Thêm `updateSellingPriceFromMarkup()`
   - Thêm `updatePriceHint()`
   - Sửa `toggleMarkupSelector()`
   - Thêm `onchange` handler cho dropdown (2 chỗ: Add và Edit modal)

2. ✅ `public/assets/js/product-materials.js`
   - Đơn giản hóa `calculateTotalCost()`

## Testing

### Test Case 1: Thay đổi markup
1. Mở modal thêm/sửa sản phẩm
2. Thêm nguyên liệu (giá vốn = 100,000đ)
3. Chọn ×2.0 → Giá bán = 200,000đ ✅
4. Chọn ×3.0 → Giá bán = 300,000đ ✅
5. Chọn Auto → Giá bán = 250,000đ (×2.5 cho 1-3 nguyên liệu) ✅

### Test Case 2: Thêm nguyên liệu
1. Chọn markup ×3.0
2. Thêm nguyên liệu A (50,000đ) → Giá bán = 150,000đ ✅
3. Thêm nguyên liệu B (30,000đ) → Giá bán = 240,000đ ✅

### Test Case 3: Auto markup
1. Chọn Auto
2. Thêm 2 nguyên liệu → ×2.5 ✅
3. Thêm 5 nguyên liệu → ×3.0 ✅
4. Thêm 8 nguyên liệu → ×3.5 ✅

## Status: ✅ HOÀN THÀNH

Tất cả logic đã được sửa và hoạt động chính xác. Giá bán giờ đây tự động cập nhật khi:
- Thay đổi markup dropdown
- Thêm/xóa nguyên liệu
- Bật auto-pricing checkbox

**Date**: January 20, 2026
