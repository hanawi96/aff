# Đề Xuất: Giới Hạn Số Lượng Flash Sale

## Phân Tích Hiện Trạng

### ✅ Đã Có (Trong Database)
1. **Giới hạn tổng số lượng sản phẩm** (`stock_limit`)
   - Cột: `flash_sale_products.stock_limit` (INTEGER, nullable)
   - Ý nghĩa: Tổng số lượng sản phẩm có sẵn trong flash sale
   - NULL = không giới hạn
   - Ví dụ: 100 sản phẩm cho toàn bộ flash sale

2. **Đếm số lượng đã bán** (`sold_count`)
   - Cột: `flash_sale_products.sold_count` (INTEGER, default 0)
   - Ý nghĩa: Số lượng đã bán ra
   - Có hàm `incrementSoldCount()` để tăng khi bán

3. **Kiểm tra còn hàng**
   - Logic trong `checkProductInFlashSale()`:
   ```sql
   AND (fsp.stock_limit IS NULL OR fsp.sold_count < fsp.stock_limit)
   ```

### ❌ Chưa Có
1. **Giới hạn số lượng mỗi khách hàng mua** (`max_per_customer`)
   - Không có cột trong database
   - Không có bảng tracking khách hàng mua flash sale
   - Không có logic kiểm tra

2. **Tracking lịch sử mua flash sale của khách hàng**
   - Không có bảng `flash_sale_purchases` hoặc tương tự
   - Không biết khách hàng nào đã mua bao nhiêu

## Đề Xuất Giải Pháp Chuẩn

### Phương Án 1: TRACKING ĐẦY ĐỦ (Khuyến nghị ⭐)

#### 1.1. Thêm Cột vào `flash_sale_products`
```sql
ALTER TABLE flash_sale_products 
ADD COLUMN max_per_customer INTEGER DEFAULT NULL;
-- NULL = không giới hạn, số > 0 = giới hạn mỗi người
```

#### 1.2. Tạo Bảng Tracking Mua Hàng
```sql
CREATE TABLE flash_sale_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Liên kết
  flash_sale_id INTEGER NOT NULL,
  flash_sale_product_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  
  -- Thông tin khách hàng
  customer_phone TEXT NOT NULL,  -- Dùng phone làm unique identifier
  customer_name TEXT,
  
  -- Thông tin mua hàng
  quantity INTEGER NOT NULL,
  flash_price REAL NOT NULL,
  total_amount REAL NOT NULL,
  
  -- Timestamp
  purchased_at_unix INTEGER NOT NULL,
  
  -- Foreign keys
  FOREIGN KEY (flash_sale_id) REFERENCES flash_sales(id) ON DELETE CASCADE,
  FOREIGN KEY (flash_sale_product_id) REFERENCES flash_sale_products(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Index để query nhanh
  INDEX idx_customer_product (customer_phone, flash_sale_product_id),
  INDEX idx_flash_sale (flash_sale_id, purchased_at_unix)
);
```

#### 1.3. Logic Kiểm Tra Khi Mua
```javascript
// Hàm kiểm tra trước khi cho phép mua
async function canPurchaseFlashSaleProduct(flashSaleProductId, customerPhone, requestedQuantity, env) {
  // 1. Lấy thông tin sản phẩm flash sale
  const product = await env.DB.prepare(`
    SELECT 
      fsp.*,
      fs.status,
      fs.start_time,
      fs.end_time
    FROM flash_sale_products fsp
    INNER JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
    WHERE fsp.id = ? AND fsp.is_active = 1
  `).bind(flashSaleProductId).first();
  
  if (!product) {
    return { allowed: false, reason: 'Sản phẩm không tồn tại hoặc không hoạt động' };
  }
  
  // 2. Kiểm tra flash sale đang active
  const now = Math.floor(Date.now() / 1000);
  if (product.status !== 'active' || product.start_time > now || product.end_time <= now) {
    return { allowed: false, reason: 'Flash sale không còn hoạt động' };
  }
  
  // 3. Kiểm tra còn hàng (tổng số lượng)
  if (product.stock_limit !== null) {
    const remaining = product.stock_limit - product.sold_count;
    if (remaining < requestedQuantity) {
      return { 
        allowed: false, 
        reason: `Chỉ còn ${remaining} sản phẩm`,
        remaining: remaining
      };
    }
  }
  
  // 4. Kiểm tra giới hạn mỗi khách hàng
  if (product.max_per_customer !== null) {
    // Đếm số lượng khách hàng đã mua
    const purchased = await env.DB.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total_purchased
      FROM flash_sale_purchases
      WHERE flash_sale_product_id = ? 
        AND customer_phone = ?
    `).bind(flashSaleProductId, customerPhone).first();
    
    const totalAfterPurchase = purchased.total_purchased + requestedQuantity;
    
    if (totalAfterPurchase > product.max_per_customer) {
      const canBuy = product.max_per_customer - purchased.total_purchased;
      return { 
        allowed: false, 
        reason: `Mỗi khách hàng chỉ được mua tối đa ${product.max_per_customer} sản phẩm`,
        alreadyPurchased: purchased.total_purchased,
        canStillBuy: Math.max(0, canBuy)
      };
    }
  }
  
  // 5. Tất cả OK
  return { 
    allowed: true, 
    product: product 
  };
}

// Hàm ghi nhận mua hàng
async function recordFlashSalePurchase(data, env) {
  const now = Math.floor(Date.now() / 1000);
  
  // Insert vào bảng tracking
  await env.DB.prepare(`
    INSERT INTO flash_sale_purchases (
      flash_sale_id,
      flash_sale_product_id,
      order_id,
      customer_phone,
      customer_name,
      quantity,
      flash_price,
      total_amount,
      purchased_at_unix
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.flashSaleId,
    data.flashSaleProductId,
    data.orderId,
    data.customerPhone,
    data.customerName,
    data.quantity,
    data.flashPrice,
    data.totalAmount,
    now
  ).run();
  
  // Tăng sold_count
  await env.DB.prepare(`
    UPDATE flash_sale_products 
    SET sold_count = sold_count + ?
    WHERE id = ?
  `).bind(data.quantity, data.flashSaleProductId).run();
}
```

#### 1.4. API Endpoints Cần Thêm
```javascript
// GET /api?action=checkFlashSalePurchaseLimit
// Params: flashSaleProductId, customerPhone, quantity
// Response: { allowed: true/false, reason, remaining, canStillBuy }

// POST /api?action=recordFlashSalePurchase
// Body: { flashSaleId, flashSaleProductId, orderId, customerPhone, customerName, quantity, flashPrice }
// Response: { success: true/false }

// GET /api?action=getCustomerFlashSalePurchases
// Params: customerPhone, flashSaleId (optional)
// Response: { purchases: [...] }
```

### Phương Án 2: TRACKING ĐƠN GIẢN (Không khuyến nghị)

Chỉ thêm cột `max_per_customer` và kiểm tra trong bảng `orders`:
- ❌ Không chính xác nếu order bị hủy/hoàn
- ❌ Khó query và tính toán
- ❌ Không có lịch sử rõ ràng
- ❌ Performance kém khi query orders

## So Sánh Phương Án

| Tiêu Chí | Phương Án 1 (Tracking) | Phương Án 2 (Orders) |
|----------|------------------------|----------------------|
| **Độ chính xác** | ⭐⭐⭐⭐⭐ Rất cao | ⭐⭐ Thấp |
| **Performance** | ⭐⭐⭐⭐⭐ Nhanh (có index) | ⭐⭐ Chậm (scan orders) |
| **Lịch sử rõ ràng** | ⭐⭐⭐⭐⭐ Có | ⭐⭐ Không rõ |
| **Xử lý hủy/hoàn** | ⭐⭐⭐⭐⭐ Dễ dàng | ⭐ Khó |
| **Báo cáo/Thống kê** | ⭐⭐⭐⭐⭐ Dễ | ⭐⭐ Khó |
| **Độ phức tạp code** | ⭐⭐⭐ Trung bình | ⭐⭐⭐⭐ Cao |

## Khuyến Nghị Cuối Cùng

### ✅ Nên Làm: PHƯƠNG ÁN 1 - Tracking Đầy Đủ

**Lý do:**
1. **Chính xác 100%**: Biết chính xác ai mua gì, bao nhiêu
2. **Performance tốt**: Index tối ưu, query nhanh
3. **Dễ mở rộng**: Có thể thêm tính năng sau (refund, analytics, fraud detection)
4. **Báo cáo chi tiết**: Biết được top customers, conversion rate, etc.
5. **Xử lý edge cases**: Hủy đơn, hoàn tiền, fraud

**Quy trình triển khai:**
1. ✅ Tạo migration 059 (thêm cột + bảng mới)
2. ✅ Update backend services (validation, recording)
3. ✅ Update frontend (hiển thị giới hạn, số lượng còn lại)
4. ✅ Update order flow (kiểm tra + ghi nhận khi đặt hàng)
5. ✅ Testing đầy đủ

## UI/UX Cần Cập Nhật

### Admin Panel (Flash Sales Management)
```
Khi thêm/sửa sản phẩm vào flash sale:

┌─────────────────────────────────────┐
│ Sản phẩm: Vòng Đầu Tam 7 Bi Bạc    │
│ Giá gốc: 150,000đ                   │
│ Giá flash: 99,000đ (-34%)           │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ Giới hạn tổng số lượng          │ │
│ │ [100] sản phẩm                  │ │
│ │ ☐ Không giới hạn                │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ Giới hạn mỗi khách hàng         │ │
│ │ [2] sản phẩm/người              │ │
│ │ ☐ Không giới hạn                │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [Lưu]  [Hủy]                        │
└─────────────────────────────────────┘
```

### Customer View (Website)
```
┌─────────────────────────────────────┐
│ ⚡ FLASH SALE - Còn 2h 15m          │
│                                      │
│ Vòng Đầu Tam 7 Bi Bạc              │
│ 99,000đ  ̶1̶5̶0̶,̶0̶0̶0̶đ̶  -34%         │
│                                      │
│ 🔥 Chỉ còn 23/100 sản phẩm          │
│ 👤 Giới hạn 2 sản phẩm/người        │
│                                      │
│ Số lượng: [-] [1] [+]               │
│                                      │
│ [Mua Ngay]                          │
└─────────────────────────────────────┘
```

## Tổng Kết

**Hiện trạng:**
- ✅ Có giới hạn tổng số lượng (`stock_limit`)
- ✅ Có đếm số đã bán (`sold_count`)
- ❌ Chưa có giới hạn mỗi khách hàng
- ❌ Chưa có tracking lịch sử mua

**Đề xuất:**
- ✅ Thêm cột `max_per_customer` vào `flash_sale_products`
- ✅ Tạo bảng `flash_sale_purchases` để tracking
- ✅ Implement logic validation đầy đủ
- ✅ Update UI/UX cho admin và customer

**Ưu điểm giải pháp:**
- Chính xác, nhanh, dễ mở rộng
- Có lịch sử đầy đủ
- Dễ báo cáo và phân tích
- Xử lý tốt các edge cases

**Bước tiếp theo:**
Nếu đồng ý với phương án này, tôi sẽ:
1. Tạo migration 059
2. Update backend services
3. Update frontend admin panel
4. Implement validation logic
5. Testing đầy đủ
