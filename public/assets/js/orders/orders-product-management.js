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
        }
        if (categoriesData.success) {
            allCategoriesList = categoriesData.categories || [];
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

/**
 * Show product selection modal for existing order
 * Opens modal to add products to an existing order
 * @param {number} orderId - ID of the order to add products to
 * @param {string} orderCode - Code of the order (for display)
 */
function showProductSelectionModalForOrder(orderId, orderCode) {
    currentEditingOrderId = orderId;
    currentEditingOrderCode = orderCode;
    showProductSelectionModal();
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

                console.log('📦 Adding product to order:', {
                    name: product.name,
                    category: categoryName,
                    isAdultBracelet: isAdultBracelet,
                    price: product.price,
                    cost_price: product.cost_price,
                    quantity: quantity,
                    weightOrSize: wRaw,
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
