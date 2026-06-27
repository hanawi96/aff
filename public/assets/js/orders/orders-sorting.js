// Orders Sorting Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (dateSortOrder, amountSortOrder, currentPage, filteredOrdersData)

// ============================================
// DATE SORTING
// ============================================

/**
 * Toggle date sort order (asc <-> desc). Mặc định asc (cũ nhất trước).
 */
function toggleDateSort() {
    amountSortOrder = 'none';
    updateAmountSortIcon();

    dateSortOrder = dateSortOrder === 'desc' ? 'asc' : 'desc';

    updateDateSortIcon();
    applySorting();
    currentPage = 1;
    renderOrdersTable();
}

/**
 * Update date sort icon based on current sort order
 */
function updateDateSortIcon() {
    const icon = document.getElementById('dateSortIcon');
    if (!icon) return;

    if (dateSortOrder === 'desc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
    }
    icon.classList.remove('text-gray-400');
    icon.classList.add('text-admin-primary');
}

// ============================================
// AMOUNT SORTING
// ============================================

/**
 * Toggle amount sort (desc <-> asc). Lần đầu bấm: desc (lớn nhất trước).
 */
function toggleAmountSort() {
    dateSortOrder = 'asc';
    updateDateSortIcon();

    if (amountSortOrder === 'none') {
        amountSortOrder = 'desc';
    } else {
        amountSortOrder = amountSortOrder === 'desc' ? 'asc' : 'desc';
    }

    updateAmountSortIcon();
    applySorting();
    currentPage = 1;
    renderOrdersTable();
}

/**
 * Update amount sort icon (xám khi chưa sort giá trị; xanh khi desc/asc).
 */
function updateAmountSortIcon() {
    const icon = document.getElementById('amountSortIcon');
    if (!icon) return;

    if (amountSortOrder === 'none') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-green-500');
        icon.classList.add('text-gray-400');
        return;
    }

    if (amountSortOrder === 'desc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
    }
    icon.classList.remove('text-gray-400');
    icon.classList.add('text-green-500');
}

// ============================================
// APPLY SORTING
// ============================================

/**
 * Timestamp (ms) để sort theo cột ngày / mặc định.
 * Với đã gửi / đang vận chuyển / đã giao: ưu tiên shipped_at_unix (thời gian gửi hàng).
 */
function getOrderSortTimestampMs(statusFilter, order) {
    const preferShipTime =
        statusFilter === 'shipped' ||
        statusFilter === 'in_transit' ||
        statusFilter === 'delivered';

    if (preferShipTime && order.shipped_at_unix != null && order.shipped_at_unix !== '') {
        const n = Number(order.shipped_at_unix);
        if (Number.isFinite(n)) return n;
    }

    if (statusFilter === 'send_later' && order.planned_send_at_unix != null && order.planned_send_at_unix !== '') {
        const p = Number(order.planned_send_at_unix);
        if (Number.isFinite(p)) return p;
    }

    const raw = order.created_at_unix ?? order.created_at ?? order.order_date ?? 0;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
}

/**
 * Apply current sorting to filteredOrdersData
 * Sorting priority:
 * 1. Priority flag (is_priority = 1)
 * 2. User-selected sorting (amount or date)
 * 3. Default date sort: asc / desc (dateSortOrder, mặc định asc)
 */
function applySorting() {
    const currentStatusFilter = document.getElementById('statusFilter')?.value || 'pending';

    filteredOrdersData.sort((a, b) => {
        const priorityA = a.is_priority || 0;
        const priorityB = b.is_priority || 0;
        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }

        if (amountSortOrder !== 'none') {
            const amountA = a.total_amount || 0;
            const amountB = b.total_amount || 0;
            return amountSortOrder === 'desc' ? amountB - amountA : amountA - amountB;
        }

        const ts = (o) => getOrderSortTimestampMs(currentStatusFilter, o);
        const diff = ts(a) - ts(b);
        return dateSortOrder === 'desc' ? -diff : diff;
    });
}
