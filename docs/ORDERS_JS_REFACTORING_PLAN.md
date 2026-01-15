# 📋 Kế hoạch tách file orders.js

> **Mục tiêu**: Tách file `public/assets/js/orders.js` (~9200 dòng) thành các module nhỏ hơn, dễ bảo trì
> 
> **Nguyên tắc**: Giữ nguyên tất cả function ở global scope, chỉ di chuyển code, không refactor logic

---

## 📊 Tổng quan file hiện tại

| Thông tin | Giá trị |
|-----------|---------|
| File gốc | `public/assets/js/orders.js` |
| Số dòng | ~9200 dòng |
| Nơi sử dụng | `public/admin/index.html` (dòng 657) |
| Thư mục đích | `public/assets/js/orders/` |

---

## 🗂️ Cấu trúc thư mục sau khi tách

```
public/assets/js/orders/
├── orders-constants.js      # Constants, tax rate, calculations
├── orders-utils.js          # Utility functions (format, escape, etc.)
├── orders-ui-states.js      # Loading, empty state, error states
├── orders-data.js           # Data loading, filtering, sorting
├── orders-stats.js          # Statistics calculation & display
├── orders-table.js          # Table rendering, row creation
├── orders-pagination.js     # Pagination logic
├── orders-bulk-actions.js   # Checkbox, select all, bulk operations
├── orders-export.js         # Export history, SPX format
├── orders-filters.js        # Status filter, date filter, search
├── orders-add-modal.js      # Add order modal
├── orders-edit-modals.js    # Edit customer, address, amount, product
├── orders-product-modal.js  # Product selection modal
├── orders-delete-modals.js  # Delete confirmations
├── orders-discount.js       # Discount code functions
├── orders-ctv.js            # CTV verification
├── orders-chart.js          # Orders chart
├── orders-customer.js       # Customer check feature
├── orders-address.js        # Address selector
└── orders-main.js           # Entry point, DOMContentLoaded
```

---

## 📝 Chi tiết từng module (theo thứ tự tách)


### 🟢 Module 1: `orders-constants.js` (Độ khó: ⭐)

**Mô tả**: Chứa các hằng số và hàm tính toán cơ bản

**Dòng trong file gốc**: 1-92

**Nội dung cần tách**:
```javascript
// Cost constants
const COST_CONSTANTS = {
    TAX_RATE: 0.015,
    calculateTax(revenue) { ... }
};

// Load current tax rate from API
async function loadCurrentTaxRate() { ... }

// Helper function to calculate order totals from items
function calculateOrderTotals(order) { ... }

// Helper function to calculate order profit dynamically
function calculateOrderProfit(order) { ... }

// Helper function to update order data in both allOrdersData and filteredOrdersData
function updateOrderData(orderId, updates) { ... }
```

**Dependencies**: Không có (module độc lập)

**Được sử dụng bởi**: Hầu hết các module khác

---

### 🟢 Module 2: `orders-utils.js` (Độ khó: ⭐)

**Mô tả**: Các hàm tiện ích dùng chung

**Dòng trong file gốc**: ~2550-2700

**Nội dung cần tách**:
```javascript
// Debounce function
function debounce(func, wait) { ... }

// Utility functions
function escapeHtml(text) { ... }
function formatCurrency(amount) { ... }
function formatWeightSize(value) { ... }
function formatDateTime(dateString) { ... }
function formatDateTimeSplit(dateString) { ... }

// Copy to clipboard
function copyToClipboard(text) { ... }
```

**Dependencies**: 
- `toVNDateString()`, `toVNDate()` từ `timezone-utils.js`

**Được sử dụng bởi**: Hầu hết các module khác

---

### 🟢 Module 3: `orders-ui-states.js` (Độ khó: ⭐)

**Mô tả**: Quản lý trạng thái UI (loading, empty, error)

**Dòng trong file gốc**: ~2700-2750

**Nội dung cần tách**:
```javascript
// UI State functions
function showLoading() { ... }
function hideLoading() { ... }
function showTable() { ... }
function showEmptyState() { ... }
function showError(message) { ... }
```

**Dependencies**: 
- `showToast()` từ `toast-manager.js`

**Được sử dụng bởi**: `orders-data.js`, `orders-table.js`

---


### 🟢 Module 4: `orders-pagination.js` (Độ khó: ⭐)

**Mô tả**: Logic phân trang và sắp xếp

**Dòng trong file gốc**: ~2370-2550

**Nội dung cần tách**:
```javascript
// Render pagination
function renderPagination(totalPages) { ... }

// Go to page
function goToPage(page) { ... }

// Toggle date sort
function toggleDateSort() { ... }

// Toggle amount sort
function toggleAmountSort() { ... }

// Update date sort icon
function updateDateSortIcon() { ... }

// Update amount sort icon
function updateAmountSortIcon() { ... }

// Apply sorting
function applySorting() { ... }

// Refresh data
function refreshData() { ... }
```

**Global variables cần khai báo**:
```javascript
let dateSortOrder = 'desc';
let amountSortOrder = 'none';
```

**Dependencies**: 
- `filteredOrdersData` từ `orders-data.js`
- `renderOrdersTable()` từ `orders-table.js`

---

### 🟡 Module 5: `orders-stats.js` (Độ khó: ⭐⭐)

**Mô tả**: Tính toán và hiển thị thống kê

**Dòng trong file gốc**: ~870-970

**Nội dung cần tách**:
```javascript
// Update statistics
function updateStats() { ... }

// Helper function to update stat element
function updateStatElement(elementId, value, className) { ... }

// Update stat labels based on current filter
function updateStatLabels() { ... }
```

**Dependencies**: 
- `filteredOrdersData`, `allOrdersData` từ `orders-data.js`
- `formatCurrency()` từ `orders-utils.js`

---

### 🟡 Module 6: `orders-data.js` (Độ khó: ⭐⭐)

**Mô tả**: Quản lý dữ liệu và lọc

**Dòng trong file gốc**: ~93-110, 750-870, 970-1100

**Nội dung cần tách**:
```javascript
// Global variables
let allOrdersData = [];
let filteredOrdersData = [];
let currentPage = 1;
const itemsPerPage = 15;
let packagingConfig = [];

// Load orders data from API
async function loadOrdersData() { ... }

// Load packaging config from database
async function loadPackagingConfig() { ... }

// Calculate packaging cost
function calculatePackagingCost() { ... }

// Filter orders data
function filterOrdersData() { ... }
```

**Dependencies**: 
- `CONFIG.API_URL` từ `config.js`
- `COST_CONSTANTS` từ `orders-constants.js`
- `showLoading()`, `hideLoading()` từ `orders-ui-states.js`
- `updateStats()` từ `orders-stats.js`
- `renderOrdersTable()` từ `orders-table.js`
- `applySorting()` từ `orders-pagination.js`
- Timezone functions từ `timezone-utils.js`

---


### 🟡 Module 7: `orders-bulk-actions.js` (Độ khó: ⭐⭐)

**Mô tả**: Các thao tác hàng loạt (chọn, export, xóa)

**Dòng trong file gốc**: ~110-200, 430-620

**Nội dung cần tách**:
```javascript
// Global variable
let selectedOrderIds = new Set();

// Handle individual order checkbox
function handleOrderCheckbox(orderId, isChecked) { ... }

// Select/deselect all orders on current page
function toggleSelectAll(checked) { ... }

// Update bulk actions UI based on selection
function updateBulkActionsUI() { ... }

// Clear all selections
function clearSelection() { ... }

// Show bulk status menu
function showBulkStatusMenu(event) { ... }

// Bulk Update Status
async function bulkUpdateStatus(newStatus, statusLabel) { ... }

// Bulk Delete
async function bulkDelete() { ... }
```

**Dependencies**: 
- `allOrdersData` từ `orders-data.js`
- `updateOrderData()` từ `orders-constants.js`
- `renderOrdersTable()` từ `orders-table.js`
- `loadOrdersData()` từ `orders-data.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟡 Module 8: `orders-export.js` (Độ khó: ⭐⭐)

**Mô tả**: Export history và SPX format

**Dòng trong file gốc**: ~200-430

**Nội dung cần tách**:
```javascript
// Cache for export history
let exportHistoryCache = null;
let exportHistoryCacheTime = 0;
const CACHE_DURATION = 30000;

// Bulk Export
async function bulkExport() { ... }

// Load XLSX library dynamically
function loadXLSXLibrary() { ... }

// Load export history with caching
async function loadExportHistory(forceRefresh = false) { ... }

// Update export history badge
async function updateExportHistoryBadge() { ... }

// Show export history modal
async function showExportHistoryModal() { ... }

// Render export item
function renderExportItem(exp) { ... }

// Close export history modal
function closeExportHistoryModal() { ... }

// Download export and update order statuses
async function downloadAndUpdateExport(exportId) { ... }

// Delete export file
async function deleteExportFile(exportId) { ... }
```

**Dependencies**: 
- `selectedOrderIds`, `clearSelection()` từ `orders-bulk-actions.js`
- `allOrdersData`, `loadOrdersData()` từ `orders-data.js`
- `exportToSPXExcelAndSave()` từ `spx-export.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟡 Module 9: `orders-filters.js` (Độ khó: ⭐⭐)

**Mô tả**: Bộ lọc status, date, search

**Dòng trong file gốc**: ~7500-7900, 8500-8740

**Nội dung cần tách**:
```javascript
// Toggle status filter dropdown
function toggleStatusFilter(event) { ... }

// Select status filter
function selectStatusFilter(value, label) { ... }

// Select date filter preset
function selectDateFilterPreset(value, buttonElement) { ... }

// Custom Date Picker
let currentDateMode = 'single';
let customDatePickerModal = null;

function showCustomDatePicker(event) { ... }
function closeCustomDatePicker() { ... }
function switchDateMode(mode) { ... }
function applyCustomDate() { ... }
function clearCustomDate() { ... }
function updateCustomDateLabel(startDate, endDate) { ... }
function getTodayDateString() { ... }
function getVNStartOfLast7Days() { ... }
function getVNStartOfLast30Days() { ... }
function getVNStartOfDate(dateStr) { ... }
function getVNEndOfDate(dateStr) { ... }
```

**Dependencies**: 
- `filterOrdersData()` từ `orders-data.js`
- `showToast()` từ `toast-manager.js`
- `VIETNAM_TIMEZONE` từ `timezone-utils.js`

---


### 🟠 Module 10: `orders-table.js` (Độ khó: ⭐⭐⭐) ✅ DONE

**Mô tả**: Render bảng đơn hàng

**Dòng trong file gốc**: ~1100-1500, 4730-4900

**Nội dung đã tách**:
```javascript
// Render orders table
function renderOrdersTable() { ... }

// Create order row
function createOrderRow(order, index, pageIndex, totalPageItems) { ... }
```

**Dependencies**: 
- `filteredOrdersData`, `allOrdersData`, `currentPage`, `itemsPerPage` từ `orders-data.js`
- `escapeHtml()`, `formatCurrency()`, `formatDateTimeSplit()` từ `orders-utils.js`
- `calculateOrderProfit()` từ `orders-constants.js`
- `renderPagination()` từ `orders-pagination.js`
- `showTable()`, `showEmptyState()` từ `orders-ui-states.js`
- `showToast()` từ `toast-manager.js`

---

### 🟢 Module 11: `orders-status.js` (Độ khó: ⭐⭐) ✅ DONE

**Mô tả**: Quản lý trạng thái đơn hàng (badge, menu, update)

**Nội dung đã tách**:
```javascript
// Get status badge HTML
function getStatusBadge(status, orderId, orderCode) { ... }

// Show status menu
function showStatusMenu(orderId, orderCode, currentStatus, event) { ... }

// Update order status
async function updateOrderStatus(orderId, newStatus, orderCode) { ... }

// Quick status update
function quickUpdateStatus(orderId, status) { ... }
```

**Dependencies**: 
- `allOrdersData`, `filteredOrdersData` từ global
- `escapeHtml()` từ `orders-utils.js`
- `renderOrdersTable()` từ `orders-table.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟠 Module 12: `orders-delete-modals.js` (Độ khó: ⭐⭐⭐)

**Mô tả**: Modal xác nhận xóa đơn hàng và sản phẩm

**Dòng trong file gốc**: ~4150-4450

**Nội dung cần tách**:
```javascript
// Confirm delete order
function confirmDeleteOrder(orderId, orderCode) { ... }

// Close confirm delete modal
function closeConfirmDeleteModal() { ... }

// Delete order
async function deleteOrder(orderId, orderCode) { ... }

// Confirm delete product
function confirmDeleteProduct(orderId, productIndex, orderCode, productName) { ... }

// Close confirm delete product modal
function closeConfirmDeleteProductModal() { ... }

// Delete product from order
async function deleteProduct(orderId, productIndex, orderCode) { ... }
```

**Dependencies**: 
- `allOrdersData`, `filteredOrdersData`, `loadOrdersData()` từ `orders-data.js`
- `updateOrderData()` từ `orders-constants.js`
- `updateStats()` từ `orders-stats.js`
- `renderOrdersTable()` từ `orders-table.js`
- `escapeHtml()`, `formatCurrency()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟠 Module 12: `orders-collaborator-modal.js` (Độ khó: ⭐⭐⭐)

**Mô tả**: Modal thông tin CTV

**Dòng trong file gốc**: ~2760-2970

**Nội dung cần tách**:
```javascript
// Show collaborator modal
async function showCollaboratorModal(referralCode) { ... }

// Close collaborator modal
function closeCollaboratorModal() { ... }
```

**Dependencies**: 
- `allOrdersData` từ `orders-data.js`
- `escapeHtml()`, `formatCurrency()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---


### 🟠 Module 13: `orders-edit-modals.js` (Độ khó: ⭐⭐⭐)

**Mô tả**: Modal chỉnh sửa thông tin đơn hàng

**Dòng trong file gốc**: ~2970-3100, 3400-4150

**Nội dung cần tách**:
```javascript
// Edit product - show modal with all fields
function editProductName(productId, orderId, orderCode) { ... }

// Close edit product modal
function closeEditProductModal() { ... }

// Save product name
async function saveProductName(productId, orderId, orderCode, newName, oldName) { ... }

// Store unit prices globally (for edit modal)
let editModalUnitPrice = 0;
let editModalUnitCost = 0;
let editModalIsUpdating = false;

// Calculate profit in edit modal
function calculateEditModalProfit(sourceField = null) { ... }

// Save product changes
async function saveProductChanges(orderId, productIndex, orderCode) { ... }

// Edit customer info
function editCustomerInfo(orderId, orderCode) { ... }
function closeEditCustomerModal() { ... }
async function saveCustomerInfo(orderId, orderCode) { ... }

// Edit address
function editAddress(orderId, orderCode) { ... }
function closeEditAddressModal() { ... }
async function saveAddress(orderId, orderCode) { ... }

// Edit amount
function editAmount(orderId, orderCode) { ... }
function updateAmountPreview(hasReferral) { ... }
function closeEditAmountModal() { ... }
async function saveAmount(orderId, orderCode, referralCode) { ... }
```

**Dependencies**: 
- `allOrdersData`, `filteredOrdersData` từ `orders-data.js`
- `updateOrderData()` từ `orders-constants.js`
- `renderOrdersTable()` từ `orders-table.js`
- `updateStats()` từ `orders-stats.js`
- `escapeHtml()`, `formatCurrency()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟠 Module 14: `orders-products-display.js` (Độ khó: ⭐⭐⭐)

**Mô tả**: Hiển thị sản phẩm trong bảng và profit breakdown

**Dòng trong file gốc**: ~1500-2100

**Nội dung cần tách**:
```javascript
// Format products display with beautiful badges
function formatProductsDisplay(productsText, orderId, orderCode, orderNotes = null) { ... }

// Toggle products (show/hide more products)
function toggleProducts(uniqueId) { ... }

// Show profit breakdown modal
function showProfitBreakdown(orderId) { ... }

// View order detail
function viewOrderDetail(orderId) { ... }

// Show order detail modal
function showOrderDetailModal(order) { ... }

// Close order detail modal
function closeOrderDetailModal() { ... }
```

**Dependencies**: 
- `allOrdersData`, `packagingConfig` từ `orders-data.js`
- `calculateOrderTotals()`, `calculateOrderProfit()`, `COST_CONSTANTS` từ `orders-constants.js`
- `escapeHtml()`, `formatCurrency()`, `formatWeightSize()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`

---

### 🔴 Module 15: `orders-product-modal.js` (Độ khó: ⭐⭐⭐⭐)

**Mô tả**: Modal chọn sản phẩm

**Dòng trong file gốc**: ~6100-7500

**Nội dung cần tách**:
```javascript
// Global variables for product selection
let selectedCategory = null;
let selectedProducts = [];
const productQuantities = {};
const productWeights = {};
const productSizes = {};
const productNotes = {};

// Show product selection modal
function showProductSelectionModal() { ... }

// Close product selection modal
function closeProductSelectionModal() { ... }

// Render categories in modal
function renderModalCategories() { ... }

// Select category in modal
function selectModalCategory(categoryId) { ... }

// Render products list in modal
function renderModalProductsList(categoryId, searchQuery = '') { ... }

// Select product in modal
function selectModalProduct(productId) { ... }

// Update selected products display
function updateSelectedProductsDisplay() { ... }

// Toggle select all products
function toggleSelectAllProducts() { ... }

// Adjust/update product quantity, weight, notes
function adjustProductQuantity(productId, delta) { ... }
function updateProductQuantity(productId, value) { ... }
function updateProductWeight(productId, value) { ... }
function updateProductNotes(productId, value) { ... }

// Setup product search in modal
function setupModalProductSearch() { ... }

// Calculate profit for custom product
function calculateModalCustomProfit() { ... }

// Add product from modal
function addProductFromModal() { ... }

// Save products to existing order
async function saveProductsToExistingOrder() { ... }
```

**Dependencies**: 
- `allProductsList`, `allCategoriesList`, `currentOrderProducts` từ `orders-add-modal.js`
- `currentEditingOrderId`, `currentEditingOrderCode` từ `orders-add-modal.js`
- `updateOrderData()` từ `orders-constants.js`
- `updateStats()` từ `orders-stats.js`
- `renderOrdersTable()` từ `orders-table.js`
- `escapeHtml()`, `formatCurrency()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---


### 🔴 Module 16: `orders-add-modal.js` (Độ khó: ⭐⭐⭐⭐⭐)

**Mô tả**: Modal thêm đơn hàng mới (module lớn nhất, phức tạp nhất)

**Dòng trong file gốc**: ~4900-6100, 6300-6500, 7000-7100

**Nội dung cần tách**:
```javascript
// Global variables
let allProductsList = [];
let allCategoriesList = [];
let currentOrderProducts = [];
let currentOrderNotes = '';
let currentEditingOrderId = null;
let currentEditingOrderCode = null;

// Load products and categories
async function loadProductsAndCategories() { ... }

// Show add order modal
async function showAddOrderModal(duplicateData = null) { ... }

// Close add order modal
function closeAddOrderModal() { ... }

// Render best selling products box
function renderBestSellingProductsBox() { ... }

// Render quick add products
function renderQuickAddProducts() { ... }

// Toggle free shipping
function toggleFreeShipping() { ... }

// Toggle freeship products section
function toggleFreeshipProducts() { ... }

// Toggle payment dropdown
function togglePaymentDropdown(event) { ... }
function selectPaymentMethod(value, label, color) { ... }

// Toggle status dropdown
function toggleStatusDropdown(event) { ... }
function selectOrderStatus(value, label, color) { ... }

// Quick add product functions
function quickAddProduct(name, price) { ... }
function quickAddProductWithQty(name, price, inputId) { ... }
function quickAddProductToOrder(productId, productName, price, costPrice, qtyInputId, sizeInputId) { ... }
function quickChangeQty(inputId, change) { ... }

// Order notes
function updateOrderNotesDisplay() { ... }
function clearOrderNotes() { ... }
function showAddOrderNotesModal(orderId, orderCode) { ... }
async function saveOrderNotes(orderId, orderCode) { ... }

// Render order products
function renderOrderProducts() { ... }

// Edit product in order (new order modal)
function editProductInOrder(index) { ... }
let editOrderUnitPrice = 0;
let editOrderUnitCost = 0;
let editOrderIsUpdating = false;
function calculateEditProfit(sourceField = null) { ... }
function saveEditedProduct(index) { ... }

// Remove product from order
function removeProductFromOrder(index) { ... }

// Update order summary
function updateOrderSummary() { ... }

// Update profit preview
function updateProfitPreview(data) { ... }

// Submit new order
async function submitNewOrder() { ... }

// Duplicate order
function duplicateOrder(orderId) { ... }

// Show product selection modal for existing order
function showProductSelectionModalForOrder(orderId, orderCode) { ... }

// Show custom product modal
function showCustomProductModal() { ... }
function closeCustomProductModal() { ... }
```

**Dependencies**: 
- `allOrdersData`, `packagingConfig`, `loadOrdersData()` từ `orders-data.js`
- `calculatePackagingCost()` từ `orders-data.js`
- `COST_CONSTANTS` từ `orders-constants.js`
- `escapeHtml()`, `formatCurrency()`, `formatWeightSize()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`
- `window.addressSelector` từ `address-selector.js`
- `validateCTVCode()` từ `orders-ctv.js`

---

### 🟡 Module 17: `orders-discount.js` (Độ khó: ⭐⭐)

**Mô tả**: Xử lý mã giảm giá

**Dòng trong file gốc**: ~8000-8200

**Nội dung cần tách**:
```javascript
// Apply discount code
async function applyDiscountCode() { ... }

// Remove discount code
function removeDiscountCode() { ... }

// Show discount loading state
function showDiscountLoading() { ... }

// Show discount success state
function showDiscountSuccess(discount, discountAmount) { ... }

// Show discount error state
function showDiscountError(message) { ... }
```

**Dependencies**: 
- `currentOrderProducts` từ `orders-add-modal.js`
- `updateOrderSummary()` từ `orders-add-modal.js`
- `formatCurrency()` từ `orders-utils.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---


### 🟡 Module 18: `orders-ctv.js` (Độ khó: ⭐⭐)

**Mô tả**: Xác thực mã CTV

**Dòng trong file gốc**: ~7600-7750

**Nội dung cần tách**:
```javascript
// CTV Auto-Verify
let ctvCheckTimeout = null;
let ctvVerified = false;

// Event listener for CTV input (document.addEventListener)
// ... CTV verification logic ...

// Validation function for CTV code
function validateCTVCode() { ... }
```

**Dependencies**: 
- `updateOrderSummary()` từ `orders-add-modal.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟡 Module 19: `orders-chart.js` (Độ khó: ⭐⭐)

**Mô tả**: Biểu đồ đơn hàng

**Dòng trong file gốc**: ~8200-8500

**Nội dung cần tách**:
```javascript
// Chart variables
let ordersChart = null;
const ordersChartCache = {
    today: { data: null, timestamp: 0 },
    week: { data: null, timestamp: 0 },
    month: { data: null, timestamp: 0 },
    year: { data: null, timestamp: 0 }
};
const CHART_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Load orders chart data
async function loadOrdersChart() { ... }

// Render orders chart
function renderOrdersChart(data) { ... }

// Update comparison cards
function updateOrdersComparisonCards(data) { ... }

// Hide/show chart
function hideOrdersChart() { ... }
function showOrdersChart() { ... }
```

**Dependencies**: 
- `Chart.js` library
- `CONFIG.API_URL` từ `config.js`

---

### 🟡 Module 20: `orders-customer.js` (Độ khó: ⭐⭐)

**Mô tả**: Kiểm tra khách hàng

**Dòng trong file gốc**: ~8780-8920

**Nội dung cần tách**:
```javascript
// Customer check
let customerCheckTimeout = null;

// Setup customer check on phone input
function setupCustomerCheck() { ... }

// Check customer status via API
async function checkCustomerStatus(phone) { ... }

// Auto-fill form with last order info
async function autoFillLastOrder(phone) { ... }
```

**Dependencies**: 
- `window.addressSelector` từ `address-selector.js`
- `showToast()` từ `toast-manager.js`
- `CONFIG.API_URL` từ `config.js`

---

### 🟡 Module 21: `orders-address.js` (Độ khó: ⭐⭐)

**Mô tả**: Khởi tạo address selector

**Dòng trong file gốc**: ~7750-7900

**Nội dung cần tách**:
```javascript
// Initialize address selector
async function initAddressSelector(duplicateData = null) { ... }
```

**Dependencies**: 
- `window.addressSelector` từ `address-selector.js`

---


### 🟢 Module 22: `orders-main.js` (Độ khó: ⭐)

**Mô tả**: Entry point, khởi tạo và event listeners

**Dòng trong file gốc**: ~750-820, 8920-8970

**Nội dung cần tách**:
```javascript
// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Orders Dashboard initialized');
    loadCurrentTaxRate();
    loadOrdersData();
    loadPackagingConfig();
    setupEventListeners();
    updateExportHistoryBadge();
    checkUrlHash();

    // Preload products in background
    setTimeout(() => {
        if (allProductsList.length === 0) {
            loadProductsAndCategories();
        }
    }, 1000);
    
    // Auto-refresh badge every 30 seconds
    setInterval(updateExportHistoryBadge, 30000);
});

// Setup event listeners
function setupEventListeners() { ... }

// URL hash handling
function checkUrlHash() { ... }

// Listen for hash changes
window.addEventListener('hashchange', function () {
    checkUrlHash();
});
```

**Dependencies**: Tất cả các module khác

---

## 📦 Thứ tự load file trong HTML

```html
<!-- External dependencies (đã có sẵn) -->
<script src="../assets/js/config.js"></script>
<script src="../assets/js/timezone-utils.js"></script>
<script src="../assets/js/toast-manager.js"></script>
<script src="../assets/js/address-selector.js"></script>
<script src="../assets/js/spx-export.js"></script>

<!-- Orders modules - Load theo thứ tự dependency -->

<!-- Layer 1: Core (không dependency nội bộ) -->
<script src="../assets/js/orders/orders-constants.js"></script>
<script src="../assets/js/orders/orders-utils.js"></script>
<script src="../assets/js/orders/orders-ui-states.js"></script>

<!-- Layer 2: Data & Stats -->
<script src="../assets/js/orders/orders-pagination.js"></script>
<script src="../assets/js/orders/orders-stats.js"></script>
<script src="../assets/js/orders/orders-data.js"></script>

<!-- Layer 3: Table & Display -->
<script src="../assets/js/orders/orders-products-display.js"></script>
<script src="../assets/js/orders/orders-table.js"></script>

<!-- Layer 4: Bulk & Export -->
<script src="../assets/js/orders/orders-bulk-actions.js"></script>
<script src="../assets/js/orders/orders-export.js"></script>

<!-- Layer 5: Filters -->
<script src="../assets/js/orders/orders-filters.js"></script>

<!-- Layer 6: Modals (simple) -->
<script src="../assets/js/orders/orders-delete-modals.js"></script>
<script src="../assets/js/orders/orders-collaborator-modal.js"></script>
<script src="../assets/js/orders/orders-edit-modals.js"></script>

<!-- Layer 7: Features -->
<script src="../assets/js/orders/orders-discount.js"></script>
<script src="../assets/js/orders/orders-ctv.js"></script>
<script src="../assets/js/orders/orders-chart.js"></script>
<script src="../assets/js/orders/orders-customer.js"></script>
<script src="../assets/js/orders/orders-address.js"></script>

<!-- Layer 8: Complex Modals -->
<script src="../assets/js/orders/orders-product-modal.js"></script>
<script src="../assets/js/orders/orders-add-modal.js"></script>

<!-- Layer 9: Entry point (load cuối cùng) -->
<script src="../assets/js/orders/orders-main.js"></script>
```

---


## ✅ Checklist test sau mỗi lần tách

### Test cơ bản
- [ ] Trang load không có lỗi console
- [ ] Danh sách đơn hàng hiển thị đúng
- [ ] Thống kê hiển thị đúng

### Test Filter & Search
- [ ] Filter theo status hoạt động
- [ ] Filter theo ngày hoạt động (today, week, month, custom)
- [ ] Search theo tên/SĐT/mã đơn hoạt động
- [ ] Sắp xếp theo ngày hoạt động
- [ ] Sắp xếp theo giá trị hoạt động

### Test Pagination
- [ ] Phân trang hiển thị đúng
- [ ] Chuyển trang hoạt động

### Test Bulk Actions
- [ ] Checkbox chọn đơn hàng hoạt động
- [ ] Chọn tất cả hoạt động
- [ ] Bulk export hoạt động
- [ ] Bulk update status hoạt động
- [ ] Bulk delete hoạt động

### Test Export
- [ ] Export history modal hiển thị
- [ ] Download file hoạt động
- [ ] Delete export hoạt động

### Test Add Order
- [ ] Modal thêm đơn hàng mở được
- [ ] Chọn sản phẩm hoạt động
- [ ] Tự nhập sản phẩm hoạt động
- [ ] Quick add sản phẩm hoạt động
- [ ] Tính toán tổng tiền đúng
- [ ] Tính toán lợi nhuận đúng
- [ ] Áp dụng mã giảm giá hoạt động
- [ ] Xác thực CTV hoạt động
- [ ] Chọn địa chỉ 4 cấp hoạt động
- [ ] Submit đơn hàng thành công

### Test Edit Order
- [ ] Sửa thông tin khách hàng hoạt động
- [ ] Sửa địa chỉ hoạt động
- [ ] Sửa giá trị đơn hàng hoạt động
- [ ] Sửa sản phẩm trong đơn hoạt động
- [ ] Thêm sản phẩm vào đơn có sẵn hoạt động
- [ ] Xóa sản phẩm khỏi đơn hoạt động

### Test Delete
- [ ] Xóa đơn hàng hoạt động
- [ ] Xóa sản phẩm khỏi đơn hoạt động

### Test Other Features
- [ ] Copy SPX format hoạt động
- [ ] Xem chi tiết đơn hàng hoạt động
- [ ] Xem chi tiết lợi nhuận hoạt động
- [ ] Modal CTV hiển thị đúng
- [ ] Nhân bản đơn hàng hoạt động
- [ ] Biểu đồ đơn hàng hiển thị (nếu có)

---

## 🔄 Quy trình tách từng module

### Bước 1: Tạo file mới
```javascript
/**
 * Orders [Module Name]
 * Extracted from orders.js
 * 
 * Dependencies:
 * - [list dependencies]
 */

// ============================================
// [MODULE NAME]
// ============================================

// [Copy code từ orders.js vào đây]
```

### Bước 2: Copy code từ orders.js
- Copy nguyên văn, không sửa đổi logic
- Giữ nguyên tên function
- Giữ nguyên global variables

### Bước 3: Xóa code đã tách khỏi orders.js
- Comment out hoặc xóa code đã tách
- Giữ lại comment đánh dấu vị trí

### Bước 4: Cập nhật HTML
- Thêm script tag cho file mới
- Đảm bảo thứ tự load đúng

### Bước 5: Test
- Chạy checklist test
- Fix lỗi nếu có

### Bước 6: Commit
- Commit sau mỗi module tách thành công
- Message: "refactor: extract [module-name] from orders.js"

---

## ⚠️ Lưu ý quan trọng

1. **KHÔNG refactor logic** - Chỉ di chuyển code
2. **KHÔNG đổi tên function** - Giữ nguyên để không break code
3. **KHÔNG thay đổi global scope** - Tất cả function vẫn ở global
4. **Test sau mỗi module** - Đảm bảo không break gì
5. **Commit thường xuyên** - Dễ rollback nếu có lỗi
6. **Backup file gốc** - Giữ bản backup của orders.js

---

## 📊 Ước tính thời gian

| Module | Độ khó | Thời gian ước tính |
|--------|--------|-------------------|
| orders-constants.js | ⭐ | 5 phút |
| orders-utils.js | ⭐ | 5 phút |
| orders-ui-states.js | ⭐ | 5 phút |
| orders-pagination.js | ⭐ | 10 phút |
| orders-stats.js | ⭐⭐ | 10 phút |
| orders-data.js | ⭐⭐ | 15 phút |
| orders-bulk-actions.js | ⭐⭐ | 15 phút |
| orders-export.js | ⭐⭐ | 15 phút |
| orders-filters.js | ⭐⭐ | 15 phút |
| orders-table.js | ⭐⭐⭐ | 20 phút |
| orders-delete-modals.js | ⭐⭐⭐ | 15 phút |
| orders-collaborator-modal.js | ⭐⭐⭐ | 10 phút |
| orders-edit-modals.js | ⭐⭐⭐ | 25 phút |
| orders-products-display.js | ⭐⭐⭐ | 20 phút |
| orders-product-modal.js | ⭐⭐⭐⭐ | 30 phút |
| orders-add-modal.js | ⭐⭐⭐⭐⭐ | 45 phút |
| orders-discount.js | ⭐⭐ | 10 phút |
| orders-ctv.js | ⭐⭐ | 10 phút |
| orders-chart.js | ⭐⭐ | 15 phút |
| orders-customer.js | ⭐⭐ | 10 phút |
| orders-address.js | ⭐⭐ | 10 phút |
| orders-main.js | ⭐ | 10 phút |

**Tổng thời gian ước tính**: ~5-6 giờ (bao gồm test)

---

## 🚀 Bắt đầu từ đâu?

**Khuyến nghị**: Bắt đầu từ các module đơn giản nhất:

1. `orders-constants.js` ⭐
2. `orders-utils.js` ⭐
3. `orders-ui-states.js` ⭐
4. `orders-pagination.js` ⭐

Sau đó tiếp tục với các module phức tạp hơn theo thứ tự trong tài liệu.
