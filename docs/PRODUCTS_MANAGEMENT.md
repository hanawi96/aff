# Hướng dẫn Quản lý Sản phẩm

## Truy cập

Mở trình duyệt và truy cập: `http://127.0.0.1:5500/public/admin/products.html`

## Giao diện

Trang quản lý sản phẩm có giao diện tương tự như trang quản lý đơn hàng với:
- **Sidebar** bên trái với menu điều hướng
- **Header** cố định phía trên với tiêu đề và nút thao tác
- **Stats Cards** hiển thị thống kê tổng quan
- **Search & Filter** để tìm kiếm và lọc sản phẩm
- **Products Grid/List** hiển thị danh sách sản phẩm

## Thống kê

Trang hiển thị 4 thẻ thống kê:
1. **Tổng sản phẩm** - Số lượng sản phẩm trong hệ thống
2. **Danh mục** - Số lượng danh mục khác nhau
3. **Giá trung bình** - Giá trung bình của tất cả sản phẩm
4. **Đang hoạt động** - Số sản phẩm đang active

## Tính năng

### 1. Xem danh sách sản phẩm
- Hiển thị sản phẩm dạng **Grid** (mặc định) hoặc **List**
- Chuyển đổi view bằng nút ở góc phải thanh tìm kiếm
- Mỗi card hiển thị:
  - Ảnh sản phẩm (hoặc icon mặc định)
  - Tên sản phẩm
  - Danh mục
  - Mã SKU (nếu có)
  - Giá
  - Cân nặng (nếu có)
  - Size (nếu có)
  - Nút Sửa và Xóa

### 2. Tìm kiếm sản phẩm
- Gõ từ khóa vào ô tìm kiếm
- Tìm kiếm theo tên hoặc SKU
- Kết quả hiển thị ngay lập tức (debounced 300ms)
- **Phím tắt**: `Ctrl/Cmd + K` để focus vào ô tìm kiếm

### 3. Thêm sản phẩm mới
- Click nút "Thêm sản phẩm" hoặc nhấn `Ctrl/Cmd + N`
- Điền thông tin:
  - **Tên sản phẩm** (bắt buộc)
  - **Giá** (bắt buộc, đơn vị VNĐ)
  - Danh mục (có gợi ý: Hạt, Vòng, Mix, Túi, Móc khóa, Bó dâu)
  - Cân nặng (VD: 500g, 1kg)
  - Size/Tay (VD: Size M, Tay 3)
  - Mã SKU (duy nhất)
  - Mô tả
  - URL ảnh
- Click "Lưu sản phẩm" hoặc nhấn `Enter`

### 4. Sửa sản phẩm
- Click nút "Sửa" trên card sản phẩm
- Cập nhật thông tin cần thiết
- Click "Cập nhật" hoặc nhấn `Enter`

### 5. Xóa sản phẩm
- Click nút xóa (icon thùng rác) trên card sản phẩm
- Xác nhận xóa trong dialog
- Sản phẩm sẽ bị ẩn (soft delete: is_active = 0)

## Phím tắt

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl/Cmd + K` | Focus vào ô tìm kiếm |
| `Ctrl/Cmd + N` | Mở form thêm sản phẩm mới |
| `Escape` | Đóng modal/dialog |
| `Enter` | Submit form (khi đang trong modal) |

## Validation

- Tên sản phẩm: Bắt buộc
- Giá: Bắt buộc, phải > 0
- URL ảnh: Phải là URL hợp lệ (http/https)
- Mã SKU: Phải duy nhất (nếu có)

## Thông báo

Hệ thống hiển thị toast notification cho các hành động:
- ✓ Thành công (màu xanh)
- ✗ Lỗi (màu đỏ)
- ⚠ Cảnh báo (màu vàng)
- ℹ Thông tin (màu xanh dương)

## Responsive

- Desktop: Hiển thị 4 cột
- Tablet: Hiển thị 3 cột
- Mobile: Hiển thị 1-2 cột

## API Endpoints

Trang này sử dụng các API endpoints sau:

- `GET /api?action=getAllProducts` - Lấy tất cả sản phẩm
- `GET /api?action=getProduct&id={id}` - Lấy chi tiết 1 sản phẩm
- `GET /api?action=searchProducts&q={query}` - Tìm kiếm sản phẩm
- `POST /api?action=createProduct` - Tạo sản phẩm mới
- `POST /api?action=updateProduct` - Cập nhật sản phẩm
- `POST /api?action=deleteProduct` - Xóa sản phẩm (soft delete)

## Troubleshooting

### Không tải được sản phẩm
- Kiểm tra API URL trong `public/assets/js/config.js`
- Kiểm tra console log để xem lỗi
- Đảm bảo Cloudflare Worker đang chạy

### Không thêm/sửa được sản phẩm
- Kiểm tra validation (tên và giá bắt buộc)
- Kiểm tra console log để xem lỗi API
- Đảm bảo database có quyền ghi

### Ảnh không hiển thị
- Kiểm tra URL ảnh có hợp lệ không
- Kiểm tra CORS của server ảnh
- Nếu lỗi, sẽ hiển thị icon mặc định

## Tips

1. **Nhập nhanh**: Sử dụng phím Tab để di chuyển giữa các trường
2. **Danh mục**: Gõ vài ký tự để thấy gợi ý danh mục
3. **Giá**: Nhập số nguyên, không cần dấu phẩy (VD: 50000)
4. **SKU**: Nên đặt mã ngắn gọn, dễ nhớ (VD: HDT-500)
5. **Ảnh**: Nên dùng URL ảnh từ CDN hoặc cloud storage
