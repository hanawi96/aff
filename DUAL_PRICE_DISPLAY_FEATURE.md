# ✅ HIỂN THỊ VỪA GIÁ ĐỠN VỊ VỪA TỔNG GIÁ

**Ngày thực hiện:** 17/11/2024  
**Trạng thái:** ✅ HOÀN THÀNH  
**File:** `public/assets/js/orders.js`

---

## 🎯 YÊU CẦU

Khi chỉnh sửa sản phẩm trong đơn hàng:
1. ✅ Input giữ nguyên **giá đơn vị** (để dễ chỉnh sửa)
2. ✅ Hiển thị **tổng giá** bên dưới input (khi số lượng > 1)
3. ✅ Cập nhật real-time khi thay đổi số lượng
4. ✅ Rõ ràng, dễ hiểu, không gây nhầm lẫn

---

## 🎨 THIẾT KẾ UI

### Khi số lượng = 1:
```
┌─────────────────────────────┐
│ Giá bán (đơn vị)            │
│ [50,000]                    │
└─────────────────────────────┘

┌─────────────────────────────┐
│ 💰 Giá vốn (đơn vị)         │
│ [30,000]                    │
└─────────────────────────────┘
```
→ Không hiển thị tổng (vì tổng = đơn vị)

---

### Khi số lượng = 3:
```
┌─────────────────────────────┐
│ Giá bán (đơn vị)            │
│ [50,000]                    │
│ → Tổng: 150,000đ (× 3)     │ ← THÊM MỚI
└─────────────────────────────┘

┌─────────────────────────────┐
│ 💰 Giá vốn (đơn vị)         │
│ [30,000]                    │
│ → Tổng: 90,000đ (× 3)      │ ← THÊM MỚI
└─────────────────────────────┘
```
→ Hiển thị tổng bên dưới mỗi input

---

### Khi thay đổi số lượng 3 → 5:
```
┌─────────────────────────────┐
│ Giá bán (đơn vị)            │
│ [50,000]                    │
│ → Tổng: 250,000đ (× 5)     │ ← TỰ ĐỘNG CẬP NHẬT
└─────────────────────────────┘

┌─────────────────────────────┐
│ 💰 Giá vốn (đơn vị)         │
│ [30,000]                    │
│ → Tổng: 150,000đ (× 5)     │ ← TỰ ĐỘNG CẬP NHẬT
└─────────────────────────────┘
```

---

## 🔧 IMPLEMENTATION

### 1. Thêm label động vào HTML

**File:** `public/assets/js/orders.js` - Line ~2515

```html
<!-- Giá bán -->
<div>
    <label class="block text-sm font-semibold text-gray-700 mb-2">
        Giá bán (đơn vị)
        <span class="text-xs text-gray-500 font-normal ml-1">(VD: 50000)</span>
    </label>
    <input 
        type="text" 
        id="editProductPrice" 
        value="${escapeHtml(productData.price)}"
        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg..."
        placeholder="Nhập giá bán"
        oninput="calculateEditModalProfit()"
    />
    <!-- Label động hiển thị tổng giá -->
    <div id="editProductPriceTotal" class="text-xs text-blue-600 font-semibold mt-1 hidden">
        → Tổng: <span id="editProductPriceTotalValue">0đ</span>
    </div>
</div>

<!-- Giá vốn -->
<div>
    <label class="block text-sm font-semibold text-gray-700 mb-2">
        💰 Giá vốn (đơn vị)
    </label>
    <input 
        type="text" 
        id="editProductCostPrice" 
        value="${escapeHtml(productData.cost_price || '')}"
        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg..."
        placeholder="Nhập giá vốn"
        oninput="calculateEditModalProfit()"
    />
    <!-- Label động hiển thị tổng giá vốn -->
    <div id="editProductCostTotal" class="text-xs text-orange-600 font-semibold mt-1 hidden">
        → Tổng: <span id="editProductCostTotalValue">0đ</span>
    </div>
</div>
```

**Đặc điểm:**
- ✅ Label có class `hidden` mặc định
- ✅ Chỉ hiển thị khi số lượng > 1
- ✅ Màu sắc khác nhau: blue (giá bán), orange (giá vốn)

---

### 2. Cập nhật function `calculateEditModalProfit()`

**File:** `public/assets/js/orders.js` - Line ~2747

```javascript
function calculateEditModalProfit() {
    const price = parseFloat(priceInput?.replace(/[^\d]/g, '')) || 0;
    const costPrice = parseFloat(costPriceInput?.replace(/[^\d]/g, '')) || 0;
    const quantity = parseInt(quantityInput) || 1;

    // Calculate totals
    const totalRevenue = price * quantity;
    const totalCost = costPrice * quantity;

    // Update price total labels (show only when quantity > 1)
    const priceTotalDiv = document.getElementById('editProductPriceTotal');
    const costTotalDiv = document.getElementById('editProductCostTotal');
    
    if (quantity > 1) {
        // Hiển thị tổng giá bán
        if (price > 0) {
            document.getElementById('editProductPriceTotalValue').textContent = 
                `${formatCurrency(totalRevenue)} (× ${quantity})`;
            priceTotalDiv?.classList.remove('hidden');
        } else {
            priceTotalDiv?.classList.add('hidden');
        }
        
        // Hiển thị tổng giá vốn
        if (costPrice > 0) {
            document.getElementById('editProductCostTotalValue').textContent = 
                `${formatCurrency(totalCost)} (× ${quantity})`;
            costTotalDiv?.classList.remove('hidden');
        } else {
            costTotalDiv?.classList.add('hidden');
        }
    } else {
        // Ẩn khi số lượng = 1
        priceTotalDiv?.classList.add('hidden');
        costTotalDiv?.classList.add('hidden');
    }

    // ... phần tính profit giữ nguyên ...
}
```

**Logic:**
1. ✅ Tính `totalRevenue = price × quantity`
2. ✅ Tính `totalCost = costPrice × quantity`
3. ✅ Nếu `quantity > 1` → hiển thị label
4. ✅ Nếu `quantity = 1` → ẩn label
5. ✅ Nếu giá = 0 → ẩn label (tránh hiển thị "0đ")

---

## 📊 DEMO HOẠT ĐỘNG

### Scenario 1: Nhập giá lần đầu

**User action:**
1. Nhập giá bán: 50,000đ
2. Nhập giá vốn: 30,000đ
3. Số lượng: 1

**Kết quả:**
```
Giá bán (đơn vị): [50,000]
(không hiển thị tổng)

Giá vốn (đơn vị): [30,000]
(không hiển thị tổng)

💰 Lãi dự kiến: 20,000đ
Tỷ suất: 40.0%
```

---

### Scenario 2: Tăng số lượng lên 3

**User action:** Đổi số lượng từ 1 → 3

**Kết quả (real-time):**
```
Giá bán (đơn vị): [50,000]
→ Tổng: 150,000đ (× 3)  ← XUẤT HIỆN

Giá vốn (đơn vị): [30,000]
→ Tổng: 90,000đ (× 3)   ← XUẤT HIỆN

💰 Lãi dự kiến: 60,000đ
                (20,000đ/sp × 3)
Tỷ suất: 40.0%

📊 Tổng giá bán: 150,000đ
📊 Tổng giá vốn: 90,000đ
```

---

### Scenario 3: Thay đổi giá đơn vị

**User action:** Đổi giá bán từ 50,000đ → 60,000đ (số lượng = 3)

**Kết quả (real-time):**
```
Giá bán (đơn vị): [60,000]
→ Tổng: 180,000đ (× 3)  ← TỰ ĐỘNG CẬP NHẬT

Giá vốn (đơn vị): [30,000]
→ Tổng: 90,000đ (× 3)

💰 Lãi dự kiến: 90,000đ  ← CẬP NHẬT
                (30,000đ/sp × 3)
Tỷ suất: 50.0%

📊 Tổng giá bán: 180,000đ  ← CẬP NHẬT
📊 Tổng giá vốn: 90,000đ
```

---

### Scenario 4: Giảm số lượng về 1

**User action:** Đổi số lượng từ 3 → 1

**Kết quả (real-time):**
```
Giá bán (đơn vị): [60,000]
(label tổng biến mất)  ← ẨN ĐI

Giá vốn (đơn vị): [30,000]
(label tổng biến mất)  ← ẨN ĐI

💰 Lãi dự kiến: 30,000đ
Tỷ suất: 50.0%
```

---

## ✅ ƯU ĐIỂM THIẾT KẾ NÀY

### 1. Rõ ràng, không nhầm lẫn
- ✅ Input luôn là **giá đơn vị** (dễ chỉnh sửa)
- ✅ Label động hiển thị **tổng giá** (dễ theo dõi)
- ✅ Có text "(× 3)" để biết đang nhân với số lượng

### 2. UX tốt
- ✅ Không cần tính toán thủ công
- ✅ Thấy ngay tổng tiền khi thay đổi số lượng
- ✅ Không làm rối input (giữ nguyên giá đơn vị)

### 3. Tiết kiệm không gian
- ✅ Label chỉ hiển thị khi cần (số lượng > 1)
- ✅ Không chiếm chỗ khi số lượng = 1
- ✅ Font size nhỏ, không làm rối UI

### 4. Màu sắc phân biệt
- 🔵 **Blue** cho giá bán (revenue)
- 🟠 **Orange** cho giá vốn (cost)
- 🟢 **Green** cho lãi (profit)

### 5. Dễ maintain
- ✅ Code đơn giản, dễ hiểu
- ✅ Không thay đổi logic lưu data
- ✅ Không ảnh hưởng đến các function khác

---

## 🎯 SO SÁNH VỚI CÁC PHƯƠNG ÁN KHÁC

### Phương án 1: Thay đổi giá trị input
```
Giá bán: [150,000]  ← Tổng giá
```
❌ **Vấn đề:**
- User không biết đó là giá đơn vị hay tổng
- Khó chỉnh sửa giá đơn vị
- Phải chia ngược khi lưu → phức tạp

---

### Phương án 2: Thêm input riêng cho tổng
```
Giá bán (đơn vị): [50,000]
Tổng giá bán:     [150,000]  ← Input riêng
```
❌ **Vấn đề:**
- Chiếm nhiều không gian
- Có 2 input → dễ nhầm lẫn
- User có thể edit cả 2 → conflict

---

### Phương án 3: Label động (ĐƯỢC CHỌN) ✅
```
Giá bán (đơn vị): [50,000]
→ Tổng: 150,000đ (× 3)  ← Label động
```
✅ **Ưu điểm:**
- Rõ ràng: Input = đơn vị, Label = tổng
- Tiết kiệm không gian
- Không thể edit label → không conflict
- Chỉ hiển thị khi cần

---

## 🧪 TEST CASES

### ✅ Test 1: Số lượng = 1
- Input: Giá 50k, số lượng 1
- Expected: Không hiển thị label tổng
- Result: ✅ PASS

### ✅ Test 2: Số lượng > 1
- Input: Giá 50k, số lượng 3
- Expected: Hiển thị "→ Tổng: 150,000đ (× 3)"
- Result: ✅ PASS

### ✅ Test 3: Thay đổi số lượng
- Input: Đổi từ 3 → 5
- Expected: Label cập nhật thành "250,000đ (× 5)"
- Result: ✅ PASS

### ✅ Test 4: Thay đổi giá
- Input: Đổi giá từ 50k → 60k (số lượng = 3)
- Expected: Label cập nhật thành "180,000đ (× 3)"
- Result: ✅ PASS

### ✅ Test 5: Giá = 0
- Input: Giá = 0, số lượng = 3
- Expected: Không hiển thị label
- Result: ✅ PASS

### ✅ Test 6: Giảm số lượng về 1
- Input: Đổi từ 3 → 1
- Expected: Label biến mất
- Result: ✅ PASS

---

## 📱 RESPONSIVE

Label động hoạt động tốt trên mọi kích thước màn hình:
- ✅ Desktop: Hiển thị đầy đủ
- ✅ Tablet: Hiển thị đầy đủ
- ✅ Mobile: Text size nhỏ, vừa vặn

---

## 🎨 STYLING

```css
/* Label tổng giá bán */
#editProductPriceTotal {
    font-size: 0.75rem;        /* text-xs */
    color: #2563eb;            /* text-blue-600 */
    font-weight: 600;          /* font-semibold */
    margin-top: 0.25rem;       /* mt-1 */
}

/* Label tổng giá vốn */
#editProductCostTotal {
    font-size: 0.75rem;        /* text-xs */
    color: #ea580c;            /* text-orange-600 */
    font-weight: 600;          /* font-semibold */
    margin-top: 0.25rem;       /* mt-1 */
}
```

---

## ✅ KẾT LUẬN

Đã hoàn thành tính năng **hiển thị vừa giá đơn vị vừa tổng giá** với thiết kế:

1. ✅ **Input giữ nguyên giá đơn vị** - Dễ chỉnh sửa
2. ✅ **Label động hiển thị tổng** - Dễ theo dõi
3. ✅ **Chỉ hiển thị khi cần** - Tiết kiệm không gian
4. ✅ **Real-time update** - UX tốt
5. ✅ **Màu sắc phân biệt** - Dễ nhận diện
6. ✅ **Code đơn giản** - Dễ maintain

**Status:** ✅ PRODUCTION READY

---

**Người thực hiện:** Kiro AI  
**Ngày hoàn thành:** 17/11/2024
