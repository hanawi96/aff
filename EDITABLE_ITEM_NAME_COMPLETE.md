# Cho phép chỉnh sửa Mã nguyên liệu (item_name) ✅

## Vấn đề
- User cần reset lại toàn bộ dữ liệu nguyên liệu vì dữ liệu demo trước đó không đúng ý
- Cần có khả năng đổi `item_name` (mã nguyên liệu) trong modal edit
- Khi đổi `item_name`, cần cập nhật tất cả tham chiếu trong bảng `product_materials`

## Giải pháp
Cho phép chỉnh sửa `item_name` và tự động cập nhật tất cả tham chiếu.

---

## Thay đổi Frontend

### 1. Modal Edit Material
**File**: `public/assets/js/materials.js`

**Trước:**
```html
<input type="text" id="materialItemName" value="..." readonly class="bg-gray-50">
<p class="text-xs">Mã này không thể thay đổi</p>
```

**Sau:**
```html
<input type="text" id="materialItemName" value="..." required 
       pattern="[a-z0-9_]+" class="focus:ring-2">
<p class="text-xs">Chỉ dùng chữ thường, số và dấu gạch dưới (_)</p>
```

### 2. Cảnh báo nâng cao
Thêm thông tin về việc đổi mã nguyên liệu:
```
• Thay đổi giá sẽ tự động cập nhật giá vốn cho X sản phẩm
• Thay đổi mã nguyên liệu sẽ cập nhật tất cả tham chiếu trong công thức sản phẩm
```

### 3. Toast thông báo
Hiển thị thông báo khi đổi mã thành công:
```javascript
if (data.item_name_changed && data.affected_products > 0) {
    showToast(`Đã cập nhật mã nguyên liệu trong ${data.affected_products} công thức sản phẩm`, 'info');
}
```

---

## Thay đổi Backend

### updateMaterial() - Xử lý đổi tên
**File**: `src/services/materials/material-service.js`

#### Logic mới:
1. **Kiểm tra material cũ tồn tại** (dùng `old_item_name`)
2. **Nếu đổi tên**: Kiểm tra tên mới chưa tồn tại
3. **Sử dụng batch transaction** để đảm bảo atomic:
   - Cập nhật `cost_config` với `item_name` mới
   - Cập nhật tất cả `product_materials.material_name` từ tên cũ → tên mới
4. **Trả về**:
   - `affected_products`: Số sản phẩm bị ảnh hưởng
   - `item_name_changed`: Boolean cho biết có đổi tên không

#### Code:
```javascript
// If item_name is changing, check if new name already exists
if (oldItemName !== newItemName) {
    const duplicate = await env.DB.prepare(`
        SELECT id FROM cost_config WHERE item_name = ?
    `).bind(newItemName).first();

    if (duplicate) {
        return jsonResponse({
            success: false,
            error: 'Material with this item_name already exists'
        }, 400, corsHeaders);
    }
}

// Use batch to update material and all references atomically
const statements = [];

// Update the material itself
statements.push(
    env.DB.prepare(`
        UPDATE cost_config
        SET item_name = ?, display_name = ?, item_cost = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE item_name = ?
    `).bind(newItemName, data.display_name, parseFloat(data.item_cost), data.category_id, oldItemName)
);

// If item_name changed, update all product_materials references
if (oldItemName !== newItemName) {
    statements.push(
        env.DB.prepare(`
            UPDATE product_materials
            SET material_name = ?
            WHERE material_name = ?
        `).bind(newItemName, oldItemName)
    );
}

// Execute all updates atomically
await env.DB.batch(statements);
```

---

## Tính năng

### ✅ Cho phép đổi mã nguyên liệu
- Input `item_name` không còn readonly
- Validation: chỉ chữ thường, số, dấu gạch dưới
- Required field

### ✅ Tự động cập nhật tham chiếu
- Khi đổi `item_name`, tất cả `product_materials.material_name` được cập nhật
- Sử dụng batch transaction để đảm bảo atomic (không bị lỗi giữa chừng)

### ✅ Kiểm tra trùng lặp
- Không cho phép đổi sang `item_name` đã tồn tại
- Hiển thị lỗi rõ ràng: "Material with this item_name already exists"

### ✅ Thông báo đầy đủ
- Toast khi lưu thành công
- Toast khi cập nhật giá vốn sản phẩm
- Toast khi cập nhật mã trong công thức sản phẩm

---

## Use Case: Reset dữ liệu

User có thể:
1. Mở modal edit material
2. Đổi `item_name` từ `bi_bac_s999` → `bi_bac_new`
3. Đổi `display_name` thành tên mới
4. Lưu → Hệ thống tự động:
   - Cập nhật `cost_config.item_name`
   - Cập nhật tất cả `product_materials.material_name` 
   - Cập nhật giá vốn sản phẩm (trigger tự động)
   - Hiển thị thông báo số sản phẩm bị ảnh hưởng

---

## Files Modified

1. `public/assets/js/materials.js` - Cho phép edit item_name, cảnh báo, toast
2. `src/services/materials/material-service.js` - Logic cập nhật item_name + references

---

## Status: ✅ COMPLETE

User giờ có thể:
- ✅ Đổi mã nguyên liệu (`item_name`) trong modal edit
- ✅ Hệ thống tự động cập nhật tất cả tham chiếu trong công thức sản phẩm
- ✅ Validation đầy đủ (format, trùng lặp)
- ✅ Thông báo rõ ràng về số sản phẩm bị ảnh hưởng
- ✅ Transaction atomic (không bị lỗi giữa chừng)

**Không cần deploy** (theo yêu cầu user).
