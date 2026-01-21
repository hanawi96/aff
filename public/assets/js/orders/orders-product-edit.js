// ============================================
// ORDERS PRODUCT EDIT - Chỉnh sửa và xóa sản phẩm
// ============================================
// Chức năng: Sửa, xóa sản phẩm trong đơn hàng và modal tự nhập sản phẩm

// Store unit prices for new order modal
let editOrderUnitPrice = 0;
let editOrderUnitCost = 0;
let editOrderIsUpdating = false;

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

    console.log('🔧 editProductInOrder - Opening modal for product:', {
        index,
        product: JSON.parse(JSON.stringify(product)),
        price: product.price,
        cost_price: product.cost_price,
        quantity: product.quantity
    });

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

    // Initialize unit prices correctly
    // product.price and product.cost_price are ALWAYS unit prices (per item)
    editOrderUnitPrice = parsePrice(product.price);
    editOrderUnitCost = parsePrice(product.cost_price);

    console.log('💰 Initialized unit prices:', {
        editOrderUnitPrice,
        editOrderUnitCost,
        quantity: product.quantity,
        expectedTotalPrice: editOrderUnitPrice * (product.quantity || 1),
        expectedTotalCost: editOrderUnitCost * (product.quantity || 1)
    });

    // Focus first input
    setTimeout(() => {
        document.getElementById('editProductName')?.focus();
        // Update display to show total prices based on quantity
        updateEditModalDisplay();
    }, 100);
}

// Close edit product modal
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.remove();
    }
}

// Update edit modal display with total prices
function updateEditModalDisplay() {
    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQty');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;

    console.log('📊 updateEditModalDisplay called:', {
        quantity,
        editOrderUnitPrice,
        editOrderUnitCost,
        calculatedTotalPrice: editOrderUnitPrice * quantity,
        calculatedTotalCost: editOrderUnitCost * quantity
    });

    // Display total prices (unit price * quantity)
    if (editOrderUnitPrice > 0) {
        priceInput.value = editOrderUnitPrice * quantity;
    }
    if (editOrderUnitCost > 0) {
        costPriceInput.value = editOrderUnitCost * quantity;
    }

    console.log('✅ Updated input values:', {
        priceInputValue: priceInput.value,
        costPriceInputValue: costPriceInput.value
    });

    // Update unit price labels
    updateUnitPriceLabels(quantity);
}

// Update unit price labels
function updateUnitPriceLabels(quantity) {
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

// Calculate and update unit prices in edit modal (for new order)
function calculateEditProfit(sourceField = null) {
    if (editOrderIsUpdating) return;

    console.log('🧮 calculateEditProfit called:', { sourceField });

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQty');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;
    const currentPriceValue = parseFloat(priceInput.value) || 0;
    const currentCostValue = parseFloat(costPriceInput.value) || 0;

    console.log('📥 Current values:', {
        quantity,
        currentPriceValue,
        currentCostValue,
        editOrderUnitPrice_before: editOrderUnitPrice,
        editOrderUnitCost_before: editOrderUnitCost
    });

    // When user edits price/cost directly, update unit price
    if (sourceField === 'price') {
        editOrderUnitPrice = currentPriceValue / quantity;
        console.log('💵 Updated unit price:', editOrderUnitPrice);
    }
    if (sourceField === 'cost') {
        editOrderUnitCost = currentCostValue / quantity;
        console.log('💰 Updated unit cost:', editOrderUnitCost);
    }

    // When quantity changes, recalculate total prices
    if (sourceField === 'quantity') {
        console.log('🔢 Quantity changed, recalculating totals...');
        editOrderIsUpdating = true;
        if (editOrderUnitPrice > 0) {
            const newTotalPrice = editOrderUnitPrice * quantity;
            priceInput.value = newTotalPrice;
            console.log('  → New total price:', newTotalPrice);
        }
        if (editOrderUnitCost > 0) {
            const newTotalCost = editOrderUnitCost * quantity;
            costPriceInput.value = newTotalCost;
            console.log('  → New total cost:', newTotalCost);
        }
        editOrderIsUpdating = false;
    }

    console.log('📤 Final unit prices:', {
        editOrderUnitPrice,
        editOrderUnitCost
    });

    // Update unit price labels
    updateUnitPriceLabels(quantity);
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

    console.log('💾 saveEditedProduct called:', {
        index,
        name,
        quantity,
        unitPrice: price,
        unitCost: costPrice,
        size,
        notes
    });

    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        return;
    }

    // Update product - preserve product_id if it exists
    const oldProduct = currentOrderProducts[index];
    currentOrderProducts[index] = {
        name: name,
        quantity: quantity
    };

    // Preserve product_id if it exists
    if (oldProduct && oldProduct.product_id) {
        currentOrderProducts[index].product_id = oldProduct.product_id;
    }
    if (oldProduct && oldProduct.id) {
        currentOrderProducts[index].id = oldProduct.id;
    }

    if (price > 0) currentOrderProducts[index].price = price;
    if (costPrice > 0) currentOrderProducts[index].cost_price = costPrice;
    if (size) currentOrderProducts[index].size = size;
    if (notes) currentOrderProducts[index].notes = notes;

    console.log('✅ Product saved:', currentOrderProducts[index]);

    closeEditProductModal();
    renderOrderProducts();
    updateOrderSummary();
    showToast('Đã cập nhật sản phẩm', 'success');
}

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
