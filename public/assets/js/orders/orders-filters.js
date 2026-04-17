// Orders Filter Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js and timezone-utils.js

// ============================================
// GLOBAL VARIABLES FOR FILTERS
// ============================================
let customDatePickerModal = null;
let currentDateMode = 'single'; // 'single' or 'range'
let priorityFilterActive = false; // Track priority filter state
/** Chỉ hiện đơn có ít nhất 1 sản phẩm thiếu cân/size (dùng getOrderProductsMissingSizeWeight) */
let missingSizeFilterActive = false;
/** Chỉ hiện đơn có ít nhất 1 sản phẩm thuộc danh mục "Mix thẻ tên bé" (category id 21) */
let theTenBeFilterActive = false;
let allCTVList = []; // Cache CTV list for filter dropdown
// Note: allProductsList is declared in orders.js

// Cache tập product_id thuộc danh mục "Mix thẻ tên bé" (category_id = 21)
let _cat21ProductIds = null;

function _getCategory21ProductIds() {
    if (_cat21ProductIds !== null) return _cat21ProductIds;
    _cat21ProductIds = new Set(
        (allProductsList || [])
            .filter(p => {
                if (Array.isArray(p.category_ids)) return p.category_ids.some(id => parseInt(id, 10) === 21);
                return parseInt(p.category_id, 10) === 21;
            })
            .map(p => p.id)
    );
    return _cat21ProductIds;
}

/** Vô hiệu cache khi allProductsList thay đổi */
function invalidateCategory21Cache() {
    _cat21ProductIds = null;
}

/**
 * Kiểm tra đơn hàng có ít nhất 1 SP thuộc danh mục "Mix thẻ tên bé" (cat 21)
 * Ưu tiên khớp product_id; fallback khớp tên chứa "thẻ tên"
 */
function orderHasTheTenBeProduct(order) {
    try {
        const products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
        if (!Array.isArray(products)) return false;
        const cat21Ids = _getCategory21ProductIds();
        return products.some(item => {
            const pid = item.product_id || item.id;
            if (pid != null && cat21Ids.has(pid)) return true;
            // Fallback theo tên khi product_id không có hoặc đã bị xóa
            return (item.name || '').toLowerCase().includes('thẻ tên');
        });
    } catch {
        return false;
    }
}

// ============================================
// SEARCH INDEX CACHE (Performance Optimization)
// ============================================
let searchIndexCache = null;
let searchIndexVersion = 0; // Track data version to invalidate cache

/**
 * Build search index for fast searching
 * Called once when data loads or changes
 */
function buildSearchIndex() {
    searchIndexCache = allOrdersData.map(order => {
        // Parse products once and cache
        let productNames = [];
        let productNotes = [];
        try {
            const products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
            if (Array.isArray(products)) {
                products.forEach(p => {
                    if (typeof p === 'object' && p !== null) {
                        productNames.push(removeVietnameseTones((p.name || '').toLowerCase()));
                        const lineNote = (p.notes || '').trim();
                        if (lineNote) {
                            productNotes.push(removeVietnameseTones(lineNote.toLowerCase()));
                        }
                    } else if (typeof p === 'string') {
                        productNames.push(removeVietnameseTones(p.toLowerCase()));
                    }
                });
            }
        } catch (e) {
            // Fallback: use raw string
            productNames = [removeVietnameseTones((order.products || '').toLowerCase())];
        }

        const orderNotesNorm = removeVietnameseTones((order.notes || '').toLowerCase());

        return {
            id: order.id,
            // Pre-normalized fields for fast search
            orderId: (order.order_id || '').toLowerCase(),
            customerName: removeVietnameseTones((order.customer_name || '').toLowerCase()),
            customerNameOriginal: (order.customer_name || '').toLowerCase(),
            phone: order.customer_phone || '',
            ctvCode: (order.referral_code || '').toLowerCase(),
            address: removeVietnameseTones((order.address || '').toLowerCase()),
            products: productNames,
            orderNotes: orderNotesNorm,
            productNotes,
            // Keep reference to original order
            order: order
        };
    });
    
    searchIndexVersion++;
}

/**
 * Invalidate search cache when data changes
 */
function invalidateSearchCache() {
    searchIndexCache = null;
}

// ============================================
// MAIN FILTER FUNCTION
// ============================================

/** Trạng thái dropdown trước khi người dùng bắt đầu nhập tìm (khôi phục khi xóa ô tìm, trừ khi đã đổi trạng thái lúc đang tìm) */
let _orderStatusFilterBeforeSearch = null;
/** Ô tìm lần trước có nội dung hay không — chỉ dùng để phát hiện lúc «vừa bắt đầu tìm» / «vừa xóa hết» */
let _prevSearchInputHadText = false;

const ORDER_STATUS_FILTER_LABELS = {
    all: 'Tất cả trạng thái',
    pending: 'Chưa gửi hàng',
    shipped: 'Đã gửi hàng',
    in_transit: 'Đang vận chuyển',
    delivered: 'Đã giao hàng',
    failed: 'Giao hàng thất bại'
};

/**
 * Vừa bắt đầu nhập tìm → chuyển dropdown sang «Tất cả trạng thái» (một lần).
 * Trong lúc vẫn gõ / vẫn có từ khóa, giữ nguyên trạng thái người dùng chọn (lọc kết hợp tìm + trạng thái).
 * Xóa hết ô tìm → khôi phục trạng thái đã lưu (nếu chưa đổi tay lúc đang tìm).
 */
function syncStatusFilterWithSearchInput() {
    const searchRaw = document.getElementById('searchInput')?.value || '';
    const hasActiveSearch = searchRaw.trim().length > 0;
    const hidden = document.getElementById('statusFilter');
    const labelEl = document.getElementById('statusFilterLabel');
    if (!hidden || !labelEl) return;

    if (hasActiveSearch && !_prevSearchInputHadText) {
        if (hidden.value !== 'all' && _orderStatusFilterBeforeSearch === null) {
            _orderStatusFilterBeforeSearch = hidden.value;
        }
        hidden.value = 'all';
        labelEl.textContent = ORDER_STATUS_FILTER_LABELS.all;
    } else if (!hasActiveSearch && _prevSearchInputHadText) {
        if (_orderStatusFilterBeforeSearch !== null) {
            const v = _orderStatusFilterBeforeSearch;
            _orderStatusFilterBeforeSearch = null;
            hidden.value = v;
            labelEl.textContent = ORDER_STATUS_FILTER_LABELS[v] || v;
        }
    }
    _prevSearchInputHadText = hasActiveSearch;
}

/**
 * Filter orders data based on search, status, payment method, CTV, and date filters
 * OPTIMIZED: Uses pre-built search index for 10x faster search
 * @param {boolean} [preservePage=false] - true: giữ trang hiện tại (hợp lệ sau khi đổi trạng thái 1 đơn, refilter)
 */
function filterOrdersData(preservePage = false) {
    syncStatusFilterWithSearchInput();

    const pageBeforeFilter = preservePage ? currentPage : null;
    const searchRaw = document.getElementById('searchInput')?.value || '';
    const searchTerm = searchRaw.toLowerCase();
    // Mặc định đồng bộ với index.html: ưu tiên đơn chưa gửi (pending)
    const statusFilter = document.getElementById('statusFilter')?.value || 'pending';
    const paymentFilter = document.getElementById('paymentFilter')?.value || 'all';
    const ctvFilter = document.getElementById('ctvFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';

    // Build search index if not exists or data changed
    if (!searchIndexCache || searchIndexCache.length !== allOrdersData.length) {
        buildSearchIndex();
    }

    filteredOrdersData = allOrdersData.filter(order => {
        // ============================================
        // OPTIMIZED SEARCH FILTER
        // ============================================
        let matchesSearch = !searchTerm;
        if (searchTerm) {
            // Find cached index entry
            const cached = searchIndexCache.find(c => c.id === order.id);
            if (cached) {
                const normalizedSearchTerm = removeVietnameseTones(searchTerm);
                
                // Primary fields (always search)
                const matchOrderId = cached.orderId.includes(searchTerm);
                const matchCustomerName = cached.customerName.includes(normalizedSearchTerm);
                const matchPhone = cached.phone.includes(searchTerm);
                const matchCTV = cached.ctvCode.includes(searchTerm);
                
                // Smart address search: only if term is long enough or has spaces
                const shouldSearchAddress = 
                    (searchTerm.includes(' ') && searchTerm.length >= 4) || 
                    searchTerm.length >= 6;
                const matchAddress = shouldSearchAddress && cached.address.includes(normalizedSearchTerm);
                
                // Product search: check cached product names
                const matchProducts = cached.products.some(p => p.includes(normalizedSearchTerm));

                // Lưu ý đơn hàng + lưu ý từng dòng sản phẩm (đã chuẩn hoá không dấu)
                const matchOrderNotes = cached.orderNotes && cached.orderNotes.includes(normalizedSearchTerm);
                const matchProductNotes = Array.isArray(cached.productNotes) && cached.productNotes.some(n => n.includes(normalizedSearchTerm));

                matchesSearch = matchOrderId || matchCustomerName || matchPhone || matchCTV || matchAddress || matchProducts
                    || matchOrderNotes || matchProductNotes;
            } else {
                // Fallback: shouldn't happen, but handle gracefully
                matchesSearch = true;
            }
        }

        // Priority filter
        const matchesPriority = !priorityFilterActive || order.is_priority === 1;

        // Bộ lọc "Chưa có size" — đơn có ≥1 dòng sản phẩm không có cân/size sau chuẩn hóa
        let matchesMissingSize = true;
        if (missingSizeFilterActive) {
            const missing = getOrderProductsMissingSizeWeight(order);
            matchesMissingSize = missing.length > 0;
        }

        // Bộ lọc "Thẻ tên bé" — đơn có ≥1 SP thuộc danh mục Mix thẻ tên bé (cat 21)
        const matchesTheTenBe = !theTenBeFilterActive || orderHasTheTenBeProduct(order);

        // Status filter
        const orderStatus = (order.status || 'pending').toLowerCase().trim();
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

        // Payment method filter (bank_transfer trong DB vẫn khớp bộ lọc "bank")
        const orderPaymentKey = orderPaymentApiKey(order.payment_method);
        const matchesPayment = paymentFilter === 'all' || orderPaymentKey === paymentFilter;

        // CTV filter
        const orderCTV = (order.referral_code || '').toLowerCase().trim();
        let matchesCTV = true;
        if (ctvFilter === 'has_ctv') {
            matchesCTV = !!orderCTV;
        } else if (ctvFilter === 'no_ctv') {
            matchesCTV = !orderCTV;
        }

        // Date filter
        let matchesDate = true;
        if (dateFilter !== 'all') {
            // Prefer created_at_unix (Vietnam time) over created_at (UTC time)
            const timestamp = order.created_at_unix || order.created_at || order.order_date;
            const orderDate = new Date(typeof timestamp === 'number' ? timestamp : timestamp);

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
                const weekStart = getVNStartOfLast7Days();
                const todayEnd = getVNEndOfToday();
                matchesDate = orderDate >= weekStart && orderDate <= todayEnd;
            } else if (dateFilter === 'month') {
                const monthStart = getVNStartOfLast30Days();
                const todayEnd = getVNEndOfToday();
                matchesDate = orderDate >= monthStart && orderDate <= todayEnd;
            } else if (dateFilter === 'lastMonth') {
                const lastMonthStart = getVNStartOfLastMonth();
                const lastMonthEnd = getVNEndOfLastMonth();
                matchesDate = orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
            } else if (dateFilter === 'custom') {
                const startDateStr = document.getElementById('customDateStart').value;
                const endDateStr = document.getElementById('customDateEnd').value;

                if (startDateStr && endDateStr) {
                    const customStart = getVNStartOfDate(startDateStr);
                    const customEnd = getVNEndOfDate(endDateStr);
                    matchesDate = orderDate >= customStart && orderDate <= customEnd;
                }
            }
        }

        return matchesSearch && matchesPriority && matchesMissingSize && matchesTheTenBe && matchesStatus && matchesPayment && matchesCTV && matchesDate;
    });

    // Apply sorting
    applySorting();

    if (preservePage && pageBeforeFilter != null) {
        const totalPages = Math.max(1, Math.ceil(filteredOrdersData.length / itemsPerPage) || 1);
        currentPage = Math.min(Math.max(1, pageBeforeFilter), totalPages);
    } else {
        currentPage = 1; // Reset to first page when filtering (đổi bộ lọc thủ công)
    }

    // Update stats based on filtered data
    updateStats();

    renderOrdersTable();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Remove Vietnamese tones for search normalization
 */
function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

// ============================================
// STATUS FILTER
// ============================================

/**
 * Toggle status filter dropdown
 */
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
        { value: 'pending', label: 'Chưa gửi hàng', color: 'yellow' },
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

/**
 * Select status filter value
 */
function selectStatusFilter(value, label) {
    if ((document.getElementById('searchInput')?.value || '').trim().length > 0) {
        _orderStatusFilterBeforeSearch = null;
    }
    document.getElementById('statusFilter').value = value;
    document.getElementById('statusFilterLabel').textContent = label;
    document.getElementById('statusFilterMenu')?.remove();

    // Đã gửi hàng: sort mặc định theo thời gian gửi mới nhất (shipped_at_unix), không để sort theo giá trị đơn che mất
    if (value === 'shipped') {
        amountSortOrder = 'none';
        dateSortOrder = 'desc';
        if (typeof updateAmountSortIcon === 'function') updateAmountSortIcon();
        if (typeof updateDateSortIcon === 'function') updateDateSortIcon();
    }

    filterOrdersData();
}

// ============================================
// PAYMENT METHOD FILTER
// ============================================

/**
 * Toggle payment method filter dropdown
 */
function togglePaymentFilter(event) {
    event.stopPropagation();

    // Close status filter if open
    const statusMenu = document.getElementById('statusFilterMenu');
    if (statusMenu) statusMenu.remove();

    // Close if already open
    const existingMenu = document.getElementById('paymentFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const paymentMethods = [
        { value: 'all', label: 'Tất cả thanh toán', icon: '💳', color: 'gray' },
        { value: 'cod', label: 'COD (Tiền mặt)', icon: '💵', color: 'orange' },
        { value: 'bank', label: 'Chuyển khoản', icon: '🏦', color: 'green' }
    ];

    const currentValue = document.getElementById('paymentFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'paymentFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[220px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = paymentMethods.map(p => `
        <button 
            onclick="selectPaymentFilter('${p.value}', '${p.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${p.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <span class="text-xl flex-shrink-0">${p.icon}</span>
            <span class="text-sm text-gray-700 flex-1">${p.label}</span>
            ${p.value === currentValue ? `
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

/**
 * Select payment method filter value
 */
function selectPaymentFilter(value, label) {
    document.getElementById('paymentFilter').value = value;
    document.getElementById('paymentFilterLabel').textContent = label;
    document.getElementById('paymentFilterMenu')?.remove();
    filterOrdersData();
}

// ============================================
// CTV FILTER
// ============================================

/**
 * Toggle CTV filter dropdown - SIMPLIFIED VERSION
 */
function toggleCTVFilter(event) {
    event.stopPropagation();

    // Close other menus
    const statusMenu = document.getElementById('statusFilterMenu');
    const paymentMenu = document.getElementById('paymentFilterMenu');
    if (statusMenu) statusMenu.remove();
    if (paymentMenu) paymentMenu.remove();

    // Close if already open
    const existingMenu = document.getElementById('ctvFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const button = event.currentTarget;
    const currentValue = document.getElementById('ctvFilter').value;

    // Count orders
    const totalOrders = allOrdersData.length;
    const ordersWithCTV = allOrdersData.filter(o => o.referral_code).length;
    const ordersWithoutCTV = totalOrders - ordersWithCTV;

    // Simple 3 options
    const options = [
        { value: 'all', label: 'Tất cả đơn', icon: '📦', count: totalOrders },
        { value: 'has_ctv', label: 'Đơn từ CTV', icon: '👥', count: ordersWithCTV },
        { value: 'no_ctv', label: 'Không có CTV', icon: '🚫', count: ordersWithoutCTV }
    ];

    // Create menu
    const menu = document.createElement('div');
    menu.id = 'ctvFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[240px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = options.map(opt => `
        <button 
            onclick="selectCTVFilter('${opt.value}', '${opt.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${opt.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <span class="text-xl flex-shrink-0">${opt.icon}</span>
            <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-700 font-medium">${opt.label}</div>
                <div class="text-xs text-gray-500">${opt.count} đơn hàng</div>
            </div>
            ${opt.value === currentValue ? `
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

/**
 * Select CTV filter value
 */
function selectCTVFilter(value, label) {
    document.getElementById('ctvFilter').value = value;
    document.getElementById('ctvFilterLabel').textContent = label;
    document.getElementById('ctvFilterMenu')?.remove();
    filterOrdersData();
}

// ============================================
// DATE FILTER PRESETS
// ============================================

/**
 * Select date filter preset (button-based design)
 */
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
    console.log('toggleDateFilter called but not needed with preset buttons');
}

function selectDateFilter(value, label) {
    console.log('selectDateFilter called but not needed with preset buttons');
}


// ============================================
// CUSTOM DATE PICKER
// ============================================

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
                <button type="button" onclick="closeCustomDatePicker()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Chọn nhanh theo tháng -->
            <div class="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wide text-indigo-800">Chọn nhanh theo tháng</span>
                    <select id="quickYearMonthSelect" class="min-w-[10.5rem] max-w-full cursor-pointer rounded-lg border border-indigo-200 py-1.5 pl-3 pr-10 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        style="appearance:none;-webkit-appearance:none;-moz-appearance:none;background-color:#fff;background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%2364748b%22 stroke-width=%222%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22/%3E%3C/svg%3E');background-position:right 0.6rem center;background-size:1rem 1rem;background-repeat:no-repeat;">
                        ${(() => {
                            const vy = parseInt(getTodayDateString().split('-')[0], 10);
                            let opts = '';
                            for (let y = vy; y >= vy - 5; y--) {
                                opts += `<option value="${y}" ${y === vy ? 'selected' : ''}>Năm ${y}</option>`;
                            }
                            return opts;
                        })()}
                    </select>
                </div>
                <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
                        <button type="button" onclick="quickSelectMonth(${m})"
                            class="rounded-lg border border-indigo-200/80 bg-white px-1 py-2 text-center text-xs font-medium text-indigo-800 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 sm:text-sm">
                            Tháng ${m}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <!-- Mode Tabs -->
            <div class="date-mode-tabs">
                <button type="button" data-mode="single" class="date-mode-tab ${currentDateMode === 'single' ? 'active' : ''}" onclick="switchDateMode('single')">
                    Một ngày
                </button>
                <button type="button" data-mode="range" class="date-mode-tab ${currentDateMode === 'range' ? 'active' : ''}" onclick="switchDateMode('range')">
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
                            class="w-full">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="endDateInput" value="${endDate}" 
                            class="w-full">
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mt-6">
                <button type="button" onclick="clearCustomDate()" 
                    class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Xóa bộ lọc
                </button>
                <button type="button" onclick="applyCustomDate()" 
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    customDatePickerModal = modal;

    // Close on backdrop click
    modal.addEventListener('click', function (e) {
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

    document.querySelectorAll('.date-mode-tab').forEach(tab => {
        const m = tab.getAttribute('data-mode');
        tab.classList.toggle('active', m === mode);
    });

    const singleMode = document.getElementById('singleDateMode');
    const rangeMode = document.getElementById('rangeDateMode');
    if (!singleMode || !rangeMode) return;

    if (mode === 'single') {
        singleMode.classList.remove('hidden');
        rangeMode.classList.add('hidden');
    } else {
        singleMode.classList.add('hidden');
        rangeMode.classList.remove('hidden');
    }
}

/**
 * Chọn nhanh cả tháng dương lịch: từ 00:00 ngày 1 đến hết ngày cuối tháng.
 */
function quickSelectMonth(month) {
    const yearEl = document.getElementById('quickYearMonthSelect');
    if (!yearEl) return;
    const year = parseInt(yearEl.value, 10);
    if (Number.isNaN(year) || month < 1 || month > 12) return;

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    switchDateMode('range');
    const si = document.getElementById('startDateInput');
    const ei = document.getElementById('endDateInput');
    if (si) si.value = start;
    if (ei) ei.value = end;

    applyCustomDate();
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

// ============================================
// PRIORITY FILTER
// ============================================

/**
 * Toggle priority filter (show only priority orders or all orders)
 * Button text stays as "Tất cả đơn ưu tiên" - only highlight changes
 */
function togglePriorityFilter() {
    const button = document.getElementById('priorityFilterBtn');
    const icon = button.querySelector('svg');
    
    // Toggle state
    priorityFilterActive = !priorityFilterActive;
    
    if (priorityFilterActive) {
        // Active state: Show only priority orders - highlight button
        button.classList.remove('border-gray-300', 'hover:bg-yellow-50', 'hover:border-yellow-400');
        button.classList.add('bg-yellow-50', 'border-yellow-500');
        icon.classList.remove('text-gray-500');
        icon.classList.add('text-yellow-500');
        icon.setAttribute('fill', 'currentColor');
    } else {
        // Inactive state: Show all orders - unhighlight button
        button.classList.remove('bg-yellow-50', 'border-yellow-500');
        button.classList.add('border-gray-300', 'hover:bg-yellow-50', 'hover:border-yellow-400');
        icon.classList.remove('text-yellow-500');
        icon.classList.add('text-gray-500');
        icon.setAttribute('fill', 'none');
    }
    
    // Apply filter
    filterOrdersData();
}

/**
 * Bật/tắt bộ lọc chỉ đơn có sản phẩm chưa có cân hoặc size
 */
function toggleMissingSizeFilter() {
    const button = document.getElementById('missingSizeFilterBtn');
    if (!button) return;
    const icon = button.querySelector('svg');

    missingSizeFilterActive = !missingSizeFilterActive;

    if (missingSizeFilterActive) {
        button.classList.remove('border-gray-300', 'hover:bg-amber-50', 'hover:border-amber-300');
        button.classList.add('bg-amber-50', 'border-amber-500', 'ring-1', 'ring-amber-200');
        icon.classList.remove('text-gray-500');
        icon.classList.add('text-amber-600');
    } else {
        button.classList.remove('bg-amber-50', 'border-amber-500', 'ring-1', 'ring-amber-200');
        button.classList.add('border-gray-300', 'hover:bg-amber-50', 'hover:border-amber-300');
        icon.classList.remove('text-amber-600');
        icon.classList.add('text-gray-500');
    }

    filterOrdersData();
}

function toggleTheTenBeFilter() {
    const button = document.getElementById('theTenBeFilterBtn');
    if (!button) return;
    const icon = button.querySelector('svg');

    // Xóa cache product ids khi toggle để đảm bảo fresh nếu products đã load sau
    invalidateCategory21Cache();

    theTenBeFilterActive = !theTenBeFilterActive;

    if (theTenBeFilterActive) {
        button.classList.remove('border-gray-300', 'hover:bg-pink-50', 'hover:border-pink-300');
        button.classList.add('bg-pink-50', 'border-pink-500', 'ring-1', 'ring-pink-200');
        icon.classList.remove('text-gray-500');
        icon.classList.add('text-pink-600');
        button.querySelector('span').classList.remove('text-gray-700');
        button.querySelector('span').classList.add('text-pink-700', 'font-semibold');
    } else {
        button.classList.remove('bg-pink-50', 'border-pink-500', 'ring-1', 'ring-pink-200');
        button.classList.add('border-gray-300', 'hover:bg-pink-50', 'hover:border-pink-300');
        icon.classList.remove('text-pink-600');
        icon.classList.add('text-gray-500');
        button.querySelector('span').classList.remove('text-pink-700', 'font-semibold');
        button.querySelector('span').classList.add('text-gray-700');
    }

    filterOrdersData();
}
