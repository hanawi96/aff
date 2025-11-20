# Backend Integration - Bank Information

## Tổng quan
Backend đã được cập nhật để xử lý và lưu thông tin ngân hàng khi CTV đăng ký.

## Các thay đổi

### 1. Frontend (public/index.html)
**Đã sửa:**
- ✅ Đổi `name="bankAccount"` thành `name="bankAccountNumber"` để khớp với backend

**HTML:**
```html
<input type="text" name="bankAccountNumber" placeholder="Nhập số tài khoản">
<input type="hidden" name="bankName" id="bankNameValue">
```

### 2. Backend (worker.js)
**Đã có sẵn - Không cần sửa:**

#### API Endpoint: `/api/submit` hoặc `/api/ctv/register`
- ✅ Nhận `bankAccountNumber` và `bankName` từ request
- ✅ Validate dữ liệu
- ✅ Lưu vào D1 Database
- ✅ Lưu vào Google Sheets (optional)

#### Database Schema (ctv table):
```sql
CREATE TABLE ctv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT,
    age TEXT,
    bank_account_number TEXT,  -- ✅ Đã có
    bank_name TEXT,             -- ✅ Đã có
    referral_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Mới',
    commission_rate REAL DEFAULT 0.1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### Code xử lý (worker.js line 357-430):
```javascript
async function registerCTV(data, env, corsHeaders) {
    // Log received data
    console.log('🏦 Bank Name:', data.bankName);
    console.log('💳 Bank Account:', data.bankAccountNumber);
    
    // Insert into D1
    const result = await env.DB.prepare(`
        INSERT INTO ctv (
            full_name, phone, email, city, age, 
            bank_account_number, bank_name,  -- ✅ Lưu bank info
            referral_code, status, commission_rate
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        data.fullName,
        data.phone,
        data.email || null,
        data.city || null,
        data.age || null,
        data.bankAccountNumber || null,  -- ✅ Từ form
        data.bankName || null,            -- ✅ Từ form
        referralCode,
        data.status || 'Mới',
        commissionRate
    ).run();
    
    // Verify saved data
    const verify = await env.DB.prepare(`
        SELECT bank_account_number, bank_name 
        FROM ctv 
        WHERE referral_code = ?
    `).bind(referralCode).first();
    
    console.log('🔍 Verification:', verify);
    
    return jsonResponse({
        success: true,
        referralCode: referralCode,
        referralUrl: `https://shopvd.store/?ref=${referralCode}`,
        orderCheckUrl: `https://shopvd.store/ctv/?code=${referralCode}`
    });
}
```

### 3. API Response
**Success Response:**
```json
{
    "success": true,
    "message": "Đăng ký thành công",
    "referralCode": "ABC123",
    "referralUrl": "https://shopvd.store/?ref=ABC123",
    "orderCheckUrl": "https://shopvd.store/ctv/?code=ABC123"
}
```

**Error Response:**
```json
{
    "success": false,
    "error": "Thiếu thông tin bắt buộc"
}
```

## Data Flow

1. **User fills form** → Nhập số TK và chọn ngân hàng
2. **Frontend collects data** → FormData với `bankAccountNumber` và `bankName`
3. **POST to `/api/submit`** → Gửi JSON data
4. **Backend validates** → Check required fields
5. **Save to D1** → Insert vào table `ctv`
6. **Save to Google Sheets** → Backup (optional)
7. **Return response** → Trả về referral code và URLs

## Request Example

```javascript
// Frontend sends:
{
    "fullName": "Nguyễn Văn A",
    "phone": "0901234567",
    "email": "email@example.com",
    "city": "Hà Nội",
    "age": "26-30",
    "bankAccountNumber": "1234567890",  // ✅ NEW
    "bankName": "Vietcombank",          // ✅ NEW
    "motivation": "...",
    "terms": "on",
    "timestamp": "2025-11-20T10:30:00.000Z"
}
```

## Database Query Examples

### Get CTV with bank info:
```sql
SELECT 
    referral_code, 
    full_name, 
    phone, 
    bank_account_number, 
    bank_name,
    commission_rate
FROM ctv
WHERE referral_code = 'ABC123'
```

### Update bank info:
```sql
UPDATE ctv 
SET 
    bank_account_number = ?, 
    bank_name = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE referral_code = ?
```

## Testing

### Test Registration:
1. Mở form đăng ký: `https://shopvd.store/`
2. Điền thông tin + số TK + chọn ngân hàng
3. Submit form
4. Check console logs:
   - `📥 Received CTV data`
   - `🏦 Bank Name: Vietcombank`
   - `💳 Bank Account: 1234567890`
   - `✅ Saved to D1`
   - `🔍 Verification query result`

### Verify in Database:
```sql
SELECT * FROM ctv 
WHERE referral_code = 'NEW_CODE'
ORDER BY created_at DESC 
LIMIT 1
```

## Integration Points

### 1. Admin Panel (public/admin/index.html)
- ✅ Hiển thị bank info trong danh sách CTV
- ✅ Edit CTV modal có bank fields
- ✅ Payment page sử dụng bank info

### 2. Payment System
- ✅ `getPaymentHistory()` - Lấy bank info
- ✅ `paySelectedOrders()` - Sử dụng bank info
- ✅ Commission payments table có bank info

### 3. Google Sheets Backup
- ✅ `sheetsData` bao gồm `bankAccountNumber` và `bankName`
- ✅ Tự động sync khi đăng ký mới

## Validation

### Frontend (Optional - có thể thêm):
```javascript
// Validate bank account number
const bankAccount = document.querySelector('[name="bankAccountNumber"]');
bankAccount.pattern = "\\d{6,20}";
bankAccount.required = true;

// Validate bank name
const bankName = document.querySelector('[name="bankName"]');
bankName.required = true;
```

### Backend (Đã có):
```javascript
if (!data.fullName || !data.phone) {
    return jsonResponse({
        success: false,
        error: 'Thiếu thông tin bắt buộc'
    }, 400);
}
```

## Status

✅ **Frontend**: Hoàn thành - Form có bank fields
✅ **Backend**: Hoàn thành - API xử lý bank info
✅ **Database**: Hoàn thành - Có cột bank_account_number và bank_name
✅ **Integration**: Hoàn thành - Data flow từ form → DB
✅ **Testing**: Sẵn sàng test

## Next Steps (Optional)

1. Thêm validation cho số tài khoản (regex pattern)
2. Thêm required attribute cho bank fields
3. Thêm error handling cho bank info không hợp lệ
4. Thêm bank info vào email confirmation (nếu có)
