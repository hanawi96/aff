// Orders Dashboard JavaScript
// All constants, utilities, and core functions have been extracted to separate modules
// This file now only contains functions that haven't been modularized yet

console.log('🚀 Loading orders.js - Main file');

// Global data arrays
let allOrdersData = [];
let filteredOrdersData = [];
let selectedOrderIds = new Set();
let currentPage = 1;
const itemsPerPage = 15;
let dateSortOrder = 'desc';
let amountSortOrder = 'none';
let packagingConfig = [];

// Product and order management variables
let allProductsList = [];
let allCategoriesList = [];
let currentOrderProducts = [];
let currentOrderNotes = '';
let selectedCategory = null;
let selectedProducts = [];
let currentEditingOrderId = null;
let currentEditingOrderCode = null;

// Load packaging config from database





// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Orders Dashboard initialized');
    loadCurrentTaxRate(); // Load tax rate first
    loadOrdersData();
    loadPackagingConfig();
    setupEventListeners();
    updateExportHistoryBadge(); // Load export history badge

    // Check URL hash to auto-open modal
    checkUrlHash();

    // PERFORMANCE: Preload products in background for instant modal
    setTimeout(() => {
        if (allProductsList.length === 0) {
            console.log('⚡ Preloading products for faster modal...');
            loadProductsAndCategories().then(() => {
                console.log('✅ Products preloaded:', allProductsList.length);
            });
        }
    }, 1000); // Wait 1s after page load to not block initial render
    
    // Auto-refresh badge every 30 seconds
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

// Show add order modal
async function showAddOrderModal(duplicateData = null) {
    // Update URL hash for sharing
    if (!duplicateData) {
        window.history.pushState(null, '', '#add-order');
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
    const referralCode = duplicateData?.referral_code || '';
    const paymentMethod = duplicateData?.payment_method || 'cod';

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
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại <span class="text-red-500">*</span></label>
                            <input type="tel" id="newOrderCustomerPhone" value="${escapeHtml(customerPhone)}" placeholder="0123456789" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                            <div id="customerStatusHint" class="mt-1.5 text-xs hidden"></div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên khách hàng <span class="text-red-500">*</span></label>
                            <input type="text" id="newOrderCustomerName" value="${escapeHtml(customerName)}" placeholder="Nhập tên khách hàng" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
                            <div class="grid grid-cols-2 gap-3 mb-4">
                                <button onclick="showProductSelectionModal()" class="px-4 py-2 bg-white hover:bg-purple-50 border-2 border-dashed border-purple-400 hover:border-purple-500 rounded-xl font-semibold text-purple-600 transition-all flex items-center justify-center gap-2">
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

    // Setup customer check on phone input
    setupCustomerCheck();

    // Setup auto-sync shipping cost with shipping fee
    setupShippingCostSync();

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
        }
        // Always call updateOrderSummary to show initial values
        updateOrderSummary();
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

        // Remove hash from URL
        if (window.location.hash === '#add-order') {
            window.history.pushState(null, '', window.location.pathname + window.location.search);
        }
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
        document.addEventListener('click', 
);
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
        document.addEventListener('click', 
);
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











// ============================================
// DEBUG: Check if functions are loaded
// ============================================
console.log('🔍 Checking function availability:');
console.log('  - showProductSelectionModal:', typeof showProductSelectionModal);
console.log('  - updateOrderSummary:', typeof updateOrderSummary);
console.log('  - renderOrderProducts:', typeof renderOrderProducts);
console.log('  - updateOrderNotesDisplay:', typeof updateOrderNotesDisplay);
console.log('  - clearOrderNotes:', typeof clearOrderNotes);
console.log('  - submitNewOrder:', typeof submitNewOrder);
console.log('  - showAddOrderModal:', typeof showAddOrderModal);
console.log('✅ orders.js loaded completely');
