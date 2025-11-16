# Implementation Plan - Hệ thống Quản lý Lãi Lỗ

## Phase 1: Database Setup

- [x] 1. Cập nhật Database Schema


  - Tạo file migration SQL với các thay đổi cần thiết
  - Thêm bảng cost_config với dữ liệu mặc định
  - Thêm cột cost_price vào bảng products
  - Thêm các cột chi phí vào bảng orders (product_cost, packaging_cost, packaging_details, shipping_cost, profit)
  - _Requirements: 1.1, 2.1, 3.1_

## Phase 2: Backend API Development



- [ ] 2. Tạo API cho Packaging Config
- [ ] 2.1 Implement getPackagingConfig endpoint
  - Tạo function getPackagingConfig trong worker.js
  - Query tất cả items từ bảng cost_config

  - Return JSON với danh sách cấu hình
  - _Requirements: 1.1_

- [ ] 2.2 Implement updatePackagingConfig endpoint
  - Tạo function updatePackagingConfig trong worker.js
  - Validate input data (giá phải là số dương)
  - Update hoặc insert vào bảng cost_config

  - Return success response
  - _Requirements: 1.3_

- [ ] 3. Cập nhật API cho Products
- [x] 3.1 Update createProduct endpoint

  - Thêm xử lý trường cost_price
  - Validate cost_price (phải >= 0)
  - Lưu cost_price vào database
  - _Requirements: 2.4_


- [ ] 3.2 Update updateProduct endpoint
  - Thêm xử lý cập nhật cost_price
  - Validate cost_price
  - Update cost_price trong database
  - _Requirements: 2.4_


- [ ] 3.3 Update getProduct và getAllProducts endpoints
  - Include cost_price trong response
  - Tính toán profit_margin nếu có giá bán
  - _Requirements: 2.1_

- [ ] 4. Cập nhật API cho Orders
- [ ] 4.1 Update createOrder endpoint
  - Tính product_cost từ products trong cart
  - Tính packaging_cost từ cost_config và selections
  - Lưu packaging_details dạng JSON
  - Lưu shipping_cost từ input
  - Tính profit theo công thức
  - Lưu tất cả vào database
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.2 Update getRecentOrders endpoint
  - Include các trường chi phí và profit trong response
  - _Requirements: 3.6_


- [ ] 4.3 Create getOrderProfitDetail endpoint
  - Tạo function getOrderProfitDetail
  - Query order với tất cả chi tiết
  - Parse packaging_details JSON
  - Return phân tích chi tiết lãi lỗ
  - _Requirements: 3.7_

- [ ] 5. Tạo API cho Profit Report
- [ ] 5.1 Implement getProfitReport endpoint
  - Tạo function getProfitReport với parameter period
  - Query orders theo period (today, week, month, year, all)
  - Tính tổng doanh thu, chi phí, lãi ròng
  - Phân tích chi phí theo loại (product_cost, packaging_cost, shipping_cost, commission)
  - Parse packaging_details để tính chi tiết từng loại đóng gói
  - Return báo cáo tổng hợp
  - _Requirements: 4.1, 4.2, 4.3, 4.4_



- [ ] 5.2 Add helper functions
  - Tạo function calculateDateRange(period)
  - Tạo function aggregatePackagingCosts(orders)
  - Tạo function calculateProfitMargin(revenue, cost)
  - _Requirements: 4.2_


## Phase 3: Frontend - Settings Page

- [ ] 6. Tạo Settings Page
- [ ] 6.1 Tạo file HTML structure
  - Tạo file public/admin/settings.html
  - Include header, sidebar navigation
  - Tạo main content area
  - Include footer
  - Link CSS và JS files
  - _Requirements: 1.1, 5.1_



- [ ] 6.2 Tạo UI cho Packaging Config Form
  - Tạo section "Cài đặt Chi phí Đóng gói"
  - Tạo 4 input fields với labels và icons:
    - Túi zip (bag_zip)
    - Giấy in (paper_print)
    - Túi rút đỏ (bag_red)
    - Hộp đóng hàng (box_shipping)
  - Thêm button "Lưu cài đặt"
  - Styling với Tailwind CSS


  - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4_

- [ ] 6.3 Implement JavaScript logic
  - Tạo file public/assets/js/settings.js
  - Implement loadPackagingConfig()

  - Implement savePackagingConfig()
  - Implement validation
  - Implement toast notifications
  - Handle loading states
  - _Requirements: 1.2, 1.3, 1.4, 5.6_

## Phase 4: Frontend - Products Page Enhancement

- [ ] 7. Cập nhật Products Page
- [ ] 7.1 Update Product Form UI
  - Thêm trường "Giá vốn" vào form thêm/sửa sản phẩm
  - Thêm section hiển thị "Lãi dự kiến"
  - Thêm hiển thị "Tỷ suất lợi nhuận %"
  - Styling với màu sắc phù hợp
  - _Requirements: 2.1, 5.2, 5.3_

- [ ] 7.2 Update JavaScript logic
  - Update showAddProductModal() để include cost_price field
  - Update editProduct() để load và hiển thị cost_price
  - Implement calculateExpectedProfit() function
  - Implement real-time profit calculation khi nhập giá
  - Implement warning khi cost_price > price
  - Update saveProduct() để lưu cost_price
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 5.6_

- [ ] 7.3 Update Product Card Display
  - Thêm hiển thị giá vốn trong product card (optional)
  - Thêm badge hiển thị profit margin
  - _Requirements: 5.3_

## Phase 5: Frontend - Orders Page Enhancement

- [ ] 8. Cập nhật Orders Page
- [ ] 8.1 Update Order List Table
  - Thêm cột "Lãi" vào bảng danh sách đơn hàng
  - Implement color coding (xanh = lãi, đỏ = lỗ)
  - Format số tiền với formatCurrency()
  - _Requirements: 3.6, 5.2_

- [ ] 8.2 Update Create Order Form
  - Thêm section "Chi phí đóng gói"
  - Tạo checkboxes cho túi rút và hộp (auto-check túi zip và giấy in)
  - Thêm input "Phí ship"
  - Thêm section hiển thị "Lãi dự kiến" real-time
  - Styling với card và colors
  - _Requirements: 3.1, 3.2, 3.3, 5.3, 5.4_



- [ ] 8.3 Implement Order Creation Logic
  - Load packaging config khi mở form
  - Implement calculateOrderProfit() function
  - Update profit display khi thay đổi sản phẩm, đóng gói, ship
  - Update createOrder() để gửi packaging selections và shipping cost
  - _Requirements: 3.4, 3.5, 5.6_


- [ ] 8.4 Create Order Detail Modal
  - Tạo modal hiển thị chi tiết phân tích lãi lỗ
  - Hiển thị breakdown: doanh thu, các loại chi phí, lãi ròng
  - Styling với sections và colors
  - Implement viewOrderProfitDetail() function
  - _Requirements: 3.7, 5.3, 5.4_

## Phase 6: Frontend - Profit Report Page


- [ ] 9. Tạo Profit Report Page
- [ ] 9.1 Tạo file HTML structure
  - Tạo file public/admin/profit-report.html
  - Include header, sidebar navigation
  - Tạo main content area với sections
  - Include footer
  - Link CSS và JS files
  - _Requirements: 4.1, 5.1_


- [ ] 9.2 Tạo Dashboard Section
  - Tạo time filter buttons (Hôm nay, Tuần, Tháng, Năm, Tất cả)
  - Tạo 4 stat cards:
    - Doanh thu (với icon 💵)
    - Chi phí (với icon 📦)


    - Lãi ròng (với icon ✅)
    - Tỷ suất (với icon 📊)
  - Styling với gradient và shadows
  - _Requirements: 4.1, 4.2, 5.1, 5.3_

- [ ] 9.3 Tạo Cost Breakdown Section
  - Tạo section "Chi tiết Chi phí"
  - Hiển thị 4 loại chi phí với progress bars:
    - Giá vốn sản phẩm
    - Chi phí đóng gói (với chi tiết túi zip, giấy, túi rút, hộp)
    - Phí vận chuyển
    - Hoa hồng CTV
  - Styling với colors và spacing
  - _Requirements: 4.3, 4.4, 5.3, 5.4_

- [ ] 9.4 Tạo Orders List Section
  - Tạo bảng danh sách đơn hàng
  - Hiển thị: Mã đơn, Ngày, Khách hàng, Doanh thu, Chi phí, Lãi
  - Color coding cho cột lãi
  - Click để xem chi tiết
  - _Requirements: 4.5, 4.6, 5.2, 5.4_

- [ ] 9.5 Implement JavaScript logic
  - Tạo file public/assets/js/profit-report.js
  - Implement loadProfitReport(period)
  - Implement renderDashboard(data)
  - Implement renderCostBreakdown(data)
  - Implement renderOrdersList(data)
  - Implement time filter handlers
  - Handle loading states
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.6_

## Phase 7: UI Polish and Responsive Design

- [ ] 10. Polish UI/UX
- [ ] 10.1 Implement responsive design
  - Test và adjust layout cho mobile
  - Test và adjust layout cho tablet
  - Ensure touch-friendly buttons
  - _Requirements: 5.5_

- [ ] 10.2 Add loading states
  - Implement skeleton loaders cho data loading
  - Add spinners cho button actions
  - Add disabled states during processing
  - _Requirements: 5.6_

- [ ] 10.3 Enhance visual feedback
  - Implement smooth transitions
  - Add hover effects
  - Ensure color consistency
  - Polish spacing và alignment
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

## Phase 8: Testing and Bug Fixes

- [ ] 11. Manual Testing
- [ ] 11.1 Test Settings Page
  - Test load cấu hình
  - Test update cấu hình
  - Test validation
  - Test toast notifications
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 11.2 Test Products Page
  - Test thêm sản phẩm với giá vốn
  - Test sửa giá vốn
  - Test tính lãi dự kiến
  - Test warning khi lỗ
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 11.3 Test Orders Page
  - Test tạo đơn hàng với chi phí
  - Test chọn đóng gói
  - Test nhập phí ship
  - Test hiển thị lãi trong danh sách
  - Test xem chi tiết lãi lỗ
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 11.4 Test Profit Report Page
  - Test dashboard với các period
  - Test cost breakdown
  - Test orders list
  - Test chi tiết đơn hàng
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 11.5 Test responsive design
  - Test trên mobile devices
  - Test trên tablets
  - Test trên desktop
  - _Requirements: 5.5_

- [ ] 12. Bug Fixes
  - Fix any issues found during testing
  - Optimize performance if needed
  - Ensure data consistency
  - _Requirements: All_
