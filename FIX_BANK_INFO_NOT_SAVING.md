# Fix: Thông tin ngân hàng không được lưu

## Vấn đề
Khi thêm cộng tác viên mới, thông tin tài khoản ngân hàng (số tài khoản và tên ngân hàng) không được lưu vào database.

## Nguyên nhân
Database production chưa có các cột `bank_account_number` và `bank_name` trong bảng `ctv`. Migration cần được chạy để thêm các cột này.

## Giải pháp

### Cách 1: Chạy script tự động (Khuyến nghị)
```bash
# Chạy file batch để kiểm tra và fix tự động
check-and-fix-bank-columns.bat
```

### Cách 2: Chạy migration thủ công
```bash
# Di chuyển vào thư mục migrations
cd migrations

# Chạy migration
wrangler d1 execute ctv-management --file=add_bank_info_to_ctv.sql

# Quay lại thư mục gốc
cd ..
```

### Cách 3: Chạy trực tiếp SQL command
```bash
# Thêm cột bank_account_number
wrangler d1 execute ctv-management --command="ALTER TABLE ctv ADD COLUMN bank_account_number TEXT"

# Thêm cột bank_name
wrangler d1 execute ctv-management --command="ALTER TABLE ctv ADD COLUMN bank_name TEXT"
```

## Kiểm tra sau khi fix

### 1. Kiểm tra cấu trúc bảng
```bash
wrangler d1 execute ctv-management --command="PRAGMA table_info(ctv)"
```

Bạn sẽ thấy 2 cột mới:
- `bank_account_number` (TEXT)
- `bank_name` (TEXT)

### 2. Test thêm CTV mới
1. Mở trang admin: https://your-domain.com/admin/
2. Click "Thêm CTV"
3. Điền đầy đủ thông tin bao gồm:
   - Số tài khoản ngân hàng
   - Tên ngân hàng (sử dụng chức năng tìm kiếm)
4. Submit form
5. Kiểm tra trong database:

```bash
wrangler d1 execute ctv-management --command="SELECT referral_code, full_name, bank_account_number, bank_name FROM ctv ORDER BY created_at DESC LIMIT 5"
```

## Debug thêm

Nếu vẫn không lưu được, kiểm tra console log trong browser:
1. Mở DevTools (F12)
2. Vào tab Console
3. Thêm CTV mới
4. Xem log có dòng:
   - `📤 Sending CTV data:` - Kiểm tra data có bankName không
   - `🏦 Bank Name from form:` - Kiểm tra giá trị từ form
   - `💳 Bank Account Number from form:` - Kiểm tra số tài khoản

## Lưu ý

- Migration này an toàn và không ảnh hưởng đến dữ liệu hiện có
- Các cột mới cho phép NULL, nên CTV cũ không bị ảnh hưởng
- Sau khi chạy migration, tính năng sẽ hoạt động ngay lập tức

## Cập nhật schema.sql

Để tránh vấn đề này trong tương lai, hãy cập nhật file `database/schema.sql` để bao gồm các cột bank:

```sql
CREATE TABLE IF NOT EXISTS ctv (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  age TEXT,
  bank_account_number TEXT,  -- ← Thêm dòng này
  bank_name TEXT,             -- ← Thêm dòng này
  experience TEXT,
  motivation TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'Mới',
  commission_rate REAL DEFAULT 0.1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
