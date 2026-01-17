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
 * Priority orders always appear first, then apply other sorting
 */
function applySorting() {
    // Sort by priority first (priority = 1 comes first)
    filteredOrdersData.sort((a, b) => {
        const priorityA = a.is_priority || 0;
        const priorityB = b.is_priority || 0;
        
        // If priorities are different, priority orders come first
        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }
        
        // If same priority, apply secondary sorting
        // Ưu tiên sắp xếp theo amount nếu đang active
        if (amountSortOrder !== 'none') {
            const amountA = a.total_amount || 0;
            const amountB = b.total_amount || 0;

            if (amountSortOrder === 'desc') {
                return amountB - amountA;
            } else {
                return amountA - amountB;
            }
        } else if (dateSortOrder !== 'none') {
            const dateA = new Date(a.created_at || a.order_date || 0);
            const dateB = new Date(b.created_at || b.order_date || 0);

            if (dateSortOrder === 'desc') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        }
        
        // Default: newest first
        const dateA = new Date(a.created_at || a.order_date || 0);
        const dateB = new Date(b.created_at || b.order_date || 0);
        return dateB - dateA;
    });
}
