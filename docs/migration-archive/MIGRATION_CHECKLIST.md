# ✅ Checklist Migration từ D1 sang Turso

## 📋 Chuẩn bị (Preparation)

- [ ] Đọc kỹ file `MIGRATION_TO_TURSO.md`
- [ ] Backup toàn bộ code hiện tại
- [ ] Kiểm tra version Node.js >= 18
- [ ] Cài đặt Turso CLI: `npm install -g @turso/cli`
- [ ] Đăng ký tài khoản Turso: `turso auth signup`

## 📤 Export dữ liệu từ D1

- [ ] Chạy script export: `scripts/export-d1-data.bat`
- [ ] Kiểm tra file backup trong folder `backups/`
- [ ] Verify file SQL có đầy đủ dữ liệu (mở bằng text editor)
- [ ] Lưu backup file ở nơi an toàn (Google Drive, USB, etc.)

## 🆕 Tạo Turso Database

- [ ] Login Turso: `turso auth login`
- [ ] Tạo database: `turso db create vdt-production`
- [ ] Lấy database URL: `turso db show vdt-production --url`
- [ ] Tạo auth token: `turso db tokens create vdt-production`
- [ ] Lưu URL và token vào file `.env`

## 📥 Import dữ liệu vào Turso

- [ ] Import schema: `turso db shell vdt-production < database/schema.sql`
- [ ] Import discounts: `turso db shell vdt-production < database/discounts_schema.sql`
- [ ] Import auth tables: `turso db shell vdt-production < database/migrations/033_create_auth_tables.sql`
- [ ] Import data backup: `turso db shell vdt-production < backups/d1_backup_[date].sql`
- [ ] Verify import thành công

## 🔧 Cập nhật Code

- [ ] Cài đặt Turso SDK: `npm install @libsql/client`
- [ ] Copy file `database/turso-client.js` (đã tạo sẵn)
- [ ] Backup file `worker.js` hiện tại
- [ ] Thêm import Turso vào đầu `worker.js`:
  ```javascript
  import { initTurso } from './database/turso-client.js';
  ```
- [ ] Thêm khởi tạo Turso trong `fetch()`:
  ```javascript
  const DB = initTurso(env);
  env.DB = DB;
  ```
- [ ] Backup file `wrangler.toml` hiện tại
- [ ] Copy `wrangler.turso.toml` thành `wrangler.toml`
- [ ] Cập nhật `TURSO_DATABASE_URL` trong `wrangler.toml`
- [ ] Thêm auth token vào secrets: `npx wrangler secret put TURSO_AUTH_TOKEN`

## ✅ Kiểm tra Migration

- [ ] Chạy verify script: `node scripts/verify-migration.js`
- [ ] Kiểm tra số lượng records trong mỗi bảng
- [ ] Verify indexes đã được tạo
- [ ] Verify triggers hoạt động
- [ ] Test query một số bảng quan trọng:
  - [ ] `SELECT COUNT(*) FROM ctv`
  - [ ] `SELECT COUNT(*) FROM orders`
  - [ ] `SELECT COUNT(*) FROM products`
  - [ ] `SELECT COUNT(*) FROM order_items`

## 🧪 Test Local

- [ ] Chạy worker local: `npm run dev`
- [ ] Test API endpoint: GET `/api?action=getAllCTV`
- [ ] Test tạo CTV mới
- [ ] Test tạo order mới
- [ ] Test các chức năng quan trọng:
  - [ ] Login/Authentication
  - [ ] Dashboard stats
  - [ ] CTV management
  - [ ] Order management
  - [ ] Product management
  - [ ] Discount system
- [ ] Kiểm tra logs không có lỗi

## 🚀 Deploy Production

- [ ] Review lại tất cả thay đổi
- [ ] Commit code lên Git (trừ `.env` và secrets)
- [ ] Deploy lên Cloudflare: `npx wrangler deploy`
- [ ] Kiểm tra deployment thành công
- [ ] Test production URL
- [ ] Monitor logs: `npx wrangler tail`

## 🎨 Tối ưu hóa (Optional)

- [ ] Tạo replica ở Singapore: `turso db replicas create vdt-production sin`
- [ ] Verify replica hoạt động: `turso db replicas list vdt-production`
- [ ] Tạo staging database: `turso db create vdt-staging --from-db vdt-production`
- [ ] Setup automatic backups
- [ ] Configure monitoring và alerts

## 📊 Post-Migration

- [ ] Monitor performance trong 24h đầu
- [ ] So sánh response time với D1
- [ ] Kiểm tra error rate
- [ ] Verify tất cả features hoạt động bình thường
- [ ] Update documentation
- [ ] Thông báo team về migration thành công

## 🆘 Rollback Plan (Nếu có vấn đề)

- [ ] Giữ nguyên D1 database (chưa xóa)
- [ ] Backup code với Turso
- [ ] Restore `worker.js` từ backup
- [ ] Restore `wrangler.toml` từ backup
- [ ] Deploy lại version cũ: `npx wrangler deploy`
- [ ] Verify D1 vẫn hoạt động

## 📝 Notes

**Thời gian ước tính:** 2-3 giờ (tùy kích thước dữ liệu)

**Downtime:** ~5-10 phút (trong quá trình deploy)

**Rollback time:** ~2 phút (nếu cần)

**Quan trọng:**
- Không xóa D1 database cho đến khi Turso hoạt động ổn định ít nhất 1 tuần
- Backup dữ liệu thường xuyên trong giai đoạn đầu
- Monitor logs và performance chặt chẽ

## ✨ Lợi ích sau Migration

✅ Remote database - truy cập từ mọi nơi  
✅ Replicas - tốc độ cao hơn với người dùng Việt Nam  
✅ Point-in-time recovery - khôi phục dữ liệu dễ dàng  
✅ Database branching - test features an toàn  
✅ Better CLI tools - quản lý dễ dàng hơn  
✅ Embedded replicas - sync local cho dev  

---

**Người thực hiện:** _________________  
**Ngày bắt đầu:** _________________  
**Ngày hoàn thành:** _________________  
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Completed | ⬜ Rolled Back
