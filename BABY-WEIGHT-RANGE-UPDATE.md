# 🎯 Cập Nhật: Hỗ Trợ Chọn Cân Nặng Theo Khoảng

## ✅ Đã Hoàn Thành

### 🔄 Thay Đổi Chính

**Trước đây:** Modal chỉ có các nút chọn cân nặng đơn lẻ
- 3kg, 4kg, 5kg, 6kg, 7kg, 8kg... (13 nút)

**Bây giờ:** Modal có các nút chọn theo khoảng + nút "Nhập khác"
- ❤️ Chưa sinh
- 3-4kg, 4-6kg, 6-8kg, 8-10kg, 10-12kg, 12-15kg (6 nút)
- ➕ Nhập khác (focus vào ô input)

### 📊 Lợi Ích

1. **Giao diện gọn gàng hơn:** Giảm từ 13 nút xuống còn 7 nút
2. **Dễ chọn hơn:** Khách hàng chọn theo khoảng thay vì phải biết chính xác
3. **Linh hoạt:** Vẫn có thể nhập cân nặng cụ thể nếu cần
4. **UX tốt hơn:** Nút "Nhập khác" tự động focus vào ô input

## 📁 Files Đã Sửa

### 1. `public/shop/assets/js/shared/components/baby-weight-modal.js`

**Thay đổi:**

#### a) Hàm `renderWeightOptions()` - Render nút theo khoảng

```javascript
// Trước:
weights = ['unborn', 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Sau:
weights = [
    { label: '❤️ Chưa sinh', value: 'unborn', icon: true },
    { label: '3-4kg', value: '3-4kg' },
    { label: '4-6kg', value: '4-6kg' },
    { label: '6-8kg', value: '6-8kg' },
    { label: '8-10kg', value: '8-10kg' },
    { label: '10-12kg', value: '10-12kg' },
    { label: '12-15kg', value: '12-15kg' }
];
```

#### b) Thêm nút "Nhập khác"

```javascript
+ `<button type="button" class="weight-btn weight-btn-custom" data-custom="true">
    <svg>...</svg>
    Nhập khác
</button>`;
```

#### c) Hàm `focusCustomInput()` - Focus vào ô input

```javascript
focusCustomInput() {
    const customInput = document.getElementById('customWeightInput');
    if (customInput) {
        customInput.focus();
        customInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
```

#### d) Hàm `selectWeight()` - Xử lý cân nặng theo khoảng

```javascript
// Xử lý cả single weight và range
if (weight.includes('-')) {
    // Range: use upper bound (e.g., "6-8kg" → 8kg)
    const match = weight.match(/(\d+)-(\d+)kg/);
    if (match) {
        weightKg = parseInt(match[2]); // Upper bound
    }
}
```

#### e) Cập nhật label và validation

```javascript
// Baby: "Hoặc nhập cân nặng khác (16kg trở lên):"
// Adult: "Hoặc nhập cân nặng khác (96kg trở lên):"

// Custom input validation:
const minWeight = isAdult ? 96 : 16; // Adult: 96kg+, Baby: 16kg+
const maxWeight = 120; // Max for both
```

### 2. `public/shop/styles.css`

**Thêm CSS mới:**

#### a) Style cho nút "Chưa sinh" (icon trái tim)

```css
.weight-btn-icon {
    background: linear-gradient(135deg, #ffeef0, #ffe0e5);
    border-color: rgba(255, 105, 135, 0.3);
}

.weight-btn-icon:hover {
    background: linear-gradient(135deg, #ffe0e5, #ffd0d8);
    border-color: #ff6987;
}

.weight-btn-icon.selected {
    background: linear-gradient(135deg, #ff6987, #ff4d7a);
    border-color: transparent;
}
```

#### b) Style cho nút "Nhập khác"

```css
.weight-btn-custom {
    background: linear-gradient(135deg, #f0f4f8, #e8eef5);
    border: 2px dashed rgba(100, 150, 200, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #4a6fa5;
}

.weight-btn-custom:hover {
    background: linear-gradient(135deg, #e8eef5, #dce6f0);
    border-color: #4a6fa5;
    transform: translateY(-2px);
}
```

## 🎨 Giao Diện Mới

### Cho Sản Phẩm Bé

```
┌─────────────────────────────────────────┐
│  ❤️ Chưa sinh  │  3-4kg   │  4-6kg   │
├─────────────────────────────────────────┤
│   6-8kg      │  8-10kg  │  10-12kg  │
├─────────────────────────────────────────┤
│  12-15kg     │  ➕ Nhập khác          │
└─────────────────────────────────────────┘
```

### Cho Sản Phẩm Người Lớn

```
┌─────────────────────────────────────────┐
│  35-45kg  │  45-55kg  │  55-65kg  │
├─────────────────────────────────────────┤
│  65-75kg  │  75-85kg  │  85-95kg  │
├─────────────────────────────────────────┤
│           ➕ Nhập khác                  │
└─────────────────────────────────────────┘
```

## 🧪 Test

### Test Case 1: Chọn Khoảng Cân Nặng

1. Mở modal "Mua ngay" cho sản phẩm bé
2. Click nút "6-8kg"
3. ✅ Nút được highlight
4. ✅ Nếu > 15kg → Hiển thị phụ phí (tính theo upper bound = 8kg)
5. Click "Xác nhận"
6. ✅ Sản phẩm được thêm vào giỏ với size "6-8kg"

### Test Case 2: Nút "Nhập Khác"

1. Mở modal
2. Click nút "➕ Nhập khác"
3. ✅ Ô input được focus tự động
4. ✅ Trang scroll đến ô input
5. Nhập "18"
6. ✅ Nút "Xác nhận" được enable
7. ✅ Hiển thị phụ phí (nếu > 15kg)

### Test Case 3: Nút "Chưa Sinh"

1. Mở modal
2. Click "❤️ Chưa sinh"
3. ✅ Nút có màu hồng đặc biệt
4. ✅ Không có phụ phí
5. Click "Xác nhận"
6. ✅ Sản phẩm có size "unborn"

### Test Case 4: Validation Custom Input

**Cho sản phẩm bé:**
- Nhập 15 → ❌ Không cho phép (< 16kg)
- Nhập 16 → ✅ OK
- Nhập 50 → ✅ OK
- Nhập 121 → ❌ Không cho phép (> 120kg)

**Cho sản phẩm người lớn:**
- Nhập 95 → ❌ Không cho phép (< 96kg)
- Nhập 96 → ✅ OK
- Nhập 120 → ✅ OK
- Nhập 121 → ❌ Không cho phép (> 120kg)

## 💡 Logic Tính Phụ Phí

### Với Khoảng Cân Nặng

Sử dụng **upper bound** (giới hạn trên) để tính phụ phí:

```javascript
// Ví dụ: "6-8kg"
const match = weight.match(/(\d+)-(\d+)kg/);
const upperBound = parseInt(match[2]); // 8kg

// Kiểm tra phụ phí
if (upperBound > 15) {
    // Tính phụ phí 15%
}
```

### Ví Dụ Cụ Thể

| Khoảng chọn | Upper bound | Phụ phí? |
|-------------|-------------|----------|
| 3-4kg       | 4kg         | ❌ Không |
| 6-8kg       | 8kg         | ❌ Không |
| 12-15kg     | 15kg        | ❌ Không |
| 16kg        | 16kg        | ✅ Có    |
| 18kg        | 18kg        | ✅ Có    |

## 📝 Lưu Ý

1. **Backward Compatible:** Vẫn hỗ trợ cân nặng đơn lẻ nếu cần (qua custom input)
2. **Database:** Lưu đúng format vào database (ví dụ: "6-8kg")
3. **Display:** Hiển thị đúng format trong giỏ hàng và đơn hàng
4. **Responsive:** Hoạt động tốt trên mobile (grid 3 cột)

## 🚀 Triển Khai

Không cần thay đổi backend, chỉ cần:
1. Deploy frontend mới
2. Test trên production
3. Kiểm tra giỏ hàng và đơn hàng hiển thị đúng

---

**Phiên bản:** 1.0.0  
**Ngày cập nhật:** 2025-01-27  
**Developer:** Kiro AI
