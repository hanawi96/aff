# 🎉 Hướng Dẫn Sử Dụng Tính Năng Sự Kiện & Ngày Lễ

## 📋 Tổng Quan

Tính năng mới cho phép bạn quản lý mã giảm giá theo **sự kiện/chiến dịch** (Tết, 8/3, Black Friday, Giáng sinh...) một cách có tổ chức và dễ tracking.

---

## 🚀 Cài Đặt

### Bước 1: Chạy Migration Database
```bash
cd database
node run-migration-056.js
```

### Bước 2: Deploy Backend
```bash
npm run deploy
# hoặc
wrangler deploy
```

### Bước 3: Kiểm tra
- Mở trang: `http://localhost:5500/public/admin/discounts.html`
- Click tab **"Sự kiện & Ngày lễ"**
- Nếu thấy giao diện → Thành công! ✅

---

## 💡 Cách Sử Dụng

### 1. Tạo Sự Kiện Mới

**Bước 1:** Click nút **"Tạo sự kiện mới"** (màu tím)

**Bước 2:** Điền thông tin:
- **Tên sự kiện**: VD: "Tết Nguyên Đán 2025"
- **Icon**: Chọn emoji phù hợp (🧧, 💐, 🎄, 🎂)
- **Slug**: Tự động tạo từ tên (VD: "tet-2025")
- **Mô tả**: Mô tả ngắn về sự kiện
- **Ngày bắt đầu/kết thúc**: Chọn khoảng thời gian
- **Mục tiêu** (tùy chọn):
  - Số đơn hàng mục tiêu: VD: 500 đơn
  - Doanh thu mục tiêu: VD: 50,000,000đ

**Bước 3:** Click **"Lưu sự kiện"**

---

### 2. Tạo Mã Giảm Giá Cho Sự Kiện

**Cách 1: Tạo mã mới và gán vào sự kiện**
1. Vào tab **"Quản lý mã"**
2. Click **"Tạo mã mới"**
3. Điền thông tin mã như bình thường
4. Ở phần **"Sự kiện"** (sẽ thêm sau), chọn sự kiện tương ứng
5. Lưu mã

**Cách 2: Gán mã có sẵn vào sự kiện** (Tính năng sẽ bổ sung)
1. Chọn mã cần gán
2. Click "Sửa"
3. Chọn sự kiện
4. Lưu

---

### 3. Xem Thống Kê Sự Kiện

Mỗi sự kiện hiển thị:
- **Số mã giảm giá** trong sự kiện
- **Lượt sử dụng** tổng cộng
- **Tổng tiền đã giảm**
- **Tiến độ mục tiêu** (nếu có set mục tiêu)
- **Thời gian còn lại** hoặc đã qua

---

### 4. Quản Lý Sự Kiện

**Sửa sự kiện:**
- Click nút **"Sửa"** trên card sự kiện
- Cập nhật thông tin
- Lưu

**Xóa sự kiện:**
- Click nút **"Xóa"**
- Xác nhận
- **Lưu ý:** Chỉ xóa được nếu chưa có mã nào trong sự kiện

**Xem chi tiết:**
- Click **"Xem chi tiết"**
- Xem danh sách mã trong sự kiện
- Xem thống kê chi tiết

---

## 📊 Phân Loại Sự Kiện

Hệ thống tự động phân loại sự kiện thành 3 nhóm:

### 🔥 Đang diễn ra
- Sự kiện đang trong thời gian hoạt động
- Hiển thị card lớn với thống kê đầy đủ
- Hiển thị tiến độ mục tiêu

### 📅 Sắp diễn ra
- Sự kiện chưa bắt đầu
- Hiển thị card nhỏ
- Hiển thị "Còn X ngày nữa"

### ✅ Đã kết thúc
- Sự kiện đã qua
- Hiển thị card nhỏ
- Hiển thị "X ngày trước"

---

## 🎯 Ví Dụ Thực Tế

### Ví dụ 1: Tết Nguyên Đán 2025

```
Tên: Tết Nguyên Đán 2025
Icon: 🧧
Slug: tet-2025
Thời gian: 28/01/2025 - 05/02/2025
Mục tiêu: 500 đơn, 50tr doanh thu

Các mã trong sự kiện:
- TET2025 (Giảm 50k)
- TETLON (Giảm 100k)
- TETMOI (Giảm 20%)
- TETGIFT (Tặng quà)
- TETSHIP (Freeship)
```

### Ví dụ 2: Quốc Tế Phụ Nữ 8/3

```
Tên: Quốc Tế Phụ Nữ 8/3
Icon: 💐
Slug: 8-3-2025
Thời gian: 05/03/2025 - 10/03/2025
Mục tiêu: 300 đơn

Các mã trong sự kiện:
- WOMEN83 (Giảm 30k)
- LADYDAY (Giảm 15%)
- GIFT83 (Tặng quà)
```

### Ví dụ 3: Black Friday

```
Tên: Black Friday 2025
Icon: 🛍️
Slug: black-friday-2025
Thời gian: 28/11/2025 - 30/11/2025
Mục tiêu: 1000 đơn, 100tr doanh thu

Các mã trong sự kiện:
- BLACKFRIDAY (Giảm 50%)
- FRIDAY50 (Giảm 50k)
- MEGASALE (Giảm 100k)
```

---

## 🔧 API Endpoints

### GET Campaigns
```javascript
POST /api
{
  "action": "getAllCampaigns"
}
```

### CREATE Campaign
```javascript
POST /api
{
  "action": "createCampaign",
  "name": "Tết 2025",
  "slug": "tet-2025",
  "icon": "🧧",
  "description": "...",
  "start_date": "2025-01-28",
  "end_date": "2025-02-05",
  "target_orders": 500,
  "target_revenue": 50000000,
  "is_active": 1
}
```

### UPDATE Campaign
```javascript
POST /api
{
  "action": "updateCampaign",
  "id": 1,
  "name": "...",
  // ... other fields
}
```

### DELETE Campaign
```javascript
POST /api
{
  "action": "deleteCampaign",
  "id": 1
}
```

---

## 📝 Lưu Ý Quan Trọng

1. **Slug phải unique**: Không được trùng với sự kiện khác
2. **Ngày kết thúc > Ngày bắt đầu**: Hệ thống sẽ validate
3. **Xóa sự kiện**: Chỉ xóa được nếu chưa có mã nào
4. **Mã không bắt buộc thuộc sự kiện**: Mã có thể tồn tại độc lập
5. **Mục tiêu là tùy chọn**: Không bắt buộc phải set

---

## 🎨 Tính Năng Sẽ Bổ Sung

- [ ] Gán mã vào sự kiện khi tạo/sửa mã
- [ ] Xem chi tiết sự kiện (danh sách mã, thống kê)
- [ ] Tạo nhiều mã cùng lúc cho 1 sự kiện
- [ ] Template sự kiện (lưu và tái sử dụng)
- [ ] Export báo cáo theo sự kiện
- [ ] Timeline view (xem lịch cả năm)
- [ ] Duplicate sự kiện từ năm trước

---

## 🐛 Troubleshooting

### Lỗi: "Campaign slug already exists"
→ Slug đã tồn tại, đổi slug khác

### Lỗi: "Cannot delete campaign with existing discounts"
→ Xóa hoặc gỡ các mã ra khỏi sự kiện trước

### Không thấy tab "Sự kiện & Ngày lễ"
→ Kiểm tra đã chạy migration chưa

### Không load được danh sách sự kiện
→ Kiểm tra backend đã deploy chưa

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Console log trong browser (F12)
2. Network tab để xem API response
3. Database có bảng `discount_campaigns` chưa

---

**Chúc bạn sử dụng tính năng hiệu quả! 🎉**
