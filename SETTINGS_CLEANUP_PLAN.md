# Settings Page Cleanup Plan

## 📋 Phân tích hiện trạng

### ❌ Cần XÓA (đã có trong trang Nguyên liệu):
1. **Chi phí theo sản phẩm**:
   - Dây đỏ (red_string)
   - Tiền công (labor_cost)

2. **Chi phí đóng gói**:
   - Túi zip (bag_zip)
   - Túi rút đỏ (bag_red)
   - Hộp đựng hàng (box_shipping)
   - Thiệp cảm ơn (thank_card)
   - Giấy in (paper_print)

### ✅ GIỮ LẠI (config hệ thống):
1. **Thuế** (Tax):
   - Tỷ lệ thuế hiện tại
   - Cập nhật tỷ lệ thuế mới
   - Ví dụ tính thuế

2. **Phí vận chuyển**:
   - Phí ship khách trả (customer_shipping_fee) - Thu từ khách
   - Chi phí ship mặc định (default_shipping_cost) - Chi phí thực tế

3. **Bảo mật**:
   - Đổi mật khẩu

## 🎯 Cấu trúc mới

```
Settings Page
├── Left Column (Main)
│   ├── Shipping Fees Card
│   │   ├── Customer Shipping Fee (khách trả)
│   │   └── Default Shipping Cost (chi phí thực tế)
│   └── Tax Settings Card
│       ├── Current Tax Rate
│       ├── Update Tax Rate
│       └── Tax Calculation Example
│
└── Right Column (Sidebar)
    ├── Quick Stats
    ├── Change Password
    └── Tips
```

## 📝 Lý do cleanup:

1. **Tránh trùng lặp**: Chi phí nguyên liệu đã có trang riêng
2. **Tập trung**: Settings chỉ cho config hệ thống
3. **Rõ ràng**: Phân biệt rõ giữa nguyên liệu và config
4. **Dễ maintain**: Mỗi trang có mục đích riêng

## 🔄 Migration:

Các chi phí đã xóa sẽ được quản lý tại:
- **Trang Nguyên liệu** → Tab "Danh sách nguyên liệu"
- Tạo danh mục "Chi phí vận hành" để chứa các chi phí này

---

**Status**: Ready to implement
**Date**: 2026-01-20
