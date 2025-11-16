# Design Document - Hệ thống Quản lý Lãi Lỗ

## Overview

Hệ thống quản lý lãi lỗ được thiết kế để tích hợp vào hệ thống quản lý đơn hàng hiện tại, bổ sung khả năng theo dõi chi phí và tính toán lợi nhuận. Hệ thống sử dụng Cloudflare D1 (SQLite) làm database, Cloudflare Workers làm API backend, và vanilla JavaScript cho frontend.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
├─────────────────────────────────────────────────────────┤
│  Settings Page  │  Products Page  │  Orders Page        │
│  (New)          │  (Enhanced)     │  (Enhanced)         │
├─────────────────────────────────────────────────────────┤
│           Profit Report Page (New)                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer                             │
│              Cloudflare Workers                          │
├─────────────────────────────────────────────────────────┤
│  Packaging Config API  │  Product API  │  Order API     │
│  Profit Report API                                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Database Layer                          │
│                 Cloudflare D1 (SQLite)                   │
├─────────────────────────────────────────────────────────┤
│  cost_config  │  products  │  orders                     │
└─────────────────────────────────────────────────────────┘
```

## Data Models

### 1. cost_config Table (New)

```sql
CREATE TABLE IF NOT EXISTS cost_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL UNIQUE,
  item_cost REAL NOT NULL DEFAULT 0,
  is_default INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default data
INSERT INTO cost_config (item_name, item_cost, is_default) VALUES
  ('bag_zip', 500, 1),
  ('paper_print', 200, 1),
  ('bag_red', 1000, 0),
  ('box_shipping', 3000, 0);
```

**Fields:**
- `id`: Primary key
- `item_name`: Tên vật liệu (bag_zip, paper_print, bag_red, box_shipping)
- `item_cost`: Giá của vật liệu (VNĐ)
- `is_default`: 1 = tự động áp dụng, 0 = tùy chọn
- `created_at`, `updated_at`: Timestamps

### 2. products Table (Enhanced)

```sql
-- Add new column
ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;
```

**New Field:**
- `cost_price`: Giá vốn sản phẩm (chi phí làm vòng)

### 3. orders Table (Enhanced)

```sql
-- Add new columns
ALTER TABLE orders ADD COLUMN product_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN packaging_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN packaging_details TEXT;
ALTER TABLE orders ADD COLUMN shipping_cost REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN profit REAL DEFAULT 0;
```

**New Fields:**
- `product_cost`: Tổng giá vốn các sản phẩm trong đơn
- `packaging_cost`: Tổng chi phí đóng gói
- `packaging_details`: JSON chi tiết đóng gói ({"bag_zip": 500, "paper_print": 200, ...})
- `shipping_cost`: Phí vận chuyển thực tế
- `profit`: Lãi ròng = total_amount - product_cost - packaging_cost - shipping_cost - commission

## Components and Interfaces

### 1. Settings Page (`/admin/settings.html`)

**Purpose:** Cấu hình giá các vật liệu đóng gói

**UI Components:**
- Header với tiêu đề "Cài đặt Chi phí"
- Form với 4 input fields:
  - Túi zip (bag_zip)
  - Giấy in (paper_print)
  - Túi rút đỏ (bag_red)
  - Hộp đóng hàng (box_shipping)
- Button "Lưu cài đặt"
- Toast notification cho feedback

**API Endpoints:**
- `GET /api?action=getPackagingConfig` - Lấy cấu hình hiện tại
- `POST /api` with `action: updatePackagingConfig` - Cập nhật cấu hình

### 2. Products Page (Enhanced)

**Purpose:** Thêm quản lý giá vốn sản phẩm

**UI Enhancements:**
- Thêm trường "Giá vốn" vào form thêm/sửa sản phẩm
- Hiển thị "Lãi dự kiến" tự động khi nhập giá vốn
- Hiển thị "Tỷ suất lợi nhuận %" 
- Cảnh báo màu đỏ nếu giá vốn > giá bán

**API Enhancements:**
- Update `createProduct` và `updateProduct` để lưu cost_price

### 3. Orders Page (Enhanced)

**Purpose:** Hiển thị lãi lỗ và quản lý chi phí đơn hàng

**UI Enhancements:**
- Thêm cột "Lãi" trong bảng danh sách đơn hàng
- Màu xanh cho lãi, màu đỏ cho lỗ
- Form tạo đơn hàng:
  - Checkbox chọn loại đóng gói (túi rút, hộp)
  - Input nhập phí ship
  - Hiển thị lãi dự kiến real-time
- Modal chi tiết đơn hàng hiển thị phân tích lãi lỗ

**API Enhancements:**
- Update `createOrder` để lưu các chi phí và tính profit
- Add `getOrderProfitDetail` để lấy chi tiết phân tích

### 4. Profit Report Page (`/admin/profit-report.html`)

**Purpose:** Báo cáo tổng hợp lãi lỗ theo thời gian

**UI Components:**

**Dashboard Section:**
- 4 stat cards: Doanh thu, Chi phí, Lãi ròng, Tỷ suất
- Time filter: Hôm nay, Tuần, Tháng, Năm, Tất cả

**Cost Breakdown Section:**
- Chi tiết chi phí theo loại:
  - Giá vốn sản phẩm
  - Chi phí đóng gói (với chi tiết từng loại)
  - Phí vận chuyển
  - Hoa hồng CTV

**Orders List Section:**
- Bảng danh sách đơn hàng với lãi lỗ
- Click để xem chi tiết

**API Endpoints:**
- `GET /api?action=getProfitReport&period=today|week|month|year|all` - Lấy báo cáo tổng hợp

## Profit Calculation Logic

### Formula

```javascript
// Tính lãi đơn hàng
profit = total_amount - product_cost - packaging_cost - shipping_cost - commission

// Chi tiết:
// - total_amount: Tổng tiền đơn hàng
// - product_cost: Σ(product.cost_price × quantity)
// - packaging_cost: Σ(selected packaging items)
// - shipping_cost: Phí ship thực tế
// - commission: total_amount × ctv.commission_rate
```

### Example Calculation

```
Đơn hàng DH001:
├─ Sản phẩm: Vòng mix 3 bi bạc × 1
│  ├─ Giá bán: 239,000đ
│  └─ Giá vốn: 35,000đ
├─ Đóng gói:
│  ├─ Túi zip: 500đ (auto)
│  ├─ Giấy in: 200đ (auto)
│  └─ Túi rút: 1,000đ (chọn)
│  = Tổng: 1,700đ
├─ Phí ship: 25,000đ
└─ Hoa hồng CTV (10%): 23,900đ

Tính toán:
total_amount = 239,000đ
product_cost = 35,000đ
packaging_cost = 1,700đ
shipping_cost = 25,000đ
commission = 23,900đ

profit = 239,000 - 35,000 - 1,700 - 25,000 - 23,900
profit = 153,400đ (64%)
```

## Error Handling

### Validation Rules

1. **Packaging Config:**
   - item_cost phải là số dương
   - item_cost không được để trống

2. **Product Cost Price:**
   - cost_price phải là số >= 0
   - Cảnh báo nếu cost_price > price

3. **Order Creation:**
   - shipping_cost phải là số >= 0
   - Tự động tính packaging_cost từ config
   - Tự động tính product_cost từ products

### Error Messages

- "Giá không hợp lệ. Vui lòng nhập số dương."
- "Cảnh báo: Giá vốn cao hơn giá bán. Sản phẩm này sẽ bị lỗ."
- "Không thể tải cấu hình đóng gói. Vui lòng thử lại."
- "Lỗi khi tính toán lãi lỗ. Vui lòng kiểm tra dữ liệu."

## Testing Strategy

### Unit Tests (Optional)

- Test profit calculation logic
- Test packaging cost calculation
- Test data validation

### Manual Testing Checklist

1. **Settings Page:**
   - [ ] Hiển thị giá hiện tại
   - [ ] Cập nhật giá thành công
   - [ ] Validation hoạt động
   - [ ] Toast notification hiển thị

2. **Products Page:**
   - [ ] Thêm sản phẩm với giá vốn
   - [ ] Sửa giá vốn sản phẩm
   - [ ] Hiển thị lãi dự kiến đúng
   - [ ] Cảnh báo khi giá vốn > giá bán

3. **Orders Page:**
   - [ ] Tạo đơn hàng tính lãi đúng
   - [ ] Chọn đóng gói hoạt động
   - [ ] Nhập phí ship hoạt động
   - [ ] Hiển thị lãi trong danh sách
   - [ ] Chi tiết đơn hàng hiển thị phân tích

4. **Profit Report:**
   - [ ] Dashboard hiển thị đúng số liệu
   - [ ] Lọc theo thời gian hoạt động
   - [ ] Chi tiết chi phí đóng gói đúng
   - [ ] Danh sách đơn hàng hiển thị

## UI/UX Design Principles

### Color Scheme

- **Primary:** Purple/Pink gradient (giữ nguyên theme hiện tại)
- **Success (Profit):** Green (#10b981)
- **Danger (Loss):** Red (#ef4444)
- **Neutral:** Gray (#6b7280)
- **Info:** Blue (#3b82f6)

### Typography

- **Headers:** Font-weight 700, larger size
- **Body:** Font-weight 400, readable size
- **Numbers:** Font-weight 600, monospace for currency

### Spacing

- Card padding: 24px
- Section margin: 32px
- Input spacing: 16px
- Button padding: 12px 24px

### Responsive Design

- Desktop: Full layout with sidebar
- Tablet: Adjusted grid
- Mobile: Stacked layout, collapsible sections

### Loading States

- Skeleton loaders for data
- Spinner for actions
- Disabled state for buttons during processing

### Feedback

- Toast notifications for success/error
- Inline validation messages
- Color-coded status indicators
