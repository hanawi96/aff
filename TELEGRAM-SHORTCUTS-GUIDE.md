# ⭐⭐⭐ Telegram Bot Shortcuts - Hướng Dẫn Nhanh

## Thống Kê Nhanh (Quick Stats)

Các lệnh shortcut giúp bạn xem thống kê nhanh chóng nhất:

| Shortcut | Lệnh Đầy Đủ | Mô Tả | Ví Dụ |
|----------|--------------|-------|-------|
| `/t` | `/today` | Đơn hàng hôm nay | Xem tất cả đơn hàng trong ngày |
| `/y` | `/yesterday` | Doanh thu hôm qua | So sánh với hôm nay |
| `/w` | `/week` | Thống kê tuần này | Từ thứ 2 đến hiện tại |
| `/m` | `/month` | Thống kê tháng này | Từ đầu tháng đến hiện tại |

## Tại Sao Dùng Shortcuts?

✅ **Nhanh hơn**: Chỉ cần gõ 2 ký tự thay vì 5-9 ký tự
✅ **Dễ nhớ**: t = today, y = yesterday, w = week, m = month
✅ **Tiện lợi**: Xem thống kê ngay lập tức khi đang di chuyển

## Ví Dụ Sử Dụng

### Scenario 1: Kiểm tra nhanh doanh thu hôm nay
```
Bạn: /t
Bot: 📊 ĐƠN HÀNG HÔM NAY (07/02/2026)
     📦 Tổng: 5 đơn hàng
     💰 Doanh thu: 1.500.000đ
```

### Scenario 2: So sánh với hôm qua
```
Bạn: /y
Bot: 💰 DOANH THU HÔM QUA (06/02/2026)
     📦 Đơn hàng: 3
     💰 Doanh thu: 900.000đ
```

### Scenario 3: Xem tổng quan tuần
```
Bạn: /w
Bot: 📊 THỐNG KÊ TUẦN NÀY (03/02 - 07/02)
     📦 Tổng đơn hàng: 25
     💰 Doanh thu: 7.500.000đ
```

### Scenario 4: Kiểm tra tháng này
```
Bạn: /m
Bot: 📊 THỐNG KÊ THÁNG 2/2026
     📦 Tổng đơn hàng: 45
     💰 Doanh thu: 13.500.000đ
```

## Tất Cả Lệnh Có Sẵn

### Shortcuts ⭐⭐⭐
- `/t` - Hôm nay
- `/y` - Hôm qua
- `/w` - Tuần này
- `/m` - Tháng này

### Menu & Navigation
- `/menu` - Mở menu với buttons
- `/help` - Xem tất cả lệnh

### Thống Kê Chi Tiết
- `/today` - Đơn hàng hôm nay
- `/yesterday` - Doanh thu hôm qua
- `/week` - Thống kê tuần này
- `/month` - Thống kê tháng này
- `/stats` - Thống kê tổng quan
- `/recent` - 10 đơn hàng gần nhất

### Doanh Thu
- `/revenue` - Tổng quan doanh thu
- `/7days` - Doanh thu 7 ngày qua
- `/30days` - Doanh thu 30 ngày qua

### Tìm Kiếm
- `/find VDT001` - Chi tiết đơn hàng
- `/customer 0123456789` - Lịch sử khách hàng
- `/phone 0123456789` - Tìm theo SĐT
- Hoặc gõ trực tiếp số điện thoại (10 số)

### Báo Cáo
- `/report` - Báo cáo cuối ngày (test)
- Tự động gửi lúc 21:00 mỗi ngày

## Tips & Tricks

💡 **Tip 1**: Dùng shortcuts khi đang bận, dùng menu khi có thời gian
💡 **Tip 2**: Gõ số điện thoại trực tiếp để tìm khách hàng nhanh nhất
💡 **Tip 3**: Dùng `/t` mỗi sáng để kiểm tra đơn hàng mới
💡 **Tip 4**: Dùng `/w` vào cuối tuần để review hiệu suất
💡 **Tip 5**: Dùng `/m` vào cuối tháng để tính doanh thu

## Test Shortcuts

Chạy lệnh sau để test tất cả shortcuts:
```bash
node test-shortcuts.js
```

Hoặc test từng lệnh trong Telegram:
1. Mở chat với bot
2. Gõ `/t` và Enter
3. Xem kết quả
4. Thử các lệnh khác: `/y`, `/w`, `/m`

---

**Lưu ý**: Tất cả thống kê đều tính theo giờ Việt Nam (UTC+7)
