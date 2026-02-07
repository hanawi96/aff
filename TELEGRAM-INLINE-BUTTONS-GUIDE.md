# 🔘 Telegram Inline Buttons - Hướng Dẫn

## 🎯 Tổng Quan

Inline buttons là các nút bấm được gắn trực tiếp vào tin nhắn, giúp bạn thao tác nhanh mà không cần gõ lệnh.

---

## 📱 Các Loại Buttons

### **1. Action Buttons (Callback)**
Bấm để thực hiện hành động trong bot

**Ví dụ:**
```
[📊 Tổng Quan] [🏆 Top CTV]
```

### **2. URL Buttons**
Bấm để mở link hoặc thực hiện hành động hệ thống

**Ví dụ:**
```
[📦 Xem Tất Cả Đơn] → Mở admin panel
[📞 Gọi 0901234504] → Mở ứng dụng điện thoại
[💬 Nhắn Tin] → Mở ứng dụng tin nhắn
```

---

## 🎨 Buttons Trong Các Tin Nhắn

### **1. Thông Tin CTV**

Khi gõ mã CTV (VD: `CTV100004`), tin nhắn sẽ có buttons:

```
👤 THÔNG TIN CTV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tên: Phạm Văn Hùng
SĐT: 0901234504
...

[📦 Xem Tất Cả Đơn]
[📞 Gọi 0901234504] [💬 Nhắn Tin]
[🏆 Top CTV] [👥 Menu CTV]
```

**Chức năng buttons:**
- **📦 Xem Tất Cả Đơn**: Mở admin panel với filter CTV
- **📞 Gọi**: Mở ứng dụng điện thoại để gọi
- **💬 Nhắn Tin**: Mở ứng dụng SMS
- **🏆 Top CTV**: Xem danh sách top CTV
- **👥 Menu CTV**: Quay về menu CTV

---

### **2. Tổng Quan CTV**

Khi bấm "📊 Tổng Quan" trong menu CTV:

```
👥 THỐNG KÊ CTV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tổng CTV: 63
Đang hoạt động: 1
...

[🏆 Top CTV] [🆕 CTV Mới]
[💰 Hoa Hồng]
```

**Chức năng buttons:**
- **🏆 Top CTV**: Xem top CTV xuất sắc
- **🆕 CTV Mới**: Xem CTV mới tháng này
- **💰 Hoa Hồng**: Xem hoa hồng tháng này

---

### **3. Top CTV**

Khi xem top CTV:

```
🏆 TOP 10 CTV XUẤT SẮC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥇 CTV100004
   Phạm Văn Hùng
   ...

[👤 Xem #1: CTV100004]
[📊 Tổng Quan] [💰 Hoa Hồng]
```

**Chức năng buttons:**
- **👤 Xem #1**: Xem chi tiết CTV đứng đầu
- **📊 Tổng Quan**: Quay về tổng quan
- **💰 Hoa Hồng**: Xem hoa hồng tháng

---

### **4. Chi Tiết Đơn Hàng**

Khi tìm đơn hàng (VD: `/find DH123`):

```
🔍 CHI TIẾT ĐƠN HÀNG DH123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Khách: Nguyễn Văn A
SĐT: 0901234567
CTV: CTV100004
...

[📞 Gọi 0901234567]
[👤 Xem CTV]
[📋 Lịch Sử Khách]
```

**Chức năng buttons:**
- **📞 Gọi**: Gọi điện cho khách hàng
- **👤 Xem CTV**: Xem thông tin CTV (nếu có)
- **📋 Lịch Sử Khách**: Xem lịch sử đơn hàng của khách

---

## 💡 Ưu Điểm Inline Buttons

### **1. Nhanh Hơn**
```
Không cần buttons:
1. Xem thông tin CTV
2. Gõ lệnh để xem đơn hàng
3. Gõ lệnh để gọi điện

Có buttons:
1. Xem thông tin CTV
2. Bấm nút → Xong!
```

### **2. Trực Quan**
- Thấy ngay các hành động có thể làm
- Không cần nhớ lệnh
- Giảm sai sót

### **3. Tiện Lợi**
- Thao tác 1 chạm
- Không cần copy/paste
- Tích hợp với hệ thống (gọi điện, nhắn tin)

---

## 🎯 Use Cases

### **Scenario 1: Kiểm tra và gọi CTV**
```
1. Gõ: CTV100004
2. Xem thông tin
3. Bấm "📞 Gọi" → Gọi luôn
```

### **Scenario 2: Xem top CTV và chi tiết**
```
1. /menu → 👥 CTV → 🏆 Top CTV
2. Xem danh sách
3. Bấm "👤 Xem #1" → Xem chi tiết ngay
```

### **Scenario 3: Từ đơn hàng đến CTV**
```
1. /find DH123
2. Xem đơn hàng có CTV
3. Bấm "👤 Xem CTV" → Xem thông tin CTV
4. Bấm "📞 Gọi" → Gọi CTV
```

### **Scenario 4: Kiểm tra và liên hệ khách**
```
1. /find DH123
2. Xem thông tin đơn
3. Bấm "📞 Gọi" → Gọi khách hàng
4. Hoặc bấm "📋 Lịch Sử" → Xem lịch sử mua hàng
```

---

## 🔧 Các Loại Buttons Hiện Có

### **Navigation Buttons**
| Button | Chức Năng |
|--------|-----------|
| 👥 Menu CTV | Quay về menu CTV |
| 📊 Tổng Quan | Xem tổng quan CTV |
| 🏆 Top CTV | Xem top CTV |
| 🆕 CTV Mới | Xem CTV mới |
| 💰 Hoa Hồng | Xem hoa hồng |

### **Action Buttons**
| Button | Chức Năng |
|--------|-----------|
| 👤 Xem CTV | Xem chi tiết CTV |
| 📋 Lịch Sử Khách | Xem lịch sử khách hàng |
| 👤 Xem #1 | Xem CTV đứng đầu |

### **External Buttons (URL)**
| Button | Chức Năng |
|--------|-----------|
| 📦 Xem Tất Cả Đơn | Mở admin panel |
| 📞 Gọi [SĐT] | Mở ứng dụng điện thoại |
| 💬 Nhắn Tin | Mở ứng dụng SMS |

---

## 🚀 Test Buttons

### **Test 1: CTV Info Buttons**
```bash
# Gõ trong Telegram
CTV100004

# Kiểm tra buttons:
✓ 📦 Xem Tất Cả Đơn
✓ 📞 Gọi
✓ 💬 Nhắn Tin
✓ 🏆 Top CTV
✓ 👥 Menu CTV
```

### **Test 2: Tổng Quan Buttons**
```bash
# Gõ trong Telegram
/menu → 👥 CTV → 📊 Tổng Quan

# Kiểm tra buttons:
✓ 🏆 Top CTV
✓ 🆕 CTV Mới
✓ 💰 Hoa Hồng
```

### **Test 3: Top CTV Buttons**
```bash
# Gõ trong Telegram
/menu → 👥 CTV → 🏆 Top CTV

# Kiểm tra buttons:
✓ 👤 Xem #1
✓ 📊 Tổng Quan
✓ 💰 Hoa Hồng
```

### **Test 4: Order Detail Buttons**
```bash
# Gõ trong Telegram
/find DH1234567

# Kiểm tra buttons:
✓ 📞 Gọi [SĐT]
✓ 👤 Xem CTV (nếu có)
✓ 📋 Lịch Sử Khách
```

---

## 💡 Tips & Tricks

### **Tip 1: Kết hợp với tự động nhận diện**
```
Gõ: CTV100004
→ Xem thông tin với buttons
→ Bấm button để thao tác nhanh
```

### **Tip 2: Dùng buttons để navigate**
```
Thay vì gõ lại lệnh:
Bấm "👥 Menu CTV" để quay về menu
```

### **Tip 3: Gọi điện nhanh**
```
Xem thông tin CTV/Khách
→ Bấm "📞 Gọi" → Gọi luôn
```

### **Tip 4: Khám phá từ tổng quan**
```
Bấm "📊 Tổng Quan"
→ Xem thống kê
→ Bấm buttons để xem chi tiết
```

---

## 🎨 Thiết Kế Buttons

### **Nguyên Tắc:**
1. **Rõ ràng**: Emoji + Text mô tả chức năng
2. **Nhóm logic**: Buttons liên quan gần nhau
3. **Ưu tiên**: Hành động quan trọng ở trên
4. **Giới hạn**: Tối đa 2-3 hàng buttons

### **Ví Dụ Tốt:**
```
[📦 Xem Đơn]
[📞 Gọi] [💬 Nhắn Tin]
[👥 Menu]
```

### **Ví Dụ Không Tốt:**
```
[A] [B] [C] [D] [E]
[F] [G] [H] [I] [J]
→ Quá nhiều, khó chọn
```

---

## 📝 Ghi Chú

- Buttons chỉ hoạt động trong Telegram
- URL buttons mở app tương ứng (điện thoại, SMS, browser)
- Callback buttons thực hiện hành động trong bot
- Buttons có thể được cập nhật động dựa trên dữ liệu

---

**Cập nhật:** 07/02/2026
**Version:** 1.0
