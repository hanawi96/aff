# 🧪 Test Nhanh

Chạy hàm này trong Google Apps Script:

```javascript
testPhoneNumber386190596()
```

Kết quả mong đợi:
```
🧪 Testing phone: 386190596

📊 Kết quả: 1 đơn hàng
✅ Thành công! Chi tiết:

Đơn 1:
{
  "orderId": "DH251110P9N",
  "orderDate": "10/11/2024",
  "customerName": "...",
  "customerPhone": "...",
  "products": "...",
  "totalAmount": ...,
  "status": "...",
  "referralCode": "..."
}
```

Nếu kết quả là "0 đơn hàng", có nghĩa là hàm `getOrdersByPhoneDirectly()` chưa hoạt động đúng.
