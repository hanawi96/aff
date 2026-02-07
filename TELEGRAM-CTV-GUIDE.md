# 👥 Telegram Bot - Quản Lý CTV

## 🎯 Tổng Quan

Hệ thống quản lý CTV (Cộng Tác Viên) qua Telegram Bot với menu buttons và tự động nhận diện.

---

## 📱 Cách Sử Dụng

### **1. Mở Menu CTV**

Gõ `/menu` → Bấm nút **"👥 CTV"**

Hoặc gõ trực tiếp: `/ctv`

---

## 🎛️ Menu CTV

### **📊 Tổng Quan**
Xem thống kê tổng quan về CTV:
- Tổng số CTV
- CTV đang hoạt động (có đơn hàng)
- CTV mới tháng này
- Tổng hoa hồng đã trả
- Top 3 CTV xuất sắc

**Cách dùng:** Bấm nút "📊 Tổng Quan"

---

### **🏆 Top CTV**
Xem top 10 CTV xuất sắc nhất theo:
- Doanh thu
- Số đơn hàng
- Hoa hồng

**Cách dùng:** Bấm nút "🏆 Top CTV"

**Hiển thị:**
```
🏆 TOP 10 CTV XUẤT SẮC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥇 CTV100004
   👤 Phạm Văn Hùng - 📞 0901234504
   📦 1 đơn | 💰 261.000đ
   🎁 Hoa hồng: 2.400đ
```

---

### **🆕 CTV Mới**
Xem danh sách CTV mới đăng ký trong tháng:
- Thông tin liên hệ
- Trạng thái (đã có đơn chưa)
- Ngày đăng ký

**Cách dùng:** Bấm nút "🆕 CTV Mới"

---

### **⚠️ CTV Không Hoạt Động**
Xem danh sách CTV chưa có đơn hàng nào:
- Thông tin CTV
- Ngày đăng ký
- Gợi ý: Cần liên hệ động viên

**Cách dùng:** Bấm nút "⚠️ Không Hoạt Động"

---

### **💰 Hoa Hồng Tháng Này**
Xem chi tiết hoa hồng cần trả trong tháng:
- Tổng hoa hồng
- Chi tiết từng CTV
- Thông tin ngân hàng (nếu có)
- Số đơn hàng và doanh thu

**Cách dùng:** Bấm nút "💰 Hoa Hồng Tháng Này"

**Hiển thị:**
```
💰 HOA HỒNG THÁNG 2/2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TỔNG QUAN:
• Tổng hoa hồng: 2.400đ
• Số CTV: 1

📋 CHI TIẾT:
1. CTV100004 - Phạm Văn Hùng
   📞 0901234504
   🏦 Vietcombank - 1234567890
   📦 1 đơn | 💰 261.000đ
   🎁 Hoa hồng: 2.400đ
```

---

### **🔍 Tìm CTV**
Hướng dẫn cách tìm kiếm CTV:
- Theo mã CTV
- Theo số điện thoại

**Cách dùng:** Bấm nút "🔍 Tìm CTV"

---

## 🤖 Tự Động Nhận Diện

Bot tự động nhận diện và xử lý khi bạn gõ:

### **1. Mã CTV (CTVxxxxxx)**

Gõ trực tiếp mã CTV, bot sẽ hiển thị thông tin chi tiết:

```
Bạn gõ: CTV100004

Bot trả về:
👤 THÔNG TIN CTV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 CƠ BẢN:
• Tên: Phạm Văn Hùng
• SĐT: 0901234504
• Email: hung.pham@gmail.com
• Địa chỉ: Hà Nội

🔗 MÃ GIỚI THIỆU:
• Code: CTV100004
• Link: shopvd.store/?ref=CTV100004
• Commission: 10%

📊 THỐNG KÊ:
• Tổng đơn: 1
• Doanh thu: 261.000đ
• Hoa hồng: 2.400đ

📦 ĐƠN HÀNG GẦN NHẤT:
1. DH1234567 - 261.000đ (07/02)
```

**Format:** `CTV` + 6 chữ số (VD: CTV100004)

---

### **2. Số Điện Thoại (10 số)**

Gõ số điện thoại, bot sẽ tự động tìm:
1. **Nếu là CTV:** Hiển thị thông tin CTV
2. **Nếu là khách hàng:** Hiển thị lịch sử đơn hàng

```
Bạn gõ: 0901234504

Bot tự động nhận diện và trả về thông tin phù hợp
```

**Format:** 10 chữ số bắt đầu bằng 0 (VD: 0901234504)

---

## 💡 Tips & Tricks

### **Tip 1: Tìm nhanh CTV**
Thay vì vào menu, gõ trực tiếp mã CTV:
```
CTV100004
```

### **Tip 2: Kiểm tra CTV qua SĐT**
Gõ số điện thoại để kiểm tra xem có phải CTV không:
```
0901234504
```

### **Tip 3: Xem tổng quan nhanh**
Gõ `/menu` → Bấm "👥 CTV" → Bấm "📊 Tổng Quan"

### **Tip 4: Kiểm tra hoa hồng cuối tháng**
Gõ `/menu` → "👥 CTV" → "💰 Hoa Hồng Tháng Này"

### **Tip 5: Tìm CTV không hoạt động**
Gõ `/menu` → "👥 CTV" → "⚠️ Không Hoạt Động"

---

## 📊 Dữ Liệu Hiện Tại

- **Tổng CTV:** 63
- **CTV có đơn:** 1 (1.6%)
- **CTV chưa có đơn:** 62 (98.4%)
- **Tổng hoa hồng:** 2.400đ

---

## 🔄 Workflow Thực Tế

### **Scenario 1: Kiểm tra CTV mới**
```
1. Gõ /menu
2. Bấm "👥 CTV"
3. Bấm "🆕 CTV Mới"
4. Xem danh sách CTV mới tháng này
5. Gõ mã CTV để xem chi tiết
```

### **Scenario 2: Tính hoa hồng cuối tháng**
```
1. Gõ /menu
2. Bấm "👥 CTV"
3. Bấm "💰 Hoa Hồng Tháng Này"
4. Copy thông tin ngân hàng
5. Thanh toán cho từng CTV
```

### **Scenario 3: Tìm thông tin CTV nhanh**
```
1. Gõ trực tiếp: CTV100004
2. Xem thông tin chi tiết
3. Kiểm tra đơn hàng gần nhất
```

### **Scenario 4: Kiểm tra CTV qua SĐT**
```
1. Khách hàng gọi đến: 0901234504
2. Gõ số điện thoại vào bot
3. Bot hiển thị:
   - Nếu là CTV: Thông tin CTV
   - Nếu là khách: Lịch sử đơn hàng
```

---

## 🎯 Các Chức Năng Chính

| Chức Năng | Cách Dùng | Mô Tả |
|-----------|-----------|-------|
| **Tổng Quan** | Menu → CTV → Tổng Quan | Thống kê tổng thể |
| **Top CTV** | Menu → CTV → Top CTV | Top 10 xuất sắc |
| **CTV Mới** | Menu → CTV → CTV Mới | Danh sách mới tháng này |
| **Không Hoạt Động** | Menu → CTV → Không Hoạt Động | CTV chưa có đơn |
| **Hoa Hồng** | Menu → CTV → Hoa Hồng | Chi tiết hoa hồng tháng |
| **Tìm CTV** | Gõ: CTV100004 | Tự động nhận diện |
| **Tìm SĐT** | Gõ: 0901234504 | Tự động nhận diện |

---

## 🚀 Test Chức Năng

Chạy lệnh test:
```bash
node test-ctv-menu.js
```

Hoặc test thủ công trong Telegram:
1. Gõ `/menu` → Kiểm tra có nút "👥 CTV"
2. Bấm "👥 CTV" → Kiểm tra menu CTV
3. Thử từng nút trong menu
4. Gõ `CTV100004` → Kiểm tra tự động nhận diện
5. Gõ `0901234504` → Kiểm tra tìm theo SĐT

---

## ❓ FAQ

**Q: Làm sao biết mã CTV hợp lệ?**
A: Mã CTV có format: CTV + 6 chữ số (VD: CTV100004)

**Q: Tìm CTV theo tên được không?**
A: Hiện tại chỉ hỗ trợ tìm theo mã CTV hoặc số điện thoại

**Q: Hoa hồng được tính như thế nào?**
A: Hoa hồng = Tổng đơn hàng × Commission rate (mặc định 10%)

**Q: CTV không hoạt động là gì?**
A: Là CTV đã đăng ký nhưng chưa có đơn hàng nào

**Q: Làm sao cập nhật commission rate?**
A: Hiện tại cần cập nhật qua admin panel, sẽ thêm lệnh Telegram sau

---

## 📝 Ghi Chú

- Tất cả dữ liệu real-time từ database
- Thời gian tính theo giờ Việt Nam (UTC+7)
- Hoa hồng tháng tính từ đầu tháng đến hiện tại
- CTV mới tính từ đầu tháng đến hiện tại

---

**Cập nhật:** 07/02/2026
**Version:** 1.0
