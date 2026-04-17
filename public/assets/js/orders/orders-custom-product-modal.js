// ============================================
// CUSTOM PRODUCT MODAL (Thêm sản phẩm tùy chỉnh)
// ============================================
// formatVnMoneyInput: orders-utils.js

/**
 * Hiển thị lãi / cảnh báo lỗ khi nhập giá trong modal tự nhập SP
 */
function calculateModalCustomProfit() {
    const priceEl = document.getElementById('modalCustomProductPriceInput');
    const costEl = document.getElementById('modalCustomProductCostInput');
    const profitWrap = document.getElementById('modalCustomProfitDisplay');
    const lossWrap = document.getElementById('modalCustomLossWarning');
    const profitAmt = document.getElementById('modalCustomProfitAmount');
    const profitPct = document.getElementById('modalCustomProfitMargin');
    if (!priceEl || !costEl || !profitWrap || !lossWrap) return;

    const price = parsePrice(priceEl.value);
    const cost = parsePrice(costEl.value);
    if (price <= 0 && cost <= 0) {
        profitWrap.classList.add('hidden');
        lossWrap.classList.add('hidden');
        return;
    }

    const profit = price - cost;
    const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;

    if (cost > 0 && cost > price) {
        lossWrap.classList.remove('hidden');
        profitWrap.classList.add('hidden');
        return;
    }
    lossWrap.classList.add('hidden');
    profitWrap.classList.remove('hidden');
    if (profitAmt) profitAmt.textContent = formatCurrency(Math.max(0, profit));
    if (profitPct) profitPct.textContent = String(marginPct);
}

/**
 * Đọc form modal tự nhập và push vào currentOrderProducts (không có product_id catalog).
 * Tách biệt addProductFromModal — chỉ dùng cho SP chọn từ danh sách (selectedProducts).
 */
function addCustomProductToOrder() {
    const nameEl = document.getElementById('modalCustomProductNameInput');
    const priceEl = document.getElementById('modalCustomProductPriceInput');
    const costEl = document.getElementById('modalCustomProductCostInput');
    const qtyEl = document.getElementById('modalCustomProductQtyInput');
    const weightEl = document.getElementById('modalCustomProductWeightInput');
    const notesEl = document.getElementById('modalCustomProductNotesInput');

    if (!nameEl || !priceEl) {
        console.warn('addCustomProductToOrder: thiếu DOM modal tự nhập');
        return;
    }

    const name = nameEl.value.trim();
    const price = parsePrice(priceEl.value);
    const costPrice = costEl ? parsePrice(costEl.value) : 0;
    const quantity = Math.max(1, parseInt(qtyEl?.value, 10) || 1);
    let weightRaw = (weightEl?.value || '').trim();
    const notes = (notesEl?.value || '').trim();

    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        nameEl.focus();
        return;
    }
    if (!price || price <= 0) {
        showToast('Vui lòng nhập giá bán hợp lệ', 'warning');
        priceEl.focus();
        return;
    }

    // Chuẩn hóa cân: chỉ nhập số thì gắn đơn vị kg (thống nhất luồng catalog)
    let weight = weightRaw;
    if (weight && /^\d+(\.\d+)?$/.test(weight)) {
        weight = `${weight}kg`;
    }

    const existing = currentOrderProducts.find((p) => {
        const sameCustom = p.product_id == null && p.id == null;
        if (!sameCustom) return false;
        const w = p.weight || '';
        const n = p.notes || '';
        return p.name === name && w === (weight || '') && n === notes;
    });

    if (existing) {
        existing.quantity += quantity;
    } else {
        const row = {
            name,
            quantity,
            price
        };
        if (costPrice > 0) row.cost_price = costPrice;
        if (weight) row.weight = weight;
        if (notes) row.notes = notes;
        currentOrderProducts.push(row);
    }

    renderOrderProducts();
    updateOrderSummary();
    if (typeof updateOrderNotesDisplay === 'function') {
        updateOrderNotesDisplay();
    }
    closeCustomProductModal();
    selectedCategory = null;
    showToast('Đã thêm sản phẩm tùy chỉnh', 'success');
}

/**
 * Show custom product modal (Tự nhập) - SỬ DỤNG FORM CÓ SẴN
 * Modal này cho phép người dùng tự nhập thông tin sản phẩm không có trong danh sách
 */
function showCustomProductModal() {
    document.getElementById('customOrderLineEditModal')?.remove();

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
                                    <input type="text" id="modalCustomProductPriceInput" 
                                        inputmode="numeric" autocomplete="off"
                                        placeholder="90.000" 
                                        oninput="formatVnMoneyInput(this); calculateModalCustomProfit();"
                                        class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                                    <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                    💰 Giá vốn
                                </label>
                                <div class="relative">
                                    <input type="text" id="modalCustomProductCostInput" 
                                        inputmode="numeric" autocomplete="off"
                                        placeholder="50.000" 
                                        oninput="formatVnMoneyInput(this); calculateModalCustomProfit();"
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
                <button onclick="addCustomProductToOrder()" class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Thêm vào đơn
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first input
    setTimeout(() => document.getElementById('modalCustomProductNameInput')?.focus(), 100);
}

/**
 * Close custom product modal
 */
function closeCustomProductModal() {
    const modal = document.getElementById('customProductModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// ─── Chỉnh sửa dòng sản phẩm tùy chỉnh (đơn đã tồn tại, không có product_id trong kho) ───

const CUSTOM_ORDER_EDIT_SPINNER = '<svg class="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';

function setCustomOrderEditBtnLoading(loading) {
    const btn = document.getElementById('customOrderEditSaveBtn');
    if (!btn) return;
    if (loading) {
        if (btn.dataset.loading === '1') return;
        btn.dataset.loading = '1';
        btn.dataset.prevHtml = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('cursor-wait', 'opacity-95');
        btn.innerHTML = `<span class="inline-flex items-center justify-center gap-2">${CUSTOM_ORDER_EDIT_SPINNER}<span>Đang cập nhật...</span></span>`;
    } else {
        delete btn.dataset.loading;
        btn.disabled = false;
        btn.classList.remove('cursor-wait', 'opacity-95');
        if (btn.dataset.prevHtml !== undefined) {
            btn.innerHTML = btn.dataset.prevHtml;
            delete btn.dataset.prevHtml;
        }
    }
}

function closeCustomOrderLineEditModal() {
    const modal = document.getElementById('customOrderLineEditModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 150);
    }
    window.customOrderEditContext = null;
}

/**
 * Form giống "Tự nhập sản phẩm", dùng khi sửa dòng không gắn kho (không product_id hoặc SP đã xóa khỏi kho).
 */
function showCustomProductModalForOrderEdit(orderId, orderCode, productIndex, product) {
    closeCustomProductModal();
    document.getElementById('customOrderLineEditModal')?.remove();

    window.customOrderEditContext = { orderId, orderCode, productIndex };

    const unitPrice = product.price != null && product.price !== '' ? Number(product.price) : 0;
    const unitCost = product.cost_price != null && product.cost_price !== '' ? Number(product.cost_price) : 0;
    const qty = Math.max(1, parseInt(product.quantity, 10) || 1);
    const name = (product.name || '').trim();
    const weightDisplay = product.size !== undefined && product.size !== null && String(product.size).trim()
        ? String(product.size).trim()
        : (product.weight != null ? String(product.weight).trim() : '');
    const notes = product.notes != null ? String(product.notes) : '';

    const priceStr = unitPrice > 0 && Number.isFinite(unitPrice) ? formatVnIntegerString(Math.round(unitPrice)) : '';
    const costStr = unitCost > 0 && Number.isFinite(unitCost) ? formatVnIntegerString(Math.round(unitCost)) : '';

    const modal = document.createElement('div');
    modal.id = 'customOrderLineEditModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white">Chỉnh sửa sản phẩm tùy chỉnh</h3>
                            <p class="text-white/80 text-sm">Không có trong danh mục kho — chỉnh tên, giá, SL, cân/size, lưu ý</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeCustomOrderLineEditModal()" class="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-all">
                        <svg class="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="p-6">
                <div class="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 rounded-xl p-4 border border-purple-200">
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                Tên sản phẩm <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="orderEditCustomNameInput" value="${escapeHtml(name)}"
                                placeholder="Nhập tên sản phẩm..."
                                class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Giá bán (đơn giá) <span class="text-red-500">*</span>
                                </label>
                                <div class="relative">
                                    <input type="text" id="orderEditCustomPriceInput" value="${escapeHtml(priceStr)}"
                                        inputmode="numeric" autocomplete="off"
                                        placeholder="90.000"
                                        oninput="formatVnMoneyInput(this); calculateOrderEditCustomProfit();"
                                        class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
                                    <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">💰 Giá vốn</label>
                                <div class="relative">
                                    <input type="text" id="orderEditCustomCostInput" value="${escapeHtml(costStr)}"
                                        inputmode="numeric" autocomplete="off"
                                        placeholder="50.000"
                                        oninput="formatVnMoneyInput(this); calculateOrderEditCustomProfit();"
                                        class="w-full px-3 py-2 pr-7 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" />
                                    <span class="absolute right-2 top-2 text-xs text-gray-400">đ</span>
                                </div>
                            </div>
                        </div>

                        <div id="orderEditCustomProfitDisplay" class="hidden">
                            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-600">Lãi dự kiến:</span>
                                    <div class="text-right">
                                        <span id="orderEditCustomProfitAmount" class="text-sm font-bold text-green-600">0đ</span>
                                        <span class="text-xs text-green-500 ml-2">(<span id="orderEditCustomProfitMargin">0</span>%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="orderEditCustomLossWarning" class="hidden">
                            <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <p class="text-xs text-red-600 font-medium">⚠️ Giá vốn cao hơn giá bán!</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">Số lượng</label>
                                <input type="number" id="orderEditCustomQtyInput" value="${qty}" min="1"
                                    class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1.5">Cân nặng / size</label>
                                <input type="text" id="orderEditCustomWeightInput" value="${escapeHtml(weightDisplay)}"
                                    placeholder="5kg hoặc 16cm"
                                    class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" />
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-700 mb-1.5">Lưu ý</label>
                            <textarea id="orderEditCustomNotesInput" rows="2" placeholder="Ghi chú thêm về sản phẩm..."
                                class="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all resize-none">${escapeHtml(notes)}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button type="button" onclick="closeCustomOrderLineEditModal()" class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button type="button" id="customOrderEditSaveBtn" onclick="saveCustomProductEditToOrder()" class="px-5 py-2.5 min-w-[140px] inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Cập nhật
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => {
        calculateOrderEditCustomProfit();
        document.getElementById('orderEditCustomNameInput')?.focus();
    }, 80);
}

function calculateOrderEditCustomProfit() {
    const priceEl = document.getElementById('orderEditCustomPriceInput');
    const costEl = document.getElementById('orderEditCustomCostInput');
    const profitWrap = document.getElementById('orderEditCustomProfitDisplay');
    const lossWrap = document.getElementById('orderEditCustomLossWarning');
    const profitAmt = document.getElementById('orderEditCustomProfitAmount');
    const profitPct = document.getElementById('orderEditCustomProfitMargin');
    if (!priceEl || !costEl || !profitWrap || !lossWrap) return;

    const price = parsePrice(priceEl.value);
    const cost = parsePrice(costEl.value);
    if (price <= 0 && cost <= 0) {
        profitWrap.classList.add('hidden');
        lossWrap.classList.add('hidden');
        return;
    }

    const profit = price - cost;
    const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;

    if (cost > 0 && cost > price) {
        lossWrap.classList.remove('hidden');
        profitWrap.classList.add('hidden');
        return;
    }
    lossWrap.classList.add('hidden');
    profitWrap.classList.remove('hidden');
    if (profitAmt) profitAmt.textContent = formatCurrency(Math.max(0, profit));
    if (profitPct) profitPct.textContent = String(marginPct);
}

async function saveCustomProductEditToOrder() {
    const ctx = window.customOrderEditContext;
    if (!ctx) return;

    const nameEl = document.getElementById('orderEditCustomNameInput');
    const priceEl = document.getElementById('orderEditCustomPriceInput');
    const costEl = document.getElementById('orderEditCustomCostInput');
    const qtyEl = document.getElementById('orderEditCustomQtyInput');
    const weightEl = document.getElementById('orderEditCustomWeightInput');
    const notesEl = document.getElementById('orderEditCustomNotesInput');

    if (!nameEl || !priceEl) return;

    const name = nameEl.value.trim();
    const unitPrice = parsePrice(priceEl.value);
    const unitCost = costEl ? parsePrice(costEl.value) : 0;
    const quantity = Math.max(1, parseInt(qtyEl?.value, 10) || 1);
    let weightRaw = (weightEl?.value || '').trim();
    const notes = (notesEl?.value || '').trim();

    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        nameEl.focus();
        return;
    }
    if (!unitPrice || unitPrice <= 0) {
        showToast('Vui lòng nhập giá bán hợp lệ', 'warning');
        priceEl.focus();
        return;
    }

    let weight = weightRaw;
    if (weight && /^\d+(\.\d+)?$/.test(weight)) {
        weight = `${weight}kg`;
    }

    setCustomOrderEditBtnLoading(true);

    try {
        const orderIndex = allOrdersData.findIndex((o) => o.id === ctx.orderId);
        if (orderIndex === -1) throw new Error('Không tìm thấy đơn hàng');

        const order = allOrdersData[orderIndex];
        let products = [];
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            const lines = order.products.split(/[,\n]/).map((line) => line.trim()).filter(Boolean);
            products = lines.map((line) => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                return match ? { name: match[1].trim(), quantity: parseInt(match[2], 10) } : { name: line, quantity: 1 };
            });
        }

        if (ctx.productIndex < 0 || ctx.productIndex >= products.length) {
            throw new Error('Không tìm thấy dòng sản phẩm');
        }

        const updatedProduct = {
            name,
            quantity
        };
        if (unitPrice > 0) updatedProduct.price = unitPrice;
        if (unitCost > 0) updatedProduct.cost_price = unitCost;
        if (notes) updatedProduct.notes = notes;
        if (weight) {
            if (/cm/i.test(weight)) updatedProduct.size = weight;
            else updatedProduct.weight = weight;
        }

        delete updatedProduct.product_id;
        delete updatedProduct.id;

        products[ctx.productIndex] = updatedProduct;

        const updatedProductsJson = JSON.stringify(products);

        const shouldFreeship = _shouldFreeship(products);
        const curFee = order.shipping_fee || 0;
        const newShippingFee = shouldFreeship ? 0 : (curFee === 0 ? _getCustomerShippingFee() : curFee);

        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: ctx.orderId,
                products: updatedProductsJson,
                shipping_fee: newShippingFee
            })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể cập nhật');

        const updates = { products: updatedProductsJson };
        if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
        if (data.shipping_fee !== undefined) updates.shipping_fee = data.shipping_fee;
        if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
        if (data.commission !== undefined) updates.commission = data.commission;

        updateOrderData(ctx.orderId, updates);
        updateStats();
        renderOrdersTable();
        closeCustomOrderLineEditModal();
        showToast('Cập nhật đơn hàng thành công', 'success');
    } catch (err) {
        console.error('saveCustomProductEditToOrder', err);
        setCustomOrderEditBtnLoading(false);
        showToast('Không thể cập nhật: ' + err.message, 'error');
    }
}
