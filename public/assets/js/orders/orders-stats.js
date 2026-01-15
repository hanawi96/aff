// Orders Statistics Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (filteredOrdersData, allOrdersData)

// ============================================
// UPDATE STATISTICS
// ============================================

/**
 * Update statistics cards based on filtered data
 */
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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Helper function to update stat element
 * @param {string} elementId - Element ID
 * @param {string|number} value - Value to display
 * @param {string} className - CSS classes
 */
function updateStatElement(elementId, value, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('skeleton', 'h-10', 'w-16', 'w-24', 'rounded');
        element.className = className;
        element.textContent = value;
    }
}

/**
 * Update stat labels based on current filter
 */
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
