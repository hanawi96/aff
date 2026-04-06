// Orders Pagination Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (currentPage, itemsPerPage, filteredOrdersData, ORDERS_PAGE_SIZE_OPTIONS)

// ============================================
// PAGINATION RENDERING
// ============================================

/** Fallback nếu orders.js chưa gán ORDERS_PAGE_SIZE_OPTIONS (thứ tự script) */
function getOrdersPageSizeOptions() {
    return typeof ORDERS_PAGE_SIZE_OPTIONS !== 'undefined' && ORDERS_PAGE_SIZE_OPTIONS.length
        ? ORDERS_PAGE_SIZE_OPTIONS
        : [10, 15, 20, 30, 50, 100];
}

function buildOrdersPageSizeSelectHtml() {
    const opts = getOrdersPageSizeOptions();
    const optionsHtml = opts
        .map((o) => `<option value="${o}"${o === itemsPerPage ? ' selected' : ''}>${o}</option>`)
        .join('');
    return `<select title="Số đơn mỗi trang" aria-label="Số đơn hàng mỗi trang" onchange="setOrdersItemsPerPage(this.value)"
        class="shrink-0 rounded-md border border-gray-200 bg-white py-1 pl-2 pr-7 text-xs font-medium text-gray-700 shadow-sm focus:border-admin-primary focus:outline-none focus:ring-1 focus:ring-admin-primary/25 sm:text-sm">
        ${optionsHtml}
    </select>`;
}

/**
 * Render pagination controls
 * @param {number} totalPages - Total number of pages
 */
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (!filteredOrdersData.length) {
        paginationContainer.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredOrdersData.length);
    const total = filteredOrdersData.length;
    const infoHtml = `<span class="tabular-nums text-sm text-gray-500" title="Dải đang xem / tổng đơn (sau lọc)"><span class="font-semibold text-gray-800">${startItem}–${endItem}</span><span class="mx-0.5 text-gray-300">/</span>${total}</span>`;
    const pageSizeHtml = buildOrdersPageSizeSelectHtml();

    if (totalPages <= 1) {
        paginationContainer.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
            <div class="flex flex-wrap items-center gap-2">${infoHtml}<span class="hidden text-gray-300 sm:inline" aria-hidden="true">|</span>${pageSizeHtml}</div>
        </div>`;
        return;
    }

    let html = `<div class="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">`;

    html += `<div class="flex flex-wrap items-center gap-2">${infoHtml}<span class="hidden text-gray-300 sm:inline" aria-hidden="true">|</span>${pageSizeHtml}</div>`;

    // Pagination buttons
    html += '<div class="flex flex-wrap items-center gap-1.5">';

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

// ============================================
// PAGE NAVIGATION
// ============================================

/**
 * Navigate to specific page
 * @param {number} page - Page number to go to
 */
function goToPage(page) {
    const totalPages = Math.ceil(filteredOrdersData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderOrdersTable();

    // Scroll to top of table
    document.getElementById('tableContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
