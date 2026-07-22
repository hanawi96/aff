// Orders Dashboard JavaScript
// All constants, utilities, and core functions have been extracted to separate modules
// This file now only contains functions that haven't been modularized yet

// Global data arrays
let allOrdersData = [];
let filteredOrdersData = [];
let selectedOrderIds = new Set();
let currentPage = 1;

/** Lưu preference số đơn/trang (admin đơn hàng) */
const ORDERS_PAGE_SIZE_STORAGE_KEY = 'admin_orders_items_per_page_v3';
/** Khóa v2 — migrate một lần sang v3 */
const ORDERS_PAGE_SIZE_V2_KEY = 'admin_orders_items_per_page_v2';
/** Khóa rất cũ */
const ORDERS_PAGE_SIZE_LEGACY_KEY = 'admin_orders_items_per_page';
const ORDERS_PAGE_SIZE_DEFAULT = 30;
/** Các mức hợp lệ — đồng bộ với orders-pagination.js */
const ORDERS_PAGE_SIZE_OPTIONS = Object.freeze([10, 15, 20, 30, 50, 100]);

function migrateOrdersPageSizeToV3(n) {
    // 10 = mặc định cũ; 100 = thường chọn tối đa — đưa về mặc định mới 30 đơn/trang
    if (n === 10 || n === 100) return ORDERS_PAGE_SIZE_DEFAULT;
    return n;
}

function readSavedOrdersPageSize() {
    try {
        const rawV3 = localStorage.getItem(ORDERS_PAGE_SIZE_STORAGE_KEY);
        if (rawV3 != null && rawV3 !== '') {
            const n = parseInt(rawV3, 10);
            if (Number.isFinite(n) && ORDERS_PAGE_SIZE_OPTIONS.includes(n)) return n;
        }
        const rawV2 = localStorage.getItem(ORDERS_PAGE_SIZE_V2_KEY);
        if (rawV2 != null && rawV2 !== '') {
            const n = parseInt(rawV2, 10);
            if (Number.isFinite(n) && ORDERS_PAGE_SIZE_OPTIONS.includes(n)) {
                const migrated = migrateOrdersPageSizeToV3(n);
                localStorage.setItem(ORDERS_PAGE_SIZE_STORAGE_KEY, String(migrated));
                localStorage.removeItem(ORDERS_PAGE_SIZE_V2_KEY);
                return migrated;
            }
        }
        const rawLegacy = localStorage.getItem(ORDERS_PAGE_SIZE_LEGACY_KEY);
        if (rawLegacy != null && rawLegacy !== '') {
            const n = parseInt(rawLegacy, 10);
            if (Number.isFinite(n) && ORDERS_PAGE_SIZE_OPTIONS.includes(n)) {
                const migrated = migrateOrdersPageSizeToV3(n);
                localStorage.setItem(ORDERS_PAGE_SIZE_STORAGE_KEY, String(migrated));
                localStorage.removeItem(ORDERS_PAGE_SIZE_LEGACY_KEY);
                return migrated;
            }
        }
    } catch (e) { /* ignore */ }
    return ORDERS_PAGE_SIZE_DEFAULT;
}

let itemsPerPage = readSavedOrdersPageSize();

/**
 * Đổi số đơn hiển thị mỗi trang (gọi từ select phân trang).
 * @param {string|number} value
 */
function setOrdersItemsPerPage(value) {
    const v = parseInt(value, 10);
    if (!ORDERS_PAGE_SIZE_OPTIONS.includes(v) || v === itemsPerPage) return;
    itemsPerPage = v;
    try {
        localStorage.setItem(ORDERS_PAGE_SIZE_STORAGE_KEY, String(v));
        localStorage.removeItem(ORDERS_PAGE_SIZE_V2_KEY);
        localStorage.removeItem(ORDERS_PAGE_SIZE_LEGACY_KEY);
    } catch (e) { /* ignore quota / private mode */ }
    const totalPages = Math.max(1, Math.ceil(filteredOrdersData.length / itemsPerPage) || 1);
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    renderOrdersTable();
}
let dateSortOrder = 'asc';
let amountSortOrder = 'none';
let packagingConfig = [];

// Product and order management variables
let allProductsList = [];
let allCategoriesList = [];
let allDiscountsList = [];
let currentOrderProducts = [];
let currentOrderNotes = '';
let selectedCategory = null;
let selectedProducts = [];
let currentEditingOrderId = null;
let currentEditingOrderCode = null;
let currentEditingProductIndex = null; // null = add mode, number = replace mode (đơn đã lưu)
let currentEditingLocalProductIndex = null; // null = add mode, number = thay thế SP trong đơn đang soạn (currentOrderProducts)

// Load packaging config from database





// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    setupEventListeners();
    checkUrlHash();

    void (async () => {
        // Catalog SP phải có trước khi vẽ badge "Chưa có size" (tra DM theo tên SP).
        if (typeof hydrateProductsCatalogFromCache === 'function') {
            await hydrateProductsCatalogFromCache();
        }
        if (typeof isOrderCatalogReadyForMissingSizeCheck === 'function'
            && !isOrderCatalogReadyForMissingSizeCheck()
            && typeof loadProductsAndCategories === 'function') {
            await loadProductsAndCategories();
        } else if (typeof loadProductsAndCategories === 'function') {
            void loadProductsAndCategories();
        }
        void loadOrdersData();
    })();

    // Song song ngay từ đầu (trước đây trễ 800ms): giảm tổng thời gian tới khi modal/thêm đơn có đủ dữ liệu.
    void loadCurrentTaxRate();
    void loadPackagingConfig();
    void updateExportHistoryBadge();
    if (allDiscountsList.length === 0 && typeof loadActiveDiscounts === 'function') void loadActiveDiscounts();

    // Hoãn tải dữ liệu địa chỉ (tree_2.json ~615KB) tới lúc rảnh: không tranh
    // băng thông/CPU với fetch đơn hàng + parse bundle ở first paint.
    // Bảng vẫn hiện địa chỉ qua fallback (cột DB) trước; khi tree sẵn sàng thì
    // vẽ lại 1 lần để nâng cấp hiển thị. Modal thêm đơn tự init độc lập khi mở.
    if (window.addressSelector && !window.addressSelector.loaded) {
        const _loadAddressTree = () => {
            window.addressSelector.init()
                .then(() => {
                    if (Array.isArray(filteredOrdersData) && filteredOrdersData.length > 0
                        && typeof renderOrdersTable === 'function') {
                        renderOrdersTable({ skipRowAnimation: true });
                    }
                })
                .catch(() => { /* giữ fallback địa chỉ */ });
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(_loadAddressTree, { timeout: 3000 });
        } else {
            setTimeout(_loadAddressTree, 1200);
        }
    }

    setInterval(updateExportHistoryBadge, 30000);
});







// Load orders data from API












































// Copy SPX format










































































// Save customer info








// Save address











// Save amount








// Delete order








// ============================================
// ADD ORDER MODAL
// ============================================
// Variables declared at top of file

// Show add order modal (same UI for tạo mới / nhân bản / sửa toàn bộ)
async function showAddOrderModal(duplicateData = null, formOptions = null) {
    const isEdit = formOptions?.mode === 'edit' && Number(formOptions.editOrderDbId) > 0;
    const isDuplicate = formOptions?.mode === 'duplicate';

    if (typeof resetDeskAddressMode === 'function') {
        resetDeskAddressMode();
    }

    // Restore draft for fresh "add" mode
    if (!duplicateData && !isEdit) {
        const draft = _loadOrderDraft();
        if (draft) {
            duplicateData = draft;
            setTimeout(() => showToast('Đã khôi phục dữ liệu từ lần nhập trước', 'info'), 500);
        }
    }

    if (!duplicateData && !isEdit) {
        window.history.pushState(null, '', '#add-order');
    } else if (isEdit) {
        window.history.pushState(null, '', `#edit-order-${formOptions.editOrderDbId}`);
    }
    
    // Only fetch if not already loaded (data is preloaded at DOMContentLoaded)
    if (packagingConfig.length === 0) {
        await loadPackagingConfig();
    }
    
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
    const customerName = duplicateData?.customer_name || '';
    const customerPhone = duplicateData?.customer_phone || '';
    const address = duplicateData?.address || '';
    const referralCode = duplicateData?.referral_code != null ? duplicateData.referral_code : '';
    const paymentMethod = orderPaymentApiKey(duplicateData?.payment_method || 'cod');
    const depositSeed = getOrderDepositAmount(duplicateData);
    const showDepositPanel = paymentMethod !== 'bank' && depositSeed > 0;
    const depositWrapClass = showDepositPanel ? '' : 'hidden';
    const depositInputValue = paymentMethod === 'bank' ? '' : (depositSeed > 0 ? String(depositSeed) : '');
    const codBtnActive = paymentMethod === 'cod' && !showDepositPanel;
    const bankBtnActive = paymentMethod === 'bank';
    const depositBtnActive = showDepositPanel;
    const orderNotesSeed = duplicateData?.notes || '';
    const orderStatusSeed = duplicateData?.status || 'pending';
    const sendLaterRevertStatus =
        !isEdit && duplicateData
            ? 'pending'
            : (orderStatusSeed === 'send_later' ? 'pending' : orderStatusSeed);

    // Get customer shipping fee from cost_config
    let shippingFee = duplicateData?.shipping_fee;
    if (shippingFee === undefined) {
        // Find item with item_name = 'customer_shipping_fee'
        const customerShippingFeeItem = packagingConfig.find(item => item.item_name === 'customer_shipping_fee');
        shippingFee = customerShippingFeeItem ? customerShippingFeeItem.item_cost : 30000;
    }

    // Get shipping cost from cost_config
    let shippingCost = duplicateData?.shipping_cost;
    if (shippingCost === undefined) {
        // Find item with item_name = 'default_shipping_cost'
        const shippingCostItem = packagingConfig.find(item => item.item_name === 'default_shipping_cost');
        shippingCost = shippingCostItem ? shippingCostItem.item_cost : 25000;
    }

    // PERFORMANCE FIX: Pre-calculate summary to avoid layout shift
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        const qty = parseInt(p.quantity) || 1;
        return sum + (price * qty);
    }, 0);
    const totalRevenue = productTotal + shippingFee;
    const initialCodAmount = isOrderBankPayment(paymentMethod)
        ? 0
        : Math.max(0, totalRevenue - depositSeed);
    const initialSummary = {
        productTotal: productTotal,
        shippingFee: shippingFee,
        totalRevenue: totalRevenue,
        codCollect: initialCodAmount,
        deposit: depositSeed,
        productCount: currentOrderProducts.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0)
    };

    document.getElementById('addOrderModal')?.remove();

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
                            <h2 class="text-2xl font-bold text-white">${isEdit ? 'Sửa đơn hàng' + (duplicateData?.order_display_id ? ' · ' + escapeHtml(duplicateData.order_display_id) : '') : duplicateData ? 'Nhân bản đơn hàng' : 'Thêm đơn hàng mới'}</h2>
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
            <div class="flex-1 overflow-y-auto p-6">
                <input type="hidden" id="orderFormEditDbId" value="${isEdit ? String(formOptions.editOrderDbId) : ''}" />
                <input type="hidden" id="orderFormEditDisplayId" value="${isEdit && duplicateData?.order_display_id ? String(duplicateData.order_display_id) : ''}" />
                <input type="hidden" id="orderFormIsDuplicate" value="${isDuplicate ? '1' : ''}" />
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <!-- Left: Order Info (2 cols) -->
                    <div class="lg:col-span-2 space-y-3">
                        <h3 class="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Thông tin đơn hàng
                        </h3>

                        <!-- Smart Paste Textarea -->
                        <div id="deskSmartPasteBlock" class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border-2 border-dashed border-purple-300 mb-4">
                            <div class="flex items-start gap-3 mb-2">
                                <div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-sm font-bold text-gray-900 mb-1">🚀 Dán nhanh thông tin khách hàng</h4>
                                    <p class="text-xs text-gray-600">Dán toàn bộ thông tin (Địa chỉ, SĐT, Tên) — hệ thống tự phân tích ngay</p>
                                </div>
                            </div>
                            <textarea 
                                id="smartPasteInput" 
                                placeholder="Ví dụ:&#10;198/8 nguyễn bỉnh khiêm, phường vĩnh quang, tp Rạch Giá, kiên giang&#10;0765322529&#10;Huyền"
                                class="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                rows="3"
                            ></textarea>
                            <p id="smartPasteStatus" class="text-xs mt-1.5 hidden" aria-live="polite"></p>
                            <!-- Error message container -->
                            <p id="smartPasteError" class="text-xs text-red-500 mt-1 hidden">Vui lòng dán thông tin khách hàng vào ô trên</p>
                            <button 
                                type="button"
                                id="smartPasteBtn"
                                onclick="handleSmartPaste()"
                                class="mt-2 w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm flex items-center justify-center gap-2"
                            >
                                <svg id="smartPasteIcon" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span id="smartPasteBtnText">Phân tích lại</span>
                            </button>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại <span class="text-red-500">*</span></label>
                            <input type="tel" id="newOrderCustomerPhone" inputmode="numeric" value="${escapeHtml(customerPhone)}" placeholder="0123456789" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
                            <div id="customerStatusHint" class="mt-1.5 text-xs hidden"></div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên khách hàng <span class="text-red-500">*</span></label>
                            <input type="text" id="newOrderCustomerName" value="${escapeHtml(customerName)}" placeholder="Nhập tên khách hàng" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        </div>

                        <!-- Địa chỉ giao hàng 2 cấp — combobox tìm kiếm -->
                        <div id="deskAddressFormBlock" class="bg-blue-50 rounded-lg p-3 space-y-2">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <label class="block text-sm font-semibold text-gray-800">Địa chỉ giao hàng <span class="text-red-500">*</span></label>
                                <div id="deskLegacyConvertRoot" class="shrink-0">
                                    <button
                                        type="button"
                                        id="deskLegacyConvertToggle"
                                        class="desk-legacy-convert-toggle"
                                        aria-expanded="false"
                                        aria-controls="deskLegacyConvertPanel"
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>
                                        </svg>
                                        <span>Chuyển đổi địa chỉ</span>
                                        <svg data-desk-legacy-chevron fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div id="deskLegacyConvertPanel" class="desk-legacy-convert-panel hidden space-y-2.5">
                                <div>
                                    <p class="text-[11px] font-bold uppercase tracking-wide text-slate-600">Địa chỉ cũ → mới</p>
                                    <p class="text-[11px] text-slate-400 leading-snug">Tìm nhanh hoặc chọn tay — huyện/xã tự suy ra cấp trên</p>
                                </div>

                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 mb-1" for="deskLegacyQuickSearch">Tìm nhanh địa chỉ cũ</label>
                                    <div id="deskLegacyQuickSearchWrap" class="relative">
                                        <input
                                            type="text"
                                            id="deskLegacyQuickSearch"
                                            class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                                            placeholder="Gõ xã hoặc huyện cũ… (vd: Tráng Việt, Mê Linh)"
                                            autocomplete="off"
                                            spellcheck="false"
                                        >
                                        <div id="deskLegacyQuickResults" class="hidden absolute z-40 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"></div>
                                    </div>
                                </div>

                                <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    <span class="flex-1 h-px bg-slate-200"></span>
                                    <span>Hoặc chọn tay 3 cấp</span>
                                    <span class="flex-1 h-px bg-slate-200"></span>
                                </div>

                                <div class="grid grid-cols-3 gap-2 min-w-0">
                                    <div class="min-w-0 relative">
                                        <label class="block text-[11px] font-semibold text-slate-500 mb-1 truncate" for="deskLegacyProvinceBtn">Tỉnh / TP cũ</label>
                                        <button type="button" id="deskLegacyProvinceBtn" class="desk-legacy-field-btn w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-left hover:border-teal-400 transition-colors">
                                            <span id="deskLegacyProvinceText" class="truncate text-slate-700">Chọn tỉnh/TP cũ</span>
                                            <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
                                        </button>
                                        <div id="deskLegacyProvinceDropdown" class="hidden absolute z-30 left-0 top-full mt-1 w-[min(280px,70vw)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                                            <input type="text" id="deskLegacyProvinceSearch" class="w-full px-3 py-2 text-sm border-b border-slate-100 bg-slate-50 focus:outline-none" placeholder="Tìm tỉnh/TP..." autocomplete="off">
                                            <div class="px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-400 bg-slate-50 border-b border-slate-100">Tỉnh / TP (cũ)</div>
                                            <div id="deskLegacyProvinceList" class="max-h-52 overflow-y-auto"></div>
                                        </div>
                                    </div>
                                    <div class="min-w-0 relative">
                                        <label class="block text-[11px] font-semibold text-slate-500 mb-1 truncate" for="deskLegacyDistrictBtn">Quận / Huyện cũ</label>
                                        <button type="button" id="deskLegacyDistrictBtn" class="desk-legacy-field-btn w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-left hover:border-teal-400 transition-colors">
                                            <span id="deskLegacyDistrictText" class="truncate text-slate-700">Chọn quận/huyện</span>
                                            <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
                                        </button>
                                        <div id="deskLegacyDistrictDropdown" class="hidden absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 w-[min(300px,75vw)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                                            <input type="text" id="deskLegacyDistrictSearch" class="w-full px-3 py-2 text-sm border-b border-slate-100 bg-slate-50 focus:outline-none" placeholder="Tìm quận/huyện..." autocomplete="off">
                                            <div class="px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-400 bg-slate-50 border-b border-slate-100">Quận / Huyện (cũ)</div>
                                            <div id="deskLegacyDistrictList" class="max-h-52 overflow-y-auto"></div>
                                        </div>
                                    </div>
                                    <div class="min-w-0 relative">
                                        <label class="block text-[11px] font-semibold text-slate-500 mb-1 truncate" for="deskLegacyWardBtn">Phường / Xã cũ</label>
                                        <button type="button" id="deskLegacyWardBtn" class="desk-legacy-field-btn w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-left hover:border-teal-400 transition-colors">
                                            <span id="deskLegacyWardText" class="truncate text-slate-700">Chọn phường/xã</span>
                                            <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
                                        </button>
                                        <div id="deskLegacyWardDropdown" class="hidden absolute z-30 right-0 left-auto top-full mt-1 w-[min(300px,75vw)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                                            <input type="text" id="deskLegacyWardSearch" class="w-full px-3 py-2 text-sm border-b border-slate-100 bg-slate-50 focus:outline-none" placeholder="Gõ tìm phường/xã..." autocomplete="off">
                                            <div id="deskLegacyWardListHeader" class="px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-400 bg-slate-50 border-b border-slate-100">Phường / Xã (cũ)</div>
                                            <div id="deskLegacyWardList" class="max-h-52 overflow-y-auto"></div>
                                        </div>
                                    </div>
                                </div>

                                <button type="button" id="deskLegacyConvertApply" disabled class="desk-legacy-convert-apply">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                                    <span>Áp dụng vào địa chỉ 2 cấp</span>
                                </button>
                                <p id="deskLegacyConvertStatus" class="hidden text-xs leading-snug" role="status"></p>
                            </div>

                            <div id="deskLegacyAddressBlock" class="hidden space-y-2"></div>

                            <div id="deskAddressSelectorWrap" class="space-y-2">
                                <div id="deskAddressCombobox"></div>

                                <select id="newOrderProvince" class="sr-only" tabindex="-1" aria-hidden="true">
                                    <option value="">-- Chọn Tỉnh/Thành phố --</option>
                                </select>
                                <select id="newOrderWard" disabled class="sr-only" tabindex="-1" aria-hidden="true">
                                    <option value="">-- Chọn Phường/Xã --</option>
                                </select>

                                <div id="newOrderStreetAddressWrap" class="hidden">
                                    <input type="text" id="newOrderStreetAddress" placeholder="Số nhà, tên đường" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>

                                <p id="newOrderAddressPreview" class="mt-1 text-sm text-green-600 hidden"></p>
                            </div>

                            <input type="hidden" id="newOrderAddress" value="${escapeHtml(address)}" />
                        </div>

                        <div class="payment-method-block">
                            <div class="payment-method-head">
                                <span class="payment-method-title">Thanh toán</span>
                            </div>
                            <input type="hidden" id="newOrderPaymentMethod" value="${paymentMethod || 'cod'}" />
                            <div class="payment-method-chips" role="group" aria-label="Chọn hình thức thanh toán">
                                <button type="button" onclick="selectPaymentMethodDirect('cod')" id="paymentBtn_cod" class="payment-method-chip payment-pm-btn payment-method-chip--cod ${codBtnActive ? 'active' : ''}" aria-pressed="${codBtnActive ? 'true' : 'false'}">
                                    <svg class="payment-method-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>COD</span>
                                </button>
                                <button type="button" onclick="selectPaymentMethodDirect('bank')" id="paymentBtn_bank" class="payment-method-chip payment-pm-btn payment-method-chip--bank ${bankBtnActive ? 'active' : ''}" aria-pressed="${bankBtnActive ? 'true' : 'false'}">
                                    <svg class="payment-method-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Đã CK</span>
                                </button>
                                <button type="button" onclick="selectPaymentMethodDirect('deposit')" id="paymentBtn_deposit" class="payment-method-chip payment-deposit-btn payment-method-chip--deposit ${depositBtnActive ? 'active' : ''}" aria-pressed="${depositBtnActive ? 'true' : 'false'}">
                                    <svg class="payment-method-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Cọc trước</span>
                                </button>
                            </div>
                            <div id="newOrderDepositWrap" class="mt-2 ${depositWrapClass}">
                                <label class="block text-xs font-medium text-gray-700 mb-1">Số tiền cọc</label>
                                <div id="newOrderDepositPresets" class="hidden mb-1.5"></div>
                                <div class="relative">
                                    <input type="number" id="newOrderDepositAmount" min="0" step="1000" value="${depositInputValue}"
                                        class="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                        oninput="updateOrderSummary()" placeholder="0" />
                                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">đ</span>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Khách đã chuyển/cọc trước — COD chỉ thu phần còn lại</p>
                            </div>
                        </div>

                        <div class="customer-source-block">
                            <div class="customer-source-head">
                                <span class="customer-source-title">Nguồn khách</span>
                                <span class="customer-source-optional text-red-500">Bắt buộc *</span>
                            </div>
                            <input type="hidden" id="newOrderCustomerSource" value="" />
                            <div class="customer-source-chips" role="group" aria-label="Chọn nguồn khách">
                                <button type="button" class="customer-source-chip customer-source-chip--zalo" data-source="zalo" aria-pressed="false" onclick="selectCustomerSource('zalo')">
                                    <span class="customer-source-dot customer-source-dot--zalo" aria-hidden="true"></span>
                                    <span>Zalo</span>
                                </button>
                                <button type="button" class="customer-source-chip customer-source-chip--facebook" data-source="facebook" aria-pressed="false" onclick="selectCustomerSource('facebook')">
                                    <svg class="customer-source-icon customer-source-icon--facebook" xmlns="http://www.w3.org/2000/svg" viewBox="4 -258 312 532" aria-hidden="true"><path d="M80 51v213h116V51h87l18-97H196v-35c0-52 20-72 73-72 16 0 29 1 37 2v-89c-15-4-50-8-70-8-107 0-156 51-156 159v43H14v97h66z" fill="currentColor"/></svg>
                                    <span>Facebook</span>
                                </button>
                                <button type="button" class="customer-source-chip customer-source-chip--tiktok" data-source="tiktok" aria-pressed="false" onclick="selectCustomerSource('tiktok')">
                                    <svg class="customer-source-icon customer-source-icon--tiktok" xmlns="http://www.w3.org/2000/svg" viewBox="-12 -258 471 535" aria-hidden="true"><path d="M449-38c-44 0-87-14-123-39v178c0 34-10 66-29 93s-46 48-77 60c-31 11-65 13-97 5s-61-26-82-51c-22-25-36-56-39-89-4-33 2-66 18-95s40-53 70-68c29-15 63-20 95-16v90c-15-4-31-4-46 1-14 5-27 14-37 27-9 13-14 28-13 44 0 16 5 31 14 44 9 12 22 22 37 26 15 5 32 5 46 0 15-5 28-14 38-27 9-12 14-28 14-44v-349h88c0 7 0 15 2 22 3 17 9 32 18 46 10 14 22 26 36 35 20 13 43 20 67 20v87z" fill="currentColor"/></svg>
                                    <span>TikTok</span>
                                </button>
                            </div>
                        </div>

                        <!-- Priority Checkbox -->
                        <div class="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="newOrderPriority" class="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500" ${duplicateData != null && Number(duplicateData.is_priority) === 1 ? 'checked' : ''} />
                                <span class="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                                    <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    Đánh dấu đơn ưu tiên
                                </span>
                            </label>
                            <p class="text-xs text-gray-600 mt-1.5 ml-6">Đơn ưu tiên sẽ hiển thị đầu tiên trong danh sách</p>
                        </div>

                        <div class="bg-sky-50 rounded-lg p-3 border border-sky-200">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="newOrderSendLater" class="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500" onchange="toggleNewOrderSendLater()" ${duplicateData && duplicateData.status === 'send_later' ? 'checked' : ''} />
                                <span class="text-sm font-medium text-gray-800">Gửi sau</span>
                            </label>
                            <p class="text-xs text-gray-600 mt-1.5 ml-6">Đơn vào trạng thái «Gửi sau», có ngày dự kiến gửi — chưa tính là đã gửi hàng.</p>
                            <div id="newOrderSendLaterWrap" class="mt-2 space-y-1.5 ${duplicateData && duplicateData.status === 'send_later' ? '' : 'hidden'}">
                                <label class="block text-xs font-medium text-gray-700">Ngày giờ dự kiến gửi <span class="text-red-500">*</span></label>
                                <input type="datetime-local" id="newOrderPlannedSendAt" class="w-full px-3 py-2 text-sm border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white" />
                            </div>
                        </div>

                        <input type="hidden" id="newOrderStatus" value="${escapeHtml(orderStatusSeed)}" data-revert-status="${escapeHtml(sendLaterRevertStatus)}" />

                        <style>
                            .customer-source-block,
                            .payment-method-block {
                                border-radius: 0.5rem;
                                padding: 0.75rem;
                                border: 1px solid #e9d5ff;
                                background: linear-gradient(135deg, #faf5ff 0%, #f8fafc 100%);
                            }
                            .customer-source-head,
                            .payment-method-head {
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                gap: 0.5rem;
                                margin-bottom: 0.5rem;
                            }
                            .customer-source-title,
                            .payment-method-title {
                                font-size: 0.8125rem;
                                font-weight: 600;
                                color: #374151;
                            }
                            .customer-source-optional {
                                font-size: 0.6875rem;
                                font-weight: 500;
                                color: #9ca3af;
                            }
                            .customer-source-chips,
                            .payment-method-chips {
                                display: grid;
                                grid-template-columns: repeat(3, 1fr);
                                gap: 0.375rem;
                            }
                            .customer-source-chip,
                            .payment-method-chip {
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                gap: 0.375rem;
                                padding: 0.4375rem 0.375rem;
                                border: 1.5px solid #e5e7eb;
                                border-radius: 0.5rem;
                                background: #fff;
                                font-size: 0.75rem;
                                font-weight: 600;
                                color: #4b5563;
                                cursor: pointer;
                                transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, color 0.15s;
                                white-space: nowrap;
                            }
                            .customer-source-chip:hover:not(.active),
                            .payment-method-chip:hover:not(.active) {
                                border-color: #d8b4fe;
                                background: #fdf4ff;
                                color: #6b7280;
                            }
                            .payment-method-icon {
                                flex-shrink: 0;
                                display: block;
                                width: 0.875rem;
                                height: 0.875rem;
                            }
                            .payment-method-chip--cod.active {
                                border-color: #2563eb;
                                background: #2563eb;
                                color: #ffffff;
                                font-weight: 700;
                                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
                            }
                            .payment-method-chip--cod.active .payment-method-icon {
                                color: #ffffff;
                            }
                            .payment-method-chip--bank.active {
                                border-color: #16a34a;
                                background: #16a34a;
                                color: #ffffff;
                                font-weight: 700;
                                box-shadow: 0 2px 8px rgba(22, 163, 74, 0.35);
                            }
                            .payment-method-chip--bank.active .payment-method-icon {
                                color: #ffffff;
                            }
                            .payment-method-chip--deposit.active {
                                border-color: #ea580c;
                                background: #ea580c;
                                color: #ffffff;
                                font-weight: 700;
                                box-shadow: 0 2px 8px rgba(234, 88, 12, 0.35);
                            }
                            .payment-method-chip--deposit.active .payment-method-icon {
                                color: #ffffff;
                            }
                            .customer-source-block--error {
                                border-color: #f87171 !important;
                                box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.25);
                            }
                            @keyframes customerSourceShake {
                                0%, 100% { transform: translateX(0); }
                                25% { transform: translateX(-4px); }
                                75% { transform: translateX(4px); }
                            }
                            .customer-source-block--shake {
                                animation: customerSourceShake 0.35s ease;
                            }
                            .customer-source-dot {
                                width: 0.4375rem;
                                height: 0.4375rem;
                                border-radius: 9999px;
                                flex-shrink: 0;
                                transition: background 0.15s;
                            }
                            .customer-source-icon {
                                flex-shrink: 0;
                                display: block;
                                width: auto;
                                height: 0.8125rem;
                            }
                            .customer-source-dot--zalo { background: #22c55e; }
                            .customer-source-icon--facebook { color: #1e3050; }
                            .customer-source-icon--tiktok { color: #1e3050; }
                            .customer-source-chip--zalo.active {
                                border-color: #16a34a;
                                background: #16a34a;
                                color: #ffffff;
                                font-weight: 700;
                                box-shadow: 0 2px 8px rgba(22, 163, 74, 0.35);
                            }
                            .customer-source-chip--zalo.active .customer-source-dot--zalo {
                                background: #ffffff;
                            }
                            .customer-source-chip--facebook.active {
                                border-color: #2563eb;
                                background: #2563eb;
                                color: #ffffff;
                                font-weight: 700;
                                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
                            }
                            .customer-source-chip--facebook.active .customer-source-icon--facebook {
                                color: #ffffff;
                            }
                            .customer-source-chip--tiktok.active {
                                border-color: #0f172a;
                                background: #0f172a;
                                color: #ffffff;
                                font-weight: 700;
                                box-shadow: 0 2px 8px rgba(15, 23, 42, 0.35);
                            }
                            .customer-source-chip--tiktok.active .customer-source-icon--tiktok {
                                color: #ffffff;
                            }
                        </style>

                        <!-- Shipping Costs (compact badges) -->
                        <div class="bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                            <div class="flex items-center justify-between gap-2 flex-wrap">
                                <div class="flex items-center gap-2 min-w-0 flex-wrap">
                                    <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                    </svg>
                                    <span class="text-xs font-bold text-gray-800">Phí vận chuyển</span>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="inline-flex items-center">
                                            <button type="button" id="shippingFeeBadgeBtn" onclick="startQuickEditShippingField('fee')"
                                                class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 border border-blue-200 text-blue-700 hover:bg-white hover:border-blue-300 transition-colors"
                                                title="Click để sửa phí ship khách trả">Khách: ${formatCurrency(shippingFee)}</button>
                                            <input type="text" id="shippingFeeBadgeInput" inputmode="numeric" autocomplete="off"
                                                class="hidden w-[5.5rem] px-1.5 py-0.5 text-[11px] font-semibold border border-blue-400 rounded focus:ring-1 focus:ring-blue-400 outline-none" />
                                        </span>
                                        <span class="inline-flex items-center">
                                            <button type="button" id="shippingCostBadgeBtn" onclick="startQuickEditShippingField('cost')"
                                                class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 transition-colors"
                                                title="Click để sửa chi phí ship thực tế">Vốn: ${formatCurrency(shippingCost)}</button>
                                            <input type="text" id="shippingCostBadgeInput" inputmode="numeric" autocomplete="off"
                                                class="hidden w-[5.5rem] px-1.5 py-0.5 text-[11px] font-semibold border border-slate-400 rounded focus:ring-1 focus:ring-slate-400 outline-none" />
                                        </span>
                                    </div>
                                </div>
                                <label class="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                                    <input type="checkbox" id="freeShippingCheckbox" class="w-3.5 h-3.5 text-green-600 border-gray-300 rounded focus:ring-green-500" onchange="toggleFreeShipping()" />
                                    <span class="text-[11px] font-semibold text-green-700">Miễn phí ship</span>
                                </label>
                            </div>
                            <input type="hidden" id="newOrderShippingFee" value="${shippingFee}" />
                            <input type="hidden" id="newOrderShippingCost" value="${shippingCost}" />
                        </div>

                        <!-- Discount — Ưu đãi & giảm giá -->
                        <div class="bg-violet-50/90 rounded-xl px-3 py-2.5 border border-violet-200/80">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 flex-shrink-0">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                    </svg>
                                </span>
                                <h4 class="text-sm font-bold text-violet-900">Ưu đãi & giảm giá</h4>
                            </div>

                            <div class="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    id="newOrderDiscountCode"
                                    placeholder="Nhập mã giảm giá"
                                    class="flex-1 min-w-0 px-3 py-1.5 text-sm bg-white border border-violet-200/80 rounded-lg focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 uppercase font-medium placeholder:normal-case placeholder:font-normal"
                                    oninput="this.value = this.value.toUpperCase()"
                                />
                                <button
                                    type="button"
                                    onclick="applyDiscountCode()"
                                    class="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                                >
                                    Áp dụng
                                </button>
                            </div>

                            <div class="flex items-center justify-between gap-2 flex-wrap">
                                <div class="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                                    <div id="deskDiscQuickBadges" class="flex items-center gap-1.5 flex-wrap"></div>
                                    <button
                                        type="button"
                                        onclick="openDesktopDiscountSheet(event, 'manual')"
                                        class="inline-flex items-center gap-0.5 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors whitespace-nowrap"
                                    >
                                        Thêm tùy chọn
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onclick="openDesktopDiscountSheet(event, 'codes')"
                                    class="text-xs font-medium text-gray-500 hover:text-violet-700 transition-colors whitespace-nowrap flex-shrink-0"
                                >
                                    Danh sách mã
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
                            <input type="hidden" id="appliedDiscountSource" value="" />
                            <input type="hidden" id="appliedDiscountManualKind" value="" />
                            <input type="hidden" id="appliedDiscountManualValue" value="" />
                            <input type="hidden" id="appliedDiscountRoundPay" value="0" />
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã CTV (tùy chọn)</label>
                            <div class="flex gap-2">
                                <input type="text" id="newOrderReferralCode" data-ctv-input value="${escapeHtml(referralCode)}" placeholder="Nhập mã hoặc chọn từ danh sách" class="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                <button type="button" onclick="openCTVPickerModal()" class="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap">
                                    Danh sách
                                </button>
                            </div>
                            <div id="ctvVerifyStatus"></div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                Ghi chú đơn hàng
                            </label>
                            <textarea id="newOrderNotes" rows="2" placeholder="VD: Giao giờ hành chính, gọi trước 15 phút..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none">${escapeHtml(orderNotesSeed)}</textarea>
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
                            <div class="grid grid-cols-2 gap-3 mb-4">
                                <button onclick="showProductSelectionModalForNewOrder()" class="px-4 py-2 bg-white hover:bg-purple-50 border-2 border-dashed border-purple-400 hover:border-purple-500 rounded-xl font-semibold text-purple-600 transition-all flex items-center justify-center gap-2">
                                    <div class="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                        <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <span>Thêm sản phẩm có sẵn</span>
                                </button>
                                <button onclick="showCustomProductModal()" class="px-4 py-2 bg-white hover:bg-blue-50 border-2 border-dashed border-blue-400 hover:border-blue-500 rounded-xl font-semibold text-blue-600 transition-all flex items-center justify-center gap-2">
                                    <div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                        <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    <span>Thêm sản phẩm tùy chỉnh</span>
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

                            <!-- Main Summary - Compact Design -->
                            <div class="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border-2 border-blue-200">
                                <!-- Doanh thu đơn hàng -->
                                <div class="mb-3">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="text-xs font-medium text-gray-600">Doanh thu đơn hàng</span>
                                        <span id="orderTotalAmount" class="text-2xl font-bold text-blue-600">${formatCurrency(initialSummary.totalRevenue)}</span>
                                    </div>
                                    <div class="flex justify-between items-center text-xs text-gray-500">
                                        <span>Sản phẩm + Ship</span>
                                        <span>
                                            <span id="orderProductTotal">${formatCurrency(initialSummary.productTotal)}</span>
                                            <span class="mx-1">+</span>
                                            <span id="orderShippingFee">${formatCurrency(initialSummary.shippingFee)}</span>
                                        </span>
                                    </div>
                                    <!-- Discount row -->
                                    <div id="orderDiscountRow" class="hidden flex justify-between items-center text-xs mt-1">
                                        <div class="flex items-center gap-1">
                                            <svg class="w-3 h-3 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            <span class="text-purple-600 font-medium">Giảm giá</span>
                                        </div>
                                        <span id="orderDiscountAmount" class="text-purple-600 font-semibold">-0đ</span>
                                    </div>
                                    <div id="orderDepositRow" class="${depositSeed > 0 && !isOrderBankPayment(paymentMethod) ? '' : 'hidden'} flex justify-between items-center text-xs mt-1">
                                        <span class="text-sky-700 font-medium">Đã cọc</span>
                                        <span id="orderDepositAmountDisplay" class="text-sky-700 font-semibold">${depositSeed > 0 ? formatCurrency(depositSeed) : '0đ'}</span>
                                    </div>
                                </div>
                                
                                <!-- Tiền COD (Thu hộ) -->
                                <div class="pt-3 border-t-2 border-blue-300">
                                    <div class="flex justify-between items-center">
                                        <div class="flex items-center gap-1.5">
                                            <svg class="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <span class="text-xs font-semibold text-gray-700">Tiền COD (Thu hộ)</span>
                                        </div>
                                        <span id="orderCODAmount" class="text-xl font-bold text-orange-600">${formatCurrency(initialSummary.codCollect)}</span>
                                    </div>
                                    <p id="orderCODNote" class="text-xs text-gray-500 mt-1 hidden">✓ Đã thanh toán qua chuyển khoản</p>
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
                                            <button onclick="event.stopPropagation(); document.getElementById('profitCostDetails').classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');" 
                                                class="text-gray-400 hover:text-blue-600 transition-all duration-200 p-0.5 rounded hover:bg-blue-50" 
                                                title="Xem chi tiết">
                                                <svg class="w-3.5 h-3.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                        <span id="profitTotalCosts" class="text-gray-600">0đ</span>
                                    </div>
                                    <div class="pl-6 space-y-1.5 hidden" id="profitCostDetails">
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span class="text-gray-400">• Đóng gói</span>
                                            <span id="profitPackaging" class="text-gray-500">0đ</span>
                                        </div>
                                        <div class="pl-3 space-y-1 mt-1" id="packagingItemsContainer">
                                            <!-- Packaging items will be dynamically rendered here -->
                                        </div>
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span class="text-gray-400">• Phí ship thực tế</span>
                                            <span id="profitShipping" class="text-gray-500">0đ</span>
                                        </div>
                                        <div class="flex justify-between items-center text-xs py-0.5">
                                            <span id="profitTaxLabel" class="text-gray-400">• Thuế</span>
                                            <span id="profitTax" class="text-gray-500">0đ</span>
                                        </div>
                                    </div>
                                    <!-- Commission row - hidden if no referral code -->
                                    <div id="profitCommissionRow" class="flex justify-between items-center text-sm py-1 hidden">
                                        <span id="profitCommissionLabel" class="text-gray-500">- Hoa hồng</span>
                                        <span id="profitCommission" class="text-gray-600">0đ</span>
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
            </div>
            <!-- End Content -->

            <!-- Footer -->
            <div class="bg-white px-8 py-4 rounded-b-2xl flex items-center justify-between border-t border-gray-200 flex-shrink-0">
                <div class="flex items-center gap-2 text-gray-500 text-sm">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>${isEdit ? 'Kiểm tra kỹ trước khi lưu thay đổi' : 'Kiểm tra kỹ thông tin trước khi tạo đơn'}</span>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="closeAddOrderModal()" class="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                        Hủy
                    </button>
                    <button type="button" id="orderFormSubmitBtn" onclick="submitNewOrder()" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                        ${isEdit ? 'Lưu đơn hàng' : 'Tạo đơn hàng'}
                    </button>
                </div>
            </div>
            <!-- End Footer -->
        </div>
        <!-- End Modal Container -->
    `;

    document.body.appendChild(modal);

    if (typeof setupDeskSmartPasteAuto === 'function') {
        setupDeskSmartPasteAuto();
    }

    if (typeof initCustomerSourcePicker === 'function') {
        initCustomerSourcePicker(duplicateData?.customer_source || '', {
            isEdit
        });
    }

    // PERFORMANCE: Defer all setup work to AFTER browser paints the modal.
    // setTimeout(fn, 0) = macrotask = runs after paint, unlike rAF/microtask.
    setTimeout(() => {
        setupCustomerCheck();
        setupShippingCostSync();
        if (typeof refreshShippingFeeBadges === 'function') refreshShippingFeeBadges();
        if (typeof refreshDesktopDiscountQuickBadges === 'function') refreshDesktopDiscountQuickBadges();
        initAddressSelector(duplicateData);

        if (duplicateData?.discount_code || (duplicateData?.discount_amount > 0 && isEdit)) {
            const discountInput = document.getElementById('newOrderDiscountCode');
            if (discountInput) {
                const rawCode = String(duplicateData.discount_code || '').trim();
                const discountCode = rawCode.toUpperCase();
                const discountAmount = duplicateData.discount_amount || 0;
                const isManualStored =
                    typeof isDeskManualStoredCode === 'function' &&
                    (isDeskManualStoredCode(rawCode) || isDeskManualStoredCode(discountCode));

                if ((isManualStored || (!rawCode && discountAmount > 0 && isEdit)) && discountAmount > 0) {
                    discountInput.value = '';
                    document.getElementById('appliedDiscountId').value = '';
                    document.getElementById('appliedDiscountCode').value = DESK_MANUAL_DISCOUNT_CODE;
                    document.getElementById('appliedDiscountAmount').value = discountAmount;
                    document.getElementById('appliedDiscountType').value = 'manual';
                    const srcEl = document.getElementById('appliedDiscountSource');
                    if (srcEl) srcEl.value = 'manual';
                    document.getElementById('appliedDiscountManualKind').value = 'fixed';
                    document.getElementById('appliedDiscountManualValue').value = String(discountAmount);
                    document.getElementById('appliedDiscountRoundPay').value = '0';
                    showDiscountSuccess(
                        {
                            code: DESK_MANUAL_DISCOUNT_CODE,
                            type: 'manual',
                            title: 'Giảm cố định · thủ công',
                        },
                        discountAmount
                    );
                } else if (rawCode) {
                    discountInput.value = discountCode;

                    if (isEdit) {
                        const discountInfo = allDiscountsList.find(
                            (d) => String(d.code || d.discount_code || '').toUpperCase() === discountCode
                        );
                        document.getElementById('appliedDiscountId').value =
                            duplicateData.discount_id || (discountInfo?.id || '');
                        document.getElementById('appliedDiscountCode').value = discountCode;
                        document.getElementById('appliedDiscountAmount').value = discountAmount;
                        document.getElementById('appliedDiscountType').value = discountInfo?.type || '';
                        const srcEl = document.getElementById('appliedDiscountSource');
                        if (srcEl) srcEl.value = discountInfo ? 'coupon' : '';
                        const discount = discountInfo || {
                            code: discountCode,
                            type: 'custom',
                            title: 'Giảm giá',
                        };
                        showDiscountSuccess(discount, discountAmount);
                    } else {
                        const hid = document.getElementById('appliedDiscountId');
                        if (hid && duplicateData.discount_id) {
                            hid.value = String(duplicateData.discount_id);
                        }
                        applyDiscountCode();
                    }
                }
            }
        }

        if (duplicateData && Number(duplicateData.shipping_fee) === 0) {
            const cb = document.getElementById('freeShippingCheckbox');
            if (cb) {
                cb.checked = true;
                toggleFreeShipping();
            }
        }

        const plannedInp = document.getElementById('newOrderPlannedSendAt');
        if (plannedInp && duplicateData?.planned_send_at_unix) {
            plannedInp.value = formatPlannedSendLocalInput(duplicateData.planned_send_at_unix);
        }
        if (duplicateData?.status === 'send_later') {
            const sl = document.getElementById('newOrderSendLater');
            const wrap = document.getElementById('newOrderSendLaterWrap');
            const st = document.getElementById('newOrderStatus');
            if (sl) sl.checked = true;
            if (wrap) wrap.classList.remove('hidden');
            if (st) st.value = 'send_later';
        }

        if (currentOrderProducts.length > 0) {
            renderOrderProducts();
        }
        updateOrderSummary();

        const referralCodeInput = document.getElementById('newOrderReferralCode');
        if (referralCodeInput) {
            referralCodeInput.addEventListener('input', () => updateOrderSummary());
        }

        productsPromise.then(() => renderQuickAddProducts()).catch(() => {
            const container = document.getElementById('quickAddProductsContainer');
            if (container) {
                container.innerHTML = '<p class="text-xs text-red-500 italic text-center py-2">Lỗi tải sản phẩm</p>';
            }
        });

        document.getElementById('newOrderCustomerName')?.focus();
    }, 0);
}

function formatPlannedSendLocalInput(ms) {
    if (ms == null || ms === '') return '';
    let n = Number(ms);
    if (!Number.isFinite(n)) return '';
    // DB / API có thể trả unix giây hoặc ms — datetime-local cần Date đúng ms
    if (n > 0 && n < 1e12) n *= 1000;
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toggleNewOrderSendLater() {
    const cb = document.getElementById('newOrderSendLater');
    const wrap = document.getElementById('newOrderSendLaterWrap');
    const statusEl = document.getElementById('newOrderStatus');
    if (!cb || !wrap || !statusEl) return;
    const revert = statusEl.getAttribute('data-revert-status') || 'pending';
    if (cb.checked) {
        wrap.classList.remove('hidden');
        statusEl.value = 'send_later';
    } else {
        wrap.classList.add('hidden');
        statusEl.value = revert;
    }
}

// Toggle free shipping
function toggleFreeShipping() {
    const checkbox = document.getElementById('freeShippingCheckbox');
    const shippingFeeInput = document.getElementById('newOrderShippingFee');

    if (!checkbox || !shippingFeeInput) return;

    if (checkbox.checked) {
        shippingFeeInput.value = '0';
    } else {
        const customerShippingFeeItem = packagingConfig.find(item => item.item_name === 'customer_shipping_fee');
        const defaultShippingFee = customerShippingFeeItem ? customerShippingFeeItem.item_cost : 30000;
        shippingFeeInput.value = defaultShippingFee;
        shippingFeeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (typeof refreshShippingFeeBadges === 'function') refreshShippingFeeBadges();
    updateOrderSummary();
}

// Close add order modal
function closeAddOrderModal(skipDraft = false) {
    const modal = document.getElementById('addOrderModal');
    if (modal) {
        const isEdit = !!document.getElementById('orderFormEditDbId')?.value;
        if (!isEdit && !skipDraft) _saveOrderDraft();

        if (typeof destroyDeskAddressCombobox === 'function') {
            destroyDeskAddressCombobox();
        }
        if (typeof destroyDeskLegacyAddressConvert === 'function') {
            destroyDeskLegacyAddressConvert();
        }
        if (typeof resetDeskAddressMode === 'function') {
            resetDeskAddressMode();
        }

        modal.remove();
        currentOrderProducts = [];
        currentOrderNotes = '';

        const h = window.location.hash;
        if (h === '#add-order' || (h && h.startsWith('#edit-order'))) {
            window.history.pushState(null, '', window.location.pathname + window.location.search);
        }
    }
}

// --- Order Draft (sessionStorage) ---
const _DRAFT_KEY = 'orderDraft';

function _saveOrderDraft() {
    const name = document.getElementById('newOrderCustomerName')?.value || '';
    const phone = document.getElementById('newOrderCustomerPhone')?.value || '';
    if (!name && !phone && currentOrderProducts.length === 0) {
        sessionStorage.removeItem(_DRAFT_KEY);
        return;
    }
    sessionStorage.setItem(_DRAFT_KEY, JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        address: document.getElementById('newOrderAddress')?.value || '',
        province_id: document.getElementById('newOrderProvince')?.value || '',
        ward_id: document.getElementById('newOrderWard')?.value || '',
        street_address: document.getElementById('newOrderStreetAddress')?.value || '',
        shipping_fee: parseFloat(document.getElementById('newOrderShippingFee')?.value) || 0,
        shipping_cost: parseFloat(document.getElementById('newOrderShippingCost')?.value) || 0,
        payment_method: document.getElementById('newOrderPaymentMethod')?.value || 'cod',
        deposit_amount: typeof getNewOrderDepositAmount === 'function'
            ? getNewOrderDepositAmount()
            : (parsePrice(document.getElementById('newOrderDepositAmount')?.value) || 0),
        referral_code: document.getElementById('newOrderReferralCode')?.value || '',
        notes: document.getElementById('newOrderNotes')?.value || '',
        is_priority: document.getElementById('newOrderPriority')?.checked || false,
        status: document.getElementById('newOrderStatus')?.value || 'pending',
        products: currentOrderProducts
    }));
}

function _loadOrderDraft() {
    try {
        const raw = sessionStorage.getItem(_DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function clearOrderDraft() {
    sessionStorage.removeItem(_DRAFT_KEY);
}

// Handle Smart Paste - Parse customer info automatically
async function handleSmartPaste() {
    if (typeof runDeskSmartPaste === 'function') {
        return runDeskSmartPaste();
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
        { value: 'bank', label: 'Đã chuyển khoản', color: 'blue' }
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
        document.addEventListener('click', 
);
    }, 10);
}

// Chọn hình thức thanh toán — COD | Đã CK | Cọc trước (loại trừ lẫn nhau)
function selectPaymentMethodDirect(method) {
    const pmInput = document.getElementById('newOrderPaymentMethod');
    const wrap = document.getElementById('newOrderDepositWrap');
    const depositBtn = document.getElementById('paymentBtn_deposit');
    if (!pmInput) return;

    document.querySelectorAll('.payment-pm-btn, .payment-deposit-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });

    if (method === 'deposit') {
        pmInput.value = 'cod';
        wrap?.classList.remove('hidden');
        depositBtn?.classList.add('active');
        depositBtn?.setAttribute('aria-pressed', 'true');
        setTimeout(() => document.getElementById('newOrderDepositAmount')?.focus(), 50);
    } else {
        pmInput.value = method;
        wrap?.classList.add('hidden');
        const activeBtn = document.getElementById(`paymentBtn_${method}`);
        activeBtn?.classList.add('active');
        activeBtn?.setAttribute('aria-pressed', 'true');
    }

    updateOrderSummary();
}

// Select payment method (legacy for dropdown - can be removed if not used elsewhere)
function selectPaymentMethod(value, label, color) {
    selectPaymentMethodDirect(value);
    const menu = document.getElementById('paymentDropdownMenu');
    if (menu) menu.remove();
    updateOrderSummary();
}

let productRowCounter = 0;


// ============================================
// QUICK ADD FUNCTIONS FOR BEST SELLING PRODUCTS
// ============================================

// ============================================
// DISCOUNT CODE FUNCTIONS
// ============================================

// Apply discount code















// ============================================
// ORDERS CHART FUNCTIONS
// ============================================

// Load orders chart data














// ============================================
// Custom Date Picker for Orders Filter
// ============================================
// Variables moved to orders-filters.js











