# Các tính năng đã xóa / chưa implement

## SPX Shipping Integration

**Trạng thái:** Chưa implement / Đã xóa tham chiếu

**Lý do:** Các file JavaScript không tồn tại, gây lỗi 404 trong console

**Files đã xóa tham chiếu:**
- `public/assets/js/config/spx-config.js`
- `public/assets/js/shipping/spx-client.js`
- `public/assets/js/shipping/spx-modal.js`

**Vị trí đã sửa:**
- `public/admin/orders.html` - Đã xóa 3 script tags

**Ngày xóa:** 2024-11-21

**Ghi chú:** 
- Nếu cần implement SPX shipping trong tương lai, cần tạo lại các file này
- Hiện tại hệ thống vẫn hoạt động bình thường với shipping fee manual input
- Không ảnh hưởng đến chức năng tạo đơn hàng và tính toán chi phí

---

## Cách implement lại (nếu cần):

1. Tạo thư mục: `public/assets/js/config/`
2. Tạo thư mục: `public/assets/js/shipping/`
3. Tạo file `spx-config.js` với cấu hình SPX API
4. Tạo file `spx-client.js` với logic gọi API SPX
5. Tạo file `spx-modal.js` với UI modal chọn dịch vụ vận chuyển
6. Thêm lại script tags vào `orders.html`
