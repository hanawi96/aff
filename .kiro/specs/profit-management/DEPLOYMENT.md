# Hướng dẫn Triển khai - Hệ thống Quản lý Lãi Lỗ

## ✅ ĐÃ HOÀN THÀNH

### Backend (100%)
- ✅ Database migration SQL
- ✅ API endpoints (getPackagingConfig, updatePackagingConfig, getProfitReport)
- ✅ Cập nhật createProduct, updateProduct, createOrder

### Frontend (100%)
- ✅ Trang Settings (cấu hình chi phí đóng gói)
- ✅ Trang Products (thêm giá vốn, tính lãi dự kiến)
- ✅ Trang Profit Report (báo cáo lãi lỗ tổng hợp)

## 🚀 BƯỚC TRIỂN KHAI

### Bước 1: Cập nhật Database

Chạy migration SQL trên Cloudflare D1:

```bash
# Sử dụng Wrangler CLI
wrangler d1 execute <DATABASE_NAME> --file=database/migrations/002_add_profit_management.sql

# Hoặc copy nội dung file và chạy trực tiếp trên Cloudflare Dashboard
```

**File migration:** `database/migrations/002_add_profit_management.sql`

Migration này sẽ:
- Tạo bảng `cost_config` với dữ liệu mặc định
- Thêm cột `cost_price` vào bảng `products`
- Thêm các cột chi phí vào bảng `orders`

### Bước 2: Deploy Worker

```bash
# Deploy worker.js lên Cloudflare Workers
wrangler deploy
```

Worker đã được cập nhật với:
- API mới cho packaging config
- API báo cáo lãi lỗ
- Logic tính toán profit trong createOrder

### Bước 3: Deploy Frontend

Upload các file sau lên hosting:

**Files mới:**
- `public/admin/settings.html`
- `public/admin/profit-report.html`
- `public/assets/js/settings.js`
- `public/assets/js/profit-report.js`

**Files đã cập nhật:**
- `public/assets/js/products.js` (thêm giá vốn)

### Bước 4: Cấu hình Ban đầu

1. Truy cập `/admin/settings.html`
2. Nhập giá cho các loại đóng gói:
   - Túi zip: 500đ
   - Giấy in: 200đ
   - Túi rút đỏ: 1,000đ
   - Hộp đóng hàng: 3,000đ
3. Click "Lưu cài đặt"

### Bước 5: Cập nhật Giá vốn Sản phẩm

1. Truy cập `/admin/products.html`
2. Sửa từng sản phẩm, thêm "Giá vốn"
3. Hệ thống sẽ tự động tính lãi dự kiến

## 📊 CÁCH SỬ DỤNG

### 1. Quản lý Chi phí Đóng gói

**Trang:** `/admin/settings.html`

- Cấu hình giá các vật liệu đóng gói
- Chỉ cần cài đặt 1 lần
- Tự động áp dụng cho đơn hàng mới

### 2. Quản lý Sản phẩm

**Trang:** `/admin/products.html`

- Thêm/sửa sản phẩm với trường "Giá vốn"
- Xem lãi dự kiến real-time
- Cảnh báo nếu giá vốn > giá bán

### 3. Tạo Đơn hàng (Sẽ cập nhật sau)

**Trang:** `/admin/orders.html`

- Chọn loại đóng gói (túi rút, hộp)
- Nhập phí ship
- Xem lãi dự kiến trước khi tạo đơn

### 4. Xem Báo cáo Lãi Lỗ

**Trang:** `/admin/profit-report.html`

- Chọn kỳ: Hôm nay, Tuần, Tháng, Năm, Tất cả
- Xem dashboard: Doanh thu, Chi phí, Lãi ròng, Tỷ suất
- Chi tiết chi phí đóng gói (túi zip, giấy in, túi rút, hộp)
- Danh sách đơn hàng với lãi lỗ

## 🎯 TÍNH NĂNG CHÍNH

### ✅ Đã triển khai:

1. **Cấu hình Chi phí**
   - Quản lý giá đóng gói tập trung
   - Tự động áp dụng cho đơn hàng

2. **Quản lý Giá vốn**
   - Nhập giá vốn cho từng sản phẩm
   - Tính lãi dự kiến tự động
   - Cảnh báo sản phẩm lỗ

3. **Báo cáo Lãi Lỗ**
   - Dashboard tổng quan
   - Chi tiết chi phí theo loại
   - Phân tích đóng gói chi tiết
   - Danh sách đơn hàng

### 🔄 Cần cập nhật thêm:

1. **Orders Page Enhancement**
   - Thêm cột "Lãi" trong danh sách
   - Form tạo đơn: chọn đóng gói, nhập phí ship
   - Hiển thị lãi dự kiến khi tạo đơn

2. **Responsive Design**
   - Tối ưu cho mobile
   - Test trên các thiết bị

## 🐛 TROUBLESHOOTING

### Lỗi: "cost_config table not found"
**Giải pháp:** Chạy lại migration SQL

### Lỗi: "cost_price column not found"
**Giải pháp:** Chạy lại migration SQL

### Lỗi: API không trả về profit
**Giải pháp:** 
- Kiểm tra worker.js đã deploy chưa
- Kiểm tra database đã có các cột mới chưa

### Profit = 0 cho đơn hàng cũ
**Giải pháp:** 
- Đơn hàng cũ không có dữ liệu profit
- Chỉ đơn hàng mới (sau khi deploy) mới có profit

## 📝 GHI CHÚ

- Hệ thống chỉ tính profit cho đơn hàng MỚI (sau khi deploy)
- Đơn hàng cũ sẽ có profit = 0
- Cần cập nhật giá vốn cho TẤT CẢ sản phẩm
- Cấu hình đóng gói áp dụng cho đơn hàng mới

## 🎉 HOÀN THÀNH

Hệ thống quản lý lãi lỗ đã sẵn sàng sử dụng!

Bạn có thể:
- ✅ Cấu hình chi phí đóng gói
- ✅ Quản lý giá vốn sản phẩm
- ✅ Xem báo cáo lãi lỗ chi tiết
- ✅ Theo dõi chi phí đóng gói (túi, giấy, hộp...)
- ✅ Phân tích lợi nhuận theo thời gian
