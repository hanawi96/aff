# 📍 HƯỚNG DẪN SỬA ĐỊA CHỈ - SIÊU ĐƠN GIẢN

## 🎯 Tính năng mới: Sửa địa chỉ NHANH CHÓNG

Giờ đây, khi bạn muốn sửa địa chỉ, **KHÔNG CẦN** chọn lại từ đầu nữa!

---

## 📖 HƯỚNG DẪN CHI TIẾT

### **Bước 1: Mở modal sửa địa chỉ**

Click vào button địa chỉ (đã có địa chỉ):

```
┌─────────────────────────────────────┐
│ ✅ 123 Nguyễn Văn Linh,            │
│    P.1, Q.Gò Vấp, TP.HCM           │
│    [🖊️ Đổi]                      › │ ← Click vào đây
└─────────────────────────────────────┘
```

### **Bước 2: Thấy chips/tags địa chỉ**

Modal mở ra → Bạn sẽ thấy:

```
┌──────────────────────────────────────┐
│ 📍 Địa chỉ đã chọn:                 │
│ [TP.HCM ×] [Q.Gò Vấp ×] [P.1 ×]    │
│                                      │
│ ┌──────────────────────────────────┐│
│ │ Số nhà, tên đường:               ││
│ │ 123 Nguyễn Văn Linh              ││
│ └──────────────────────────────────┘│
│                                      │
│ [Xác nhận địa chỉ]                  │
└──────────────────────────────────────┘
```

### **Bước 3: Sửa phần cần sửa**

#### **Trường hợp 1: Chỉ sửa số nhà**
✅ **SIÊU ĐỠN GIẢN!**

1. Sửa trực tiếp trong ô "Số nhà, tên đường"
2. Ví dụ: "123" → "456"
3. Click "Xác nhận địa chỉ"
4. ✅ Xong! Địa chỉ mới: "456 Nguyễn Văn Linh, P.1, Q.Gò Vấp, TP.HCM"

#### **Trường hợp 2: Đổi Phường/Xã**
✅ **CHỈ 3 CLICK!**

1. Click nút **×** trên chip "P.1"
   ```
   [TP.HCM] [Q.Gò Vấp] [P.1 ×] ← Click X này
   ```

2. Danh sách Phường hiện ra → Chọn Phường mới
   ```
   ┌──────────────────────────────────┐
   │ 📍 Phường 1                      │
   │ 📍 Phường 2  ← Chọn cái này      │
   │ 📍 Phường 3                      │
   └──────────────────────────────────┘
   ```

3. Nhập số nhà → Xác nhận
4. ✅ Xong! Địa chỉ mới: "123 Nguyễn Văn Linh, P.2, Q.Gò Vấp, TP.HCM"

#### **Trường hợp 3: Đổi Quận/Huyện**
✅ **CHỈ 4 CLICK!**

1. Click nút **×** trên chip "Q.Gò Vấp"
   ```
   [TP.HCM] [Q.Gò Vấp ×] [P.1 ×] ← Click X này
   ```
   → Chip Phường cũng biến mất (vì phải chọn lại Phường thuộc Quận mới)

2. Chọn Quận mới từ danh sách
3. Chọn Phường thuộc Quận mới
4. Nhập số nhà → Xác nhận
5. ✅ Xong!

#### **Trường hợp 4: Đổi Tỉnh/Thành phố**
✅ **CHỈ 5 CLICK!**

1. Click nút **×** trên chip "TP.HCM"
   ```
   [TP.HCM ×] [Q.Gò Vấp ×] [P.1 ×] ← Click X này
   ```
   → Tất cả chips biến mất (phải chọn lại từ đầu)

2. Chọn Tỉnh/Thành mới
3. Chọn Quận/Huyện
4. Chọn Phường/Xã
5. Nhập số nhà → Xác nhận
6. ✅ Xong!

#### **Trường hợp 5: Đổi hoàn toàn địa chỉ mới**
✅ **CÓ NÚT ĐỔI RIÊNG!**

1. Click nút **"Đổi"** (màu cam) trên button địa chỉ
   ```
   ┌─────────────────────────────────────┐
   │ ✅ 123 Nguyễn Văn Linh,            │
   │    P.1, Q.Gò Vấp, TP.HCM           │
   │    [🖊️ Đổi] ← Click vào đây       │
   └─────────────────────────────────────┘
   ```

2. Confirm: "Bạn có chắc muốn đổi địa chỉ mới?"
3. Click OK → Modal reset → Chọn địa chỉ mới từ đầu
4. ✅ Xong!

---

## 🎨 GIAO DIỆN TRỰC QUAN

### **Màu sắc giúp bạn nhận biết:**

🟢 **Màu xanh** = Đã có địa chỉ
```
┌─────────────────────────────────────┐
│ ✅ 123 Nguyễn Văn Linh,            │
│    P.1, Q.Gò Vấp, TP.HCM           │
│    (Border xanh, background xanh nhạt)│
└─────────────────────────────────────┘
```

⚪ **Màu xám** = Chưa có địa chỉ
```
┌─────────────────────────────────────┐
│ 📍 Chọn địa chỉ giao hàng        › │
│    (Border xám, background trắng)   │
└─────────────────────────────────────┘
```

🟠 **Chips màu cam** = Địa chỉ đã chọn (có thể xóa)
```
┌──────────────────────────────────────┐
│ 📍 Địa chỉ đã chọn:                 │
│ [TP.HCM ×] [Q.Gò Vấp ×] [P.1 ×]    │
│ (Gradient cam→đỏ, nút X trắng)      │
└──────────────────────────────────────┘
```

---

## ⚡ TẠI SAO TÍNH NĂNG NÀY TỐT?

### **Trước đây:**
❌ Muốn đổi Phường → Phải chọn lại: Tỉnh → Quận → Phường
❌ Mất thời gian: ~30 giây
❌ Dễ nhầm lẫn
❌ Khó chịu khi chỉ muốn sửa 1 chút

### **Bây giờ:**
✅ Muốn đổi Phường → Chỉ cần: Click X → Chọn Phường mới
✅ Tiết kiệm thời gian: ~5 giây
✅ Rõ ràng, trực quan
✅ Sửa nhanh, dễ dàng

---

## 💡 MẸO HAY

### **Mẹo 1: Kiểm tra trước khi xác nhận**
Trước khi click "Xác nhận địa chỉ", hãy kiểm tra lại:
- ✅ Chips hiển thị đúng Tỉnh/Quận/Phường
- ✅ Số nhà, tên đường đã nhập đầy đủ

### **Mẹo 2: Sửa nhanh số nhà**
Nếu chỉ muốn sửa số nhà:
1. Click vào button địa chỉ
2. Sửa trực tiếp trong ô input
3. Xác nhận
→ Chỉ mất 3 giây!

### **Mẹo 3: Đổi địa chỉ hoàn toàn**
Nếu muốn đổi sang địa chỉ hoàn toàn khác:
- Dùng nút **"Đổi"** (màu cam)
- Đừng xóa từng chip một (mất thời gian)

---

## ❓ CÂU HỎI THƯỜNG GẶP

### **Q: Tôi click X nhầm, làm sao lấy lại?**
A: Đừng lo! Chỉ cần chọn lại từ danh sách. Ví dụ:
- Click X nhầm trên Phường → Chọn lại Phường từ danh sách
- Tỉnh và Quận vẫn giữ nguyên

### **Q: Tôi muốn xem lại địa chỉ đã chọn?**
A: Click vào button địa chỉ → Modal mở ra → Bạn sẽ thấy chips hiển thị đầy đủ

### **Q: Chips không hiện ra?**
A: Có thể bạn đang ở chế độ "Chọn lần đầu". Chips chỉ hiện khi bạn đã chọn địa chỉ rồi và mở lại để sửa.

### **Q: Tôi có thể sửa nhiều lần không?**
A: Có! Bạn có thể sửa bao nhiêu lần tùy thích. Địa chỉ sẽ được lưu lại sau mỗi lần xác nhận.

---

## 🎉 KẾT LUẬN

Tính năng sửa địa chỉ mới giúp bạn:
- ⚡ Tiết kiệm thời gian
- 🎯 Sửa chính xác phần cần sửa
- 😊 Trải nghiệm mượt mà, dễ chịu
- 🚀 Đặt hàng nhanh hơn

**Hãy thử ngay và cảm nhận sự khác biệt!** 🎊
