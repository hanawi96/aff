# R2 Public Access Setup

## Vấn đề hiện tại
- Ảnh đã upload lên R2 thành công (149 files)
- Database đã update URLs
- NHƯNG: R2 bucket chưa có public access → ảnh không hiển thị được

## Giải pháp: 2 options

### Option 1: R2 Custom Domain (Khuyên dùng - Miễn phí)

1. **Vào Cloudflare Dashboard**
   - https://dash.cloudflare.com
   - Chọn account → R2 → vdt-image bucket

2. **Settings → Public Access**
   - Click "Connect Domain"
   - Chọn domain của bạn (ví dụ: `yendev96.workers.dev`)
   - Subdomain: `images` (hoặc tên khác)
   - Kết quả: `images.yendev96.workers.dev`

3. **Update URLs trong code**
   - Thay đổi base URL từ:
     ```
     https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image
     ```
   - Sang:
     ```
     https://images.yendev96.workers.dev
     ```

4. **Update database**
   ```sql
   UPDATE products 
   SET image_url = REPLACE(
       image_url, 
       'https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image',
       'https://images.yendev96.workers.dev'
   )
   WHERE image_url LIKE '%r2.cloudflarestorage.com%';
   ```

### Option 2: R2.dev Subdomain (Đơn giản nhất)

1. **Vào Cloudflare Dashboard**
   - R2 → vdt-image bucket → Settings

2. **Enable R2.dev subdomain**
   - Click "Allow Access"
   - Sẽ được URL dạng: `https://pub-xxxxx.r2.dev`

3. **Update URLs**
   - Thay base URL sang `https://pub-xxxxx.r2.dev`

⚠️ **Lưu ý**: R2.dev subdomain có rate limit, không nên dùng cho production.

### Option 3: Custom Domain với DNS riêng

Nếu bạn có domain riêng (ví dụ: `example.com`):

1. Add CNAME record:
   ```
   images.example.com → pub-xxxxx.r2.dev
   ```

2. Connect domain trong R2 settings

3. Update URLs sang `https://images.example.com`

## Khuyến nghị

**Dùng Option 1** - R2 Custom Domain với workers.dev subdomain:
- ✅ Miễn phí
- ✅ Không giới hạn bandwidth
- ✅ CDN tự động
- ✅ HTTPS mặc định

## Sau khi setup xong

1. Test URL mới:
   ```
   https://images.yendev96.workers.dev/assets/images/banner.webp
   ```

2. Update database URLs

3. Update upload service để dùng URL mới

4. Verify trên website
