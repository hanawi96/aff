# Hướng dẫn Fix CORS cho R2 Bucket

## Vấn đề hiện tại
Upload ảnh thành công nhưng không thể preview được do CORS policy của R2 bucket.

## Giải pháp

### 1. Cấu hình CORS cho R2 Bucket

Truy cập Cloudflare Dashboard và cấu hình CORS cho bucket `vdt-image`:

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. Cách cấu hình qua Cloudflare Dashboard

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Chọn account của bạn
3. Vào **R2 Object Storage**
4. Chọn bucket **vdt-image**
5. Vào tab **Settings**
6. Tìm mục **CORS policy**
7. Thêm cấu hình CORS ở trên

### 3. Cách cấu hình qua Wrangler CLI

```bash
# Tạo file cors.json
echo '[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]' > cors.json

# Áp dụng CORS policy
wrangler r2 bucket cors put vdt-image --file cors.json
```

### 4. Kiểm tra CORS đã hoạt động

```bash
# Kiểm tra CORS policy hiện tại
wrangler r2 bucket cors get vdt-image
```

## Lưu ý

- Sau khi cấu hình CORS, có thể mất vài phút để có hiệu lực
- Nếu vẫn gặp vấn đề, thử clear cache browser
- Có thể cần restart Cloudflare Workers sau khi cấu hình

## Kiểm tra hoạt động

Sau khi cấu hình CORS:
1. Upload một ảnh mới
2. Kiểm tra xem ảnh có hiển thị preview không
3. Mở Developer Tools để xem có còn lỗi CORS không

## Backup Solution

Nếu CORS vẫn không hoạt động, hệ thống đã có fallback:
- Hiển thị placeholder với nút "Xem ảnh"
- Click vào placeholder sẽ mở ảnh trong tab mới
- Upload vẫn thành công, chỉ preview bị ảnh hưởng