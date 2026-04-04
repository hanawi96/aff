// Orders Sorting Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (dateSortOrder, amountSortOrder, currentPage, filteredOrdersData)

// ============================================
// DATE SORTING
// ============================================

/**
 * Toggle date sort order (desc -> asc -> none -> desc)
 */
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

/**
 * Update date sort icon based on current sort order
 */
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

// ============================================
// AMOUNT SORTING
// ============================================

/**
 * Toggle amount sort order (desc -> asc -> none -> desc)
 */
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

/**
 * Update amount sort icon based on current sort order
 */
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

// ============================================
// APPLY SORTING
// ============================================

/**
 * Apply current sorting to filteredOrdersData
 * Sorting priority:
 * 1. Status: "pending" luôn lên trên, "shipped" xuống dưới (để tránh in thiếu đơn)
 * 2. Priority flag (is_priority = 1)
 * 3. User-selected sorting (amount or date)
 */
function applySorting() {
    filteredOrdersData.sort((a, b) => {
        // LEVEL 1: Đơn được đánh dấu ưu tiên luôn lên trên
        const priorityA = a.is_priority || 0;
        const priorityB = b.is_priority || 0;
        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }

        // LEVEL 2: User-selected sorting (amount hoặc date)
        if (amountSortOrder !== 'none') {
            const amountA = a.total_amount || 0;
            const amountB = b.total_amount || 0;
            return amountSortOrder === 'desc' ? amountB - amountA : amountA - amountB;
        }

        if (dateSortOrder !== 'none') {
            const timestampA = a.created_at_unix || a.created_at || a.order_date || 0;
            const timestampB = b.created_at_unix || b.created_at || b.order_date || 0;
            return dateSortOrder === 'desc'
                ? new Date(timestampB) - new Date(timestampA)
                : new Date(timestampA) - new Date(timestampB);
        }

        // Default sort depends on status filter:
        // - "shipped" / "in_transit" / "delivered": mới nhất lên trên (gửi gần nhất dễ theo dõi)
        // - Các trạng thái khác: cũ nhất lên trên (FIFO - đặt trước làm trước)
        const currentStatusFilter = document.getElementById('statusFilter')?.value || 'pending';
        const newestFirstStatuses = ['shipped', 'in_transit', 'delivered'];
        const timestampA = a.created_at_unix || a.created_at || a.order_date || 0;
        const timestampB = b.created_at_unix || b.created_at || b.order_date || 0;
        if (newestFirstStatuses.includes(currentStatusFilter)) {
            return new Date(timestampB) - new Date(timestampA); // Mới nhất lên trên
        }
        return new Date(timestampA) - new Date(timestampB); // Cũ nhất lên trên (FIFO)
    });
}
