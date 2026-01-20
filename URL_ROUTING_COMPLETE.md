# URL Routing cho Tabs - Complete ✅

## Tính năng
Khi chuyển tab trong trang nguyên liệu, URL sẽ được cập nhật để có thể:
- ✅ Chia sẻ link trực tiếp đến tab cụ thể
- ✅ Reload trang mà không mất tab đang chọn
- ✅ Sử dụng nút Back/Forward của browser

---

## Cách hoạt động

### 1. URL Hash
- Tab "Danh sách nguyên liệu": `materials.html` hoặc `materials.html#materials`
- Tab "Danh mục": `materials.html#categories`

### 2. Khi load trang
```javascript
// Đọc hash từ URL
const hash = window.location.hash.slice(1); // Remove #
if (hash === 'categories') {
    switchTab('categories');
} else {
    switchTab('materials'); // Default
}
```

### 3. Khi chuyển tab
```javascript
function switchTab(tabName, updateURL = true) {
    // Update URL hash
    if (updateURL) {
        if (tabName === 'categories') {
            window.history.pushState(null, '', '#categories');
        } else {
            window.history.pushState(null, '', '#materials');
        }
    }
    
    // ... rest of tab switching logic
}
```

### 4. Browser Back/Forward
```javascript
// Listen for hash changes
window.addEventListener('hashchange', handleHashChange);

function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === 'categories') {
        switchTab('categories', false); // Don't update URL again
    } else {
        switchTab('materials', false);
    }
}
```

---

## Use Cases

### 1. Chia sẻ link
User có thể copy URL `materials.html#categories` và gửi cho người khác.
Khi người khác mở link → tự động mở tab "Danh mục".

### 2. Reload trang
User đang ở tab "Danh mục" → nhấn F5 → vẫn ở tab "Danh mục".

### 3. Browser navigation
User chuyển từ tab "Danh sách" → "Danh mục" → nhấn nút Back → quay lại tab "Danh sách".

---

## Implementation Details

### Functions Added/Modified

1. **`initializeTabFromURL()`** - NEW
   - Đọc hash từ URL khi load trang
   - Gọi `switchTab()` với tab tương ứng

2. **`handleHashChange()`** - NEW
   - Listen sự kiện `hashchange` (browser back/forward)
   - Gọi `switchTab()` với `updateURL = false` để tránh loop

3. **`switchTab(tabName, updateURL = true)`** - MODIFIED
   - Thêm parameter `updateURL` (default = true)
   - Cập nhật URL hash khi `updateURL = true`
   - Sử dụng `pushState()` để update URL mà không reload trang

### Event Listeners

```javascript
document.addEventListener('DOMContentLoaded', function () {
    loadCategories();
    loadMaterials();
    initializeTabFromURL(); // ✅ NEW
    window.addEventListener('hashchange', handleHashChange); // ✅ NEW
});
```

---

## Technical Notes

### Tại sao dùng `pushState()` thay vì `location.hash`?

```javascript
// ❌ BAD: Triggers hashchange event → infinite loop
window.location.hash = '#categories';

// ✅ GOOD: Updates URL without triggering hashchange
window.history.pushState(null, '', '#categories');
```

### Tại sao cần parameter `updateURL`?

Khi browser back/forward trigger `hashchange`:
- Nếu không có `updateURL = false` → `switchTab()` sẽ gọi `pushState()` lại
- Tạo thêm history entry mới → user phải nhấn back nhiều lần

Với `updateURL = false`:
- `switchTab()` chỉ update UI, không touch URL
- Browser history hoạt động đúng

---

## Files Modified

1. `public/assets/js/materials.js`
   - Added: `initializeTabFromURL()`
   - Added: `handleHashChange()`
   - Modified: `switchTab(tabName, updateURL = true)`
   - Modified: DOMContentLoaded event listener

---

## Testing Checklist

- [x] Load `materials.html` → mở tab "Danh sách nguyên liệu"
- [x] Load `materials.html#categories` → mở tab "Danh mục"
- [x] Click tab "Danh mục" → URL thành `#categories`
- [x] Click tab "Danh sách" → URL thành `#materials`
- [x] Ở tab "Danh mục" → F5 → vẫn ở tab "Danh mục"
- [x] Chuyển tab → nhấn Back → quay lại tab trước
- [x] Copy URL `#categories` → mở tab mới → đúng tab

---

## Status: ✅ COMPLETE

URL routing hoạt động hoàn hảo với:
- ✅ Deep linking (shareable URLs)
- ✅ Page reload persistence
- ✅ Browser back/forward support
- ✅ No infinite loops
- ✅ Clean URL updates

**Không cần deploy** (theo yêu cầu user).
