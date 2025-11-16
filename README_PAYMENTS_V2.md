# 💰 Payments V2 - Hệ thống thanh toán hoa hồng linh hoạt

## 🎯 Tổng quan

Hệ thống thanh toán hoa hồng mới cho phép thanh toán **linh hoạt theo từng đơn hàng** thay vì phải thanh toán theo tháng như trước.

### Điểm khác biệt:

| Tính năng | Hệ thống cũ | Hệ thống mới (V2) |
|-----------|-------------|-------------------|
| **Đơn vị thanh toán** | Theo tháng | Theo đơn hàng |
| **Linh hoạt** | ❌ Phải thanh toán tất cả | ✅ Chọn đơn nào thanh toán |
| **Thời gian** | ❌ Đợi cuối tháng | ✅ Thanh toán bất cứ lúc nào |
| **Theo dõi** | ⚠️ Chỉ biết tháng nào đã trả | ✅ Biết rõ từng đơn |
| **Lịch sử** | ⚠️ Hạn chế | ✅ Đầy đủ chi tiết |
| **UI** | ⚠️ Cơ bản | ✅ Hiện đại, đẹp |

## 📁 Cấu trúc Files

```
├── migrations/
│   └── 004_add_commission_payment_details.sql    # Migration tạo bảng mới
│
├── public/
│   ├── admin/
│   │   └── payments-v2.html                      # Trang web mới
│   └── assets/
│       └── js/
│           └── payments-v2.js                    # JavaScript logic
│
├── worker.js                                      # Backend API (đã thêm 3 APIs mới)
│
├── PAYMENTS_V2_SUMMARY.md                        # Tóm tắt tổng quan
├── DEPLOY_PAYMENTS_V2.md                         # Hướng dẫn deploy chi tiết
├── CHECKLIST_DEPLOY_V2.md                        # Checklist từng bước
├── test-payments-v2-api.js                       # Script test API
└── README_PAYMENTS_V2.md                         # File này
```

## 🚀 Quick Start (3 bước)

### 1. Migration Database
```bash
wrangler d1 execute ctv-db --file=migrations/004_add_commission_payment_details.sql
```

### 2. Deploy Worker
```bash
wrangler deploy
```

### 3. Test
```bash
node test-payments-v2-api.js
```

**Xong!** Mở trình duyệt: `http://127.0.0.1:5500/public/admin/payments-v2.html`

## 📖 Documentation

### Cho người mới:
1. Đọc `PAYMENTS_V2_SUMMARY.md` - Hiểu tổng quan
2. Đọc `CHECKLIST_DEPLOY_V2.md` - Làm theo từng bước
3. Chạy `node test-payments-v2-api.js` - Test API

### Cho developer:
1. Đọc `DEPLOY_PAYMENTS_V2.md` - Chi tiết kỹ thuật
2. Xem code trong `worker.js` - 3 APIs mới
3. Xem code trong `payments-v2.js` - Frontend logic

## 🎨 Screenshots

### Trang chính:
![Payments V2 Main](https://via.placeholder.com/800x400?text=Payments+V2+Main+Page)

**Tính năng:**
- ✅ Hiển thị danh sách CTV có đơn chưa thanh toán
- ✅ Checkbox chọn từng đơn
- ✅ Tổng hoa hồng real-time
- ✅ Tìm kiếm CTV
- ✅ Filter theo tháng

### Modal thanh toán:
![Payment Modal](https://via.placeholder.com/600x500?text=Payment+Modal)

**Tính năng:**
- ✅ Xem danh sách đơn đã chọn
- ✅ Điền thông tin thanh toán
- ✅ Xác nhận nhanh

## 🔧 APIs mới

### 1. Get Unpaid Orders by Month
```javascript
GET /api?action=getUnpaidOrdersByMonth&month=2025-11

Response:
{
  "success": true,
  "month": "2025-11",
  "commissions": [
    {
      "referral_code": "CTV100001",
      "ctv_name": "Nguyễn Văn A",
      "phone": "0901234567",
      "order_count": 5,
      "commission_amount": 145000,
      "orders": [...]
    }
  ],
  "summary": {
    "total_ctv": 5,
    "total_orders": 23,
    "total_commission": 580000
  }
}
```

### 2. Get Unpaid Orders for CTV
```javascript
GET /api?action=getUnpaidOrders&referralCode=CTV100001

Response:
{
  "success": true,
  "referralCode": "CTV100001",
  "orders": [...],
  "summary": {
    "total_orders": 5,
    "total_commission": 145000
  }
}
```

### 3. Pay Selected Orders
```javascript
POST /api?action=paySelectedOrders

Body:
{
  "referralCode": "CTV100001",
  "orderIds": [1, 2, 3],
  "paymentDate": "2025-11-16",
  "paymentMethod": "bank_transfer",
  "note": "Chuyển khoản MB Bank"
}

Response:
{
  "success": true,
  "message": "Đã thanh toán 3 đơn hàng cho Nguyễn Văn A",
  "payment": {
    "payment_id": 123,
    "order_count": 3,
    "total_commission": 87000
  }
}
```

## 📊 Database Schema

### Bảng mới: `commission_payment_details`
```sql
CREATE TABLE commission_payment_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,           -- Link to commission_payments
    order_id INTEGER NOT NULL,             -- Link to orders (UNIQUE)
    commission_amount REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES commission_payments(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

### Quan hệ:
```
commission_payments (1) ----< (N) commission_payment_details (N) >---- (1) orders
```

**Ý nghĩa:**
- 1 lần thanh toán có thể bao gồm nhiều đơn hàng
- 1 đơn hàng chỉ được thanh toán 1 lần (UNIQUE constraint)

## 🎯 Use Cases

### Case 1: Thanh toán ngay lập tức
```
Tình huống: CTV làm 5 đơn ngày 16/11, cần tiền gấp

Giải pháp:
1. Vào trang Payments V2
2. Chọn tháng 11-2025
3. Tìm CTV đó
4. Tick chọn 5 đơn
5. Click "Thanh toán đã chọn"
6. Xác nhận → Xong!

Kết quả: CTV nhận tiền ngay, không cần đợi cuối tháng
```

### Case 2: Thanh toán từng đợt
```
Tình huống: 
- Ngày 16/11: CTV làm 5 đơn
- Ngày 17/11: CTV làm thêm 4 đơn

Giải pháp:
1. Ngày 16/11: Thanh toán 5 đơn đầu
2. Ngày 17/11: Chỉ còn nợ 4 đơn mới

Kết quả: Linh hoạt, không phải thanh toán tất cả cùng lúc
```

### Case 3: Thanh toán một phần
```
Tình huống: CTV có 10 đơn, nhưng chỉ muốn thanh toán 7 đơn trước

Giải pháp:
1. Tick chọn 7 đơn
2. Thanh toán
3. 3 đơn còn lại thanh toán sau

Kết quả: Linh hoạt theo nhu cầu
```

## ⚠️ Lưu ý quan trọng

### 1. Migration phải chạy trước
```bash
# Phải chạy lệnh này trước khi deploy worker
wrangler d1 execute ctv-db --file=migrations/004_add_commission_payment_details.sql
```

### 2. Không xóa bảng cũ
- Bảng `commission_payments` vẫn được sử dụng
- Bảng mới (`commission_payment_details`) bổ sung, không thay thế

### 3. UNIQUE constraint
- Mỗi đơn hàng chỉ được thanh toán 1 lần
- Nếu cố thanh toán lại sẽ báo lỗi

### 4. Cascade delete
- Xóa payment → Tự động xóa payment_details
- Xóa order → Tự động xóa payment_details

## 🐛 Troubleshooting

### Lỗi: "table commission_payment_details not found"
**Nguyên nhân:** Chưa chạy migration

**Giải pháp:**
```bash
wrangler d1 execute ctv-db --file=migrations/004_add_commission_payment_details.sql
```

### Lỗi: "UNIQUE constraint failed"
**Nguyên nhân:** Đơn hàng đã được thanh toán rồi

**Giải pháp:** Kiểm tra lại, không thể thanh toán trùng

### Không thấy dữ liệu
**Nguyên nhân:** 
- Không có đơn hàng với mã CTV
- Đơn hàng bị hủy
- Đơn hàng đã được thanh toán

**Giải pháp:** Kiểm tra database hoặc chạy test script

### API trả về empty
**Nguyên nhân:** Worker chưa deploy

**Giải pháp:**
```bash
wrangler deploy
```

## 📞 Support

### Kiểm tra logs:
```bash
wrangler tail
```

### Kiểm tra database:
```bash
# Xem bảng
wrangler d1 execute ctv-db --command="SELECT * FROM commission_payment_details LIMIT 5;"

# Xem đơn chưa thanh toán
wrangler d1 execute ctv-db --command="SELECT o.* FROM orders o LEFT JOIN commission_payment_details cpd ON o.id = cpd.order_id WHERE cpd.id IS NULL AND o.referral_code IS NOT NULL LIMIT 10;"
```

### Test API:
```bash
node test-payments-v2-api.js
```

## 🎉 Kết luận

Hệ thống Payments V2 là giải pháp **tối ưu nhất** cho việc thanh toán hoa hồng CTV vì:

✅ **Linh hoạt** - Thanh toán bất cứ lúc nào, bất cứ đơn nào
✅ **Chính xác** - Theo dõi từng đơn, không bao giờ trùng
✅ **Dễ dùng** - UI đẹp, thao tác đơn giản
✅ **Kỹ thuật tốt** - Database chuẩn, code clean
✅ **Mở rộng** - Dễ thêm tính năng sau này

**Sẵn sàng sử dụng!** 🚀

---

**Version:** 2.0.0  
**Last Updated:** 2025-11-16  
**Author:** Kiro AI Assistant
