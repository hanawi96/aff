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
/** Chỉ hiện đơn có ≥1 SP thuộc DM 21, tên/lưu ý SP có "thẻ", hoặc lưu ý đơn có "thẻ" */
let theTenBeFilterActive = false;
/** Chỉ hiện đơn có lưu ý đơn hoặc lưu ý ít nhất một dòng SP */
let hasNotesFilterActive = false;
/** Chỉ hiện đơn gửi sau cần làm (từ badge thông báo) */
let sendLaterUrgentFilterActive = false;
let sendLaterUrgentFilterIds = null;
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
            .map(p => parseInt(p.id, 10))
            .filter(n => !Number.isNaN(n))
    );
    return _cat21ProductIds;
}

/** Vô hiệu cache khi allProductsList thay đổi */
function invalidateCategory21Cache() {
    _cat21ProductIds = null;
}

/** Vị trí marker "thẻ tên" hoặc "thẻ" trong tên SP (ưu tiên cụm dài trước). */
function _findTheTenBeMarkerInText(text) {
    if (text == null || text === '') return null;
    const n = String(text).normalize('NFC');
    const lower = n.toLowerCase();

    const needleFull = 'thẻ tên'.normalize('NFC');
    let idx = lower.indexOf(needleFull);
    if (idx !== -1) return { idx, len: needleFull.length, source: n };

    const flex = lower.match(/thẻ\s+tên/);
    if (flex) return { idx: flex.index, len: flex[0].length, source: n };

    const needleShort = 'thẻ'.normalize('NFC');
    idx = lower.indexOf(needleShort);
    if (idx !== -1) return { idx, len: needleShort.length, source: n };

    const plain = removeVietnameseTones(lower).toLowerCase();
    idx = plain.indexOf('the ten');
    if (idx !== -1) return { idx, len: 7, source: n };
    const flexPlain = plain.match(/the\s+ten/);
    if (flexPlain) return { idx: flexPlain.index, len: flexPlain[0].length, source: n };
    const solo = plain.match(/\bthe\b/);
    if (solo) return { idx: solo.index, len: solo[0].length, source: n };

    return null;
}

/** Tên dòng SP có chứa "thẻ tên" hoặc "thẻ" (NFC, khoảng trắng linh hoạt, fallback không dấu) */
function _productTextHasTheTenBe(text) {
    return _findTheTenBeMarkerInText(text) != null;
}

/** Các chuỗi tên có thể dùng để nhận diện thẻ tên (JSON + tên SP trong kho) */
function _orderLineNameCandidates(item) {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];
    const out = [];
    if (item.name) out.push(String(item.name));
    if (item.product_name) out.push(String(item.product_name));
    if (item.product_id != null && Array.isArray(allProductsList)) {
        const n = parseInt(item.product_id, 10);
        if (!Number.isNaN(n)) {
            const cat = allProductsList.find(p => parseInt(p.id, 10) === n);
            if (cat?.name) out.push(String(cat.name));
        }
    }
    return out;
}

function _productIdInCategory21(pid, cat21Ids) {
    if (pid == null || pid === '') return false;
    const n = parseInt(pid, 10);
    return !Number.isNaN(n) && cat21Ids.has(n);
}

/**
 * Một dòng SP trong đơn được coi là "thẻ tên bé" nếu:
 *  - Tên dòng có text "thẻ tên" hoặc "thẻ", HOẶC
 *  - Lưu ý dòng SP có text "thẻ tên" hoặc "thẻ", HOẶC
 *  - product_id thuộc danh mục Mix thẻ tên bé (category id 21)
 */
function _orderLineHasTheTenBeProduct(item, cat21Ids) {
    if (typeof item === 'string') {
        return _productTextHasTheTenBe(item);
    }
    if (!item || typeof item !== 'object') return false;
    for (const nm of _orderLineNameCandidates(item)) {
        if (_productTextHasTheTenBe(nm)) return true;
    }
    const lineNotes = item.notes && String(item.notes).trim();
    if (lineNotes && _productTextHasTheTenBe(lineNotes)) return true;
    const pid = item.product_id != null ? item.product_id : item.id;
    return _productIdInCategory21(pid, cat21Ids);
}

/**
 * Đơn có ≥1 SP thẻ tên bé: DM 21, tên/lưu ý SP chứa "thẻ tên" / "thẻ", hoặc lưu ý đơn có "thẻ"
 */
function orderHasTheTenBeProduct(order) {
    try {
        const products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
        if (!Array.isArray(products)) return false;
        const cat21Ids = _getCategory21ProductIds();
        if (products.some(item => _orderLineHasTheTenBeProduct(item, cat21Ids))) return true;
        const orderNote = order.notes && String(order.notes).trim();
        return !!(orderNote && _productTextHasTheTenBe(orderNote));
    } catch {
        return false;
    }
}

/** Fallback khi thiếu cache (hiếm) — đồng bộ logic với hasAnyNotes trong buildSearchIndex */
function orderHasAnyNotesFallback(order) {
    if (order.notes && String(order.notes).trim()) return true;
    try {
        const products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
        if (!Array.isArray(products)) return false;
        return products.some(p => typeof p === 'object' && p !== null && p.notes && String(p.notes).trim());
    } catch {
        return false;
    }
}

// ============================================
// SEARCH INDEX CACHE (Performance Optimization)
// ============================================
let searchIndexCache = null;
/** Map order.id → cache row — tra cứu O(1) khi lọc / tìm */
let searchIndexById = new Map();
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
        const hasAnyNotes = !!(order.notes && String(order.notes).trim()) || productNotes.length > 0;

        return {
            id: order.id,
            // Pre-normalized fields for fast search
            orderId: (order.order_id || '').toLowerCase(),
            customerName: removeVietnameseTones((order.customer_name || '').toLowerCase()),
            customerNameOriginal: (order.customer_name || '').toLowerCase(),
            phone: order.customer_phone || '',
            phoneDigits: normalizeVNPhoneDigitsForSearch(order.customer_phone || ''),
            ctvCode: (order.referral_code || '').toLowerCase(),
            address: removeVietnameseTones((order.address || '').toLowerCase()),
            products: productNames,
            orderNotes: orderNotesNorm,
            productNotes,
            hasAnyNotes,
            // Keep reference to original order
            order: order
        };
    });

    searchIndexById = new Map(searchIndexCache.map(c => [c.id, c]));
    searchIndexVersion++;
}

/**
 * Invalidate search cache when data changes
 */
function invalidateSearchCache() {
    searchIndexCache = null;
    searchIndexById = new Map();
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
    send_later: 'Gửi sau',
    shipped: 'Đã gửi hàng',
    awaiting_reship: 'Chờ gửi lại'
};

/** Đã bỏ khỏi dropdown lọc desktop — nếu còn giá trị cũ trong DOM thì coi như «Chưa gửi hàng». */
const REMOVED_DESKTOP_STATUS_FILTER_VALUES = new Set(['in_transit', 'delivered', 'failed']);

function normalizeDesktopStatusFilterHidden() {
    const hidden = document.getElementById('statusFilter');
    const labelEl = document.getElementById('statusFilterLabel');
    if (!hidden) return;
    const v = (hidden.value || 'pending').toLowerCase().trim();
    if (!REMOVED_DESKTOP_STATUS_FILTER_VALUES.has(v)) return;
    hidden.value = 'pending';
    if (labelEl) labelEl.textContent = ORDER_STATUS_FILTER_LABELS.pending;
}

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
    normalizeDesktopStatusFilterHidden();

    const pageBeforeFilter = preservePage ? currentPage : null;
    const searchRaw = document.getElementById('searchInput')?.value || '';
    const searchTerm = searchRaw.toLowerCase();
    const searchPhoneDigits = isPhoneLikeSearchQuery(searchRaw)
        ? normalizeVNPhoneDigitsForSearch(searchRaw)
        : '';
    // Mặc định đồng bộ với index.html: ưu tiên đơn chưa gửi (pending)
    const statusFilter = document.getElementById('statusFilter')?.value || 'pending';
    const paymentFilter = document.getElementById('paymentFilter')?.value || 'all';
    const customerSourceFilter = document.getElementById('customerSourceFilter')?.value || 'all';
    const ctvFilter = document.getElementById('ctvFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';

    // D1: chỉ build search index khi thực sự cần — search box có nội dung
    // hoặc bật lọc "Có lưu ý" (hai chỗ duy nhất đọc `cached` ở dưới).
    // Tránh parse products của ~1000 đơn ngay lúc load (chặn first paint);
    // prebuild ở idle (orders-data-loader) lo cho lần search đầu tiên.
    const needsSearchIndex = !!searchTerm || hasNotesFilterActive;
    if (needsSearchIndex && (!searchIndexCache || searchIndexCache.length !== allOrdersData.length)) {
        buildSearchIndex();
    }

    filteredOrdersData = allOrdersData.filter(order => {
        const cached = searchIndexById.get(order.id);

        // ============================================
        // OPTIMIZED SEARCH FILTER
        // ============================================
        let matchesSearch = !searchTerm;
        if (searchTerm) {
            if (cached) {
                const normalizedSearchTerm = removeVietnameseTones(searchTerm);
                
                // Primary fields (always search)
                const matchOrderId = cached.orderId.includes(searchTerm);
                const matchCustomerName = cached.customerName.includes(normalizedSearchTerm);
                const matchPhone = searchPhoneDigits
                    ? (searchPhoneDigits.length >= 3 && cached.phoneDigits.includes(searchPhoneDigits))
                    : cached.phone.includes(searchTerm);
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

        // Bộ lọc "Thẻ tên bé" — DM 21, tên/lưu ý SP hoặc lưu ý đơn chứa "thẻ tên" / "thẻ"
        const matchesTheTenBe = !theTenBeFilterActive || orderHasTheTenBeProduct(order);

        // Bộ lọc "Có lưu ý" — cache.hasAnyNotes (O(1))
        const matchesHasNotes = !hasNotesFilterActive || (cached
            ? cached.hasAnyNotes
            : orderHasAnyNotesFallback(order));

        let matchesSendLaterUrgent = true;
        if (sendLaterUrgentFilterActive && sendLaterUrgentFilterIds) {
            matchesSendLaterUrgent = sendLaterUrgentFilterIds.has(Number(order.id));
        }

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
        // "Chờ gửi lại" (awaiting_reship) bản chất vẫn là đơn CHƯA GỬI → gộp vào bộ lọc
        // "Chưa gửi hàng" (pending) để không bị bỏ sót; badge cam vẫn phân biệt rõ.
        let matchesStatus;
        if (statusFilter === 'all') {
            matchesStatus = true;
        } else if (statusFilter === 'pending') {
            matchesStatus = normalizedStatus === 'pending' || normalizedStatus === 'awaiting_reship';
        } else {
            matchesStatus = normalizedStatus === statusFilter;
        }

        // Payment method filter (bank_transfer trong DB vẫn khớp bộ lọc "bank")
        const orderPaymentKey = orderPaymentApiKey(order.payment_method);
        const matchesPayment = paymentFilter === 'all' || orderPaymentKey === paymentFilter;

        const orderSourceKey = orderCustomerSourceFilterKey(order);
        const matchesCustomerSource = customerSourceFilter === 'all' || orderSourceKey === customerSourceFilter;

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
            // Với đã gửi / đang vận chuyển / đã giao: filter theo ngày GỬI (shipped_at_unix),
            // nhất quán với sort trong getOrderSortTimestampMs. Fallback về ngày tạo nếu chưa có.
            const isShippedGroup = statusFilter === 'shipped' || statusFilter === 'in_transit' || statusFilter === 'delivered';
            const shippedTs = isShippedGroup ? (order.shipped_at_unix || order.shipped_at || null) : null;
            const timestamp = shippedTs || order.created_at_unix || order.created_at || order.order_date;
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

        return matchesSearch && matchesPriority && matchesMissingSize && matchesTheTenBe && matchesHasNotes && matchesSendLaterUrgent && matchesStatus && matchesPayment && matchesCustomerSource && matchesCTV && matchesDate;
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

    if (typeof updateSendLaterUrgentBanner === 'function') {
        updateSendLaterUrgentBanner();
    }

    if (typeof updateQuickSelectDayChips === 'function') {
        updateQuickSelectDayChips();
    }

    if (typeof updateMissingSizeBadge === 'function') {
        updateMissingSizeBadge();
    }

    if (typeof updateTheTenBePanelBanner === 'function') {
        updateTheTenBePanelBanner();
    }
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

/** Key nguồn khách cho lọc — đơn thiếu field coi là Facebook (migration backfill). */
function orderCustomerSourceFilterKey(order) {
    const raw = order.customer_source ?? order.customerSource ?? '';
    if (typeof normalizeCustomerSourceClient === 'function') {
        return normalizeCustomerSourceClient(raw) || 'facebook';
    }
    const s = String(raw).toLowerCase().trim();
    return (s === 'zalo' || s === 'facebook' || s === 'tiktok') ? s : 'facebook';
}

function closeOrderFilterDropdownMenus(exceptId) {
    ['statusFilterMenu', 'paymentFilterMenu', 'customerSourceFilterMenu', 'ctvFilterMenu'].forEach((id) => {
        if (exceptId === id) return;
        document.getElementById(id)?.remove();
    });
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

    closeOrderFilterDropdownMenus('statusFilterMenu');

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
        { value: 'send_later', label: 'Gửi sau', color: 'sky' },
        { value: 'awaiting_reship', label: 'Chờ gửi lại', color: 'orange' }
    ];

    normalizeDesktopStatusFilterHidden();
    const currentValue = document.getElementById('statusFilter').value;
    const button = event.currentTarget;
    const wrap = button.parentElement;

    const menu = document.createElement('div');
    menu.id = 'statusFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[200px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = statuses.map(s => `
        <button 
            type="button"
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

    wrap.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!wrap.contains(e.target)) {
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

    // Đã gửi / gửi sau: tắt sort theo giá trị đơn (giữ sort ngày user đang chọn)
    if (value === 'shipped' || value === 'send_later') {
        amountSortOrder = 'none';
        if (typeof updateAmountSortIcon === 'function') updateAmountSortIcon();
    }

    // "Đã gửi hàng": mặc định đơn có thời gian gửi MỚI NHẤT lên đầu (giảm dần theo shipped_at_unix).
    // Các bộ lọc khác (chưa gửi/tất cả…): về mặc định cũ nhất trước để xử lý lần lượt.
    if (value === 'shipped') {
        dateSortOrder = 'desc';
        if (typeof updateDateSortIcon === 'function') updateDateSortIcon();
    } else if (value !== 'send_later') {
        dateSortOrder = 'asc';
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

    closeOrderFilterDropdownMenus('paymentFilterMenu');

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
    const wrap = button.parentElement;

    const menu = document.createElement('div');
    menu.id = 'paymentFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[220px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = paymentMethods.map(p => `
        <button 
            type="button"
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

    wrap.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!wrap.contains(e.target)) {
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
// CUSTOMER SOURCE FILTER
// ============================================

function toggleCustomerSourceFilter(event) {
    event.stopPropagation();

    closeOrderFilterDropdownMenus('customerSourceFilterMenu');

    const existingMenu = document.getElementById('customerSourceFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const currentValue = document.getElementById('customerSourceFilter').value;
    const button = event.currentTarget;
    const wrap = button.parentElement;

    const countBySource = { facebook: 0, zalo: 0, tiktok: 0 };
    allOrdersData.forEach((o) => {
        const key = orderCustomerSourceFilterKey(o);
        if (countBySource[key] != null) countBySource[key]++;
    });
    const totalOrders = allOrdersData.length;

    const sources = [
        { value: 'all', label: 'Tất cả nguồn', color: 'gray', count: totalOrders },
        { value: 'facebook', label: 'Facebook', color: 'blue', count: countBySource.facebook },
        { value: 'zalo', label: 'Zalo', color: 'green', count: countBySource.zalo },
        { value: 'tiktok', label: 'TikTok', color: 'slate', count: countBySource.tiktok }
    ];

    const menu = document.createElement('div');
    menu.id = 'customerSourceFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[240px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = sources.map((s) => `
        <button
            type="button"
            onclick="selectCustomerSourceFilter('${s.value}', '${s.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${s.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-sm text-gray-700 flex-1">${s.label}</span>
            <span class="text-xs text-gray-400 font-medium tabular-nums">${s.count}</span>
            ${s.value === currentValue ? `
                <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    wrap.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!wrap.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

function selectCustomerSourceFilter(value, label) {
    document.getElementById('customerSourceFilter').value = value;
    document.getElementById('customerSourceFilterLabel').textContent = label;
    document.getElementById('customerSourceFilterMenu')?.remove();
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

    closeOrderFilterDropdownMenus('ctvFilterMenu');

    // Close if already open
    const existingMenu = document.getElementById('ctvFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const button = event.currentTarget;
    const wrap = button.parentElement;
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
            type="button"
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

    wrap.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!wrap.contains(e.target)) {
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
/**
 * Cập nhật badge số lượng đơn "Chưa có size" trên nút lọc.
 * Đếm theo computeOrdersWithMissingSize() (đơn pending có ≥1 SP thiếu cân/size) — đồng bộ với bộ lọc.
 * Nhẹ: 1 lượt quét allOrdersData; ẩn badge khi = 0.
 */
function updateMissingSizeBadge() {
    const el = document.getElementById('missingSizeCountBadge');
    if (!el) return;
    let count = 0;
    try {
        if (typeof computeOrdersWithMissingSize === 'function') {
            count = computeOrdersWithMissingSize().length;
        }
    } catch (e) { count = 0; }
    if (count > 0) {
        el.textContent = count > 99 ? '99+' : String(count);
        el.style.display = 'inline-flex';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

function _setMissingSizeFilterUI(active) {
    const button = document.getElementById('missingSizeFilterBtn');
    if (!button) return;
    const icon = button.querySelector('svg');

    if (active) {
        button.classList.remove('border-gray-300', 'hover:bg-amber-50', 'hover:border-amber-300');
        button.classList.add('bg-amber-50', 'border-amber-500', 'ring-1', 'ring-amber-200');
        icon?.classList.remove('text-gray-500');
        icon?.classList.add('text-amber-600');
    } else {
        button.classList.remove('bg-amber-50', 'border-amber-500', 'ring-1', 'ring-amber-200');
        button.classList.add('border-gray-300', 'hover:bg-amber-50', 'hover:border-amber-300');
        icon?.classList.remove('text-amber-600');
        icon?.classList.add('text-gray-500');
    }
}

function setSendLaterUrgentChipUI(active) {
    const btn = document.getElementById('sendLaterUrgentEyeBtn');
    if (!btn) return;
    btn.classList.toggle('ring-2', active);
    btn.classList.toggle('ring-amber-500', active);
    btn.classList.toggle('shadow-md', active);
    btn.classList.toggle('bg-amber-100', active);
}

function clearSendLaterUrgentTableFilter() {
    sendLaterUrgentFilterActive = false;
    sendLaterUrgentFilterIds = null;
    setSendLaterUrgentChipUI(false);
}

function _clearSearchForNotificationFilter() {
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    document.getElementById('searchInputClearBtn')?.classList.add('hidden');

    const statusH = document.getElementById('statusFilter');
    const statusLb = document.getElementById('statusFilterLabel');
    if (statusH) statusH.value = 'all';
    if (statusLb) statusLb.textContent = 'Tất cả trạng thái';

    _resetDateFilterToAll();
}

function _resetDateFilterToAll() {
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter && dateFilter.value !== 'all') {
        dateFilter.value = 'all';
        document.getElementById('customDateStart').value = '';
        document.getElementById('customDateEnd').value = '';
        const customLabel = document.getElementById('customDateLabel');
        if (customLabel) customLabel.textContent = 'Chọn ngày';
        document.querySelectorAll('.date-preset-btn').forEach((btn) => btn.classList.remove('active'));
        document.querySelector('.date-preset-btn[onclick*="\'all\'"]')?.classList.add('active');
    }
}

function scrollToOrdersTable() {
    requestAnimationFrame(() => {
        const section = document.getElementById('ordersTableSection');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

function toggleMissingSizeFilter() {
    missingSizeFilterActive = !missingSizeFilterActive;
    _setMissingSizeFilterUI(missingSizeFilterActive);
    if (missingSizeFilterActive) {
        clearSendLaterUrgentTableFilter();
    }
    filterOrdersData();
}

/**
 * Chỉ đơn có ghi chú đơn hàng hoặc ghi chú ít nhất một dòng sản phẩm
 */
function toggleHasNotesFilter() {
    const button = document.getElementById('hasNotesFilterBtn');
    if (!button) return;
    const icon = button.querySelector('svg');
    const label = button.querySelector('span');

    hasNotesFilterActive = !hasNotesFilterActive;

    if (hasNotesFilterActive) {
        button.classList.remove('border-gray-300', 'hover:bg-indigo-50', 'hover:border-indigo-300');
        button.classList.add('bg-indigo-50', 'border-indigo-500', 'ring-1', 'ring-indigo-200');
        icon.classList.remove('text-gray-500');
        icon.classList.add('text-indigo-600');
        label.classList.remove('text-gray-700');
        label.classList.add('text-indigo-700', 'font-semibold');
    } else {
        button.classList.remove('bg-indigo-50', 'border-indigo-500', 'ring-1', 'ring-indigo-200');
        button.classList.add('border-gray-300', 'hover:bg-indigo-50', 'hover:border-indigo-300');
        icon.classList.remove('text-indigo-600');
        icon.classList.add('text-gray-500');
        label.classList.remove('text-indigo-700', 'font-semibold');
        label.classList.add('text-gray-700');
    }

    filterOrdersData();
}

function toggleTheTenBeFilter() {
    const button = document.getElementById('theTenBeFilterBtn');
    if (!button) return;

    invalidateCategory21Cache();

    theTenBeFilterActive = !theTenBeFilterActive;

    if (typeof _setTheTenBeFilterUI === 'function') {
        _setTheTenBeFilterUI(theTenBeFilterActive);
    } else {
        const icon = button.querySelector('svg');
        const span = button.querySelector('span');
        if (theTenBeFilterActive) {
            button.classList.remove('border-gray-300', 'hover:bg-pink-50', 'hover:border-pink-300');
            button.classList.add('bg-pink-50', 'border-pink-500', 'ring-1', 'ring-pink-200');
            icon?.classList.remove('text-gray-500');
            icon?.classList.add('text-pink-600');
            span?.classList.remove('text-gray-700');
            span?.classList.add('text-pink-700', 'font-semibold');
        } else {
            button.classList.remove('bg-pink-50', 'border-pink-500', 'ring-1', 'ring-pink-200');
            button.classList.add('border-gray-300', 'hover:bg-pink-50', 'hover:border-pink-300');
            icon?.classList.remove('text-pink-600');
            icon?.classList.add('text-gray-500');
            span?.classList.remove('text-pink-700', 'font-semibold');
            span?.classList.add('text-gray-700');
        }
    }

    filterOrdersData();
}
