# Turso Database Guide

## Thông tin Database

### Database Configuration (từ wrangler.toml)
- **Database URL**: `libsql://vdt-yendev96.aws-ap-northeast-1.turso.io`
- **Auth Token**: Được cấu hình trong wrangler.toml
- **Database Name**: `vdt`

### Danh sách Databases
```
NAME           GROUP      URL
bio-link-db    default    libsql://bio-link-db-yendev96.aws-ap-northeast-1.turso.io
vdt            default    libsql://vdt-yendev96.aws-ap-northeast-1.turso.io
```

## Cài đặt Turso CLI

### 1. Cài đặt CLI (đã hoàn thành)
```bash
# Trong WSL
curl -sSfL https://get.tur.so/install.sh | bash
```

### 2. Cấu hình Token
```bash
wsl /home/dmin/.turso/turso config set token "YOUR_TOKEN_HERE"
```

## Cấu trúc Database VDT

### Danh sách các bảng
```
address_learning               - Học địa chỉ khách hàng
categories                     - Danh mục sản phẩm
commission_payment_details     - Chi tiết thanh toán hoa hồng
commission_payments            - Thanh toán hoa hồng
cost_config                    - Cấu hình chi phí
ctv                           - Cộng tác viên
discount_auto_rules           - Quy tắc tự động giảm giá
discount_campaigns            - Chiến dịch giảm giá
discount_usage                - Lịch sử sử dụng mã giảm giá
discounts                     - Mã giảm giá
export_history                - Lịch sử xuất dữ liệu
flash_sale_products           - Sản phẩm flash sale
flash_sale_purchases          - Mua hàng flash sale
flash_sales                   - Flash sales
material_categories           - Danh mục nguyên liệu
order_items                   - Chi tiết đơn hàng
orders                        - Đơn hàng
product_categories            - Danh mục sản phẩm (liên kết)
product_materials             - Nguyên liệu sản phẩm
products                      - Sản phẩm
sessions                      - Phiên đăng nhập
users                         - Người dùng
```

## Các lệnh thường dùng

### Kết nối và truy vấn cơ bản
```bash
# Xem danh sách databases
wsl /home/dmin/.turso/turso db list

# Kết nối vào shell tương tác
wsl /home/dmin/.turso/turso db shell vdt

# Xem danh sách bảng
wsl /home/dmin/.turso/turso db shell vdt ".tables"

# Xem cấu trúc bảng
wsl /home/dmin/.turso/turso db shell vdt ".schema orders"

# Chạy query trực tiếp
wsl /home/dmin/.turso/turso db shell vdt "SELECT COUNT(*) FROM orders"
```

### Các lệnh SQLite hữu ích trong shell
```sql
.tables                        -- Xem tất cả bảng
.schema                        -- Xem schema tất cả bảng
.schema table_name             -- Xem schema của bảng cụ thể
.mode column                   -- Hiển thị dạng cột
.headers on                    -- Hiển thị header
.quit                          -- Thoát shell
```

### Truy vấn mẫu
```sql
-- Xem số lượng đơn hàng
SELECT COUNT(*) FROM orders;

-- Xem 10 đơn hàng gần nhất
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- Xem danh sách sản phẩm
SELECT id, name, price FROM products LIMIT 10;

-- Xem thống kê CTV
SELECT COUNT(*) as total_ctv FROM ctv;

-- Xem mã giảm giá đang hoạt động
SELECT * FROM discounts WHERE is_active = 1;
```

## Troubleshooting

### Lỗi thường gặp
1. **"command not found"**: Đảm bảo sử dụng đường dẫn đầy đủ `/home/dmin/.turso/turso`
2. **"Unauthorized"**: Kiểm tra token đã được set chưa
3. **Timeout**: Thêm timeout parameter cho lệnh PowerShell

### Kiểm tra kết nối
```bash
# Kiểm tra version
wsl /home/dmin/.turso/turso --version

# Kiểm tra token
wsl /home/dmin/.turso/turso auth whoami

# Test kết nối database
wsl /home/dmin/.turso/turso db shell vdt "SELECT 1"
```

## Backup và Migration

### Tạo dump database
```bash
wsl /home/dmin/.turso/turso db shell vdt ".dump" > backup.sql
```

### Import vào SQLite local
```bash
cat backup.sql | sqlite3 local.db
```

## Notes
- Database sử dụng LibSQL (tương thích SQLite)
- Có thể sử dụng tất cả lệnh SQLite standard
- Database được host tại AWS AP-Northeast-1 (Tokyo)
- Có 2 databases: `vdt` (chính) và `bio-link-db`