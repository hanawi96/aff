# Settings Page Cleanup - Complete

## ✅ Đã xóa thành công

### 1. Chi phí theo sản phẩm
- ❌ Dây đỏ (red_string)
- ❌ Tiền công (labor_cost)

### 2. Chi phí đóng gói
- ❌ Túi zip (bag_zip)
- ❌ Túi rút đỏ (bag_red)
- ❌ Hộp đựng hàng (box_shipping)
- ❌ Thiệp cảm ơn (thank_card)
- ❌ Giấy in (paper_print)

### 3. UI Elements
- ❌ Preview/Ví dụ tính toán (đơn 1 sản phẩm, đơn 3 sản phẩm)
- ❌ Tổng chi phí đóng gói (Quick Stats sidebar)

### 4. Card Headers
- ✅ Đổi từ "Chi phí theo sản phẩm" → "Cài đặt phí vận chuyển"
- ✅ Đổi icon từ 📦 → 🚚
- ✅ Đổi gradient từ blue-indigo-purple → green-emerald-teal

---

## ✅ Giữ lại

### 1. Phí vận chuyển
- ✅ Chi phí ship mặc định (default_shipping_cost) - Chi phí thực tế
- ✅ Phí ship khách hàng (customer_shipping_fee) - Thu từ khách

### 2. Thuế
- ✅ Tỷ lệ thuế hiện tại
- ✅ Cập nhật tỷ lệ thuế mới
- ✅ Ví dụ tính thuế

### 3. Bảo mật
- ✅ Đổi mật khẩu

### 4. Sidebar
- ✅ Quick Stats (chỉ còn Tỷ lệ thuế)
- ✅ Change Password
- ✅ Tips

---

## 📋 Cấu trúc mới

```
Settings Page
├── Header
│   └── "Cài đặt - Quản lý chi phí, bảo mật và cấu hình hệ thống"
│
├── Left Column (Main Content)
│   ├── Shipping Fees Card 🚚
│   │   ├── Chi phí ship mặc định (default_shipping_cost)
│   │   └── Phí ship khách hàng (customer_shipping_fee)
│   │
│   └── Tax Settings Card 💰
│       ├── Current Tax Rate
│       ├── Update Tax Rate
│       └── Tax Calculation Example
│
└── Right Column (Sidebar)
    ├── Quick Stats
    │   └── Tỷ lệ thuế hiện tại
    ├── Change Password
    └── Tips
```

---

## 🔄 Next Steps

### Cần làm tiếp:
1. **Update JavaScript** (`settings.js`):
   - Xóa các function liên quan đến chi phí đóng gói
   - Xóa preview calculation
   - Giữ lại chỉ: shipping fees + tax

2. **Update Backend** (nếu cần):
   - Kiểm tra API endpoints
   - Đảm bảo chỉ lưu: default_shipping_cost, customer_shipping_fee, tax_rate

3. **Migrate data**:
   - Di chuyển các chi phí đã xóa sang trang Nguyên liệu
   - Tạo danh mục "Chi phí vận hành" trong materials

---

## 📊 So sánh

| Aspect | Before | After |
|--------|--------|-------|
| **Số fields** | 10 fields | 2 fields (shipping) |
| **Focus** | Mixed (materials + config) | Pure config |
| **Clarity** | Confusing | Clear |
| **Maintenance** | Hard | Easy |

---

**Status**: ✅ HTML Cleanup Complete  
**Date**: 2026-01-20  
**Next**: Update JavaScript file
