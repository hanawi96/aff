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
let allCTVList = []; // Cache CTV list for filter dropdown
// Note: allProductsList is declared in orders.js

// ============================================
// MAIN FILTER FUNCTION
// ============================================

/**
 * Filter orders data based on search, status, payment method, CTV, and date filters
 */
function filterOrdersData() {
    console.log('🎯 FILTER FUNCTION CALLED - Version 4.0 (Added CTV filter)');

    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const paymentFilter = document.getElementById('paymentFilter')?.value || 'all';
    const ctvFilter = document.getElementById('ctvFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';

    console.log('🔍 Filtering with:', { searchTerm, statusFilter, paymentFilter, ctvFilter, dateFilter });

    // Debug date ranges
    if (dateFilter === 'today') {
        console.log('📅 Today range:', getVNStartOfToday().toISOString(), '-', getVNEndOfToday().toISOString());
    } else if (dateFilter === 'yesterday') {
        const todayStart = getVNStartOfToday();
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayEnd = new Date(todayStart.getTime() - 1);
        console.log('📅 Yesterday range:', yesterdayStart.toISOString(), '-', yesterdayEnd.toISOString());
    } else if (dateFilter === 'week') {
        console.log('📅 7-day range (last 7 days):', getVNStartOfLast7Days().toISOString(), '-', getVNEndOfToday().toISOString());
    } else if (dateFilter === 'month') {
        console.log('📅 30-day range (last 30 days):', getVNStartOfLast30Days().toISOString(), '-', getVNEndOfToday().toISOString());
    }

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
        // Search filter - now includes address AND products
        let matchesSearch = !searchTerm;
        if (searchTerm) {
            matchesSearch = 
                (order.order_id && order.order_id.toLowerCase().includes(searchTerm)) ||
                (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm)) ||
                (order.customer_phone && order.customer_phone.includes(searchTerm)) ||
                (order.referral_code && order.referral_code.toLowerCase().includes(searchTerm)) ||
                (order.address && removeVietnameseTones(order.address.toLowerCase()).includes(removeVietnameseTones(searchTerm)));
            
            // Also search in products if not matched yet
            if (!matchesSearch) {
                try {
                    const products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
                    if (Array.isArray(products)) {
                        matchesSearch = products.some(p => {
                            const productName = (p.name || '').toLowerCase();
                            const normalizedName = removeVietnameseTones(productName);
                            const normalizedSearch = removeVietnameseTones(searchTerm);
                            return normalizedName.includes(normalizedSearch);
                        });
                    }
                } catch (e) {
                    // Fallback: search in raw string
                    const productsStr = (order.products || '').toLowerCase();
                    const normalizedStr = removeVietnameseTones(productsStr);
                    const normalizedSearch = removeVietnameseTones(searchTerm);
                    matchesSearch = normalizedStr.includes(normalizedSearch);
                }
            }
        }

        // Priority filter - NEW
        const matchesPriority = !priorityFilterActive || order.is_priority === 1;

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

        // Payment method filter - simple and fast
        const orderPayment = (order.payment_method || 'cod').toLowerCase().trim();
        const matchesPayment = paymentFilter === 'all' || orderPayment === paymentFilter;

        // CTV filter - simple: all / has_ctv / no_ctv
        const orderCTV = (order.referral_code || '').toLowerCase().trim();
        let matchesCTV = true;
        if (ctvFilter === 'has_ctv') {
            matchesCTV = !!orderCTV; // Has CTV code
        } else if (ctvFilter === 'no_ctv') {
            matchesCTV = !orderCTV; // No CTV code
        }
        // If 'all', matchesCTV stays true

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
                const weekStart = getVNStartOfLast7Days();
                const todayEnd = getVNEndOfToday();
                matchesDate = orderDate >= weekStart && orderDate <= todayEnd;
            } else if (dateFilter === 'month') {
                const monthStart = getVNStartOfLast30Days();
                const todayEnd = getVNEndOfToday();
                matchesDate = orderDate >= monthStart && orderDate <= todayEnd;
            } else if (dateFilter === 'custom') {
                // Custom date range filter
                const startDateStr = document.getElementById('customDateStart').value;
                const endDateStr = document.getElementById('customDateEnd').value;

                if (startDateStr && endDateStr) {
                    const customStart = getVNStartOfDate(startDateStr);
                    const customEnd = getVNEndOfDate(endDateStr);
                    matchesDate = orderDate >= customStart && orderDate <= customEnd;
                }
            }
        }

        return matchesSearch && matchesPriority && matchesStatus && matchesPayment && matchesCTV && matchesDate;
    });

    console.log(`✅ Filtered: ${filteredOrdersData.length} orders (from ${allOrdersData.length} total)`);

    // Apply sorting
    applySorting();

    currentPage = 1; // Reset to first page when filtering

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

/**
 * Select status filter value
 */
function selectStatusFilter(value, label) {
    document.getElementById('statusFilter').value = value;
    document.getElementById('statusFilterLabel').textContent = label;
    document.getElementById('statusFilterMenu')?.remove();
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
    
    // Show toast
    if (priorityFilterActive) {
        const priorityCount = allOrdersData.filter(o => o.is_priority === 1).length;
        showToast(`Đang hiển thị ${priorityCount} đơn ưu tiên`, 'info');
    } else {
        showToast('Đang hiển thị tất cả đơn hàng', 'info');
    }
}
