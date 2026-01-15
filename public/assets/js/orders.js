// Orders Dashboard JavaScript
// All constants, utilities, and core functions have been extracted to separate modules
// This file now only contains functions that haven't been modularized yet

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








// Delete product from order


// Show product selection modal for existing order
// Variables declared at top of file

function showProductSelectionModalForOrder(orderId, orderCode) {
    currentEditingOrderId = orderId;
    currentEditingOrderCode = orderCode;
    showProductSelectionModal();
}




// Save order notes


// Save selected products to existing order
async function saveProductsToExistingOrder() {
    if (!currentEditingOrderId || selectedProducts.length === 0) {
        showToast('Vui lòng chọn ít nhất một sản phẩm', 'warning');
        return;
    }

    // Validate: Check if all products have weight/size
    const missingWeightProducts = [];
    selectedProducts.forEach(productId => {
        const weightOrSize = productWeights[productId] || ''; // Modal stores both weight and size in this field
        if (!weightOrSize.trim()) {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                missingWeightProducts.push(product.name);
            }
        }
    });

    if (missingWeightProducts.length > 0) {
        showToast(`Vui lòng nhập cân nặng/size cho: ${missingWeightProducts.join(', ')}`, 'warning');
        return;
    }

    const addId = `add-products-${currentEditingOrderId}`;
    showToast('Đang thêm sản phẩm...', 'info', 0, addId);

    try {
        const orderIndex = allOrdersData.findIndex(o => o.id === currentEditingOrderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Add selected products
        selectedProducts.forEach(productId => {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                const quantity = productQuantities[productId] || 1;
                const weightOrSize = productWeights[productId] || ''; // This field stores either weight or size
                const notes = productNotes[productId] || '';

                // Determine if this is size or weight based on category
                const productCategory = allCategoriesList.find(c => c.id === product.category_id);
                const categoryName = productCategory ? productCategory.name : '';
                const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');

                const newProduct = {
                    product_id: product.id, // Add product_id
                    name: product.name,
                    quantity: quantity
                };

                // Always add price and cost_price if available (even if 0)
                if (product.price !== undefined && product.price !== null) {
                    newProduct.price = product.price;
                }
                if (product.cost_price !== undefined && product.cost_price !== null) {
                    newProduct.cost_price = product.cost_price;
                }

                // Add size (for both weight and size) with auto-unit
                if (weightOrSize) {
                    let finalSize = weightOrSize.trim();

                    // Auto-add unit if only number is entered
                    if (/^\d+(\.\d+)?$/.test(finalSize)) {
                        if (isAdultBracelet) {
                            finalSize = finalSize + 'cm'; // Size tay
                        } else {
                            finalSize = finalSize + 'kg'; // Cân nặng
                        }
                    }

                    newProduct.size = finalSize;
                }

                if (notes) newProduct.notes = notes;

                console.log('📦 Adding product to order:', {
                    name: product.name,
                    category: categoryName,
                    isAdultBracelet: isAdultBracelet,
                    price: product.price,
                    cost_price: product.cost_price,
                    quantity: quantity,
                    weightOrSize: weightOrSize,
                    notes: notes,
                    finalProduct: newProduct
                });

                products.push(newProduct);
            }
        });

        const updatedProductsJson = JSON.stringify(products);

        // Update in database
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: currentEditingOrderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(currentEditingOrderId, updates);

            updateStats();
            renderOrdersTable();
            closeProductSelectionModal();
            showToast(`Đã thêm sản phẩm vào đơn ${currentEditingOrderCode}`, 'success', null, addId);

            // Reset
            currentEditingOrderId = null;
            currentEditingOrderCode = null;
        } else {
            throw new Error(data.error || 'Không thể thêm sản phẩm');
        }
    } catch (error) {
        console.error('Error adding products:', error);
        showToast('Không thể thêm sản phẩm: ' + error.message, 'error', null, addId);
    }
}

// ============================================
// ADD ORDER MODAL
// ============================================
// Variables declared at top of file

// Load products and categories
async function loadProductsAndCategories() {
    // Return immediately if already loaded
    if (allProductsList.length > 0 && allCategoriesList.length > 0) {
        console.log('✅ Products already loaded from cache:', allProductsList.length);
        return Promise.resolve();
    }

    try {
        console.log('📥 Loading products and categories...');
        const [productsRes, categoriesRes] = await Promise.all([
            fetch(`${CONFIG.API_URL}?action=getAllProducts&timestamp=${Date.now()}`),
            fetch(`${CONFIG.API_URL}?action=getAllCategories&timestamp=${Date.now()}`)
        ]);

        const [productsData, categoriesData] = await Promise.all([
            productsRes.json(),
            categoriesRes.json()
        ]);

        if (productsData.success) {
            allProductsList = productsData.products || [];
            console.log('✅ Loaded products:', allProductsList.length);
        }
        if (categoriesData.success) {
            allCategoriesList = categoriesData.categories || [];
            console.log('✅ Loaded categories:', allCategoriesList.length);
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

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
    const customerName = duplicateData?.customer_name || 'Nguyễn Văn A';
    const customerPhone = duplicateData?.customer_phone || '0386190596';
    const address = duplicateData?.address || '123 Đường ABC, Phường XYZ, Quận 1, TP.HCM';
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

// Render BEST SELLING products box (TOP 6)
function renderBestSellingProductsBox() {
    // Find the parent container (before quickAddProductsContainer)
    const freeshipSection = document.querySelector('.bg-gradient-to-br.from-amber-50');
    if (!freeshipSection) {
        console.warn('⚠️ Freeship section not found');
        return;
    }

    // Check if best selling box already exists
    if (document.getElementById('bestSellingProductsBox')) {
        console.log('✅ Best selling box already exists');
        return;
    }

    // Get TOP 6 BEST SELLING products
    const bestSellingProducts = allProductsList
        .filter(p => p.is_active !== 0 && (p.purchases || 0) > 0)
        .sort((a, b) => (b.purchases || 0) - (a.purchases || 0))
        .slice(0, 6);

    console.log('🔥 Top 6 best selling products:', bestSellingProducts.length);

    if (bestSellingProducts.length === 0) {
        console.warn('⚠️ No best selling products found');
        return;
    }

    // Create best selling box HTML
    const bestSellingBox = document.createElement('div');
    bestSellingBox.id = 'bestSellingProductsBox';
    bestSellingBox.className = 'bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 mb-3';

    const colorSchemes = [
        { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700' },
        { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
        { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
        { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
        { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
        { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' }
    ];

    bestSellingBox.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" />
            </svg>
            <span class="text-base font-bold text-gray-900">Sản phẩm bán chạy</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
            ${bestSellingProducts.map((product, index) => {
        const qtyId = `best_qty_${product.id}`;
        const sizeId = `best_size_${product.id}`;
        const purchases = product.purchases || 0;

        return `
                    <div class="bg-white border border-orange-200 rounded-lg p-2 hover:border-orange-400 transition-all">
                        <div class="flex items-center gap-2 mb-1.5">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-gray-900 truncate" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</p>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-xs font-bold text-green-600">${formatCurrency(product.price)}</span>
                                    <span class="text-xs text-gray-500">• Lượt bán: <span class="font-semibold text-orange-600">${purchases}</span></span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <input type="text" id="${sizeId}" placeholder="Size" 
                                class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500" />
                            <div class="flex items-center border border-gray-300 rounded overflow-hidden">
                                <button onclick="quickChangeQty('${qtyId}', -1)" class="px-1.5 py-1 bg-gray-50 hover:bg-gray-100">
                                    <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4" />
                                    </svg>
                                </button>
                                <input type="number" id="${qtyId}" value="1" min="1" class="w-8 text-center text-xs font-semibold border-0 focus:ring-0 py-1">
                                <button onclick="quickChangeQty('${qtyId}', 1)" class="px-1.5 py-1 bg-gray-50 hover:bg-gray-100">
                                    <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                            <button onclick="quickAddProductToOrder(${product.id}, '${escapeHtml(product.name).replace(/'/g, "\\'")}', ${product.price}, ${product.cost_price || 0}, '${qtyId}', '${sizeId}')" 
                                class="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold transition-all">
                                Thêm
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    // Insert before freeship section
    freeshipSection.parentNode.insertBefore(bestSellingBox, freeshipSection);

    // Create toggle button (separate element)
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggleFreeshipBtn';
    toggleButton.onclick = toggleFreeshipProducts;
    toggleButton.className = 'w-full mb-3 px-3 py-2 bg-white hover:bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2';
    toggleButton.innerHTML = `
        <svg id="toggleFreeshipIcon" class="w-4 h-4 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        <span id="toggleFreeshipText">Xem sản phẩm bán kèm</span>
    `;

    // Insert toggle button between best selling box and freeship section
    freeshipSection.parentNode.insertBefore(toggleButton, freeshipSection);

    console.log('✅ Best selling products box and toggle button rendered');
}

// Render quick add products from database (category_id = 23 or category_name = 'Freeship')
function renderQuickAddProducts() {
    // First, render best selling products box
    renderBestSellingProductsBox();

    // Then render freeship products
    const container = document.getElementById('quickAddProductsContainer');
    if (!container) {
        console.warn('⚠️ Quick add products container not found');
        return;
    }

    console.log('🔍 Total products loaded:', allProductsList.length);

    // Show loading state if no products yet
    if (allProductsList.length === 0) {
        console.log('⏳ Products not loaded yet, showing loading state...');
        container.innerHTML = `
            <div class="col-span-2 text-center py-4">
                <div class="inline-flex items-center gap-2 text-sm text-gray-500">
                    <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang tải sản phẩm...</span>
                </div>
            </div>
        `;
        return;
    }

    // Filter products with category_id = 23 OR category_name = 'Freeship' (case insensitive)
    const freeshipProducts = allProductsList.filter(p => {
        const matchesId = p.category_id === 23;
        const matchesName = p.category_name && p.category_name.toLowerCase().includes('freeship');
        return (matchesId || matchesName) && p.is_active !== 0;
    });

    console.log('🎯 Freeship products found:', freeshipProducts.length);
    if (freeshipProducts.length > 0) {
        console.log('📦 Products:', freeshipProducts.map(p => ({ name: p.name, category_id: p.category_id, category_name: p.category_name })));
    }

    if (freeshipProducts.length === 0) {
        console.warn('⚠️ No products found with category_id=23 or category_name containing "Freeship"');
        console.log('💡 Available categories:', [...new Set(allProductsList.map(p => `${p.category_id}: ${p.category_name}`))]);
        container.innerHTML = '<p class="text-xs text-gray-500 italic text-center py-2 col-span-2">Chưa có sản phẩm bán kèm</p>';
        return;
    }

    // Color schemes for variety
    const colorSchemes = [
        { bg: 'bg-blue-100', text: 'text-blue-600', btn: 'bg-blue-500 hover:bg-blue-600', ring: 'focus:ring-blue-500' },
        { bg: 'bg-pink-100', text: 'text-pink-600', btn: 'bg-pink-500 hover:bg-pink-600', ring: 'focus:ring-pink-500' },
        { bg: 'bg-purple-100', text: 'text-purple-600', btn: 'bg-purple-500 hover:bg-purple-600', ring: 'focus:ring-purple-500' },
        { bg: 'bg-green-100', text: 'text-green-600', btn: 'bg-green-500 hover:bg-green-600', ring: 'focus:ring-green-500' },
        { bg: 'bg-orange-100', text: 'text-orange-600', btn: 'bg-orange-500 hover:bg-orange-600', ring: 'focus:ring-orange-500' }
    ];

    container.innerHTML = freeshipProducts.map((product, index) => {
        const color = colorSchemes[index % colorSchemes.length];
        const qtyId = `quick_qty_${product.id}`;

        return `
            <div class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                <div class="w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 ${color.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-gray-800">${escapeHtml(product.name)}</p>
                    <p class="text-xs text-green-600 font-bold">${formatCurrency(product.price)}</p>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="quickChangeQty('${qtyId}', -1)" class="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                        </svg>
                    </button>
                    <input type="number" id="${qtyId}" value="1" min="0" max="99" 
                        class="w-10 h-6 text-center text-xs font-bold border border-gray-300 rounded ${color.ring} focus:border-transparent" />
                    <button onclick="quickChangeQty('${qtyId}', 1)" class="w-6 h-6 rounded ${color.btn} flex items-center justify-center transition-colors">
                        <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <button onclick="quickAddProductWithQty('${escapeHtml(product.name)}', ${product.price}, '${qtyId}')" 
                        class="ml-1 px-2 h-6 ${color.btn} text-white text-xs font-medium rounded transition-colors">
                        Thêm
                    </button>
                </div>
            </div>
        `;
    }).join('');
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

// Show product selection modal (separate modal)
function showProductSelectionModal() {
    // Close existing modal if any
    const existingModal = document.getElementById('productSelectionModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'productSelectionModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl flex-shrink-0">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        Chọn sản phẩm
                    </h3>
                    <button onclick="closeProductSelectionModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-all">
                        <svg class="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6 overflow-y-auto flex-1">
                <!-- Step 1: Categories -->
                <div class="mb-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Bước 1: Chọn danh mục</p>
                    <div id="modalCategoriesGrid" class="flex flex-wrap gap-2">
                        <!-- Categories will be rendered here -->
                    </div>
                </div>

                <!-- Step 2: Products -->
                <div id="modalStep2Container" class="mb-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Bước 2: Chọn sản phẩm</p>
                    
                    <!-- Search Box and Actions -->
                    <div class="flex gap-2 mb-3">
                        <div class="relative flex-1">
                            <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" id="modalProductSearchInput" placeholder="🔍 Tìm kiếm sản phẩm..." class="w-full pl-10 pr-4 py-2 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <button onclick="toggleSelectAllProducts()" id="selectAllBtn" class="px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors whitespace-nowrap">
                            Chọn tất cả
                        </button>
                    </div>

                    <!-- Products List -->
                    <div id="modalProductsListContainer" class="bg-white rounded-lg border border-purple-200 max-h-64 lg:max-h-80 xl:max-h-96 overflow-y-auto">
                        <div id="modalProductsList" class="grid grid-cols-2 gap-px bg-gray-100">
                            <!-- Products will be rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Step 3: Product Details (only for custom input) -->
                <div id="modalProductDetailsForm" class="hidden pt-4 border-t border-gray-200">
                    <!-- Custom Input Fields (shown when "Tự nhập" selected) -->
                    <div id="modalCustomInputFields" class="hidden">
                        <!-- Compact Card Design -->
                        <div class="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 rounded-xl p-4 border border-purple-200">
                            <!-- Header -->
                            <div class="flex items-center gap-2 mb-3 pb-3 border-b border-purple-200">
                                <div class="w-7 h-7 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
                                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-sm font-bold text-gray-900">Tự nhập sản phẩm</h4>
                                    <p class="text-xs text-gray-600">Sản phẩm không có trong danh sách</p>
                                </div>
                            </div>

                            <!-- Form Fields -->
                            <div class="space-y-3">
                                <!-- Product Name -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                        Tên sản phẩm <span class="text-red-500">*</span>
                                    </label>
                                    <input type="text" id="modalCustomProductNameInput" 
                                        placeholder="Nhập tên sản phẩm..." 
                                        class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                                </div>

                                <!-- Price and Cost Price Grid -->
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Giá bán <span class="text-red-500">*</span>
                                        </label>
                                        <div class="relative">
                                            <input type="number" id="modalCustomProductPriceInput" 
                                                placeholder="50000" 
                                                min="0" 
                                                step="1000" 
                                                oninput="calculateModalCustomProfit()"
                                                class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                                            <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            💰 Giá vốn
                                        </label>
                                        <div class="relative">
                                            <input type="number" id="modalCustomProductCostInput" 
                                                placeholder="25000" 
                                                min="0" 
                                                step="1000" 
                                                oninput="calculateModalCustomProfit()"
                                                class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                                            <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Profit Display -->
                                <div id="modalCustomProfitDisplay" class="hidden">
                                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-600">Lãi dự kiến:</span>
                                            <div class="text-right">
                                                <span id="modalCustomProfitAmount" class="text-sm font-bold text-green-600">0đ</span>
                                                <span class="text-xs text-green-500 ml-2">(<span id="modalCustomProfitMargin">0</span>%)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div id="modalCustomLossWarning" class="hidden">
                                    <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        <p class="text-xs text-red-600 font-medium">⚠️ Giá vốn cao hơn giá bán!</p>
                                    </div>
                                </div>

                                <!-- Quantity and Weight Grid -->
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Số lượng
                                        </label>
                                        <input type="number" id="modalCustomProductQtyInput" 
                                            value="1" 
                                            min="1" 
                                            class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                                    </div>

                                    <div>
                                        <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Cân nặng
                                        </label>
                                        <input type="text" id="modalCustomProductWeightInput" 
                                            placeholder="5kg" 
                                            class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                                    </div>
                                </div>

                                <!-- Notes -->
                                <div>
                                    <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                        Lưu ý
                                    </label>
                                    <textarea id="modalCustomProductNotesInput" 
                                        rows="2" 
                                        placeholder="Ghi chú thêm về sản phẩm..." 
                                        class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all resize-none"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Selected Product Display (shown when products selected from list) -->
                    <div id="modalSelectedProductDisplay" class="hidden bg-purple-50 rounded-lg p-3 border border-purple-300 mb-3">
                        <p class="text-xs text-gray-600 mb-1">Sản phẩm đã chọn:</p>
                        <p class="font-semibold text-gray-900" id="modalSelectedProductName"></p>
                        <p class="text-sm text-green-600 font-bold" id="modalSelectedProductPrice"></p>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200 flex-shrink-0">
                <button onclick="closeProductSelectionModal()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="addProductFromModal()" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Thêm vào đơn
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Render categories
    renderModalCategories();

    // Render all products initially
    renderModalProductsList();

    // Setup search
    setupModalProductSearch();

    // Setup keyboard shortcuts
    modal.addEventListener('keydown', function (e) {
        // Ctrl/Cmd + Enter to add products
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            addProductFromModal();
        }
        // Escape to close
        if (e.key === 'Escape') {
            e.preventDefault();
            closeProductSelectionModal();
        }
    });

    // Focus search input
    setTimeout(() => document.getElementById('modalProductSearchInput')?.focus(), 100);
}

// Close product selection modal
function closeProductSelectionModal() {
    const modal = document.getElementById('productSelectionModal');
    if (modal) {
        modal.remove();
        selectedCategory = null;
        selectedProducts = [];
        // Reset product quantities
        Object.keys(productQuantities).forEach(key => delete productQuantities[key]);
        // Reset editing order
        currentEditingOrderId = null;
        currentEditingOrderCode = null;
    }
}







// Remove product from order
function removeProductFromOrder(index) {
    currentOrderProducts.splice(index, 1);
    renderOrderProducts();
    updateOrderSummary();
    showToast('Đã xóa sản phẩm', 'info');
}

// Edit product in order
function editProductInOrder(index) {
    const product = currentOrderProducts[index];
    if (!product) return;

    // Create edit modal
    const modal = document.createElement('div');
    modal.id = 'editProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-white">Chỉnh sửa sản phẩm</h3>
                    </div>
                    <button onclick="closeEditProductModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                        <svg class="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Product Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên sản phẩm <span class="text-red-500">*</span></label>
                    <input type="text" id="editProductName" value="${escapeHtml(product.name)}" 
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                <!-- Quantity and Size -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Số lượng <span class="text-red-500">*</span></label>
                        <input type="number" id="editProductQty" value="${product.quantity || 1}" min="1" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="calculateEditProfit('quantity')" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Size/Tay</label>
                        <input type="text" id="editProductSize" value="${escapeHtml(product.size || '')}" placeholder="VD: Size M, 5kg..." 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                </div>

                <!-- Price and Cost -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">
                            Giá bán <span class="text-xs text-gray-500 font-normal">(VD: 50000)</span>
                        </label>
                        <input type="number" id="editProductPrice" value="${product.price || ''}" placeholder="0" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="calculateEditProfit('price')" />
                        <div id="editProductPriceUnit" class="text-xs text-blue-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductPriceUnitValue">0đ</span>/sp
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">💰 Giá vốn</label>
                        <input type="number" id="editProductCostPrice" value="${product.cost_price || ''}" placeholder="0" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="calculateEditProfit('cost')" />
                        <div id="editProductCostUnit" class="text-xs text-orange-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductCostUnitValue">0đ</span>/sp
                        </div>
                    </div>
                </div>
                <p class="text-xs text-gray-500 -mt-2">💡 Giá nhập là giá 1 sản phẩm. Tổng tiền sẽ tự động tính = giá × số lượng</p>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Ghi chú</label>
                    <textarea id="editProductNotes" rows="2" placeholder="Ghi chú về sản phẩm..." 
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none">${escapeHtml(product.notes || '')}</textarea>
                </div>
            </div>

            <!-- Notice -->
            <div class="px-6 py-3 bg-blue-50 border-t border-blue-100">
                <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-sm text-blue-700"><span class="font-semibold">Lưu ý:</span> Thay đổi chỉ áp dụng cho sản phẩm trong đơn hàng này</p>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button onclick="closeEditProductModal()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="saveEditedProduct(${index})" class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Reset unit prices
    editOrderUnitPrice = parseFloat(product.price) || 0;
    editOrderUnitCost = parseFloat(product.cost_price) || 0;

    // Focus first input
    setTimeout(() => {
        document.getElementById('editProductName')?.focus();
        calculateEditProfit();
    }, 100);
}

// Store unit prices for new order modal
let editOrderUnitPrice = 0;
let editOrderUnitCost = 0;
let editOrderIsUpdating = false;

// Calculate and update unit prices in edit modal (for new order)
function calculateEditProfit(sourceField = null) {
    if (editOrderIsUpdating) return;

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQty');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;

    // Parse current input values
    const currentPriceValue = parseFloat(priceInput.value) || 0;
    const currentCostValue = parseFloat(costPriceInput.value) || 0;

    // Update unit prices based on what user is editing
    if (sourceField === 'price' || (editOrderUnitPrice === 0 && currentPriceValue > 0)) {
        editOrderUnitPrice = currentPriceValue / quantity;
    }
    if (sourceField === 'cost' || (editOrderUnitCost === 0 && currentCostValue > 0)) {
        editOrderUnitCost = currentCostValue / quantity;
    }

    // Only auto-calculate total when quantity changes, not when price/cost changes
    if (sourceField === 'quantity') {
        const totalRevenue = editOrderUnitPrice * quantity;
        const totalCost = editOrderUnitCost * quantity;

        editOrderIsUpdating = true;
        if (editOrderUnitPrice > 0) {
            priceInput.value = totalRevenue;
        }
        if (editOrderUnitCost > 0) {
            costPriceInput.value = totalCost;
        }
        editOrderIsUpdating = false;
    }

    // Update unit price labels (show only when quantity > 1)
    const priceUnitDiv = document.getElementById('editProductPriceUnit');
    const costUnitDiv = document.getElementById('editProductCostUnit');

    if (quantity > 1) {
        if (editOrderUnitPrice > 0) {
            document.getElementById('editProductPriceUnitValue').textContent = formatCurrency(editOrderUnitPrice);
            priceUnitDiv?.classList.remove('hidden');
        } else {
            priceUnitDiv?.classList.add('hidden');
        }

        if (editOrderUnitCost > 0) {
            document.getElementById('editProductCostUnitValue').textContent = formatCurrency(editOrderUnitCost);
            costUnitDiv?.classList.remove('hidden');
        } else {
            costUnitDiv?.classList.add('hidden');
        }
    } else {
        priceUnitDiv?.classList.add('hidden');
        costUnitDiv?.classList.add('hidden');
    }
}

// Save edited product
function saveEditedProduct(index) {
    const name = document.getElementById('editProductName')?.value.trim();
    const quantity = parseInt(document.getElementById('editProductQty')?.value) || 1;
    // Use unit prices (not total from input)
    const price = editOrderUnitPrice;
    const costPrice = editOrderUnitCost;
    const size = document.getElementById('editProductSize')?.value.trim();
    const notes = document.getElementById('editProductNotes')?.value.trim();

    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        return;
    }

    // Update product
    currentOrderProducts[index] = {
        name: name,
        quantity: quantity
    };

    if (price > 0) currentOrderProducts[index].price = price;
    if (costPrice > 0) currentOrderProducts[index].cost_price = costPrice;
    if (size) currentOrderProducts[index].size = size;
    if (notes) currentOrderProducts[index].notes = notes;

    closeEditProductModal();
    renderOrderProducts();
    updateOrderSummary();
    showToast('Đã cập nhật sản phẩm', 'success');
}




// Quick add product (for frequently bought items)
function quickAddProduct(name, price) {
    // Try to find cost_price from products list
    const productFromList = allProductsList.find(p => p.name === name);
    const costPrice = productFromList?.cost_price || 0;

    const product = {
        name: name,
        price: price,
        quantity: 1
    };
    if (costPrice > 0) product.cost_price = costPrice;

    currentOrderProducts.push(product);
    renderOrderProducts();
    updateOrderSummary();
    showToast(`Đã thêm: ${name}`, 'success');
}

// Quick add product with quantity
function quickAddProductWithQty(name, price, inputId) {
    const input = document.getElementById(inputId);
    const quantity = parseInt(input?.value) || 0;

    if (quantity <= 0) {
        showToast('Vui lòng chọn số lượng', 'warning');
        return;
    }

    // Try to find cost_price from products list
    const productFromList = allProductsList.find(p => p.name === name);
    const costPrice = productFromList?.cost_price || 0;

    const product = {
        name: name,
        price: price,
        quantity: quantity
    };
    if (costPrice > 0) product.cost_price = costPrice;

    currentOrderProducts.push(product);
    renderOrderProducts();
    updateOrderSummary();

    // Reset quantity to 1
    if (input) input.value = '1';

    showToast(`Đã thêm ${quantity}x ${name}`, 'success');
}

// Change quantity for quick add products
function quickChangeQty(inputId, change) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;

    // Keep within bounds
    if (newValue < 0) newValue = 0;
    if (newValue > 99) newValue = 99;

    input.value = newValue;
}

// Update order notes display
function updateOrderNotesDisplay() {
    const notesDisplay = document.getElementById('orderNotesDisplay');
    const notesText = document.getElementById('orderNotesText');

    if (notesDisplay && notesText) {
        if (currentOrderNotes && currentOrderNotes.trim()) {
            notesDisplay.classList.remove('hidden');
            notesText.textContent = currentOrderNotes;
        } else {
            notesDisplay.classList.add('hidden');
        }
    }
}

// Clear order notes
function clearOrderNotes() {
    currentOrderNotes = '';
    updateOrderNotesDisplay();
}

// Render order products
function renderOrderProducts() {
    const container = document.getElementById('newOrderProductsList');
    if (!container) return;

    if (currentOrderProducts.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-8 italic">Chưa có sản phẩm nào</p>';
        return;
    }

    container.innerHTML = currentOrderProducts.map((p, i) => `
        <div class="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all">
            <div class="flex items-start gap-3">
                <!-- Number Badge -->
                <div class="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                    ${i + 1}
                </div>
                
                <!-- Product Info -->
                <div class="flex-1 min-w-0">
                    <!-- Product Name -->
                    <div class="font-semibold text-gray-900 mb-1.5">${escapeHtml(p.name)}</div>
                    
                    <!-- Details Row -->
                    <div class="flex items-center gap-3 text-sm">
                        <!-- Quantity & Size -->
                        <div class="flex items-center gap-2">
                            <span class="text-purple-600 font-medium">#</span>
                            <span class="text-gray-700">SL: ${p.quantity || 1}</span>
                            ${p.weight || p.size ? `<span class="text-gray-400">•</span><span class="text-gray-600">${escapeHtml(formatWeightSize(p.weight || p.size))}</span>` : ''}
                        </div>
                        
                        <!-- Price -->
                        ${p.price && !isNaN(parseFloat(p.price)) ? `
                        <div class="flex items-center gap-1">
                            <span class="text-gray-400">•</span>
                            <span class="text-green-600 font-semibold">${formatCurrency(parseFloat(p.price) * (p.quantity || 1))}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Notes -->
                    ${p.notes ? `
                    <div class="mt-1.5 text-xs text-gray-500 italic">
                        💬 ${escapeHtml(p.notes)}
                    </div>
                    ` : ''}
                </div>
                
                <!-- Action Buttons -->
                <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="editProductInOrder(${i})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Sửa">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="removeProductFromOrder(${i})" class="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update order summary
function updateOrderSummary() {
    // Calculate product total (revenue from products only)
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = p.price || 0;
        const qty = p.quantity || 1;
        return sum + (price * qty);
    }, 0);

    // Calculate product cost
    const productCost = currentOrderProducts.reduce((sum, p) => {
        const cost = p.cost_price || 0;
        const qty = p.quantity || 1;
        return sum + (cost * qty);
    }, 0);

    // Get shipping costs from form (if available)
    const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value || 0);
    let shippingCost = parseFloat(document.getElementById('newOrderShippingCost')?.value || 0);

    // If shipping cost is 0 but shipping fee has value, use shipping fee as default
    if (shippingCost === 0 && shippingFee > 0) {
        shippingCost = shippingFee;
    }

    // Only calculate costs if there are products
    const hasProducts = currentOrderProducts.length > 0;

    // Calculate packaging cost from database config (only if has products)
    const packagingCost = hasProducts ? calculatePackagingCost() : 0;

    // Calculate commission based on CTV's commission_rate if available (only if has products)
    const referralCode = document.getElementById('newOrderReferralCode')?.value.trim();
    let commission = 0;
    if (referralCode && hasProducts) {
        // Get commission_rate from hidden input (set by CTV verification)
        const commissionRateInput = document.getElementById('ctvCommissionRate');
        const commissionRate = commissionRateInput ? parseFloat(commissionRateInput.value) : 0.1;
        commission = Math.round(productTotal * commissionRate);
    }

    // Get discount amount if applied
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value || 0);

    // Calculate total revenue (product total + shipping fee - discount)
    const revenue = productTotal + shippingFee - discountAmount;

    // Calculate tax (1.5% of revenue) - only if has products
    const tax = hasProducts ? Math.round(revenue * COST_CONSTANTS.TAX_RATE) : 0;

    // Calculate profit (revenue - all costs including tax)
    const profit = revenue - productCost - shippingCost - packagingCost - commission - tax;
    const profitMargin = revenue > 0 ? (profit / revenue * 100) : 0;

    // Update summary display (total = products + shipping fee - discount)
    document.getElementById('orderTotalAmount').textContent = formatCurrency(revenue);

    // Update breakdown in main summary
    document.getElementById('orderProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('orderShippingFee').textContent = formatCurrency(shippingFee);

    // Show/hide discount row in main summary
    const orderDiscountRow = document.getElementById('orderDiscountRow');
    if (discountAmount > 0) {
        if (orderDiscountRow) {
            orderDiscountRow.classList.remove('hidden');
            document.getElementById('orderDiscountAmount').textContent = `-${formatCurrency(discountAmount)}`;
        }
    } else {
        if (orderDiscountRow) orderDiscountRow.classList.add('hidden');
    }

    // Update profit preview with all cost details
    updateProfitPreview({
        revenue: revenue,
        productTotal: productTotal,
        productCost,
        packagingCost,
        shippingFee,
        shippingCost,
        commission,
        discountAmount,
        tax,
        profit,
        profitMargin
    });
}

// Update profit preview
function updateProfitPreview(data) {
    // Calculate product total (revenue before discount includes shipping)
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = p.price || 0;
        const qty = p.quantity || 1;
        return sum + (price * qty);
    }, 0);

    // Update values
    document.getElementById('profitRevenue').textContent = formatCurrency(data.revenue);

    // Update revenue breakdown
    document.getElementById('profitProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('profitShippingFee').textContent = formatCurrency(data.shippingFee);

    document.getElementById('profitCost').textContent = formatCurrency(data.productCost);
    document.getElementById('profitPackaging').textContent = formatCurrency(data.packagingCost);

    // Show packaging details breakdown if available
    if (packagingConfig && packagingConfig.length > 0 && currentOrderProducts.length > 0) {
        const totalProducts = currentOrderProducts.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const packagingPrices = {};
        packagingConfig.filter(item => item.is_default === 1).forEach(item => {
            packagingPrices[item.item_name] = item.item_cost || 0;
        });

        const perProductCost = ((packagingPrices.red_string || 0) + (packagingPrices.labor_cost || 0)) * totalProducts;
        const perOrderCost = (packagingPrices.bag_zip || 0) + (packagingPrices.bag_red || 0) +
            (packagingPrices.box_shipping || 0) + (packagingPrices.thank_card || 0) +
            (packagingPrices.paper_print || 0);

        document.getElementById('profitPackagingPerProduct').textContent = formatCurrency(perProductCost);
        document.getElementById('profitPackagingPerOrder').textContent = formatCurrency(perOrderCost);
    }

    document.getElementById('profitShipping').textContent = formatCurrency(data.shippingCost);

    // Update commission with percentage
    document.getElementById('profitCommission').textContent = formatCurrency(data.commission);
    const commissionLabel = document.getElementById('profitCommissionLabel');
    if (commissionLabel && data.commission > 0) {
        const commissionRateInput = document.getElementById('ctvCommissionRate');
        if (commissionRateInput) {
            const rate = (parseFloat(commissionRateInput.value) * 100).toFixed(0);
            commissionLabel.textContent = `- Hoa hồng (${rate}%)`;
        } else {
            commissionLabel.textContent = '- Hoa hồng';
        }
    }

    // Update discount display in revenue breakdown (not in costs)
    const discountRowInRevenue = document.getElementById('profitDiscountRowInRevenue');
    if (data.discountAmount && data.discountAmount > 0) {
        if (discountRowInRevenue) {
            discountRowInRevenue.classList.remove('hidden');
            document.getElementById('profitDiscountInRevenue').textContent = `-${formatCurrency(data.discountAmount)}`;
        }
    } else {
        if (discountRowInRevenue) discountRowInRevenue.classList.add('hidden');
    }

    document.getElementById('profitTax').textContent = formatCurrency(data.tax);

    // Update tax label with current rate
    const taxRatePercent = (COST_CONSTANTS.TAX_RATE * 100).toFixed(1);
    document.getElementById('profitTaxLabel').textContent = `- Thuế (${taxRatePercent}%)`;

    document.getElementById('profitAmount').textContent = formatCurrency(data.profit);
    document.getElementById('profitMargin').textContent = `(${data.profitMargin.toFixed(1)}%)`;

    // Update colors based on profit margin
    const profitAmountEl = document.getElementById('profitAmount');
    const profitMarginEl = document.getElementById('profitMargin');
    const profitPreviewEl = document.getElementById('profitPreview');
    const profitWarningEl = document.getElementById('profitWarning');

    // Reset to base style
    profitPreviewEl.className = 'bg-white rounded-lg p-4 border';
    if (profitWarningEl) profitWarningEl.classList.add('hidden');

    // Only show warnings if there are products in the order
    const hasProducts = currentOrderProducts.length > 0;

    // Update profit amount color based on value
    if (data.profit > 0) {
        if (data.profitMargin > 40) {
            // Excellent profit
            profitAmountEl.className = 'text-xl font-bold text-emerald-600';
            profitMarginEl.className = 'text-xs text-emerald-600';
            profitPreviewEl.classList.add('border-emerald-200');
        } else if (data.profitMargin > 20) {
            // Good profit
            profitAmountEl.className = 'text-xl font-bold text-green-600';
            profitMarginEl.className = 'text-xs text-green-600';
            profitPreviewEl.classList.add('border-green-200');
        } else {
            // Low profit - warning (only if has products)
            profitAmountEl.className = 'text-xl font-bold text-yellow-600';
            profitMarginEl.className = 'text-xs text-yellow-600';
            profitPreviewEl.classList.add('border-yellow-300');
            if (profitWarningEl && hasProducts) {
                profitWarningEl.classList.remove('hidden');
                profitWarningEl.querySelector('p').textContent = '⚠️ Lãi thấp! Cân nhắc tăng giá hoặc giảm chi phí';
            }
        }
    } else {
        // Loss (only show warning if has products)
        profitAmountEl.className = 'text-xl font-bold text-red-600';
        profitMarginEl.className = 'text-xs text-red-600';
        profitPreviewEl.classList.add('border-red-300');
        if (profitWarningEl && hasProducts) {
            profitWarningEl.classList.remove('hidden');
            profitWarningEl.className = 'mt-3 p-2 bg-red-100 border border-red-300 rounded-lg';
            profitWarningEl.querySelector('p').textContent = '❌ Đơn hàng này sẽ LỖ! Vui lòng kiểm tra lại giá';
            profitWarningEl.querySelector('p').className = 'text-xs text-red-800 font-bold';
        }
    }
}

// Submit new order
async function submitNewOrder() {
    // Validate CTV code first
    if (!validateCTVCode()) {
        return; // Block submission if CTV is invalid
    }

    // Validate
    const customerName = document.getElementById('newOrderCustomerName')?.value.trim();
    const customerPhone = document.getElementById('newOrderCustomerPhone')?.value.trim();
    const address = document.getElementById('newOrderAddress')?.value.trim();

    // Get address 4 levels
    const provinceId = document.getElementById('newOrderProvince')?.value;
    const districtId = document.getElementById('newOrderDistrict')?.value;
    const wardId = document.getElementById('newOrderWard')?.value;
    const streetAddress = document.getElementById('newOrderStreetAddress')?.value.trim();

    if (!customerName) {
        showToast('Vui lòng nhập tên khách hàng', 'warning');
        document.getElementById('newOrderCustomerName')?.focus();
        return;
    }

    if (!customerPhone) {
        showToast('Vui lòng nhập số điện thoại', 'warning');
        document.getElementById('newOrderCustomerPhone')?.focus();
        return;
    }

    if (!/^0\d{9}$/.test(customerPhone)) {
        showToast('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)', 'warning');
        document.getElementById('newOrderCustomerPhone')?.focus();
        return;
    }

    if (!provinceId || !districtId || !wardId || !streetAddress) {
        showToast('Vui lòng chọn đầy đủ địa chỉ giao hàng (Tỉnh/Quận/Phường/Địa chỉ nhà)', 'warning');
        return;
    }

    if (currentOrderProducts.length === 0) {
        showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning');
        return;
    }

    console.log('🛒 Current order products:', currentOrderProducts);

    const referralCode = document.getElementById('newOrderReferralCode')?.value.trim();
    const paymentMethod = document.getElementById('newOrderPaymentMethod')?.value;
    const status = document.getElementById('newOrderStatus')?.value;

    // Get order notes from form
    const orderNotes = document.getElementById('newOrderNotes')?.value.trim() || null;

    // Calculate product total
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = p.price || 0;
        const qty = p.quantity || 1;
        return sum + (price * qty);
    }, 0);

    if (productTotal === 0) {
        showToast('Tổng tiền phải lớn hơn 0. Vui lòng nhập giá cho sản phẩm', 'warning');
        return;
    }

    // Get shipping costs
    const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value) || 0;
    const shippingCost = parseFloat(document.getElementById('newOrderShippingCost')?.value) || 0;

    // Get discount amount
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value || 0);

    // Calculate total amount (what customer actually pays)
    // totalAmount = productTotal + shippingFee - discountAmount
    const totalAmount = productTotal + shippingFee - discountAmount;

    console.log('🚢 Shipping values:', {
        shippingFee,
        shippingCost,
        shippingFeeInput: document.getElementById('newOrderShippingFee')?.value,
        shippingCostInput: document.getElementById('newOrderShippingCost')?.value
    });

    // Get address names
    const provinceName = window.addressSelector.getProvinceName(provinceId);
    const districtName = window.addressSelector.getDistrictName(provinceId, districtId);
    const wardName = window.addressSelector.getWardName(provinceId, districtId, wardId);

    // Get discount data if applied
    const discountCode = document.getElementById('appliedDiscountCode')?.value.trim() || null;
    const discountId = document.getElementById('appliedDiscountId')?.value || null;

    // Prepare request data matching server format
    const requestData = {
        action: 'createOrder',
        customer: {
            name: customerName,
            phone: customerPhone,
            address: address
        },
        province_id: provinceId,
        province_name: provinceName,
        district_id: districtId,
        district_name: districtName,
        ward_id: wardId,
        ward_name: wardName,
        street_address: streetAddress,
        products: currentOrderProducts,
        totalAmount: totalAmount,
        shippingFee: shippingFee,
        shippingCost: shippingCost,
        paymentMethod: paymentMethod,
        status: status,
        referralCode: referralCode || null,
        notes: orderNotes,
        discountCode: discountCode,
        discountAmount: discountAmount,
        discountId: discountId
    };

    console.log('📤 Sending createOrder request:', requestData);

    // Close modal immediately
    closeAddOrderModal();

    // Show loading toast with ID (không tự động ẩn)
    showToast('Đang tạo đơn hàng...', 'info', 0, 'create-order');

    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            // Toast thành công sẽ thay thế toast "đang tạo"
            showToast('Đã tạo đơn hàng thành công', 'success', null, 'create-order');
            loadOrdersData(); // Reload orders
        } else {
            throw new Error(data.error || 'Không thể tạo đơn hàng');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        // Toast lỗi sẽ thay thế toast "đang tạo"
        showToast('Không thể tạo đơn hàng: ' + error.message, 'error', null, 'create-order');
    }
}

// Duplicate order
function duplicateOrder(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Show modal with pre-filled data (không sao chép mã CTV và trạng thái)
    showAddOrderModal({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.address,
        // Address 4 levels
        province_id: order.province_id,
        district_id: order.district_id,
        ward_id: order.ward_id,
        street_address: order.street_address,
        referral_code: '', // Không sao chép mã CTV
        payment_method: order.payment_method,
        // status: Không sao chép - luôn để "pending" cho đơn mới
        shipping_fee: order.shipping_fee || 0,
        shipping_cost: order.shipping_cost || 0,
        // Discount info
        discount_code: order.discount_code || '',
        discount_amount: order.discount_amount || 0,
        products: products
    });

    showToast('Đã sao chép thông tin đơn hàng', 'info');
}


// ============================================
// MODAL PRODUCT SELECTION FUNCTIONS
// ============================================

// Render categories in modal
function renderModalCategories() {
    const container = document.getElementById('modalCategoriesGrid');
    if (!container) return;

    const categories = [
        ...allCategoriesList,
        { id: 'custom', name: 'Tự nhập', icon: null, color: '#6b7280' }
    ];

    container.innerHTML = categories.map(cat => {
        const isSelected = selectedCategory === cat.id;
        const isCustom = cat.id === 'custom';
        const categoryColor = cat.color || '#6b7280';

        return `
        <button onclick="selectModalCategory(${isCustom ? "'custom'" : cat.id})" 
            id="modal_cat_${cat.id}"
            class="group inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${isSelected
                ? 'border-purple-500 bg-purple-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-gray-50'
            }">
            
            <!-- Color Dot -->
            <div class="flex-shrink-0 w-2 h-2 rounded-full transition-all ${isSelected ? 'ring-2 ring-purple-400 ring-offset-1' : ''}" 
                style="background-color: ${isSelected ? '#a855f7' : categoryColor}">
            </div>
            
            <!-- Category Name -->
            <span class="text-sm font-medium whitespace-nowrap ${isSelected ? 'text-purple-900' : 'text-gray-700 group-hover:text-purple-700'}">${escapeHtml(cat.name)}</span>
            
            <!-- Selected Check Icon -->
            ${isSelected ? `
                <svg class="w-4 h-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `;
    }).join('');
}

// Select category in modal
function selectModalCategory(categoryId) {
    selectedCategory = categoryId;
    renderModalCategories();

    const step2Container = document.getElementById('modalStep2Container');
    const customFields = document.getElementById('modalCustomInputFields');
    const selectedDisplay = document.getElementById('modalSelectedProductDisplay');
    const detailsForm = document.getElementById('modalProductDetailsForm');
    const qtyContainer = document.getElementById('modalProductQtyContainer');
    const weightContainer = document.getElementById('modalProductWeightContainer');

    if (categoryId === 'custom') {
        // Custom input mode - hide step 2, show details form
        if (step2Container) step2Container.classList.add('hidden');
        if (detailsForm) detailsForm.classList.remove('hidden');

        // Show custom input fields, quantity and weight inputs
        if (customFields) customFields.classList.remove('hidden');
        if (selectedDisplay) selectedDisplay.classList.add('hidden');
        if (qtyContainer) qtyContainer.classList.remove('hidden');
        if (weightContainer) weightContainer.classList.remove('hidden');

        // Clear selected products
        selectedProducts = [];

        // Focus on name input
        setTimeout(() => document.getElementById('modalCustomProductNameInput')?.focus(), 100);
    } else {
        // Category selected - show step 2 and products list, hide details form
        if (step2Container) step2Container.classList.remove('hidden');
        if (detailsForm) detailsForm.classList.add('hidden');

        // Hide quantity and weight inputs (already have them in product list)
        if (qtyContainer) qtyContainer.classList.add('hidden');
        if (weightContainer) weightContainer.classList.add('hidden');

        renderModalProductsList(categoryId);

        // Hide custom input fields
        if (customFields) customFields.classList.add('hidden');
    }
}

// Render products list in modal
function renderModalProductsList(categoryId = null, searchQuery = '') {
    const container = document.getElementById('modalProductsList');
    if (!container) return;

    let products = allProductsList.filter(p => p.is_active !== 0);

    if (categoryId) {
        products = products.filter(p => p.category_id === categoryId);
    }

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.sku && p.sku.toLowerCase().includes(query))
        );
    }

    if (products.length === 0) {
        container.innerHTML = '<div class="col-span-2 p-8 text-center text-gray-500 text-sm italic">Không có sản phẩm nào</div>';
        return;
    }

    // Check if current category is "Vòng người lớn" to show "Size tay" instead of "Cân nặng"
    const currentCategory = allCategoriesList.find(c => c.id === categoryId);
    const categoryName = currentCategory ? currentCategory.name : '';
    const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');
    const weightLabel = isAdultBracelet ? 'Size tay' : 'Cân nặng';
    const weightPlaceholder = isAdultBracelet ? 'Size M' : '5kg';

    // Hiển thị số lượng sản phẩm
    const countText = `<div class="col-span-2 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium border-b border-gray-200">
        Tìm thấy ${products.length} sản phẩm
    </div>`;

    container.innerHTML = countText + products.map(p => {
        const isSelected = selectedProducts.includes(p.id);

        // Highlight search term
        let displayName = escapeHtml(p.name);
        if (searchQuery) {
            const regex = new RegExp(`(${escapeHtml(searchQuery)})`, 'gi');
            displayName = displayName.replace(regex, '<mark class="bg-yellow-200 px-0.5">$1</mark>');
        }

        return `
            <div onclick="selectModalProduct(${p.id})" 
                id="modal_product_${p.id}"
                class="bg-white flex flex-col gap-2 p-3 cursor-pointer hover:bg-purple-50 transition-all border-b border-r border-gray-100 ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500 ring-inset' : ''}">
                <div class="flex items-start gap-2">
                    <div class="flex-shrink-0 mt-0.5">
                        <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'}">
                            ${isSelected ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-900 text-sm leading-tight mb-1">${displayName}</p>
                        <p class="text-sm font-bold text-green-600">${formatCurrency(p.price || 0)}</p>
                        ${p.sku ? `<p class="text-xs text-gray-500 mt-0.5">SKU: ${escapeHtml(p.sku)}</p>` : ''}
                    </div>
                </div>
                ${isSelected ? `
                    <div class="pt-2 border-t border-purple-200">
                        <div class="grid grid-cols-12 gap-2">
                            <!-- Quantity (2 cols) -->
                            <div class="col-span-2">
                                <label class="text-xs text-gray-600 font-medium mb-1 block">SL</label>
                                <div class="flex items-center gap-1">
                                    <button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">-</button>
                                    <input type="number" id="qty_${p.id}" value="${productQuantities[p.id] || 1}" min="1" onclick="event.stopPropagation()" onchange="updateProductQuantity(${p.id}, this.value)" class="w-10 text-center border border-gray-300 rounded py-1 text-sm font-medium" />
                                    <button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">+</button>
                                </div>
                            </div>
                            <!-- Weight or Size (3 cols) -->
                            <div class="col-span-3">
                                <label class="text-xs text-gray-600 font-medium mb-1 block">${weightLabel}</label>
                                <input type="text" id="weight_${p.id}" value="${productWeights[p.id] || ''}" placeholder="${weightPlaceholder}" onclick="event.stopPropagation()" onchange="updateProductWeight(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
                            </div>
                            <!-- Notes (7 cols) -->
                            <div class="col-span-7">
                                <label class="text-xs text-gray-600 font-medium mb-1 block">Lưu ý</label>
                                <input type="text" id="notes_${p.id}" value="${productNotes[p.id] || ''}" placeholder="Ghi chú cho sản phẩm này..." onclick="event.stopPropagation()" onchange="updateProductNotes(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Select product in modal
function selectModalProduct(productId) {
    // Toggle selection
    const index = selectedProducts.indexOf(productId);
    if (index > -1) {
        // Already selected, remove it
        selectedProducts.splice(index, 1);
        // Remove quantity, weight and notes when deselected
        delete productQuantities[productId];
        delete productWeights[productId];
        delete productNotes[productId];
    } else {
        // Not selected, add it
        selectedProducts.push(productId);
        // Initialize quantity to 1
        productQuantities[productId] = 1;
        // Initialize weight and notes to empty
        productWeights[productId] = '';
        productNotes[productId] = '';
    }

    // Update display
    updateSelectedProductsDisplay();

    // Re-render list to update checkboxes (preserve search query if any)
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    renderModalProductsList(selectedCategory, searchQuery);
}

// Update selected products display
function updateSelectedProductsDisplay() {
    const display = document.getElementById('modalSelectedProductDisplay');
    if (!display) return;

    if (selectedProducts.length === 0) {
        display.classList.add('hidden');
        return;
    }

    display.classList.remove('hidden');
    const products = selectedProducts.map(id => allProductsList.find(p => p.id === id)).filter(p => p);

    const namesHtml = products.map(p => {
        const qty = productQuantities[p.id] || 1;
        return `<span class="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs mr-1 mb-1">${escapeHtml(p.name)} ${qty > 1 ? `<strong>x${qty}</strong>` : ''}</span>`;
    }).join('');

    const totalPrice = products.reduce((sum, p) => {
        const qty = productQuantities[p.id] || 1;
        return sum + ((p.price || 0) * qty);
    }, 0);

    document.getElementById('modalSelectedProductName').innerHTML = namesHtml;
    document.getElementById('modalSelectedProductPrice').textContent = `Tổng: ${formatCurrency(totalPrice)} (${selectedProducts.length} sản phẩm)`;
}

// Product quantity, weight, size and notes management
const productQuantities = {};
const productWeights = {};
const productSizes = {};
const productNotes = {};

// Toggle select all products
function toggleSelectAllProducts() {
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';

    let products = allProductsList.filter(p => p.is_active !== 0);

    // Apply category filter
    if (selectedCategory) {
        products = products.filter(p => p.category_id === selectedCategory);
    }

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.sku && p.sku.toLowerCase().includes(query))
        );
    }

    const allSelected = products.every(p => selectedProducts.includes(p.id));

    if (allSelected) {
        // Deselect all
        products.forEach(p => {
            const index = selectedProducts.indexOf(p.id);
            if (index > -1) {
                selectedProducts.splice(index, 1);
                delete productQuantities[p.id];
            }
        });
    } else {
        // Select all
        products.forEach(p => {
            if (!selectedProducts.includes(p.id)) {
                selectedProducts.push(p.id);
                productQuantities[p.id] = 1;
            }
        });
    }

    // Update button text
    const btn = document.getElementById('selectAllBtn');
    if (btn) {
        const allNowSelected = products.every(p => selectedProducts.includes(p.id));
        btn.textContent = allNowSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    }

    updateSelectedProductsDisplay();
    renderModalProductsList(selectedCategory, searchQuery);
}

function adjustProductQuantity(productId, delta) {
    const input = document.getElementById(`qty_${productId}`);
    if (!input) return;

    let currentQty = parseInt(input.value) || 1;
    currentQty = Math.max(1, currentQty + delta);
    input.value = currentQty;
    productQuantities[productId] = currentQty;
}

function updateProductQuantity(productId, value) {
    const qty = Math.max(1, parseInt(value) || 1);
    productQuantities[productId] = qty;
    const input = document.getElementById(`qty_${productId}`);
    if (input) input.value = qty;
    updateSelectedProductsDisplay();
}

function updateProductWeight(productId, value) {
    productWeights[productId] = value.trim();
}

function updateProductNotes(productId, value) {
    productNotes[productId] = value.trim();
}

// Setup product search in modal
function setupModalProductSearch() {
    const searchInput = document.getElementById('modalProductSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const query = this.value.trim();

        if (query.length === 0) {
            renderModalProductsList(selectedCategory, '');
            return;
        }

        // Use the updated renderModalProductsList with search query
        renderModalProductsList(selectedCategory, query);
    });
}

// Calculate profit for custom product in modal
function calculateModalCustomProfit() {
    const price = parseFloat(document.getElementById('modalCustomProductPriceInput')?.value) || 0;
    const costPrice = parseFloat(document.getElementById('modalCustomProductCostInput')?.value) || 0;

    const profitDisplay = document.getElementById('modalCustomProfitDisplay');
    const lossWarning = document.getElementById('modalCustomLossWarning');

    if (price > 0 && costPrice > 0) {
        const profit = price - costPrice;
        const margin = (profit / price) * 100;

        if (profit > 0) {
            // Show profit
            document.getElementById('modalCustomProfitAmount').textContent = formatCurrency(profit);
            document.getElementById('modalCustomProfitMargin').textContent = margin.toFixed(1);
            profitDisplay.classList.remove('hidden');
            lossWarning.classList.add('hidden');
        } else {
            // Show loss warning
            profitDisplay.classList.add('hidden');
            lossWarning.classList.remove('hidden');
        }
    } else {
        profitDisplay.classList.add('hidden');
        lossWarning.classList.add('hidden');
    }
}

// Add product from modal
function addProductFromModal() {
    // Check if adding to existing order or new order
    if (currentEditingOrderId) {
        saveProductsToExistingOrder();
        return;
    }

    // Get common details
    let weight = document.getElementById('modalProductWeightInput')?.value.trim();
    const quantity = parseInt(document.getElementById('modalProductQtyInput')?.value) || 1;

    // Check if current category is "Vòng người lớn" first
    const currentCategory = allCategoriesList.find(c => c.id === selectedCategory);
    const categoryName = currentCategory ? currentCategory.name : '';
    const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');

    // Auto-add "cm" or "kg" to weight if only number is entered
    if (weight && /^\d+(\.\d+)?$/.test(weight)) {
        weight = weight + (isAdultBracelet ? 'cm' : 'kg');
    }

    // Check if there are selected products from list (normal mode)
    if (selectedProducts.length > 0) {
        const weightFieldName = isAdultBracelet ? 'size tay' : 'cân nặng';

        // Validate: All selected products must have weight/size
        const missingWeightProducts = [];
        selectedProducts.forEach(productId => {
            const productWeight = productWeights[productId] || '';
            if (!productWeight.trim()) {
                const product = allProductsList.find(p => p.id === productId);
                if (product) {
                    missingWeightProducts.push(product.name);
                }
            }
        });

        if (missingWeightProducts.length > 0) {
            showToast(`Vui lòng nhập ${weightFieldName} cho: ${missingWeightProducts.join(', ')}`, 'warning');
            return;
        }

        // Normal mode - add selected products from list
        const addedCount = selectedProducts.length; // Save count before closing modal

        selectedProducts.forEach(productId => {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                // Get quantity, weight, cost_price and notes for this specific product
                const productQty = productQuantities[productId] || 1;
                let productWeight = productWeights[productId] || '';
                const productNote = productNotes[productId] || '';

                // Auto-add "cm" or "kg" to weight/size if only number is entered
                if (productWeight && /^\d+(\.\d+)?$/.test(productWeight)) {
                    productWeight = productWeight + (isAdultBracelet ? 'cm' : 'kg');
                }

                // Check if product with same name, weight/size and notes already exists
                const existingProduct = currentOrderProducts.find(p => {
                    const pWeightOrSize = isAdultBracelet ? (p.size || '') : (p.weight || '');
                    return p.name === product.name &&
                        pWeightOrSize === (productWeight || '') &&
                        (p.notes || '') === (productNote || '');
                });

                if (existingProduct) {
                    // Product exists, increase quantity
                    existingProduct.quantity += productQty;
                } else {
                    // New product, add to list
                    const newProduct = {
                        name: product.name,
                        quantity: productQty
                    };
                    if (product.price > 0) newProduct.price = product.price;
                    if (product.cost_price) newProduct.cost_price = product.cost_price;

                    // Save to weight or size based on product type
                    if (productWeight) {
                        if (isAdultBracelet) {
                            newProduct.size = productWeight;
                        } else {
                            newProduct.weight = productWeight;
                        }
                    }

                    if (productNote) newProduct.notes = productNote;

                    currentOrderProducts.push(newProduct);
                }
            }
        });

        renderOrderProducts();
        updateOrderSummary();
        updateOrderNotesDisplay();
        closeProductSelectionModal();
        showToast(`Đã thêm ${addedCount} sản phẩm`, 'success');
        return;
    }

    // Custom input mode (Tự nhập) - only if no products selected
    const customName = document.getElementById('modalCustomProductNameInput')?.value.trim();
    const customPrice = parseFloat(document.getElementById('modalCustomProductPriceInput')?.value) || 0;
    const customCostPrice = parseFloat(document.getElementById('modalCustomProductCostInput')?.value) || 0;
    const customQuantity = parseInt(document.getElementById('modalCustomProductQtyInput')?.value) || 1;
    let customWeight = document.getElementById('modalCustomProductWeightInput')?.value.trim() || '';
    const customNotes = document.getElementById('modalCustomProductNotesInput')?.value.trim() || '';

    // Auto-add "kg" to custom weight if only number is entered (user can manually type "cm" if needed)
    if (customWeight && /^\d+(\.\d+)?$/.test(customWeight)) {
        customWeight = customWeight + 'kg';
    }

    if (!customName) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        document.getElementById('modalCustomProductNameInput')?.focus();
        return;
    }

    if (customPrice <= 0) {
        showToast('Vui lòng nhập giá sản phẩm', 'warning');
        document.getElementById('modalCustomProductPriceInput')?.focus();
        return;
    }

    // Check if custom product with same attributes already exists
    const existingProduct = currentOrderProducts.find(p =>
        p.name === customName &&
        (p.weight || '') === (customWeight || '') &&
        (p.notes || '') === (customNotes || '') &&
        p.price === customPrice
    );

    if (existingProduct) {
        // Product exists, increase quantity
        existingProduct.quantity += customQuantity;
    } else {
        // Add new custom product
        const newProduct = {
            name: customName,
            price: customPrice,
            quantity: customQuantity
        };

        if (customCostPrice > 0) newProduct.cost_price = customCostPrice;

        // Auto-detect if it's size (cm) or weight (kg)
        if (customWeight) {
            if (customWeight.includes('cm') || customWeight.toLowerCase().includes('size')) {
                newProduct.size = customWeight;
            } else {
                newProduct.weight = customWeight;
            }
        }

        if (customNotes) newProduct.notes = customNotes;

        currentOrderProducts.push(newProduct);
    }

    renderOrderProducts();
    updateOrderSummary();
    updateOrderNotesDisplay();
    closeProductSelectionModal();
    showToast('Đã thêm sản phẩm', 'success');
}


















let productRowCounter = 0;


// ============================================
// QUICK ADD FUNCTIONS FOR BEST SELLING PRODUCTS
// ============================================

// Change quantity in quick add input
function quickChangeQty(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const currentVal = parseInt(input.value) || 1;
    const newVal = Math.max(1, currentVal + delta);
    input.value = newVal;
}

// Quick add product to order (for best selling products)
function quickAddProductToOrder(productId, productName, price, costPrice, qtyInputId, sizeInputId) {
    const qtyInput = document.getElementById(qtyInputId);
    const sizeInput = document.getElementById(sizeInputId);

    const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
    const size = sizeInput ? sizeInput.value.trim() : null;

    // Validate: Size is required for best selling products
    if (!size) {
        showToast('Vui lòng nhập size trước khi thêm sản phẩm', 'warning');
        if (sizeInput) {
            sizeInput.focus();
            sizeInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            setTimeout(() => {
                sizeInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            }, 2000);
        }
        return;
    }

    // Add product to current order
    const product = {
        id: productId,
        name: productName,
        price: price,
        cost_price: costPrice,
        quantity: quantity,
        size: size || null,
        notes: null
    };

    currentOrderProducts.push(product);

    // Reset quantity to 1 and clear size
    if (qtyInput) {
        qtyInput.value = 1;
    }
    if (sizeInput) {
        sizeInput.value = '';
    }

    // Re-render products list and update summary
    renderOrderProducts();
    updateOrderSummary();

    // Show success toast with size info
    const sizeText = size ? ` (${size})` : '';
    showToast(`Đã thêm ${quantity}x ${productName}${sizeText}`, 'success');
}

// Quick add product with quantity (for freeship products)
function quickAddProductWithQty(productName, price, qtyInputId) {
    const qtyInput = document.getElementById(qtyInputId);
    const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;

    if (quantity === 0) {
        showToast('Số lượng phải lớn hơn 0', 'warning');
        return;
    }

    // Find product in list
    const product = allProductsList.find(p => p.name === productName);
    if (!product) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    // Add to current order
    const orderProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        cost_price: product.cost_price || 0,
        quantity: quantity,
        size: null,
        notes: null
    };

    currentOrderProducts.push(orderProduct);

    // Reset quantity to 1
    if (qtyInput) {
        qtyInput.value = 1;
    }

    // Re-render and update
    renderOrderProducts();
    updateOrderSummary();

    showToast(`Đã thêm ${quantity}x ${productName}`, 'success');
}


// Toggle freeship products section
function toggleFreeshipProducts() {
    const section = document.getElementById('freeshipProductsSection');
    const button = document.getElementById('toggleFreeshipBtn');

    if (!section) return;

    if (section.classList.contains('hidden')) {
        // Show section
        section.classList.remove('hidden');
        if (button) button.classList.add('hidden');
    } else {
        // Hide section
        section.classList.add('hidden');
        if (button) button.classList.remove('hidden');
    }
}


// Toggle freeship products section
function toggleFreeshipProducts() {
    const section = document.getElementById('freeshipProductsSection');
    const icon = document.getElementById('toggleFreeshipIcon');
    const text = document.getElementById('toggleFreeshipText');

    if (!section) return;

    if (section.classList.contains('hidden')) {
        // Show section
        section.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
        if (text) text.textContent = 'Ẩn sản phẩm bán kèm';
    } else {
        // Hide section
        section.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
        if (text) text.textContent = 'Xem sản phẩm bán kèm';
    }
}

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



















/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayDateString() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return vnDateStr;
}

/**
 * Get start of last 7 days in VN timezone (7 ngày qua, không phải tuần này)
 * Note: This overrides getVNStartOfWeek() from timezone-utils.js which returns "this week"
 */
function getVNStartOfLast7Days() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const today = new Date(vnDateStr + 'T00:00:00+07:00');

    // Lùi lại 7 ngày (không phải tuần này, mà là 7 ngày qua)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sevenDaysAgo;
}

/**
 * Get start of last 30 days in VN timezone (30 ngày qua)
 * Note: This overrides getVNStartOfMonth() from timezone-utils.js which returns "this month"
 */
function getVNStartOfLast30Days() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const today = new Date(vnDateStr + 'T00:00:00+07:00');

    // Lùi lại 30 ngày
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return thirtyDaysAgo;
}

/**
 * Get start of a specific date in VN timezone
 */
function getVNStartOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T00:00:00+07:00');
    return vnDateTime;
}

/**
 * Get end of a specific date in VN timezone
 */
function getVNEndOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T23:59:59.999+07:00');
    return vnDateTime;
}


// ============================================
// SHIPPING COST AUTO-SYNC
// ============================================

// Setup auto-sync shipping cost with shipping fee (for display only, not input)
function setupShippingCostSync() {
    // No auto-sync for input fields - keep database values
    // Only sync in display/summary section via updateOrderSummary()
}
// ============================================
// URL HASH HANDLING FOR SHAREABLE LINKS
// ============================================

// Check URL hash and auto-open modal if needed
function checkUrlHash() {
    const hash = window.location.hash;

    if (hash === '#add-order') {
        // Wait a bit for page to fully load
        setTimeout(() => {
            showAddOrderModal();
        }, 500);
    }
}

// Listen for hash changes (when user clicks back/forward)
window.addEventListener('hashchange', function () {
    checkUrlHash();
});


// ============================================
// ============================================
// CUSTOM PRODUCT MODAL (Thêm sản phẩm tùy chỉnh)
// ============================================

// Show custom product modal (Tự nhập) - SỬ DỤNG FORM CÓ SẴN
function showCustomProductModal() {
    // Reset selected products để chỉ dùng custom input
    selectedProducts = [];
    selectedCategory = 'custom';

    const modal = document.createElement('div');
    modal.id = 'customProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white">Tự nhập sản phẩm</h3>
                            <p class="text-white/80 text-sm">Sản phẩm không có trong danh sách</p>
                        </div>
                    </div>
                    <button onclick="closeCustomProductModal()" class="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-all">
                        <svg class="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Form - SỬ DỤNG FORM CÓ SẴN TỪ MODAL GỐC -->
            <div class="p-6">
                <div class="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 rounded-xl p-4 border border-purple-200">
                    <!-- Form Fields -->
                    <div class="space-y-3">
                        <!-- Product Name -->
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                Tên sản phẩm <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="modalCustomProductNameInput" 
                                placeholder="Nhập tên sản phẩm..." 
                                class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                        </div>

                        <!-- Price and Cost Price Grid -->
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Giá bán <span class="text-red-500">*</span>
                                </label>
                                <div class="relative">
                                    <input type="number" id="modalCustomProductPriceInput" 
                                        placeholder="50000" 
                                        min="0" 
                                        step="1000" 
                                        oninput="calculateModalCustomProfit()"
                                        class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                                    <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                    💰 Giá vốn
                                </label>
                                <div class="relative">
                                    <input type="number" id="modalCustomProductCostInput" 
                                        placeholder="25000" 
                                        min="0" 
                                        step="1000" 
                                        oninput="calculateModalCustomProfit()"
                                        class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                                    <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                </div>
                            </div>
                        </div>

                        <!-- Profit Display -->
                        <div id="modalCustomProfitDisplay" class="hidden">
                            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-600">Lãi dự kiến:</span>
                                    <div class="text-right">
                                        <span id="modalCustomProfitAmount" class="text-sm font-bold text-green-600">0đ</span>
                                        <span class="text-xs text-green-500 ml-2">(<span id="modalCustomProfitMargin">0</span>%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="modalCustomLossWarning" class="hidden">
                            <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <p class="text-xs text-red-600 font-medium">⚠️ Giá vốn cao hơn giá bán!</p>
                            </div>
                        </div>

                        <!-- Quantity and Weight Grid -->
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Số lượng
                                </label>
                                <input type="number" id="modalCustomProductQtyInput" 
                                    value="1" 
                                    min="1" 
                                    class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Cân nặng
                                </label>
                                <input type="text" id="modalCustomProductWeightInput" 
                                    placeholder="5kg" 
                                    class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                            </div>
                        </div>

                        <!-- Notes -->
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                Lưu ý
                            </label>
                            <textarea id="modalCustomProductNotesInput" 
                                rows="2" 
                                placeholder="Ghi chú thêm về sản phẩm..." 
                                class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all resize-none"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button onclick="closeCustomProductModal()" class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="addProductFromModal(); closeCustomProductModal();" class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Thêm vào đơn
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first input
    setTimeout(() => document.getElementById('modalCustomProductNameInput')?.focus(), 100);
}

// Close custom product modal
function closeCustomProductModal() {
    const modal = document.getElementById('customProductModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}
