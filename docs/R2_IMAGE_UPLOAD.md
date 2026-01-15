# R2 Image Upload - Hướng dẫn sử dụng

## Tổng quan
Hệ thống đã tích hợp Cloudflare R2 Storage để lưu trữ ảnh sản phẩm.

## Thông tin R2 Bucket
- **Bucket Name**: `vdt-image`
- **Endpoint**: `https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image`
- **Binding**: `R2_BUCKET` (trong Worker)

## Cách sử dụng

### 1. Upload ảnh từ giao diện
1. Mở modal tạo/sửa sản phẩm
2. Tìm field "Ảnh sản phẩm"
3. Click button "Upload" (màu tím)
4. Chọn file ảnh (JPG, PNG, WebP, GIF)
5. Đợi upload hoàn tất
6. URL ảnh sẽ tự động điền vào field

### 2. Giới hạn
- **Kích thước tối đa**: 5MB/ảnh
- **Định dạng hỗ trợ**: JPG, PNG, WebP, GIF, SVG
- **Tên file**: Tự động generate unique (timestamp + random)

### 3. Cấu trúc lưu trữ
```
vdt-image/
└── products/
    ├── 1736912345678-abc123.jpg
    ├── 1736912456789-def456.png
    └── ...
```

## API Endpoint

### Upload Image
```
POST /api?action=uploadImage
Content-Type: multipart/form-data

FormData:
- image: File (required)
- filename: String (optional)

Response:
{
  "success": true,
  "url": "https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image/products/1736912345678-abc123.jpg",
  "filename": "products/1736912345678-abc123.jpg"
}
```

## Files liên quan
- **Backend**: `src/services/upload/image-upload.js`
- **Handler**: `src/handlers/post-handler.js`
- **Frontend**: `public/assets/js/products.js` (function `handleImageUpload`)
- **Config**: `wrangler.toml` (R2 binding)

## Chi phí
- **Storage**: 10GB miễn phí/tháng
- **Requests**: 1 triệu requests miễn phí/tháng
- **Bandwidth**: MIỄN PHÍ (không giới hạn)

## Lưu ý
- Ảnh được lưu vĩnh viễn trên R2, không tự động xóa
- URL ảnh public, ai cũng có thể truy cập
- Nên optimize ảnh trước khi upload để tiết kiệm storage
