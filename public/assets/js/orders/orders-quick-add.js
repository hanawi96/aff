// ============================================
// ORDERS QUICK ADD - Thêm nhanh sản phẩm
// ============================================
// Chức năng: Hiển thị và thêm nhanh sản phẩm bán chạy và freeship

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
                        <div class="flex flex-wrap gap-1 mt-1.5">
                            ${[3,4,5,6,7,8,9,10].map(kg => `<button onclick="setQuickProductSize('${sizeId}', '${kg}kg')" class="px-2 py-0.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded font-medium transition-colors">${kg}kg</button>`).join('')}
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

// Change quantity in quick add input
function quickChangeQty(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const currentVal = parseInt(input.value) || 1;
    const newVal = Math.max(1, currentVal + delta);
    input.value = newVal;
}

// Set size/weight from preset button for quick add products
function setQuickProductSize(sizeInputId, value) {
    const input = document.getElementById(sizeInputId);
    if (input) {
        input.value = value;
    }
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
