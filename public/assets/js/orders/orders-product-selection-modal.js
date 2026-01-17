// ============================================
// PRODUCT SELECTION MODAL
// ============================================
// Modal for selecting products to add to orders
// Includes category selection, product search, and custom product input

// Product quantity, weight, size and notes management (global state)
const productQuantities = {};
const productWeights = {};
const productSizes = {};
const productNotes = {};

/**
 * Show product selection modal
 * Opens a modal for selecting products from catalog or custom input
 */
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
            <div class="p-6 overflow-y-auto flex-1">
                <div class="mb-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Bước 1: Chọn danh mục</p>
                    <div id="modalCategoriesGrid" class="flex flex-wrap gap-2"></div>
                </div>
                <div id="modalStep2Container" class="mb-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Bước 2: Chọn sản phẩm</p>
                    <div class="flex gap-2 mb-3">
                        <div class="relative flex-1">
                            <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" id="modalProductSearchInput" placeholder="🔍 Tìm kiếm sản phẩm..." class="w-full pl-10 pr-4 py-2 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <button onclick="toggleSelectAllProducts()" id="selectAllBtn" class="px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition-colors whitespace-nowrap">Chọn tất cả</button>
                    </div>
                    <div id="modalProductsListContainer" class="bg-white rounded-lg border border-purple-200 max-h-64 lg:max-h-80 xl:max-h-96 overflow-y-auto">
                        <div id="modalProductsList" class="grid grid-cols-2 gap-px bg-gray-100"></div>
                    </div>
                </div>
                <div id="modalProductDetailsForm" class="hidden pt-4 border-t border-gray-200">
                    <div id="modalSelectedProductDisplay" class="hidden bg-purple-50 rounded-lg p-3 border border-purple-300 mb-3">
                        <p class="text-xs text-gray-600 mb-1">Sản phẩm đã chọn:</p>
                        <p class="font-semibold text-gray-900" id="modalSelectedProductName"></p>
                        <p class="text-sm text-green-600 font-bold" id="modalSelectedProductPrice"></p>
                    </div>
                </div>
            </div>
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200 flex-shrink-0">
                <button onclick="closeProductSelectionModal()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">Hủy</button>
                <button onclick="addProductFromModal()" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">Thêm vào đơn</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    renderModalCategories();
    renderModalProductsList();
    setupModalProductSearch();
    modal.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            addProductFromModal();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closeProductSelectionModal();
        }
    });
    setTimeout(() => document.getElementById('modalProductSearchInput')?.focus(), 100);
}


function closeProductSelectionModal() {
    const modal = document.getElementById('productSelectionModal');
    if (modal) {
        modal.remove();
        selectedCategory = null;
        selectedProducts = [];
        Object.keys(productQuantities).forEach(key => delete productQuantities[key]);
        currentEditingOrderId = null;
        currentEditingOrderCode = null;
    }
}

function renderModalCategories() {
    const container = document.getElementById('modalCategoriesGrid');
    if (!container) return;
    const categories = [...allCategoriesList];
    container.innerHTML = categories.map(cat => {
        const isSelected = selectedCategory === cat.id;
        const categoryColor = cat.color || '#6b7280';
        return `<button onclick="selectModalCategory(${cat.id})" id="modal_cat_${cat.id}" class="group inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${isSelected ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-gray-50'}"><div class="flex-shrink-0 w-2 h-2 rounded-full transition-all ${isSelected ? 'ring-2 ring-purple-400 ring-offset-1' : ''}" style="background-color: ${isSelected ? '#a855f7' : categoryColor}"></div><span class="text-sm font-medium whitespace-nowrap ${isSelected ? 'text-purple-900' : 'text-gray-700 group-hover:text-purple-700'}">${escapeHtml(cat.name)}</span>${isSelected ? '<svg class="w-4 h-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>' : ''}</button>`;
    }).join('');
}

function selectModalCategory(categoryId) {
    selectedCategory = categoryId;
    renderModalCategories();
    const step2Container = document.getElementById('modalStep2Container');
    const detailsForm = document.getElementById('modalProductDetailsForm');
    
    if (step2Container) step2Container.classList.remove('hidden');
    if (detailsForm) detailsForm.classList.add('hidden');
    renderModalProductsList(categoryId);
}


function renderModalProductsList(categoryId = null, searchQuery = '') {
    const container = document.getElementById('modalProductsList');
    if (!container) return;
    let products = allProductsList.filter(p => p.is_active !== 0);
    if (categoryId) products = products.filter(p => p.category_id === categoryId);
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(query) || (p.sku && p.sku.toLowerCase().includes(query)));
    }
    
    // Sort by purchases (best selling first)
    products.sort((a, b) => {
        const purchasesA = a.purchases || 0;
        const purchasesB = b.purchases || 0;
        return purchasesB - purchasesA; // Descending order (highest first)
    });
    
    if (products.length === 0) {
        container.innerHTML = '<div class="col-span-2 p-8 text-center text-gray-500 text-sm italic">Không có sản phẩm nào</div>';
        return;
    }
    const currentCategory = allCategoriesList.find(c => c.id === categoryId);
    const categoryName = currentCategory ? currentCategory.name : '';
    const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');
    const weightLabel = isAdultBracelet ? 'Size tay' : 'Cân nặng';
    const weightPlaceholder = isAdultBracelet ? 'Size M' : '5kg';
    const countText = `<div class="col-span-2 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium border-b border-gray-200">Tìm thấy ${products.length} sản phẩm</div>`;
    container.innerHTML = countText + products.map(p => {
        const isSelected = selectedProducts.includes(p.id);
        let displayName = escapeHtml(p.name);
        if (searchQuery) {
            const regex = new RegExp(`(${escapeHtml(searchQuery)})`, 'gi');
            displayName = displayName.replace(regex, '<mark class="bg-yellow-200 px-0.5">$1</mark>');
        }
        return `<div onclick="selectModalProduct(${p.id})" id="modal_product_${p.id}" class="bg-white flex flex-col gap-2 p-3 cursor-pointer hover:bg-purple-50 transition-all border-b border-r border-gray-100 ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500 ring-inset' : ''}"><div class="flex items-start gap-2"><div class="flex-shrink-0 mt-0.5"><div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'}">${isSelected ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}</div></div><div class="flex-1 min-w-0"><p class="font-medium text-gray-900 text-sm leading-tight mb-1">${displayName}</p><div class="flex items-center gap-2 flex-wrap"><p class="text-sm font-bold text-green-600">${formatCurrency(p.price || 0)}</p><span class="text-xs text-gray-500">• ${p.purchases || 0} lượt bán</span></div>${p.sku ? `<p class="text-xs text-gray-500 mt-0.5">SKU: ${escapeHtml(p.sku)}</p>` : ''}</div></div>${isSelected ? `<div class="pt-2 border-t border-purple-200 space-y-2"><div class="grid grid-cols-12 gap-2"><div class="col-span-2"><label class="text-xs text-gray-600 font-medium mb-1 block">SL</label><div class="flex items-center gap-1"><button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">-</button><input type="number" id="qty_${p.id}" value="${productQuantities[p.id] || 1}" min="1" onclick="event.stopPropagation()" onchange="updateProductQuantity(${p.id}, this.value)" class="w-10 text-center border border-gray-300 rounded py-1 text-sm font-medium" /><button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">+</button></div></div><div class="col-span-3"><label class="text-xs text-gray-600 font-medium mb-1 block">${weightLabel}</label><input type="text" id="weight_${p.id}" value="${productWeights[p.id] || ''}" placeholder="${weightPlaceholder}" onclick="event.stopPropagation()" onchange="updateProductWeight(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" /></div><div class="col-span-7"><label class="text-xs text-gray-600 font-medium mb-1 block">Lưu ý</label><input type="text" id="notes_${p.id}" value="${productNotes[p.id] || ''}" placeholder="Ghi chú cho sản phẩm này..." onclick="event.stopPropagation()" onchange="updateProductNotes(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" /></div></div>${!isAdultBracelet ? `<div class="flex flex-wrap gap-1.5 pt-1">${[3,4,5,6,7,8,9,10].map(kg => `<button onclick="event.stopPropagation(); setProductWeight(${p.id}, '${kg}kg')" class="px-2.5 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded font-medium transition-colors">${kg}kg</button>`).join('')}</div>` : ''}</div>` : ''}</div>`;
    }).join('');
}

function selectModalProduct(productId) {
    const index = selectedProducts.indexOf(productId);
    if (index > -1) {
        selectedProducts.splice(index, 1);
        delete productQuantities[productId];
        delete productWeights[productId];
        delete productNotes[productId];
    } else {
        selectedProducts.push(productId);
        productQuantities[productId] = 1;
        productWeights[productId] = '';
        productNotes[productId] = '';
    }
    updateSelectedProductsDisplay();
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    renderModalProductsList(selectedCategory, searchQuery);
}

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

function toggleSelectAllProducts() {
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    let products = allProductsList.filter(p => p.is_active !== 0);
    if (selectedCategory) products = products.filter(p => p.category_id === selectedCategory);
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(query) || (p.sku && p.sku.toLowerCase().includes(query)));
    }
    const allSelected = products.every(p => selectedProducts.includes(p.id));
    if (allSelected) {
        products.forEach(p => {
            const index = selectedProducts.indexOf(p.id);
            if (index > -1) {
                selectedProducts.splice(index, 1);
                delete productQuantities[p.id];
            }
        });
    } else {
        products.forEach(p => {
            if (!selectedProducts.includes(p.id)) {
                selectedProducts.push(p.id);
                productQuantities[p.id] = 1;
            }
        });
    }
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
    updateSelectedProductsDisplay();
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

// Set product weight from preset button
function setProductWeight(productId, weight) {
    productWeights[productId] = weight;
    const input = document.getElementById(`weight_${productId}`);
    if (input) {
        input.value = weight;
    }
}

function updateProductNotes(productId, value) {
    productNotes[productId] = value.trim();
}

function setupModalProductSearch() {
    const searchInput = document.getElementById('modalProductSearchInput');
    if (!searchInput) return;
    searchInput.addEventListener('input', function () {
        const query = this.value.trim();
        renderModalProductsList(selectedCategory, query.length === 0 ? '' : query);
    });
}

function addProductFromModal() {
    if (currentEditingOrderId) {
        saveProductsToExistingOrder();
        return;
    }
    let weight = document.getElementById('modalProductWeightInput')?.value.trim();
    const quantity = parseInt(document.getElementById('modalProductQtyInput')?.value) || 1;
    const currentCategory = allCategoriesList.find(c => c.id === selectedCategory);
    const categoryName = currentCategory ? currentCategory.name : '';
    const isAdultBracelet = categoryName.toLowerCase().includes('vòng người lớn');
    if (weight && /^\d+(\.\d+)?$/.test(weight)) {
        weight = weight + (isAdultBracelet ? 'cm' : 'kg');
    }
    if (selectedProducts.length > 0) {
        const weightFieldName = isAdultBracelet ? 'size tay' : 'cân nặng';
        const missingWeightProducts = [];
        selectedProducts.forEach(productId => {
            const productWeight = productWeights[productId] || '';
            if (!productWeight.trim()) {
                const product = allProductsList.find(p => p.id === productId);
                if (product) missingWeightProducts.push(product.name);
            }
        });
        if (missingWeightProducts.length > 0) {
            showToast(`Vui lòng nhập ${weightFieldName} cho: ${missingWeightProducts.join(', ')}`, 'warning');
            return;
        }
        const addedCount = selectedProducts.length;
        selectedProducts.forEach(productId => {
            const product = allProductsList.find(p => p.id === productId);
            if (product) {
                const productQty = productQuantities[productId] || 1;
                let productWeight = productWeights[productId] || '';
                const productNote = productNotes[productId] || '';
                if (productWeight && /^\d+(\.\d+)?$/.test(productWeight)) {
                    productWeight = productWeight + (isAdultBracelet ? 'cm' : 'kg');
                }
                const existingProduct = currentOrderProducts.find(p => {
                    const pWeightOrSize = isAdultBracelet ? (p.size || '') : (p.weight || '');
                    return p.name === product.name && pWeightOrSize === (productWeight || '') && (p.notes || '') === (productNote || '');
                });
                if (existingProduct) {
                    existingProduct.quantity += productQty;
                } else {
                    const newProduct = { name: product.name, quantity: productQty };
                    if (product.price > 0) newProduct.price = product.price;
                    if (product.cost_price) newProduct.cost_price = product.cost_price;
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
    }
}

