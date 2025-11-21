# Toast Manager - Hướng dẫn sử dụng

## Tổng quan

Toast Manager là hệ thống quản lý thông báo thông minh, giải quyết vấn đề toast chồng lên nhau khi có nhiều thao tác liên tiếp.

## Tính năng chính

✅ **Tự động thay thế toast cũ**: Toast "đang xử lý" sẽ tự động được thay thế bởi toast "hoàn thành"  
✅ **Giới hạn số lượng**: Hiển thị tối đa 3 toast cùng lúc  
✅ **Animation mượt mà**: Hiệu ứng trượt đẹp mắt  
✅ **Đóng thủ công**: Có nút X để đóng toast  
✅ **Thời gian linh hoạt**: Toast quan trọng (error) hiển thị lâu hơn  

## Cách sử dụng cơ bản

### 1. Import vào HTML

```html
<script src="../assets/js/toast-manager.js"></script>
```

**Lưu ý**: Import `toast-manager.js` trước các file JS khác sử dụng `showToast()`

### 2. Sử dụng trong JavaScript

#### Cú pháp cơ bản

```javascript
showToast(message, type, duration, id)
```

**Tham số:**
- `message` (string, bắt buộc): Nội dung thông báo
- `type` (string, optional): Loại toast - `'success'`, `'error'`, `'warning'`, `'info'` (mặc định: `'success'`)
- `duration` (number, optional): Thời gian hiển thị (ms), `0` = không tự động ẩn (mặc định: tự động theo type)
- `id` (string, optional): ID để thay thế toast cũ

#### Ví dụ đơn giản

```javascript
// Toast thành công (3 giây)
showToast('Đã lưu thành công!', 'success');

// Toast lỗi (5 giây)
showToast('Có lỗi xảy ra!', 'error');

// Toast cảnh báo (4 giây)
showToast('Vui lòng kiểm tra lại', 'warning');

// Toast thông tin (3 giây)
showToast('Đang tải dữ liệu...', 'info');
```

## Sử dụng nâng cao - Toast với ID

### Vấn đề cần giải quyết

Khi xóa sản phẩm:
1. Hiển thị: "Đang xóa sản phẩm..."
2. Sau 2 giây: "Đã xóa thành công"
3. **Vấn đề**: Toast cũ chưa ẩn thì toast mới đã hiện → chồng lên nhau

### Giải pháp: Sử dụng ID

```javascript
async function deleteProduct(productId) {
    // Hiển thị toast "đang xử lý" với ID
    showToast('Đang xóa sản phẩm...', 'info', 0, 'delete-product');
    
    try {
        await fetch('/api/delete', { 
            method: 'POST',
            body: JSON.stringify({ id: productId })
        });
        
        // Toast "hoàn thành" với CÙNG ID sẽ thay thế toast cũ
        showToast('✅ Đã xóa thành công!', 'success', null, 'delete-product');
    } catch (error) {
        // Toast lỗi cũng thay thế toast cũ
        showToast('❌ Không thể xóa: ' + error.message, 'error', null, 'delete-product');
    }
}
```

**Kết quả**: Toast "Đang xóa..." sẽ **biến thành** toast "Đã xóa thành công" mượt mà, không bị chồng lên nhau!

## Ví dụ thực tế

### 1. Bulk Delete Orders

```javascript
async function bulkDelete() {
    const count = selectedOrderIds.size;
    
    // Toast đang xử lý (không tự động ẩn)
    showToast(`Đang xóa ${count} đơn hàng...`, 'info', 0, 'bulk-delete');
    
    // ... xử lý xóa ...
    
    // Toast hoàn thành (thay thế toast cũ)
    if (failCount === 0) {
        showToast(`✅ Đã xóa thành công ${successCount} đơn hàng`, 'success', null, 'bulk-delete');
    } else {
        showToast(`⚠️ Đã xóa ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-delete');
    }
}
```

### 2. Upload File với Progress

```javascript
async function uploadFile(file) {
    const uploadId = 'upload-' + Date.now();
    
    showToast('Đang upload file...', 'info', 0, uploadId);
    
    try {
        await uploadToServer(file);
        showToast('✅ Upload thành công!', 'success', null, uploadId);
    } catch (error) {
        showToast('❌ Upload thất bại', 'error', null, uploadId);
    }
}
```

### 3. Multiple Actions

```javascript
// Không cần ID - các toast khác nhau sẽ xếp chồng đẹp mắt
showToast('Đã lưu sản phẩm A', 'success');
showToast('Đã lưu sản phẩm B', 'success');
showToast('Đã lưu sản phẩm C', 'success');
// Tối đa 3 toast hiển thị, toast cũ nhất sẽ tự động ẩn
```

## Thời gian hiển thị mặc định

- `success`: 3 giây
- `warning`: 4 giây
- `error`: 5 giây (lâu hơn để người dùng đọc)
- `info`: 3 giây

## API nâng cao

### ToastManager Class

```javascript
// Xóa tất cả toast
toastManager.clearAll();

// Thay đổi số lượng toast tối đa
toastManager.maxToasts = 5;
```

## Migration từ code cũ

### Code cũ (có vấn đề)

```javascript
showToast('Đang xóa...', 'info');
// ... xử lý ...
showToast('Đã xóa thành công', 'success'); // ❌ Chồng lên toast cũ
```

### Code mới (đã fix)

```javascript
showToast('Đang xóa...', 'info', 0, 'delete-action');
// ... xử lý ...
showToast('Đã xóa thành công', 'success', null, 'delete-action'); // ✅ Thay thế toast cũ
```

## Responsive

Toast tự động responsive trên mobile:
- Desktop: Góc dưới bên phải
- Mobile: Full width, bottom

## Browser Support

- Chrome, Firefox, Safari, Edge (modern versions)
- IE11+ (với polyfills)

## Troubleshooting

### Toast không hiển thị?

1. Kiểm tra `toast-manager.js` đã được import chưa
2. Kiểm tra console có lỗi không
3. Đảm bảo import `toast-manager.js` **trước** các file JS khác

### Toast vẫn chồng lên nhau?

1. Sử dụng **cùng ID** cho toast "đang xử lý" và "hoàn thành"
2. Đảm bảo ID là string, không phải number

### Toast biến mất quá nhanh?

```javascript
// Tăng thời gian hiển thị
showToast('Message', 'success', 10000); // 10 giây
```

## Best Practices

✅ **DO**: Sử dụng ID cho các thao tác có 2 bước (đang xử lý → hoàn thành)  
✅ **DO**: Thêm emoji để toast sinh động hơn (✅, ❌, ⚠️, 📦)  
✅ **DO**: Giữ message ngắn gọn, dễ hiểu  

❌ **DON'T**: Hiển thị quá nhiều toast cùng lúc  
❌ **DON'T**: Sử dụng toast cho thông báo quan trọng (dùng modal thay thế)  
❌ **DON'T**: Toast quá dài (> 100 ký tự)  

## Changelog

### Version 1.0.0 (2024-11-21)
- ✨ Initial release
- ✨ Toast queue system
- ✨ Auto-replace với ID
- ✨ Responsive design
- ✨ 4 loại toast (success, error, warning, info)
