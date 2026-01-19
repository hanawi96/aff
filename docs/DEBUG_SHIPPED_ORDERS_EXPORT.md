# Debug: Shipped Orders Export Confirmation

## 🐛 Vấn đề đã fix

### Lỗi ban đầu:
- ❌ Dùng sai tên status: `'đã gửi hàng'` thay vì `'shipped'`
- ❌ Modal không hiển thị khi có đơn đã gửi hàng

### Fix đã áp dụng:
1. ✅ Sửa status check: `o.status === 'shipped'`
2. ✅ Thêm debug logs để kiểm tra

---

## 🔍 Cách kiểm tra

### Bước 1: Mở Console (F12)
Khi bạn click Export, sẽ thấy logs:

```
🔍 Bulk Export Debug:
  Total selected: 5
  Shipped orders: 2
  Selected orders statuses: [
    { id: 1, status: 'pending' },
    { id: 2, status: 'shipped' },
    { id: 3, status: 'pending' },
    { id: 4, status: 'shipped' },
    { id: 5, status: 'pending' }
  ]
  ✅ Showing confirmation modal
```

### Bước 2: Kiểm tra Modal
Nếu có shipped orders, sẽ thấy:

```
📢 showShippedOrdersConfirmModal called
  Shipped count: 2
  All selected orders: 5
  Modal element: <div id="shippedOrdersConfirmModal">...</div>
  Count element: <span id="shippedOrdersCount">...</span>
  ✅ Modal shown, classes: fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fadeIn
```

---

## ⚠️ Nếu vẫn không hoạt động

### Kiểm tra 1: Status trong database
Mở Console và chạy:

```javascript
// Kiểm tra status của đơn hàng
console.log(allOrdersData.map(o => ({ id: o.id, status: o.status })));
```

**Kết quả mong đợi:**
```javascript
[
  { id: 1, status: 'pending' },
  { id: 2, status: 'shipped' },  // ← Phải là 'shipped'
  { id: 3, status: 'delivered' },
  ...
]
```

**Nếu thấy status khác** (ví dụ: `'đã gửi hàng'`, `'Đã gửi hàng'`):
→ Cần update lại code để match với status thực tế

---

### Kiểm tra 2: Modal element tồn tại
Mở Console và chạy:

```javascript
// Kiểm tra modal có trong DOM không
const modal = document.getElementById('shippedOrdersConfirmModal');
console.log('Modal:', modal);

const count = document.getElementById('shippedOrdersCount');
console.log('Count element:', count);
```

**Kết quả mong đợi:**
```
Modal: <div id="shippedOrdersConfirmModal">...</div>
Count element: <span id="shippedOrdersCount">...</span>
```

**Nếu thấy `null`:**
→ Modal chưa được thêm vào HTML hoặc ID bị sai

---

### Kiểm tra 3: Functions có trong global scope
Mở Console và chạy:

```javascript
// Kiểm tra functions
console.log('bulkExport:', typeof bulkExport);
console.log('showShippedOrdersConfirmModal:', typeof showShippedOrdersConfirmModal);
console.log('continueExportAll:', typeof continueExportAll);
console.log('skipShippedOrders:', typeof skipShippedOrders);
```

**Kết quả mong đợi:**
```
bulkExport: function
showShippedOrdersConfirmModal: function
continueExportAll: function
skipShippedOrders: function
```

**Nếu thấy `undefined`:**
→ File `orders-bulk-actions.js` chưa được load hoặc có lỗi syntax

---

### Kiểm tra 4: Cache browser
Nếu đã fix code nhưng vẫn không hoạt động:

1. **Hard refresh:** Ctrl + Shift + R (Windows) hoặc Cmd + Shift + R (Mac)
2. **Clear cache:** F12 → Network tab → Disable cache (checkbox)
3. **Reload page:** F5

---

## 📝 Status mapping trong hệ thống

| Database Value | Display Label | English |
|---------------|---------------|---------|
| `'pending'` | Chờ xử lý | Pending |
| `'shipped'` | Đã gửi hàng | Shipped |
| `'in_transit'` | Đang vận chuyển | In Transit |
| `'delivered'` | Đã giao hàng | Delivered |
| `'cancelled'` | Đã hủy | Cancelled |

**QUAN TRỌNG:** Code phải dùng database value (`'shipped'`), KHÔNG phải display label (`'Đã gửi hàng'`)

---

## 🧪 Test Case

### Test thủ công:

1. **Chọn 3 đơn hàng:**
   - 1 đơn status = `'pending'`
   - 1 đơn status = `'shipped'`
   - 1 đơn status = `'delivered'`

2. **Click Export**

3. **Kết quả mong đợi:**
   - Console log: `Shipped orders: 1`
   - Modal hiển thị: "Đã có 1 đơn ở trạng thái đã gửi hàng"
   - 2 buttons: "Bỏ qua các đơn đã gửi" và "Tiếp tục"

4. **Click "Bỏ qua các đơn đã gửi":**
   - Toast: "Đang export 2 đơn hàng (bỏ qua 1 đơn đã gửi)"
   - Export chỉ 2 đơn (pending + delivered)

5. **Click "Tiếp tục":**
   - Export tất cả 3 đơn

---

## 🔧 Quick Fix Commands

### Nếu cần xóa cache và reload:

```javascript
// Chạy trong Console
location.reload(true);
```

### Nếu cần test modal thủ công:

```javascript
// Chạy trong Console
showShippedOrdersConfirmModal(3, [
  { id: 1, status: 'pending' },
  { id: 2, status: 'shipped' },
  { id: 3, status: 'shipped' }
]);
```

### Nếu cần kiểm tra modal CSS:

```javascript
// Chạy trong Console
const modal = document.getElementById('shippedOrdersConfirmModal');
console.log('Hidden:', modal.classList.contains('hidden'));
console.log('Z-index:', window.getComputedStyle(modal).zIndex);
console.log('Display:', window.getComputedStyle(modal).display);
```

---

## ✅ Checklist

Trước khi báo lỗi, hãy kiểm tra:

- [ ] Hard refresh browser (Ctrl + Shift + R)
- [ ] Console không có lỗi JavaScript
- [ ] File `orders-bulk-actions.js` đã được load (check Network tab)
- [ ] Modal element tồn tại trong DOM
- [ ] Status trong database là `'shipped'` (không phải `'đã gửi hàng'`)
- [ ] Functions có trong global scope
- [ ] Debug logs hiển thị trong Console

---

## 📞 Support

Nếu vẫn không hoạt động sau khi check tất cả:

1. Copy toàn bộ Console logs
2. Screenshot modal (nếu có)
3. Gửi kèm thông tin:
   - Browser version
   - Số đơn đã chọn
   - Status của các đơn đó
