# 🔐 Hướng dẫn Triển khai Authentication

## Tổng quan
Hệ thống authentication đơn giản, an toàn với:
- ✅ Session-based authentication
- ✅ Password hashing với bcrypt
- ✅ Session lưu trong D1 database
- ✅ Auto-redirect nếu chưa đăng nhập
- ✅ Session timeout 7 ngày

## Bước 1: Cài đặt bcryptjs

```bash
npm install bcryptjs
```

Hoặc thêm vào `package.json`:
```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3"
  }
}
```

## Bước 2: Chạy Migration tạo bảng

```bash
cd database/migrations
run_create_auth.bat
```

Hoặc:
```bash
npx wrangler d1 execute vdt --remote --file=database/migrations/033_create_auth_tables.sql
```

Migration sẽ tạo:
- Bảng `users` (lưu thông tin user)
- Bảng `sessions` (lưu session tokens)
- User admin mặc định: `admin` / `admin123`

## Bước 3: Cập nhật Worker

Mở file `worker.js` và thêm các functions từ `worker-auth-functions.js`:

### 3.1. Thêm import bcrypt (đầu file)
```javascript
import bcrypt from 'bcryptjs';
```

### 3.2. Copy tất cả functions từ `worker-auth-functions.js` vào worker.js

### 3.3. Thêm routes vào handleGet()
```javascript
case 'verifySession':
    return await handleVerifySession(request, env, corsHeaders);
```

### 3.4. Thêm routes vào handlePost()
```javascript
case 'login':
    return await handleLogin(request, env, corsHeaders);

case 'logout':
    return await handleLogout(request, env, corsHeaders);

case 'changePassword':
    return await handleChangePassword(request, env, corsHeaders);
```

### 3.5. Cập nhật CORS headers
```javascript
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Thêm Authorization
};
```

## Bước 4: Deploy Worker

```bash
npx wrangler deploy
```

## Bước 5: Test

1. Truy cập: `http://127.0.0.1:5500/public/admin/`
2. Sẽ tự động redirect đến `/public/login.html`
3. Đăng nhập với:
   - Username: `admin`
   - Password: `admin123`
4. Sau khi đăng nhập thành công, sẽ redirect về admin panel

## Tính năng

### ✅ Đã hoàn thành:
- [x] Trang login đẹp, responsive
- [x] Auth check tự động trên mọi trang admin
- [x] Session token lưu trong localStorage
- [x] Nút logout trên header
- [x] Auto-redirect nếu chưa đăng nhập
- [x] Session timeout 7 ngày

### 🔄 Có thể mở rộng:
- [ ] Trang đổi mật khẩu
- [ ] Quản lý nhiều users
- [ ] Role-based access control
- [ ] Remember me checkbox
- [ ] Password reset via email

## Bảo mật

### ⚠️ LƯU Ý QUAN TRỌNG:

1. **ĐỔI MẬT KHẨU NGAY SAU KHI ĐĂNG NHẬP LẦN ĐẦU**
   - Mật khẩu mặc định `admin123` chỉ để test
   
2. **Sử dụng HTTPS trong production**
   - Session token được truyền qua header
   - Không bao giờ dùng HTTP trong production

3. **Cấu hình CORS đúng**
   - Trong production, thay `'*'` bằng domain cụ thể
   ```javascript
   'Access-Control-Allow-Origin': 'https://yourdomain.com'
   ```

4. **Session cleanup**
   - Tạo cron job để xóa sessions hết hạn:
   ```sql
   DELETE FROM sessions WHERE expires_at < unixepoch();
   ```

## Cấu trúc Database

### Bảng users
```sql
- id: INTEGER PRIMARY KEY
- username: TEXT UNIQUE
- password_hash: TEXT (bcrypt hash)
- full_name: TEXT
- role: TEXT (admin, user, etc.)
- is_active: INTEGER (0/1)
- created_at: INTEGER (unix timestamp)
- updated_at: INTEGER (unix timestamp)
```

### Bảng sessions
```sql
- id: TEXT PRIMARY KEY (session token)
- user_id: INTEGER (FK to users)
- expires_at: INTEGER (unix timestamp)
- created_at: INTEGER (unix timestamp)
```

## API Endpoints

### POST /api?action=login
Request:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:
```json
{
  "success": true,
  "sessionToken": "abc123...",
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "Administrator",
    "role": "admin"
  }
}
```

### GET /api?action=verifySession
Headers:
```
Authorization: Bearer <session_token>
```

Response:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "Administrator",
    "role": "admin"
  }
}
```

### POST /api?action=logout
Headers:
```
Authorization: Bearer <session_token>
```

Response:
```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

### POST /api?action=changePassword
Headers:
```
Authorization: Bearer <session_token>
```

Request:
```json
{
  "currentPassword": "admin123",
  "newPassword": "newSecurePassword123"
}
```

Response:
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công"
}
```

## Troubleshooting

### Lỗi: "bcryptjs not found"
```bash
npm install bcryptjs
npx wrangler deploy
```

### Lỗi: "Session không hợp lệ"
- Xóa localStorage và đăng nhập lại
- Kiểm tra session trong database có hết hạn không

### Không redirect đến login
- Kiểm tra `auth-check.js` đã được include chưa
- Kiểm tra `CONFIG.API_URL` trong `config.js`

## Files đã tạo

```
✅ database/migrations/033_create_auth_tables.sql
✅ database/migrations/run_create_auth.bat
✅ public/login.html
✅ public/assets/js/auth-check.js
✅ worker-auth-functions.js (cần copy vào worker.js)
✅ AUTH_SETUP_GUIDE.md (file này)
```

## Cleanup Scripts

Sau khi setup xong, có thể xóa:
```bash
del add-auth-to-pages.ps1
del worker-auth-functions.js
```

---

**Hoàn thành!** 🎉

Hệ thống authentication đã sẵn sàng sử dụng.
