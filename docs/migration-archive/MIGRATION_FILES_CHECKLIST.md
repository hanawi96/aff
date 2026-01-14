# 📋 Danh sách Files cần cập nhật để chuyển sang Turso

## ✅ Files ĐÃ CHUẨN BỊ SẴN SÀNG

### 1. Database Client
- ✅ `database/turso-client.js` - Adapter Turso tương thích với D1 API

### 2. Environment Configuration
- ✅ `.env` - Chứa TURSO_DATABASE_URL và TURSO_AUTH_TOKEN
- ✅ `wrangler.turso.toml` - Config mẫu cho Turso

### 3. Scripts hỗ trợ
- ✅ `scripts/import-to-turso.js` - Import data vào Turso
- ✅ `scripts/fix-triggers.js` - Tạo lại triggers
- ✅ `scripts/fix-order-items.js` - Import order_items
- ✅ `scripts/verify-migration.js` - Verify migration
- ✅ `scripts/check-schema.js` - Kiểm tra schema

### 4. Documentation
- ✅ `MIGRATION_TO_TURSO.md` - Hướng dẫn chi tiết
- ✅ `HUONG_DAN_NHANH.md` - Hướng dẫn nhanh
- ✅ `MIGRATION_CHECKLIST.md` - Checklist theo dõi
- ✅ `IMPORT_REPORT.md` - Báo cáo import

## 🔧 FILES CẦN CẬP NHẬT

### 1. ⚠️ QUAN TRỌNG: `worker.js` (File chính)

**Vị trí:** Root directory  
**Thay đổi:** Thêm import và khởi tạo Turso

**Cần thêm vào đầu file:**
```javascript
import { initTurso } from './database/turso-client.js';
```

**Cần thêm vào trong `fetch()` function (sau dòng 7):**
```javascript
export default {
    async fetch(request, env, ctx) {
        // Initialize Turso database connection
        const DB = initTurso(env);
        env.DB = DB;
        
        // CORS headers
        const corsHeaders = {
            // ... rest of code
```

**Số dòng sử dụng env.DB:** ~500+ lần  
**Lý do:** Tất cả database queries đều dùng env.DB  
**Ảnh hưởng:** Không cần thay đổi logic, chỉ thêm initialization

---

### 2. ⚠️ QUAN TRỌNG: `wrangler.toml` (Configuration)

**Vị trí:** Root directory  
**Thay đổi:** Thay D1 config bằng Turso config

**Hiện tại:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "vdt"
database_id = "19917e57-ced3-4fc3-adad-368a2e989ea7"
```

**Cần thay bằng:**
```toml
# Comment hoặc xóa D1 config
# [[d1_databases]]
# binding = "DB"
# database_name = "vdt"
# database_id = "19917e57-ced3-4fc3-adad-368a2e989ea7"

# Thêm Turso config
[vars]
TURSO_DATABASE_URL = "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io"

# Auth token sẽ được thêm vào secrets (không commit)
```

**Lý do:** Cloudflare Workers cần biết sử dụng Turso thay vì D1

---

### 3. `package.json` (Dependencies)

**Vị trí:** Root directory  
**Thay đổi:** Cập nhật description và scripts

**Hiện tại:**
```json
{
  "description": "Hệ Thống Cộng Tác Viên - Mẹ & Bé (Cloudflare D1)",
  "scripts": {
    "db:create": "wrangler d1 create ctv-database",
    "db:migrate": "wrangler d1 execute ctv-database --file=database/schema.sql",
    "db:query": "wrangler d1 execute ctv-database --command",
    "db:backup": "wrangler d1 export ctv-database --output=database/backup.sql"
  }
}
```

**Cần cập nhật:**
```json
{
  "description": "Hệ Thống Cộng Tác Viên - Mẹ & Bé (Turso Database)",
  "scripts": {
    "db:shell": "turso db shell vdt-yendev96",
    "db:backup": "turso db shell vdt-yendev96 .dump > database/backup.sql",
    "db:verify": "node scripts/verify-migration.js",
    "db:replicas": "turso db replicas list vdt-yendev96"
  }
}
```

**Lý do:** Cập nhật scripts để phù hợp với Turso CLI

---

### 4. `.gitignore` (Security)

**Vị trí:** Root directory  
**Thay đổi:** Đảm bảo .env không bị commit

**Cần thêm (nếu chưa có):**
```
# Environment variables (contains sensitive tokens)
.env
.env.local
.env.production

# Turso credentials
.turso/

# Backups
backups/*.sql
d1_*.sql
```

**Lý do:** Bảo mật token và credentials

---

## 📝 FILES KHÔNG CẦN THAY ĐỔI

### Frontend Files (public/)
- ✅ `public/assets/js/config.js` - API_URL vẫn giữ nguyên
- ✅ `public/**/*.html` - Không cần thay đổi
- ✅ `public/**/*.js` - Tất cả API calls vẫn hoạt động bình thường

**Lý do:** Frontend chỉ gọi API endpoint, không quan tâm backend dùng D1 hay Turso

### Database Files
- ✅ `database/schema.sql` - Giữ nguyên cho reference
- ✅ `database/migrations/*.sql` - Giữ nguyên cho reference
- ✅ `database/*.js` - Migration scripts cũ, giữ lại

**Lý do:** Dữ liệu đã được import vào Turso, giữ lại để tham khảo

### Other Files
- ✅ `sync-to-sheets.js` - Vẫn hoạt động bình thường
- ✅ `google-apps-script/` - Không liên quan
- ✅ `functions/` - Không liên quan

---

## 🚀 THỰC HIỆN CẬP NHẬT

### Bước 1: Backup files quan trọng
```bash
# Backup worker.js
copy worker.js worker.js.backup

# Backup wrangler.toml
copy wrangler.toml wrangler.toml.backup

# Backup package.json
copy package.json package.json.backup
```

### Bước 2: Cập nhật worker.js
```javascript
// Thêm import ở đầu file (sau dòng 4)
import { initTurso } from './database/turso-client.js';

// Thêm initialization trong fetch() (sau dòng 7)
export default {
    async fetch(request, env, ctx) {
        // Initialize Turso database connection
        const DB = initTurso(env);
        env.DB = DB;
        
        // ... rest of code remains unchanged
```

### Bước 3: Cập nhật wrangler.toml
```toml
name = "ctv-api"
main = "worker.js"
compatibility_date = "2024-01-01"

# Comment D1 config
# [[d1_databases]]
# binding = "DB"
# database_name = "vdt"
# database_id = "19917e57-ced3-4fc3-adad-368a2e989ea7"

# Add Turso config
[vars]
TURSO_DATABASE_URL = "libsql://vdt-yendev96.aws-ap-northeast-1.turso.io"
```

### Bước 4: Thêm Turso token vào Wrangler secrets
```bash
npx wrangler secret put TURSO_AUTH_TOKEN
# Paste token khi được hỏi: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### Bước 5: Cập nhật package.json
```json
{
  "description": "Hệ Thống Cộng Tác Viên - Mẹ & Bé (Turso Database)",
  "scripts": {
    "dev": "npx http-server public -p 8080 -o",
    "dev:worker": "wrangler dev",
    "build": "echo 'Static site - no build needed'",
    "deploy": "wrangler deploy",
    "deploy:pages": "wrangler pages publish public --project-name=ctv-system",
    "db:shell": "turso db shell vdt-yendev96",
    "db:backup": "turso db shell vdt-yendev96 .dump > database/backup.sql",
    "db:verify": "node scripts/verify-migration.js",
    "db:replicas": "turso db replicas list vdt-yendev96",
    "migrate:sheets": "node database/migrate-from-sheets.js",
    "logs": "wrangler tail",
    "test": "echo 'No tests yet'"
  }
}
```

### Bước 6: Cập nhật .gitignore
```
# Environment variables
.env
.env.local
.env.production

# Turso
.turso/

# Backups
backups/*.sql
d1_*.sql
d1_remote_export.sql
d1_full_export.sql

# Wrangler
.wrangler/
wrangler.toml.backup
worker.js.backup
```

---

## ✅ KIỂM TRA SAU KHI CẬP NHẬT

### 1. Kiểm tra syntax
```bash
# Kiểm tra worker.js có lỗi syntax không
node --check worker.js
```

### 2. Test local
```bash
# Chạy worker local
npm run dev:worker

# Hoặc
npx wrangler dev
```

### 3. Test API endpoints
```bash
# Test getAllCTV
curl "http://localhost:8787?action=getAllCTV"

# Test verifySession
curl "http://localhost:8787?action=verifySession" -H "Authorization: Bearer your-token"
```

### 4. Verify database connection
```bash
# Chạy verify script
npm run db:verify
```

### 5. Deploy staging (nếu có)
```bash
# Deploy lên staging environment
npx wrangler deploy --env staging
```

### 6. Deploy production
```bash
# Deploy lên production
npx wrangler deploy

# Monitor logs
npx wrangler tail
```

---

## 📊 TỔNG KẾT

### Files cần cập nhật: 4 files
1. ✏️ `worker.js` - Thêm 3 dòng code
2. ✏️ `wrangler.toml` - Thay D1 config bằng Turso config
3. ✏️ `package.json` - Cập nhật scripts (optional)
4. ✏️ `.gitignore` - Thêm .env (nếu chưa có)

### Files không cần thay đổi: ~100+ files
- ✅ Tất cả frontend files
- ✅ Tất cả database schema files
- ✅ Tất cả migration files
- ✅ Tất cả HTML/CSS files

### Thời gian ước tính: 10-15 phút
- Backup files: 2 phút
- Cập nhật code: 5 phút
- Test local: 3 phút
- Deploy: 5 phút

### Downtime: ~2-5 phút
- Chỉ trong quá trình deploy
- Có thể rollback ngay nếu có vấn đề

---

## 🆘 ROLLBACK PLAN

Nếu có vấn đề sau khi deploy:

```bash
# 1. Restore backup files
copy worker.js.backup worker.js
copy wrangler.toml.backup wrangler.toml

# 2. Deploy lại version cũ
npx wrangler deploy

# 3. Verify D1 vẫn hoạt động
curl "https://ctv-api.yendev96.workers.dev?action=getAllCTV"
```

**Thời gian rollback:** ~2 phút

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Kiểm tra logs: `npx wrangler tail`
2. Verify database: `npm run db:verify`
3. Check Turso status: `turso db show vdt-yendev96`
4. Rollback nếu cần thiết

---

**Người thực hiện:** _________________  
**Ngày cập nhật:** _________________  
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Completed | ⬜ Rolled Back
