// Orders Dashboard JavaScript

// Cost constants
const COST_CONSTANTS = {
    TAX_RATE: 0.015,           // Thuế mặc định 1.5% (sẽ được cập nhật từ API)

    // Calculate tax based on revenue (including shipping)
    calculateTax(revenue) {
        return Math.round(revenue * this.TAX_RATE);
    }
};

// Load current tax rate from API
async function loadCurrentTaxRate() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getCurrentTaxRate&timestamp=${Date.now()}`);
        const data = await response.json();
        if (data.success && data.taxRate) {
            COST_CONSTANTS.TAX_RATE = data.taxRate;
            console.log(`✅ Tax rate loaded: ${(data.taxRate * 100).toFixed(1)}%`);
        }
    } catch (error) {
        console.warn('⚠️ Could not load tax rate, using default 1.5%');
    }
}

// Helper function to calculate order totals from items
function calculateOrderTotals(order) {
    // Calculate product_total by subtracting shipping_fee from total_amount
    // IMPORTANT: total_amount already has discount subtracted, so we need to add it back
    const orderTotalAmount = order.total_amount || 0;
    const shippingFee = order.shipping_fee || 0;
    const discountAmount = order.discount_amount || 0;
    const productTotal = orderTotalAmount - shippingFee + discountAmount;

    // SINGLE SOURCE OF TRUTH: Always use product_cost from API
    // API calculates this from order_items table: SUM(product_cost * quantity)
    let productCost = order.product_cost || 0;

    // FALLBACK: If product_cost is 0 or undefined (old orders without order_items), 
    // calculate from products JSON as temporary solution
    if ((productCost === 0 || productCost === undefined) && order.products) {
        try {
            const products = JSON.parse(order.products);
            if (Array.isArray(products)) {
                console.log(`📦 Fallback: Parsing products JSON for order ${order.order_id}:`, products);
                productCost = products.reduce((sum, item) => {
                    let cost = item.cost_price || item.cost || 0;
                    const qty = item.quantity || 1;

                    // IMPORTANT: If cost seems too high (> 10x of typical unit cost),
                    // it might be stored as total instead of unit price
                    // In that case, divide by quantity to get unit cost
                    // This is a heuristic fix for data inconsistency
                    const unitCost = cost / qty;
                    const subtotal = unitCost * qty;

                    console.log(`  - ${item.name || 'Unknown'}: cost=${cost}, qty=${qty}, unit=${unitCost}, subtotal=${subtotal}`);
                    return sum + subtotal;
                }, 0);
                console.warn(`⚠️ Using fallback cost calculation for order ${order.order_id}: ${productCost}`);
            }
        } catch (e) {
            console.warn('Could not parse products JSON for cost calculation:', e);
        }
    }

    return {
        totalAmount: Math.max(0, productTotal), // Ensure non-negative
        productCost: productCost
    };
}

// Helper function to calculate order profit dynamically
function calculateOrderProfit(order) {
    const { totalAmount, productCost } = calculateOrderTotals(order);
    const shippingFee = order.shipping_fee || 0;
    const shippingCost = order.shipping_cost || 0;
    const packagingCost = order.packaging_cost || 0;
    const commission = order.commission || 0;

    // Revenue = product total + shipping fee - discount
    const discountAmount = order.discount_amount || 0;
    const revenue = totalAmount + shippingFee - discountAmount;

    // Use saved tax_amount if available, otherwise calculate
    const tax = order.tax_amount || Math.round(revenue * (order.tax_rate || COST_CONSTANTS.TAX_RATE));

    // Profit = revenue - all costs including tax
    return revenue - productCost - shippingCost - packagingCost - commission - tax;
}

// Helper function to update order data in both allOrdersData and filteredOrdersData
function updateOrderData(orderId, updates) {
    // Update in allOrdersData
    const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
        Object.assign(allOrdersData[orderIndex], updates);
    }

    // Update in filteredOrdersData
    const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
    if (filteredIndex !== -1) {
        Object.assign(filteredOrdersData[filteredIndex], updates);
    }
}

let allOrdersData = [];
let filteredOrdersData = [];
let selectedOrderIds = new Set(); // Track selected orders for bulk actions
let currentPage = 1;
const itemsPerPage = 15;
let dateSortOrder = 'desc'; // 'desc' = mới nhất trước, 'asc' = cũ nhất trước, 'none' = không sắp xếp
let amountSortOrder = 'none'; // 'desc' = cao nhất trước, 'asc' = thấp nhất trước, 'none' = không sắp xếp
let packagingConfig = []; // Packaging config from database

// Handle individual order checkbox
function handleOrderCheckbox(orderId, isChecked) {
    if (isChecked) {
        selectedOrderIds.add(orderId);
    } else {
        selectedOrderIds.delete(orderId);
    }
    updateBulkActionsUI();
}

// Select/deselect all orders on current page
function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        const orderId = parseInt(cb.dataset.orderId);
        if (checked) {
            selectedOrderIds.add(orderId);
        } else {
            selectedOrderIds.delete(orderId);
        }
    });
    updateBulkActionsUI();
}

// Update bulk actions UI based on selection
function updateBulkActionsUI() {
    const count = selectedOrderIds.size;
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');

    if (count > 0) {
        if (selectedCount) selectedCount.textContent = count;
        if (bulkActionsBar) {
            // Show with smooth animation
            bulkActionsBar.classList.remove('hidden');
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';

            requestAnimationFrame(() => {
                bulkActionsBar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                bulkActionsBar.style.opacity = '1';
                bulkActionsBar.style.transform = 'translateX(-50%) translateY(0)';
            });
        }
    } else {
        if (bulkActionsBar) {
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => {
                bulkActionsBar.classList.add('hidden');
            }, 300);
        }
    }
}

// Clear all selections
function clearSelection() {
    selectedOrderIds.clear();
    document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = false);
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) selectAllCb.checked = false;
    updateBulkActionsUI();
}

// Bulk Export - Export selected orders to Excel/CSV
async function bulkExport() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    try {
        const selectedOrders = allOrdersData.filter(o => selectedOrderIds.has(o.id));

        // Create CSV content
        let csv = 'Mã đơn,Khách hàng,SĐT,Địa chỉ,Sản phẩm,Giá trị,Ngày đặt,Trạng thái\n';

        selectedOrders.forEach(order => {
            const products = order.products_display || order.products || '';
            const productsText = products.replace(/"/g, '""'); // Escape quotes

            csv += `"${order.order_id}",`;
            csv += `"${order.customer_name || ''}",`;
            csv += `"${order.customer_phone || ''}",`;
            csv += `"${(order.address || '').replace(/"/g, '""')}",`;
            csv += `"${productsText}",`;
            csv += `"${order.total_amount || 0}",`;
            csv += `"${formatDateTime(order.created_at || order.order_date)}",`;
            csv += `"${order.status || 'pending'}"\n`;
        });

        // Download CSV
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `don-hang-${Date.now()}.csv`;
        link.click();

        showToast(`Đã export ${selectedOrderIds.size} đơn hàng`, 'success');
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Không thể export: ' + error.message, 'error');
    }
}

// Show bulk status menu
function showBulkStatusMenu(event) {
    event.stopPropagation();

    // Close any existing menu
    const existingMenu = document.getElementById('bulkStatusMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'pending', label: 'Chờ xử lý', color: 'yellow' },
        { value: 'shipped', label: 'Đã gửi hàng', color: 'blue' },
        { value: 'in_transit', label: 'Đang vận chuyển', color: 'purple' },
        { value: 'delivered', label: 'Đã giao hàng', color: 'emerald' },
        { value: 'failed', label: 'Giao hàng thất bại', color: 'red' }
    ];

    // Get button position
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    // Create menu
    const menu = document.createElement('div');
    menu.id = 'bulkStatusMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]';
    menu.style.zIndex = '10000';
    menu.style.left = rect.left + 'px';
    menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="bulkUpdateStatus('${s.value}', '${s.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-sm text-gray-700 flex-1">${s.label}</span>
        </button>
    `).join('');

    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.contains(e.target) && !menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Bulk Update Status - Update status for selected orders
async function bulkUpdateStatus(newStatus, statusLabel) {
    // Close menu
    const menu = document.getElementById('bulkStatusMenu');
    if (menu) menu.remove();

    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn đổi trạng thái ${count} đơn hàng sang "${statusLabel}"?`);

    if (!confirmed) return;

    try {
        showToast(`Đang cập nhật ${count} đơn hàng...`, 'info', 0, 'bulk-status');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateOrderStatus',
                        orderId: orderId,
                        status: newStatus
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                    // Update local data
                    updateOrderData(orderId, { status: newStatus });
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating order ${orderId}:`, error);
            }
        }

        // Clear selection and re-render
        clearSelection();
        renderOrdersTable();

        // Show result
        if (failCount === 0) {
            showToast(`Đã cập nhật thành công ${successCount} đơn hàng sang "${statusLabel}"`, 'success', null, 'bulk-status');
        } else {
            showToast(`Đã cập nhật ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-status');
        }
    } catch (error) {
        console.error('Error bulk updating status:', error);
        showToast('Không thể cập nhật trạng thái: ' + error.message, 'error', null, 'bulk-status');
    }
}

// Bulk Delete - Delete selected orders
async function bulkDelete() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa ${count} đơn hàng đã chọn?\n\nHành động này không thể hoàn tác!`);

    if (!confirmed) return;

    try {
        // Sử dụng ID để toast "đang xóa" sẽ được thay thế bởi toast "hoàn thành"
        showToast(`Đang xóa ${count} đơn hàng...`, 'info', 0, 'bulk-delete');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deleteOrder',
                        orderId: orderId
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error deleting order ${orderId}:`, error);
            }
        }

        // Clear selection and reload data
        clearSelection();
        await loadOrdersData();

        // Toast hoàn thành sẽ thay thế toast "đang xóa" nhờ cùng ID
        if (failCount === 0) {
            showToast(`Đã xóa thành công ${successCount} đơn hàng`, 'success', null, 'bulk-delete');
        } else {
            showToast(`Đã xóa ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-delete');
        }
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast('Không thể xóa đơn hàng: ' + error.message, 'error', null, 'bulk-delete');
    }
}

// Load packaging config from database
async function loadPackagingConfig() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getPackagingConfig&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.config) {
            packagingConfig = data.config;
            console.log('✅ Packaging config loaded:', packagingConfig);
        }
    } catch (error) {
        console.error('❌ Error loading packaging config:', error);
    }
}

// Calculate packaging cost based on selected items and quantity
function calculatePackagingCost() {
    if (!packagingConfig || packagingConfig.length === 0) {
        console.warn('⚠️ Packaging config not loaded yet');
        return 0;
    }

    // Get default items (is_default = 1)
    const defaultItems = packagingConfig.filter(item => item.is_default === 1);

    // Create a map of item costs
    const packagingPrices = {};
    defaultItems.forEach(item => {
        packagingPrices[item.item_name] = item.item_cost || 0;
    });

    // Calculate total products in cart (use currentOrderProducts, not window.cart)
    const totalProducts = currentOrderProducts.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // Per-product items (multiply by total products): red_string, labor_cost
    const perProductCost =
        ((packagingPrices.red_string || 0) * totalProducts) +
        ((packagingPrices.labor_cost || 0) * totalProducts);

    // Per-order items (fixed per order): bag_zip, bag_red, box_shipping, thank_card, paper_print
    const perOrderCost =
        (packagingPrices.bag_zip || 0) +
        (packagingPrices.bag_red || 0) +
        (packagingPrices.box_shipping || 0) +
        (packagingPrices.thank_card || 0) +
        (packagingPrices.paper_print || 0);

    const total = perProductCost + perOrderCost;

    // Debug logging
    console.log('📦 Packaging Cost Calculation:', {
        totalProducts,
        packagingPrices,
        perProductCost,
        perOrderCost,
        total,
        formula: `(red_string + labor_cost) × ${totalProducts} + (bag_zip + bag_red + box_shipping + thank_card + paper_print) = ${total}`
    });

    return total;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Orders Dashboard initialized');
    loadCurrentTaxRate(); // Load tax rate first
    loadOrdersData();
    loadPackagingConfig();
    setupEventListeners();

    // PERFORMANCE: Preload products in background for instant modal
    setTimeout(() => {
        if (allProductsList.length === 0) {
            console.log('⚡ Preloading products for faster modal...');
            loadProductsAndCategories().then(() => {
                console.log('✅ Products preloaded:', allProductsList.length);
            });
        }
    }, 1000); // Wait 1s after page load to not block initial render
});

// Setup event listeners
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');

    // Create debounced search function
    const debouncedSearch = debounce(filterOrdersData, 300);

    // Use event delegation on document to ensure events work even if elements are re-rendered
    document.addEventListener('input', function (e) {
        if (e.target.id === 'searchInput') {
            console.log('🔍 Search input changed');
            debouncedSearch();
        }
    });

    document.addEventListener('change', function (e) {
        if (e.target.id === 'statusFilter') {
            console.log('📋 Status filter changed to:', e.target.value);
            console.log('📋 Calling filterOrdersData()...');
            try {
                filterOrdersData();
                console.log('✅ filterOrdersData() completed');
            } catch (error) {
                console.error('❌ Error in filterOrdersData():', error);
            }
        } else if (e.target.id === 'dateFilter') {
            console.log('📅 Date filter changed to:', e.target.value);
            console.log('📅 Calling filterOrdersData()...');
            try {
                filterOrdersData();
                console.log('✅ filterOrdersData() completed');
            } catch (error) {
                console.error('❌ Error in filterOrdersData():', error);
            }
        }
    });

    console.log('✅ Event delegation setup complete');
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load orders data from API
async function loadOrdersData() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getRecentOrders&limit=1000&timestamp=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('📊 Received orders data:', data);

        if (data.success) {
            allOrdersData = data.orders || [];
            filteredOrdersData = [...allOrdersData];

            // Apply default sorting (newest first)
            applySorting();
            updateDateSortIcon();
            updateAmountSortIcon();

            updateStats();
            renderOrdersTable();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load data');
        }

    } catch (error) {
        console.error('❌ Error loading orders data:', error);
        hideLoading();
        showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    }
}

// Update statistics
function updateStats() {
    // Use filteredOrdersData to show stats based on current filter
    // This allows stats to update when date filter changes
    const dataToUse = filteredOrdersData.length > 0 || document.getElementById('dateFilter')?.value !== 'all' 
        ? filteredOrdersData 
        : allOrdersData;
    
    const totalOrders = dataToUse.length;

    // Calculate total revenue from total_amount (already includes products + shipping_fee)
    const totalRevenue = dataToUse.reduce((sum, order) => {
        return sum + (order.total_amount || 0);
    }, 0);

    // Calculate total commission - recalculate based on current CTV commission_rate if available
    const totalCommission = dataToUse.reduce((sum, order) => {
        // If order has CTV and current commission_rate, recalculate
        if (order.referral_code && order.ctv_commission_rate !== undefined && order.ctv_commission_rate !== null) {
            // Calculate product_total from total_amount - shipping_fee
            const totalAmount = order.total_amount || 0;
            const shippingFee = order.shipping_fee || 0;
            const productTotal = totalAmount - shippingFee;
            return sum + Math.round(productTotal * order.ctv_commission_rate);
        }
        // Otherwise use stored commission
        return sum + (order.commission || 0);
    }, 0);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Update stats - Remove skeleton and add text
    updateStatElement('totalOrders', totalOrders, 'text-3xl font-bold text-blue-600');
    updateStatElement('totalRevenue', formatCurrency(totalRevenue), 'text-3xl font-bold text-green-600');
    updateStatElement('totalCommission', formatCurrency(totalCommission), 'text-3xl font-bold text-orange-600');
    updateStatElement('todayOrders', formatCurrency(avgOrderValue), 'text-3xl font-bold text-purple-600');
    
    // Update stat labels based on filter
    updateStatLabels();
}

// Helper function to update stat element
function updateStatElement(elementId, value, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('skeleton', 'h-10', 'w-16', 'w-24', 'rounded');
        element.className = className;
        element.textContent = value;
    }
}

// Update stat labels based on current filter
function updateStatLabels() {
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';
    const customDateStart = document.getElementById('customDateStart')?.value;
    const customDateEnd = document.getElementById('customDateEnd')?.value;
    
    let periodLabel = '';
    
    if (dateFilter === 'all') {
        periodLabel = 'Tổng';
    } else if (dateFilter === 'today') {
        periodLabel = 'Hôm nay';
    } else if (dateFilter === 'yesterday') {
        periodLabel = 'Hôm qua';
    } else if (dateFilter === 'week') {
        periodLabel = '7 ngày';
    } else if (dateFilter === 'month') {
        periodLabel = '30 ngày';
    } else if (dateFilter === 'custom' && customDateStart && customDateEnd) {
        if (customDateStart === customDateEnd) {
            // Single date
            const date = new Date(customDateStart + 'T00:00:00');
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            periodLabel = `${day}/${month}`;
        } else {
            // Date range
            const start = new Date(customDateStart + 'T00:00:00');
            const end = new Date(customDateEnd + 'T00:00:00');
            const startDay = String(start.getDate()).padStart(2, '0');
            const startMonth = String(start.getMonth() + 1).padStart(2, '0');
            const endDay = String(end.getDate()).padStart(2, '0');
            const endMonth = String(end.getMonth() + 1).padStart(2, '0');
            
            if (start.getMonth() === end.getMonth()) {
                periodLabel = `${startDay}-${endDay}/${endMonth}`;
            } else {
                periodLabel = `${startDay}/${startMonth}-${endDay}/${endMonth}`;
            }
        }
    }
    
    // Update labels
    const totalOrdersLabel = document.getElementById('totalOrdersLabel');
    const totalRevenueLabel = document.getElementById('totalRevenueLabel');
    const totalCommissionLabel = document.getElementById('totalCommissionLabel');
    const todayOrdersLabel = document.getElementById('todayOrdersLabel');
    
    if (totalOrdersLabel) {
        totalOrdersLabel.textContent = periodLabel ? `${periodLabel} - Đơn hàng` : 'Tổng đơn hàng';
    }
    if (totalRevenueLabel) {
        totalRevenueLabel.textContent = periodLabel ? `${periodLabel} - Doanh thu` : 'Tổng doanh thu';
    }
    if (totalCommissionLabel) {
        totalCommissionLabel.textContent = periodLabel ? `${periodLabel} - Hoa hồng` : 'Tổng hoa hồng';
    }
    if (todayOrdersLabel) {
        todayOrdersLabel.textContent = periodLabel ? `${periodLabel} - TB/đơn` : 'Giá trị TB/đơn';
    }
}

// Filter orders data
function filterOrdersData() {
    console.log('🎯 FILTER FUNCTION CALLED - Version 2.0');

    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';

    console.log('🔍 Filtering with:', { searchTerm, statusFilter, dateFilter });

    // Debug: Show unique status values in data
    if (statusFilter !== 'all') {
        const uniqueStatuses = [...new Set(allOrdersData.map(o => o.status || 'pending'))];
        console.log('📊 Unique status values in data:', uniqueStatuses);
        console.log('📊 Total orders with each status:');
        uniqueStatuses.forEach(status => {
            const count = allOrdersData.filter(o => (o.status || 'pending').toLowerCase().trim() === status.toLowerCase().trim()).length;
            console.log(`   - ${status}: ${count} orders`);
        });
    }

    filteredOrdersData = allOrdersData.filter(order => {
        // Search filter
        const matchesSearch = !searchTerm ||
            (order.order_id && order.order_id.toLowerCase().includes(searchTerm)) ||
            (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm)) ||
            (order.customer_phone && order.customer_phone.includes(searchTerm)) ||
            (order.referral_code && order.referral_code.toLowerCase().includes(searchTerm));

        // Status filter - normalize status value and handle both Vietnamese and English
        const orderStatus = (order.status || 'pending').toLowerCase().trim();

        // Map Vietnamese status to English for comparison
        const statusMap = {
            'mới': 'pending',
            'chờ xử lý': 'pending',
            'đã gửi hàng': 'shipped',
            'đang vận chuyển': 'in_transit',
            'đã giao hàng': 'delivered',
            'giao hàng thất bại': 'failed'
        };

        const normalizedStatus = statusMap[orderStatus] || orderStatus;
        const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;

        // Debug status matching
        if (statusFilter !== 'all' && !matchesStatus) {
            console.log(`❌ Order ${order.order_id}: status="${order.status}" (normalized: "${orderStatus}") doesn't match filter="${statusFilter}"`);
        }

        // Date filter - using VN timezone for accurate comparison
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const orderDate = new Date(order.created_at || order.order_date);

            if (dateFilter === 'today') {
                const todayStart = getVNStartOfToday();
                const todayEnd = getVNEndOfToday();
                matchesDate = orderDate >= todayStart && orderDate <= todayEnd;
            } else if (dateFilter === 'yesterday') {
                const todayStart = getVNStartOfToday();
                const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
                const yesterdayEnd = new Date(todayStart.getTime() - 1);
                matchesDate = orderDate >= yesterdayStart && orderDate <= yesterdayEnd;
            } else if (dateFilter === 'week') {
                const weekStart = getVNStartOfWeek();
                matchesDate = orderDate >= weekStart;
            } else if (dateFilter === 'month') {
                const monthStart = getVNStartOfMonth();
                matchesDate = orderDate >= monthStart;
            } else if (dateFilter === 'custom') {
                // Custom date range filter
                const startDateStr = document.getElementById('customDateStart').value;
                const endDateStr = document.getElementById('customDateEnd').value;
                
                if (startDateStr && endDateStr) {
                    const customStart = getVNStartOfDate(startDateStr);
                    const customEnd = getVNEndOfDate(endDateStr);
                    matchesDate = orderDate >= customStart && orderDate <= customEnd;
                    
                    // Debug custom date filter
                    if (!matchesDate) {
                        console.log(`❌ Order ${order.order_id}: date=${orderDate.toISOString()} not in range [${customStart.toISOString()} - ${customEnd.toISOString()}]`);
                    }
                }
            }
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    console.log(`✅ Filtered: ${filteredOrdersData.length} orders (from ${allOrdersData.length} total)`);

    // Apply sorting
    applySorting();

    currentPage = 1; // Reset to first page when filtering

    // Update stats based on filtered data
    updateStats();

    renderOrdersTable();
}

// Render orders table
function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');

    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    if (filteredOrdersData.length === 0) {
        showEmptyState();
        return;
    }

    tbody.innerHTML = '';

    // Calculate pagination
    const totalPages = Math.ceil(filteredOrdersData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredOrdersData.slice(startIndex, endIndex);

    // Render rows for current page
    pageData.forEach((order, index) => {
        const globalIndex = startIndex + index + 1;
        const row = createOrderRow(order, globalIndex, index, pageData.length);
        tbody.appendChild(row);
    });

    // Render pagination
    renderPagination(totalPages);

    showTable();
}

// Create order row
function createOrderRow(order, index, pageIndex, totalPageItems) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors fade-in';

    // STT with Checkbox
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-4 py-4 whitespace-nowrap text-center';
    tdIndex.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <input type="checkbox" 
                   class="order-checkbox w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer" 
                   data-order-id="${order.id}"
                   onchange="handleOrderCheckbox(${order.id}, this.checked)">
            <span class="text-sm text-gray-500">${index}</span>
        </div>
    `;

    // Mã đơn với icon CTV và Status Badge
    const tdOrderId = document.createElement('td');
    tdOrderId.className = 'px-4 py-4 whitespace-nowrap text-center';

    // Use commission directly from database - same as profit analysis modal
    const displayCommission = order.commission || 0;

    // Show commission rate if available
    let commissionRateDisplay = '';
    if (order.referral_code && order.ctv_commission_rate !== undefined && order.ctv_commission_rate !== null) {
        commissionRateDisplay = `
        <div class="text-xs text-gray-500 mt-1">
            Tỷ lệ: ${(order.ctv_commission_rate * 100).toFixed(1)}%
        </div>`;
    }

    // Tạo icon CTV nếu có referral_code
    // Determine tooltip position: show above for last 3 items, below for others
    const isNearBottom = pageIndex > totalPageItems - 3;
    const tooltipPositionClass = isNearBottom ? 'bottom-full mb-2' : 'top-full mt-2';

    const ctvIcon = order.referral_code ? `
        <div class="relative group inline-block">
            <div onclick="showCollaboratorModal('${escapeHtml(order.referral_code)}')" class="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                </svg>
            </div>
            <!-- Tooltip - Auto position based on row location -->
            <div class="absolute left-0 ${tooltipPositionClass} hidden group-hover:block z-[9999] w-52 pointer-events-none">
                <div class="bg-white rounded-lg shadow-xl border border-gray-200 p-3 text-xs">
                    <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                        <svg class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                        </svg>
                        <span class="font-semibold text-gray-900">Đơn từ CTV</span>
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-600">Mã CTV:</span>
                            <span class="font-semibold text-blue-600">${escapeHtml(order.referral_code)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-600">Hoa hồng:</span>
                            <span class="font-bold text-orange-600">${formatCurrency(displayCommission)}</span>
                        </div>
                        ${commissionRateDisplay}
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    tdOrderId.innerHTML = `
        <div class="flex flex-col gap-2 items-center">
            <div class="flex items-center gap-2">
                ${ctvIcon}
                <span class="text-sm font-mono font-semibold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</span>
                <button onclick="copyToClipboard('${escapeHtml(order.order_id || '')}')" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>
            ${getStatusBadge(order.status, order.id, order.order_id)}
        </div>
    `;

    // Khách hàng
    const tdCustomer = document.createElement('td');
    tdCustomer.className = 'px-4 py-4 whitespace-nowrap text-center';
    const customerId = `customer_${order.id}`;
    tdCustomer.innerHTML = `
        <div id="${customerId}" class="group cursor-pointer hover:bg-blue-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors" onclick="editCustomerInfo(${order.id}, '${escapeHtml(order.order_id)}')">
            <div class="flex items-center gap-2">
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</div>
                    <div class="text-sm text-gray-500">${escapeHtml(order.customer_phone || 'N/A')}</div>
                </div>
                <button class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700 flex-shrink-0" title="Chỉnh sửa thông tin khách hàng">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Sản phẩm - Thiết kế đẹp với badges
    const tdProducts = document.createElement('td');
    tdProducts.className = 'px-4 py-4 text-center';
    tdProducts.innerHTML = formatProductsDisplay(order.products, order.id, order.order_id, order.notes);

    // Địa chỉ
    const tdAddress = document.createElement('td');
    tdAddress.className = 'px-4 py-4 text-center';
    tdAddress.style.minWidth = '350px';
    tdAddress.style.maxWidth = '500px';
    const address = order.address || 'Chưa có địa chỉ';
    tdAddress.innerHTML = `
        <div class="group cursor-pointer hover:bg-amber-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors relative" onclick="editAddress(${order.id}, '${escapeHtml(order.order_id)}')">
            <p class="text-sm text-gray-700 line-clamp-3 pr-6 text-left" title="${escapeHtml(address)}">
                ${escapeHtml(address)}
            </p>
            <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:text-amber-700" title="Chỉnh sửa địa chỉ">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
        </div>
    `;

    // Giá trị
    const tdAmount = document.createElement('td');
    tdAmount.className = 'px-4 py-4 whitespace-nowrap text-center';
    const paymentMethod = order.payment_method || 'COD';
    const paymentMethodDisplay = paymentMethod === 'COD' ? 'Tiền mặt' : paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : paymentMethod;
    tdAmount.innerHTML = `
        <div class="flex flex-col gap-1.5 items-center">
            <div class="group cursor-pointer hover:bg-green-50 rounded-lg px-3 py-2 transition-colors inline-flex items-center gap-2" onclick="editAmount(${order.id}, '${escapeHtml(order.order_id)}')">
                <span class="text-sm font-bold text-green-600">${formatCurrency(order.total_amount || 0)}</span>
                <button class="opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700" title="Chỉnh sửa giá trị">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
            <div class="text-xs text-gray-500">${escapeHtml(paymentMethodDisplay)}</div>
        </div>
    `;

    // Lãi ròng - Calculate dynamically
    const tdProfit = document.createElement('td');
    tdProfit.className = 'px-4 py-4 whitespace-nowrap text-center';
    const profit = calculateOrderProfit(order);
    const profitColor = profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-gray-600';
    const profitBg = profit > 0 ? 'bg-emerald-50' : profit < 0 ? 'bg-red-50' : 'bg-gray-50';
    tdProfit.innerHTML = `
        <div class="flex flex-col items-center gap-1">
            <span class="text-sm font-bold ${profitColor} px-2 py-1 ${profitBg} rounded">${formatCurrency(profit)}</span>
            <button onclick="showProfitBreakdown(${order.id})" class="text-xs text-gray-500 hover:text-gray-700 underline" title="Xem chi tiết">
                Chi tiết
            </button>
        </div>
    `;

    // Ngày đặt
    const tdDate = document.createElement('td');
    tdDate.className = 'px-4 py-4 text-sm text-gray-500 text-center';
    const dateTimeObj = formatDateTimeSplit(order.created_at || order.order_date);
    tdDate.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <span style="font-weight: 600; color: #374151; font-size: 0.875rem;">${dateTimeObj.time}</span>
            <span style="font-size: 0.75rem; color: #9CA3AF;">${dateTimeObj.date}</span>
        </div>
    `;

    // Thao tác
    const tdActions = document.createElement('td');
    tdActions.className = 'px-4 py-4 whitespace-nowrap text-center text-sm font-medium';
    tdActions.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <button onclick="copySPXFormat(${order.id})" 
                class="text-purple-600 hover:text-purple-700 transition-colors" title="Copy format SPX">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>
            <button onclick="viewOrderDetail(${order.id})" 
                class="text-admin-primary hover:text-admin-secondary transition-colors" title="Xem chi tiết">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            </button>
            <button onclick="duplicateOrder(${order.id})" 
                class="text-green-600 hover:text-green-700 transition-colors" title="Nhân bản đơn hàng">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>
            <button onclick="confirmDeleteOrder(${order.id}, '${escapeHtml(order.order_id)}')" 
                class="text-red-500 hover:text-red-700 transition-colors" title="Xóa đơn hàng">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    `;

    tr.appendChild(tdIndex);
    tr.appendChild(tdOrderId);
    tr.appendChild(tdCustomer);
    tr.appendChild(tdProducts);
    tr.appendChild(tdAddress);
    tr.appendChild(tdAmount);
    tr.appendChild(tdProfit);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);

    return tr;
}

// Show profit breakdown modal
function showProfitBreakdown(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) return;

    const { totalAmount, productCost } = calculateOrderTotals(order);

    // Get actual costs from order
    const shippingFee = order.shipping_fee || 0;
    const shippingCost = order.shipping_cost || 0;
    const packagingCost = order.packaging_cost || 0;
    const commission = order.commission || 0;

    // Debug log
    console.log('🔍 Profit Analysis Debug:', {
        order_id: order.order_id,
        total_amount_in_db: order.total_amount,
        shipping_fee: order.shipping_fee,
        discount_amount: order.discount_amount,
        calculated_productTotal: totalAmount,
        formula: `productTotal = ${order.total_amount} - ${order.shipping_fee} + ${order.discount_amount} = ${totalAmount}`,
        product_cost_from_order: order.product_cost,
        calculated_productCost: productCost,
        has_items: order.items ? order.items.length : 'no items',
        has_products_json: !!order.products
    });

    // Debug: Parse products to see cost_price
    if (order.products) {
        try {
            const products = JSON.parse(order.products);
            console.log('📦 Products in order:', products);
            products.forEach((p, i) => {
                console.log(`  [${i}] ${p.name}: cost=${p.cost_price || p.cost || 0}, qty=${p.quantity || 1}, total=${(p.cost_price || p.cost || 0) * (p.quantity || 1)}`);
            });
        } catch (e) {
            console.log('⚠️ Could not parse products:', e);
        }
    }

    // Calculate revenue
    // IMPORTANT: totalAmount from calculateOrderTotals() is productTotal (before discount)
    // revenue = productTotal + shippingFee - discountAmount
    const discountAmount = order.discount_amount || 0;
    const revenue = totalAmount + shippingFee - discountAmount;

    // Use saved tax_amount if available, otherwise calculate
    const tax = order.tax_amount || Math.round(revenue * (order.tax_rate || COST_CONSTANTS.TAX_RATE));
    const taxRate = order.tax_rate || COST_CONSTANTS.TAX_RATE;

    // Get commission rate from order (saved at creation time)
    const commissionRate = order.commission_rate || 0;

    // Calculate profit
    const totalCost = productCost + shippingCost + packagingCost + commission + tax;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

    // Parse packaging details
    let packagingDetails = null;
    try {
        packagingDetails = order.packaging_details ? JSON.parse(order.packaging_details) : null;
    } catch (e) {
        console.error('Error parsing packaging_details:', e);
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <!-- Header -->
            <div class="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 py-5 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-bold text-white">Phân tích Lãi/Lỗ</h3>
                        <p class="text-sm text-blue-100 mt-1">Đơn hàng: ${escapeHtml(order.order_id)}</p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-white/80 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="p-6">
                <!-- Revenue Section -->
                <div class="mb-4">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900">Doanh thu</h4>
                    </div>
                    <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Tiền sản phẩm</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(totalAmount)}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Phí ship (khách trả)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(shippingFee)}</span>
                        </div>
                        ${order.discount_amount && order.discount_amount > 0 ? `
                        <div class="flex justify-between items-center bg-purple-50 -mx-2 px-2 py-1.5 rounded">
                            <div class="flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <span class="text-sm text-purple-700 font-medium">Mã giảm giá (${escapeHtml(order.discount_code || '')})</span>
                            </div>
                            <span class="font-semibold text-purple-700">-${formatCurrency(order.discount_amount)}</span>
                        </div>
                        ` : ''}
                        <div class="flex justify-between items-center pt-2 border-t border-green-200">
                            <span class="font-bold text-gray-900">Tổng doanh thu</span>
                            <span class="text-lg font-bold text-green-600">${formatCurrency(revenue)}</span>
                        </div>
                    </div>
                </div>

                <!-- Cost Section -->
                <div class="mb-4">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900">Chi phí</h4>
                    </div>
                    <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Giá vốn sản phẩm</span>
                            <span class="font-semibold ${productCost === 0 ? 'text-orange-600' : 'text-gray-900'}">${formatCurrency(productCost)}</span>
                        </div>
                        ${productCost === 0 ? `
                        <div class="bg-orange-100 border border-orange-300 rounded-lg p-2 text-xs text-orange-800">
                            <div class="flex items-start gap-2">
                                <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <div class="font-semibold mb-1">Chưa có giá vốn</div>
                                    <div>Đơn hàng cũ chưa có dữ liệu giá vốn. Vui lòng:</div>
                                    <div class="mt-1">• Sửa sản phẩm trong đơn để cập nhật giá vốn</div>
                                    <div>• Hoặc reload trang để lấy dữ liệu mới</div>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- Packaging Cost with Toggle -->
                        <div class="space-y-2">
                            <div class="flex justify-between items-center group">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm text-gray-600">Chi phí</span>
                                    <button onclick="event.stopPropagation(); this.closest('.space-y-2').querySelector('.packaging-details-toggle').classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');" 
                                        class="text-gray-400 hover:text-gray-600" 
                                        title="Xem chi tiết">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </button>
                                </div>
                                <span class="font-semibold ${packagingCost > 0 ? 'text-gray-900' : 'text-gray-400'}">${formatCurrency(packagingCost)}</span>
                            </div>
                            
                            <!-- Packaging Details (Hidden by default) -->
                            ${packagingDetails ? `
                            <div class="packaging-details-toggle hidden ml-6 pl-3 border-l-2 border-purple-300 space-y-1.5">
                                ${packagingDetails.per_product ? `
                                <div class="text-xs font-semibold text-purple-700 mb-1.5">Chi phí theo sản phẩm (×${packagingDetails.total_products || 0}):</div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Dây đỏ</span>
                                    <span class="font-medium text-gray-700">${formatCurrency((packagingDetails.per_product.red_string || 0) * (packagingDetails.total_products || 0))}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Tiền công</span>
                                    <span class="font-medium text-gray-700">${formatCurrency((packagingDetails.per_product.labor_cost || 0) * (packagingDetails.total_products || 0))}</span>
                                </div>
                                ` : ''}
                                ${packagingDetails.per_order ? `
                                <div class="text-xs font-semibold text-purple-700 mb-1.5 ${packagingDetails.per_product ? 'mt-2' : ''}">Chi phí theo đơn hàng (1 lần):</div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Túi zip</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(packagingDetails.per_order.bag_zip || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Túi đỏ</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(packagingDetails.per_order.bag_red || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Hộp đựng</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(packagingDetails.per_order.box_shipping || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Thiệp cảm ơn</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(packagingDetails.per_order.thank_card || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• Giấy in</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(packagingDetails.per_order.paper_print || 0)}</span>
                                </div>
                                ` : ''}
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Phí ship (thực tế)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(shippingCost)}</span>
                        </div>
                        ${commission > 0 ? `
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Hoa hồng CTV (${(commissionRate * 100).toFixed(1)}%)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(commission)}</span>
                        </div>
                        ` : ''}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Thuế (${(taxRate * 100).toFixed(1)}%)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(tax)}</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 border-t border-red-200">
                            <span class="font-bold text-gray-900">Tổng chi phí</span>
                            <span class="text-lg font-bold text-red-600">${formatCurrency(totalCost)}</span>
                        </div>
                    </div>
                </div>

                <!-- Profit Section -->
                <div class="bg-gradient-to-br ${profit >= 0 ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-gray-50 to-slate-50 border-gray-200'} border-2 rounded-xl p-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-base font-bold text-gray-900">Lợi nhuận ròng</span>
                        <span class="text-2xl font-bold ${profit > 0 ? 'text-blue-600' : profit < 0 ? 'text-red-600' : 'text-gray-600'}">
                            ${formatCurrency(profit)}
                        </span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-600">Tỷ suất lợi nhuận</span>
                        <span class="font-semibold ${profit > 0 ? 'text-blue-600' : profit < 0 ? 'text-red-600' : 'text-gray-600'}">
                            ${profitMargin}%
                        </span>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-2">
                <button onclick="this.closest('.fixed').remove()" 
                    class="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors shadow-sm">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Format products display with beautiful badges
function formatProductsDisplay(productsText, orderId, orderCode, orderNotes = null) {
    if (!productsText || productsText.trim() === '') {
        return '<span class="text-sm text-gray-400 italic">Không có thông tin</span>';
    }

    // Parse products - có thể là text hoặc JSON
    let products = [];

    try {
        // Thử parse JSON nếu có
        products = JSON.parse(productsText);
    } catch (e) {
        // Nếu không phải JSON, parse text thông thường
        // Format: "Sản phẩm A x2, Sản phẩm B x1" hoặc "Sản phẩm A\nSản phẩm B"
        const lines = productsText.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            // Tách tên và số lượng nếu có format "Tên x Số lượng"
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Nếu không parse được gì, hiển thị text gốc
    if (!Array.isArray(products) || products.length === 0) {
        // Giới hạn độ dài text và thêm tooltip
        const shortText = productsText.length > 50 ? productsText.substring(0, 50) + '...' : productsText;
        return `
            <div class="max-w-xs">
                <p class="text-sm text-gray-700 line-clamp-2" title="${escapeHtml(productsText)}">
                    ${escapeHtml(shortText)}
                </p>
            </div>
        `;
    }

    // Hiển thị tối đa 3 sản phẩm, còn lại hiển thị "+X sản phẩm"
    const maxDisplay = 3;
    const displayProducts = products.slice(0, maxDisplay);
    const remainingProducts = products.slice(maxDisplay);
    const remainingCount = remainingProducts.length;

    // Tạo ID duy nhất cho container này
    const uniqueId = 'products_' + Math.random().toString(36).substr(2, 9);

    let html = '<div class="flex flex-col gap-2 w-full">';

    // Hiển thị 3 sản phẩm đầu tiên
    displayProducts.forEach((product, index) => {
        const productName = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
        const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
        const price = typeof product === 'object' && product.price ? product.price : null;
        const weight = typeof product === 'object' && product.weight ? product.weight : null;
        const size = typeof product === 'object' && product.size ? product.size : null;
        const notes = typeof product === 'object' && product.notes ? product.notes : null;

        // Parse quantity nếu là string
        const parsedQuantity = typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity;

        // Tạo text chi tiết
        const details = [];
        if (weight) details.push(`⚖️ ${formatWeightSize(weight)}`);
        if (size) {
            // Phân biệt icon dựa vào nội dung: nếu có "cm" hoặc "size" thì dùng thước, còn lại dùng cân
            const isSizeMeasurement = size.toLowerCase().includes('cm') ||
                size.toLowerCase().includes('size') ||
                size.toLowerCase().includes('tay');
            const icon = isSizeMeasurement ? '📏' : '⚖️';
            details.push(`${icon} ${formatWeightSize(size)}`);
        }
        if (price) {
            const priceNum = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d]/g, ''));
            if (!isNaN(priceNum) && priceNum > 0) {
                details.push(`💰 ${formatCurrency(priceNum * parsedQuantity)}`);
            }
        }
        const detailsText = details.length > 0 ? details.join(' • ') : '';

        const productId = `product_${orderId}_${index}`;
        html += `
            <div class="relative bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl px-3 py-2.5 border border-purple-200 shadow-sm hover:shadow-md transition-all group">
                <!-- Header: Tên sản phẩm và số lượng -->
                <div class="flex items-start gap-2 mb-1.5">
                    <div class="flex-shrink-0 w-2 h-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm mt-1.5">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start gap-2">
                            <span id="${productId}" class="text-sm font-semibold text-gray-900 break-words leading-tight" title="${escapeHtml(productName)}">
                                ${escapeHtml(productName)}
                            </span>
                            ${parsedQuantity > 1 ? `
                                <span class="inline-flex items-center px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-sm flex-shrink-0">
                                    ×${parsedQuantity}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <!-- Action buttons -->
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Chỉnh sửa">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="confirmDeleteProduct(${orderId}, ${index}, '${escapeHtml(orderCode)}', '${escapeHtml(productName)}')" class="p-1 text-red-600 hover:bg-red-100 rounded transition-colors" title="Xóa">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Details: Giá, cân nặng -->
                ${detailsText ? `
                    <div class="flex items-center gap-2 text-xs text-gray-600 pl-8 mb-1">
                        ${detailsText}
                    </div>
                ` : ''}
                
                <!-- Notes -->
                ${notes ? `
                    <div class="flex items-start gap-1.5 text-xs text-gray-700 pl-8 mt-1.5 pt-1.5 border-t border-purple-200">
                        <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span class="italic">${escapeHtml(notes)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    });

    // Container cho các sản phẩm còn lại (ẩn mặc định)
    if (remainingCount > 0) {
        html += `<div id="${uniqueId}_hidden" class="hidden flex flex-col gap-2">`;

        remainingProducts.forEach((product, index) => {
            const productName = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
            const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
            const price = typeof product === 'object' && product.price ? product.price : null;
            const weight = typeof product === 'object' && product.weight ? product.weight : null;
            const size = typeof product === 'object' && product.size ? product.size : null;
            const notes = typeof product === 'object' && product.notes ? product.notes : null;

            const parsedQuantity = typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity;

            // Tạo text chi tiết
            const details = [];
            if (weight) details.push(`⚖️ ${formatWeightSize(weight)}`);
            if (size) {
                // Phân biệt icon dựa vào nội dung: nếu có "cm" hoặc "size" thì dùng thước, còn lại dùng cân
                const isSizeMeasurement = size.toLowerCase().includes('cm') ||
                    size.toLowerCase().includes('size') ||
                    size.toLowerCase().includes('tay');
                const icon = isSizeMeasurement ? '📏' : '⚖️';
                details.push(`${icon} ${formatWeightSize(size)}`);
            }
            if (price) {
                const priceNum = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d]/g, ''));
                if (!isNaN(priceNum) && priceNum > 0) {
                    details.push(`💰 ${formatCurrency(priceNum * parsedQuantity)}`);
                }
            }
            const detailsText = details.length > 0 ? details.join(' • ') : '';

            const productId = `product_${orderId}_${maxDisplay + index}`;
            const actualIndex = maxDisplay + index;
            html += `
                <div class="relative bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl px-3 py-2.5 border border-purple-200 shadow-sm hover:shadow-md transition-all group">
                    <div class="flex items-start gap-2 mb-1.5">
                        <div class="flex-shrink-0 w-2 h-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm mt-1.5">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start gap-2">
                                <span id="${productId}" class="text-sm font-semibold text-gray-900 break-words leading-tight" title="${escapeHtml(productName)}">
                                    ${escapeHtml(productName)}
                                </span>
                                ${parsedQuantity > 1 ? `
                                    <span class="inline-flex items-center px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-sm flex-shrink-0">
                                        ×${parsedQuantity}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Chỉnh sửa">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            <button onclick="confirmDeleteProduct(${orderId}, ${actualIndex}, '${escapeHtml(orderCode)}', '${escapeHtml(productName)}')" class="p-1 text-red-600 hover:bg-red-100 rounded transition-colors" title="Xóa">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    ${detailsText ? `
                        <div class="flex items-center gap-2 text-xs text-gray-600 pl-8 mb-1">
                            ${detailsText}
                        </div>
                    ` : ''}
                    ${notes ? `
                        <div class="flex items-start gap-1.5 text-xs text-gray-700 pl-8 mt-1.5 pt-1.5 border-t border-purple-200">
                            <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <span class="italic">${escapeHtml(notes)}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';

        // Nút toggle
        html += `
            <div id="${uniqueId}_toggle" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors" 
                 onclick="toggleProducts('${uniqueId}')">
                <svg id="${uniqueId}_icon" class="w-4 h-4 text-gray-500 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span id="${uniqueId}_text" class="text-xs font-medium text-gray-600">
                    ${remainingCount} sản phẩm khác
                </span>
            </div>
        `;
    }

    // Order Notes (if exists)
    if (orderNotes) {
        html += `
            <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg px-3 py-2 border border-amber-200">
                <div class="flex items-start gap-2">
                    <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-amber-800 mb-0.5">Lưu ý đơn hàng</p>
                        <p class="text-xs text-gray-700 line-clamp-2" title="${escapeHtml(orderNotes)}">${escapeHtml(orderNotes)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Add product and notes buttons (2 columns)
    html += `
        <div class="grid grid-cols-2 gap-2">
            <!-- Add Product Button -->
            <div class="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border-2 border-dashed border-purple-200 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all group" 
                 onclick="showProductSelectionModalForOrder(${orderId}, '${escapeHtml(orderCode)}')">
                <div class="w-5 h-5 rounded-full bg-purple-100 group-hover:bg-purple-500 flex items-center justify-center transition-colors flex-shrink-0">
                    <svg class="w-3 h-3 text-purple-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>
                <span class="text-xs font-medium text-purple-600 group-hover:text-purple-700">Thêm SP</span>
            </div>
            
            <!-- Add Notes Button -->
            <div class="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border-2 border-dashed border-amber-200 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all group" 
                 onclick="showAddOrderNotesModal(${orderId}, '${escapeHtml(orderCode)}')">
                <div class="w-5 h-5 rounded-full bg-amber-100 group-hover:bg-amber-500 flex items-center justify-center transition-colors flex-shrink-0">
                    <svg class="w-3 h-3 text-amber-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <span class="text-xs font-medium text-amber-600 group-hover:text-amber-700">Ghi chú</span>
            </div>
        </div>
    `;

    html += '</div>';
    return html;
}

// View order detail
function viewOrderDetail(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    showOrderDetailModal(order);
}

// Show order detail modal
function showOrderDetailModal(order) {
    const modal = document.createElement('div');
    modal.id = 'orderDetailModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-admin-primary to-admin-secondary px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Chi tiết đơn hàng</h2>
                        <p class="text-sm text-white/80">${escapeHtml(order.order_id || 'N/A')}</p>
                    </div>
                </div>
                <button onclick="closeOrderDetailModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Content -->
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                <div class="space-y-6">
                    <!-- Order Info -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thông tin đơn hàng</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Mã đơn hàng</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Ngày đặt</p>
                                <p class="text-sm font-semibold text-gray-900">${formatDateTime(order.created_at || order.order_date)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Giá trị đơn hàng</p>
                                <p class="text-sm font-bold text-green-600">${formatCurrency(order.total_amount || 0)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Hoa hồng</p>
                                <p class="text-sm font-bold text-orange-600">${formatCurrency(order.commission || 0)}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Customer Info -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thông tin khách hàng</h3>
                        <div class="grid grid-cols-1 gap-3">
                            <div>
                                <p class="text-sm text-gray-500">Tên khách hàng</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Số điện thoại</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.customer_phone || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Địa chỉ</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.address || 'N/A')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- CTV Info -->
                    ${order.referral_code ? `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thông tin CTV</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Mã CTV</p>
                                <p class="text-sm font-semibold text-blue-600">${escapeHtml(order.referral_code)}</p>
                            </div>
                            ${order.ctv_phone ? `
                            <div>
                                <p class="text-sm text-gray-500">SĐT CTV</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.ctv_phone)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Products -->
                    ${order.products ? `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            Sản phẩm
                        </h3>
                        ${formatProductsForModal(order.products)}
                    </div>
                    ` : ''}

                    <!-- Payment & Status -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thanh toán & Trạng thái</h3>
                        <div class="grid grid-cols-2 gap-4">
                            ${order.payment_method ? `
                            <div>
                                <p class="text-sm text-gray-500">Phương thức thanh toán</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.payment_method)}</p>
                            </div>
                            ` : ''}
                            ${order.status ? `
                            <div>
                                <p class="text-sm text-gray-500">Trạng thái</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.status)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Order Notes -->
                    ${order.notes ? `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            Ghi chú đơn hàng
                        </h3>
                        <div class="bg-amber-50 rounded-xl p-4 border border-amber-200">
                            <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(order.notes)}</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
                <button type="button" onclick="closeOrderDetailModal()" 
                    class="px-6 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close order detail modal
function closeOrderDetailModal() {
    const modal = document.getElementById('orderDetailModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Format products for modal display
function formatProductsForModal(productsText) {
    if (!productsText || productsText.trim() === '') {
        return '<p class="text-sm text-gray-400 italic">Không có sản phẩm</p>';
    }

    let products = [];

    try {
        // Try to parse as JSON
        products = JSON.parse(productsText);
    } catch (e) {
        // If not JSON, parse as text
        const lines = productsText.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // If still can't parse, show raw text in a nice format
    if (!Array.isArray(products) || products.length === 0) {
        return `
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(productsText)}</p>
            </div>
        `;
    }

    // Display products beautifully
    let html = '<div class="space-y-3">';

    products.forEach((product, index) => {
        const productName = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
        const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
        const priceRaw = typeof product === 'object' && product.price ? product.price : null;
        const weight = typeof product === 'object' && product.weight ? product.weight : null;
        const size = typeof product === 'object' && product.size ? product.size : null;
        const notes = typeof product === 'object' && product.notes ? product.notes : null;

        // Format price - multiply by quantity for total
        let priceDisplay = null;
        if (priceRaw) {
            const priceNum = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/[^\d]/g, ''));
            if (!isNaN(priceNum) && priceNum > 0) {
                priceDisplay = formatCurrency(priceNum * quantity);
            }
        }

        html += `
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 hover:shadow-md transition-shadow">
                <div class="flex items-start gap-3">
                    <!-- Product Number Badge -->
                    <div class="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                        <span class="text-sm font-bold text-white">${index + 1}</span>
                    </div>
                    
                    <!-- Product Info -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3 mb-2">
                            <h4 class="text-base font-semibold text-gray-900 flex-1">${escapeHtml(productName)}</h4>
                            ${quantity > 1 ? `
                                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white bg-purple-500 flex-shrink-0">
                                    x${quantity}
                                </span>
                            ` : ''}
                        </div>
                        
                        <!-- Product Details -->
                        ${(priceDisplay || weight || size) ? `
                            <div class="flex flex-wrap gap-3 mb-2">
                                ${priceDisplay ? `
                                    <div class="flex items-center gap-1.5 text-sm">
                                        <svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span class="font-semibold text-green-700">${escapeHtml(priceDisplay)}</span>
                                    </div>
                                ` : ''}
                                ${weight ? `
                                    <div class="flex items-center gap-1.5 text-sm">
                                        <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                        </svg>
                                        <span class="text-gray-700">${escapeHtml(formatWeightSize(weight))}</span>
                                    </div>
                                ` : ''}
                                ${size ? `
                                    <div class="flex items-center gap-1.5 text-sm">
                                        <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                        </svg>
                                        <span class="text-gray-700">${escapeHtml(formatWeightSize(size))}</span>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        <!-- Notes -->
                        ${notes ? `
                            <div class="mt-2 pt-2 border-t border-purple-200">
                                <div class="flex items-start gap-2">
                                    <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    <p class="text-sm text-gray-600 italic">${escapeHtml(notes)}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// Toggle products visibility
function toggleProducts(uniqueId) {
    const hiddenContainer = document.getElementById(uniqueId + '_hidden');
    const icon = document.getElementById(uniqueId + '_icon');
    const text = document.getElementById(uniqueId + '_text');

    if (!hiddenContainer || !icon || !text) return;

    const isHidden = hiddenContainer.classList.contains('hidden');

    if (isHidden) {
        // Hiển thị các sản phẩm còn lại
        hiddenContainer.classList.remove('hidden');
        hiddenContainer.classList.add('flex');

        // Đổi icon thành minus
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />';

        // Đổi text
        text.textContent = 'Thu gọn';
    } else {
        // Ẩn các sản phẩm còn lại
        hiddenContainer.classList.add('hidden');
        hiddenContainer.classList.remove('flex');

        // Đổi icon thành plus
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />';

        // Đổi text về ban đầu
        const count = hiddenContainer.children.length;
        text.textContent = count + ' sản phẩm khác';
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy: ' + text);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Copy SPX format
async function copySPXFormat(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let productsText = '';
    if (order.products) {
        try {
            let products = [];
            // Try parse JSON
            try {
                products = JSON.parse(order.products);
            } catch (e) {
                // If not JSON, parse text format
                const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
                products = lines.map(line => {
                    const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                    if (match) {
                        return { name: match[1].trim(), quantity: parseInt(match[2]) };
                    }
                    return { name: line, quantity: 1 };
                });
            }

            // Format each product
            const productLines = products.map((product, index) => {
                const name = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
                const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
                const weight = typeof product === 'object' && product.weight ? product.weight : null;
                const notes = typeof product === 'object' && product.notes ? product.notes : null;

                // Build product line
                let line = name;
                line += ` - Số lượng: ${quantity}`;

                // Add size (weight or size) if exists
                if (weight) {
                    line += ` - Size: ${weight}`;
                }

                // Add notes if exists
                if (notes) {
                    line += ` - Lưu ý: ${notes}`;
                }

                // Wrap in brackets
                return `[${line}]`;
            });

            // Join products with " ----- " separator (on same line)
            productsText = productLines.join(' ----- ');

            // Add order notes if exists and has multiple products
            if (products.length >= 2 && order.notes && order.notes.trim()) {
                productsText += ` ----- Lưu ý tổng: ${order.notes.trim()}`;
            }
        } catch (e) {
            // Fallback to raw text
            productsText = order.products;
        }
    }

    // Format: Họ và tên\nSố điện thoại\nĐịa chỉ cụ thể\nDanh sách sản phẩm
    let spxFormat = `${order.customer_name || 'N/A'}
${order.customer_phone || 'N/A'}
${order.address || 'N/A'}`;

    if (productsText) {
        spxFormat += '\n' + productsText;
    }

    try {
        // Copy to clipboard
        await navigator.clipboard.writeText(spxFormat);
        showToast('Đã copy format SPX', 'success');

        // Auto-update status to "shipped" (Đã gửi hàng)
        // Only update if current status is not already shipped, in_transit, delivered, or failed
        const currentStatus = order.status || 'pending';
        if (currentStatus !== 'shipped' && currentStatus !== 'in_transit' && currentStatus !== 'delivered' && currentStatus !== 'failed') {
            await updateOrderStatus(orderId, 'shipped', order.order_id);
        }
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Lỗi khi copy', 'error');
    }
}

// Render pagination
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200">';

    // Info text
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredOrdersData.length);
    html += `<div class="text-sm text-gray-700">
        Hiển thị <span class="font-medium">${startItem}</span> đến <span class="font-medium">${endItem}</span> trong tổng số <span class="font-medium">${filteredOrdersData.length}</span> đơn hàng
    </div>`;

    // Pagination buttons
    html += '<div class="flex items-center gap-2">';

    // Previous button
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
    </button>`;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="goToPage(1)" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">1</button>`;
        if (startPage > 2) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-2 rounded-lg bg-admin-primary text-white text-sm font-medium">${i}</button>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
        html += `<button onclick="goToPage(${totalPages})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${totalPages}</button>`;
    }

    // Next button
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
    </button>`;

    html += '</div></div>';

    paginationContainer.innerHTML = html;
}

// Go to page
function goToPage(page) {
    const totalPages = Math.ceil(filteredOrdersData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderOrdersTable();

    // Scroll to top of table
    document.getElementById('tableContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Toggle date sort
function toggleDateSort() {
    // Reset amount sort
    amountSortOrder = 'none';
    updateAmountSortIcon();

    // Cycle through: desc -> asc -> none -> desc
    if (dateSortOrder === 'desc') {
        dateSortOrder = 'asc';
    } else if (dateSortOrder === 'asc') {
        dateSortOrder = 'none';
    } else {
        dateSortOrder = 'desc';
    }

    // Update icon
    updateDateSortIcon();

    // Apply sort
    applySorting();

    // Reset to first page
    currentPage = 1;
    renderOrdersTable();
}

// Toggle amount sort
function toggleAmountSort() {
    // Reset date sort
    dateSortOrder = 'none';
    updateDateSortIcon();

    // Cycle through: desc -> asc -> none -> desc
    if (amountSortOrder === 'desc') {
        amountSortOrder = 'asc';
    } else if (amountSortOrder === 'asc') {
        amountSortOrder = 'none';
    } else {
        amountSortOrder = 'desc';
    }

    // Update icon
    updateAmountSortIcon();

    // Apply sort
    applySorting();

    // Reset to first page
    currentPage = 1;
    renderOrdersTable();
}

// Update date sort icon
function updateDateSortIcon() {
    const icon = document.getElementById('dateSortIcon');
    if (!icon) return;

    if (dateSortOrder === 'desc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-admin-primary');
    } else if (dateSortOrder === 'asc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-admin-primary');
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-admin-primary');
        icon.classList.add('text-gray-400');
    }
}

// Update amount sort icon
function updateAmountSortIcon() {
    const icon = document.getElementById('amountSortIcon');
    if (!icon) return;

    if (amountSortOrder === 'desc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-green-500');
    } else if (amountSortOrder === 'asc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-green-500');
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-green-500');
        icon.classList.add('text-gray-400');
    }
}

// Apply sorting
function applySorting() {
    // Ưu tiên sắp xếp theo amount nếu đang active
    if (amountSortOrder !== 'none') {
        filteredOrdersData.sort((a, b) => {
            const amountA = a.total_amount || 0;
            const amountB = b.total_amount || 0;

            if (amountSortOrder === 'desc') {
                return amountB - amountA;
            } else {
                return amountA - amountB;
            }
        });
    } else if (dateSortOrder !== 'none') {
        filteredOrdersData.sort((a, b) => {
            const dateA = new Date(a.created_at || a.order_date || 0);
            const dateB = new Date(b.created_at || b.order_date || 0);

            if (dateSortOrder === 'desc') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });
    }
}

// Refresh data
function refreshData() {
    showToast('Đang tải lại dữ liệu...', 'info');
    loadOrdersData();
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    // Handle invalid values
    if (amount === null || amount === undefined || isNaN(amount)) return '0đ';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0đ';

    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(numAmount);
}

function formatWeightSize(value) {
    if (!value) return '';
    let str = String(value).trim();

    // Loại bỏ khoảng trắng thừa: "5 kg" -> "5kg"
    str = str.replace(/\s+/g, '');

    // Nếu chỉ là số thuần túy (không có chữ cái) thì thêm "kg"
    if (/^\d+(\.\d+)?$/.test(str)) {
        return str + 'kg';
    }

    // Chuẩn hóa các đơn vị phổ biến
    str = str
        .replace(/^(\d+(\.\d+)?)g$/i, '$1g')           // "5g" -> "5g"
        .replace(/^(\d+(\.\d+)?)kg$/i, '$1kg')         // "5kg" -> "5kg"
        .replace(/^(\d+(\.\d+)?)cm$/i, '$1cm')         // "5cm" -> "5cm"
        .replace(/^(\d+(\.\d+)?)mm$/i, '$1mm')         // "5mm" -> "5mm"
        .replace(/gram$/i, 'g')                         // "5gram" -> "5g"
        .replace(/kilogram$/i, 'kg');                   // "5kilogram" -> "5kg"

    return str;
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Use timezone-utils to convert UTC to VN timezone
        return toVNDateString(dateString);
    } catch (e) {
        return dateString;
    }
}

function formatDateTimeSplit(dateString) {
    if (!dateString) return { time: 'N/A', date: '' };
    try {
        // Convert to VN timezone
        const vnDate = toVNDate(dateString);

        // Format time (HH:mm:ss)
        const hours = vnDate.getHours().toString().padStart(2, '0');
        const minutes = vnDate.getMinutes().toString().padStart(2, '0');
        const seconds = vnDate.getSeconds().toString().padStart(2, '0');
        const time = `${hours}:${minutes}:${seconds}`;

        // Format date (DD/MM/YYYY)
        const day = vnDate.getDate().toString().padStart(2, '0');
        const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
        const year = vnDate.getFullYear();
        const date = `${day}/${month}/${year}`;

        return { time, date };
    } catch (e) {
        return { time: dateString, date: '' };
    }
}

// UI State functions
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function showTable() {
    document.getElementById('tableContent').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function showEmptyState() {
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}

// showToast is now provided by toast-manager.js

// Show collaborator modal
async function showCollaboratorModal(referralCode) {
    try {
        // Get collaborator info from existing orders data
        const ctvOrders = allOrdersData.filter(order => order.referral_code === referralCode);

        if (ctvOrders.length === 0) {
            showToast('Không tìm thấy thông tin CTV', 'error');
            return;
        }

        // Calculate stats from orders - use product_total + shipping_fee for accurate revenue
        const stats = {
            totalOrders: ctvOrders.length,
            totalRevenue: ctvOrders.reduce((sum, order) => {
                return sum + (order.total_amount || 0);
            }, 0),
            totalCommission: ctvOrders.reduce((sum, order) => {
                // Recalculate commission based on current CTV commission_rate if available
                if (order.ctv_commission_rate !== undefined && order.ctv_commission_rate !== null) {
                    // Calculate product_total from total_amount - shipping_fee
                    const totalAmount = order.total_amount || 0;
                    const shippingFee = order.shipping_fee || 0;
                    const productTotal = totalAmount - shippingFee;
                    return sum + Math.round(productTotal * order.ctv_commission_rate);
                }
                return sum + (order.commission || 0);
            }, 0)
        };

        // Get CTV info - fetch from API to get full details
        let ctv = {
            referral_code: referralCode,
            name: 'Đang tải...',
            phone: ctvOrders[0].ctv_phone || 'Chưa cập nhật',
            email: null,
            commission_rate: ctvOrders[0].commission && ctvOrders[0].total_amount
                ? (ctvOrders[0].commission / ctvOrders[0].total_amount * 100).toFixed(1)
                : 10,
            bank_info: null
        };

        // Fetch CTV details from getAllCTV API
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=getAllCTV&timestamp=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.ctvList) {
                const ctvInfo = data.ctvList.find(c => c.referralCode === referralCode);
                if (ctvInfo) {
                    ctv.name = ctvInfo.fullName || 'Chưa cập nhật';
                    ctv.phone = ctvInfo.phone || ctv.phone;
                    ctv.email = ctvInfo.email;
                    ctv.commission_rate = (ctvInfo.commissionRate * 100).toFixed(1);
                }
            }
        } catch (error) {
            console.warn('Could not fetch CTV details:', error);
            ctv.name = 'Cộng tác viên';
        }

        const modal = document.createElement('div');
        modal.id = 'collaboratorModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modal.style.animation = 'fadeIn 0.3s ease-out';

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" style="animation: fadeIn 0.3s ease-out;">
                <!-- Header with gradient -->
                <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-black/10"></div>
                    <div class="relative flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/30">
                                <svg class="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold text-white mb-1">Thông tin Cộng tác viên</h2>
                                <p class="text-white/90 text-sm font-medium">Mã CTV: ${escapeHtml(ctv.referral_code)}</p>
                            </div>
                        </div>
                        <button onclick="closeCollaboratorModal()" class="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:rotate-90 duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-3 gap-4 mb-8">
                        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-blue-600 font-medium">Tổng đơn hàng</p>
                                    <p class="text-2xl font-bold text-blue-700">${stats.totalOrders || 0}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-green-600 font-medium">Tổng doanh thu</p>
                                    <p class="text-xl font-bold text-green-700">${formatCurrency(stats.totalRevenue || 0)}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-orange-600 font-medium">Tổng hoa hồng</p>
                                    <p class="text-xl font-bold text-orange-700">${formatCurrency(stats.totalCommission || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Collaborator Info -->
                    <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 mb-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Thông tin chi tiết
                        </h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Họ và tên</p>
                                <p class="text-base font-semibold text-gray-900">${escapeHtml(ctv.name || 'N/A')}</p>
                            </div>
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Số điện thoại</p>
                                <p class="text-base font-semibold text-gray-900">${escapeHtml(ctv.phone || 'N/A')}</p>
                            </div>
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Mã CTV</p>
                                <p class="text-base font-semibold text-blue-600">${escapeHtml(ctv.referral_code)}</p>
                            </div>
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Tỷ lệ hoa hồng</p>
                                <p class="text-base font-semibold text-orange-600">${ctv.commission_rate || 0}%</p>
                            </div>
                            ${ctv.bank_info ? `
                            <div class="bg-white rounded-lg p-4 border border-gray-200 col-span-2">
                                <p class="text-sm text-gray-500 mb-1">Thông tin ngân hàng</p>
                                <p class="text-base font-semibold text-gray-900">${escapeHtml(ctv.bank_info)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Action Button -->
                    <div class="flex justify-center">
                        <a href="ctv-detail.html?code=${encodeURIComponent(referralCode)}" 
                            class="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-3">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Xem chi tiết CTV</span>
                            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);


    } catch (error) {
        console.error('Error loading collaborator info:', error);
        showToast('Không thể tải thông tin CTV', 'error');
    }
}

// Close collaborator modal
function closeCollaboratorModal() {
    const modal = document.getElementById('collaboratorModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Edit product - show modal with all fields
function editProductName(productId, orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Find the product by matching the productId
    const span = document.getElementById(productId);
    if (!span) return;

    const currentName = span.textContent.trim();
    const productIndex = products.findIndex(p => {
        const pName = typeof p === 'string' ? p : p.name;
        return pName === currentName;
    });

    if (productIndex === -1) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const product = products[productIndex];
    const quantity = typeof product === 'object' ? (product.quantity || 1) : 1;

    const productData = typeof product === 'string'
        ? { name: product, quantity: 1, weight: '', size: '', price: '', cost_price: '', notes: '' }
        : {
            name: product.name || '',
            quantity: quantity,
            weight: product.weight || '',
            size: product.size || '',
            // IMPORTANT: Divide by quantity to get UNIT price (in case it's stored as total)
            price: product.price ? (product.price / quantity) : '',
            cost_price: product.cost_price ? (product.cost_price / quantity) : '',
            notes: product.notes || ''
        };

    // Smart detection: if weight contains "cm" or looks like size, swap them
    if (productData.weight && !productData.size) {
        const weightValue = productData.weight.toLowerCase();
        // Check if it looks like a size (contains cm, size, tay, etc.)
        if (weightValue.includes('cm') || weightValue.includes('size') || weightValue.includes('tay')) {
            productData.size = productData.weight;
            productData.weight = '';
        }
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';


    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Chỉnh sửa sản phẩm
                    </h3>
                    <button onclick="closeEditProductModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Product Name -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Tên sản phẩm <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="editProductName" 
                        value="${escapeHtml(productData.name)}"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Nhập tên sản phẩm"
                    />
                </div>

                <!-- Quantity and Size/Tay (2 columns) -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Số lượng <span class="text-red-500">*</span>
                        </label>
                        <input 
                            type="number" 
                            id="editProductQuantity" 
                            value="${productData.quantity}"
                            min="1"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nhập số lượng"
                            oninput="calculateEditModalProfit('quantity')"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Size/Tay
                        </label>
                        <input 
                            type="text" 
                            id="editProductSize" 
                            value="${escapeHtml(productData.size || productData.weight || '')}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="VD: Size M, 5kg..."
                        />
                    </div>
                </div>

                <!-- Price and Cost Price -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Giá bán <span class="text-xs text-gray-500 font-normal">(VD: 50000)</span>
                        </label>
                        <input 
                            type="text" 
                            id="editProductPrice" 
                            value="${escapeHtml(productData.price)}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nhập giá bán"
                            oninput="calculateEditModalProfit('price')"
                        />
                        <div id="editProductPriceUnit" class="text-xs text-blue-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductPriceUnitValue">0đ</span>/sp
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            💰 Giá vốn
                        </label>
                        <input 
                            type="text" 
                            id="editProductCostPrice" 
                            value="${escapeHtml(productData.cost_price || '')}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nhập giá vốn"
                            oninput="calculateEditModalProfit('cost')"
                        />
                        <div id="editProductCostUnit" class="text-xs text-orange-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductCostUnitValue">0đ</span>/sp
                        </div>
                    </div>
                </div>
                <p class="text-xs text-gray-500 -mt-2">💡 Giá nhập là giá 1 sản phẩm. Tổng tiền sẽ tự động tính = giá × số lượng</p>
                
                <!-- Profit Display -->
                <div id="editModalProfitDisplay" class="hidden">
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg px-4 py-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-600 font-medium">💰 Lãi dự kiến:</span>
                            <span id="editModalProfitAmount" class="text-lg font-bold text-green-600">0đ</span>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-500">Tỷ suất:</span>
                            <span id="editModalProfitMargin" class="text-sm font-semibold text-green-600">0%</span>
                        </div>
                    </div>
                </div>
                <div id="editModalLossWarning" class="hidden">
                    <div class="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3">
                        <p class="text-sm text-red-600 font-medium">⚠️ Giá vốn cao hơn giá bán - Sản phẩm này sẽ bị lỗ!</p>
                    </div>
                </div>

                <!-- Notes -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Ghi chú
                    </label>
                    <textarea 
                        id="editProductNotes" 
                        rows="2"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="Ghi chú thêm về sản phẩm..."
                    >${escapeHtml(productData.notes)}</textarea>
                </div>
            </div>

            <!-- Notice -->
            <div class="px-6 py-3 bg-blue-50 border-t border-blue-100">
                <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-sm text-blue-700"><span class="font-semibold">Lưu ý:</span> Thay đổi chỉ áp dụng cho sản phẩm trong đơn hàng này</p>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditProductModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveProductChanges(${orderId}, ${productIndex}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Reset unit prices
    editModalUnitPrice = parseFloat(String(productData.price).replace(/[^\d]/g, '')) || 0;
    editModalUnitCost = parseFloat(String(productData.cost_price).replace(/[^\d]/g, '')) || 0;

    // Focus first input immediately
    document.getElementById('editProductName')?.focus();

    // Calculate profit immediately to show totals if quantity > 1
    setTimeout(() => calculateEditModalProfit(), 50);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditProductModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Close edit product modal
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.remove();
    }
}

// Save product name
async function saveProductName(productId, orderId, orderCode, newName, oldName) {
    const span = document.getElementById(productId);
    if (!span) return;

    newName = newName.trim();

    // If no change, just restore
    if (newName === oldName || newName === '') {
        span.innerHTML = escapeHtml(oldName);
        return;
    }

    // Show loading
    span.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-gray-600">Đang lưu...</span>
        </div>
    `;

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            // If not JSON, parse as text
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Find and update the product
        let updated = false;
        for (let i = 0; i < products.length; i++) {
            const productName = typeof products[i] === 'string' ? products[i] : products[i].name;
            if (productName === oldName) {
                if (typeof products[i] === 'string') {
                    products[i] = newName;
                } else {
                    products[i].name = newName;
                }
                updated = true;
                break;
            }
        }

        if (!updated) {
            throw new Error('Không tìm thấy sản phẩm để cập nhật');
        }

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(orderId, updates);

            // Re-render table to show updated total_amount
            renderOrdersTable();

            // Update display
            span.innerHTML = escapeHtml(newName);
            showToast(`Đã cập nhật tên sản phẩm cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving product name:', error);
        span.innerHTML = escapeHtml(oldName);
        showToast('Không thể cập nhật tên sản phẩm: ' + error.message, 'error');
    }
}

// Store unit prices globally
let editModalUnitPrice = 0;
let editModalUnitCost = 0;
let editModalIsUpdating = false;

// Calculate profit in edit modal (for order product editing)
function calculateEditModalProfit(sourceField = null) {
    if (editModalIsUpdating) return;

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQuantity');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;

    // Parse current input values
    const currentPriceValue = parseFloat(priceInput.value?.replace(/[^\d]/g, '')) || 0;
    const currentCostValue = parseFloat(costPriceInput.value?.replace(/[^\d]/g, '')) || 0;

    // Update unit prices based on what user is editing
    if (sourceField === 'price' || (editModalUnitPrice === 0 && currentPriceValue > 0)) {
        editModalUnitPrice = currentPriceValue / quantity;
    }
    if (sourceField === 'cost' || (editModalUnitCost === 0 && currentCostValue > 0)) {
        editModalUnitCost = currentCostValue / quantity;
    }

    // Only auto-calculate total when quantity changes, not when price/cost changes
    if (sourceField === 'quantity') {
        const totalRevenue = editModalUnitPrice * quantity;
        const totalCost = editModalUnitCost * quantity;

        editModalIsUpdating = true;
        if (editModalUnitPrice > 0) {
            priceInput.value = totalRevenue;
        }
        if (editModalUnitCost > 0) {
            costPriceInput.value = totalCost;
        }
        editModalIsUpdating = false;
    }

    // Update unit price labels (show only when quantity > 1)
    const priceUnitDiv = document.getElementById('editProductPriceUnit');
    const costUnitDiv = document.getElementById('editProductCostUnit');

    if (quantity > 1) {
        if (editModalUnitPrice > 0) {
            document.getElementById('editProductPriceUnitValue').textContent = formatCurrency(editModalUnitPrice);
            priceUnitDiv?.classList.remove('hidden');
        } else {
            priceUnitDiv?.classList.add('hidden');
        }

        if (editModalUnitCost > 0) {
            document.getElementById('editProductCostUnitValue').textContent = formatCurrency(editModalUnitCost);
            costUnitDiv?.classList.remove('hidden');
        } else {
            costUnitDiv?.classList.add('hidden');
        }
    } else {
        priceUnitDiv?.classList.add('hidden');
        costUnitDiv?.classList.add('hidden');
    }

    // Calculate profit
    const profitDisplay = document.getElementById('editModalProfitDisplay');
    const lossWarning = document.getElementById('editModalLossWarning');

    if (price > 0 && costPrice > 0) {
        // Calculate per-unit profit
        const profitPerUnit = price - costPrice;
        const margin = (profitPerUnit / price) * 100;

        // Calculate total profit (profit per unit × quantity)
        const totalProfit = profitPerUnit * quantity;

        if (profitPerUnit > 0) {
            // Show profit with breakdown
            const profitAmountEl = document.getElementById('editModalProfitAmount');
            const profitMarginEl = document.getElementById('editModalProfitMargin');

            if (quantity > 1) {
                profitAmountEl.innerHTML = `
                    <div class="text-right">
                        <div class="text-lg font-bold text-green-600">${formatCurrency(totalProfit)}</div>
                        <div class="text-xs text-gray-500">(${formatCurrency(profitPerUnit)}/sp × ${quantity})</div>
                    </div>
                `;
            } else {
                profitAmountEl.textContent = formatCurrency(totalProfit);
            }

            profitMarginEl.textContent = `${margin.toFixed(1)}%`;
            profitDisplay.classList.remove('hidden');
            lossWarning.classList.add('hidden');

            // Update display to show total revenue and cost in profit box
            const existingBreakdown = document.getElementById('editModalBreakdown');
            if (!existingBreakdown) {
                const breakdownDiv = document.createElement('div');
                breakdownDiv.id = 'editModalBreakdown';
                breakdownDiv.className = 'text-xs text-gray-600 mt-2 pt-2 border-t border-green-200 space-y-1';
                breakdownDiv.innerHTML = `
                    <div class="flex justify-between">
                        <span>📊 Tổng giá bán:</span>
                        <span class="font-semibold text-gray-800" id="editModalTotalRevenue">${formatCurrency(totalRevenue)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>📊 Tổng giá vốn:</span>
                        <span class="font-semibold text-gray-800" id="editModalTotalCost">${formatCurrency(totalCost)}</span>
                    </div>
                `;
                profitDisplay.querySelector('div').appendChild(breakdownDiv);
            } else {
                document.getElementById('editModalTotalRevenue').textContent = formatCurrency(totalRevenue);
                document.getElementById('editModalTotalCost').textContent = formatCurrency(totalCost);
            }
        } else {
            // Show loss warning
            profitDisplay.classList.add('hidden');
            lossWarning.classList.remove('hidden');
        }
    } else {
        profitDisplay.classList.add('hidden');
        lossWarning.classList.add('hidden');
    }
}

// Save product changes
async function saveProductChanges(orderId, productIndex, orderCode) {
    // Get values from form
    const name = document.getElementById('editProductName')?.value.trim();
    const quantity = parseInt(document.getElementById('editProductQuantity')?.value) || 1;
    const weightInput = document.getElementById('editProductWeight');
    const sizeInput = document.getElementById('editProductSize');
    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const notesInput = document.getElementById('editProductNotes');

    const weight = weightInput ? weightInput.value.trim() : '';
    const size = sizeInput ? sizeInput.value.trim() : '';
    const price = priceInput ? priceInput.value.trim() : '';
    const costPrice = costPriceInput ? costPriceInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    // Validate
    if (!name) {
        showToast('Tên sản phẩm không được để trống', 'error');
        return;
    }

    if (quantity < 1) {
        showToast('Số lượng phải lớn hơn 0', 'error');
        return;
    }

    // Close modal and show loading toast với ID
    closeEditProductModal();
    const saveId = `save-product-${orderId}-${productIndex}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Update the product with all fields
        const updatedProduct = {
            name: name,
            quantity: quantity
        };

        // Add optional fields if provided
        if (weight) updatedProduct.weight = weight;
        if (size) updatedProduct.size = size;

        // IMPORTANT: Always use UNIT prices (not total)
        // editModalUnitPrice and editModalUnitCost are calculated from input / quantity
        if (editModalUnitPrice > 0) {
            updatedProduct.price = editModalUnitPrice;
        }
        if (editModalUnitCost > 0) {
            updatedProduct.cost_price = editModalUnitCost;
        }

        if (notes) updatedProduct.notes = notes;

        products[productIndex] = updatedProduct;

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        // Backend will calculate total_amount (trigger auto-calculates from order_items + shipping_fee)
        // Backend will also calculate commission based on CTV's commission_rate
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(orderId, updates);

            // Re-render the table to show updated values
            renderOrdersTable();

            // Build success message
            let message = `Đã cập nhật sản phẩm cho đơn ${orderCode}`;
            if (data.total_amount !== undefined) {
                message = `Đã cập nhật sản phẩm - Tổng tiền: ${formatCurrency(data.total_amount)}`;
                if (data.commission !== undefined && data.commission > 0) {
                    message += ` - Hoa hồng: ${formatCurrency(data.commission)}`;
                }
            }
            showToast(message, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Không thể cập nhật sản phẩm: ' + error.message, 'error', null, saveId);
    }
}

// Edit customer info
function editCustomerInfo(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const customerName = order.customer_name || '';
    const customerPhone = order.customer_phone || '';

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editCustomerModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Chỉnh sửa thông tin khách hàng
                    </h3>
                    <button onclick="closeEditCustomerModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Customer Name -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Tên khách hàng <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            id="editCustomerName" 
                            value="${escapeHtml(customerName)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập tên khách hàng"
                        />
                    </div>
                </div>

                <!-- Customer Phone -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Số điện thoại <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <input 
                            type="tel" 
                            id="editCustomerPhone" 
                            value="${escapeHtml(customerPhone)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập số điện thoại"
                        />
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Định dạng: 10 số, bắt đầu bằng 0
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditCustomerModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveCustomerInfo(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first input immediately
    document.getElementById('editCustomerName')?.focus();

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditCustomerModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Close edit customer modal
function closeEditCustomerModal() {
    const modal = document.getElementById('editCustomerModal');
    if (modal) {
        modal.remove();
    }
}

// Save customer info
async function saveCustomerInfo(orderId, orderCode) {
    // Get values from form
    const name = document.getElementById('editCustomerName')?.value.trim();
    const phone = document.getElementById('editCustomerPhone')?.value.trim();

    // Validate
    if (!name) {
        showToast('Tên khách hàng không được để trống', 'error');
        return;
    }

    if (!phone) {
        showToast('Số điện thoại không được để trống', 'error');
        return;
    }

    // Validate phone format (Vietnamese phone number)
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        showToast('Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 0', 'error');
        return;
    }

    // Close modal and show loading toast với ID
    closeEditCustomerModal();
    const saveId = `save-customer-${orderId}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateCustomerInfo',
                orderId: orderId,
                customerName: name,
                customerPhone: phone
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].customer_name = name;
            allOrdersData[orderIndex].customer_phone = phone;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].customer_name = name;
                filteredOrdersData[filteredIndex].customer_phone = phone;
            }

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật thông tin khách hàng cho đơn ${orderCode}`, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving customer info:', error);
        showToast('Không thể cập nhật thông tin khách hàng: ' + error.message, 'error', null, saveId);
    }
}

// Edit address
function editAddress(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const address = order.address || '';

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editAddressModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <!-- Header -->
            <div class="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Chỉnh sửa địa chỉ giao hàng
                    </h3>
                    <button onclick="closeEditAddressModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Địa chỉ giao hàng <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute top-3 left-3 pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <textarea 
                            id="editAddressInput" 
                            rows="4"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                            placeholder="Nhập địa chỉ đầy đủ: Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                        >${escapeHtml(address)}</textarea>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Nhập địa chỉ chi tiết để giao hàng chính xác
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditAddressModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveAddress(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus textarea immediately
    const textarea = document.getElementById('editAddressInput');
    if (textarea) {
        textarea.focus();
        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditAddressModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Close edit address modal
function closeEditAddressModal() {
    const modal = document.getElementById('editAddressModal');
    if (modal) {
        modal.remove();
    }
}

// Save address
async function saveAddress(orderId, orderCode) {
    // Get value from form
    const address = document.getElementById('editAddressInput')?.value.trim();

    // Validate
    if (!address) {
        showToast('Địa chỉ không được để trống', 'error');
        return;
    }

    if (address.length < 10) {
        showToast('Địa chỉ quá ngắn. Vui lòng nhập địa chỉ đầy đủ', 'error');
        return;
    }

    // Close modal and show loading toast với ID
    closeEditAddressModal();
    const saveId = `save-address-${orderId}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateAddress',
                orderId: orderId,
                address: address
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].address = address;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].address = address;
            }

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật địa chỉ cho đơn ${orderCode}`, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving address:', error);
        showToast('Không thể cập nhật địa chỉ: ' + error.message, 'error', null, saveId);
    }
}

// Edit amount
function editAmount(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const currentAmount = order.total_amount || 0;
    const referralCode = order.referral_code;
    const currentCommission = order.commission || 0;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editAmountModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Chỉnh sửa giá trị đơn hàng
                    </h3>
                    <button onclick="closeEditAmountModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Current Amount Display -->
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <p class="text-xs text-green-600 font-medium mb-1">Giá trị hiện tại</p>
                    <p class="text-2xl font-bold text-green-700">${formatCurrency(currentAmount)}</p>
                    ${referralCode ? `
                        <div class="mt-2 pt-2 border-t border-green-200">
                            <p class="text-xs text-orange-600 font-medium">Hoa hồng CTV: <span class="font-bold">${formatCurrency(currentCommission)}</span></p>
                        </div>
                    ` : ''}
                </div>

                <!-- New Amount Input -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Giá trị mới <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <input 
                            type="number" 
                            id="editAmountInput" 
                            value="${currentAmount}"
                            min="0"
                            step="1000"
                            class="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Nhập giá trị đơn hàng"
                            oninput="updateAmountPreview(${referralCode ? 'true' : 'false'})"
                        />
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span class="text-gray-500 text-sm font-medium">đ</span>
                        </div>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Nhập số tiền không bao gồm dấu phẩy
                    </p>
                </div>

                <!-- Preview -->
                <div id="amountPreview" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Giá trị mới:</span>
                        <span class="text-lg font-bold text-green-600">${formatCurrency(currentAmount)}</span>
                    </div>
                    ${referralCode ? `
                        <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                            <span class="text-sm text-gray-600">Hoa hồng CTV mới:</span>
                            <span class="text-lg font-bold text-orange-600" id="commissionPreview">${formatCurrency(currentCommission)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditAmountModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveAmount(${orderId}, '${escapeHtml(orderCode)}', ${referralCode ? `'${escapeHtml(referralCode)}'` : 'null'})" 
                    class="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus input immediately
    const input = document.getElementById('editAmountInput');
    if (input) {
        input.focus();
        input.select();
    }

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditAmountModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Update amount preview
function updateAmountPreview(hasReferral) {
    const input = document.getElementById('editAmountInput');
    const preview = document.getElementById('amountPreview');

    if (!input || !preview) return;

    const newAmount = parseFloat(input.value) || 0;

    // Update amount display
    const amountDisplay = preview.querySelector('.text-green-600');
    if (amountDisplay) {
        amountDisplay.textContent = formatCurrency(newAmount);
    }

    // Update commission if has referral
    if (hasReferral) {
        const commissionPreview = document.getElementById('commissionPreview');
        if (commissionPreview) {
            // Calculate commission (10% default)
            const newCommission = newAmount * 0.1;
            commissionPreview.textContent = formatCurrency(newCommission);
        }
    }
}

// Close edit amount modal
function closeEditAmountModal() {
    const modal = document.getElementById('editAmountModal');
    if (modal) {
        modal.remove();
    }
}

// Save amount
async function saveAmount(orderId, orderCode, referralCode) {
    // Get value from form
    const amountInput = document.getElementById('editAmountInput');
    const newAmount = parseFloat(amountInput?.value) || 0;

    // Validate
    if (newAmount <= 0) {
        showToast('Giá trị đơn hàng phải lớn hơn 0', 'error');
        return;
    }

    if (newAmount > 1000000000) {
        showToast('Giá trị đơn hàng quá lớn', 'error');
        return;
    }

    // Calculate new commission if has referral
    let newCommission = 0;
    if (referralCode) {
        newCommission = newAmount * 0.1; // 10% commission
    }

    // Close modal and show loading toast với ID
    closeEditAmountModal();
    const saveId = `save-amount-${orderId}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateAmount',
                orderId: orderId,
                totalAmount: newAmount,
                commission: newCommission
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].total_amount = newAmount;
            allOrdersData[orderIndex].commission = newCommission;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].total_amount = newAmount;
                filteredOrdersData[filteredIndex].commission = newCommission;
            }

            // Update stats
            updateStats();

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật giá trị cho đơn ${orderCode}`, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving amount:', error);
        showToast('Không thể cập nhật giá trị đơn hàng: ' + error.message, 'error', null, saveId);
    }
}

// Confirm delete order
function confirmDeleteOrder(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Create simple confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">Xác nhận xóa đơn hàng</h3>
                        <p class="text-sm text-white/80">Hành động này không thể hoàn tác</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p class="text-sm text-gray-700 mb-2">Bạn có chắc chắn muốn xóa đơn hàng:</p>
                    <p class="text-base font-bold text-red-600">${escapeHtml(orderCode)}</p>
                    ${order.customer_name ? `
                        <p class="text-sm text-gray-600 mt-2">Khách hàng: <span class="font-semibold">${escapeHtml(order.customer_name)}</span></p>
                    ` : ''}
                    ${order.total_amount ? `
                        <p class="text-sm text-gray-600">Giá trị: <span class="font-semibold text-green-600">${formatCurrency(order.total_amount)}</span></p>
                    ` : ''}
                </div>
                <p class="text-sm text-gray-500 flex items-start gap-2">
                    <svg class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Đơn hàng sẽ bị xóa vĩnh viễn khỏi hệ thống và không thể khôi phục.</span>
                </p>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeConfirmDeleteModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="deleteOrder(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Xóa đơn hàng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmDeleteModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Close confirm delete modal
function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) {
        modal.remove();
    }
}

// Delete order
async function deleteOrder(orderId, orderCode) {
    // Close modal
    closeConfirmDeleteModal();

    // Show loading toast với ID
    const deleteId = `delete-order-${orderId}`;
    showToast('Đang xóa đơn hàng...', 'info', 0, deleteId);

    try {
        // Delete via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'deleteOrder',
                orderId: orderId
            })
        });

        const data = await response.json();

        if (data.success) {
            // Remove from local data
            const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                allOrdersData.splice(orderIndex, 1);
            }

            // Remove from filtered data
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData.splice(filteredIndex, 1);
            }

            // Update stats
            updateStats();

            // Re-render the table
            renderOrdersTable();

            showToast(`Đã xóa đơn hàng ${orderCode}`, 'success', null, deleteId);
        } else {
            throw new Error(data.error || 'Không thể xóa đơn hàng');
        }

    } catch (error) {
        console.error('Error deleting order:', error);
        showToast('Không thể xóa đơn hàng: ' + error.message, 'error', null, deleteId);
    }
}

// Confirm delete product
function confirmDeleteProduct(orderId, productIndex, orderCode, productName) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">Xác nhận xóa sản phẩm</h3>
                        <p class="text-sm text-white/80">Đơn hàng: ${escapeHtml(orderCode)}</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p class="text-sm text-gray-700 mb-2">Bạn có chắc chắn muốn xóa sản phẩm:</p>
                    <p class="text-base font-bold text-orange-600">${escapeHtml(productName)}</p>
                </div>
                <p class="text-sm text-gray-500 flex items-start gap-2">
                    <svg class="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Sản phẩm sẽ bị xóa khỏi đơn hàng này.</span>
                </p>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeConfirmDeleteProductModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="deleteProduct(${orderId}, ${productIndex}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Xóa sản phẩm
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmDeleteProductModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Close confirm delete product modal
function closeConfirmDeleteProductModal() {
    const modal = document.getElementById('confirmDeleteProductModal');
    if (modal) {
        modal.remove();
    }
}

// Delete product from order
async function deleteProduct(orderId, productIndex, orderCode) {
    // Close modal
    closeConfirmDeleteProductModal();

    // Show loading toast với ID
    const deleteId = `delete-product-${orderId}-${productIndex}`;
    showToast('Đang xóa sản phẩm...', 'info', 0, deleteId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Check if there's only one product
        if (products.length <= 1) {
            showToast('Không thể xóa sản phẩm cuối cùng. Hãy xóa toàn bộ đơn hàng nếu cần.', 'warning');
            return;
        }

        // Remove the product at index
        products.splice(productIndex, 1);

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(orderId, updates);

            // Re-render the table to show updated products
            renderOrdersTable();

            showToast(`Đã xóa sản phẩm khỏi đơn ${orderCode}`, 'success', null, deleteId);
        } else {
            throw new Error(data.error || 'Không thể xóa sản phẩm');
        }

    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Không thể xóa sản phẩm: ' + error.message, 'error', null, deleteId);
    }
}

// Show product selection modal for existing order
let currentEditingOrderId = null;
let currentEditingOrderCode = null;

function showProductSelectionModalForOrder(orderId, orderCode) {
    currentEditingOrderId = orderId;
    currentEditingOrderCode = orderCode;
    showProductSelectionModal();
}

// Show add/edit order notes modal
function showAddOrderNotesModal(orderId, orderCode) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) return;

    const currentNotes = order.notes || '';

    const modal = document.createElement('div');
    modal.id = 'orderNotesModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <!-- Header -->
            <div class="bg-gradient-to-br from-amber-600 to-orange-600 px-6 py-4 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">Ghi chú đơn hàng</h3>
                            <p class="text-sm text-white/80">${escapeHtml(orderCode)}</p>
                        </div>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-white/80 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
                <textarea id="orderNotesInput" rows="5" placeholder="Nhập ghi chú cho đơn hàng..." 
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none">${escapeHtml(currentNotes)}</textarea>
                <p class="text-xs text-gray-500 mt-2">💡 Ghi chú này sẽ hiển thị trong cột sản phẩm</p>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="saveOrderNotes(${orderId}, '${escapeHtml(orderCode)}')" class="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu ghi chú
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('orderNotesInput')?.focus(), 100);
}

// Save order notes
async function saveOrderNotes(orderId, orderCode) {
    const notesInput = document.getElementById('orderNotesInput');
    const notes = notesInput?.value.trim() || '';

    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderNotes',
                orderId: orderId,
                notes: notes
            })
        });

        const data = await response.json();

        if (data.success) {
            // Close modal first
            const modal = document.getElementById('orderNotesModal');
            if (modal) modal.remove();

            // Update local data
            const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                allOrdersData[orderIndex].notes = notes;
            }

            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].notes = notes;
            }

            // Re-render table and show success message
            renderOrdersTable();
            showToast('Đã lưu ghi chú', 'success');
        } else {
            throw new Error(data.error || 'Không thể lưu ghi chú');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        showToast('Không thể lưu ghi chú: ' + error.message, 'error');
    }
}

// Save selected products to existing order
async function saveProductsToExistingOrder() {
    if (!currentEditingOrderId || selectedProducts.length === 0) {
        showToast('Vui lòng chọn ít nhất một sản phẩm', 'warning');
        return;
    }

    // Validate: Check if all products have weight/size
    const missingWeightProducts = [];
    selectedProducts.forEach(productId => {
        const weightOrSize = productWeights[productId] || ''; // Modal stores both weight and size in this field
        if (!weightOrSize.trim()) {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                missingWeightProducts.push(product.name);
            }
        }
    });

    if (missingWeightProducts.length > 0) {
        showToast(`Vui lòng nhập cân nặng/size cho: ${missingWeightProducts.join(', ')}`, 'warning');
        return;
    }

    const addId = `add-products-${currentEditingOrderId}`;
    showToast('Đang thêm sản phẩm...', 'info', 0, addId);

    try {
        const orderIndex = allOrdersData.findIndex(o => o.id === currentEditingOrderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Add selected products
        selectedProducts.forEach(productId => {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                const quantity = productQuantities[productId] || 1;
                const weightOrSize = productWeights[productId] || ''; // This field stores either weight or size
                const notes = productNotes[productId] || '';

                // Determine if this is size or weight based on category
                const productCategory = allCategoriesList.find(c => c.id === product.category_id);
                const categoryName = productCategory ? productCategory.name : '';
                const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');

                const newProduct = {
                    product_id: product.id, // Add product_id
                    name: product.name,
                    quantity: quantity
                };

                // Always add price and cost_price if available (even if 0)
                if (product.price !== undefined && product.price !== null) {
                    newProduct.price = product.price;
                }
                if (product.cost_price !== undefined && product.cost_price !== null) {
                    newProduct.cost_price = product.cost_price;
                }

                // Add size (for both weight and size) with auto-unit
                if (weightOrSize) {
                    let finalSize = weightOrSize.trim();

                    // Auto-add unit if only number is entered
                    if (/^\d+(\.\d+)?$/.test(finalSize)) {
                        if (isAdultBracelet) {
                            finalSize = finalSize + 'cm'; // Size tay
                        } else {
                            finalSize = finalSize + 'kg'; // Cân nặng
                        }
                    }

                    newProduct.size = finalSize;
                }

                if (notes) newProduct.notes = notes;

                console.log('📦 Adding product to order:', {
                    name: product.name,
                    category: categoryName,
                    isAdultBracelet: isAdultBracelet,
                    price: product.price,
                    cost_price: product.cost_price,
                    quantity: quantity,
                    weightOrSize: weightOrSize,
                    notes: notes,
                    finalProduct: newProduct
                });

                products.push(newProduct);
            }
        });

        const updatedProductsJson = JSON.stringify(products);

        // Update in database
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: currentEditingOrderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(currentEditingOrderId, updates);

            updateStats();
            renderOrdersTable();
            closeProductSelectionModal();
            showToast(`Đã thêm sản phẩm vào đơn ${currentEditingOrderCode}`, 'success', null, addId);

            // Reset
            currentEditingOrderId = null;
            currentEditingOrderCode = null;
        } else {
            throw new Error(data.error || 'Không thể thêm sản phẩm');
        }
    } catch (error) {
        console.error('Error adding products:', error);
        showToast('Không thể thêm sản phẩm: ' + error.message, 'error', null, addId);
    }
}

// Get status badge HTML
function getStatusBadge(status, orderId, orderCode) {
    const statusConfig = {
        'pending': {
            label: 'Chờ xử lý',
            color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`
        },
        'shipped': {
            label: 'Đã gửi hàng',
            color: 'bg-blue-100 text-blue-700 border-blue-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />`
        },
        'in_transit': {
            label: 'Đang vận chuyển',
            color: 'bg-purple-100 text-purple-700 border-purple-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`
        },
        'delivered': {
            label: 'Đã giao hàng',
            color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`
        },
        'failed': {
            label: 'Giao hàng thất bại',
            color: 'bg-red-100 text-red-700 border-red-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />`
        }
    };

    const currentStatus = status || 'pending';
    const config = statusConfig[currentStatus] || statusConfig['pending'];

    return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.color} cursor-pointer hover:shadow-md transition-all group" 
             onclick="showStatusMenu(${orderId}, '${escapeHtml(orderCode)}', '${currentStatus}', event)">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                ${config.icon}
            </svg>
            <span class="text-xs font-semibold whitespace-nowrap">${config.label}</span>
            <svg class="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </span>
    `;
}

// Show status menu
function showStatusMenu(orderId, orderCode, currentStatus, event) {
    event.stopPropagation();

    // Close any existing menu
    const existingMenu = document.getElementById('statusMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'pending', label: 'Chờ xử lý', color: 'yellow' },
        { value: 'shipped', label: 'Đã gửi hàng', color: 'blue' },
        { value: 'in_transit', label: 'Đang vận chuyển', color: 'purple' },
        { value: 'delivered', label: 'Đã giao hàng', color: 'emerald' },
        { value: 'failed', label: 'Giao hàng thất bại', color: 'red' }
    ];

    // Get the badge element position
    const badge = event.currentTarget;
    const rect = badge.getBoundingClientRect();

    // Create menu with fixed positioning (outside table container)
    const menu = document.createElement('div');
    menu.id = 'statusMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]';
    menu.style.zIndex = '9999';

    // Calculate position - check if there's enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 250; // Estimated menu height

    if (spaceBelow < menuHeight && rect.top > menuHeight) {
        // Show above
        menu.style.left = rect.left + 'px';
        menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    } else {
        // Show below
        menu.style.left = rect.left + 'px';
        menu.style.top = (rect.bottom + 4) + 'px';
    }

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="updateOrderStatus(${orderId}, '${s.value}', '${escapeHtml(orderCode)}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${s.value === currentStatus ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-base text-gray-700 flex-1">${s.label}</span>
            ${s.value === currentStatus ? `
                <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    // Append to body (not to badge) to avoid overflow issues
    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!badge.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Update order status
async function updateOrderStatus(orderId, newStatus, orderCode) {
    // Close menu
    const menu = document.getElementById('statusMenu');
    if (menu) menu.remove();

    // Show loading toast với ID
    const updateId = `update-status-${orderId}`;
    showToast('Đang cập nhật trạng thái...', 'info', 0, updateId);

    try {
        // Update via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderStatus',
                orderId: orderId,
                status: newStatus
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                allOrdersData[orderIndex].status = newStatus;
            }

            // Update filtered data
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].status = newStatus;
            }

            // Re-render the table
            renderOrdersTable();

            // Get status label
            const statusLabels = {
                'pending': 'Chờ xử lý',
                'shipped': 'Đã gửi hàng',
                'in_transit': 'Đang vận chuyển',
                'delivered': 'Đã giao hàng',
                'failed': 'Giao hàng thất bại'
            };

            showToast(`Đã cập nhật trạng thái đơn ${orderCode} thành "${statusLabels[newStatus]}"`, 'success', null, updateId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật trạng thái');
        }

    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Không thể cập nhật trạng thái: ' + error.message, 'error', null, updateId);
    }
}

// Quick status update buttons (for bulk actions later)
function quickUpdateStatus(orderId, status) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (order) {
        updateOrderStatus(orderId, status, order.order_id);
    }
}

// ============================================
// ADD ORDER MODAL
// ============================================

let allProductsList = [];
let allCategoriesList = [];
let currentOrderProducts = [];
let currentOrderNotes = ''; // General notes for the entire order
let selectedCategory = null; // For modal category selection
let selectedProducts = []; // Changed to array for multiple selection

// Load products and categories
async function loadProductsAndCategories() {
    // Return immediately if already loaded
    if (allProductsList.length > 0 && allCategoriesList.length > 0) {
        console.log('✅ Products already loaded from cache:', allProductsList.length);
        return Promise.resolve();
    }

    try {
        console.log('📥 Loading products and categories...');
        const [productsRes, categoriesRes] = await Promise.all([
            fetch(`${CONFIG.API_URL}?action=getAllProducts&timestamp=${Date.now()}`),
            fetch(`${CONFIG.API_URL}?action=getAllCategories&timestamp=${Date.now()}`)
        ]);

        const [productsData, categoriesData] = await Promise.all([
            productsRes.json(),
            categoriesRes.json()
        ]);

        if (productsData.success) {
            allProductsList = productsData.products || [];
            console.log('✅ Loaded products:', allProductsList.length);
        }
        if (categoriesData.success) {
            allCategoriesList = categoriesData.categories || [];
            console.log('✅ Loaded categories:', allCategoriesList.length);
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

// Show add order modal
async function showAddOrderModal(duplicateData = null) {
    // PERFORMANCE: Don't block on products load
    // Load in background if needed
    const productsPromise = (allProductsList.length === 0 || allCategoriesList.length === 0)
        ? loadProductsAndCategories()
        : Promise.resolve();

    // Reset state
    currentOrderProducts = duplicateData?.products || [];
    selectedCategory = null;
    selectedProducts = [];

    // Demo data for quick testing
    const customerName = duplicateData?.customer_name || 'Nguyễn Văn A';
    const customerPhone = duplicateData?.customer_phone || '0386190596';
    const address = duplicateData?.address || '123 Đường ABC, Phường XYZ, Quận 1, TP.HCM';
    const referralCode = duplicateData?.referral_code || '';
    const paymentMethod = duplicateData?.payment_method || 'cod';
    const shippingFee = duplicateData?.shipping_fee !== undefined ? duplicateData.shipping_fee : 30000;
    const shippingCost = duplicateData?.shipping_cost !== undefined ? duplicateData.shipping_cost : 25000;

    // PERFORMANCE FIX: Pre-calculate summary to avoid layout shift
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        const qty = parseInt(p.quantity) || 1;
        return sum + (price * qty);
    }, 0);
    const totalRevenue = productTotal + shippingFee;
    const initialSummary = {
        productTotal: productTotal,
        shippingFee: shippingFee,
        totalRevenue: totalRevenue,
        productCount: currentOrderProducts.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0)
    };

    const modal = document.createElement('div');
    modal.id = 'addOrderModal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-5 rounded-t-2xl flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold text-white">${duplicateData ? 'Nhân bản đơn hàng' : 'Thêm đơn hàng mới'}</h2>
                            <p class="text-white/80 text-sm mt-1">Điền thông tin và thêm sản phẩm</p>
                        </div>
                    </div>
                    <button onclick="closeAddOrderModal()" class="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-all">
                        <svg class="w-6 h-6 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6 overflow-y-auto flex-1">
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <!-- Left: Order Info (2 cols) -->
                    <div class="lg:col-span-2 space-y-3">
                        <h3 class="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Thông tin đơn hàng
                        </h3>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên khách hàng <span class="text-red-500">*</span></label>
                            <input type="text" id="newOrderCustomerName" value="${escapeHtml(customerName)}" placeholder="Nhập tên khách hàng" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại <span class="text-red-500">*</span></label>
                            <input type="tel" id="newOrderCustomerPhone" value="${escapeHtml(customerPhone)}" placeholder="0123456789" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        </div>

                        <!-- Địa chỉ giao hàng 4 cấp -->
                        <div class="bg-blue-50 rounded-lg p-3 space-y-2">
                            <label class="block text-sm font-semibold text-gray-800 mb-2">Địa chỉ giao hàng <span class="text-red-500">*</span></label>
                            
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <select id="newOrderProvince" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                        <option value="">-- Chọn Tỉnh/TP --</option>
                                    </select>
                                </div>
                                <div>
                                    <select id="newOrderDistrict" disabled class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100">
                                        <option value="">-- Chọn Quận/Huyện --</option>
                                    </select>
                                </div>
                                <div>
                                    <select id="newOrderWard" disabled class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100">
                                        <option value="">-- Chọn Phường/Xã --</option>
                                    </select>
                                </div>
                                <div>
                                    <input type="text" id="newOrderStreetAddress" placeholder="Số nhà, tên đường" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                            </div>
                            
                            <div class="mt-2 p-2 bg-white rounded border border-blue-200">
                                <p class="text-xs text-gray-500 mb-0.5">Địa chỉ đầy đủ:</p>
                                <p id="newOrderAddressPreview" class="text-sm text-gray-800 font-medium">Vui lòng chọn địa chỉ</p>
                            </div>
                            
                            <input type="hidden" id="newOrderAddress" value="${escapeHtml(address)}" />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã CTV (tùy chọn)</label>
                            <input type="text" id="newOrderReferralCode" data-ctv-input value="${escapeHtml(referralCode)}" placeholder="VD: CTV001" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                            <div id="ctvVerifyStatus"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Thanh toán</label>
                                <div class="relative">
                                    <button type="button" onclick="togglePaymentDropdown(event)" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white text-left flex items-center justify-between hover:border-blue-400 transition-colors">
                                        <span id="selectedPaymentText" class="flex items-center gap-2">
                                            <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                                            <span>${paymentMethod === 'bank' ? 'Chuyển khoản' : paymentMethod === 'momo' ? 'MoMo' : 'COD'}</span>
                                        </span>
                                        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <input type="hidden" id="newOrderPaymentMethod" value="${paymentMethod || 'cod'}" />
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái</label>
                                <div class="relative">
                                    <button type="button" onclick="toggleStatusDropdown(event)" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white text-left flex items-center justify-between hover:border-blue-400 transition-colors">
                                        <span id="selectedStatusText" class="flex items-center gap-2">
                                            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
                                            <span>Chờ xử lý</span>
                                        </span>
                                        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <input type="hidden" id="newOrderStatus" value="pending" />
                                </div>
                            </div>
                        </div>

                        <!-- Shipping Costs -->
                        <div class="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                    </svg>
                                    <h4 class="text-sm font-bold text-gray-800">Phí vận chuyển</h4>
                                </div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="freeShippingCheckbox" class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" onchange="toggleFreeShipping()" />
                                    <span class="text-xs font-semibold text-green-700">Miễn phí ship</span>
                                </label>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1.5">Phí ship khách trả</label>
                                    <div class="relative">
                                        <input type="number" id="newOrderShippingFee" min="0" step="1000" value="${shippingFee}" placeholder="30000" class="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" onchange="updateOrderSummary()" />
                                        <span class="absolute right-3 top-2 text-xs text-gray-500">đ</span>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">Số tiền khách thanh toán</p>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1.5">Chi phí ship thực tế</label>
                                    <div class="relative">
                                        <input type="number" id="newOrderShippingCost" min="0" step="1000" value="${shippingCost}" placeholder="25000" class="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" onchange="updateOrderSummary()" />
                                        <span class="absolute right-3 top-2 text-xs text-gray-500">đ</span>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">Chi phí trả đơn vị vận chuyển</p>
                                </div>
                            </div>
                        </div>

                        <!-- Discount Code Section - Compact -->
                        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-2.5 border border-purple-200">
                            <div class="flex items-center gap-1.5 mb-2">
                                <svg class="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <h4 class="text-sm font-semibold text-gray-800">Mã giảm giá</h4>
                                <span class="text-xs text-gray-500">(tùy chọn)</span>
                            </div>
                            
                            <div class="flex gap-2">
                                <input 
                                    type="text" 
                                    id="newOrderDiscountCode" 
                                    placeholder="Nhập mã (VD: GG5K)" 
                                    class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase font-medium"
                                    oninput="this.value = this.value.toUpperCase()"
                                />
                                <button 
                                    type="button"
                                    onclick="applyDiscountCode()"
                                    class="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Áp dụng
                                </button>
                            </div>

                            <!-- Discount Status Display -->
                            <div id="discountStatus" class="mt-2 hidden">
                                <!-- Success State - Compact Design -->
                                <div id="discountSuccess" class="hidden bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2.5 border border-green-200">
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2 flex-1 min-w-0">
                                            <div class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                                <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-bold text-gray-900 truncate" id="discountTitle"></p>
                                                <p class="text-xs text-gray-600 truncate" id="discountDescription"></p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2 flex-shrink-0">
                                            <span class="text-base font-bold text-green-600 whitespace-nowrap" id="discountAmountDisplay">0đ</span>
                                            <button onclick="removeDiscountCode()" class="w-5 h-5 rounded-full hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors" title="Xóa mã">
                                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Error State - Compact -->
                                <div id="discountError" class="hidden bg-red-50 rounded-lg p-2.5 border border-red-200">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p class="text-xs text-red-700 flex-1" id="discountErrorMessage"></p>
                                    </div>
                                </div>

                                <!-- Loading State - Compact -->
                                <div id="discountLoading" class="hidden bg-white rounded-lg p-2.5 border border-gray-200">
                                    <div class="flex items-center gap-2">
                                        <div class="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                                        <p class="text-xs text-gray-600">Đang kiểm tra...</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Hidden fields to store discount data -->
                            <input type="hidden" id="appliedDiscountId" value="" />
                            <input type="hidden" id="appliedDiscountCode" value="" />
                            <input type="hidden" id="appliedDiscountAmount" value="0" />
                            <input type="hidden" id="appliedDiscountType" value="" />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                Ghi chú đơn hàng
                            </label>
                            <textarea id="newOrderNotes" rows="2" placeholder="VD: Giao giờ hành chính, gọi trước 15 phút..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"></textarea>
                        </div>
                    </div>

                    <!-- Right: Products List (3 cols) -->
                    <div class="lg:col-span-3">
                        <div class="mb-3">
                            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                                <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                Danh sách sản phẩm
                            </h3>
                            <button onclick="showProductSelectionModal()" class="w-full px-4 py-2 bg-white hover:bg-purple-50 border-2 border-dashed border-purple-400 hover:border-purple-500 rounded-2xl font-semibold text-purple-600 transition-all flex items-center justify-center gap-2">
                                <div class="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <span class="text-base">Thêm sản phẩm</span>
                            </button>
                        </div>

                        <!-- Products Container -->
                        <div id="newOrderProductsList" class="space-y-2 mb-3 max-h-96 overflow-y-auto">
                            ${currentOrderProducts.length === 0 ? '<p class="text-gray-400 text-center py-4 text-sm italic">Chưa có sản phẩm nào</p>' : ''}
                        </div>

                        <!-- Order Notes Display -->
                        <div id="orderNotesDisplay" class="hidden bg-amber-50 rounded-lg p-3 border-2 border-amber-200 mb-3">
                            <div class="flex items-start gap-2">
                                <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                <div class="flex-1">
                                    <p class="text-xs font-semibold text-gray-700 mb-1">Lưu ý đơn hàng:</p>
                                    <p id="orderNotesText" class="text-sm text-gray-800"></p>
                                </div>
                                <button onclick="clearOrderNotes()" class="text-gray-400 hover:text-red-600 transition-colors" title="Xóa lưu ý">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Quick Add Products (Hidden by default) -->
                        <div id="freeshipProductsSection" class="hidden bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 mb-3">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <h4 class="text-sm font-bold text-gray-800">Sản phẩm bán kèm (Freeship)</h4>
                                </div>
                                <button onclick="toggleFreeshipProducts()" class="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div id="quickAddProductsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <!-- Skeleton loading -->
                                <div class="skeleton h-16 rounded-lg"></div>
                                <div class="skeleton h-16 rounded-lg"></div>
                                <div class="skeleton h-16 rounded-lg"></div>
                                <div class="skeleton h-16 rounded-lg"></div>
                            </div>
                        </div>

                        <!-- Combined Summary & Profit Preview -->
                        <div id="profitPreview" class="bg-gradient-to-br from-white to-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
                            <!-- Header -->
                            <div class="flex items-center gap-2 mb-4">
                                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <span class="text-base font-bold text-gray-800">Tổng quan đơn hàng</span>
                            </div>

                            <!-- Main Summary - Tổng tiền với breakdown -->
                            <div class="bg-white rounded-lg p-4 mb-4 border border-gray-100 shadow-sm">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-medium text-gray-600">Tổng tiền</span>
                                    <span id="orderTotalAmount" class="text-2xl font-bold text-gray-900">${formatCurrency(initialSummary.totalRevenue)}</span>
                                </div>
                                <div class="space-y-1 pt-2 border-t border-gray-100">
                                    <div class="flex justify-between items-center text-xs text-gray-500">
                                        <span>Sản phẩm + Phí ship</span>
                                        <span>
                                            <span id="orderProductTotal">${formatCurrency(initialSummary.productTotal)}</span>
                                            <span class="mx-1">+</span>
                                            <span id="orderShippingFee">${formatCurrency(initialSummary.shippingFee)}</span>
                                        </span>
                                    </div>
                                    <!-- Discount row - hidden by default -->
                                    <div id="orderDiscountRow" class="hidden flex justify-between items-center text-xs">
                                        <div class="flex items-center gap-1">
                                            <svg class="w-3 h-3 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            <span class="text-purple-600 font-medium">Mã giảm giá</span>
                                        </div>
                                        <span id="orderDiscountAmount" class="text-purple-600 font-semibold">-0đ</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Chi tiết Section -->
                            <div class="space-y-2.5">
                                <div class="flex items-center gap-2 mb-3">
                                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chi tiết</span>
                                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                                </div>

                                <div class="space-y-2">
                                    <!-- Doanh thu với breakdown -->
                                    <div class="flex justify-between items-center text-sm py-1">
                                        <div class="flex items-center gap-1.5">
                                            <span class="text-gray-700 font-medium">Doanh thu</span>
                                            <button onclick="event.stopPropagation(); document.getElementById('profitRevenueDetails').classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');" 
                                                class="text-gray-400 hover:text-blue-600 transition-all duration-200 p-0.5 rounded hover:bg-blue-50" 
                                                title="Xem chi tiết">
                                                <svg class="w-3.5 h-3.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                        <span id="profitRevenue" class="font-semibold text-gray-900">${initialSummary.totalRevenue}</span>
                                    </div>
                                    <div class="pl-6 space-y-1.5 hidden" id="profitRevenueDetails">
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span class="text-gray-400">• Sản phẩm</span>
                                            <span id="profitProductTotal" class="text-gray-500">0đ</span>
                                        </div>
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span class="text-gray-400">• Phí ship khách trả</span>
                                            <span id="profitShippingFee" class="text-gray-500">0đ</span>
                                        </div>
                                        <div id="profitDiscountRowInRevenue" class="hidden flex justify-between items-center text-xs py-0.5">
                                            <div class="flex items-center gap-1">
                                                <svg class="w-3 h-3 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                                <span class="text-purple-600">• Mã giảm giá</span>
                                            </div>
                                            <span id="profitDiscountInRevenue" class="text-purple-600 font-medium">-0đ</span>
                                        </div>
                                    </div>
                                    
                                    <!-- CHI PHÍ Section -->
                                    <div class="flex justify-between items-center text-sm py-1">
                                        <span class="text-gray-500">- Giá vốn</span>
                                        <span id="profitCost" class="text-gray-600">0đ</span>
                                    </div>
                                    <div class="flex justify-between items-center text-sm py-1">
                                        <div class="flex items-center gap-1.5">
                                            <span class="text-gray-500">- Chi phí</span>
                                            <button onclick="event.stopPropagation(); document.getElementById('profitPackagingDetails').classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');" 
                                                class="text-gray-400 hover:text-blue-600 transition-all duration-200 p-0.5 rounded hover:bg-blue-50" 
                                                title="Xem chi tiết">
                                                <svg class="w-3.5 h-3.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                        <span id="profitPackaging" class="text-gray-600">0đ</span>
                                    </div>
                                    <div class="pl-6 space-y-1.5 hidden" id="profitPackagingDetails">
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span class="text-gray-400">• Dây đỏ + Công</span>
                                            <span id="profitPackagingPerProduct" class="text-gray-500">0đ</span>
                                        </div>
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span class="text-gray-400">• Đóng gói</span>
                                            <span id="profitPackagingPerOrder" class="text-gray-500">0đ</span>
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center text-sm py-1">
                                        <span class="text-gray-500">- Phí ship thực tế</span>
                                        <span id="profitShipping" class="text-gray-600">0đ</span>
                                    </div>
                                    <div class="flex justify-between items-center text-sm py-1">
                                        <span id="profitCommissionLabel" class="text-gray-500">- Hoa hồng</span>
                                        <span id="profitCommission" class="text-gray-600">0đ</span>
                                    </div>
                                    <div class="flex justify-between items-center text-sm py-1">
                                        <span id="profitTaxLabel" class="text-gray-500">- Thuế</span>
                                        <span id="profitTax" class="text-gray-600">0đ</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Final Profit -->
                            <div class="mt-4 pt-4 border-t-2 border-gray-200">
                                <div class="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200">
                                    <div class="flex justify-between items-center">
                                        <span class="text-sm font-semibold text-gray-700">Lãi ròng</span>
                                        <div class="text-right">
                                            <div id="profitAmount" class="text-2xl font-bold text-emerald-600">0đ</div>
                                            <div id="profitMargin" class="text-xs text-emerald-600 font-medium">(0%)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Warning -->
                            <div id="profitWarning" class="hidden mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p class="text-xs text-yellow-800 font-medium"></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200 flex-shrink-0">
                <button onclick="closeAddOrderModal()" class="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="submitNewOrder()" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Tạo đơn hàng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Init address selector with duplicate data
    initAddressSelector(duplicateData);

    // Set discount code if duplicating
    if (duplicateData?.discount_code) {
        const discountInput = document.getElementById('newOrderDiscountCode');
        if (discountInput) {
            discountInput.value = duplicateData.discount_code;
            // Auto apply discount after a short delay
            setTimeout(() => {
                applyDiscountCode();
            }, 500);
        }
    }

    // PERFORMANCE: Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
        if (currentOrderProducts.length > 0) {
            renderOrderProducts();
            updateOrderSummary();
        }
    });

    // Setup real-time profit calculation
    const referralCodeInput = document.getElementById('newOrderReferralCode');
    if (referralCodeInput) {
        referralCodeInput.addEventListener('input', () => {
            updateOrderSummary();
        });
    }

    // FIX: Wait for products to load before rendering quick add products
    // This ensures data is always available and prevents flickering
    productsPromise.then(() => {
        console.log('✅ Products loaded, rendering quick add section...');
        renderQuickAddProducts();
    }).catch(error => {
        console.error('❌ Error loading products:', error);
        const container = document.getElementById('quickAddProductsContainer');
        if (container) {
            container.innerHTML = '<p class="text-xs text-red-500 italic text-center py-2">Lỗi tải sản phẩm</p>';
        }
    });

    // Focus first input
    setTimeout(() => document.getElementById('newOrderCustomerName')?.focus(), 100);
}

// Render BEST SELLING products box (TOP 6)
function renderBestSellingProductsBox() {
    // Find the parent container (before quickAddProductsContainer)
    const freeshipSection = document.querySelector('.bg-gradient-to-br.from-amber-50');
    if (!freeshipSection) {
        console.warn('⚠️ Freeship section not found');
        return;
    }

    // Check if best selling box already exists
    if (document.getElementById('bestSellingProductsBox')) {
        console.log('✅ Best selling box already exists');
        return;
    }

    // Get TOP 6 BEST SELLING products
    const bestSellingProducts = allProductsList
        .filter(p => p.is_active !== 0 && (p.purchases || 0) > 0)
        .sort((a, b) => (b.purchases || 0) - (a.purchases || 0))
        .slice(0, 6);

    console.log('🔥 Top 6 best selling products:', bestSellingProducts.length);

    if (bestSellingProducts.length === 0) {
        console.warn('⚠️ No best selling products found');
        return;
    }

    // Create best selling box HTML
    const bestSellingBox = document.createElement('div');
    bestSellingBox.id = 'bestSellingProductsBox';
    bestSellingBox.className = 'bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 mb-3';

    const colorSchemes = [
        { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700' },
        { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
        { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
        { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
        { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
        { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' }
    ];

    bestSellingBox.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" />
            </svg>
            <span class="text-base font-bold text-gray-900">Sản phẩm bán chạy</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
            ${bestSellingProducts.map((product, index) => {
        const qtyId = `best_qty_${product.id}`;
        const sizeId = `best_size_${product.id}`;
        const purchases = product.purchases || 0;

        return `
                    <div class="bg-white border border-orange-200 rounded-lg p-2 hover:border-orange-400 transition-all">
                        <div class="flex items-center gap-2 mb-1.5">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-gray-900 truncate" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</p>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-xs font-bold text-green-600">${formatCurrency(product.price)}</span>
                                    <span class="text-xs text-gray-500">• Lượt bán: <span class="font-semibold text-orange-600">${purchases}</span></span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <input type="text" id="${sizeId}" placeholder="Size" 
                                class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500" />
                            <div class="flex items-center border border-gray-300 rounded overflow-hidden">
                                <button onclick="quickChangeQty('${qtyId}', -1)" class="px-1.5 py-1 bg-gray-50 hover:bg-gray-100">
                                    <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4" />
                                    </svg>
                                </button>
                                <input type="number" id="${qtyId}" value="1" min="1" class="w-8 text-center text-xs font-semibold border-0 focus:ring-0 py-1">
                                <button onclick="quickChangeQty('${qtyId}', 1)" class="px-1.5 py-1 bg-gray-50 hover:bg-gray-100">
                                    <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                            <button onclick="quickAddProductToOrder(${product.id}, '${escapeHtml(product.name).replace(/'/g, "\\'")}', ${product.price}, ${product.cost_price || 0}, '${qtyId}', '${sizeId}')" 
                                class="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold transition-all">
                                Thêm
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    // Insert before freeship section
    freeshipSection.parentNode.insertBefore(bestSellingBox, freeshipSection);

    // Create toggle button (separate element)
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggleFreeshipBtn';
    toggleButton.onclick = toggleFreeshipProducts;
    toggleButton.className = 'w-full mb-3 px-3 py-2 bg-white hover:bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2';
    toggleButton.innerHTML = `
        <svg id="toggleFreeshipIcon" class="w-4 h-4 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        <span id="toggleFreeshipText">Xem sản phẩm bán kèm</span>
    `;

    // Insert toggle button between best selling box and freeship section
    freeshipSection.parentNode.insertBefore(toggleButton, freeshipSection);

    console.log('✅ Best selling products box and toggle button rendered');
}

// Render quick add products from database (category_id = 23 or category_name = 'Freeship')
function renderQuickAddProducts() {
    // First, render best selling products box
    renderBestSellingProductsBox();

    // Then render freeship products
    const container = document.getElementById('quickAddProductsContainer');
    if (!container) {
        console.warn('⚠️ Quick add products container not found');
        return;
    }

    console.log('🔍 Total products loaded:', allProductsList.length);

    // Show loading state if no products yet
    if (allProductsList.length === 0) {
        console.log('⏳ Products not loaded yet, showing loading state...');
        container.innerHTML = `
            <div class="col-span-2 text-center py-4">
                <div class="inline-flex items-center gap-2 text-sm text-gray-500">
                    <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang tải sản phẩm...</span>
                </div>
            </div>
        `;
        return;
    }

    // Filter products with category_id = 23 OR category_name = 'Freeship' (case insensitive)
    const freeshipProducts = allProductsList.filter(p => {
        const matchesId = p.category_id === 23;
        const matchesName = p.category_name && p.category_name.toLowerCase().includes('freeship');
        return (matchesId || matchesName) && p.is_active !== 0;
    });

    console.log('🎯 Freeship products found:', freeshipProducts.length);
    if (freeshipProducts.length > 0) {
        console.log('📦 Products:', freeshipProducts.map(p => ({ name: p.name, category_id: p.category_id, category_name: p.category_name })));
    }

    if (freeshipProducts.length === 0) {
        console.warn('⚠️ No products found with category_id=23 or category_name containing "Freeship"');
        console.log('💡 Available categories:', [...new Set(allProductsList.map(p => `${p.category_id}: ${p.category_name}`))]);
        container.innerHTML = '<p class="text-xs text-gray-500 italic text-center py-2 col-span-2">Chưa có sản phẩm bán kèm</p>';
        return;
    }

    // Color schemes for variety
    const colorSchemes = [
        { bg: 'bg-blue-100', text: 'text-blue-600', btn: 'bg-blue-500 hover:bg-blue-600', ring: 'focus:ring-blue-500' },
        { bg: 'bg-pink-100', text: 'text-pink-600', btn: 'bg-pink-500 hover:bg-pink-600', ring: 'focus:ring-pink-500' },
        { bg: 'bg-purple-100', text: 'text-purple-600', btn: 'bg-purple-500 hover:bg-purple-600', ring: 'focus:ring-purple-500' },
        { bg: 'bg-green-100', text: 'text-green-600', btn: 'bg-green-500 hover:bg-green-600', ring: 'focus:ring-green-500' },
        { bg: 'bg-orange-100', text: 'text-orange-600', btn: 'bg-orange-500 hover:bg-orange-600', ring: 'focus:ring-orange-500' }
    ];

    container.innerHTML = freeshipProducts.map((product, index) => {
        const color = colorSchemes[index % colorSchemes.length];
        const qtyId = `quick_qty_${product.id}`;

        return `
            <div class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                <div class="w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 ${color.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-gray-800">${escapeHtml(product.name)}</p>
                    <p class="text-xs text-green-600 font-bold">${formatCurrency(product.price)}</p>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="quickChangeQty('${qtyId}', -1)" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                        </svg>
                    </button>
                    <input type="number" id="${qtyId}" value="1" min="0" max="99" 
                        class="w-10 h-6 text-center text-xs font-bold border border-gray-300 rounded ${color.ring} focus:border-transparent" />
                    <button onclick="quickChangeQty('${qtyId}', 1)" class="w-6 h-6 rounded ${color.btn} flex items-center justify-center transition-colors">
                        <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <button onclick="quickAddProductWithQty('${escapeHtml(product.name)}', ${product.price}, '${qtyId}')" 
                        class="ml-1 px-2 h-6 ${color.btn} text-white text-xs font-medium rounded transition-colors">
                        Thêm
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle free shipping
function toggleFreeShipping() {
    const checkbox = document.getElementById('freeShippingCheckbox');
    const shippingFeeInput = document.getElementById('newOrderShippingFee');

    if (!checkbox || !shippingFeeInput) return;

    if (checkbox.checked) {
        // Enable free shipping - only set customer fee to 0
        shippingFeeInput.value = '0';
        shippingFeeInput.disabled = true;
        shippingFeeInput.classList.add('bg-gray-100', 'cursor-not-allowed');
    } else {
        // Disable free shipping - restore default value
        shippingFeeInput.value = '30000';
        shippingFeeInput.disabled = false;
        shippingFeeInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
    }

    // Update order summary
    updateOrderSummary();
}

// Close add order modal
function closeAddOrderModal() {
    const modal = document.getElementById('addOrderModal');
    if (modal) {
        modal.remove();
        currentOrderProducts = [];
        currentOrderNotes = '';
    }
}

// Toggle payment dropdown in add order modal
function togglePaymentDropdown(event) {
    event.stopPropagation();

    // Close status dropdown if open
    const statusMenu = document.getElementById('statusDropdownMenu');
    if (statusMenu) statusMenu.remove();

    // Close if already open
    const existingMenu = document.getElementById('paymentDropdownMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    const paymentOptions = [
        { value: 'cod', label: 'COD', color: 'orange' },
        { value: 'bank', label: 'Chuyển khoản', color: 'blue' },
        { value: 'momo', label: 'MoMo', color: 'pink' }
    ];

    const menu = document.createElement('div');
    menu.id = 'paymentDropdownMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]';
    menu.style.zIndex = '9999';
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';

    const currentValue = document.getElementById('newOrderPaymentMethod').value;

    menu.innerHTML = paymentOptions.map(option => `
        <button 
            onclick="selectPaymentMethod('${option.value}', '${option.label}', '${option.color}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${option.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${option.color}-500 flex-shrink-0"></div>
            <span class="text-base text-gray-700 flex-1">${option.label}</span>
        </button>
    `).join('');

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select payment method
function selectPaymentMethod(value, label, color) {
    document.getElementById('newOrderPaymentMethod').value = value;
    document.getElementById('selectedPaymentText').innerHTML = `
        <span class="w-2 h-2 rounded-full bg-${color}-500"></span>
        <span>${label}</span>
    `;
    const menu = document.getElementById('paymentDropdownMenu');
    if (menu) menu.remove();
}

// Toggle status dropdown in add order modal
function toggleStatusDropdown(event) {
    event.stopPropagation();

    // Close payment dropdown if open
    const paymentMenu = document.getElementById('paymentDropdownMenu');
    if (paymentMenu) paymentMenu.remove();

    // Close if already open
    const existingMenu = document.getElementById('statusDropdownMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    const statusOptions = [
        { value: 'pending', label: 'Chờ xử lý', color: 'yellow' },
        { value: 'shipped', label: 'Đã gửi hàng', color: 'blue' },
        { value: 'in_transit', label: 'Đang vận chuyển', color: 'purple' },
        { value: 'delivered', label: 'Đã giao hàng', color: 'emerald' },
        { value: 'failed', label: 'Giao hàng thất bại', color: 'red' }
    ];

    const menu = document.createElement('div');
    menu.id = 'statusDropdownMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]';
    menu.style.zIndex = '9999';
    menu.style.left = rect.left + 'px';

    // Check if there's enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 300;

    if (spaceBelow < menuHeight && rect.top > menuHeight) {
        menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    } else {
        menu.style.top = (rect.bottom + 4) + 'px';
    }

    const currentValue = document.getElementById('newOrderStatus').value;

    menu.innerHTML = statusOptions.map(option => `
        <button 
            onclick="selectOrderStatus('${option.value}', '${option.label}', '${option.color}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${option.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${option.color}-500 flex-shrink-0"></div>
            <span class="text-base text-gray-700 flex-1">${option.label}</span>
        </button>
    `).join('');

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select order status
function selectOrderStatus(value, label, color) {
    document.getElementById('newOrderStatus').value = value;
    document.getElementById('selectedStatusText').innerHTML = `
        <span class="w-2 h-2 rounded-full bg-${color}-500"></span>
        <span>${label}</span>
    `;
    const menu = document.getElementById('statusDropdownMenu');
    if (menu) menu.remove();
}

// Show product selection modal (separate modal)
function showProductSelectionModal() {
    // Close existing modal if any
    const existingModal = document.getElementById('productSelectionModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'productSelectionModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl flex-shrink-0">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        Chọn sản phẩm
                    </h3>
                    <button onclick="closeProductSelectionModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-all">
                        <svg class="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6 overflow-y-auto flex-1">
                <!-- Step 1: Categories -->
                <div class="mb-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Bước 1: Chọn danh mục</p>
                    <div id="modalCategoriesGrid" class="flex flex-wrap gap-2">
                        <!-- Categories will be rendered here -->
                    </div>
                </div>

                <!-- Step 2: Products -->
                <div id="modalStep2Container" class="mb-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Bước 2: Chọn sản phẩm</p>
                    
                    <!-- Search Box and Actions -->
                    <div class="flex gap-2 mb-3">
                        <div class="relative flex-1">
                            <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" id="modalProductSearchInput" placeholder="🔍 Tìm kiếm sản phẩm..." class="w-full pl-10 pr-4 py-2 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <button onclick="toggleSelectAllProducts()" id="selectAllBtn" class="px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors whitespace-nowrap">
                            Chọn tất cả
                        </button>
                    </div>

                    <!-- Products List -->
                    <div id="modalProductsListContainer" class="bg-white rounded-lg border border-purple-200 max-h-64 lg:max-h-80 xl:max-h-96 overflow-y-auto">
                        <div id="modalProductsList" class="grid grid-cols-2 gap-px bg-gray-100">
                            <!-- Products will be rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Step 3: Product Details (only for custom input) -->
                <div id="modalProductDetailsForm" class="hidden pt-4 border-t border-gray-200">
                    <!-- Custom Input Fields (shown when "Tự nhập" selected) -->
                    <div id="modalCustomInputFields" class="hidden">
                        <!-- Compact Card Design -->
                        <div class="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 rounded-xl p-4 border border-purple-200">
                            <!-- Header -->
                            <div class="flex items-center gap-2 mb-3 pb-3 border-b border-purple-200">
                                <div class="w-7 h-7 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
                                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-sm font-bold text-gray-900">Tự nhập sản phẩm</h4>
                                    <p class="text-xs text-gray-600">Sản phẩm không có trong danh sách</p>
                                </div>
                            </div>

                            <!-- Form Fields -->
                            <div class="space-y-3">
                                <!-- Product Name -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                        Tên sản phẩm <span class="text-red-500">*</span>
                                    </label>
                                    <input type="text" id="modalCustomProductNameInput" 
                                        placeholder="Nhập tên sản phẩm..." 
                                        class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                                </div>

                                <!-- Price and Cost Price Grid -->
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Giá bán <span class="text-red-500">*</span>
                                        </label>
                                        <div class="relative">
                                            <input type="number" id="modalCustomProductPriceInput" 
                                                placeholder="50000" 
                                                min="0" 
                                                step="1000" 
                                                oninput="calculateModalCustomProfit()"
                                                class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                                            <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            💰 Giá vốn
                                        </label>
                                        <div class="relative">
                                            <input type="number" id="modalCustomProductCostInput" 
                                                placeholder="25000" 
                                                min="0" 
                                                step="1000" 
                                                oninput="calculateModalCustomProfit()"
                                                class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                                            <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Profit Display -->
                                <div id="modalCustomProfitDisplay" class="hidden">
                                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-600">Lãi dự kiến:</span>
                                            <div class="text-right">
                                                <span id="modalCustomProfitAmount" class="text-sm font-bold text-green-600">0đ</span>
                                                <span class="text-xs text-green-500 ml-2">(<span id="modalCustomProfitMargin">0</span>%)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div id="modalCustomLossWarning" class="hidden">
                                    <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        <p class="text-xs text-red-600 font-medium">⚠️ Giá vốn cao hơn giá bán!</p>
                                    </div>
                                </div>

                                <!-- Quantity and Weight Grid -->
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Số lượng
                                        </label>
                                        <input type="number" id="modalCustomProductQtyInput" 
                                            value="1" 
                                            min="1" 
                                            class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                                    </div>

                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Cân nặng
                                        </label>
                                        <input type="text" id="modalCustomProductWeightInput" 
                                            placeholder="5kg" 
                                            class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                                    </div>
                                </div>

                                <!-- Notes -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                        Lưu ý
                                    </label>
                                    <textarea id="modalCustomProductNotesInput" 
                                        rows="2" 
                                        placeholder="Ghi chú thêm về sản phẩm..." 
                                        class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all resize-none"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Selected Product Display (shown when products selected from list) -->
                    <div id="modalSelectedProductDisplay" class="hidden bg-purple-50 rounded-lg p-3 border border-purple-300 mb-3">
                        <p class="text-xs text-gray-600 mb-1">Sản phẩm đã chọn:</p>
                        <p class="font-semibold text-gray-900" id="modalSelectedProductName"></p>
                        <p class="text-sm text-green-600 font-bold" id="modalSelectedProductPrice"></p>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200 flex-shrink-0">
                <button onclick="closeProductSelectionModal()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="addProductFromModal()" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Thêm vào đơn
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Render categories
    renderModalCategories();

    // Render all products initially
    renderModalProductsList();

    // Setup search
    setupModalProductSearch();

    // Setup keyboard shortcuts
    modal.addEventListener('keydown', function (e) {
        // Ctrl/Cmd + Enter to add products
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            addProductFromModal();
        }
        // Escape to close
        if (e.key === 'Escape') {
            e.preventDefault();
            closeProductSelectionModal();
        }
    });

    // Focus search input
    setTimeout(() => document.getElementById('modalProductSearchInput')?.focus(), 100);
}

// Close product selection modal
function closeProductSelectionModal() {
    const modal = document.getElementById('productSelectionModal');
    if (modal) {
        modal.remove();
        selectedCategory = null;
        selectedProducts = [];
        // Reset product quantities
        Object.keys(productQuantities).forEach(key => delete productQuantities[key]);
        // Reset editing order
        currentEditingOrderId = null;
        currentEditingOrderCode = null;
    }
}







// Remove product from order
function removeProductFromOrder(index) {
    currentOrderProducts.splice(index, 1);
    renderOrderProducts();
    updateOrderSummary();
    showToast('Đã xóa sản phẩm', 'info');
}

// Edit product in order
function editProductInOrder(index) {
    const product = currentOrderProducts[index];
    if (!product) return;

    // Create edit modal
    const modal = document.createElement('div');
    modal.id = 'editProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-white">Chỉnh sửa sản phẩm</h3>
                    </div>
                    <button onclick="closeEditProductModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                        <svg class="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Product Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên sản phẩm <span class="text-red-500">*</span></label>
                    <input type="text" id="editProductName" value="${escapeHtml(product.name)}" 
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                <!-- Quantity and Size -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Số lượng <span class="text-red-500">*</span></label>
                        <input type="number" id="editProductQty" value="${product.quantity || 1}" min="1" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="calculateEditProfit('quantity')" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Size/Tay</label>
                        <input type="text" id="editProductSize" value="${escapeHtml(product.size || '')}" placeholder="VD: Size M, 5kg..." 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                </div>

                <!-- Price and Cost -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">
                            Giá bán <span class="text-xs text-gray-500 font-normal">(VD: 50000)</span>
                        </label>
                        <input type="number" id="editProductPrice" value="${product.price || ''}" placeholder="0" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="calculateEditProfit('price')" />
                        <div id="editProductPriceUnit" class="text-xs text-blue-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductPriceUnitValue">0đ</span>/sp
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">💰 Giá vốn</label>
                        <input type="number" id="editProductCostPrice" value="${product.cost_price || ''}" placeholder="0" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="calculateEditProfit('cost')" />
                        <div id="editProductCostUnit" class="text-xs text-orange-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductCostUnitValue">0đ</span>/sp
                        </div>
                    </div>
                </div>
                <p class="text-xs text-gray-500 -mt-2">💡 Giá nhập là giá 1 sản phẩm. Tổng tiền sẽ tự động tính = giá × số lượng</p>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Ghi chú</label>
                    <textarea id="editProductNotes" rows="2" placeholder="Ghi chú về sản phẩm..." 
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none">${escapeHtml(product.notes || '')}</textarea>
                </div>
            </div>

            <!-- Notice -->
            <div class="px-6 py-3 bg-blue-50 border-t border-blue-100">
                <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-sm text-blue-700"><span class="font-semibold">Lưu ý:</span> Thay đổi chỉ áp dụng cho sản phẩm trong đơn hàng này</p>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button onclick="closeEditProductModal()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="saveEditedProduct(${index})" class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Reset unit prices
    editOrderUnitPrice = parseFloat(product.price) || 0;
    editOrderUnitCost = parseFloat(product.cost_price) || 0;

    // Focus first input
    setTimeout(() => {
        document.getElementById('editProductName')?.focus();
        calculateEditProfit();
    }, 100);
}

// Store unit prices for new order modal
let editOrderUnitPrice = 0;
let editOrderUnitCost = 0;
let editOrderIsUpdating = false;

// Calculate and update unit prices in edit modal (for new order)
function calculateEditProfit(sourceField = null) {
    if (editOrderIsUpdating) return;

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQty');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;

    // Parse current input values
    const currentPriceValue = parseFloat(priceInput.value) || 0;
    const currentCostValue = parseFloat(costPriceInput.value) || 0;

    // Update unit prices based on what user is editing
    if (sourceField === 'price' || (editOrderUnitPrice === 0 && currentPriceValue > 0)) {
        editOrderUnitPrice = currentPriceValue / quantity;
    }
    if (sourceField === 'cost' || (editOrderUnitCost === 0 && currentCostValue > 0)) {
        editOrderUnitCost = currentCostValue / quantity;
    }

    // Only auto-calculate total when quantity changes, not when price/cost changes
    if (sourceField === 'quantity') {
        const totalRevenue = editOrderUnitPrice * quantity;
        const totalCost = editOrderUnitCost * quantity;

        editOrderIsUpdating = true;
        if (editOrderUnitPrice > 0) {
            priceInput.value = totalRevenue;
        }
        if (editOrderUnitCost > 0) {
            costPriceInput.value = totalCost;
        }
        editOrderIsUpdating = false;
    }

    // Update unit price labels (show only when quantity > 1)
    const priceUnitDiv = document.getElementById('editProductPriceUnit');
    const costUnitDiv = document.getElementById('editProductCostUnit');

    if (quantity > 1) {
        if (editOrderUnitPrice > 0) {
            document.getElementById('editProductPriceUnitValue').textContent = formatCurrency(editOrderUnitPrice);
            priceUnitDiv?.classList.remove('hidden');
        } else {
            priceUnitDiv?.classList.add('hidden');
        }

        if (editOrderUnitCost > 0) {
            document.getElementById('editProductCostUnitValue').textContent = formatCurrency(editOrderUnitCost);
            costUnitDiv?.classList.remove('hidden');
        } else {
            costUnitDiv?.classList.add('hidden');
        }
    } else {
        priceUnitDiv?.classList.add('hidden');
        costUnitDiv?.classList.add('hidden');
    }
}

// Save edited product
function saveEditedProduct(index) {
    const name = document.getElementById('editProductName')?.value.trim();
    const quantity = parseInt(document.getElementById('editProductQty')?.value) || 1;
    // Use unit prices (not total from input)
    const price = editOrderUnitPrice;
    const costPrice = editOrderUnitCost;
    const size = document.getElementById('editProductSize')?.value.trim();
    const notes = document.getElementById('editProductNotes')?.value.trim();

    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        return;
    }

    // Update product
    currentOrderProducts[index] = {
        name: name,
        quantity: quantity
    };

    if (price > 0) currentOrderProducts[index].price = price;
    if (costPrice > 0) currentOrderProducts[index].cost_price = costPrice;
    if (size) currentOrderProducts[index].size = size;
    if (notes) currentOrderProducts[index].notes = notes;

    closeEditProductModal();
    renderOrderProducts();
    updateOrderSummary();
    showToast('Đã cập nhật sản phẩm', 'success');
}

// Close edit product modal
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Quick add product (for frequently bought items)
function quickAddProduct(name, price) {
    // Try to find cost_price from products list
    const productFromList = allProductsList.find(p => p.name === name);
    const costPrice = productFromList?.cost_price || 0;

    const product = {
        name: name,
        price: price,
        quantity: 1
    };
    if (costPrice > 0) product.cost_price = costPrice;

    currentOrderProducts.push(product);
    renderOrderProducts();
    updateOrderSummary();
    showToast(`Đã thêm: ${name}`, 'success');
}

// Quick add product with quantity
function quickAddProductWithQty(name, price, inputId) {
    const input = document.getElementById(inputId);
    const quantity = parseInt(input?.value) || 0;

    if (quantity <= 0) {
        showToast('Vui lòng chọn số lượng', 'warning');
        return;
    }

    // Try to find cost_price from products list
    const productFromList = allProductsList.find(p => p.name === name);
    const costPrice = productFromList?.cost_price || 0;

    const product = {
        name: name,
        price: price,
        quantity: quantity
    };
    if (costPrice > 0) product.cost_price = costPrice;

    currentOrderProducts.push(product);
    renderOrderProducts();
    updateOrderSummary();

    // Reset quantity to 1
    if (input) input.value = '1';

    showToast(`Đã thêm ${quantity}x ${name}`, 'success');
}

// Change quantity for quick add products
function quickChangeQty(inputId, change) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;

    // Keep within bounds
    if (newValue < 0) newValue = 0;
    if (newValue > 99) newValue = 99;

    input.value = newValue;
}

// Update order notes display
function updateOrderNotesDisplay() {
    const notesDisplay = document.getElementById('orderNotesDisplay');
    const notesText = document.getElementById('orderNotesText');

    if (notesDisplay && notesText) {
        if (currentOrderNotes && currentOrderNotes.trim()) {
            notesDisplay.classList.remove('hidden');
            notesText.textContent = currentOrderNotes;
        } else {
            notesDisplay.classList.add('hidden');
        }
    }
}

// Clear order notes
function clearOrderNotes() {
    currentOrderNotes = '';
    updateOrderNotesDisplay();
}

// Render order products
function renderOrderProducts() {
    const container = document.getElementById('newOrderProductsList');
    if (!container) return;

    if (currentOrderProducts.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-8 italic">Chưa có sản phẩm nào</p>';
        return;
    }

    container.innerHTML = currentOrderProducts.map((p, i) => `
        <div class="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all">
            <div class="flex items-start gap-3">
                <!-- Number Badge -->
                <div class="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                    ${i + 1}
                </div>
                
                <!-- Product Info -->
                <div class="flex-1 min-w-0">
                    <!-- Product Name -->
                    <div class="font-semibold text-gray-900 mb-1.5">${escapeHtml(p.name)}</div>
                    
                    <!-- Details Row -->
                    <div class="flex items-center gap-3 text-sm">
                        <!-- Quantity & Size -->
                        <div class="flex items-center gap-2">
                            <span class="text-purple-600 font-medium">#</span>
                            <span class="text-gray-700">SL: ${p.quantity || 1}</span>
                            ${p.weight || p.size ? `<span class="text-gray-400">•</span><span class="text-gray-600">${escapeHtml(formatWeightSize(p.weight || p.size))}</span>` : ''}
                        </div>
                        
                        <!-- Price -->
                        ${p.price && !isNaN(parseFloat(p.price)) ? `
                        <div class="flex items-center gap-1">
                            <span class="text-gray-400">•</span>
                            <span class="text-green-600 font-semibold">${formatCurrency(parseFloat(p.price) * (p.quantity || 1))}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Notes -->
                    ${p.notes ? `
                    <div class="mt-1.5 text-xs text-gray-500 italic">
                        💬 ${escapeHtml(p.notes)}
                    </div>
                    ` : ''}
                </div>
                
                <!-- Action Buttons -->
                <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="editProductInOrder(${i})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Sửa">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="removeProductFromOrder(${i})" class="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update order summary
function updateOrderSummary() {
    // Calculate product total (revenue from products only)
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = p.price || 0;
        const qty = p.quantity || 1;
        return sum + (price * qty);
    }, 0);

    // Calculate product cost
    const productCost = currentOrderProducts.reduce((sum, p) => {
        const cost = p.cost_price || 0;
        const qty = p.quantity || 1;
        return sum + (cost * qty);
    }, 0);

    // Get shipping costs from form (if available)
    const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value || 0);
    const shippingCost = parseFloat(document.getElementById('newOrderShippingCost')?.value || 0);

    // Only calculate costs if there are products
    const hasProducts = currentOrderProducts.length > 0;

    // Calculate packaging cost from database config (only if has products)
    const packagingCost = hasProducts ? calculatePackagingCost() : 0;

    // Calculate commission based on CTV's commission_rate if available (only if has products)
    const referralCode = document.getElementById('newOrderReferralCode')?.value.trim();
    let commission = 0;
    if (referralCode && hasProducts) {
        // Get commission_rate from hidden input (set by CTV verification)
        const commissionRateInput = document.getElementById('ctvCommissionRate');
        const commissionRate = commissionRateInput ? parseFloat(commissionRateInput.value) : 0.1;
        commission = Math.round(productTotal * commissionRate);
    }

    // Get discount amount if applied
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value || 0);

    // Calculate total revenue (product total + shipping fee - discount)
    const revenue = productTotal + shippingFee - discountAmount;

    // Calculate tax (1.5% of revenue) - only if has products
    const tax = hasProducts ? Math.round(revenue * COST_CONSTANTS.TAX_RATE) : 0;

    // Calculate profit (revenue - all costs including tax)
    const profit = revenue - productCost - shippingCost - packagingCost - commission - tax;
    const profitMargin = revenue > 0 ? (profit / revenue * 100) : 0;

    // Update summary display (total = products + shipping fee - discount)
    document.getElementById('orderTotalAmount').textContent = formatCurrency(revenue);

    // Update breakdown in main summary
    document.getElementById('orderProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('orderShippingFee').textContent = formatCurrency(shippingFee);

    // Show/hide discount row in main summary
    const orderDiscountRow = document.getElementById('orderDiscountRow');
    if (discountAmount > 0) {
        if (orderDiscountRow) {
            orderDiscountRow.classList.remove('hidden');
            document.getElementById('orderDiscountAmount').textContent = `-${formatCurrency(discountAmount)}`;
        }
    } else {
        if (orderDiscountRow) orderDiscountRow.classList.add('hidden');
    }

    // Update profit preview with all cost details
    updateProfitPreview({
        revenue: revenue,
        productTotal: productTotal,
        productCost,
        packagingCost,
        shippingFee,
        shippingCost,
        commission,
        discountAmount,
        tax,
        profit,
        profitMargin
    });
}

// Update profit preview
function updateProfitPreview(data) {
    // Calculate product total (revenue before discount includes shipping)
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = p.price || 0;
        const qty = p.quantity || 1;
        return sum + (price * qty);
    }, 0);

    // Update values
    document.getElementById('profitRevenue').textContent = formatCurrency(data.revenue);

    // Update revenue breakdown
    document.getElementById('profitProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('profitShippingFee').textContent = formatCurrency(data.shippingFee);

    document.getElementById('profitCost').textContent = formatCurrency(data.productCost);
    document.getElementById('profitPackaging').textContent = formatCurrency(data.packagingCost);

    // Show packaging details breakdown if available
    if (packagingConfig && packagingConfig.length > 0 && currentOrderProducts.length > 0) {
        const totalProducts = currentOrderProducts.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const packagingPrices = {};
        packagingConfig.filter(item => item.is_default === 1).forEach(item => {
            packagingPrices[item.item_name] = item.item_cost || 0;
        });

        const perProductCost = ((packagingPrices.red_string || 0) + (packagingPrices.labor_cost || 0)) * totalProducts;
        const perOrderCost = (packagingPrices.bag_zip || 0) + (packagingPrices.bag_red || 0) +
            (packagingPrices.box_shipping || 0) + (packagingPrices.thank_card || 0) +
            (packagingPrices.paper_print || 0);

        document.getElementById('profitPackagingPerProduct').textContent = formatCurrency(perProductCost);
        document.getElementById('profitPackagingPerOrder').textContent = formatCurrency(perOrderCost);
    }

    document.getElementById('profitShipping').textContent = formatCurrency(data.shippingCost);

    // Update commission with percentage
    document.getElementById('profitCommission').textContent = formatCurrency(data.commission);
    const commissionLabel = document.getElementById('profitCommissionLabel');
    if (commissionLabel && data.commission > 0) {
        const commissionRateInput = document.getElementById('ctvCommissionRate');
        if (commissionRateInput) {
            const rate = (parseFloat(commissionRateInput.value) * 100).toFixed(0);
            commissionLabel.textContent = `- Hoa hồng (${rate}%)`;
        } else {
            commissionLabel.textContent = '- Hoa hồng';
        }
    }

    // Update discount display in revenue breakdown (not in costs)
    const discountRowInRevenue = document.getElementById('profitDiscountRowInRevenue');
    if (data.discountAmount && data.discountAmount > 0) {
        if (discountRowInRevenue) {
            discountRowInRevenue.classList.remove('hidden');
            document.getElementById('profitDiscountInRevenue').textContent = `-${formatCurrency(data.discountAmount)}`;
        }
    } else {
        if (discountRowInRevenue) discountRowInRevenue.classList.add('hidden');
    }

    document.getElementById('profitTax').textContent = formatCurrency(data.tax);

    // Update tax label with current rate
    const taxRatePercent = (COST_CONSTANTS.TAX_RATE * 100).toFixed(1);
    document.getElementById('profitTaxLabel').textContent = `- Thuế (${taxRatePercent}%)`;

    document.getElementById('profitAmount').textContent = formatCurrency(data.profit);
    document.getElementById('profitMargin').textContent = `(${data.profitMargin.toFixed(1)}%)`;

    // Update colors based on profit margin
    const profitAmountEl = document.getElementById('profitAmount');
    const profitMarginEl = document.getElementById('profitMargin');
    const profitPreviewEl = document.getElementById('profitPreview');
    const profitWarningEl = document.getElementById('profitWarning');

    // Reset to base style
    profitPreviewEl.className = 'bg-white rounded-lg p-4 border';
    if (profitWarningEl) profitWarningEl.classList.add('hidden');

    // Only show warnings if there are products in the order
    const hasProducts = currentOrderProducts.length > 0;

    // Update profit amount color based on value
    if (data.profit > 0) {
        if (data.profitMargin > 40) {
            // Excellent profit
            profitAmountEl.className = 'text-xl font-bold text-emerald-600';
            profitMarginEl.className = 'text-xs text-emerald-600';
            profitPreviewEl.classList.add('border-emerald-200');
        } else if (data.profitMargin > 20) {
            // Good profit
            profitAmountEl.className = 'text-xl font-bold text-green-600';
            profitMarginEl.className = 'text-xs text-green-600';
            profitPreviewEl.classList.add('border-green-200');
        } else {
            // Low profit - warning (only if has products)
            profitAmountEl.className = 'text-xl font-bold text-yellow-600';
            profitMarginEl.className = 'text-xs text-yellow-600';
            profitPreviewEl.classList.add('border-yellow-300');
            if (profitWarningEl && hasProducts) {
                profitWarningEl.classList.remove('hidden');
                profitWarningEl.querySelector('p').textContent = '⚠️ Lãi thấp! Cân nhắc tăng giá hoặc giảm chi phí';
            }
        }
    } else {
        // Loss (only show warning if has products)
        profitAmountEl.className = 'text-xl font-bold text-red-600';
        profitMarginEl.className = 'text-xs text-red-600';
        profitPreviewEl.classList.add('border-red-300');
        if (profitWarningEl && hasProducts) {
            profitWarningEl.classList.remove('hidden');
            profitWarningEl.className = 'mt-3 p-2 bg-red-100 border border-red-300 rounded-lg';
            profitWarningEl.querySelector('p').textContent = '❌ Đơn hàng này sẽ LỖ! Vui lòng kiểm tra lại giá';
            profitWarningEl.querySelector('p').className = 'text-xs text-red-800 font-bold';
        }
    }
}

// Submit new order
async function submitNewOrder() {
    // Validate CTV code first
    if (!validateCTVCode()) {
        return; // Block submission if CTV is invalid
    }

    // Validate
    const customerName = document.getElementById('newOrderCustomerName')?.value.trim();
    const customerPhone = document.getElementById('newOrderCustomerPhone')?.value.trim();
    const address = document.getElementById('newOrderAddress')?.value.trim();

    // Get address 4 levels
    const provinceId = document.getElementById('newOrderProvince')?.value;
    const districtId = document.getElementById('newOrderDistrict')?.value;
    const wardId = document.getElementById('newOrderWard')?.value;
    const streetAddress = document.getElementById('newOrderStreetAddress')?.value.trim();

    if (!customerName) {
        showToast('Vui lòng nhập tên khách hàng', 'warning');
        document.getElementById('newOrderCustomerName')?.focus();
        return;
    }

    if (!customerPhone) {
        showToast('Vui lòng nhập số điện thoại', 'warning');
        document.getElementById('newOrderCustomerPhone')?.focus();
        return;
    }

    if (!/^0\d{9}$/.test(customerPhone)) {
        showToast('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)', 'warning');
        document.getElementById('newOrderCustomerPhone')?.focus();
        return;
    }

    if (!provinceId || !districtId || !wardId || !streetAddress) {
        showToast('Vui lòng chọn đầy đủ địa chỉ giao hàng (Tỉnh/Quận/Phường/Địa chỉ nhà)', 'warning');
        return;
    }

    if (currentOrderProducts.length === 0) {
        showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning');
        return;
    }

    console.log('🛒 Current order products:', currentOrderProducts);

    const referralCode = document.getElementById('newOrderReferralCode')?.value.trim();
    const paymentMethod = document.getElementById('newOrderPaymentMethod')?.value;
    const status = document.getElementById('newOrderStatus')?.value;

    // Get order notes from form
    const orderNotes = document.getElementById('newOrderNotes')?.value.trim() || null;

    // Calculate product total
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = p.price || 0;
        const qty = p.quantity || 1;
        return sum + (price * qty);
    }, 0);

    if (productTotal === 0) {
        showToast('Tổng tiền phải lớn hơn 0. Vui lòng nhập giá cho sản phẩm', 'warning');
        return;
    }

    // Get shipping costs
    const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value) || 0;
    const shippingCost = parseFloat(document.getElementById('newOrderShippingCost')?.value) || 0;

    // Get discount amount
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value || 0);

    // Calculate total amount (what customer actually pays)
    // totalAmount = productTotal + shippingFee - discountAmount
    const totalAmount = productTotal + shippingFee - discountAmount;

    console.log('🚢 Shipping values:', {
        shippingFee,
        shippingCost,
        shippingFeeInput: document.getElementById('newOrderShippingFee')?.value,
        shippingCostInput: document.getElementById('newOrderShippingCost')?.value
    });

    // Get address names
    const provinceName = window.addressSelector.getProvinceName(provinceId);
    const districtName = window.addressSelector.getDistrictName(provinceId, districtId);
    const wardName = window.addressSelector.getWardName(provinceId, districtId, wardId);

    // Get discount data if applied
    const discountCode = document.getElementById('appliedDiscountCode')?.value.trim() || null;
    const discountId = document.getElementById('appliedDiscountId')?.value || null;

    // Prepare request data matching server format
    const requestData = {
        action: 'createOrder',
        customer: {
            name: customerName,
            phone: customerPhone,
            address: address
        },
        province_id: provinceId,
        province_name: provinceName,
        district_id: districtId,
        district_name: districtName,
        ward_id: wardId,
        ward_name: wardName,
        street_address: streetAddress,
        products: currentOrderProducts,
        totalAmount: totalAmount,
        shippingFee: shippingFee,
        shippingCost: shippingCost,
        paymentMethod: paymentMethod,
        status: status,
        referralCode: referralCode || null,
        notes: orderNotes,
        discountCode: discountCode,
        discountAmount: discountAmount,
        discountId: discountId
    };

    console.log('📤 Sending createOrder request:', requestData);

    // Close modal immediately
    closeAddOrderModal();

    // Show loading toast with ID (không tự động ẩn)
    showToast('Đang tạo đơn hàng...', 'info', 0, 'create-order');

    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            // Toast thành công sẽ thay thế toast "đang tạo"
            showToast('Đã tạo đơn hàng thành công', 'success', null, 'create-order');
            loadOrdersData(); // Reload orders
        } else {
            throw new Error(data.error || 'Không thể tạo đơn hàng');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        // Toast lỗi sẽ thay thế toast "đang tạo"
        showToast('Không thể tạo đơn hàng: ' + error.message, 'error', null, 'create-order');
    }
}

// Duplicate order
function duplicateOrder(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Show modal with pre-filled data (không sao chép mã CTV và trạng thái)
    showAddOrderModal({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.address,
        // Address 4 levels
        province_id: order.province_id,
        district_id: order.district_id,
        ward_id: order.ward_id,
        street_address: order.street_address,
        referral_code: '', // Không sao chép mã CTV
        payment_method: order.payment_method,
        // status: Không sao chép - luôn để "pending" cho đơn mới
        shipping_fee: order.shipping_fee || 0,
        shipping_cost: order.shipping_cost || 0,
        // Discount info
        discount_code: order.discount_code || '',
        discount_amount: order.discount_amount || 0,
        products: products
    });

    showToast('Đã sao chép thông tin đơn hàng', 'info');
}


// ============================================
// MODAL PRODUCT SELECTION FUNCTIONS
// ============================================

// Render categories in modal
function renderModalCategories() {
    const container = document.getElementById('modalCategoriesGrid');
    if (!container) return;

    const categories = [
        ...allCategoriesList,
        { id: 'custom', name: 'Tự nhập', icon: null, color: '#6b7280' }
    ];

    container.innerHTML = categories.map(cat => {
        const isSelected = selectedCategory === cat.id;
        const isCustom = cat.id === 'custom';
        const categoryColor = cat.color || '#6b7280';

        return `
        <button onclick="selectModalCategory(${isCustom ? "'custom'" : cat.id})" 
            id="modal_cat_${cat.id}"
            class="group inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${isSelected
                ? 'border-purple-500 bg-purple-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-gray-50'
            }">
            
            <!-- Color Dot -->
            <div class="flex-shrink-0 w-2 h-2 rounded-full transition-all ${isSelected ? 'ring-2 ring-purple-400 ring-offset-1' : ''}" 
                style="background-color: ${isSelected ? '#a855f7' : categoryColor}">
            </div>
            
            <!-- Category Name -->
            <span class="text-sm font-medium whitespace-nowrap ${isSelected ? 'text-purple-900' : 'text-gray-700 group-hover:text-purple-700'}">${escapeHtml(cat.name)}</span>
            
            <!-- Selected Check Icon -->
            ${isSelected ? `
                <svg class="w-4 h-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `;
    }).join('');
}

// Select category in modal
function selectModalCategory(categoryId) {
    selectedCategory = categoryId;
    renderModalCategories();

    const step2Container = document.getElementById('modalStep2Container');
    const customFields = document.getElementById('modalCustomInputFields');
    const selectedDisplay = document.getElementById('modalSelectedProductDisplay');
    const detailsForm = document.getElementById('modalProductDetailsForm');
    const qtyContainer = document.getElementById('modalProductQtyContainer');
    const weightContainer = document.getElementById('modalProductWeightContainer');

    if (categoryId === 'custom') {
        // Custom input mode - hide step 2, show details form
        if (step2Container) step2Container.classList.add('hidden');
        if (detailsForm) detailsForm.classList.remove('hidden');

        // Show custom input fields, quantity and weight inputs
        if (customFields) customFields.classList.remove('hidden');
        if (selectedDisplay) selectedDisplay.classList.add('hidden');
        if (qtyContainer) qtyContainer.classList.remove('hidden');
        if (weightContainer) weightContainer.classList.remove('hidden');

        // Clear selected products
        selectedProducts = [];

        // Focus on name input
        setTimeout(() => document.getElementById('modalCustomProductNameInput')?.focus(), 100);
    } else {
        // Category selected - show step 2 and products list, hide details form
        if (step2Container) step2Container.classList.remove('hidden');
        if (detailsForm) detailsForm.classList.add('hidden');

        // Hide quantity and weight inputs (already have them in product list)
        if (qtyContainer) qtyContainer.classList.add('hidden');
        if (weightContainer) weightContainer.classList.add('hidden');

        renderModalProductsList(categoryId);

        // Hide custom input fields
        if (customFields) customFields.classList.add('hidden');
    }
}

// Render products list in modal
function renderModalProductsList(categoryId = null, searchQuery = '') {
    const container = document.getElementById('modalProductsList');
    if (!container) return;

    let products = allProductsList.filter(p => p.is_active !== 0);

    if (categoryId) {
        products = products.filter(p => p.category_id === categoryId);
    }

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.sku && p.sku.toLowerCase().includes(query))
        );
    }

    if (products.length === 0) {
        container.innerHTML = '<div class="col-span-2 p-8 text-center text-gray-500 text-sm italic">Không có sản phẩm nào</div>';
        return;
    }

    // Check if current category is "Vòng người lớn" to show "Size tay" instead of "Cân nặng"
    const currentCategory = allCategoriesList.find(c => c.id === categoryId);
    const categoryName = currentCategory ? currentCategory.name : '';
    const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');
    const weightLabel = isAdultBracelet ? 'Size tay' : 'Cân nặng';
    const weightPlaceholder = isAdultBracelet ? 'Size M' : '5kg';

    // Hiển thị số lượng sản phẩm
    const countText = `<div class="col-span-2 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium border-b border-gray-200">
        Tìm thấy ${products.length} sản phẩm
    </div>`;

    container.innerHTML = countText + products.map(p => {
        const isSelected = selectedProducts.includes(p.id);

        // Highlight search term
        let displayName = escapeHtml(p.name);
        if (searchQuery) {
            const regex = new RegExp(`(${escapeHtml(searchQuery)})`, 'gi');
            displayName = displayName.replace(regex, '<mark class="bg-yellow-200 px-0.5">$1</mark>');
        }

        return `
            <div onclick="selectModalProduct(${p.id})" 
                id="modal_product_${p.id}"
                class="bg-white flex flex-col gap-2 p-3 cursor-pointer hover:bg-purple-50 transition-all border-b border-r border-gray-100 ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500 ring-inset' : ''}">
                <div class="flex items-start gap-2">
                    <div class="flex-shrink-0 mt-0.5">
                        <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'}">
                            ${isSelected ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-900 text-sm leading-tight mb-1">${displayName}</p>
                        <p class="text-sm font-bold text-green-600">${formatCurrency(p.price || 0)}</p>
                        ${p.sku ? `<p class="text-xs text-gray-500 mt-0.5">SKU: ${escapeHtml(p.sku)}</p>` : ''}
                    </div>
                </div>
                ${isSelected ? `
                    <div class="pt-2 border-t border-purple-200">
                        <div class="grid grid-cols-12 gap-2">
                            <!-- Quantity (2 cols) -->
                            <div class="col-span-2">
                                <label class="text-xs text-gray-600 font-medium mb-1 block">SL</label>
                                <div class="flex items-center gap-1">
                                    <button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">-</button>
                                    <input type="number" id="qty_${p.id}" value="${productQuantities[p.id] || 1}" min="1" onclick="event.stopPropagation()" onchange="updateProductQuantity(${p.id}, this.value)" class="w-10 text-center border border-gray-300 rounded py-1 text-sm font-medium" />
                                    <button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">+</button>
                                </div>
                            </div>
                            <!-- Weight or Size (3 cols) -->
                            <div class="col-span-3">
                                <label class="text-xs text-gray-600 font-medium mb-1 block">${weightLabel}</label>
                                <input type="text" id="weight_${p.id}" value="${productWeights[p.id] || ''}" placeholder="${weightPlaceholder}" onclick="event.stopPropagation()" onchange="updateProductWeight(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
                            </div>
                            <!-- Notes (7 cols) -->
                            <div class="col-span-7">
                                <label class="text-xs text-gray-600 font-medium mb-1 block">Lưu ý</label>
                                <input type="text" id="notes_${p.id}" value="${productNotes[p.id] || ''}" placeholder="Ghi chú cho sản phẩm này..." onclick="event.stopPropagation()" onchange="updateProductNotes(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Select product in modal
function selectModalProduct(productId) {
    // Toggle selection
    const index = selectedProducts.indexOf(productId);
    if (index > -1) {
        // Already selected, remove it
        selectedProducts.splice(index, 1);
        // Remove quantity, weight and notes when deselected
        delete productQuantities[productId];
        delete productWeights[productId];
        delete productNotes[productId];
    } else {
        // Not selected, add it
        selectedProducts.push(productId);
        // Initialize quantity to 1
        productQuantities[productId] = 1;
        // Initialize weight and notes to empty
        productWeights[productId] = '';
        productNotes[productId] = '';
    }

    // Update display
    updateSelectedProductsDisplay();

    // Re-render list to update checkboxes (preserve search query if any)
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    renderModalProductsList(selectedCategory, searchQuery);
}

// Update selected products display
function updateSelectedProductsDisplay() {
    const display = document.getElementById('modalSelectedProductDisplay');
    if (!display) return;

    if (selectedProducts.length === 0) {
        display.classList.add('hidden');
        return;
    }

    display.classList.remove('hidden');
    const products = selectedProducts.map(id => allProductsList.find(p => p.id === id)).filter(p => p);

    const namesHtml = products.map(p => {
        const qty = productQuantities[p.id] || 1;
        return `<span class="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs mr-1 mb-1">${escapeHtml(p.name)} ${qty > 1 ? `<strong>x${qty}</strong>` : ''}</span>`;
    }).join('');

    const totalPrice = products.reduce((sum, p) => {
        const qty = productQuantities[p.id] || 1;
        return sum + ((p.price || 0) * qty);
    }, 0);

    document.getElementById('modalSelectedProductName').innerHTML = namesHtml;
    document.getElementById('modalSelectedProductPrice').textContent = `Tổng: ${formatCurrency(totalPrice)} (${selectedProducts.length} sản phẩm)`;
}

// Product quantity, weight, size and notes management
const productQuantities = {};
const productWeights = {};
const productSizes = {};
const productNotes = {};

// Toggle select all products
function toggleSelectAllProducts() {
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';

    let products = allProductsList.filter(p => p.is_active !== 0);

    // Apply category filter
    if (selectedCategory) {
        products = products.filter(p => p.category_id === selectedCategory);
    }

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.sku && p.sku.toLowerCase().includes(query))
        );
    }

    const allSelected = products.every(p => selectedProducts.includes(p.id));

    if (allSelected) {
        // Deselect all
        products.forEach(p => {
            const index = selectedProducts.indexOf(p.id);
            if (index > -1) {
                selectedProducts.splice(index, 1);
                delete productQuantities[p.id];
            }
        });
    } else {
        // Select all
        products.forEach(p => {
            if (!selectedProducts.includes(p.id)) {
                selectedProducts.push(p.id);
                productQuantities[p.id] = 1;
            }
        });
    }

    // Update button text
    const btn = document.getElementById('selectAllBtn');
    if (btn) {
        const allNowSelected = products.every(p => selectedProducts.includes(p.id));
        btn.textContent = allNowSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    }

    updateSelectedProductsDisplay();
    renderModalProductsList(selectedCategory, searchQuery);
}

function adjustProductQuantity(productId, delta) {
    const input = document.getElementById(`qty_${productId}`);
    if (!input) return;

    let currentQty = parseInt(input.value) || 1;
    currentQty = Math.max(1, currentQty + delta);
    input.value = currentQty;
    productQuantities[productId] = currentQty;
}

function updateProductQuantity(productId, value) {
    const qty = Math.max(1, parseInt(value) || 1);
    productQuantities[productId] = qty;
    const input = document.getElementById(`qty_${productId}`);
    if (input) input.value = qty;
    updateSelectedProductsDisplay();
}

function updateProductWeight(productId, value) {
    productWeights[productId] = value.trim();
}

function updateProductNotes(productId, value) {
    productNotes[productId] = value.trim();
}

// Setup product search in modal
function setupModalProductSearch() {
    const searchInput = document.getElementById('modalProductSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const query = this.value.trim();

        if (query.length === 0) {
            renderModalProductsList(selectedCategory, '');
            return;
        }

        // Use the updated renderModalProductsList with search query
        renderModalProductsList(selectedCategory, query);
    });
}

// Calculate profit for custom product in modal
function calculateModalCustomProfit() {
    const price = parseFloat(document.getElementById('modalCustomProductPriceInput')?.value) || 0;
    const costPrice = parseFloat(document.getElementById('modalCustomProductCostInput')?.value) || 0;

    const profitDisplay = document.getElementById('modalCustomProfitDisplay');
    const lossWarning = document.getElementById('modalCustomLossWarning');

    if (price > 0 && costPrice > 0) {
        const profit = price - costPrice;
        const margin = (profit / price) * 100;

        if (profit > 0) {
            // Show profit
            document.getElementById('modalCustomProfitAmount').textContent = formatCurrency(profit);
            document.getElementById('modalCustomProfitMargin').textContent = margin.toFixed(1);
            profitDisplay.classList.remove('hidden');
            lossWarning.classList.add('hidden');
        } else {
            // Show loss warning
            profitDisplay.classList.add('hidden');
            lossWarning.classList.remove('hidden');
        }
    } else {
        profitDisplay.classList.add('hidden');
        lossWarning.classList.add('hidden');
    }
}

// Add product from modal
function addProductFromModal() {
    // Check if adding to existing order or new order
    if (currentEditingOrderId) {
        saveProductsToExistingOrder();
        return;
    }

    // Get common details
    let weight = document.getElementById('modalProductWeightInput')?.value.trim();
    const quantity = parseInt(document.getElementById('modalProductQtyInput')?.value) || 1;

    // Check if current category is "Vòng người lớn" first
    const currentCategory = allCategoriesList.find(c => c.id === selectedCategory);
    const categoryName = currentCategory ? currentCategory.name : '';
    const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');

    // Auto-add "cm" or "kg" to weight if only number is entered
    if (weight && /^\d+(\.\d+)?$/.test(weight)) {
        weight = weight + (isAdultBracelet ? 'cm' : 'kg');
    }

    // Check if there are selected products from list (normal mode)
    if (selectedProducts.length > 0) {
        const weightFieldName = isAdultBracelet ? 'size tay' : 'cân nặng';

        // Validate: All selected products must have weight/size
        const missingWeightProducts = [];
        selectedProducts.forEach(productId => {
            const productWeight = productWeights[productId] || '';
            if (!productWeight.trim()) {
                const product = allProductsList.find(p => p.id === productId);
                if (product) {
                    missingWeightProducts.push(product.name);
                }
            }
        });

        if (missingWeightProducts.length > 0) {
            showToast(`Vui lòng nhập ${weightFieldName} cho: ${missingWeightProducts.join(', ')}`, 'warning');
            return;
        }

        // Normal mode - add selected products from list
        const addedCount = selectedProducts.length; // Save count before closing modal

        selectedProducts.forEach(productId => {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                // Get quantity, weight, cost_price and notes for this specific product
                const productQty = productQuantities[productId] || 1;
                let productWeight = productWeights[productId] || '';
                const productNote = productNotes[productId] || '';

                // Auto-add "cm" or "kg" to weight/size if only number is entered
                if (productWeight && /^\d+(\.\d+)?$/.test(productWeight)) {
                    productWeight = productWeight + (isAdultBracelet ? 'cm' : 'kg');
                }

                // Check if product with same name, weight/size and notes already exists
                const existingProduct = currentOrderProducts.find(p => {
                    const pWeightOrSize = isAdultBracelet ? (p.size || '') : (p.weight || '');
                    return p.name === product.name &&
                        pWeightOrSize === (productWeight || '') &&
                        (p.notes || '') === (productNote || '');
                });

                if (existingProduct) {
                    // Product exists, increase quantity
                    existingProduct.quantity += productQty;
                } else {
                    // New product, add to list
                    const newProduct = {
                        name: product.name,
                        quantity: productQty
                    };
                    if (product.price > 0) newProduct.price = product.price;
                    if (product.cost_price) newProduct.cost_price = product.cost_price;

                    // Save to weight or size based on product type
                    if (productWeight) {
                        if (isAdultBracelet) {
                            newProduct.size = productWeight;
                        } else {
                            newProduct.weight = productWeight;
                        }
                    }

                    if (productNote) newProduct.notes = productNote;

                    currentOrderProducts.push(newProduct);
                }
            }
        });

        renderOrderProducts();
        updateOrderSummary();
        updateOrderNotesDisplay();
        closeProductSelectionModal();
        showToast(`Đã thêm ${addedCount} sản phẩm`, 'success');
        return;
    }

    // Custom input mode (Tự nhập) - only if no products selected
    const customName = document.getElementById('modalCustomProductNameInput')?.value.trim();
    const customPrice = parseFloat(document.getElementById('modalCustomProductPriceInput')?.value) || 0;
    const customCostPrice = parseFloat(document.getElementById('modalCustomProductCostInput')?.value) || 0;
    const customQuantity = parseInt(document.getElementById('modalCustomProductQtyInput')?.value) || 1;
    let customWeight = document.getElementById('modalCustomProductWeightInput')?.value.trim() || '';
    const customNotes = document.getElementById('modalCustomProductNotesInput')?.value.trim() || '';

    // Auto-add "kg" to custom weight if only number is entered (user can manually type "cm" if needed)
    if (customWeight && /^\d+(\.\d+)?$/.test(customWeight)) {
        customWeight = customWeight + 'kg';
    }

    if (!customName) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        document.getElementById('modalCustomProductNameInput')?.focus();
        return;
    }

    if (customPrice <= 0) {
        showToast('Vui lòng nhập giá sản phẩm', 'warning');
        document.getElementById('modalCustomProductPriceInput')?.focus();
        return;
    }

    // Check if custom product with same attributes already exists
    const existingProduct = currentOrderProducts.find(p =>
        p.name === customName &&
        (p.weight || '') === (customWeight || '') &&
        (p.notes || '') === (customNotes || '') &&
        p.price === customPrice
    );

    if (existingProduct) {
        // Product exists, increase quantity
        existingProduct.quantity += customQuantity;
    } else {
        // Add new custom product
        const newProduct = {
            name: customName,
            price: customPrice,
            quantity: customQuantity
        };

        if (customCostPrice > 0) newProduct.cost_price = customCostPrice;

        // Auto-detect if it's size (cm) or weight (kg)
        if (customWeight) {
            if (customWeight.includes('cm') || customWeight.toLowerCase().includes('size')) {
                newProduct.size = customWeight;
            } else {
                newProduct.weight = customWeight;
            }
        }

        if (customNotes) newProduct.notes = customNotes;

        currentOrderProducts.push(newProduct);
    }

    renderOrderProducts();
    updateOrderSummary();
    updateOrderNotesDisplay();
    closeProductSelectionModal();
    showToast('Đã thêm sản phẩm', 'success');
}


// ============================================
// FILTER DROPDOWN FUNCTIONS
// ============================================

// Toggle status filter dropdown
function toggleStatusFilter(event) {
    event.stopPropagation();

    // Close date filter if open
    const dateMenu = document.getElementById('dateFilterMenu');
    if (dateMenu) dateMenu.remove();

    // Close if already open
    const existingMenu = document.getElementById('statusFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'all', label: 'Tất cả trạng thái', color: 'gray' },
        { value: 'pending', label: 'Chờ xử lý', color: 'yellow' },
        { value: 'shipped', label: 'Đã gửi hàng', color: 'blue' },
        { value: 'in_transit', label: 'Đang vận chuyển', color: 'purple' },
        { value: 'delivered', label: 'Đã giao hàng', color: 'emerald' },
        { value: 'failed', label: 'Giao hàng thất bại', color: 'red' }
    ];

    const currentValue = document.getElementById('statusFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'statusFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[200px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="selectStatusFilter('${s.value}', '${s.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${s.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-base text-gray-700 flex-1">${s.label}</span>
            ${s.value === currentValue ? `
                <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    button.style.position = 'relative';
    button.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select status filter
function selectStatusFilter(value, label) {
    document.getElementById('statusFilter').value = value;
    document.getElementById('statusFilterLabel').textContent = label;
    document.getElementById('statusFilterMenu')?.remove();
    filterOrdersData();
}

// Select date filter preset (new button-based design)
function selectDateFilterPreset(value, buttonElement) {
    // Update hidden input
    document.getElementById('dateFilter').value = value;

    // Clear custom date values when selecting preset
    if (value !== 'custom') {
        document.getElementById('customDateStart').value = '';
        document.getElementById('customDateEnd').value = '';
        document.getElementById('customDateLabel').textContent = 'Chọn ngày';
    }

    // Update button states
    document.querySelectorAll('.date-preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    buttonElement.classList.add('active');

    // Apply filter
    filterOrdersData();
}

// Legacy functions kept for compatibility
function toggleDateFilter(event) {
    // No longer used with button preset design
    console.log('toggleDateFilter called but not needed with preset buttons');
}

function selectDateFilter(value, label) {
    // No longer used with button preset design
    console.log('selectDateFilter called but not needed with preset buttons');
}


// ============================================
// CTV Auto-Verify - Simple Version
// ============================================
let ctvCheckTimeout = null;
let ctvVerified = false; // Track verification status

// Listen to CTV input changes
document.addEventListener('input', function (e) {
    if (e.target.id === 'newOrderReferralCode') {
        const code = e.target.value.trim();
        const statusDiv = document.getElementById('ctvVerifyStatus');

        if (!statusDiv) return;

        // Clear previous timeout
        clearTimeout(ctvCheckTimeout);

        // Reset verification status
        ctvVerified = false;

        // Clear if empty (empty is allowed)
        if (!code) {
            statusDiv.innerHTML = '';
            ctvVerified = true; // Empty is valid

            // Remove commission_rate
            const commissionRateInput = document.getElementById('ctvCommissionRate');
            if (commissionRateInput) commissionRateInput.remove();

            // Update order summary to recalculate commission
            updateOrderSummary();
            return;
        }

        // Show loading
        statusDiv.innerHTML = '<div class="text-xs text-gray-500 mt-1">Đang kiểm tra...</div>';

        // Check after 600ms
        ctvCheckTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${CONFIG.API_URL}?action=verifyCTV&code=${encodeURIComponent(code)}`);
                const data = await response.json();

                if (data.success && data.verified) {
                    const rate = (data.data.rate * 100).toFixed(0);
                    statusDiv.innerHTML = `
                        <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                            <div class="text-green-800 font-semibold">✓ ${data.data.name}</div>
                            <div class="text-green-600">Hoa hồng: ${rate}% • ${data.data.phone}</div>
                        </div>
                    `;

                    // Store commission_rate in hidden input for calculation
                    let commissionRateInput = document.getElementById('ctvCommissionRate');
                    if (!commissionRateInput) {
                        commissionRateInput = document.createElement('input');
                        commissionRateInput.type = 'hidden';
                        commissionRateInput.id = 'ctvCommissionRate';
                        statusDiv.appendChild(commissionRateInput);
                    }
                    commissionRateInput.value = data.data.rate;

                    ctvVerified = true; // Valid CTV

                    // Update order summary to recalculate commission
                    updateOrderSummary();
                } else {
                    statusDiv.innerHTML = `
                        <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-semibold">
                            ✗ Không tìm thấy CTV với mã này
                        </div>
                    `;

                    // Remove commission_rate
                    const commissionRateInput = document.getElementById('ctvCommissionRate');
                    if (commissionRateInput) commissionRateInput.remove();

                    ctvVerified = false; // Invalid CTV

                    // Update order summary to recalculate commission
                    updateOrderSummary();
                }
            } catch (error) {
                console.error('Error verifying CTV:', error);
                statusDiv.innerHTML = '<div class="text-xs text-red-500 mt-1">Lỗi kết nối</div>';
                ctvVerified = false;
            }
        }, 600);
    }
});

// Validation function for CTV code
function validateCTVCode() {
    const ctvInput = document.getElementById('newOrderReferralCode');
    if (!ctvInput) return true; // If input doesn't exist, allow

    const code = ctvInput.value.trim();

    // If empty, allow (optional field)
    if (!code) return true;

    // If has value but not verified, block
    if (!ctvVerified) {
        alert('⚠️ Mã CTV không hợp lệ!\n\nVui lòng kiểm tra lại mã CTV hoặc để trống nếu không có.');
        ctvInput.focus();
        return false;
    }

    return true;
}

let productRowCounter = 0;


// ============================================
// ADDRESS SELECTOR INIT
// ============================================

async function initAddressSelector(duplicateData = null) {
    // Init address selector module
    console.log('🔧 Initializing address selector...');
    if (!window.addressSelector.loaded) {
        console.log('  - Loading address data...');
        await window.addressSelector.init();
        console.log('  - Address data loaded:', window.addressSelector.loaded);
    } else {
        console.log('  - Address data already loaded');
    }

    const provinceSelect = document.getElementById('newOrderProvince');
    const districtSelect = document.getElementById('newOrderDistrict');
    const wardSelect = document.getElementById('newOrderWard');
    const streetInput = document.getElementById('newOrderStreetAddress');
    const addressPreview = document.getElementById('newOrderAddressPreview');
    const hiddenAddress = document.getElementById('newOrderAddress');

    // Render provinces
    console.log('  - Rendering provinces...');
    window.addressSelector.renderProvinces(provinceSelect);
    console.log('  - Provinces in data:', window.addressSelector.data.provinces?.length || 0);

    // If duplicating order with address IDs, set them
    if (duplicateData?.province_id) {
        console.log('✅ Setting address from duplicate data:');
        console.log('  - Province ID:', duplicateData.province_id);
        console.log('  - District ID:', duplicateData.district_id);
        console.log('  - Ward ID:', duplicateData.ward_id);
        console.log('  - Street:', duplicateData.street_address);

        // Set province
        provinceSelect.value = duplicateData.province_id;

        // Render and set district
        if (duplicateData.district_id) {
            window.addressSelector.renderDistricts(districtSelect, duplicateData.province_id);
            districtSelect.value = duplicateData.district_id;

            // Render and set ward
            if (duplicateData.ward_id) {
                window.addressSelector.renderWards(wardSelect, duplicateData.province_id, duplicateData.district_id);
                wardSelect.value = duplicateData.ward_id;
            }
        }

        // Set street address
        if (duplicateData.street_address) {
            streetInput.value = duplicateData.street_address;
        }

        console.log('✅ Address set successfully from IDs!');
    }

    // Update preview function
    function updateAddressPreview() {
        const provinceId = provinceSelect.value;
        const districtId = districtSelect.value;
        const wardId = wardSelect.value;
        const street = streetInput.value;

        const fullAddress = window.addressSelector.generateFullAddress(
            street,
            provinceId,
            districtId,
            wardId
        );

        addressPreview.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        hiddenAddress.value = fullAddress;
    }

    // Setup cascade
    window.addressSelector.setupCascade(
        provinceSelect,
        districtSelect,
        wardSelect,
        updateAddressPreview
    );

    // Street address input
    streetInput.addEventListener('input', updateAddressPreview);

    // Update preview after setting address from duplicate
    if (duplicateData?.province_id) {
        updateAddressPreview();
    }
}


// ============================================
// QUICK ADD FUNCTIONS FOR BEST SELLING PRODUCTS
// ============================================

// Change quantity in quick add input
function quickChangeQty(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const currentVal = parseInt(input.value) || 1;
    const newVal = Math.max(1, currentVal + delta);
    input.value = newVal;
}

// Quick add product to order (for best selling products)
function quickAddProductToOrder(productId, productName, price, costPrice, qtyInputId, sizeInputId) {
    const qtyInput = document.getElementById(qtyInputId);
    const sizeInput = document.getElementById(sizeInputId);

    const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
    const size = sizeInput ? sizeInput.value.trim() : null;

    // Validate: Size is required for best selling products
    if (!size) {
        showToast('Vui lòng nhập size trước khi thêm sản phẩm', 'warning');
        if (sizeInput) {
            sizeInput.focus();
            sizeInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            setTimeout(() => {
                sizeInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            }, 2000);
        }
        return;
    }

    // Add product to current order
    const product = {
        id: productId,
        name: productName,
        price: price,
        cost_price: costPrice,
        quantity: quantity,
        size: size || null,
        notes: null
    };

    currentOrderProducts.push(product);

    // Reset quantity to 1 and clear size
    if (qtyInput) {
        qtyInput.value = 1;
    }
    if (sizeInput) {
        sizeInput.value = '';
    }

    // Re-render products list and update summary
    renderOrderProducts();
    updateOrderSummary();

    // Show success toast with size info
    const sizeText = size ? ` (${size})` : '';
    showToast(`Đã thêm ${quantity}x ${productName}${sizeText}`, 'success');
}

// Quick add product with quantity (for freeship products)
function quickAddProductWithQty(productName, price, qtyInputId) {
    const qtyInput = document.getElementById(qtyInputId);
    const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;

    if (quantity === 0) {
        showToast('Số lượng phải lớn hơn 0', 'warning');
        return;
    }

    // Find product in list
    const product = allProductsList.find(p => p.name === productName);
    if (!product) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    // Add to current order
    const orderProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        cost_price: product.cost_price || 0,
        quantity: quantity,
        size: null,
        notes: null
    };

    currentOrderProducts.push(orderProduct);

    // Reset quantity to 1
    if (qtyInput) {
        qtyInput.value = 1;
    }

    // Re-render and update
    renderOrderProducts();
    updateOrderSummary();

    showToast(`Đã thêm ${quantity}x ${productName}`, 'success');
}


// Toggle freeship products section
function toggleFreeshipProducts() {
    const section = document.getElementById('freeshipProductsSection');
    const button = document.getElementById('toggleFreeshipBtn');

    if (!section) return;

    if (section.classList.contains('hidden')) {
        // Show section
        section.classList.remove('hidden');
        if (button) button.classList.add('hidden');
    } else {
        // Hide section
        section.classList.add('hidden');
        if (button) button.classList.remove('hidden');
    }
}


// Toggle freeship products section
function toggleFreeshipProducts() {
    const section = document.getElementById('freeshipProductsSection');
    const icon = document.getElementById('toggleFreeshipIcon');
    const text = document.getElementById('toggleFreeshipText');

    if (!section) return;

    if (section.classList.contains('hidden')) {
        // Show section
        section.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
        if (text) text.textContent = 'Ẩn sản phẩm bán kèm';
    } else {
        // Hide section
        section.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
        if (text) text.textContent = 'Xem sản phẩm bán kèm';
    }
}

// ============================================
// DISCOUNT CODE FUNCTIONS
// ============================================

// Apply discount code
async function applyDiscountCode() {
    const discountCodeInput = document.getElementById('newOrderDiscountCode');
    const discountCode = discountCodeInput?.value.trim().toUpperCase();

    if (!discountCode) {
        showDiscountError('Vui lòng nhập mã giảm giá');
        return;
    }

    // Show loading state
    showDiscountLoading();

    try {
        // Get customer phone for validation
        const customerPhone = document.getElementById('newOrderCustomerPhone')?.value.trim();

        // Calculate current order amount (before discount)
        const productTotal = currentOrderProducts.reduce((sum, p) => {
            const price = p.price || 0;
            const qty = p.quantity || 1;
            return sum + (price * qty);
        }, 0);
        const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value || 0);
        const orderAmount = productTotal + shippingFee;

        // Validate discount code via API
        const response = await fetch(`${CONFIG.API_URL}?action=validateDiscount&code=${encodeURIComponent(discountCode)}&customerPhone=${encodeURIComponent(customerPhone)}&orderAmount=${orderAmount}&timestamp=${Date.now()}`);

        console.log('🔍 Discount validation response:', response.status, response.statusText);

        // Parse JSON response (even for errors)
        const data = await response.json();
        console.log('📦 Discount data:', data);

        // Check if validation failed
        if (!response.ok || !data.success) {
            const errorMessage = data.error || 'Mã giảm giá không hợp lệ';
            console.error('❌ Validation failed:', errorMessage);
            showDiscountError(errorMessage);
            return; // Stop here, don't throw
        }

        if (data.success && data.discount) {
            const discount = data.discount;

            // Calculate discount amount based on type
            let discountAmount = 0;

            if (discount.type === 'fixed') {
                discountAmount = discount.discount_value || 0;
            } else if (discount.type === 'percentage') {
                discountAmount = Math.round(orderAmount * (discount.discount_value / 100));
                // Apply max discount limit if set
                if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
                    discountAmount = discount.max_discount_amount;
                }
            } else if (discount.type === 'freeship') {
                discountAmount = shippingFee; // Free shipping = discount shipping fee
            }

            // Store discount data
            document.getElementById('appliedDiscountId').value = discount.id;
            document.getElementById('appliedDiscountCode').value = discount.code;
            document.getElementById('appliedDiscountAmount').value = discountAmount;
            document.getElementById('appliedDiscountType').value = discount.type;

            // Show success state
            showDiscountSuccess(discount, discountAmount);

            // Update order summary with discount
            updateOrderSummary();

            showToast(`Áp dụng mã ${discount.code} thành công`, 'success');
        }
    } catch (error) {
        console.error('❌ Error applying discount:', error);
        showDiscountError('Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.');
    }
}

// Remove discount code
function removeDiscountCode() {
    // Clear discount data
    document.getElementById('appliedDiscountId').value = '';
    document.getElementById('appliedDiscountCode').value = '';
    document.getElementById('appliedDiscountAmount').value = '0';
    document.getElementById('appliedDiscountType').value = '';
    document.getElementById('newOrderDiscountCode').value = '';

    // Hide discount status
    document.getElementById('discountStatus').classList.add('hidden');
    document.getElementById('discountSuccess').classList.add('hidden');

    // Update order summary
    updateOrderSummary();

    showToast('Đã xóa mã giảm giá', 'info');
}

// Show discount loading state
function showDiscountLoading() {
    const statusDiv = document.getElementById('discountStatus');
    const loadingDiv = document.getElementById('discountLoading');
    const successDiv = document.getElementById('discountSuccess');
    const errorDiv = document.getElementById('discountError');

    statusDiv.classList.remove('hidden');
    loadingDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
}

// Show discount success state
function showDiscountSuccess(discount, discountAmount) {
    const statusDiv = document.getElementById('discountStatus');
    const successDiv = document.getElementById('discountSuccess');
    const loadingDiv = document.getElementById('discountLoading');
    const errorDiv = document.getElementById('discountError');

    // Update success content - Compact version
    document.getElementById('discountTitle').textContent = discount.code;

    let description = '';
    if (discount.type === 'fixed') {
        description = `Giảm ${formatCurrency(discount.discount_value)}`;
    } else if (discount.type === 'percentage') {
        description = `Giảm ${discount.discount_value}%`;
        if (discount.max_discount_amount) {
            description += ` (max ${formatCurrency(discount.max_discount_amount)})`;
        }
    } else if (discount.type === 'freeship') {
        description = 'Freeship';
    } else if (discount.type === 'gift') {
        description = `Tặng quà`;
    }
    document.getElementById('discountDescription').textContent = description;
    document.getElementById('discountAmountDisplay').textContent = `-${formatCurrency(discountAmount)}`;

    // Show success, hide others
    statusDiv.classList.remove('hidden');
    successDiv.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
}

// Show discount error state
function showDiscountError(message) {
    const statusDiv = document.getElementById('discountStatus');
    const errorDiv = document.getElementById('discountError');
    const loadingDiv = document.getElementById('discountLoading');
    const successDiv = document.getElementById('discountSuccess');

    document.getElementById('discountErrorMessage').textContent = message;

    statusDiv.classList.remove('hidden');
    errorDiv.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    // Show toast for better visibility
    showToast(message, 'error');

    // Auto hide error after 10 seconds (longer for user to read)
    setTimeout(() => {
        errorDiv.classList.add('hidden');
        if (successDiv.classList.contains('hidden')) {
            statusDiv.classList.add('hidden');
        }
    }, 10000);
}


// ============================================
// ORDERS CHART FUNCTIONS
// ============================================

// Load orders chart data
async function loadOrdersChart() {
    // Get current period from date filter
    const currentPeriod = document.getElementById('dateFilter')?.value || 'week';

    // Skip if period is 'all'
    if (currentPeriod === 'all') {
        hideOrdersChart();
        return;
    }

    try {
        showOrdersChart();

        // Check cache
        const now = Date.now();
        const cache = ordersChartCache[currentPeriod];

        if (cache.data && (now - cache.timestamp) < CHART_CACHE_TTL) {
            console.log('📦 Using cached orders chart data for', currentPeriod);
            renderOrdersChart(cache.data);
            return;
        }

        // Show loading
        const loadingEl = document.getElementById('ordersChartLoading');
        const containerEl = document.getElementById('ordersChartContainer');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (containerEl) containerEl.classList.add('hidden');

        // Fetch data
        const response = await fetch(`${CONFIG.API_URL}?action=getOrdersChart&period=${currentPeriod}&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            // Cache data
            ordersChartCache[currentPeriod] = {
                data: data,
                timestamp: now
            };

            renderOrdersChart(data);
        } else {
            throw new Error(data.error || 'Failed to load chart data');
        }

    } catch (error) {
        console.error('❌ Error loading orders chart:', error);
        const loadingEl = document.getElementById('ordersChartLoading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-center py-20">
                    <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-gray-500">Không thể tải biểu đồ</p>
                    <button onclick="loadOrdersChart()" class="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium">Thử lại</button>
                </div>
            `;
        }
    }
}

// Render orders chart
function renderOrdersChart(data) {
    // Hide loading, show chart
    const loadingEl = document.getElementById('ordersChartLoading');
    const containerEl = document.getElementById('ordersChartContainer');

    if (loadingEl) loadingEl.classList.add('hidden');
    if (containerEl) containerEl.classList.remove('hidden');

    // Update comparison cards
    updateOrdersComparisonCards(data);

    // Destroy existing chart
    if (ordersChart) {
        ordersChart.destroy();
    }

    // Get canvas context
    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Determine period labels
    let periodLabel = 'Kỳ này';
    let previousLabel = 'Kỳ trước';

    switch (data.period) {
        case 'today':
            periodLabel = 'Hôm nay';
            previousLabel = 'Hôm qua';
            break;
        case 'week':
            periodLabel = 'Tuần này';
            previousLabel = 'Tuần trước';
            break;
        case 'month':
            periodLabel = 'Tháng này';
            previousLabel = 'Tháng trước';
            break;
        case 'year':
            periodLabel = 'Năm nay';
            previousLabel = 'Năm trước';
            break;
    }

    // Create chart
    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: periodLabel,
                    data: data.currentPeriod.total,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(99, 102, 241)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: previousLabel,
                    data: data.previousPeriod.total,
                    borderColor: 'rgb(156, 163, 175)',
                    backgroundColor: 'rgba(156, 163, 175, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgb(156, 163, 175)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    bodySpacing: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y + ' đơn';

                            return label;
                        },
                        footer: function (tooltipItems) {
                            const index = tooltipItems[0].dataIndex;
                            const currentDelivered = data.currentPeriod.delivered[index];
                            const currentCancelled = data.currentPeriod.cancelled[index];
                            const previousDelivered = data.previousPeriod.delivered[index];
                            const previousCancelled = data.previousPeriod.cancelled[index];

                            return [
                                `${periodLabel}: ${currentDelivered} giao, ${currentCancelled} hủy`,
                                `${previousLabel}: ${previousDelivered} giao, ${previousCancelled} hủy`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value + ' đơn';
                        },
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update comparison cards
function updateOrdersComparisonCards(data) {
    // Total change
    const totalEl = document.getElementById('chartTotalChange');
    if (totalEl) {
        const totalChange = data.comparison.totalChange;
        totalEl.textContent = (totalChange >= 0 ? '+' : '') + totalChange.toFixed(1) + '%';
        totalEl.className = 'text-lg font-bold ' + (totalChange >= 0 ? 'text-green-600' : 'text-red-600');
    }

    // Delivery rate
    const deliveryEl = document.getElementById('chartDeliveryRate');
    if (deliveryEl) {
        deliveryEl.textContent = data.currentPeriod.deliveryRate.toFixed(1) + '%';
    }

    // Cancel rate
    const cancelEl = document.getElementById('chartCancelRate');
    if (cancelEl) {
        cancelEl.textContent = data.currentPeriod.cancelRate.toFixed(1) + '%';
    }
}

// Hide chart when period is 'all'
function hideOrdersChart() {
    const chartSection = document.querySelector('.bg-white.rounded-lg.border.border-gray-200.overflow-hidden.mb-6');
    if (chartSection && chartSection.querySelector('#ordersChart')) {
        chartSection.style.display = 'none';
    }
}

// Show chart
function showOrdersChart() {
    const chartSection = document.querySelector('.bg-white.rounded-lg.border.border-gray-200.overflow-hidden.mb-6');
    if (chartSection && chartSection.querySelector('#ordersChart')) {
        chartSection.style.display = 'block';
    }
}

// ============================================
// Custom Date Picker for Orders Filter
// ============================================

let currentDateMode = 'single'; // 'single' or 'range'
let customDatePickerModal = null;

/**
 * Show custom date picker modal
 */
function showCustomDatePicker(event) {
    event.stopPropagation();
    
    // Remove existing modal if any
    if (customDatePickerModal) {
        customDatePickerModal.remove();
    }
    
    // Get current values or default to today
    const today = getTodayDateString();
    const startDate = document.getElementById('customDateStart').value || today;
    const endDate = document.getElementById('customDateEnd').value || today;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'date-picker-modal';
    modal.innerHTML = `
        <div class="date-picker-content">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Chọn thời gian</h3>
                <button onclick="closeCustomDatePicker()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Mode Tabs -->
            <div class="date-mode-tabs">
                <button class="date-mode-tab ${currentDateMode === 'single' ? 'active' : ''}" onclick="switchDateMode('single')">
                    Một ngày
                </button>
                <button class="date-mode-tab ${currentDateMode === 'range' ? 'active' : ''}" onclick="switchDateMode('range')">
                    Khoảng thời gian
                </button>
            </div>
            
            <!-- Single Date Mode -->
            <div id="singleDateMode" class="${currentDateMode === 'single' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Chọn ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="singleDateInput" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Range Date Mode -->
            <div id="rangeDateMode" class="${currentDateMode === 'range' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Từ ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="startDateInput" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="endDateInput" value="${endDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mt-6">
                <button onclick="clearCustomDate()" 
                    class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Xóa bộ lọc
                </button>
                <button onclick="applyCustomDate()" 
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    customDatePickerModal = modal;
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCustomDatePicker();
        }
    });
}

/**
 * Close custom date picker modal
 */
function closeCustomDatePicker() {
    if (customDatePickerModal) {
        customDatePickerModal.style.opacity = '0';
        setTimeout(() => {
            customDatePickerModal.remove();
            customDatePickerModal = null;
        }, 200);
    }
}

/**
 * Switch between single and range date mode
 */
function switchDateMode(mode) {
    currentDateMode = mode;
    
    // Update tabs
    document.querySelectorAll('.date-mode-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide modes
    const singleMode = document.getElementById('singleDateMode');
    const rangeMode = document.getElementById('rangeDateMode');
    
    if (mode === 'single') {
        singleMode.classList.remove('hidden');
        rangeMode.classList.add('hidden');
    } else {
        singleMode.classList.add('hidden');
        rangeMode.classList.remove('hidden');
    }
}

/**
 * Apply custom date filter
 */
function applyCustomDate() {
    let startDate, endDate;
    
    if (currentDateMode === 'single') {
        const singleDate = document.getElementById('singleDateInput').value;
        if (!singleDate) {
            showToast('Vui lòng chọn ngày', 'warning');
            return;
        }
        startDate = singleDate;
        endDate = singleDate;
    } else {
        startDate = document.getElementById('startDateInput').value;
        endDate = document.getElementById('endDateInput').value;
        
        if (!startDate || !endDate) {
            showToast('Vui lòng chọn đầy đủ khoảng thời gian', 'warning');
            return;
        }
        
        // Validate date range
        if (new Date(startDate) > new Date(endDate)) {
            showToast('Ngày bắt đầu phải trước ngày kết thúc', 'warning');
            return;
        }
    }
    
    // Store values
    document.getElementById('customDateStart').value = startDate;
    document.getElementById('customDateEnd').value = endDate;
    document.getElementById('dateFilter').value = 'custom';
    
    // Update button label
    updateCustomDateLabel(startDate, endDate);
    
    // Update button states
    document.querySelectorAll('.date-preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('customDateBtn').classList.add('active');
    
    // Apply filter
    filterOrdersData();
    
    // Close modal
    closeCustomDatePicker();
    
    showToast('Đã áp dụng bộ lọc thời gian', 'success');
}

/**
 * Clear custom date filter
 */
function clearCustomDate() {
    document.getElementById('customDateStart').value = '';
    document.getElementById('customDateEnd').value = '';
    document.getElementById('dateFilter').value = 'all';
    
    // Reset button label
    document.getElementById('customDateLabel').textContent = 'Chọn ngày';
    
    // Update button states
    document.querySelectorAll('.date-preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.date-preset-btn[onclick*="all"]').classList.add('active');
    
    // Apply filter
    filterOrdersData();
    
    // Close modal
    closeCustomDatePicker();
    
    showToast('Đã xóa bộ lọc thời gian', 'info');
}

/**
 * Update custom date button label
 */
function updateCustomDateLabel(startDate, endDate) {
    const label = document.getElementById('customDateLabel');
    
    if (startDate === endDate) {
        // Single date - format as DD/MM/YYYY
        const date = new Date(startDate + 'T00:00:00');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        label.textContent = `${day}/${month}/${year}`;
    } else {
        // Date range - format as DD/MM - DD/MM/YYYY
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        
        const startDay = String(start.getDate()).padStart(2, '0');
        const startMonth = String(start.getMonth() + 1).padStart(2, '0');
        const endDay = String(end.getDate()).padStart(2, '0');
        const endMonth = String(end.getMonth() + 1).padStart(2, '0');
        const endYear = end.getFullYear();
        
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
            // Same month
            label.textContent = `${startDay}-${endDay}/${endMonth}/${endYear}`;
        } else {
            // Different months
            label.textContent = `${startDay}/${startMonth}-${endDay}/${endMonth}/${endYear}`;
        }
    }
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayDateString() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return vnDateStr;
}

/**
 * Get start of a specific date in VN timezone
 */
function getVNStartOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T00:00:00+07:00');
    return vnDateTime;
}

/**
 * Get end of a specific date in VN timezone
 */
function getVNEndOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T23:59:59.999+07:00');
    return vnDateTime;
}
