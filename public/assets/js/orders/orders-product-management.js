// ============================================
// PRODUCT MANAGEMENT FOR ORDERS
// ============================================
// Functions for loading products, categories, and managing products in orders

/**
 * Load products and categories from API
 * Uses caching to avoid redundant API calls
 */
async function loadProductsAndCategories() {
    // Return immediately if already loaded
    if (allProductsList.length > 0 && allCategoriesList.length > 0) {
        return Promise.resolve();
    }

    try {
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
        }
        if (categoriesData.success) {
            allCategoriesList = categoriesData.categories || [];
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

/**
 * Show product selection modal for existing order (ADD mode)
 */
function showProductSelectionModalForOrder(orderId, orderCode) {
    currentEditingOrderId = orderId;
    currentEditingOrderCode = orderCode;
    currentEditingProductIndex = null;
    showProductSelectionModal();
}

/**
 * Show product selection modal in REPLACE mode
 * @param {number} orderId
 * @param {string} orderCode
 * @param {number} productIndex - index of product to replace in order.products array
 * @param {number|null} existingProductId - product_id of current product (to pre-select)
 */
function showProductSelectionModalForEdit(orderId, orderCode, productIndex, existingProductId) {
    currentEditingOrderId = orderId;
    currentEditingOrderCode = orderCode;
    currentEditingProductIndex = productIndex;

    // Reset selections before opening
    selectedProducts = [];
    selectedCategory = null;
    Object.keys(productQuantities).forEach(k => delete productQuantities[k]);
    Object.keys(productWeights).forEach(k => delete productWeights[k]);
    Object.keys(productNotes).forEach(k => delete productNotes[k]);

    // Pre-select current product if identifiable
    if (existingProductId) {
        selectedProducts = [existingProductId];
        productQuantities[existingProductId] = 1;
        productWeights[existingProductId] = '';
        productNotes[existingProductId] = '';
    }

    showProductSelectionModal();

    // Update modal UI after DOM is ready
    setTimeout(() => {
        const modal = document.getElementById('productSelectionModal');
        if (!modal) return;

        // Update header title
        const header = modal.querySelector('h3');
        if (header) {
            header.innerHTML = `<svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Thay thế sản phẩm`;
        }

        // Update confirm button text
        const confirmBtn = modal.querySelector('button[onclick="addProductFromModal()"]');
        if (confirmBtn) {
            confirmBtn.textContent = 'Thay thế sản phẩm';
        }

        // Hide "Chọn tất cả" button in replace mode
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) selectAllBtn.style.display = 'none';
    }, 0);
}

/**
 * Save selected products to existing order
 * Validates products, adds them to order, and updates database
 */
async function saveProductsToExistingOrder() {
    if (!currentEditingOrderId || selectedProducts.length === 0) {
        showToast('Vui lòng chọn ít nhất một sản phẩm', 'warning');
        return;
    }

    // REPLACE MODE: delegate to replaceProductInExistingOrder
    if (currentEditingProductIndex !== null) {
        if (selectedProducts.length > 1) {
            showToast('Chỉ chọn 1 sản phẩm để thay thế', 'warning');
            return;
        }
        await replaceProductInExistingOrder();
        return;
    }

    // Validate: Check if all products have weight/size (null = chọn "chưa có" — hợp lệ, lưu NULL)
    const missingWeightProducts = [];
    selectedProducts.forEach(productId => {
        const weightInput = document.getElementById(`weight_${productId}`);
        const domVal = weightInput ? weightInput.value.trim() : '';
        const wState = productWeights[productId];
        if (wState === null) return;
        if (!domVal && (wState === undefined || wState === '')) {
            const product = allProductsList.find(p => p.id === productId);
            if (product) missingWeightProducts.push(product.name);
        }
        if (domVal) productWeights[productId] = domVal;
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
                const wRaw = productWeights[productId];
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

                // Add size (for both weight and size) with auto-unit — wRaw === null → không gắn size (NULL DB)
                if (wRaw !== null && wRaw !== undefined && String(wRaw).trim()) {
                    let finalSize = String(wRaw).trim();

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
                products.push(newProduct);
            }
        });

        const updatedProductsJson = JSON.stringify(products);

        // Recalculate freeship after adding new products
        const shouldFreeship = _shouldFreeship(products);
        const curFee = order.shipping_fee || 0;
        const newShippingFee = shouldFreeship ? 0
            : (curFee === 0 ? _getCustomerShippingFee() : curFee);

        // Update in database
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: currentEditingOrderId,
                products: updatedProductsJson,
                shipping_fee: newShippingFee
            })
        });

        const data = await response.json();

        if (data.success) {
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.shipping_fee  !== undefined) updates.shipping_fee  = data.shipping_fee;
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

/**
 * Replace a specific product in an existing order (replace mode)
 */
async function replaceProductInExistingOrder() {
    const productId = selectedProducts[0];
    const newProduct = allProductsList.find(p => p.id === productId);
    if (!newProduct) { showToast('Không tìm thấy sản phẩm', 'error'); return; }

    // Validate weight/size
    const wState = productWeights[productId];
    const domWeightEl = document.getElementById(`weight_${productId}`);
    const domVal = domWeightEl ? domWeightEl.value.trim() : '';
    if (wState !== null) {
        const effectiveVal = domVal || (wState !== undefined ? String(wState).trim() : '');
        if (!effectiveVal) {
            showToast('Vui lòng nhập cân nặng/size cho sản phẩm', 'warning');
            return;
        }
        if (domVal) productWeights[productId] = domVal;
    }

    const quantity = productQuantities[productId] || 1;
    const notes = productNotes[productId] || '';
    const wRaw = productWeights[productId];

    const replaceId = `replace-product-${currentEditingOrderId}`;
    showToast('Đang thay thế sản phẩm...', 'info', 0, replaceId);

    try {
        const orderIndex = allOrdersData.findIndex(o => o.id === currentEditingOrderId);
        if (orderIndex === -1) throw new Error('Không tìm thấy đơn hàng');

        const order = allOrdersData[orderIndex];
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

        // Determine size/weight type from category
        const productCategory = allCategoriesList.find(c => c.id === newProduct.category_id);
        const isAdultBracelet = (productCategory?.name || '').toLowerCase().includes('vòng người lớn');

        const replacement = {
            product_id: newProduct.id,
            name: newProduct.name,
            quantity: quantity
        };
        if (newProduct.price !== undefined && newProduct.price !== null) replacement.price = newProduct.price;
        if (newProduct.cost_price !== undefined && newProduct.cost_price !== null) replacement.cost_price = newProduct.cost_price;

        if (wRaw !== null && wRaw !== undefined && String(wRaw).trim()) {
            let finalSize = String(wRaw).trim();
            if (/^\d+(\.\d+)?$/.test(finalSize)) finalSize += isAdultBracelet ? 'cm' : 'kg';
            replacement.size = finalSize;
        }
        if (notes) replacement.notes = notes;

        products[currentEditingProductIndex] = replacement;
        const updatedProductsJson = JSON.stringify(products);

        // Recalculate shipping freeship condition
        const shouldFreeship = _shouldFreeship(products);
        const curFee = order.shipping_fee || 0;
        const newShippingFee = shouldFreeship ? 0
            : (curFee === 0 ? _getCustomerShippingFee() : curFee);

        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: currentEditingOrderId,
                products: updatedProductsJson,
                shipping_fee: newShippingFee
            })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể thay thế sản phẩm');

        const updates = { products: updatedProductsJson };
        if (data.total_amount  !== undefined) updates.total_amount  = data.total_amount;
        if (data.shipping_fee  !== undefined) updates.shipping_fee  = data.shipping_fee;
        if (data.product_cost  !== undefined) updates.product_cost  = data.product_cost;
        if (data.commission    !== undefined) updates.commission    = data.commission;

        updateOrderData(currentEditingOrderId, updates);
        updateStats();
        renderOrdersTable();
        closeProductSelectionModal();
        showToast(`Đã thay thế sản phẩm cho đơn ${currentEditingOrderCode}`, 'success', null, replaceId);

        currentEditingProductIndex = null;
    } catch (error) {
        console.error('Error replacing product:', error);
        showToast('Không thể thay thế sản phẩm: ' + error.message, 'error', null, replaceId);
    }
}
