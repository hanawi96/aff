# 📋 Đề xuất Quản lý Khách hàng - Giải pháp Tối ưu

## 🎯 Mục tiêu

Xây dựng hệ thống quản lý khách hàng thông minh, tự động tổng hợp từ đơn hàng hiện có, giúp:
- Theo dõi lịch sử mua hàng
- Phân tích hành vi khách hàng
- Tăng retention và cross-sell
- Quản lý thông tin tập trung

## 🏗️ Kiến trúc Đề xuất

### Phương án 1: **Virtual Customers (Không tạo bảng mới)** ⭐ KHUYẾN NGHỊ

**Ưu điểm:**
- ✅ Không cần migration, không thay đổi DB schema
- ✅ Dữ liệu luôn đồng bộ với orders
- ✅ Không có duplicate data
- ✅ Triển khai nhanh, ít rủi ro
- ✅ Tự động cập nhật khi có đơn mới

**Cách hoạt động:**
```sql
-- Query tổng hợp từ orders table
SELECT 
    customer_phone as id,
    customer_name as name,
    customer_phone as phone,
    MAX(address) as last_address,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_spent,
    MAX(order_date) as last_order_date,
    MIN(order_date) as first_order_date,
    GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
FROM orders
GROUP BY customer_phone
ORDER BY total_spent DESC
```

**Tính năng:**
- Xem danh sách khách hàng (tổng hợp từ orders)
- Thống kê: Tổng chi tiêu, số đơn, đơn gần nhất
- Lịch sử đơn hàng của từng khách
- Phân loại: VIP, Regular, New
- Tìm kiếm theo tên, SĐT
- Export danh sách

---

### Phương án 2: **Customers Table (Tạo bảng riêng)**

**Ưu điểm:**
- ✅ Lưu thêm thông tin: email, birthday, notes, tags
- ✅ Quản lý khách hàng độc lập với đơn hàng
- ✅ Có thể thêm khách trước khi có đơn
- ✅ Hỗ trợ loyalty program, points

**Nhược điểm:**
- ❌ Cần migration và sync data
- ❌ Phải maintain consistency giữa 2 bảng
- ❌ Phức tạp hơn trong triển khai

**Schema:**
```sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    address TEXT,
    birthday DATE,
    notes TEXT,
    tags TEXT, -- JSON array: ["VIP", "Wholesale"]
    loyalty_points INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    last_order_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

### Phương án 3: **Hybrid Approach (Kết hợp)** 🚀 TỐI ƯU NHẤT

**Cách hoạt động:**
1. **Không tạo bảng customers ngay**
2. **Sử dụng Virtual Customers** để hiển thị và phân tích
3. **Thêm cột `customer_metadata` vào orders** (JSON)
4. **Khi cần mở rộng** → migrate sang Customers Table

**Lợi ích:**
- ✅ Triển khai nhanh như Phương án 1
- ✅ Linh hoạt mở rộng như Phương án 2
- ✅ Không lock-in vào một kiến trúc
- ✅ Progressive enhancement

**Thêm vào orders table:**
```sql
ALTER TABLE orders ADD COLUMN customer_metadata TEXT;
-- Lưu: {"email": "...", "birthday": "...", "tags": [...]}
```

---

## 📊 Tính năng Đề xuất (Theo độ ưu tiên)

### Phase 1: MVP (1-2 giờ) ⭐
- [ ] Trang danh sách khách hàng (virtual)
- [ ] 4 thẻ thống kê: Tổng KH, KH mới tháng này, Tổng doanh thu, Avg order value
- [ ] Tìm kiếm theo tên/SĐT
- [ ] Xem chi tiết khách hàng (modal)
- [ ] Lịch sử đơn hàng của khách

### Phase 2: Analytics (2-3 giờ)
- [ ] Phân loại khách: VIP (>5 đơn), Regular (2-5 đơn), New (1 đơn)
- [ ] RFM Analysis (Recency, Frequency, Monetary)
- [ ] Top customers chart
- [ ] Customer lifetime value
- [ ] Churn prediction (khách lâu không mua)

### Phase 3: Advanced (3-4 giờ)
- [ ] Thêm notes cho khách hàng
- [ ] Tags/Labels (VIP, Wholesale, Problematic)
- [ ] Export to CSV/Excel
- [ ] Bulk actions (gửi SMS, email)
- [ ] Customer segments

---

## 🎨 UI/UX Đề xuất

### Layout (Giống Orders & Products)
```
┌─────────────────────────────────────────────┐
│ Sidebar │ Header: Quản Lý Khách Hàng       │
│         │ [Refresh] [Export]                │
├─────────┼───────────────────────────────────┤
│         │ Stats Cards (4 cards)             │
│  Menu   │ ┌──────┬──────┬──────┬──────┐    │
│         │ │Total │ New  │Revenue│ AOV  │    │
│ - CTV   │ └──────┴──────┴──────┴──────┘    │
│ - Orders│                                    │
│ - Prod  │ Search & Filter                   │
│ - Cust ✓│ [Search...] [All|VIP|New] [Sort] │
│         │                                    │
│         │ Customers Table                   │
│         │ ┌────────────────────────────┐   │
│         │ │ Name │ Phone │ Orders │ $  │   │
│         │ ├────────────────────────────┤   │
│         │ │ ...  │ ...   │ ...    │... │   │
│         │ └────────────────────────────┘   │
└─────────┴───────────────────────────────────┘
```

### Customer Detail Modal
```
┌─────────────────────────────────────┐
│ 👤 Nguyễn Văn A                     │
│ 📞 0912345678                       │
├─────────────────────────────────────┤
│ Thống kê                            │
│ • Tổng đơn: 12                      │
│ • Tổng chi: 2,400,000đ              │
│ • Đơn gần nhất: 2 ngày trước        │
│ • Khách hàng từ: 3 tháng trước      │
│                                     │
│ Lịch sử đơn hàng                    │
│ ┌─────────────────────────────┐    │
│ │ #ORD123 - 200,000đ - 2d ago │    │
│ │ #ORD122 - 150,000đ - 5d ago │    │
│ └─────────────────────────────┘    │
│                                     │
│ [Xem tất cả đơn hàng]               │
└─────────────────────────────────────┘
```

---

## 💻 Implementation Plan

### Step 1: Database Query (Worker.js)
```javascript
// Get all customers (virtual)
async function getAllCustomers(env, corsHeaders) {
    const { results } = await env.DB.prepare(`
        SELECT 
            customer_phone as phone,
            customer_name as name,
            MAX(address) as address,
            COUNT(*) as total_orders,
            SUM(total_amount) as total_spent,
            MAX(order_date) as last_order_date,
            MIN(order_date) as first_order_date,
            GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
        FROM orders
        WHERE customer_phone IS NOT NULL
        GROUP BY customer_phone
        ORDER BY total_spent DESC
    `).all();
    
    return jsonResponse({ success: true, customers: results }, 200, corsHeaders);
}

// Get customer detail
async function getCustomerDetail(phone, env, corsHeaders) {
    // Get customer summary
    const summary = await env.DB.prepare(`...`).bind(phone).first();
    
    // Get order history
    const orders = await env.DB.prepare(`
        SELECT * FROM orders 
        WHERE customer_phone = ? 
        ORDER BY order_date DESC
    `).bind(phone).all();
    
    return jsonResponse({ 
        success: true, 
        customer: summary,
        orders: orders.results 
    }, 200, corsHeaders);
}
```

### Step 2: Frontend (customers.html + customers.js)
- Copy structure từ products.html
- Thay đổi stats cards
- Table thay vì grid
- Customer detail modal

### Step 3: Analytics Functions
```javascript
// Classify customers
function classifyCustomer(totalOrders) {
    if (totalOrders >= 5) return 'VIP';
    if (totalOrders >= 2) return 'Regular';
    return 'New';
}

// Calculate RFM score
function calculateRFM(lastOrderDate, totalOrders, totalSpent) {
    const recency = daysSince(lastOrderDate);
    const frequency = totalOrders;
    const monetary = totalSpent;
    
    return {
        r: recency < 30 ? 5 : recency < 60 ? 4 : 3,
        f: frequency >= 10 ? 5 : frequency >= 5 ? 4 : 3,
        m: monetary >= 5000000 ? 5 : monetary >= 2000000 ? 4 : 3
    };
}
```

---

## 📈 Metrics & KPIs

### Thống kê hiển thị:
1. **Tổng khách hàng** - Unique phone numbers
2. **Khách mới tháng này** - First order trong 30 ngày
3. **Tổng doanh thu** - Sum of all orders
4. **AOV** - Average Order Value
5. **Repeat rate** - % khách mua lại
6. **Churn rate** - % khách không mua >90 ngày

### Phân loại:
- 🌟 **VIP**: ≥5 đơn hoặc ≥5,000,000đ
- 💚 **Regular**: 2-4 đơn
- 🆕 **New**: 1 đơn
- ⚠️ **At Risk**: Không mua >60 ngày
- 💤 **Churned**: Không mua >90 ngày

---

## 🚀 Roadmap

### Week 1: MVP
- Trang danh sách khách hàng
- Stats cards
- Search & filter
- Customer detail modal

### Week 2: Analytics
- RFM analysis
- Customer segmentation
- Charts & visualizations

### Week 3: Advanced
- Export functionality
- Bulk actions
- Customer notes/tags

### Future:
- Email/SMS campaigns
- Loyalty program
- Customer portal
- AI recommendations

---

## 🎯 Khuyến nghị Cuối cùng

**Bắt đầu với Phương án 3 (Hybrid):**

1. ✅ **Ngay bây giờ**: Implement Virtual Customers
   - Nhanh, đơn giản, không rủi ro
   - Đủ cho 80% use cases

2. ✅ **Sau 1-2 tháng**: Thêm customer_metadata vào orders
   - Khi cần lưu email, birthday, notes
   - Vẫn không cần bảng riêng

3. ✅ **Khi scale**: Migrate sang Customers Table
   - Khi có >10,000 khách hàng
   - Khi cần loyalty program phức tạp
   - Khi cần customer portal

**Lý do:**
- Progressive enhancement
- Không over-engineering
- Dễ maintain
- Flexible để mở rộng

---

## 📝 Next Steps

1. Review đề xuất này
2. Quyết định phương án (khuyến nghị: Phương án 3)
3. Tôi sẽ implement Phase 1 MVP
4. Test và feedback
5. Iterate và improve

Bạn muốn tôi bắt đầu implement theo phương án nào? 🚀
