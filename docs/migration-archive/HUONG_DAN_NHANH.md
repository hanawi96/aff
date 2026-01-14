# 🚀 Hướng dẫn nhanh: Chuyển từ D1 sang Turso

## Tại sao nên chuyển?

**Cloudflare D1** là SQLite trên edge, nhưng có giới hạn:
- ❌ Chỉ truy cập được từ Workers
- ❌ Không có replicas
- ❌ Khó backup và restore
- ❌ CLI hạn chế

**Turso** là remote SQLite với nhiều tính năng hơn:
- ✅ Truy cập từ mọi nơi (không chỉ Workers)
- ✅ Replicas gần người dùng (Singapore cho VN)
- ✅ Point-in-time recovery
- ✅ Database branching để test
- ✅ CLI mạnh mẽ

## 3 bước đơn giản

### Bước 1: Export dữ liệu từ D1 (5 phút)

```bash
# Chạy script có sẵn
scripts\export-d1-data.bat

# Hoặc chạy thủ công
npx wrangler d1 export vdt --output=backup.sql
```

### Bước 2: Setup Turso (10 phút)

```bash
# Cài đặt Turso CLI
npm install -g @turso/cli

# Đăng ký/đăng nhập
turso auth signup

# Tạo database
turso db create vdt-production

# Import dữ liệu
turso db shell vdt-production < backup.sql

# Lấy thông tin kết nối
turso db show vdt-production --url
turso db tokens create vdt-production
```

Lưu 2 thông tin này:
- **URL**: `libsql://xxx.turso.io`
- **Token**: `eyJhbGc...`

### Bước 3: Cập nhật code (15 phút)

```bash
# Cài đặt Turso SDK
npm install @libsql/client

# Thêm token vào Wrangler
npx wrangler secret put TURSO_AUTH_TOKEN
# (paste token khi được hỏi)
```

Sửa file `worker.js`, thêm vào đầu file:

```javascript
import { initTurso } from './database/turso-client.js';

export default {
    async fetch(request, env, ctx) {
        // Thêm 2 dòng này
        const DB = initTurso(env);
        env.DB = DB;
        
        // ... code cũ giữ nguyên
    }
}
```

Sửa file `wrangler.toml`:

```toml
name = "ctv-api"
main = "worker.js"
compatibility_date = "2024-01-01"

# Thêm phần này
[vars]
TURSO_DATABASE_URL = "libsql://xxx.turso.io"  # URL của bạn

# Comment hoặc xóa phần D1
# [[d1_databases]]
# binding = "DB"
# ...
```

Test và deploy:

```bash
# Test local
npm run dev

# Deploy production
npx wrangler deploy
```

## ✅ Xong!

Code của bạn vẫn hoạt động y như cũ, nhưng giờ dùng Turso thay vì D1.

## 🎁 Bonus: Tăng tốc cho người dùng Việt Nam

```bash
# Tạo replica ở Singapore (gần VN nhất)
turso db replicas create vdt-production sin

# Kiểm tra
turso db replicas list vdt-production
```

Turso sẽ tự động route requests đến replica gần nhất!

## 📞 Cần trợ giúp?

1. Đọc chi tiết: `MIGRATION_TO_TURSO.md`
2. Theo dõi checklist: `MIGRATION_CHECKLIST.md`
3. Verify migration: `node scripts/verify-migration.js`

## ⚠️ Lưu ý quan trọng

- **Không xóa D1** cho đến khi Turso chạy ổn định 1 tuần
- **Backup thường xuyên** trong giai đoạn đầu
- **Monitor logs** sau khi deploy: `npx wrangler tail`

## 💰 Chi phí

**Turso Free Tier:**
- 9 GB storage
- 1 billion rows read/month
- 25 million rows written/month
- 3 databases
- 3 locations

→ Đủ cho hầu hết các dự án nhỏ và vừa!

## 🔄 Rollback nếu có vấn đề

```bash
# Restore code cũ từ backup
# Restore wrangler.toml cũ
# Deploy lại
npx wrangler deploy
```

D1 vẫn còn nguyên, chỉ mất ~2 phút để rollback!
