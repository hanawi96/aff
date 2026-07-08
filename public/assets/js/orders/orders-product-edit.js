// ============================================
// ORDERS PRODUCT EDIT - Chỉnh sửa và xóa sản phẩm
// ============================================
// Chức năng: Sửa, xóa sản phẩm trong đơn hàng (modal tự nhập SP: orders-custom-product-modal.js)

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

/** Đổi sản phẩm trên đơn đang soạn → chọn SP khác từ kho (chỉ SP có product_id). */
function replaceProductInOrder(index) {
    const product = currentOrderProducts[index];
    if (!product) return;
    if (!product.product_id) {
        showToast('Sản phẩm tùy chỉnh không thể đổi — hãy sửa thông tin hoặc xóa rồi thêm mới', 'info');
        return;
    }
    if (typeof showProductSelectionModalForLocalEdit === 'function') {
        showProductSelectionModalForLocalEdit(index);
    }
}

/** Sửa toàn bộ thông tin dòng SP trên đơn (mọi loại SP). */
function editProductInOrder(index) {
    const product = currentOrderProducts[index];
    if (!product) return;

    const qtyInit = parseInt(product.quantity, 10) || 1;
    const unitPriceInit = parsePrice(product.price);
    const unitCostInit = parsePrice(product.cost_price);
    // Ô hiển thị tổng tiền (đơn giá × SL), format 90.000
    const initialPriceStr = formatVnIntegerString(unitPriceInit * qtyInit);
    const initialCostStr = formatVnIntegerString(unitCostInit * qtyInit);

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
                    <input type="text" id="editProductName" value="${escapeAttr(product.name)}" 
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
                        <input type="text" id="editProductSize" value="${escapeAttr(product.size || product.weight || '')}" placeholder="VD: Size M, 5kg..." 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                </div>

                <!-- Price and Cost -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">
                            Giá bán <span class="text-xs text-gray-500 font-normal">(VD: 90.000)</span>
                        </label>
                        <input type="text" id="editProductPrice" inputmode="numeric" autocomplete="off" value="${initialPriceStr}" placeholder="0" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="formatVnMoneyInput(this); calculateEditProfit('price');" />
                        <div id="editProductPriceUnit" class="text-xs text-blue-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductPriceUnitValue">0đ</span>/sp
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">💰 Giá vốn</label>
                        <input type="text" id="editProductCostPrice" inputmode="numeric" autocomplete="off" value="${initialCostStr}" placeholder="0" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            oninput="formatVnMoneyInput(this); calculateEditProfit('cost');" />
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

    // Hiển thị tổng tiền (đơn giá × SL), format 90.000
    if (editOrderUnitPrice > 0) {
        priceInput.value = formatVnIntegerString(editOrderUnitPrice * quantity);
    } else {
        priceInput.value = '';
    }
    if (editOrderUnitCost > 0) {
        costPriceInput.value = formatVnIntegerString(editOrderUnitCost * quantity);
    } else {
        costPriceInput.value = '';
    }

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

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQty');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;
    const currentPriceValue = parsePrice(priceInput.value);
    const currentCostValue = parsePrice(costPriceInput.value);

    if (sourceField === 'price') {
        editOrderUnitPrice = currentPriceValue / quantity;
    }
    if (sourceField === 'cost') {
        editOrderUnitCost = currentCostValue / quantity;
    }

    if (sourceField === 'quantity') {
        editOrderIsUpdating = true;
        if (editOrderUnitPrice > 0) {
            priceInput.value = formatVnIntegerString(editOrderUnitPrice * quantity);
        }
        if (editOrderUnitCost > 0) {
            costPriceInput.value = formatVnIntegerString(editOrderUnitCost * quantity);
        }
        editOrderIsUpdating = false;
    }

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
    const sizeRaw = document.getElementById('editProductSize')?.value.trim() || '';
    const size = normalizeOrderItemSizeClient(sizeRaw || null);
    const notes = document.getElementById('editProductNotes')?.value.trim();

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
    // Gán size (hoặc xóa nếu rỗng), đồng thời xóa weight cũ để tránh hiển thị trùng
    if (size) {
        currentOrderProducts[index].size = size;
    } else {
        delete currentOrderProducts[index].size;
    }
    delete currentOrderProducts[index].weight; // normalize: sau khi edit chỉ dùng size
    if (notes) {
        currentOrderProducts[index].notes = notes;
    } else {
        delete currentOrderProducts[index].notes;
    }

    closeEditProductModal();
    renderOrderProducts();
    updateOrderSummary();
    showToast('Đã cập nhật sản phẩm', 'success');
}
