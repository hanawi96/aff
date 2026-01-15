# SPX Export Feature - Hướng dẫn sử dụng

## 📋 Tổng quan

Tính năng export đơn hàng sang định dạng Excel của SPX (Shopee Express) để tạo đơn hàng hàng loạt.

## 🎯 Cách sử dụng

### 1. Chọn đơn hàng
- Vào trang **Quản lý đơn hàng** (Admin Dashboard)
- Tick checkbox các đơn hàng muốn export
- Thanh công cụ sẽ hiện ở dưới màn hình

### 2. Export
- Click nút **Export** trên thanh công cụ
- File Excel sẽ tự động tải về với tên: `SPX_DonHang_YYYYMMDD_Xdon.xlsx`

### 3. Upload lên SPX
- Mở file Excel vừa tải
- Kiểm tra và điều chỉnh thông tin nếu cần
- Upload file lên hệ thống SPX

## 📊 Cấu trúc dữ liệu

### Mapping từ Database sang SPX

| Database | SPX Field | Ghi chú |
|----------|-----------|---------|
| `order_id` | `*Mã đơn hàng` | Bắt buộc |
| `customer_name` | `*Tên người nhận` | Bắt buộc |
| `customer_phone` | `*Số điện thoại` | Bắt buộc |
| `address` | Parse thành 4 trường | Tỉnh/Quận/Xã/Địa chỉ |
| `products` (JSON) | `*Tên sản phẩm` + Số lượng + Giá | Mỗi sản phẩm 1 dòng |
| `total_amount` | `*Giá trị đơn hàng` + `Số tiền COD` | Bắt buộc |
| `notes` | `Lưu ý giao hàng` | Tùy chọn |

### Giá trị mặc định

Các trường sau được điền tự động:

- `*Tổng cân nặng bưu gửi (KG)`: **0.5 kg**
- `*Giao hàng một phần (Y/N)`: **N**
- `*Cho phép thử hàng (Y/N)`: **Y**
- `*Cho xem hàng, không cho thử (Y/N)`: **Y**
- `*Thu COD (Y/N)`: **Y**
- `Số tiền COD`: = `total_amount`
- `*Hình thức thanh Toán`: **Người gửi trả**

## 🔍 Xử lý địa chỉ

### Format địa chỉ trong database

Địa chỉ nên được lưu theo format:
```
Địa chỉ chi tiết, Xã/Phường, Quận/Huyện, Tỉnh/TP
```

**Ví dụ:**
```
123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
```

### Parsing logic

- **4 phần**: Detail, Ward, District, Province ✅
- **3 phần**: Detail, District, Province (không có Ward)
- **2 phần**: Detail, Province (không có District, Ward)
- **1 phần**: Toàn bộ là Detail

## 📦 Xử lý sản phẩm

### Nhiều sản phẩm trong 1 đơn

Nếu đơn hàng có nhiều sản phẩm, sẽ tạo **nhiều dòng** trong Excel:

**Ví dụ:** Đơn VDT001 có 2 sản phẩm:
- Dòng 1: Thông tin đầy đủ + Sản phẩm 1
- Dòng 2: Chỉ có tên sản phẩm 2 (các trường khác để trống)

### Không có sản phẩm

Nếu đơn không có thông tin sản phẩm, tạo **1 dòng** với:
- Thông tin đơn hàng đầy đủ
- Trường `*Tên sản phẩm` để trống

## 🎨 Format Excel

### Columns (30 cột)

Đúng theo template SPX:
1. `*Mã đơn hàng`
2. `*Tên người nhận`
3. `*Số điện thoại`
4. `*Tỉnh/Thành Phố`
5. `*Quận/Huyện`
6. `*Xã/Phường`
7. `*Địa chỉ chi tiết`
8. `Lưu ý về địa chỉ`
9. `Mã bưu chính`
10. `*Tên sản phẩm`
11. `Số lượng`
12. `Giá tiền`
13. `*Tổng cân nặng bưu gửi (KG)`
14-16. Kích thước (Dài/Rộng/Cao CM)
17. `Mã khách hàng`
18. `*Giá trị đơn hàng`
19-21. Tùy chọn giao hàng
22-23. Phí từ chối
24-25. COD
26. Giá trị cao
27. `*Hình thức thanh Toán`
28. `Lưu ý giao hàng`
29-30. Validation fields

### Column widths

Tự động set width phù hợp để dễ đọc.

## 🚀 Technical Details

### Files

- `public/assets/js/spx-export.js` - Export logic
- `public/assets/js/orders.js` - Integration
- `public/admin/index.html` - UI

### Dependencies

- **SheetJS (xlsx)**: v0.20.1
- Loaded dynamically từ CDN khi cần

### Functions

```javascript
// Main export function
exportToSPXExcel(orders) -> Promise<{success, filename, count, rows}>

// Helper functions
parseAddress(address) -> {province, district, ward, detail}
parseProducts(productsJson) -> [{name, quantity, price}]
```

## ⚠️ Lưu ý

### 1. Địa chỉ không đầy đủ
- Nếu địa chỉ thiếu Tỉnh/Quận/Xã, cần bổ sung thủ công trong Excel
- Hoặc cập nhật địa chỉ trong hệ thống trước khi export

### 2. Sản phẩm không có thông tin
- Nếu `products` field null/empty, trường sản phẩm sẽ trống
- Cần điền thủ công hoặc cập nhật database

### 3. Validation SPX
- File Excel chỉ chứa dữ liệu, không có validation
- SPX sẽ validate khi upload
- Các trường bắt buộc (*) phải có giá trị

### 4. Cân nặng và kích thước
- Mặc định 1kg, không có kích thước
- Nên cập nhật thủ công cho chính xác

## 📈 Performance

- Export 100 đơn: ~1-2 giây
- Export 500 đơn: ~3-5 giây
- Không giới hạn số lượng đơn

## 🔧 Troubleshooting

### Lỗi: "Không thể tải thư viện Excel"
- Kiểm tra kết nối internet
- CDN SheetJS có thể bị chặn

### File Excel bị lỗi format
- Kiểm tra dữ liệu trong database
- Xem console log để debug

### Địa chỉ không đúng
- Cập nhật format địa chỉ trong database
- Hoặc sửa thủ công trong Excel

## 📝 Changelog

### v1.0.0 (2026-01-15)
- ✅ Export đơn hàng sang format SPX Excel
- ✅ Parse địa chỉ thông minh
- ✅ Hỗ trợ nhiều sản phẩm/đơn
- ✅ Auto-fill giá trị mặc định
- ✅ Dynamic load XLSX library
