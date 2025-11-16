// Products Management JavaScript
let allProducts = [];
let filteredProducts = [];
let viewMode = 'grid'; // 'grid' or 'list'
let currentPage = 1;
const itemsPerPage = 10;

// Sort state
let currentSort = {
    field: null, // 'price', 'margin', 'profit'
    direction: null // 'asc', 'desc'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Products Management initialized');
    loadProducts();
    setupEventListeners();
    setupKeyboardShortcuts();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchAndSort, 300));
    }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
        // Ctrl/Cmd + K: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }

        // Ctrl/Cmd + N: New product
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            showAddProductModal();
        }

        // Escape: Close modal
        if (e.key === 'Escape') {
            closeProductModal();
            closeConfirmModal();
        }
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load all products
async function loadProducts() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getAllProducts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            allProducts = data.products || [];
            filteredProducts = [...allProducts];
            
            console.log('📦 Loaded products:', allProducts.length);
            console.log('📝 Sample product:', allProducts[0]);
            console.log('🔍 Products with "trơn":', allProducts.filter(p => p.name && p.name.toLowerCase().includes('trơn')).length);
            
            renderProducts();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load products');
        }
    } catch (error) {
        console.error('❌ Error loading products:', error);
        hideLoading();
        showError('Không thể tải danh sách sản phẩm');
    }
}


// Toggle filters panel
function toggleFilters() {
    const panel = document.getElementById('advancedFilters');
    const btn = document.getElementById('filterToggleBtn');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.classList.add('bg-indigo-100', 'text-indigo-700');
        btn.classList.remove('bg-gray-100', 'text-gray-700');
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('bg-indigo-100', 'text-indigo-700');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    }
}

// Sort by price
function sortByPrice(direction) {
    currentSort = { field: 'price', direction };
    updateSortBadge();
    searchAndSort();
}

// Sort by profit margin
function sortByMargin(direction) {
    currentSort = { field: 'margin', direction };
    updateSortBadge();
    searchAndSort();
}

// Sort by net profit
function sortByProfit(direction) {
    currentSort = { field: 'profit', direction };
    updateSortBadge();
    searchAndSort();
}

// Reset sort
function resetSort() {
    currentSort = { field: null, direction: null };
    updateSortBadge();
    searchAndSort();
}

// Update sort badge
function updateSortBadge() {
    const badge = document.getElementById('filterBadge');
    
    if (currentSort.field) {
        badge.textContent = '1';
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Search and sort (combined)
function searchAndSort() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value || '';
    currentPage = 1; // Reset to first page

    // Start with all products
    let results = [...allProducts];

    // Apply search filter
    if (searchTerm.trim()) {
        const normalizedSearch = searchTerm.toLowerCase().trim();
        results = results.filter(product => {
            if (product.name && product.name.toLowerCase().includes(normalizedSearch)) return true;
            if (product.sku && product.sku.toLowerCase().includes(normalizedSearch)) return true;
            if (product.category_name && product.category_name.toLowerCase().includes(normalizedSearch)) return true;
            if (!isNaN(normalizedSearch)) {
                const searchPrice = parseFloat(normalizedSearch);
                if (product.price === searchPrice || product.cost_price === searchPrice) return true;
            }
            return false;
        });
    }

    // Apply sorting
    if (currentSort.field) {
        results.sort((a, b) => {
            let aVal, bVal;

            switch (currentSort.field) {
                case 'price':
                    aVal = a.price || 0;
                    bVal = b.price || 0;
                    break;
                case 'margin':
                    aVal = a.price > 0 ? ((a.price - (a.cost_price || 0)) / a.price) * 100 : 0;
                    bVal = b.price > 0 ? ((b.price - (b.cost_price || 0)) / b.price) * 100 : 0;
                    break;
                case 'profit':
                    aVal = (a.price || 0) - (a.cost_price || 0);
                    bVal = (b.price || 0) - (b.cost_price || 0);
                    break;
                default:
                    return 0;
            }

            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }

    filteredProducts = results;
    console.log('✅ Filtered & sorted products:', filteredProducts.length);
    renderProducts();
}

// Legacy function for backward compatibility
function searchProducts() {
    searchAndSort();
}

// Render products grid with pagination
function renderProducts() {
    const grid = document.getElementById('productsGrid');

    if (!grid) {
        console.error('❌ Products grid element not found');
        return;
    }

    // Update stats
    updateStats();

    if (filteredProducts.length === 0) {
        console.log('📭 No products to display');
        grid.innerHTML = '';
        showEmptyState();
        hidePagination();
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);

    console.log(`📦 Rendering ${pageProducts.length} products (page ${currentPage}/${totalPages})`);

    // Render products for current page
    grid.innerHTML = pageProducts.map(product => createProductCard(product)).join('');

    // Render pagination
    renderPagination(totalPages);

    showGrid();

    // Scroll to top of grid only if not on first page
    if (currentPage > 1) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Update statistics
function updateStats() {
    // Total products
    document.getElementById('totalProducts').textContent = allProducts.length;

    // Categories count - check both category and category_id
    const categories = new Set(
        allProducts
            .map(p => p.category || p.category_id || p.category_name)
            .filter(Boolean)
    );
    document.getElementById('totalCategories').textContent = categories.size;

    // Average price
    const avgPrice = allProducts.length > 0
        ? allProducts.reduce((sum, p) => sum + (p.price || 0), 0) / allProducts.length
        : 0;
    document.getElementById('avgPrice').textContent = formatCurrency(avgPrice);

    // Active products
    const activeCount = allProducts.filter(p => p.is_active !== 0).length;
    document.getElementById('activeProducts').textContent = activeCount;
}

// Set view mode
function setViewMode(mode) {
    viewMode = mode;
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    const grid = document.getElementById('productsGrid');

    if (mode === 'grid') {
        gridBtn.classList.add('bg-white', 'shadow-sm', 'text-admin-primary');
        gridBtn.classList.remove('text-gray-600');
        listBtn.classList.remove('bg-white', 'shadow-sm', 'text-admin-primary');
        listBtn.classList.add('text-gray-600');
        grid.classList.remove('grid-cols-1');
        grid.classList.add('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5');
    } else {
        listBtn.classList.add('bg-white', 'shadow-sm', 'text-admin-primary');
        listBtn.classList.remove('text-gray-600');
        gridBtn.classList.remove('bg-white', 'shadow-sm', 'text-admin-primary');
        gridBtn.classList.add('text-gray-600');
        grid.classList.add('grid-cols-1');
        grid.classList.remove('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5');
    }
}

// Create product card HTML
function createProductCard(product) {
    const price = formatCurrency(product.price || 0);
    const originalPrice = product.original_price ? formatCurrency(product.original_price) : null;
    const hasDiscount = originalPrice && product.original_price > product.price;
    const categoryName = product.category_name || 'Chưa phân loại';
    const categoryIcon = product.category_icon || '📦';
    const safeName = escapeHtml(product.name).replace(/'/g, '&#39;');

    return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow card-hover">
            <!-- Product Image -->
            <div class="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden relative">
                ${product.image_url ?
            `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<svg class=\\'w-20 h-20 text-purple-300\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4\\' /></svg>'">` :
            `<svg class="w-20 h-20 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>`
        }
                ${hasDiscount ? `
                    <div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                        -${Math.round((1 - product.price / product.original_price) * 100)}%
                    </div>
                ` : ''}
            </div>
            
            <!-- Product Info -->
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="text-base font-semibold text-gray-900 line-clamp-2 flex-1" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
                </div>
                
                <div class="flex items-center gap-2 mb-3 flex-wrap">
                    <span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                        <span>${categoryIcon}</span>
                        <span>${escapeHtml(categoryName)}</span>
                    </span>
                    ${product.sku ? `<span class="text-xs text-gray-500 font-mono">${escapeHtml(product.sku)}</span>` : ''}
                </div>
                
                <div class="space-y-2 mb-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Giá bán:</span>
                        <div class="flex flex-col items-end">
                            <span class="text-lg font-bold text-green-600">${price}</span>
                            ${hasDiscount ? `<span class="text-xs text-gray-400 line-through">${originalPrice}</span>` : ''}
                        </div>
                    </div>
                    ${product.cost_price !== undefined && product.cost_price !== null ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Giá vốn:</span>
                            <span class="text-sm font-medium text-gray-700">${formatCurrency(product.cost_price)}</span>
                        </div>
                        <div class="flex items-center justify-between pt-1 border-t border-gray-100">
                            <span class="text-sm font-semibold text-gray-700">Lãi ròng:</span>
                            <div class="flex flex-col items-end">
                                <span class="text-base font-bold ${(product.price - product.cost_price) > 0 ? 'text-emerald-600' : 'text-red-600'}">
                                    ${formatCurrency(product.price - product.cost_price)}
                                </span>
                                <span class="text-xs ${(product.price - product.cost_price) > 0 ? 'text-emerald-500' : 'text-red-500'}">
                                    ${product.price > 0 ? Math.round(((product.price - product.cost_price) / product.price) * 100) : 0}% margin
                                </span>
                            </div>
                        </div>
                    ` : ''}
                    ${product.stock_quantity !== undefined ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Tồn kho:</span>
                            <span class="text-sm font-medium ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}">
                                ${product.stock_quantity > 0 ? product.stock_quantity : 'Hết hàng'}
                            </span>
                        </div>
                    ` : ''}
                    ${product.rating ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Đánh giá:</span>
                            <div class="flex items-center gap-1">
                                <span class="text-sm font-medium text-yellow-600">⭐ ${product.rating}</span>
                                ${product.purchases ? `<span class="text-xs text-gray-500">(${product.purchases})</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Actions -->
                <div class="flex items-center gap-2">
                    <button onclick="editProduct(${product.id})" 
                        class="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center gap-1">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Sửa
                    </button>
                    <button onclick="confirmDeleteProduct(${product.id}, '${safeName}')" 
                        class="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Xóa sản phẩm">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}


// Show add product modal
function showAddProductModal() {
    const modal = document.createElement('div');
    modal.id = 'productModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-bold text-white">Thêm sản phẩm mới</h2>
                    <button onclick="closeProductModal()" class="text-white/80 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <form id="productForm" class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]" onsubmit="event.preventDefault(); saveProduct();">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Tên sản phẩm <span class="text-red-500">*</span>
                        </label>
                        <input type="text" id="productName" required
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="VD: Vòng dâu tằm trơn" autofocus>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                Giá bán <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                                <input type="number" id="productPrice" required min="0" step="1000"
                                    class="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="69000" oninput="calculateExpectedProfit()">
                                <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Giá gốc</label>
                            <div class="relative">
                                <input type="number" id="productOriginalPrice" min="0" step="1000"
                                    class="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="89000">
                                <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                💰 Giá vốn <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                                <input type="number" id="productCostPrice" required min="0" step="1000"
                                    class="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="35000" oninput="calculateExpectedProfit()">
                                <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Chi phí làm vòng (dây, bi bạc, charm...)</p>
                        </div>
                        <div>
                            <div id="profitDisplay" class="hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">📊 Lãi dự kiến</label>
                                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg px-4 py-3">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-sm text-gray-600">Lãi:</span>
                                        <span id="profitAmount" class="text-lg font-bold text-green-600">0đ</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">Tỷ suất:</span>
                                        <span id="profitMargin" class="text-sm font-semibold text-green-600">0%</span>
                                    </div>
                                </div>
                            </div>
                            <div id="lossWarning" class="hidden">
                                <label class="block text-sm font-semibold text-red-600 mb-2">⚠️ Cảnh báo</label>
                                <div class="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3">
                                    <p class="text-sm text-red-600 font-medium">Giá vốn cao hơn giá bán!</p>
                                    <p class="text-xs text-red-500 mt-1">Sản phẩm này sẽ bị lỗ</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Tồn kho</label>
                            <input type="number" id="productStockQuantity" min="0" value="0"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="10">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Đánh giá</label>
                            <input type="number" id="productRating" min="0" max="5" step="0.1" value="0"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="4.5">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Lượt mua</label>
                            <input type="number" id="productPurchases" min="0" value="0"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="100">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Danh mục</label>
                        <select id="productCategoryId" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                            <option value="">-- Chọn danh mục --</option>
                        </select>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Cân nặng</label>
                            <input type="text" id="productWeight"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="VD: 500g">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Size/Tay</label>
                            <input type="text" id="productSize"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="VD: Size M">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Mã SKU</label>
                        <input type="text" id="productSKU"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="VD: SP001">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
                        <textarea id="productDescription" rows="3"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Mô tả chi tiết về sản phẩm..."></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">URL ảnh</label>
                        <input type="url" id="productImageURL"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="https://example.com/image.jpg">
                    </div>
                </div>
            </form>
            
            <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                <button type="button" onclick="closeProductModal()"
                    class="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button type="button" onclick="saveProduct()"
                    class="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu sản phẩm
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Load categories into select
    loadCategoriesForSelect();
}

// Close product modal
function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.remove();
    }
}

// Save product (create or update)
async function saveProduct(productId = null) {
    const name = document.getElementById('productName')?.value.trim();
    const price = document.getElementById('productPrice')?.value;
    const originalPrice = document.getElementById('productOriginalPrice')?.value;
    const costPrice = document.getElementById('productCostPrice')?.value;
    const categoryId = document.getElementById('productCategoryId')?.value;
    const stockQuantity = document.getElementById('productStockQuantity')?.value;
    const rating = document.getElementById('productRating')?.value;
    const purchases = document.getElementById('productPurchases')?.value;
    const weight = document.getElementById('productWeight')?.value.trim();
    const size = document.getElementById('productSize')?.value.trim();
    const sku = document.getElementById('productSKU')?.value.trim();
    const description = document.getElementById('productDescription')?.value.trim();
    const image_url = document.getElementById('productImageURL')?.value.trim();

    // Validation
    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        document.getElementById('productName')?.focus();
        return;
    }

    if (!price || parseFloat(price) <= 0) {
        showToast('Vui lòng nhập giá hợp lệ', 'warning');
        document.getElementById('productPrice')?.focus();
        return;
    }

    if (!costPrice || parseFloat(costPrice) < 0) {
        showToast('Vui lòng nhập giá vốn hợp lệ', 'warning');
        document.getElementById('productCostPrice')?.focus();
        return;
    }

    // Validate image URL if provided
    if (image_url && !isValidUrl(image_url)) {
        showToast('URL ảnh không hợp lệ', 'warning');
        document.getElementById('productImageURL')?.focus();
        return;
    }

    const productData = {
        action: productId ? 'updateProduct' : 'createProduct',
        name,
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        cost_price: parseFloat(costPrice),
        category_id: categoryId ? parseInt(categoryId) : null,
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : 0,
        rating: rating ? parseFloat(rating) : 0,
        purchases: purchases ? parseInt(purchases) : 0,
        weight: weight || null,
        size: size || null,
        sku: sku || null,
        description: description || null,
        image_url: image_url || null
    };

    if (productId) {
        productData.id = productId;
    }

    try {
        // Disable save button to prevent double submission
        const saveBtn = event?.target;
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Đang lưu...';
        }

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(productId ? '✓ Đã cập nhật sản phẩm' : '✓ Đã thêm sản phẩm mới', 'success');
            closeProductModal();
            await loadProducts();
        } else {
            throw new Error(data.error || 'Không thể lưu sản phẩm');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Lỗi: ' + error.message, 'error');

        // Re-enable save button
        const saveBtn = event?.target;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = productId ? 'Cập nhật' : 'Lưu sản phẩm';
        }
    }
}

// Validate URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Calculate expected profit
function calculateExpectedProfit() {
    const price = parseFloat(document.getElementById('productPrice')?.value) || 0;
    const costPrice = parseFloat(document.getElementById('productCostPrice')?.value) || 0;
    
    const profitDisplay = document.getElementById('profitDisplay');
    const lossWarning = document.getElementById('lossWarning');
    const profitAmount = document.getElementById('profitAmount');
    const profitMargin = document.getElementById('profitMargin');
    
    if (price > 0 && costPrice >= 0) {
        const profit = price - costPrice;
        const margin = price > 0 ? (profit / price) * 100 : 0;
        
        if (profit < 0) {
            // Show loss warning
            profitDisplay?.classList.add('hidden');
            lossWarning?.classList.remove('hidden');
        } else {
            // Show profit
            lossWarning?.classList.add('hidden');
            profitDisplay?.classList.remove('hidden');
            
            if (profitAmount) {
                profitAmount.textContent = formatCurrency(profit);
                profitAmount.className = profit > 0 ? 'text-lg font-bold text-green-600' : 'text-lg font-bold text-gray-600';
            }
            
            if (profitMargin) {
                profitMargin.textContent = `${Math.round(margin)}%`;
                profitMargin.className = profit > 0 ? 'text-sm font-semibold text-green-600' : 'text-sm font-semibold text-gray-600';
            }
        }
    } else {
        profitDisplay?.classList.add('hidden');
        lossWarning?.classList.add('hidden');
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount).replace('₫', 'đ');
}


// Edit product
async function editProduct(productId) {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getProduct&id=${productId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error('Không tìm thấy sản phẩm');
        }

        const product = data.product;

        // Show modal with product data
        const modal = document.createElement('div');
        modal.id = 'productModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-xl font-bold text-white">Chỉnh sửa sản phẩm</h2>
                        <button onclick="closeProductModal()" class="text-white/80 hover:text-white">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <form id="productForm" class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]" onsubmit="event.preventDefault(); saveProduct(${productId});">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                Tên sản phẩm <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="productName" required value="${escapeHtml(product.name)}"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" autofocus>
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    Giá bán <span class="text-red-500">*</span>
                                </label>
                                <div class="relative">
                                    <input type="number" id="productPrice" required min="0" step="1000" value="${product.price}"
                                        class="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" oninput="calculateExpectedProfit()">
                                    <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Giá gốc</label>
                                <div class="relative">
                                    <input type="number" id="productOriginalPrice" min="0" step="1000" value="${product.original_price || ''}"
                                        class="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    💰 Giá vốn <span class="text-red-500">*</span>
                                </label>
                                <div class="relative">
                                    <input type="number" id="productCostPrice" required min="0" step="1000" value="${product.cost_price || 0}"
                                        class="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" oninput="calculateExpectedProfit()">
                                    <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Chi phí làm vòng (dây, bi bạc, charm...)</p>
                            </div>
                            <div>
                                <div id="profitDisplay" class="hidden">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">📊 Lãi dự kiến</label>
                                    <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg px-4 py-3">
                                        <div class="flex items-center justify-between mb-1">
                                            <span class="text-sm text-gray-600">Lãi:</span>
                                            <span id="profitAmount" class="text-lg font-bold text-green-600">0đ</span>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-500">Tỷ suất:</span>
                                            <span id="profitMargin" class="text-sm font-semibold text-green-600">0%</span>
                                        </div>
                                    </div>
                                </div>
                                <div id="lossWarning" class="hidden">
                                    <label class="block text-sm font-semibold text-red-600 mb-2">⚠️ Cảnh báo</label>
                                    <div class="bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3">
                                        <p class="text-sm text-red-600 font-medium">Giá vốn cao hơn giá bán!</p>
                                        <p class="text-xs text-red-500 mt-1">Sản phẩm này sẽ bị lỗ</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Tồn kho</label>
                                <input type="number" id="productStockQuantity" min="0" value="${product.stock_quantity || 0}"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Đánh giá</label>
                                <input type="number" id="productRating" min="0" max="5" step="0.1" value="${product.rating || 0}"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Lượt mua</label>
                                <input type="number" id="productPurchases" min="0" value="${product.purchases || 0}"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Danh mục</label>
                            <select id="productCategoryId" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="">-- Chọn danh mục --</option>
                            </select>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Cân nặng</label>
                                <input type="text" id="productWeight" value="${escapeHtml(product.weight || '')}" placeholder="VD: 500g"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Size/Tay</label>
                                <input type="text" id="productSize" value="${escapeHtml(product.size || '')}" placeholder="VD: Size M"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Mã SKU</label>
                            <input type="text" id="productSKU" value="${escapeHtml(product.sku || '')}" placeholder="VD: SP001"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
                            <textarea id="productDescription" rows="3" placeholder="Mô tả chi tiết về sản phẩm..."
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${escapeHtml(product.description || '')}</textarea>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">URL ảnh</label>
                            <input type="url" id="productImageURL" value="${escapeHtml(product.image_url || '')}" placeholder="https://..."
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        </div>
                    </div>
                </form>
                
                <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                    <button type="button" onclick="closeProductModal()"
                        class="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Hủy
                    </button>
                    <button type="button" onclick="saveProduct(${productId})"
                        class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                        Cập nhật
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Load categories into select
        loadCategoriesForSelect(product.category_id);
        
        // Calculate profit on load
        setTimeout(() => calculateExpectedProfit(), 100);

    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Không thể tải thông tin sản phẩm', 'error');
    }
}

// Load categories for select dropdown
async function loadCategoriesForSelect(selectedCategoryId = null) {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAllCategories`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('productCategoryId');
            if (!select) return;
            
            // Keep the first option (-- Chọn danh mục --)
            const firstOption = select.options[0];
            select.innerHTML = '';
            select.appendChild(firstOption);
            
            // Add categories
            data.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = `${cat.icon || ''} ${cat.name}`.trim();
                if (cat.id === selectedCategoryId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Confirm delete product
function confirmDeleteProduct(productId, productName) {
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 rounded-t-xl">
                <h3 class="text-lg font-bold text-white">Xác nhận xóa</h3>
            </div>
            <div class="p-6">
                <p class="text-gray-700 mb-4">Bạn có chắc chắn muốn xóa sản phẩm:</p>
                <p class="font-bold text-gray-900 mb-4">${escapeHtml(productName)}</p>
                <p class="text-sm text-gray-500">Sản phẩm sẽ bị ẩn khỏi danh sách.</p>
            </div>
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button onclick="closeConfirmModal()"
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button onclick="deleteProduct(${productId})"
                    class="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Xóa
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.remove();
}

// Delete product
async function deleteProduct(productId) {
    closeConfirmModal();

    try {
        showToast('Đang xóa...', 'info');

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteProduct',
                id: productId
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Đã xóa sản phẩm', 'success');
            loadProducts();
        } else {
            throw new Error(data.error || 'Không thể xóa sản phẩm');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// formatCurrency function is defined earlier in the file

function showLoading() {
    document.getElementById('loadingState')?.classList.remove('hidden');
    document.getElementById('productsGrid')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState')?.classList.add('hidden');
}

function showGrid() {
    hideLoading();
    document.getElementById('productsGrid')?.classList.remove('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function showEmptyState() {
    hideLoading();
    document.getElementById('productsGrid')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}

function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    const icons = {
        success: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
        error: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
        warning: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
        info: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
    };

    toast.className = `toast-notification fixed bottom-4 right-4 px-5 py-3 rounded-lg shadow-xl text-white z-50 flex items-center gap-3 ${colors[type] || colors.success} animate-slideUp`;
    toast.innerHTML = `
        ${icons[type] || icons.success}
        <span class="font-medium">${escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// Pagination functions
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        paginationContainer.classList.add('hidden');
        return;
    }

    paginationContainer.classList.remove('hidden');

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredProducts.length);

    let html = '<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">';

    // Info text
    html += `<div class="text-sm text-gray-700">
        Hiển thị <span class="font-medium">${startItem}</span> đến <span class="font-medium">${endItem}</span> trong tổng số <span class="font-medium">${filteredProducts.length}</span> sản phẩm
    </div>`;

    // Pagination buttons
    html += '<div class="flex items-center gap-2">';

    // Previous button
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
    </button>`;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="goToPage(1)" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">1</button>`;
        if (startPage > 2) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-2 rounded-lg bg-admin-primary text-white text-sm font-medium">${i}</button>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
        html += `<button onclick="goToPage(${totalPages})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">${totalPages}</button>`;
    }

    // Next button
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
    </button>`;

    html += '</div></div>';

    paginationContainer.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderProducts();
}

function hidePagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
        paginationContainer.classList.add('hidden');
    }
}
