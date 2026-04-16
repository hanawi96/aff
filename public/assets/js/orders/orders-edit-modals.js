/**
 * Orders Edit Modals
 * Extracted from orders.js
 * 
 * Dependencies:
 * - allOrdersData, filteredOrdersData (global)
 * - updateOrderData() from orders-constants.js
 * - renderOrdersTable() from orders-table.js
 * - updateStats() from orders-stats.js
 * - escapeHtml(), formatCurrency(), formatVnIntegerString(), formatVnMoneyInput(), parsePrice() from orders-utils.js
 * - showToast() from toast-manager.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// EDIT MODALS
// ============================================

// Store unit prices globally (for edit modal)
let editModalUnitPrice = 0;
let editModalUnitCost = 0;
let editModalIsUpdating = false;

// Edit product - open product selection modal to replace
// productId format: "product_{orderId}_{index}" — index encoded directly in ID
function editProductName(productId, orderId, orderCode) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) { showToast('Không tìm thấy đơn hàng', 'error'); return; }

    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(l => l.trim()).filter(Boolean);
        products = lines.map(line => {
            const m = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            return m ? { name: m[1].trim(), quantity: parseInt(m[2]) } : { name: line, quantity: 1 };
        });
    }

    // Extract index from productId ("product_{orderId}_{index}") — avoids findIndex by name
    // which always returns the first duplicate when the same product appears multiple times
    const productIndex = parseInt(productId.split('_').pop(), 10);
    if (isNaN(productIndex) || productIndex < 0 || productIndex >= products.length) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const product = products[productIndex];
    const existingProductId = (typeof product === 'object' && product.product_id) ? product.product_id : null;
    const existingWeight    = typeof product === 'object' ? (product.size !== undefined ? product.size : (product.weight ?? '')) : '';
    const existingQty       = typeof product === 'object' ? (parseInt(product.quantity, 10) || 1) : 1;
    const existingNotes     = typeof product === 'object' ? (product.notes || '') : '';

    showProductSelectionModalForEdit(orderId, orderCode, productIndex, existingProductId, existingWeight, existingQty, existingNotes);
}

// Close edit product modal
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.remove();
    }
}

// Save product name
async function saveProductName(productId, orderId, orderCode, newName, oldName) {
    const span = document.getElementById(productId);
    if (!span) return;

    newName = newName.trim();

    // If no change, just restore
    if (newName === oldName || newName === '') {
        span.innerHTML = escapeHtml(oldName);
        return;
    }

    // Show loading
    span.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-gray-600">Đang lưu...</span>
        </div>
    `;

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            // If not JSON, parse as text
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // CRITICAL: Get existing order_items to preserve product_id
        let existingItems = [];
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=getOrderItems&orderId=${orderId}`);
            const data = await response.json();
            if (data.success && data.items) {
                existingItems = data.items;
            }
        } catch (e) {
            console.warn('⚠️ Could not fetch existing order_items:', e);
        }

        // Find and update the product
        let updated = false;
        for (let i = 0; i < products.length; i++) {
            const productName = typeof products[i] === 'string' ? products[i] : products[i].name;
            if (productName === oldName) {
                if (typeof products[i] === 'string') {
                    products[i] = { name: newName, quantity: 1 };
                } else {
                    products[i].name = newName;
                }
                
                // CRITICAL: Preserve product_id from existing order_items
                const existingItem = existingItems.find(item => item.product_name === oldName);
                if (existingItem && existingItem.product_id) {
                    products[i].product_id = existingItem.product_id;
                }
                
                updated = true;
                break;
            }
        }

        if (!updated) {
            throw new Error('Không tìm thấy sản phẩm để cập nhật');
        }

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
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

            updateOrderData(orderId, updates);

            // Re-render table to show updated total_amount
            renderOrdersTable();

            // Update display
            span.innerHTML = escapeHtml(newName);
            showToast(`Đã cập nhật tên sản phẩm cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving product name:', error);
        span.innerHTML = escapeHtml(oldName);
        showToast('Không thể cập nhật tên sản phẩm: ' + error.message, 'error');
    }
}


// Nhãn đơn giá/sp khi SL > 1 (dùng chung khi đổi SL hoặc gõ tổng tiền)
function refreshEditModalUnitLabels() {
    const quantityInput = document.getElementById('editProductQuantity');
    const quantity = parseInt(quantityInput?.value) || 1;
    const priceUnitDiv = document.getElementById('editProductPriceUnit');
    const costUnitDiv = document.getElementById('editProductCostUnit');

    if (quantity > 1 && editModalUnitPrice > 0) {
        document.getElementById('editProductPriceUnitValue').textContent = formatCurrency(editModalUnitPrice);
        priceUnitDiv?.classList.remove('hidden');
    } else {
        priceUnitDiv?.classList.add('hidden');
    }

    if (quantity > 1 && editModalUnitCost > 0) {
        document.getElementById('editProductCostUnitValue').textContent = formatCurrency(editModalUnitCost);
        costUnitDiv?.classList.remove('hidden');
    } else {
        costUnitDiv?.classList.add('hidden');
    }
}

/** Gõ tổng tiền → cập nhật đơn giá nội bộ (đồng bộ khi đổi số lượng) */
function onEditModalPriceOrCostInput(sourceField) {
    if (editModalIsUpdating) return;
    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQuantity');
    if (!priceInput || !costPriceInput || !quantityInput) return;
    const quantity = parseInt(quantityInput.value) || 1;
    const currentPriceValue = parsePrice(priceInput.value);
    const currentCostValue = parsePrice(costPriceInput.value);
    if (sourceField === 'price') {
        editModalUnitPrice = currentPriceValue / quantity;
    }
    if (sourceField === 'cost') {
        editModalUnitCost = currentCostValue / quantity;
    }
    refreshEditModalUnitLabels();
}

// Update total prices when quantity changes in edit modal
function updateEditModalTotalPrices() {
    if (editModalIsUpdating) return;

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQuantity');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;

    // Tổng tiền = đơn giá × SL, hiển thị kiểu 90.000
    editModalIsUpdating = true;
    if (editModalUnitPrice > 0) {
        priceInput.value = formatVnIntegerString(editModalUnitPrice * quantity);
    } else {
        priceInput.value = '';
    }
    if (editModalUnitCost > 0) {
        costPriceInput.value = formatVnIntegerString(editModalUnitCost * quantity);
    } else {
        costPriceInput.value = '';
    }
    editModalIsUpdating = false;

    refreshEditModalUnitLabels();
}


// Save product changes
async function saveProductChanges(orderId, productIndex, orderCode) {
    // Get values from form
    const name = document.getElementById('editProductName')?.value.trim();
    const quantity = parseInt(document.getElementById('editProductQuantity')?.value) || 1;
    const weightInput = document.getElementById('editProductWeight');
    const sizeInput = document.getElementById('editProductSize');
    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const notesInput = document.getElementById('editProductNotes');

    const weight = weightInput ? weightInput.value.trim() : '';
    const size = sizeInput ? sizeInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    // Tính đơn giá từ tổng (ô đã format 90.000)
    const totalPrice = priceInput ? parsePrice(priceInput.value) : 0;
    const totalCost = costPriceInput ? parsePrice(costPriceInput.value) : 0;
    const unitPrice = totalPrice / quantity;
    const unitCost = totalCost / quantity;

    // Validate
    if (!name) {
        showToast('Tên sản phẩm không được để trống', 'error');
        return;
    }

    if (quantity < 1) {
        showToast('Số lượng phải lớn hơn 0', 'error');
        return;
    }

    // Close modal and show loading toast với ID
    closeEditProductModal();
    const saveId = `save-product-${orderId}-${productIndex}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
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

        // CRITICAL: Get existing order_items to preserve product_id
        let existingItems = [];
        try {
            const itemsResponse = await fetch(`${CONFIG.API_URL}?action=getOrderItems&orderId=${orderId}`);
            const itemsData = await itemsResponse.json();
            if (itemsData.success && itemsData.items) {
                existingItems = itemsData.items;
            }
        } catch (e) {
            console.warn('⚠️ Could not fetch existing order_items:', e);
        }

        // Update the product with all fields
        const oldProduct = products[productIndex];
        const updatedProduct = {
            name: name,
            quantity: quantity
        };

        // CRITICAL: Preserve product_id from existing order_items
        if (existingItems[productIndex] && existingItems[productIndex].product_id) {
            updatedProduct.product_id = existingItems[productIndex].product_id;
        } else if (oldProduct && oldProduct.product_id) {
            // Fallback to old product data
            updatedProduct.product_id = oldProduct.product_id;
        }

        // Add optional fields — "chưa có" / rỗng → không gửi (NULL trong DB)
        const weightNorm = normalizeOrderItemSizeClient(weight || null);
        const sizeNorm = normalizeOrderItemSizeClient(size || null);
        if (weightNorm) updatedProduct.weight = weightNorm;
        if (sizeNorm) updatedProduct.size = sizeNorm;

        // Store UNIT prices (not total)
        if (unitPrice > 0) updatedProduct.price = unitPrice;
        if (unitCost > 0) updatedProduct.cost_price = unitCost;

        if (notes) updatedProduct.notes = notes;

        products[productIndex] = updatedProduct;

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // ── Tính lại shipping_fee theo điều kiện freeship ──
        const currentShippingFee = order.shipping_fee || 0;
        const shouldFreeship = _shouldFreeship(products);
        const newShippingFee = shouldFreeship ? 0
            : (currentShippingFee === 0 ? _getCustomerShippingFee() : currentShippingFee);

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson,
                shipping_fee: newShippingFee
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount  !== undefined) updates.total_amount  = data.total_amount;
            if (data.shipping_fee  !== undefined) updates.shipping_fee  = data.shipping_fee;
            if (data.product_cost  !== undefined) updates.product_cost  = data.product_cost;
            if (data.commission    !== undefined) updates.commission    = data.commission;

            updateOrderData(orderId, updates);

            // Re-render the table to show updated values
            renderOrdersTable();

            // Build success message
            let message = `Đã cập nhật sản phẩm cho đơn ${orderCode}`;
            if (data.total_amount !== undefined) {
                message = `Đã cập nhật sản phẩm - Tổng tiền: ${formatCurrency(data.total_amount)}`;
                if (data.commission !== undefined && data.commission > 0) {
                    message += ` - Hoa hồng: ${formatCurrency(data.commission)}`;
                }
            }
            showToast(message, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Không thể cập nhật sản phẩm: ' + error.message, 'error', null, saveId);
    }
}


// ============================================
// EDIT CUSTOMER INFO
// ============================================

// Edit customer info
function editCustomerInfo(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const customerName = order.customer_name || '';
    const customerPhone = order.customer_phone || '';

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editCustomerModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Chỉnh sửa thông tin khách hàng
                    </h3>
                    <button onclick="closeEditCustomerModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Customer Name -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Tên khách hàng <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            id="editCustomerName" 
                            value="${escapeHtml(customerName)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập tên khách hàng"
                        />
                    </div>
                </div>

                <!-- Customer Phone -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Số điện thoại <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <input 
                            type="tel" 
                            inputmode="numeric"
                            id="editCustomerPhone" 
                            value="${escapeHtml(customerPhone)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập số điện thoại"
                            oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                        />
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Định dạng: 10 số, bắt đầu bằng 0
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditCustomerModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveCustomerInfo(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first input immediately
    document.getElementById('editCustomerName')?.focus();

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditCustomerModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Close edit customer modal
function closeEditCustomerModal() {
    const modal = document.getElementById('editCustomerModal');
    if (modal) {
        modal.remove();
    }
}

// Save customer info
async function saveCustomerInfo(orderId, orderCode) {
    // Get values from form
    const name = document.getElementById('editCustomerName')?.value.trim();
    const phone = document.getElementById('editCustomerPhone')?.value.trim();

    // Validate
    if (!name) {
        showToast('Tên khách hàng không được để trống', 'error');
        return;
    }

    if (!phone) {
        showToast('Số điện thoại không được để trống', 'error');
        return;
    }

    // Validate phone format (Vietnamese phone number)
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        showToast('Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 0', 'error');
        return;
    }

    // Close modal and show loading toast với ID
    closeEditCustomerModal();
    const saveId = `save-customer-${orderId}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateCustomerInfo',
                orderId: orderId,
                customerName: name,
                customerPhone: phone
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].customer_name = name;
            allOrdersData[orderIndex].customer_phone = phone;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].customer_name = name;
                filteredOrdersData[filteredIndex].customer_phone = phone;
            }

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật thông tin khách hàng cho đơn ${orderCode}`, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving customer info:', error);
        showToast('Không thể cập nhật thông tin khách hàng: ' + error.message, 'error', null, saveId);
    }
}


// ============================================
// EDIT ADDRESS
// ============================================

// Edit address
async function editAddress(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Load address data if not loaded
    if (!window.addressSelector.loaded) {
        await window.addressSelector.init();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editAddressModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <!-- Header -->
            <div class="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Chỉnh sửa địa chỉ giao hàng
                    </h3>
                    <button onclick="closeEditAddressModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Address 4 levels -->
                <div class="bg-blue-50 rounded-lg p-4 space-y-3">
                    <label class="block text-sm font-semibold text-gray-800 mb-2">
                        Địa chỉ giao hàng <span class="text-red-500">*</span>
                    </label>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <select id="editOrderProvince" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                                <option value="">-- Chọn Tỉnh/TP --</option>
                            </select>
                        </div>
                        <div>
                            <select id="editOrderDistrict" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                                <option value="">-- Chọn Quận/Huyện --</option>
                            </select>
                        </div>
                        <div>
                            <select id="editOrderWard" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                                <option value="">-- Chọn Phường/Xã --</option>
                            </select>
                        </div>
                        <div>
                            <input type="text" id="editOrderStreetAddress" placeholder="Số nhà, tên đường" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                        </div>
                    </div>
                    
                    <div class="mt-2 p-2 bg-white rounded border border-blue-200">
                        <p class="text-xs text-gray-500 mb-0.5">Địa chỉ đầy đủ:</p>
                        <p id="editOrderAddressPreview" class="text-sm text-gray-800 font-medium">Vui lòng chọn địa chỉ</p>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditAddressModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveAddress(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup address selector
    const provinceSelect = document.getElementById('editOrderProvince');
    const districtSelect = document.getElementById('editOrderDistrict');
    const wardSelect = document.getElementById('editOrderWard');
    const streetInput = document.getElementById('editOrderStreetAddress');
    const addressPreview = document.getElementById('editOrderAddressPreview');

    // Render provinces
    window.addressSelector.renderProvinces(provinceSelect);

    // Set current address if available
    if (order.province_id) {
        // IDs are now stored as strings in database (already padded)
        const provinceId = String(order.province_id);
        const districtId = order.district_id ? String(order.district_id) : null;
        const wardId = order.ward_id ? String(order.ward_id) : null;

        // Set province first
        provinceSelect.value = provinceId;
        
        // Render districts and set value
        if (districtId) {
            window.addressSelector.renderDistricts(districtSelect, provinceId);
            // Use setTimeout to ensure options are rendered before setting value
            setTimeout(() => {
                districtSelect.value = districtId;
                
                // Render wards and set value
                if (wardId) {
                    window.addressSelector.renderWards(wardSelect, provinceId, districtId);
                    // Use setTimeout again for ward
                    setTimeout(() => {
                        wardSelect.value = wardId;
                        // Update preview after all values are set
                        updateAddressPreview();
                    }, 50);
                }
            }, 50);
        }
        
        if (order.street_address) {
            streetInput.value = order.street_address;
        }
    }

    // Update preview function
    function updateAddressPreview() {
        const provinceId = provinceSelect.value;
        const districtId = districtSelect.value;
        const wardId = wardSelect.value;
        const street = streetInput.value;

        const fullAddress = window.addressSelector.generateFullAddress(
            street,
            provinceId,
            districtId,
            wardId
        );

        addressPreview.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
    }

    // Setup cascade
    window.addressSelector.setupCascade(
        provinceSelect,
        districtSelect,
        wardSelect,
        updateAddressPreview
    );

    streetInput.addEventListener('input', updateAddressPreview);

    // Note: Don't call updateAddressPreview() here - it will be called after ward is set in setTimeout

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditAddressModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Close edit address modal
function closeEditAddressModal() {
    const modal = document.getElementById('editAddressModal');
    if (modal) {
        modal.remove();
    }
}

// Save address
async function saveAddress(orderId, orderCode) {
    // Get values from form
    const provinceSelect = document.getElementById('editOrderProvince');
    const districtSelect = document.getElementById('editOrderDistrict');
    const wardSelect = document.getElementById('editOrderWard');
    const streetInput = document.getElementById('editOrderStreetAddress');

    // Get IDs - now stored as strings in database (no conversion needed)
    const provinceId = provinceSelect?.value?.trim() || null;
    const districtId = districtSelect?.value?.trim() || null;
    const wardId = wardSelect?.value?.trim() || null;
    const streetAddress = streetInput?.value?.trim() || null;

    // Get full names (name_with_type) — prefer addressSelector lookup by ID for accuracy
    const provinceName = (provinceId && (
        window.addressSelector?.loaded
            ? window.addressSelector.getProvinceName(provinceId)
            : null
    ) || provinceSelect?.selectedOptions[0]?.text) || null;
    const districtName = (districtId && (
        window.addressSelector?.loaded
            ? window.addressSelector.getDistrictName(provinceId, districtId)
            : null
    ) || districtSelect?.selectedOptions[0]?.text) || null;
    const wardName = (wardId && (
        window.addressSelector?.loaded
            ? window.addressSelector.getWardName(provinceId, districtId, wardId)
            : null
    ) || wardSelect?.selectedOptions[0]?.text) || null;

    // Generate full address
    const fullAddress = window.addressSelector.generateFullAddress(
        streetAddress,
        provinceId,
        districtId,
        wardId
    );

    // Validate
    if (!fullAddress || fullAddress === 'Vui lòng chọn địa chỉ') {
        showToast('Vui lòng chọn địa chỉ đầy đủ', 'error');
        return;
    }

    if (!provinceId || !districtId || !wardId) {
        showToast('Vui lòng chọn đầy đủ Tỉnh/Quận/Xã', 'error');
        return;
    }

    // Close modal and show loading toast
    closeEditAddressModal();
    const saveId = `save-address-${orderId}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateAddress',
                orderId: orderId,
                address: fullAddress,
                province_id: provinceId,
                province_name: provinceName,
                district_id: districtId,
                district_name: districtName,
                ward_id: wardId,
                ward_name: wardName,
                street_address: streetAddress
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data with all address fields
            allOrdersData[orderIndex].address = fullAddress;
            allOrdersData[orderIndex].province_id = provinceId;
            allOrdersData[orderIndex].province_name = provinceName;
            allOrdersData[orderIndex].district_id = districtId;
            allOrdersData[orderIndex].district_name = districtName;
            allOrdersData[orderIndex].ward_id = wardId;
            allOrdersData[orderIndex].ward_name = wardName;
            allOrdersData[orderIndex].street_address = streetAddress;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].address = fullAddress;
                filteredOrdersData[filteredIndex].province_id = provinceId;
                filteredOrdersData[filteredIndex].province_name = provinceName;
                filteredOrdersData[filteredIndex].district_id = districtId;
                filteredOrdersData[filteredIndex].district_name = districtName;
                filteredOrdersData[filteredIndex].ward_id = wardId;
                filteredOrdersData[filteredIndex].ward_name = wardName;
                filteredOrdersData[filteredIndex].street_address = streetAddress;
            }

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật địa chỉ cho đơn ${orderCode}`, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving address:', error);
        showToast('Không thể cập nhật địa chỉ: ' + error.message, 'error', null, saveId);
    }
}


// ============================================
// EDIT AMOUNT
// ============================================

// Edit amount
function editAmount(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const currentAmount = order.total_amount || 0;
    const referralCode = order.referral_code;
    const currentCommission = order.commission || 0;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editAmountModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Chỉnh sửa giá trị đơn hàng
                    </h3>
                    <button onclick="closeEditAmountModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Current Amount Display -->
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <p class="text-xs text-green-600 font-medium mb-1">Giá trị hiện tại</p>
                    <p class="text-2xl font-bold text-green-700">${formatCurrency(currentAmount)}</p>
                    ${referralCode ? `
                        <div class="mt-2 pt-2 border-t border-green-200">
                            <p class="text-xs text-orange-600 font-medium">Hoa hồng CTV: <span class="font-bold">${formatCurrency(currentCommission)}</span></p>
                        </div>
                    ` : ''}
                </div>

                <!-- New Amount Input -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Giá trị mới <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            id="editAmountInput" 
                            inputmode="numeric"
                            autocomplete="off"
                            value="${currentAmount > 0 ? formatVnIntegerString(currentAmount) : ''}"
                            class="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="VD: 598.000"
                            oninput="formatVnMoneyInput(this); updateAmountPreview(${referralCode ? 'true' : 'false'})"
                        />
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span class="text-gray-500 text-sm font-medium">đ</span>
                        </div>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Số tiền tự định dạng kiểu 90.000 (dấu chấm phân cách nghìn)
                    </p>
                </div>

                <!-- Preview -->
                <div id="amountPreview" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Giá trị mới:</span>
                        <span class="text-lg font-bold text-green-600">${formatCurrency(currentAmount)}</span>
                    </div>
                    ${referralCode ? `
                        <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                            <span class="text-sm text-gray-600">Hoa hồng CTV mới:</span>
                            <span class="text-lg font-bold text-orange-600" id="commissionPreview">${formatCurrency(currentCommission)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditAmountModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveAmount(${orderId}, '${escapeHtml(orderCode)}', ${referralCode ? `'${escapeHtml(referralCode)}'` : 'null'})" 
                    class="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus input immediately
    const input = document.getElementById('editAmountInput');
    if (input) {
        input.focus();
        input.select();
    }

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditAmountModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

}

// Update amount preview
function updateAmountPreview(hasReferral) {
    const input = document.getElementById('editAmountInput');
    const preview = document.getElementById('amountPreview');

    if (!input || !preview) return;

    const newAmount = parsePrice(input.value) || 0;

    // Update amount display
    const amountDisplay = preview.querySelector('.text-green-600');
    if (amountDisplay) {
        amountDisplay.textContent = formatCurrency(newAmount);
    }

    // Update commission if has referral
    if (hasReferral) {
        const commissionPreview = document.getElementById('commissionPreview');
        if (commissionPreview) {
            // Calculate commission (10% default)
            const newCommission = newAmount * 0.1;
            commissionPreview.textContent = formatCurrency(newCommission);
        }
    }
}

// Close edit amount modal
function closeEditAmountModal() {
    const modal = document.getElementById('editAmountModal');
    if (modal) {
        modal.remove();
    }
}

// Save amount
async function saveAmount(orderId, orderCode, referralCode) {
    // Get value from form
    const amountInput = document.getElementById('editAmountInput');
    const newAmount = amountInput ? parsePrice(amountInput.value) : 0;

    // Validate
    if (newAmount <= 0) {
        showToast('Giá trị đơn hàng phải lớn hơn 0', 'error');
        return;
    }

    if (newAmount > 1000000000) {
        showToast('Giá trị đơn hàng quá lớn', 'error');
        return;
    }

    // Calculate new commission if has referral
    let newCommission = 0;
    if (referralCode) {
        newCommission = newAmount * 0.1; // 10% commission
    }

    // Close modal and show loading toast với ID
    closeEditAmountModal();
    const saveId = `save-amount-${orderId}`;
    showToast('Đang lưu thay đổi...', 'info', 0, saveId);

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateAmount',
                orderId: orderId,
                totalAmount: newAmount,
                commission: newCommission
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].total_amount = newAmount;
            allOrdersData[orderIndex].commission = newCommission;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].total_amount = newAmount;
                filteredOrdersData[filteredIndex].commission = newCommission;
            }

            // Update stats
            updateStats();

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật giá trị cho đơn ${orderCode}`, 'success', null, saveId);
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving amount:', error);
        showToast('Không thể cập nhật giá trị đơn hàng: ' + error.message, 'error', null, saveId);
    }
}

// ============================================
// EDIT PAYMENT METHOD MODAL
// ============================================

function editPaymentMethod(orderId, orderCode, currentMethod) {
    const isCOD = !isOrderBankPayment(currentMethod);

    const modal = document.createElement('div');
    modal.id = 'editPaymentMethodModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ring-1 ring-black/5">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </span>
                        Hình thức thanh toán
                    </h3>
                    <p class="text-sm text-blue-100 mt-2 pl-11">Đơn hàng: <span class="font-medium text-white">${escapeHtml(orderCode)}</span></p>
                </div>
                <button type="button" onclick="document.getElementById('editPaymentMethodModal')?.remove()" class="shrink-0 rounded-lg p-1.5 text-white/90 hover:bg-white/15 hover:text-white transition-colors" aria-label="Đóng">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="px-5 pt-4 pb-2">
                <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Chọn một phương thức</p>
            </div>
            <div class="px-5 pb-5 space-y-2.5">
                <label class="block cursor-pointer select-none">
                    <input type="radio" name="paymentMethod" value="cod" ${isCOD ? 'checked' : ''} class="peer sr-only">
                    <div class="relative flex items-center gap-4 rounded-xl border-2 border-slate-200/90 bg-slate-50/40 p-4 shadow-sm transition-all duration-200 ease-out
                        hover:border-slate-300 hover:bg-white hover:shadow-md
                        peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2
                        peer-checked:border-amber-500 peer-checked:bg-gradient-to-br peer-checked:from-amber-50 peer-checked:to-white peer-checked:shadow-md peer-checked:ring-1 peer-checked:ring-amber-500/20
                        peer-checked:[&_.pm-pay-icon]:bg-amber-500 peer-checked:[&_.pm-pay-icon]:text-white peer-checked:[&_.pm-pay-icon]:shadow-inner
                        peer-checked:[&_.pm-pay-dot]:border-amber-500 peer-checked:[&_.pm-pay-dot]:bg-amber-500
                        peer-checked:[&_.pm-dot-pip]:scale-100 peer-checked:[&_.pm-dot-pip]:opacity-100">
                        <span class="pm-pay-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition-all duration-200 shadow-sm">
                            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block font-semibold text-gray-900">COD</span>
                            <span class="mt-0.5 block text-sm text-gray-500 leading-snug">Thanh toán khi nhận hàng</span>
                        </span>
                        <span class="pm-pay-dot relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white transition-all duration-200">
                            <span class="pm-dot-pip h-2 w-2 rounded-full bg-white scale-0 opacity-0 transition-all duration-200"></span>
                        </span>
                    </div>
                </label>
                <label class="block cursor-pointer select-none">
                    <input type="radio" name="paymentMethod" value="bank" ${!isCOD ? 'checked' : ''} class="peer sr-only">
                    <div class="relative flex items-center gap-4 rounded-xl border-2 border-slate-200/90 bg-slate-50/40 p-4 shadow-sm transition-all duration-200 ease-out
                        hover:border-slate-300 hover:bg-white hover:shadow-md
                        peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2
                        peer-checked:border-emerald-600 peer-checked:bg-gradient-to-br peer-checked:from-emerald-50 peer-checked:to-white peer-checked:shadow-md peer-checked:ring-1 peer-checked:ring-emerald-600/20
                        peer-checked:[&_.pm-pay-icon]:bg-emerald-600 peer-checked:[&_.pm-pay-icon]:text-white peer-checked:[&_.pm-pay-icon]:shadow-inner
                        peer-checked:[&_.pm-pay-dot]:border-emerald-600 peer-checked:[&_.pm-pay-dot]:bg-emerald-600
                        peer-checked:[&_.pm-dot-pip]:scale-100 peer-checked:[&_.pm-dot-pip]:opacity-100">
                        <span class="pm-pay-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-all duration-200 shadow-sm">
                            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m0 0V4.875A1.125 1.125 0 0018.75 3.75H5.25a1.125 1.125 0 00-1.125 1.125V21M9 9v6m6-6v6M12 3v18" />
                            </svg>
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block font-semibold text-gray-900">Chuyển khoản</span>
                            <span class="mt-0.5 block text-sm text-gray-500 leading-snug">Khách đã thanh toán qua CK</span>
                        </span>
                        <span class="pm-pay-dot relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white transition-all duration-200">
                            <span class="pm-dot-pip h-2 w-2 rounded-full bg-white scale-0 opacity-0 transition-all duration-200"></span>
                        </span>
                    </div>
                </label>
            </div>
            <div class="px-5 py-4 flex gap-3 border-t border-slate-100 bg-slate-50/50">
                <button type="button" onclick="document.getElementById('editPaymentMethodModal')?.remove()" class="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-white font-medium text-sm transition-colors shadow-sm">Huỷ</button>
                <button type="button" onclick="savePaymentMethod(${orderId}, '${escapeHtml(orderCode)}')" class="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-sm shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all">Lưu</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function savePaymentMethod(orderId, orderCode) {
    const selected = document.querySelector('#editPaymentMethodModal input[name="paymentMethod"]:checked');
    if (!selected) return;
    const newMethod = selected.value;

    document.getElementById('editPaymentMethodModal')?.remove();
    const saveId = `save-pm-${orderId}`;
    showToast('Đang lưu...', 'info', 0, saveId);

    try {
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) throw new Error('Không tìm thấy đơn hàng');

        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updatePaymentMethod', orderId, paymentMethod: newMethod })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể cập nhật');

        allOrdersData[orderIndex].payment_method = newMethod;
        const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
        if (filteredIndex !== -1) filteredOrdersData[filteredIndex].payment_method = newMethod;

        renderOrdersTable();
        showToast(`Đã đổi sang ${newMethod === 'bank' ? 'Chuyển khoản' : 'COD'} cho đơn ${orderCode}`, 'success', null, saveId);
    } catch (error) {
        console.error('Error saving payment method:', error);
        showToast('Không thể cập nhật: ' + error.message, 'error', null, saveId);
    }
}

// ============================================
// FREESHIP CALCULATION (mirror of autoUpdateFreeshipCheckbox)
/**
 * Tính điều kiện freeship cho danh sách sản phẩm.
 * Dùng chung cho cả tạo đơn mới (autoUpdateFreeshipCheckbox) và edit đơn cũ.
 *
 * Bật freeship khi (!blocked) && một trong:
 *   - totalQty >= 2 và không phải chỉ toàn cat 23
 *   - Có cat 23 + ít nhất 1 SP ngoài cat 23
 *   - Có SP ngoài cat 23 với giá > 120.000đ
 *
 * Block (luôn false):
 *   - Chỉ toàn cat 24 (Bi, charm bạc)
 *   - Chỉ cat 24 + cat 23, không có danh mục chính nào khác
 */
function _shouldFreeship(productsArr) {
    if (!productsArr || productsArr.length === 0) return false;

    const FREESHIP_CAT = 23;
    const BI_CHARM_CAT = 24;
    const PRICE_THRESHOLD = 120000;

    let totalQty = 0;
    let has23 = false, has24 = false;
    let qtyOtherMain = 0, non23Qty = 0;
    let onlyAllCat24 = true;
    let hasHighValue = false;

    for (const p of productsArr) {
        const q = parseInt(p.quantity, 10) || 1;
        totalQty += q;

        const catalog = (typeof allProductsList !== 'undefined')
            ? allProductsList.find(cp => cp.id === (p.product_id || p.id))
            : null;

        if (!catalog) {
            onlyAllCat24 = false;
            non23Qty += q;
            qtyOtherMain += q;
            if ((parseFloat(p.price) || 0) > PRICE_THRESHOLD) hasHighValue = true;
            continue;
        }

        const in23 = productBelongsToCategory(catalog, FREESHIP_CAT);
        const in24 = productBelongsToCategory(catalog, BI_CHARM_CAT);

        if (in23) has23 = true;
        if (in24) has24 = true;
        if (!in23 && !in24) qtyOtherMain += q;
        if (!in23) non23Qty += q;
        if (!in24) onlyAllCat24 = false;

        if (!in23) {
            const price = parseFloat(p.price) || parseFloat(catalog.price) || parseFloat(catalog.sale_price) || 0;
            if (price > PRICE_THRESHOLD) hasHighValue = true;
        }
    }

    const blocked = (onlyAllCat24 && has24 && !has23)
        || (has24 && has23 && qtyOtherMain === 0);

    return !blocked && (
        (totalQty >= 2 && !(has23 && non23Qty === 0))
        || (has23 && non23Qty >= 1)
        || hasHighValue
    );
}

/**
 * Lấy phí ship khách trả từ cấu hình (customer_shipping_fee).
 * Dùng khi hủy freeship để khôi phục đúng mức phí khách trả, không phải phí thực tế.
 */
function _getCustomerShippingFee() {
    if (typeof packagingConfig !== 'undefined' && packagingConfig.length > 0) {
        const item = packagingConfig.find(i => i.item_name === 'customer_shipping_fee');
        if (item) return item.item_cost;
    }
    return 30000; // fallback
}
