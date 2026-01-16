/**
 * Orders Edit Modals
 * Extracted from orders.js
 * 
 * Dependencies:
 * - allOrdersData, filteredOrdersData (global)
 * - updateOrderData() from orders-constants.js
 * - renderOrdersTable() from orders-table.js
 * - updateStats() from orders-stats.js
 * - escapeHtml(), formatCurrency() from orders-utils.js
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

// Edit product - show modal with all fields
function editProductName(productId, orderId, orderCode) {
    // Find the order
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

    // Find the product by matching the productId
    const span = document.getElementById(productId);
    if (!span) return;

    const currentName = span.textContent.trim();
    const productIndex = products.findIndex(p => {
        const pName = typeof p === 'string' ? p : p.name;
        return pName === currentName;
    });

    if (productIndex === -1) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const product = products[productIndex];
    const quantity = typeof product === 'object' ? (product.quantity || 1) : 1;

    const productData = typeof product === 'string'
        ? { name: product, quantity: 1, weight: '', size: '', price: '', cost_price: '', notes: '' }
        : {
            name: product.name || '',
            quantity: quantity,
            weight: product.weight || '',
            size: product.size || '',
            // IMPORTANT: price and cost_price are ALWAYS stored as UNIT prices (per item)
            // DO NOT divide by quantity - they are already unit prices!
            price: product.price || '',
            cost_price: product.cost_price || '',
            notes: product.notes || ''
        };

    // Smart detection: if weight contains "cm" or looks like size, swap them
    if (productData.weight && !productData.size) {
        const weightValue = productData.weight.toLowerCase();
        // Check if it looks like a size (contains cm, size, tay, etc.)
        if (weightValue.includes('cm') || weightValue.includes('size') || weightValue.includes('tay')) {
            productData.size = productData.weight;
            productData.weight = '';
        }
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';


    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Chỉnh sửa sản phẩm
                    </h3>
                    <button onclick="closeEditProductModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Product Name -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Tên sản phẩm <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="editProductName" 
                        value="${escapeHtml(productData.name)}"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Nhập tên sản phẩm"
                    />
                </div>

                <!-- Quantity and Size/Tay (2 columns) -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Số lượng <span class="text-red-500">*</span>
                        </label>
                        <input 
                            type="number" 
                            id="editProductQuantity" 
                            value="${productData.quantity}"
                            min="1"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nhập số lượng"
                            oninput="calculateEditModalProfit('quantity')"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Size/Tay
                        </label>
                        <input 
                            type="text" 
                            id="editProductSize" 
                            value="${escapeHtml(productData.size || productData.weight || '')}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="VD: Size M, 5kg..."
                        />
                    </div>
                </div>


                <!-- Price and Cost Price -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Giá bán <span class="text-xs text-gray-500 font-normal">(Tổng tiền)</span>
                        </label>
                        <input 
                            type="text" 
                            id="editProductPrice" 
                            value=""
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nhập giá bán"
                            oninput="calculateEditModalProfit('price')"
                        />
                        <div id="editProductPriceUnit" class="text-xs text-blue-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductPriceUnitValue">0đ</span>/sp
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            💰 Giá vốn <span class="text-xs text-gray-500 font-normal">(Tổng tiền)</span>
                        </label>
                        <input 
                            type="text" 
                            id="editProductCostPrice" 
                            value=""
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nhập giá vốn"
                            oninput="calculateEditModalProfit('cost')"
                        />
                        <div id="editProductCostUnit" class="text-xs text-orange-600 font-semibold mt-1 hidden">
                            Đơn giá: <span id="editProductCostUnitValue">0đ</span>/sp
                        </div>
                    </div>
                </div>
                <p class="text-xs text-gray-500 -mt-2">💡 Nhập tổng tiền cho tất cả sản phẩm. Đơn giá sẽ tự động tính = tổng tiền ÷ số lượng</p>
                
                <!-- Profit Display -->
                <div id="editModalProfitDisplay" class="hidden">
                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg px-4 py-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-600 font-medium">💰 Lãi dự kiến:</span>
                            <span id="editModalProfitAmount" class="text-lg font-bold text-green-600">0đ</span>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-500">Tỷ suất:</span>
                            <span id="editModalProfitMargin" class="text-sm font-semibold text-green-600">0%</span>
                        </div>
                    </div>
                </div>
                <div id="editModalLossWarning" class="hidden">
                    <div class="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3">
                        <p class="text-sm text-red-600 font-medium">⚠️ Giá vốn cao hơn giá bán - Sản phẩm này sẽ bị lỗ!</p>
                    </div>
                </div>

                <!-- Notes -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Ghi chú
                    </label>
                    <textarea 
                        id="editProductNotes" 
                        rows="2"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="Ghi chú thêm về sản phẩm..."
                    >${escapeHtml(productData.notes)}</textarea>
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

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditProductModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveProductChanges(${orderId}, ${productIndex}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Initialize unit prices - productData.price and productData.cost_price are ALREADY unit prices
    editModalUnitPrice = parseFloat(String(productData.price).replace(/[^\d]/g, '')) || 0;
    editModalUnitCost = parseFloat(String(productData.cost_price).replace(/[^\d]/g, '')) || 0;

    console.log('🔧 editProductName - Modal opened:', {
        productIndex,
        quantity,
        unitPrice: editModalUnitPrice,
        unitCost: editModalUnitCost,
        totalPrice: editModalUnitPrice * quantity,
        totalCost: editModalUnitCost * quantity
    });

    // Set input values to TOTAL prices (unit price × quantity)
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
        const priceInput = document.getElementById('editProductPrice');
        const costPriceInput = document.getElementById('editProductCostPrice');
        
        if (priceInput && editModalUnitPrice > 0) {
            priceInput.value = editModalUnitPrice * quantity;
            console.log('✅ Set price input:', priceInput.value);
        }
        if (costPriceInput && editModalUnitCost > 0) {
            costPriceInput.value = editModalUnitCost * quantity;
            console.log('✅ Set cost input:', costPriceInput.value);
        }
        
        // Calculate profit display
        calculateEditModalProfit();
        
        // Focus first input
        document.getElementById('editProductName')?.focus();
    }, 0);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditProductModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
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

        // Find and update the product
        let updated = false;
        for (let i = 0; i < products.length; i++) {
            const productName = typeof products[i] === 'string' ? products[i] : products[i].name;
            if (productName === oldName) {
                if (typeof products[i] === 'string') {
                    products[i] = newName;
                } else {
                    products[i].name = newName;
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


// Calculate profit in edit modal (for order product editing)
function calculateEditModalProfit(sourceField = null) {
    if (editModalIsUpdating) return;

    console.log('🧮 calculateEditModalProfit:', { sourceField });

    const priceInput = document.getElementById('editProductPrice');
    const costPriceInput = document.getElementById('editProductCostPrice');
    const quantityInput = document.getElementById('editProductQuantity');

    if (!priceInput || !costPriceInput || !quantityInput) return;

    const quantity = parseInt(quantityInput.value) || 1;

    // Parse current input values
    const currentPriceValue = parseFloat(priceInput.value?.replace(/[^\d]/g, '')) || 0;
    const currentCostValue = parseFloat(costPriceInput.value?.replace(/[^\d]/g, '')) || 0;

    console.log('📥 Current values:', {
        quantity,
        currentPriceValue,
        currentCostValue,
        unitPrice_before: editModalUnitPrice,
        unitCost_before: editModalUnitCost
    });

    // When user edits price/cost directly, update unit price
    if (sourceField === 'price') {
        editModalUnitPrice = currentPriceValue / quantity;
        console.log('💵 Updated unit price:', editModalUnitPrice);
    }
    if (sourceField === 'cost') {
        editModalUnitCost = currentCostValue / quantity;
        console.log('💰 Updated unit cost:', editModalUnitCost);
    }

    // When quantity changes, recalculate total prices
    if (sourceField === 'quantity') {
        console.log('🔢 Quantity changed, recalculating totals...');
        const totalRevenue = editModalUnitPrice * quantity;
        const totalCost = editModalUnitCost * quantity;

        editModalIsUpdating = true;
        if (editModalUnitPrice > 0) {
            priceInput.value = totalRevenue;
            console.log('  → New total price:', totalRevenue);
        }
        if (editModalUnitCost > 0) {
            costPriceInput.value = totalCost;
            console.log('  → New total cost:', totalCost);
        }
        editModalIsUpdating = false;
    }

    console.log('📤 Final unit prices:', {
        editModalUnitPrice,
        editModalUnitCost
    });

    // Update unit price labels (show only when quantity > 1)
    const priceUnitDiv = document.getElementById('editProductPriceUnit');
    const costUnitDiv = document.getElementById('editProductCostUnit');

    if (quantity > 1) {
        if (editModalUnitPrice > 0) {
            document.getElementById('editProductPriceUnitValue').textContent = formatCurrency(editModalUnitPrice);
            priceUnitDiv?.classList.remove('hidden');
        } else {
            priceUnitDiv?.classList.add('hidden');
        }

        if (editModalUnitCost > 0) {
            document.getElementById('editProductCostUnitValue').textContent = formatCurrency(editModalUnitCost);
            costUnitDiv?.classList.remove('hidden');
        } else {
            costUnitDiv?.classList.add('hidden');
        }
    } else {
        priceUnitDiv?.classList.add('hidden');
        costUnitDiv?.classList.add('hidden');
    }

    // Calculate profit
    const price = currentPriceValue / quantity;
    const costPrice = currentCostValue / quantity;
    const totalRevenue = currentPriceValue;
    const totalCost = currentCostValue;

    const profitDisplay = document.getElementById('editModalProfitDisplay');
    const lossWarning = document.getElementById('editModalLossWarning');

    if (price > 0 && costPrice > 0) {
        // Calculate per-unit profit
        const profitPerUnit = price - costPrice;
        const margin = (profitPerUnit / price) * 100;

        // Calculate total profit (profit per unit × quantity)
        const totalProfit = profitPerUnit * quantity;

        if (profitPerUnit > 0) {
            // Show profit with breakdown
            const profitAmountEl = document.getElementById('editModalProfitAmount');
            const profitMarginEl = document.getElementById('editModalProfitMargin');

            if (quantity > 1) {
                profitAmountEl.innerHTML = `
                    <div class="text-right">
                        <div class="text-lg font-bold text-green-600">${formatCurrency(totalProfit)}</div>
                        <div class="text-xs text-gray-500">(${formatCurrency(profitPerUnit)}/sp × ${quantity})</div>
                    </div>
                `;
            } else {
                profitAmountEl.textContent = formatCurrency(totalProfit);
            }

            profitMarginEl.textContent = `${margin.toFixed(1)}%`;
            profitDisplay.classList.remove('hidden');
            lossWarning.classList.add('hidden');

            // Update display to show total revenue and cost in profit box
            const existingBreakdown = document.getElementById('editModalBreakdown');
            if (!existingBreakdown) {
                const breakdownDiv = document.createElement('div');
                breakdownDiv.id = 'editModalBreakdown';
                breakdownDiv.className = 'text-xs text-gray-600 mt-2 pt-2 border-t border-green-200 space-y-1';
                breakdownDiv.innerHTML = `
                    <div class="flex justify-between">
                        <span>📊 Tổng giá bán:</span>
                        <span class="font-semibold text-gray-800" id="editModalTotalRevenue">${formatCurrency(totalRevenue)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>📊 Tổng giá vốn:</span>
                        <span class="font-semibold text-gray-800" id="editModalTotalCost">${formatCurrency(totalCost)}</span>
                    </div>
                `;
                profitDisplay.querySelector('div').appendChild(breakdownDiv);
            } else {
                document.getElementById('editModalTotalRevenue').textContent = formatCurrency(totalRevenue);
                document.getElementById('editModalTotalCost').textContent = formatCurrency(totalCost);
            }
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
    const price = priceInput ? priceInput.value.trim() : '';
    const costPrice = costPriceInput ? costPriceInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

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

        // Update the product with all fields
        const updatedProduct = {
            name: name,
            quantity: quantity
        };

        // Add optional fields if provided
        if (weight) updatedProduct.weight = weight;
        if (size) updatedProduct.size = size;

        // IMPORTANT: Always use UNIT prices (not total)
        // editModalUnitPrice and editModalUnitCost are calculated from input / quantity
        if (editModalUnitPrice > 0) {
            updatedProduct.price = editModalUnitPrice;
        }
        if (editModalUnitCost > 0) {
            updatedProduct.cost_price = editModalUnitCost;
        }

        if (notes) updatedProduct.notes = notes;

        products[productIndex] = updatedProduct;

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        // Backend will calculate total_amount (trigger auto-calculates from order_items + shipping_fee)
        // Backend will also calculate commission based on CTV's commission_rate
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
                            id="editCustomerPhone" 
                            value="${escapeHtml(customerPhone)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập số điện thoại"
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
function editAddress(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const address = order.address || '';

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
            <div class="p-6">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Địa chỉ giao hàng <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute top-3 left-3 pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <textarea 
                            id="editAddressInput" 
                            rows="4"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                            placeholder="Nhập địa chỉ đầy đủ: Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                        >${escapeHtml(address)}</textarea>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Nhập địa chỉ chi tiết để giao hàng chính xác
                    </p>
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

    // Focus textarea immediately
    const textarea = document.getElementById('editAddressInput');
    if (textarea) {
        textarea.focus();
        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

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
    // Get value from form
    const address = document.getElementById('editAddressInput')?.value.trim();

    // Validate
    if (!address) {
        showToast('Địa chỉ không được để trống', 'error');
        return;
    }

    if (address.length < 10) {
        showToast('Địa chỉ quá ngắn. Vui lòng nhập địa chỉ đầy đủ', 'error');
        return;
    }

    // Close modal and show loading toast với ID
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
                address: address
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].address = address;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].address = address;
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
                            type="number" 
                            id="editAmountInput" 
                            value="${currentAmount}"
                            min="0"
                            step="1000"
                            class="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Nhập giá trị đơn hàng"
                            oninput="updateAmountPreview(${referralCode ? 'true' : 'false'})"
                        />
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span class="text-gray-500 text-sm font-medium">đ</span>
                        </div>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Nhập số tiền không bao gồm dấu phẩy
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

    const newAmount = parseFloat(input.value) || 0;

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
    const newAmount = parseFloat(amountInput?.value) || 0;

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
