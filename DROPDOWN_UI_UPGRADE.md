# Nâng cấp UI Dropdown trong Hệ thống

## Tổng quan
Đã cập nhật tất cả dropdown trong hệ thống theo thiết kế mới với:
- Icon tròn màu sắc rõ ràng hơn (3x3 thay vì 2x2)
- Checkmark (✓) lớn hơn và rõ ràng hơn (5x5 thay vì 4x4)
- Padding và spacing tốt hơn (px-4 py-3 thay vì px-3 py-2)
- Font size lớn hơn (text-base thay vì text-sm)
- Background highlight cho item đang chọn (bg-blue-50)

## Các file đã cập nhật

### 1. Orders Page (public/admin/orders.html + public/assets/js/orders.js)
**Dropdown đã cập nhật:**
- ✅ Status Filter (Tất cả trạng thái, Chờ xử lý, Đang xử lý, Đã gửi hàng, Đã giao hàng, Đã hủy)
- ✅ Date Filter (Tất cả thời gian, Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua)
- ✅ Inline Status Dropdown (trong bảng đơn hàng - click vào badge trạng thái)

**Thay đổi:**
```javascript
// Trước:
class="w-full px-3 py-2 flex items-center gap-2"
<div class="w-2 h-2 rounded-full bg-${s.color}-500"></div>
<span class="text-sm text-gray-700">${s.label}</span>
<svg class="w-4 h-4 text-${s.color}-600 ml-auto">

// Sau:
class="w-full px-4 py-3 flex items-center gap-3"
<div class="w-3 h-3 rounded-full bg-${s.color}-500"></div>
<span class="text-base text-gray-700 flex-1">${s.label}</span>
<svg class="w-5 h-5 text-blue-600 flex-shrink-0">
```

### 2. CTV List Page (public/admin/index.html + public/assets/js/admin.js)
**Dropdown đã cập nhật:**
- ✅ Status Filter (Tất cả trạng thái, Đang hoạt động, Mới, Không hoạt động)

**Thay đổi:**
- Chuyển từ native `<select>` sang custom dropdown button
- Thêm hàm `toggleCTVStatusFilter()` và `selectCTVStatusFilter()`
- Icon màu sắc: gray, green, blue, red

### 3. Customers Page (public/admin/customers.html + public/assets/js/customers.js)
**Dropdown đã cập nhật:**
- ✅ Segment Filter (Tất cả phân khúc, VIP, Regular, New, At Risk, Churned)

**Thay đổi:**
- Chuyển từ native `<select>` sang custom dropdown button
- Thêm hàm `toggleSegmentFilter()` và `selectSegmentFilter()`
- Icon màu sắc: gray, yellow, green, blue, orange, gray

## Màu sắc Icon theo Trạng thái

### Orders Status
- **Tất cả trạng thái**: gray-500
- **Chờ xử lý**: yellow-500
- **Đang xử lý**: blue-500
- **Đã gửi hàng**: green-500
- **Đã giao hàng**: emerald-500
- **Đã hủy**: red-500

### CTV Status
- **Tất cả trạng thái**: gray-500
- **Đang hoạt động**: green-500
- **Mới**: blue-500
- **Không hoạt động**: red-500

### Customer Segment
- **Tất cả phân khúc**: gray-500
- **VIP**: yellow-500
- **Regular**: green-500
- **New**: blue-500
- **At Risk**: orange-500
- **Churned**: gray-500

### Date Filter
- **Tất cả**: gray-500 (cho tất cả options)

## Cấu trúc HTML Dropdown Mới

```html
<div class="relative">
    <button id="filterBtn" onclick="toggleFilter(event)" 
        class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        <span id="filterLabel" class="text-sm text-gray-700">Label</span>
        <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
    </button>
</div>
<input type="hidden" id="filter" value="all">
```

## Cấu trúc Menu Dropdown

```javascript
menu.innerHTML = items.map(item => `
    <button 
        onclick="selectFilter('${item.value}', '${item.label}')"
        class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${item.value === currentValue ? 'bg-blue-50' : ''}"
    >
        <div class="w-3 h-3 rounded-full bg-${item.color}-500 flex-shrink-0"></div>
        <span class="text-base text-gray-700 flex-1">${item.label}</span>
        ${item.value === currentValue ? `
            <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
        ` : ''}
    </button>
`).join('');
```

## Kiểm tra

Tất cả dropdown đã được kiểm tra và không có lỗi syntax:
- ✅ public/assets/js/orders.js
- ✅ public/assets/js/admin.js
- ✅ public/assets/js/customers.js
- ✅ public/admin/orders.html
- ✅ public/admin/index.html
- ✅ public/admin/customers.html

## Tính năng

1. **Icon màu sắc**: Mỗi option có icon tròn với màu sắc riêng
2. **Checkmark**: Option đang chọn có checkmark (✓) màu xanh ở bên phải
3. **Highlight**: Option đang chọn có background màu xanh nhạt (bg-blue-50)
4. **Hover effect**: Hover vào option sẽ có background màu xám nhạt
5. **Responsive**: Dropdown tự động đóng khi click bên ngoài
6. **Consistent**: Tất cả dropdown trong hệ thống có cùng thiết kế

## Lưu ý

- Dropdown sử dụng Tailwind CSS classes
- Icon màu sắc sử dụng dynamic classes (bg-${color}-500)
- Checkmark chỉ hiển thị cho option đang được chọn
- Menu dropdown có z-index cao (z-50) để hiển thị trên các element khác
