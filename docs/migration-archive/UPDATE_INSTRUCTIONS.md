# 🚀 Hướng dẫn cập nhật code để chuyển sang Turso

## 📋 Tổng quan

Bạn chỉ cần cập nhật **2 files chính**:
1. `worker.js` - Thêm 3 dòng code
2. `wrangler.toml` - Thay config

Tất cả code logic khác **KHÔNG CẦN THAY ĐỔI** vì Turso adapter tương thích 100% với D1 API.

---

## 🔧 Bước 1: Cập nhật `worker.js`

### Thêm import ở đầu file

**Tìm dòng này (dòng 4):**
```javascript
import bcrypt from 'bcryptjs';
```

**Thêm dòng này ngay sau:**
```javascript
import { initTurso } from './database/turso-client.js';
```

**Kết quả:**
```javascript
// Cloudflare Worker API for CTV Management System
// Using Turso Database (Remote SQLite)

import bcrypt from 'bcryptjs';
import { initTurso } from './database/turso-client.js';

export default {
    async fetch(request, env, ctx) {
```

### Thêm initialization trong fetch()

**Tìm dòng này (dòng 8):**
```javascript
export default {
    async fetch(request, env, ctx) {
        // CORS headers
        const corsHeaders = {
```

**Thêm 3 dòng này TRƯỚC "// CORS headers":**
```javascript
export default {
    async fetch(request, env, ctx) {
        // Initialize Turso database connection
        const DB = initTurso(env);
        env.DB = DB;
        
        // CORS headers
        const corsHeaders = {
```

**✅ XONG! Không cần thay đổi gì khác trong worker.js**

---

## 🔧 Bước 2: Cập nhật `wrangler.toml`

### Backup file cũ
```bash
copy wrangler.toml wrangler.toml.backup
```

### Thay thế toàn bộ nội dung

**Xóa nội dung cũ và thay bằng:**

```toml
# Cloudflare Workers Configuration with Turso
name = "ctv-api"
main = "worker.js"
compatibility_date = "2024-01-01"

# ============================================
# Turso Configuration
# ============================================

[vars]
TURSO_DATABASE_URL = "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io"

# ============================================
# Old D1 Configuration (backup - DO NOT DELETE)
# ============================================
# Keep this commented for rollback if needed
# [[d1_databases]]
# binding = "DB"
# database_name = "vdt"
# database_id = "19917e57-ced3-4fc3-adad-368a2e989ea7"
```

**✅ XONG!**

---

## 🔐 Bước 3: Thêm Turso Auth Token vào Secrets

```bash
npx wrangler secret put TURSO_AUTH_TOKEN
```

**Khi được hỏi, paste token này:**
```
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg
```

**✅ XONG!**

---

## 🧪 Bước 4: Test Local

```bash
# Test worker local
npx wrangler dev
```

**Mở browser và test:**
- http://localhost:8787?action=getAllCTV
- http://localhost:8787?action=getAllProducts

**Nếu thấy dữ liệu trả về → Thành công!**

---

## 🚀 Bước 5: Deploy Production

```bash
# Deploy lên Cloudflare
npx wrangler deploy
```

**Chờ ~30 giây để deploy hoàn tất**

---

## ✅ Bước 6: Verify Production

### Test API endpoint
```bash
curl "https://ctv-api.yendev96.workers.dev?action=getAllCTV"
```

**Nếu thấy dữ liệu trả về → Thành công!**

### Monitor logs
```bash
npx wrangler tail
```

**Xem logs real-time để đảm bảo không có lỗi**

---

## 📊 Kiểm tra Database

```bash
# Verify database connection
node scripts/verify-migration.js
```

**Kết quả mong đợi:**
```
✅ ctv                  - 67 rows
✅ orders               - 11 rows
✅ order_items          - 11 rows
✅ products             - 130 rows
✅ categories           - 17 rows
✅ discounts            - 17 rows
✅ users                - 1 rows
```

---

## 🎯 Tổng kết thay đổi

### File `worker.js`
```diff
  // Cloudflare Worker API for CTV Management System
- // Using D1 Database (SQLite on Edge)
+ // Using Turso Database (Remote SQLite)

  import bcrypt from 'bcryptjs';
+ import { initTurso } from './database/turso-client.js';

  export default {
      async fetch(request, env, ctx) {
+         // Initialize Turso database connection
+         const DB = initTurso(env);
+         env.DB = DB;
+         
          // CORS headers
          const corsHeaders = {
```

### File `wrangler.toml`
```diff
  name = "ctv-api"
  main = "worker.js"
  compatibility_date = "2024-01-01"

- [[d1_databases]]
- binding = "DB"
- database_name = "vdt"
- database_id = "19917e57-ced3-4fc3-adad-368a2e989ea7"

+ [vars]
+ TURSO_DATABASE_URL = "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io"
```

---

## 🆘 Rollback nếu có vấn đề

```bash
# 1. Restore backup
copy wrangler.toml.backup wrangler.toml

# 2. Xóa 3 dòng đã thêm trong worker.js
# - Xóa dòng: import { initTurso } from './database/turso-client.js';
# - Xóa dòng: const DB = initTurso(env);
# - Xóa dòng: env.DB = DB;

# 3. Deploy lại
npx wrangler deploy
```

**Thời gian rollback: ~2 phút**

---

## ❓ FAQ

### Q: Frontend có cần thay đổi không?
**A:** KHÔNG. Frontend vẫn gọi API như cũ, không cần thay đổi gì.

### Q: Dữ liệu có bị mất không?
**A:** KHÔNG. Dữ liệu đã được import đầy đủ vào Turso. D1 vẫn còn nguyên để rollback nếu cần.

### Q: API URL có thay đổi không?
**A:** KHÔNG. Vẫn là `https://ctv-api.yendev96.workers.dev`

### Q: Có downtime không?
**A:** Có, khoảng 2-5 phút trong quá trình deploy.

### Q: Nếu có lỗi thì sao?
**A:** Rollback về D1 trong 2 phút. Dữ liệu D1 vẫn còn nguyên.

### Q: Performance có khác biệt không?
**A:** Turso có thể nhanh hơn nhờ replicas. Nếu muốn tăng tốc thêm, tạo replica ở Singapore:
```bash
turso db replicas create vdt-yendev96 sin
```

---

## 🎉 Hoàn thành!

Sau khi deploy thành công:
- ✅ Worker đã chuyển sang Turso
- ✅ Tất cả API endpoints hoạt động bình thường
- ✅ Frontend không cần thay đổi
- ✅ Dữ liệu đầy đủ và chính xác
- ✅ Có thể rollback về D1 bất cứ lúc nào

**Chúc mừng! Bạn đã migrate thành công sang Turso! 🚀**

---

**Thời gian thực hiện:** 10-15 phút  
**Độ khó:** ⭐⭐☆☆☆ (Dễ)  
**Risk:** Thấp (có thể rollback ngay)
