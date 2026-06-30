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

/** Nhãn nút khi chưa có cân/size — lưu DB là NULL, không lưu chuỗi này */
const PRODUCT_WEIGHT_UNKNOWN_LABEL = 'chưa có';

/**
 * Chuẩn hóa giá trị ô cân nặng nhập tay/hiển thị về state nội bộ:
 * - '' (rỗng)            → '' (chưa nhập)
 * - 'chưa có' (mọi hoa thường) → null (DB NULL, hợp lệ)
 * - giá trị khác         → giữ nguyên (đã trim)
 */
function normalizeWeightInputValue(raw) {
    const v = (raw == null ? '' : String(raw)).trim();
    if (v === '') return '';
    if (v.toLowerCase() === PRODUCT_WEIGHT_UNKNOWN_LABEL.toLowerCase()) return null;
    return v;
}

/**
 * Sản phẩm thuộc danh mục: khớp với trang Quản lý sản phẩm (category_id chính + category_ids đa danh mục).
 * Chỉ dùng category_id sẽ thiếu SP gắn thêm danh mục qua bảng product_categories.
 */
function productBelongsToCategory(product, categoryId) {
    if (categoryId == null || categoryId === '') return true;
    const normalized = parseInt(String(categoryId), 10);
    if (Number.isNaN(normalized)) return false;
    if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
        return product.category_ids.some((id) => parseInt(String(id), 10) === normalized);
    }
    return parseInt(String(product.category_id ?? ''), 10) === normalized;
}

/**
 * Danh mục KHÔNG cần nhập cân nặng/size (vd: "Sản phẩm bán kèm", "Bi, charm bạc").
 * Khớp theo TÊN danh mục (không hardcode id) để sản phẩm mới thêm vào các danh mục
 * này về sau vẫn tự động được áp dụng — chỉ cần tên danh mục chứa 1 trong các từ khoá.
 */
const NO_WEIGHT_CATEGORY_KEYWORDS = ['bán kèm', 'charm bạc'];

function normalizeCategoryName(name) {
    return (name == null ? '' : String(name)).trim().toLowerCase();
}

/** Tập id các danh mục không cần cân nặng, tính từ allCategoriesList hiện tại. */
function getNoWeightCategoryIdSet() {
    const set = new Set();
    const list = Array.isArray(allCategoriesList) ? allCategoriesList : [];
    for (const cat of list) {
        const name = normalizeCategoryName(cat?.name);
        if (!name) continue;
        if (NO_WEIGHT_CATEGORY_KEYWORDS.some((kw) => name.includes(kw))) {
            const id = parseInt(String(cat.id), 10);
            if (!Number.isNaN(id)) set.add(id);
        }
    }
    return set;
}

/**
 * Sản phẩm có thuộc danh mục không cần cân nặng không?
 * Truyền sẵn noWeightIdSet để tránh tính lại nhiều lần khi render danh sách.
 */
function productSkipsWeight(product, noWeightIdSet) {
    if (!product) return false;
    const set = noWeightIdSet || getNoWeightCategoryIdSet();
    if (set.size === 0) return false;
    if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
        return product.category_ids.some((id) => set.has(parseInt(String(id), 10)));
    }
    return set.has(parseInt(String(product.category_id ?? ''), 10));
}

/** Đường dẫn ảnh hiển thị trong modal (cùng quy ước với trang quản lý sản phẩm admin). */
function resolveModalProductImageSrc(product) {
    const raw = (product.image_url || '').trim();
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return encodeURI(raw);
    }
    if (raw.startsWith('./assets/')) {
        return '../' + raw.substring(2);
    }
    if (raw.startsWith('assets/')) {
        return '../' + raw;
    }
    return `../assets/images/${raw}`;
}

const MODAL_THUMB_FALLBACK_SVG = '<svg class="w-8 h-8 opacity-55" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';

/** Thumbnail 64px (w-16): lazy load, không gọi URL khi không có ảnh. */
function modalProductThumbHtml(imageSrc) {
    const fallback = `<div class="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 pointer-events-none">${MODAL_THUMB_FALLBACK_SVG}</div>`;
    const wrapStart = '<div class="relative h-16 w-16 flex-shrink-0 self-center rounded-lg border border-gray-200 overflow-hidden bg-gray-100">';
    if (!imageSrc) {
        return `${wrapStart}${fallback}</div>`;
    }
    const safe = escapeHtml(imageSrc);
    return `${wrapStart}<img src="${safe}" alt="" width="64" height="64" class="relative z-10 h-full w-full object-cover" loading="lazy" decoding="async" onerror="this.style.display='none'">${fallback}</div>`;
}

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

    // MẶC ĐỊNH: chế độ THÊM (multi-select). Các opener "thay thế/sửa" sẽ gán lại cờ
    // NGAY SAU khi gọi hàm này → đảm bảo mọi luồng thêm luôn cho chọn nhiều sản phẩm.
    currentEditingProductIndex = null;
    currentEditingLocalProductIndex = null;

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
                    <div id="modalSelectedChips" class="hidden mb-3"></div>
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
                <button type="button" id="productModalConfirmBtn" onclick="addProductFromModal()" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium min-w-[140px] inline-flex items-center justify-center">Thêm vào đơn</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    renderModalCategories();
    renderModalProductsList();
    renderSelectedProductChips();
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


/**
 * Mở modal "Chọn sản phẩm" ở chế độ THÊM cho đơn đang soạn.
 * Luôn reset sạch state (kể cả state còn sót từ lần sửa/thay thế trước) để đảm bảo
 * chế độ multi-select (chọn & thêm nhiều sản phẩm cùng lúc) hoạt động ổn định.
 */
function showProductSelectionModalForNewOrder() {
    currentEditingOrderId = null;
    currentEditingOrderCode = null;
    currentEditingProductIndex = null;
    currentEditingLocalProductIndex = null;
    selectedProducts = [];
    selectedCategory = null;
    Object.keys(productQuantities).forEach(k => delete productQuantities[k]);
    Object.keys(productWeights).forEach(k => delete productWeights[k]);
    Object.keys(productNotes).forEach(k => delete productNotes[k]);
    showProductSelectionModal();
}

function closeProductSelectionModal() {
    const modal = document.getElementById('productSelectionModal');
    if (modal) {
        modal.remove();
        selectedCategory = null;
        selectedProducts = [];
        Object.keys(productQuantities).forEach(key => delete productQuantities[key]);
        Object.keys(productWeights).forEach(key => delete productWeights[key]);
        Object.keys(productNotes).forEach(key => delete productNotes[key]);
        currentEditingOrderId = null;
        currentEditingOrderCode = null;
        currentEditingProductIndex = null;
        currentEditingLocalProductIndex = null;
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
    let products = allProductsList.filter((p) => Number(p?.is_active ?? 1) !== 0);
    if (categoryId != null && categoryId !== '') {
        products = products.filter((p) => productBelongsToCategory(p, categoryId));
    }
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
    const noWeightIdSet = getNoWeightCategoryIdSet();
    const countText = `<div class="col-span-2 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium border-b border-gray-200">Tìm thấy ${products.length} sản phẩm</div>`;
    container.innerHTML = countText + products.map(p => {
        const isSelected = selectedProducts.includes(p.id);
        const skipsWeight = productSkipsWeight(p, noWeightIdSet);
        let displayName = escapeHtml(p.name);
        if (searchQuery) {
            const regex = new RegExp(`(${escapeHtml(searchQuery)})`, 'gi');
            displayName = displayName.replace(regex, '<mark class="bg-yellow-200 px-0.5">$1</mark>');
        }
        // Preset "chưa có" → productWeights[id]=null (DB NULL); + 3–15kg (cân)
        const btnUnknown = `<button type="button" onclick="event.stopPropagation(); setProductWeight(${p.id}, null)" class="px-2.5 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded font-medium transition-colors">${PRODUCT_WEIGHT_UNKNOWN_LABEL}</button>`;
        const btnKgPresets = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(kg =>
            `<button type="button" onclick="event.stopPropagation(); setProductWeight(${p.id}, '${kg}kg')" class="px-2.5 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded font-medium transition-colors">${kg}kg</button>`
        ).join('');
        // Danh mục bán kèm / bi, charm bạc: ẩn hẳn ô cân nặng + preset
        const weightPresetRow = skipsWeight ? '' : `<div class="flex flex-wrap gap-1.5 pt-1">${btnUnknown}${isAdultBracelet ? '' : btnKgPresets}</div>`;
        const qtyBlockHtml = `<label class="text-xs text-gray-600 font-medium mb-1 block">SL</label><div class="flex items-center gap-1"><button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, -1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">-</button><input type="number" id="qty_${p.id}" value="${productQuantities[p.id] || 1}" min="1" onclick="event.stopPropagation()" onchange="updateProductQuantity(${p.id}, this.value)" class="w-10 text-center border border-gray-300 rounded py-1 text-sm font-medium" /><button onclick="event.stopPropagation(); adjustProductQuantity(${p.id}, 1)" class="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-sm">+</button></div>`;
        const notesBlockHtml = `<label class="text-xs text-gray-600 font-medium mb-1 block">Lưu ý</label><input type="text" id="notes_${p.id}" value="${escapeAttr(productNotes[p.id] || '')}" placeholder="Ghi chú cho sản phẩm này..." onclick="event.stopPropagation()" onchange="updateProductNotes(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" />`;
        let detailsHtml = '';
        if (isSelected) {
            if (skipsWeight) {
                // Không cần cân nặng: SL giữ nhỏ bên trái, ô "Lưu ý" giãn full phần còn lại
                detailsHtml = `<div class="pt-2 border-t border-purple-200"><div class="flex items-end gap-3"><div class="flex-shrink-0">${qtyBlockHtml}</div><div class="flex-1 min-w-0">${notesBlockHtml}</div></div></div>`;
            } else {
                const weightInputValue = productWeights[p.id] === null ? PRODUCT_WEIGHT_UNKNOWN_LABEL : (productWeights[p.id] === undefined ? '' : productWeights[p.id]);
                const weightCol = `<div class="col-span-3"><label class="text-xs text-gray-600 font-medium mb-1 block">${weightLabel}</label><input type="text" id="weight_${p.id}" value="${escapeAttr(String(weightInputValue))}" placeholder="${escapeAttr(weightPlaceholder)}" onclick="event.stopPropagation()" onchange="updateProductWeight(${p.id}, this.value)" class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" /></div>`;
                detailsHtml = `<div class="pt-2 border-t border-purple-200 space-y-2"><div class="grid grid-cols-12 gap-2"><div class="col-span-2">${qtyBlockHtml}</div>${weightCol}<div class="col-span-7">${notesBlockHtml}</div></div>${weightPresetRow}</div>`;
            }
        }
        const thumbHtml = modalProductThumbHtml(resolveModalProductImageSrc(p));
        const checkboxHtml = `<button type="button" onclick="event.stopPropagation(); toggleModalProductCheckbox(${p.id})" class="flex w-5 flex-shrink-0 items-center justify-center cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400" aria-label="${isSelected ? 'Bỏ chọn' : 'Chọn'} sản phẩm"><div class="h-5 w-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'}">${isSelected ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}</div></button>`;
        const headerSelectClass = isSelected ? '' : ' cursor-pointer hover:bg-purple-50 rounded-lg -m-1 p-1';
        return `<div id="modal_product_${p.id}" class="bg-white flex flex-col gap-3 p-4 transition-all border-b border-r border-gray-100 ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500 ring-inset' : ''}"><div class="flex items-center gap-3">${checkboxHtml}<button type="button" onclick="selectModalProductOnly(${p.id})" class="flex flex-1 items-center gap-3 min-w-0 text-left${headerSelectClass}">${thumbHtml}<div class="flex-1 min-w-0"><p class="font-medium text-gray-900 text-sm leading-snug mb-1">${displayName}</p><div class="flex items-center gap-2 flex-wrap"><p class="text-sm font-bold text-green-600">${formatCurrency(p.price || 0)}</p><span class="text-xs text-gray-500">• ${p.purchases || 0} lượt bán</span></div>${p.sku ? `<p class="text-xs text-gray-500 mt-0.5">SKU: ${escapeHtml(p.sku)}</p>` : ''}</div></button></div>${detailsHtml}</div>`;
    }).join('');
}

function _refreshModalProductListAfterSelection() {
    updateSelectedProductsDisplay();
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    renderModalProductsList(selectedCategory, searchQuery);
}

/** Chọn sản phẩm — bấm vùng tên/ảnh; không bỏ chọn khi đã chọn. */
function selectModalProductOnly(productId) {
    if (selectedProducts.includes(productId)) return;
    selectedProducts.push(productId);
    productQuantities[productId] = 1;
    productWeights[productId] = '';
    productNotes[productId] = '';
    _refreshModalProductListAfterSelection();
}

/** Bật/tắt chọn — chỉ gắn vào ô checkbox. */
function toggleModalProductCheckbox(productId) {
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
    _refreshModalProductListAfterSelection();
}

function updateSelectedProductsDisplay() {
    renderSelectedProductChips();
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

/**
 * Thanh "Đã chọn" ngay dưới ô tìm kiếm: chip nằm ngang (tên + cân nặng).
 * Bấm chip → quay về danh mục chứa sản phẩm (cuộn + highlight); nút × để bỏ chọn.
 */
function renderSelectedProductChips() {
    const container = document.getElementById('modalSelectedChips');
    if (!container) return;

    if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    const noWeightIdSet = getNoWeightCategoryIdSet();
    const chips = selectedProducts.map(id => {
        const product = allProductsList.find(p => p.id === id);
        if (!product) return '';
        const name = escapeHtml(product.name);

        let weightBadge = '';
        if (!productSkipsWeight(product, noWeightIdSet)) {
            const w = productWeights[id];
            let label = '';
            if (w === null) label = 'chưa có';
            else if (w !== undefined && String(w).trim()) label = String(w).trim();
            if (label) {
                weightBadge = `<span class="flex-shrink-0 text-[10px] font-semibold text-purple-700 bg-purple-100 rounded px-1.5 py-0.5 whitespace-nowrap">${escapeHtml(label)}</span>`;
            }
        }

        return `<div class="group inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-white border border-purple-200 rounded-full shadow-sm hover:border-purple-400 transition-colors">
            <button type="button" onclick="jumpToSelectedProduct(${id})" class="inline-flex items-center gap-1.5 min-w-0 max-w-[180px]" title="Bấm để xem/sửa sản phẩm này">
                <span class="truncate text-xs font-medium text-gray-800">${name}</span>
                ${weightBadge}
            </button>
            <button type="button" onclick="removeSelectedProductChip(${id})" class="flex-shrink-0 w-4 h-4 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-500 transition-colors" title="Bỏ chọn">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>`;
    }).join('');

    container.innerHTML = `<div class="flex items-center gap-2 flex-wrap rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2">
        <span class="flex-shrink-0 text-xs font-semibold text-purple-700 whitespace-nowrap">Đã chọn (${selectedProducts.length}):</span>
        <div class="flex items-center gap-1.5 flex-wrap">${chips}</div>
    </div>`;
    container.classList.remove('hidden');
}

/** Quay về danh mục chứa sản phẩm đã chọn rồi cuộn tới + làm nổi bật thẻ sản phẩm. */
function jumpToSelectedProduct(productId) {
    const product = allProductsList.find(p => p.id === productId);
    if (!product) return;

    // Danh mục để quay về: ưu tiên danh mục đầu tiên trong category_ids, fallback category_id
    let catId = null;
    if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
        catId = parseInt(String(product.category_ids[0]), 10);
    } else if (product.category_id != null) {
        catId = parseInt(String(product.category_id), 10);
    }
    selectedCategory = (catId != null && !Number.isNaN(catId)) ? catId : null;

    // Xóa từ khóa tìm kiếm để đảm bảo sản phẩm hiện trong danh mục
    const searchInput = document.getElementById('modalProductSearchInput');
    if (searchInput) searchInput.value = '';

    renderModalCategories();
    renderModalProductsList(selectedCategory, '');

    // Cuộn tới giữa danh sách + highlight tạm thời
    setTimeout(() => {
        const listContainer = document.getElementById('modalProductsListContainer');
        const el = document.getElementById(`modal_product_${productId}`);
        if (listContainer && el) {
            const cRect = listContainer.getBoundingClientRect();
            const pRect = el.getBoundingClientRect();
            const scrollTo = listContainer.scrollTop + pRect.top - cRect.top
                             - listContainer.clientHeight / 2 + el.clientHeight / 2;
            listContainer.scrollTop = Math.max(0, scrollTo);
            el.classList.add('ring-4', 'ring-amber-300', 'ring-offset-1');
            setTimeout(() => el.classList.remove('ring-4', 'ring-amber-300', 'ring-offset-1'), 1600);
        }
    }, 30);
}

/** Bỏ chọn nhanh 1 sản phẩm từ thanh "Đã chọn". */
function removeSelectedProductChip(productId) {
    const idx = selectedProducts.indexOf(productId);
    if (idx > -1) {
        selectedProducts.splice(idx, 1);
        delete productQuantities[productId];
        delete productWeights[productId];
        delete productNotes[productId];
    }
    updateSelectedProductsDisplay();
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    renderModalProductsList(selectedCategory, searchQuery);
}

function toggleSelectAllProducts() {
    const searchInput = document.getElementById('modalProductSearchInput');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    let products = allProductsList.filter((p) => Number(p?.is_active ?? 1) !== 0);
    if (selectedCategory != null && selectedCategory !== '') {
        products = products.filter((p) => productBelongsToCategory(p, selectedCategory));
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(query) || (p.sku && p.sku.toLowerCase().includes(query)));
    }
    const noWeightIdSet = getNoWeightCategoryIdSet();
    const allSelected = products.every(p => selectedProducts.includes(p.id));
    if (allSelected) {
        products.forEach(p => {
            const index = selectedProducts.indexOf(p.id);
            if (index > -1) {
                selectedProducts.splice(index, 1);
                delete productQuantities[p.id];
                delete productWeights[p.id];
                delete productNotes[p.id];
            }
        });
    } else {
        products.forEach(p => {
            if (!selectedProducts.includes(p.id)) {
                selectedProducts.push(p.id);
                productQuantities[p.id] = 1;
                // Khởi tạo state nhất quán với chọn thủ công; SP danh mục không cần cân nặng → null (hợp lệ ngay)
                if (productWeights[p.id] === undefined) {
                    productWeights[p.id] = productSkipsWeight(p, noWeightIdSet) ? null : '';
                }
                if (productNotes[p.id] === undefined) productNotes[p.id] = '';
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
    // 'chưa có' → null; rỗng → ''; còn lại giữ nguyên
    productWeights[productId] = normalizeWeightInputValue(value);
    renderSelectedProductChips();
}

// Set product weight from preset button
function setProductWeight(productId, weight) {
    if (weight === null || weight === undefined) {
        // "chưa có": state = null, input hiển thị nhãn "chưa có" để dễ nhận biết
        productWeights[productId] = null;
        const input = document.getElementById(`weight_${productId}`);
        if (input) input.value = PRODUCT_WEIGHT_UNKNOWN_LABEL;
        renderSelectedProductChips();
        return;
    }
    productWeights[productId] = String(weight).trim();
    const input = document.getElementById(`weight_${productId}`);
    if (input) input.value = productWeights[productId];
    renderSelectedProductChips();
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
    if (document.getElementById('productModalConfirmBtn')?.dataset.loading === '1') return;
    if (currentEditingLocalProductIndex !== null) {
        replaceLocalOrderProduct();
        return;
    }
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
        const noWeightIdSet = getNoWeightCategoryIdSet();
        const missingWeightProducts = [];
        selectedProducts.forEach(productId => {
            const product = allProductsList.find(p => p.id === productId);
            // Sản phẩm bán kèm / bi, charm bạc: không yêu cầu cân nặng
            if (product && productSkipsWeight(product, noWeightIdSet)) return;
            const w = productWeights[productId];
            if (w === null) return;
            const s = w === undefined ? '' : String(w).trim();
            if (!s) {
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
                let productWeight = productWeights[productId];
                const productNote = productNotes[productId] || '';
                if (productWeight !== null && productWeight !== undefined && String(productWeight).trim() && /^\d+(\.\d+)?$/.test(String(productWeight).trim())) {
                    productWeight = String(productWeight).trim() + (isAdultBracelet ? 'cm' : 'kg');
                }
                const existingProduct = currentOrderProducts.find(p => {
                    const pWeightOrSize = isAdultBracelet ? (p.size || '') : (p.weight || '');
                    const cmp = productWeight === null || productWeight === undefined ? '' : String(productWeight);
                    return p.name === product.name && pWeightOrSize === cmp && (p.notes || '') === (productNote || '');
                });
                if (existingProduct) {
                    existingProduct.quantity += productQty;
                } else {
                    const newProduct = { 
                        product_id: product.id,  // CRITICAL: Add product_id for order_items table
                        name: product.name, 
                        quantity: productQty 
                    };
                    if (product.price > 0) newProduct.price = product.price;
                    if (product.cost_price) newProduct.cost_price = product.cost_price;
                    if (productWeight !== null && productWeight !== undefined && String(productWeight).trim()) {
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

/**
 * Cập nhật sản phẩm đang sửa trong đơn ĐANG SOẠN (currentOrderProducts) từ modal "Chọn sản phẩm".
 * Cho phép chọn NHIỀU sản phẩm: thay sản phẩm đang sửa bằng (các) sản phẩm được chọn,
 * chèn đúng vị trí cũ. Giữ id dòng cũ cho sản phẩm đầu tiên (nếu có) để lưu đơn chính xác.
 */
function replaceLocalOrderProduct() {
    const index = currentEditingLocalProductIndex;
    if (index === null || index === undefined) return;

    if (selectedProducts.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 sản phẩm', 'warning');
        return;
    }

    const noWeightIdSet = getNoWeightCategoryIdSet();

    // Validate cân nặng/size cho tất cả (bỏ qua danh mục không cần cân nặng hoặc đã chọn "chưa có" = null)
    const missingWeightProducts = [];
    selectedProducts.forEach(pid => {
        const product = allProductsList.find(p => p.id === pid);
        if (!product || productSkipsWeight(product, noWeightIdSet)) return;
        const w = productWeights[pid];
        if (w === null) return;
        const s = w === undefined ? '' : String(w).trim();
        if (!s) missingWeightProducts.push(product.name);
    });
    if (missingWeightProducts.length > 0) {
        showToast(`Vui lòng nhập cân nặng/size cho: ${missingWeightProducts.join(', ')}`, 'warning');
        return;
    }

    const oldProduct = currentOrderProducts[index];
    const replacements = [];
    selectedProducts.forEach((pid, i) => {
        const product = allProductsList.find(p => p.id === pid);
        if (!product) return;

        const skipsWeight = productSkipsWeight(product, noWeightIdSet);
        const productCategory = allCategoriesList.find(c => c.id === product.category_id);
        const isAdultBracelet = (productCategory?.name || '').toLowerCase().includes('vòng người lớn');

        const quantity = productQuantities[pid] || 1;
        const notes = productNotes[pid] || '';
        const wRaw = productWeights[pid];

        const rep = { product_id: product.id, name: product.name, quantity };
        // Giữ id dòng order_item cũ cho sản phẩm đầu tiên (nếu có)
        if (i === 0 && oldProduct && oldProduct.id) rep.id = oldProduct.id;
        if (product.price !== undefined && product.price !== null) rep.price = product.price;
        if (product.cost_price !== undefined && product.cost_price !== null) rep.cost_price = product.cost_price;

        if (!skipsWeight && wRaw !== null && wRaw !== undefined && String(wRaw).trim()) {
            let finalSize = String(wRaw).trim();
            if (/^\d+(\.\d+)?$/.test(finalSize)) finalSize += isAdultBracelet ? 'cm' : 'kg';
            if (isAdultBracelet) rep.size = finalSize; else rep.weight = finalSize;
        }
        if (notes) rep.notes = notes;
        replacements.push(rep);
    });

    if (replacements.length === 0) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    currentOrderProducts.splice(index, 1, ...replacements);

    renderOrderProducts();
    updateOrderSummary();
    if (typeof updateOrderNotesDisplay === 'function') updateOrderNotesDisplay();
    closeProductSelectionModal();
    showToast(replacements.length > 1 ? `Đã cập nhật ${replacements.length} sản phẩm` : 'Đã cập nhật sản phẩm', 'success');
}

