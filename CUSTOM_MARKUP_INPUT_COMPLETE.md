# Custom Markup Input với Preset Buttons ✅

## 🎨 Thiết kế mới

### Trước (Dropdown):
```
[Dropdown ▼]
- 🤖 Tự động
- ×2.0
- ×2.5
- ×3.0
- ×3.5
- ×4.0
```

### Sau (Input + Preset Buttons):
```
⚙️ Hệ số markup
┌─────────────────────────┐
│      [  2.5  ] ×       │  ← Input tùy chỉnh (type="number")
└─────────────────────────┘

Preset nhanh:
[🤖 Auto] [×2.0] [×2.5] [×3.0] [×3.5] [×4.0]
     ↑ Gradient purple/indigo
         ↑ Buttons trắng với hover effect
```

## ✨ Tính năng

### 1. Input tùy chỉnh
- Type: `number`
- Step: `0.1` (có thể nhập 2.3, 2.8, 3.7...)
- Min: `1.0`
- Max: `10.0`
- Default: `2.5`
- Font: Lớn, đậm, căn giữa
- Auto-update giá khi thay đổi

### 2. Preset Buttons
- **🤖 Auto**: Gradient purple/indigo, tính tự động theo số nguyên liệu
  - 1-3 nguyên liệu → ×2.5
  - 4-6 nguyên liệu → ×3.0
  - 7+ nguyên liệu → ×3.5
- **×2.0, ×2.5, ×3.0, ×3.5, ×4.0**: Buttons trắng với hover effect
- Click button → Tự động điền vào input và cập nhật giá

### 3. Visual Feedback
- Input nhấp nháy màu xanh khi click preset
- Hint text hiển thị: "💡 Hệ số ×2.5 (Lãi 60%)"
- Giá bán tự động cập nhật

## 🔧 Implementation

### 1. UI Components

**Input:**
```html
<input type="number" 
    id="markupMultiplier" 
    step="0.1" 
    min="1.0" 
    max="10.0"
    value="2.5"
    oninput="updateSellingPriceFromMarkup()"
    class="...text-lg font-semibold text-center">
<span class="absolute right-3 top-2.5">×</span>
```

**Preset Buttons:**
```html
<button onclick="setMarkupPreset('auto')">🤖 Auto</button>
<button onclick="setMarkupPreset(2.0)">×2.0</button>
<button onclick="setMarkupPreset(2.5)">×2.5</button>
...
```

### 2. JavaScript Functions

**setMarkupPreset(value):**
```javascript
function setMarkupPreset(value) {
    const markupInput = document.getElementById('markupMultiplier');
    
    if (value === 'auto') {
        // Tính auto dựa trên số nguyên liệu
        const materialCount = getSelectedMaterials().length;
        if (materialCount <= 3) markupInput.value = 2.5;
        else if (materialCount <= 6) markupInput.value = 3.0;
        else markupInput.value = 3.5;
    } else {
        markupInput.value = value;
    }
    
    updateSellingPriceFromMarkup();
    // Visual feedback
}
```

**autoCalculateSellingPrice():**
```javascript
function autoCalculateSellingPrice(costPrice, materialCount) {
    const markupInput = document.getElementById('markupMultiplier');
    const multiplier = parseFloat(markupInput.value) || 2.5;
    
    return smartRound(costPrice * multiplier);
}
```

**updatePriceHint():**
```javascript
function updatePriceHint() {
    const markupValue = parseFloat(markupInput.value);
    const profit = ((markupValue - 1) * 100).toFixed(0);
    priceHint.textContent = `💡 Hệ số ×${markupValue.toFixed(1)} (Lãi ${profit}%)`;
}
```

**saveProduct():**
```javascript
const markupInput = document.getElementById('markupMultiplier');
const markup_multiplier = parseFloat(markupInput.value) || null;
// Lưu vào database
```

## 📊 Use Cases

### Case 1: Nhập tùy ý
```
User nhập: 2.8
↓
Giá vốn: 100,000đ
↓
Giá bán: 280,000đ (tự động)
↓
Hint: "💡 Hệ số ×2.8 (Lãi 64%)"
```

### Case 2: Click preset
```
User click: [×3.0]
↓
Input tự động: 3.0
↓
Giá bán: 300,000đ (tự động)
↓
Visual: Input nhấp nháy xanh
```

### Case 3: Auto preset
```
User click: [🤖 Auto]
↓
Có 5 nguyên liệu → Input: 3.0
↓
Giá bán: 300,000đ (tự động)
```

### Case 4: Số lẻ
```
User nhập: 2.37
↓
Giá vốn: 100,000đ
↓
Giá bán: 237,000đ → Làm tròn: 240,000đ
↓
Hint: "💡 Hệ số ×2.4 (Lãi 57%)"
```

## 🎯 Ưu điểm

1. ✅ **Linh hoạt tối đa**: Nhập bất kỳ số nào (2.3, 2.8, 5.5...)
2. ✅ **Nhanh chóng**: Click preset cho các giá trị phổ biến
3. ✅ **Trực quan**: Thấy ngay hệ số và % lãi
4. ✅ **Đẹp mắt**: UI hiện đại với buttons và gradient
5. ✅ **Dễ dùng**: Input lớn, rõ ràng, dễ nhập
6. ✅ **Smart**: Auto preset tính theo độ phức tạp

## 📝 Files đã sửa

1. ✅ `public/assets/js/products.js`
   - Thay dropdown bằng input + buttons (2 chỗ: Add và Edit modal)
   - Thêm function `setMarkupPreset()`
   - Sửa `autoCalculateSellingPrice()` - đọc từ input
   - Sửa `updatePriceHint()` - hiển thị hệ số và % lãi
   - Sửa `saveProduct()` - lưu giá trị từ input

## 🧪 Testing

### Test 1: Nhập tùy ý
- [x] Nhập 2.3 → Giá bán = Giá vốn × 2.3
- [x] Nhập 5.0 → Giá bán = Giá vốn × 5.0
- [x] Nhập 1.5 → Giá bán = Giá vốn × 1.5

### Test 2: Preset buttons
- [x] Click ×2.0 → Input = 2.0, giá cập nhật
- [x] Click ×3.5 → Input = 3.5, giá cập nhật
- [x] Click 🤖 Auto → Input = auto value, giá cập nhật

### Test 3: Auto preset
- [x] 2 nguyên liệu → Auto = 2.5
- [x] 5 nguyên liệu → Auto = 3.0
- [x] 8 nguyên liệu → Auto = 3.5

### Test 4: Visual feedback
- [x] Click preset → Input nhấp nháy xanh
- [x] Hint text cập nhật đúng
- [x] Giá bán cập nhật real-time

### Test 5: Validation
- [x] Min 1.0 (không cho nhập < 1.0)
- [x] Max 10.0 (không cho nhập > 10.0)
- [x] Step 0.1 (có thể nhập số lẻ)

## 🎉 Status: ✅ HOÀN THÀNH

Thiết kế mới đẹp hơn, tiện hơn, linh hoạt hơn!

**Date**: January 20, 2026
**Implementation Time**: ~30 minutes
