# Hướng dẫn Migration từ Cloudflare D1 sang Turso

## 📋 Tổng quan

Turso là remote SQLite database được xây dựng trên libSQL (fork của SQLite), tương thích 100% với D1. Migration này sẽ giữ nguyên cấu trúc database và code logic.

## 🎯 Lợi ích khi chuyển sang Turso

- ✅ **Remote database** thực sự - truy cập từ mọi nơi
- ✅ **Replicas** - đặt database gần người dùng hơn
- ✅ **Embedded replicas** - sync local cho tốc độ cao
- ✅ **Branching** - tạo nhánh database để test
- ✅ **Point-in-time recovery** - khôi phục dữ liệu
- ✅ **CLI mạnh mẽ** - dễ quản lý hơn D1

## 📦 Bước 1: Cài đặt Turso CLI

```bash
# Windows (PowerShell)
irm get.tur.so/install.ps1 | iex

# Hoặc dùng npm
npm install -g @turso/cli
```

## 🔐 Bước 2: Đăng ký và đăng nhập Turso

```bash
# Đăng ký/đăng nhập
turso auth signup

# Hoặc nếu đã có tài khoản
turso auth login
```

## 🗄️ Bước 3: Export dữ liệu từ D1

```bash
# Export toàn bộ database D1 ra file SQL
npx wrangler d1 export vdt --output=d1_backup.sql

# Hoặc export từng bảng cụ thể
npx wrangler d1 execute vdt --command=".dump" > d1_full_dump.sql
```

## 🆕 Bước 4: Tạo database mới trên Turso

```bash
# Tạo database
turso db create vdt-production

# Lấy database URL
turso db show vdt-production

# Tạo auth token
turso db tokens create vdt-production
```

Lưu lại 2 thông tin quan trọng:
- **Database URL**: `libsql://[your-db].turso.io`
- **Auth Token**: `eyJhbGc...` (token dài)

## 📥 Bước 5: Import dữ liệu vào Turso

### Cách 1: Import từ file SQL

```bash
# Import file SQL đã export
turso db shell vdt-production < d1_backup.sql
```

### Cách 2: Import từng bước (an toàn hơn)

```bash
# Mở shell
turso db shell vdt-production

# Trong shell, chạy từng file migration
.read database/schema.sql
.read database/discounts_schema.sql
.read database/migrations/033_create_auth_tables.sql
```

## 🔧 Bước 6: Cập nhật code Worker

### 6.1. Cài đặt Turso SDK

```bash
npm install @libsql/client
```

### 6.2. Tạo file cấu hình mới

Tạo file `.env` (không commit vào git):

```env
TURSO_DATABASE_URL=libsql://[your-db].turso.io
TURSO_AUTH_TOKEN=eyJhbGc...
```

### 6.3. Cập nhật wrangler.toml

```toml
name = "ctv-api"
main = "worker.js"
compatibility_date = "2024-01-01"

# Xóa hoặc comment D1 config
# [[d1_databases]]
# binding = "DB"
# database_name = "vdt"
# database_id = "19917e57-ced3-4fc3-adad-368a2e989ea7"

# Thêm Turso config
[vars]
TURSO_DATABASE_URL = "libsql://[your-db].turso.io"

# Auth token nên dùng secret
# Chạy: npx wrangler secret put TURSO_AUTH_TOKEN
```

### 6.4. Thêm Turso auth token vào secrets

```bash
npx wrangler secret put TURSO_AUTH_TOKEN
# Paste token khi được hỏi
```

## 🔄 Bước 7: Cập nhật Worker code

Tạo file `database/turso-client.js`:

```javascript
import { createClient } from '@libsql/client';

let tursoClient = null;

export function getTursoClient(env) {
  if (!tursoClient) {
    tursoClient = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }
  return tursoClient;
}

// Wrapper để giữ nguyên API như D1
export class TursoAdapter {
  constructor(client) {
    this.client = client;
  }

  prepare(sql) {
    return {
      bind: (...params) => ({
        first: async () => {
          const result = await this.client.execute({
            sql,
            args: params,
          });
          return result.rows[0] || null;
        },
        all: async () => {
          const result = await this.client.execute({
            sql,
            args: params,
          });
          return { results: result.rows };
        },
        run: async () => {
          const result = await this.client.execute({
            sql,
            args: params,
          });
          return {
            success: true,
            meta: {
              changes: result.rowsAffected,
              last_row_id: result.lastInsertRowid,
            },
          };
        },
      }),
    };
  }
}
```

Cập nhật `worker.js`:

```javascript
import { getTursoClient, TursoAdapter } from './database/turso-client.js';

export default {
  async fetch(request, env, ctx) {
    // Khởi tạo Turso client
    const tursoClient = getTursoClient(env);
    const DB = new TursoAdapter(tursoClient);
    
    // Thêm DB vào env để code cũ vẫn hoạt động
    env.DB = DB;
    
    // ... rest of your code remains the same
  }
};
```

## ✅ Bước 8: Kiểm tra Migration

### 8.1. Verify dữ liệu

```bash
# Kiểm tra số lượng records
turso db shell vdt-production

SELECT 'CTV count:', COUNT(*) FROM ctv;
SELECT 'Orders count:', COUNT(*) FROM orders;
SELECT 'Products count:', COUNT(*) FROM products;
SELECT 'Order Items count:', COUNT(*) FROM order_items;
```

### 8.2. Test local

```bash
# Test worker locally
npm run dev
# hoặc
npx wrangler dev
```

### 8.3. Deploy lên production

```bash
# Deploy
npx wrangler deploy

# Kiểm tra logs
npx wrangler tail
```

## 🎨 Bước 9: Tối ưu hóa với Turso

### 9.1. Tạo replicas gần người dùng

```bash
# Tạo replica ở Singapore (gần Việt Nam)
turso db replicas create vdt-production sin

# Xem danh sách replicas
turso db replicas list vdt-production
```

### 9.2. Sử dụng Embedded Replicas (tùy chọn)

Để tăng tốc độ đọc, bạn có thể dùng embedded replicas:

```javascript
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:local.db', // Local cache
  syncUrl: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
  syncInterval: 60, // Sync mỗi 60 giây
});

// Sync thủ công khi cần
await client.sync();
```

### 9.3. Tạo database branches để test

```bash
# Tạo branch từ production
turso db create vdt-staging --from-db vdt-production

# Test trên staging trước khi apply lên production
```

## 🔒 Bước 10: Backup và Recovery

### Backup tự động

```bash
# Turso tự động backup, nhưng bạn có thể export thủ công
turso db shell vdt-production ".dump" > backup_$(date +%Y%m%d).sql
```

### Point-in-time recovery

```bash
# Khôi phục về thời điểm cụ thể
turso db create vdt-restored --from-db vdt-production --timestamp "2024-01-14T10:00:00Z"
```

## 📊 So sánh D1 vs Turso

| Tính năng | Cloudflare D1 | Turso |
|-----------|---------------|-------|
| Remote access | ❌ Chỉ từ Workers | ✅ Từ mọi nơi |
| Replicas | ❌ | ✅ Multi-region |
| Branching | ❌ | ✅ |
| Point-in-time recovery | ❌ | ✅ |
| CLI | Cơ bản | Mạnh mẽ |
| Pricing | Free tier tốt | Free tier: 9GB storage, 1B rows read/month |
| Latency | Thấp (edge) | Thấp (với replicas) |

## ⚠️ Lưu ý quan trọng

1. **Timestamps**: Code của bạn đã dùng UTC timestamps, Turso hoàn toàn tương thích
2. **Triggers**: Tất cả triggers sẽ hoạt động bình thường
3. **Foreign Keys**: Turso hỗ trợ đầy đủ
4. **Transactions**: Turso hỗ trợ transactions tốt hơn D1
5. **Connection pooling**: Turso tự động quản lý connections

## 🆘 Troubleshooting

### Lỗi: "database is locked"

```javascript
// Thêm timeout và retry
const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
  intMode: 'number', // Xử lý INTEGER đúng cách
});
```

### Lỗi: "UNIQUE constraint failed"

Kiểm tra dữ liệu trùng lặp trước khi import:

```sql
-- Tìm duplicates
SELECT referral_code, COUNT(*) 
FROM ctv 
GROUP BY referral_code 
HAVING COUNT(*) > 1;
```

## 🎯 Kết luận

Migration từ D1 sang Turso rất đơn giản vì cả hai đều dùng SQLite. Bạn sẽ có:
- ✅ Remote database thực sự
- ✅ Tốc độ cao với replicas
- ✅ Backup và recovery tốt hơn
- ✅ Công cụ quản lý mạnh mẽ hơn

Toàn bộ code logic của bạn không cần thay đổi nhiều nhờ adapter layer!
