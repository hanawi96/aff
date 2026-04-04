// Products Management JavaScript
let allProducts = [];
let filteredProducts = [];
let allCategories = [];
let viewMode = 'grid'; // 'grid' or 'list'
let currentPage = 1;
const itemsPerPage = 10;
let pendingImageFile = null;
let pendingImagePreviewUrl = null;
let pinnedProductId = null;
let editingProductStockId = null;
let originalProductStockValue = null;
let outdatedProductsCache = null;
let shouldShowMaterialOutdatedWarnings = null;

function normalizeBraceletType(value) {
    if (value === 'adjustable') return 'adjustable';
    if (value === 'other') return 'other';
    return 'elastic';
}

function getBraceletTypeLabel(value) {
    const normalizedType = normalizeBraceletType(value);
    if (normalizedType === 'adjustable') return 'Dây rút';
    if (normalizedType === 'other') return 'Loại khác';
    return 'Dây co giãn';
}

function setBraceletTypePreset(value) {
    const normalizedType = normalizeBraceletType(value);
    const input = document.getElementById('productBraceletType');
    if (input) {
        input.value = normalizedType;
    }

    document.querySelectorAll('[data-bracelet-type]').forEach((btn) => {
        const isActive = btn.getAttribute('data-bracelet-type') === normalizedType;
        btn.classList.toggle('bg-indigo-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('border-indigo-600', isActive);
        btn.classList.toggle('shadow-sm', isActive);

        btn.classList.toggle('bg-white', !isActive);
        btn.classList.toggle('text-gray-700', !isActive);
        btn.classList.toggle('border-gray-300', !isActive);
        btn.classList.toggle('hover:border-indigo-300', !isActive);
        btn.classList.toggle('hover:text-indigo-700', !isActive);
    });
}

// Filter state
let currentFilters = {
    categoryId: null,
    searchTerm: ''
};

// Sort state (null = mặc định: lượt bán cao → thấp)
let currentSort = {
    field: null, // 'price', 'margin', 'profit', 'purchases'
    direction: null // 'asc', 'desc'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Read URL filters before first render to avoid active-button flicker.
    loadFiltersFromURL({ applyNow: false });

    Promise.all([
        loadCategories(),
        loadProducts()
    ]).then(() => {
        setupEventListeners();
        setupKeyboardShortcuts();
        checkOutdatedProducts();
    });
});

// Load filters from URL parameters
function loadFiltersFromURL(options = {}) {
    const applyNow = options.applyNow !== false;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Get category from URL
    const categoryId = urlParams.get('category');
    if (categoryId) {
        currentFilters.categoryId = parseInt(categoryId);
    }
    
    // Get search term from URL
    const searchTerm = urlParams.get('search');
    if (searchTerm) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = searchTerm;
            currentFilters.searchTerm = searchTerm;
        }
    }
    
    // Apply filters if any exist
    if (applyNow && (categoryId || searchTerm)) {
        // Re-render category buttons so active highlight matches URL filter
        populateCategoryFilter();
        searchAndSort();
    }
}

// Update URL with current filters
function updateURL() {
    const params = new URLSearchParams();
    
    // Add category to URL if selected
    if (currentFilters.categoryId) {
        params.set('category', currentFilters.categoryId);
    }
    
    // Add search term to URL if exists
    if (currentFilters.searchTerm) {
        params.set('search', currentFilters.searchTerm);
    }
    
    // Update URL without reloading page
    const newURL = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
    
    window.history.pushState({ filters: currentFilters }, '', newURL);
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchAndSort, 300));
    }
    
    // Note: Category filter is now handled by button clicks, no need for change listener
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.filters) {
            // Restore filters from history state
            currentFilters = event.state.filters;
            
            // Update UI
            const searchInput = document.getElementById('searchInput');
            const categoryFilter = document.getElementById('categoryFilter');
            
            if (searchInput) {
                searchInput.value = currentFilters.searchTerm || '';
            }
            
            if (categoryFilter) {
                categoryFilter.value = currentFilters.categoryId || '';
            }
            
            // Re-apply filters
            populateCategoryFilter();
            searchAndSort();
        } else {
            // No state, load from URL
            loadFiltersFromURL();
        }
    });
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

// Load categories for filter
async function loadCategories() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAllCategories&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            allCategories = data.categories || [];
            populateCategoryFilter();
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Populate category filter buttons
function populateCategoryFilter() {
    const container = document.getElementById('categoryFilterButtons');
    if (!container) return;

    const activeProducts = allProducts.filter(p => Number(p?.is_active ?? 1) !== 0);
    const getCategoryCount = (categoryId) => {
        const normalizedCategoryId = parseInt(categoryId);
        if (isNaN(normalizedCategoryId)) return 0;

        return activeProducts.filter(product => {
            if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
                return product.category_ids.some(id => parseInt(id) === normalizedCategoryId);
            }
            return parseInt(product.category_id) === normalizedCategoryId;
        }).length;
    };

    // Clear existing buttons
    container.innerHTML = '';

    // Create "Tất cả" button
    const allButton = createCategoryButton('', 'Tất cả', activeProducts.length, true);
    container.appendChild(allButton);

    // Create category buttons
    allCategories.forEach(category => {
        const button = createCategoryButton(category.id, category.name, getCategoryCount(category.id), false);
        container.appendChild(button);
    });
}

// Create individual category button
function createCategoryButton(categoryId, name, count, isAll = false) {
    const button = document.createElement('button');
    const isActive = currentFilters.categoryId == categoryId || (isAll && !currentFilters.categoryId);
    
    button.className = `category-btn px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
        isActive 
            ? 'active bg-admin-primary text-white shadow-md' 
            : 'bg-white text-gray-700 hover:text-admin-primary hover:bg-admin-primary/5 border border-gray-200 hover:border-admin-primary/20'
    }`;
    
    button.onclick = () => selectCategoryFilter(categoryId);
    
    // Icon for "Tất cả"
    const icon = isAll ? `
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2h10a2 2 0 012 2v2M7 7V6a1 1 0 011-1h8a1 1 0 011 1v1" />
        </svg>
    ` : `
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
    `;
    
    button.innerHTML = `
        ${icon}
        <span>${name}</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${
            isActive 
                ? 'bg-white/20 text-white' 
                : 'bg-gray-100 text-gray-600'
        }">${count}</span>
    `;
    
    return button;
}

// Select category filter
function selectCategoryFilter(categoryId) {
    // Update filter state
    currentFilters.categoryId = categoryId ? parseInt(categoryId) : null;
    pinnedProductId = null;
    
    // Update button styles
    populateCategoryFilter();
    
    // Apply filter
    searchAndSort();
}

// Load all products
async function loadProducts() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getAllProducts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            allProducts = data.products || [];
            outdatedProductsCache = null;
            shouldShowMaterialOutdatedWarnings = null;

            console.log('📦 Loaded products:', allProducts.length);
            // Refresh category preset counts (especially "Tất cả")
            // after products data is available.
            populateCategoryFilter();

            // Re-apply current filters (skip URL update to avoid duplicate history entries)
            searchAndSort(true);
            
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

// Reload products while keeping current page
async function reloadProductsKeepPage() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getAllProducts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            allProducts = data.products || [];
            outdatedProductsCache = null;
            shouldShowMaterialOutdatedWarnings = null;

            console.log('📦 Reloaded products (keeping page):', allProducts.length);
            // Keep category counters in sync with latest product list.
            populateCategoryFilter();

            // Re-apply current filters without resetting page
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput?.value || '';
            
            // Don't reset currentPage here - keep it as is
            currentFilters.searchTerm = searchTerm.trim();
            
            let results = [...allProducts];

            // Apply category filter - Support multi-category products
            if (currentFilters.categoryId) {
                results = results.filter(product => {
                    // Check if product has multiple categories (new system)
                    if (product.category_ids && product.category_ids.length > 0) {
                        return product.category_ids.includes(currentFilters.categoryId);
                    }
                    // Fallback to single category (old system)
                    return product.category_id === currentFilters.categoryId;
                });
            }

            // Apply search filter
            if (currentFilters.searchTerm) {
                const normalizedSearch = currentFilters.searchTerm.toLowerCase();
                results = results.filter(product => {
                    if (product.name && product.name.toLowerCase().includes(normalizedSearch)) return true;
                    if (product.sku && product.sku.toLowerCase().includes(normalizedSearch)) return true;
                    if (!isNaN(normalizedSearch)) {
                        const searchPrice = parseFloat(normalizedSearch);
                        if (product.price === searchPrice || product.cost_price === searchPrice) return true;
                    }
                    return false;
                });
            }

            // Apply sorting (mặc định: purchases desc)
            const sortField = currentSort.field || 'purchases';
            const sortDir = currentSort.direction || 'desc';
            results.sort((a, b) => {
                let aVal, bVal;

                switch (sortField) {
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
                    case 'purchases':
                        aVal = a.purchases || 0;
                        bVal = b.purchases || 0;
                        break;
                    default:
                        return 0;
                }

                return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
            });

            filteredProducts = results;
            renderProducts();
            
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to reload products');
        }
    } catch (error) {
        console.error('❌ Error reloading products:', error);
        hideLoading();
        showError('Không thể tải lại danh sách sản phẩm');
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
function searchAndSort(skipURLUpdate = false) {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value || '';
    
    currentPage = 1;

    currentFilters.searchTerm = searchTerm.trim();
    // categoryId is already set by selectCategoryFilter function
    
    // Update URL with current filters (skip if called from loadProducts on initial load)
    if (!skipURLUpdate) {
        updateURL();
    }

    let results = [...allProducts];

    // Apply category filter - Support multi-category products
    if (currentFilters.categoryId) {
        results = results.filter(product => {
            // Check if product has multiple categories (new system)
            if (product.category_ids && product.category_ids.length > 0) {
                return product.category_ids.includes(currentFilters.categoryId);
            }
            // Fallback to single category (old system)
            return product.category_id === currentFilters.categoryId;
        });
    }

    // Apply search filter
    if (currentFilters.searchTerm) {
        const normalizedSearch = currentFilters.searchTerm.toLowerCase();
        results = results.filter(product => {
            if (product.name && product.name.toLowerCase().includes(normalizedSearch)) return true;
            if (product.sku && product.sku.toLowerCase().includes(normalizedSearch)) return true;
            if (!isNaN(normalizedSearch)) {
                const searchPrice = parseFloat(normalizedSearch);
                if (product.price === searchPrice || product.cost_price === searchPrice) return true;
            }
            return false;
        });
    }

    // Apply sorting (mặc định: purchases desc)
    const sortField = currentSort.field || 'purchases';
    const sortDir = currentSort.direction || 'desc';
    results.sort((a, b) => {
        let aVal, bVal;

        switch (sortField) {
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
            case 'purchases':
                aVal = a.purchases || 0;
                bVal = b.purchases || 0;
                break;
            default:
                return 0;
        }

        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pin newly created product to top once (after filtering/sorting).
    if (pinnedProductId) {
        const pinnedIndex = results.findIndex(p => Number(p.id) === Number(pinnedProductId));
        if (pinnedIndex > 0) {
            const [pinned] = results.splice(pinnedIndex, 1);
            results.unshift(pinned);
        }
        pinnedProductId = null;
    }

    filteredProducts = results;
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
        console.error('Products grid element not found');
        return;
    }

    // Update stats
    updateStats();

    if (filteredProducts.length === 0) {
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
    const hasOriginalPrice = originalPrice && product.original_price > 0;
    const hasDiscount = hasOriginalPrice && product.original_price > product.price;
    const safeName = escapeHtml(product.name).replace(/'/g, '&#39;');

    // Get categories array (from new multi-category system)
    const categories = product.categories || [];
    const hasCategories = categories.length > 0;

    // Fallback to old single category if no categories array
    const categoryName = product.category_name || 'Chưa phân loại';
    const categoryIcon = product.category_icon || '📦';

    // Generate image URL
    let imageUrl;
    if (product.image_url) {
        // If it's already a full URL (http/https), use it directly with URL encoding
        if (product.image_url.startsWith('http://') || product.image_url.startsWith('https://')) {
            // URL encode the path to handle spaces
            imageUrl = encodeURI(product.image_url);
        }
        // If image_url starts with ./ or assets/, convert to relative path from admin folder
        else if (product.image_url.startsWith('./assets/')) {
            imageUrl = '../' + product.image_url.substring(2); // Remove ./ and add ../
        } else if (product.image_url.startsWith('assets/')) {
            imageUrl = '../' + product.image_url; // Just add ../
        } else {
            // Just a filename, add full path
            imageUrl = `../assets/images/${product.image_url}`;
        }
    } else {
        // No image_url, use product name as filename
        imageUrl = `../assets/images/${product.name}.jpg`;
    }

    // Check if this product is selected
    const isSelected = selectedProductIds.has(product.id);

    return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow card-hover relative">
            <!-- Checkbox -->
            <div class="absolute top-3 left-3 z-10">
                <input type="checkbox" 
                    class="product-checkbox w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer bg-white shadow-sm" 
                    data-product-id="${product.id}"
                    ${isSelected ? 'checked' : ''}
                    onchange="handleProductCheckbox(${product.id}, this.checked)">
            </div>
            
            <!-- Product Image -->
            <div class="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden relative cursor-pointer"
                title="Click để sửa sản phẩm"
                onclick="editProduct(${product.id})">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<svg class=\\'w-20 h-20 text-purple-300\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4\\' /></svg>'">
                ${hasDiscount ? `
                    <div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                        -${Math.round((1 - product.price / product.original_price) * 100)}%
                    </div>
                ` : ''}
            </div>
            
            <!-- Product Info -->
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1 flex items-center gap-2 group">
                        <h3 class="product-name text-base font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-admin-primary transition-colors flex-1" 
                            title="Click để chỉnh sửa tên sản phẩm"
                            onclick="startEditProductName(${product.id}, this)"
                            data-product-id="${product.id}"
                            data-original-name="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onclick="startEditProductName(${product.id}, this.previousElementSibling)">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-400 hover:text-admin-primary">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                        </div>
                        <div class="edit-name-tooltip">Click để chỉnh sửa</div>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 mb-3 flex-wrap" id="categories-${product.id}">
                    ${hasCategories ?
            (() => {
                const maxVisible = 3;
                const visibleCategories = categories.slice(0, maxVisible);
                const remainingCount = categories.length - maxVisible;

                return visibleCategories.map(cat => `
                            <span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                                ${cat.color ? `<span class="w-2 h-2 rounded-full" style="background-color: ${cat.color}"></span>` : `<span class="w-2 h-2 rounded-full bg-purple-500"></span>`}
                                <span>${escapeHtml(cat.name)}</span>
                            </span>
                        `).join('') +
                    (remainingCount > 0 ? `
                            <button type="button" 
                                onclick="toggleCategories(${product.id}, ${JSON.stringify(categories).replace(/"/g, '&quot;')})"
                                class="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-medium rounded transition-colors">
                                +${remainingCount} danh mục
                            </button>
                        ` : '');
            })()
            :
            `<span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span>${escapeHtml(categoryName)}</span>
                        </span>`
        }
                    ${product.sku ? `<span class="text-xs text-gray-500 font-mono">${escapeHtml(product.sku)}</span>` : ''}
                    <span class="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded border border-indigo-100">${escapeHtml(getBraceletTypeLabel(product.bracelet_type))}</span>
                </div>
                
                <div class="space-y-2 mb-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Giá bán:</span>
                        <div class="flex flex-col items-end">
                            <span class="text-lg font-bold text-green-600">${price}</span>
                            ${hasOriginalPrice ? `<span class="text-xs text-gray-400 line-through">${originalPrice}</span>` : ''}
                        </div>
                    </div>
                    ${product.cost_price !== undefined && product.cost_price !== null ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Giá vốn:</span>
                            <span class="text-sm font-medium text-gray-700">${formatCurrency(product.cost_price)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            ${(product.pricing_method === 'profit') ? `
                                <span class="text-sm text-gray-600">💰 Lãi mong muốn:</span>
                                ${product.target_profit !== undefined && product.target_profit !== null ? `
                                    <span class="text-sm font-bold text-green-600">${formatCurrency(product.target_profit)}</span>
                                ` : `
                                    <span class="text-sm text-gray-400 italic">Chưa có</span>
                                `}
                            ` : `
                                <span class="text-sm text-gray-600">📊 Hệ số markup:</span>
                                ${product.markup_multiplier !== undefined && product.markup_multiplier !== null ? `
                                    <span class="text-sm font-bold text-purple-600">×${parseFloat(product.markup_multiplier).toFixed(1)}</span>
                                ` : `
                                    <span class="text-sm text-gray-400 italic">Chưa có</span>
                                `}
                            `}
                        </div>
                        <div class="flex items-center justify-between pt-1 border-t border-gray-100">
                            <span class="text-sm font-semibold text-gray-700">Lãi ròng:</span>
                            <div class="text-right">
                                <span class="text-base font-bold ${(product.price - product.cost_price) > 0 ? 'text-emerald-600' : 'text-red-600'}">
                                    ${formatCurrency(product.price - product.cost_price)} (${product.price > 0 ? Math.round(((product.price - product.cost_price) / product.price) * 100) : 0}% margin)
                                </span>
                            </div>
                        </div>
                    ` : ''}
                    ${product.stock_quantity !== undefined ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Tồn kho:</span>
                            <div class="flex items-center gap-1.5 group">
                                <span class="text-sm font-medium ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'} cursor-pointer"
                                    title="Click để chỉnh sửa tồn kho"
                                    onclick="startEditProductStock(${product.id}, this)"
                                    data-product-id="${product.id}"
                                    data-original-stock="${product.stock_quantity}">
                                    ${product.stock_quantity > 0 ? `${product.stock_quantity} SP` : 'Hết hàng'}
                                </span>
                                <div class="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onclick="startEditProductStock(${product.id}, this.previousElementSibling)">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5 text-gray-400 hover:text-admin-primary">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${product.purchases !== undefined && product.purchases !== null ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Đã bán:</span>
                            <div class="flex items-center gap-1">
                                <span class="text-sm font-bold text-orange-600">${product.purchases}</span>
                                <span class="text-xs text-gray-500">sản phẩm</span>
                            </div>
                        </div>
                    ` : ''}
                    ${product.rating ? `
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Đánh giá:</span>
                            <div class="flex items-center gap-1">
                                <span class="text-sm font-medium text-yellow-600">⭐ ${product.rating}</span>
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
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-white">Thêm sản phẩm mới</h3>
                    </div>
                </div>
                <button onclick="closeProductModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <form id="productForm" class="flex-1 overflow-y-auto bg-gray-50" onsubmit="event.preventDefault(); saveProduct();">
                <div class="p-6 space-y-5">
                    <!-- Thông tin cơ bản -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Thông tin cơ bản</h4>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                Tên sản phẩm <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="productName" required
                                class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="VD: Vòng dâu tằm trơn" autofocus>
                        </div>
                        <div class="mt-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                Loại vòng
                            </label>
                            <input type="hidden" id="productBraceletType" value="elastic">
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button type="button"
                                    data-bracelet-type="elastic"
                                    onclick="setBraceletTypePreset('elastic')"
                                    class="px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-indigo-600 text-white border-indigo-600 shadow-sm">
                                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-white/90"></span>
                                    Dây co giãn
                                </button>
                                <button type="button"
                                    data-bracelet-type="adjustable"
                                    onclick="setBraceletTypePreset('adjustable')"
                                    class="px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:text-indigo-700">
                                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                                    Dây rút
                                </button>
                                <button type="button"
                                    data-bracelet-type="other"
                                    onclick="setBraceletTypePreset('other')"
                                    class="px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:text-indigo-700">
                                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                                    Loại khác
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ảnh sản phẩm -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Ảnh sản phẩm
                        </h4>
                        
                        <div class="flex items-stretch gap-4">
                            <!-- Image Preview -->
                            <div id="imagePreviewContainer" class="hidden flex-shrink-0">
                                <div class="relative w-28 h-28 bg-white rounded-xl border-2 border-purple-200 overflow-hidden shadow-sm group">
                                    <img id="imagePreview" src="" alt="Preview" class="w-full h-full object-cover">
                                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                        <div class="opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 flex gap-1">
                                            <button type="button" onclick="openImageInNewTab()" 
                                                class="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-lg" 
                                                title="Mở ảnh trong tab mới">
                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                            <button type="button" onclick="clearImagePreview()" 
                                                class="p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 shadow-lg"
                                                title="Xóa ảnh">
                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Upload Area -->
                            <div class="flex-1">
                                <label class="relative cursor-pointer group block h-28">
                                    <div class="h-full w-full bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 hover:shadow-md transition-all px-6 flex items-center gap-4">
                                        <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-sm font-semibold text-gray-900 mb-0.5">Tải ảnh lên</p>
                                            <p class="text-xs text-gray-500">JPG, PNG, WEBP • Tối đa 5MB</p>
                                        </div>
                                        <div class="text-purple-600 group-hover:translate-x-1 transition-transform">
                                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                    <input type="file" id="productImageFile" accept="image/*" class="hidden" onchange="handleImageUpload(this)">
                                </label>
                                
                                <input type="hidden" id="productImageURL">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Giá cả -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <h4 class="text-base font-semibold text-gray-900">Giá cả</h4>
                            <label class="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" id="autoPricingEnabled" checked
                                    class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    onchange="toggleMarkupSelector()">
                                <span class="text-xs text-gray-600 group-hover:text-purple-600 transition-colors">
                                    🤖 Tự động tính giá bán
                                </span>
                            </label>
                        </div>
                        
                        <!-- Markup Selector (shown when auto-pricing is enabled) -->
                        <div id="markupSelectorContainer" class="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <!-- Pricing Method Toggle -->
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    ⚙️ Phương thức tính giá
                                </label>
                                <div class="flex bg-white rounded-lg p-1 border border-purple-200">
                                    <button type="button" id="markupMethodBtn" onclick="setPricingMethod('markup')"
                                        class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all bg-purple-600 text-white">
                                        Theo hệ số markup
                                    </button>
                                    <button type="button" id="profitMethodBtn" onclick="setPricingMethod('profit')"
                                        class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-gray-600 hover:text-purple-600">
                                        Theo lãi mong muốn
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Markup Method Container -->
                            <div id="markupMethodContainer">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    📊 Hệ số markup
                                </label>
                                
                                <!-- Input + Preset Buttons on same line -->
                                <div class="flex items-center gap-2">
                                    <!-- Custom Input -->
                                    <div class="relative w-24 flex-shrink-0">
                                        <input type="number" 
                                            id="markupMultiplier" 
                                            step="0.1" 
                                            min="1.0" 
                                            max="10.0"
                                            value="2.5"
                                            oninput="updateSellingPriceFromMarkup()"
                                            class="w-full px-3 py-2 pr-7 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-semibold text-center">
                                        <span class="absolute right-2 top-2.5 text-gray-500 font-medium text-sm">×</span>
                                    </div>
                                    
                                    <!-- Preset Buttons -->
                                    <div class="flex flex-wrap gap-2 flex-1">
                                        <button type="button" onclick="setMarkupPreset(2.0)" data-markup="2.0"
                                            class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                            ×2.0
                                        </button>
                                        <button type="button" onclick="setMarkupPreset(2.5)" data-markup="2.5"
                                            class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                            ×2.5
                                        </button>
                                        <button type="button" onclick="setMarkupPreset(3.0)" data-markup="3.0"
                                            class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                            ×3.0
                                        </button>
                                        <button type="button" onclick="setMarkupPreset(3.5)" data-markup="3.5"
                                            class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                            ×3.5
                                        </button>
                                        <button type="button" onclick="setMarkupPreset(4.0)" data-markup="4.0"
                                            class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                            ×4.0
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Profit Method Container -->
                            <div id="profitMethodContainer" class="hidden">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    💰 Lãi mong muốn
                                </label>
                                
                                <div class="flex items-center gap-2">
                                    <!-- Profit Input -->
                                    <div class="relative flex-1">
                                        <input type="text" 
                                            id="targetProfit" 
                                            placeholder="120.000"
                                            oninput="autoFormatNumberInput(this); updateSellingPriceFromProfit()"
                                            onpaste="setTimeout(() => { autoFormatNumberInput(this); updateSellingPriceFromProfit(); }, 0)"
                                            class="w-full px-3 py-2 pr-8 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-semibold">
                                        <span class="absolute right-2 top-2.5 text-gray-500 font-medium text-sm">đ</span>
                                    </div>
                                    
                                    <!-- Calculated Markup Display -->
                                    <div class="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border">
                                        Hệ số: <span id="calculatedMarkup" class="font-semibold text-purple-600">-</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                        Giá bán <span class="text-red-500">*</span>
                                    </label>
                                    <div class="relative">
                                        <input type="text" id="productPrice" required
                                            class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="179.000"
                                            oninput="autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices()"
                                            onpaste="setTimeout(() => { autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices(); }, 0)">
                                        <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Giá gốc</label>
                                    <div class="relative">
                                        <input type="text" id="productOriginalPrice"
                                            class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="189.000"
                                            oninput="autoFormatNumberInput(this)"
                                            onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                                        <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                        💰 Giá vốn <span class="text-red-500">*</span>
                                    </label>
                                    <div class="relative">
                                        <input type="text" id="productCostPrice" required
                                            class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                            placeholder="89.500"
                                            oninput="autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices()"
                                            onpaste="setTimeout(() => { autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices(); }, 0)">
                                        <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Lãi dự kiến -->
                    <div id="profitDisplay" class="hidden bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">📊 Lãi dự kiến</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                                <p class="text-sm text-gray-600 mb-1">Lãi:</p>
                                <p id="profitAmount" class="text-2xl font-bold text-green-600">0đ</p>
                            </div>
                            <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                                <p class="text-sm text-gray-600 mb-1">Tỷ suất:</p>
                                <p id="profitMargin" class="text-2xl font-bold text-green-600">0%</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Cảnh báo lỗ -->
                    <div id="lossWarning" class="hidden bg-white rounded-lg p-5 border border-red-300 shadow-sm">
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-base font-semibold text-red-600 mb-1">⚠️ Cảnh báo</h4>
                                <p class="text-sm text-red-600 font-medium">Giá vốn cao hơn giá bán!</p>
                                <p class="text-xs text-red-500 mt-1">Sản phẩm này sẽ bị lỗ. Vui lòng kiểm tra lại giá.</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Công thức nguyên liệu -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <div class="flex items-center gap-2">
                                <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                                <h4 class="text-base font-semibold text-gray-900">💎 Công thức nguyên liệu</h4>
                            </div>
                            <button type="button" onclick="showAddMaterialModal()" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Thêm nguyên liệu
                            </button>
                        </div>
                        
                        <div id="materialsFormulaContainer" class="space-y-3">
                            <!-- Materials will be rendered here -->
                        </div>
                    </div>
                    
                    <!-- Danh mục -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Danh mục</h4>
                        <div id="categoryCheckboxList" class="space-y-2">
                            <div class="flex items-center justify-center py-8 text-gray-400">
                                <div class="animate-spin rounded-full h-8 h-8 border-b-2 border-purple-600"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Thông tin bổ sung -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Thông tin bổ sung</h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Tồn kho</label>
                                <input type="text" id="productStockQuantity" value="0"
                                    class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="15"
                                    oninput="autoFormatNumberInput(this)"
                                    onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Đánh giá</label>
                                <input type="number" id="productRating" min="0" max="5" step="0.1" value="0"
                                    class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="4.9">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Lượt mua</label>
                                <input type="text" id="productPurchases" value="0"
                                    class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="0"
                                    oninput="autoFormatNumberInput(this)"
                                    onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Chi tiết sản phẩm -->
                    <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                        <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Chi tiết sản phẩm</h4>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã SKU</label>
                                <input type="text" id="productSKU"
                                    class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="VD: SP001">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                                <textarea id="productDescription" rows="2"
                                    class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                                    placeholder="Mô tả chi tiết về sản phẩm..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
            
            <!-- Footer -->
            <div class="border-t border-gray-200 px-6 py-4 bg-white flex justify-between items-center">
                <div class="text-sm text-gray-500">
                    <span class="text-red-500">*</span> Trường bắt buộc
                </div>
                <div class="flex gap-3">
                    <button type="button" onclick="closeProductModal()"
                        class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Hủy
                    </button>
                    <button type="button" id="productSaveBtn" onclick="saveProduct()"
                        class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-flex items-center justify-center gap-2 min-w-[10rem]">
                        Lưu sản phẩm
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Load and render categories inline
    loadCategoriesInline();
    
    // Initialize materials formula (empty for new product)
    loadProductFormula(null);
}

// Set markup preset from button
function setMarkupPreset(value) {
    const markupInput = document.getElementById('markupMultiplier');
    if (!markupInput) return;
    
    // Set value directly (no auto logic)
    markupInput.value = value;
    
    // Highlight active button
    highlightActivePresetButton(value);
    
    // Trigger update
    updateSellingPriceFromMarkup();
    
    // Visual feedback on input
    markupInput.classList.add('bg-green-50', 'border-green-300');
    setTimeout(() => {
        markupInput.classList.remove('bg-green-50', 'border-green-300');
    }, 300);
}

// Highlight active preset button
function highlightActivePresetButton(value) {
    // Remove highlight from all buttons and restore hover effects
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600', 'ring-2', 'ring-indigo-300');
        btn.classList.add('bg-white', 'border-gray-300', 'text-gray-700', 'hover:bg-gray-50', 'hover:border-purple-300');
    });
    
    // Add highlight to active button
    const markupInput = document.getElementById('markupMultiplier');
    const currentValue = markupInput ? parseFloat(markupInput.value) : null;
    
    if (currentValue) {
        // Find matching button using data-markup attribute
        document.querySelectorAll('.preset-btn[data-markup]').forEach(btn => {
            const btnValue = parseFloat(btn.dataset.markup);
            if (Math.abs(currentValue - btnValue) < 0.01) {
                btn.classList.remove('bg-white', 'border-gray-300', 'text-gray-700', 'hover:bg-gray-50', 'hover:border-purple-300');
                btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600', 'ring-2', 'ring-indigo-300');
            }
        });
    }
}

// Toggle markup selector visibility
function toggleMarkupSelector() {
    const checkbox = document.getElementById('autoPricingEnabled');
    const container = document.getElementById('markupSelectorContainer');
    
    if (container) {
        if (checkbox && checkbox.checked) {
            container.classList.remove('hidden');
            // Tự động cập nhật giá khi bật
            updateSellingPriceFromMarkup();
        } else {
            container.classList.add('hidden');
        }
    }
}

// Update selling price when markup selector changes
function updateSellingPriceFromMarkup() {
    const checkbox = document.getElementById('autoPricingEnabled');
    
    // Lấy giá vốn hiện tại
    const costPriceInput = document.getElementById('productCostPrice');
    if (!costPriceInput) return;
    
    const costPrice = parseFormattedNumber(costPriceInput.value);
    if (!costPrice || costPrice <= 0) return;
    
    // Lấy số lượng nguyên liệu từ selectedMaterials
    const selectedMaterials = typeof window.getSelectedMaterials === 'function' 
        ? window.getSelectedMaterials() 
        : [];
    const materialCount = selectedMaterials.length;
    
    // Tính giá bán mới
    const newSellingPrice = autoCalculateSellingPrice(costPrice, materialCount);
    
    // Chỉ cập nhật giá bán nếu auto-pricing được bật
    if (checkbox && checkbox.checked) {
        const sellingPriceInput = document.getElementById('productPrice');
        if (sellingPriceInput) {
            sellingPriceInput.value = formatNumber(newSellingPrice);
            
            // Cập nhật hint text
            updatePriceHint(materialCount);
            
            // Tính lại profit
            if (typeof calculateExpectedProfit === 'function') {
                calculateExpectedProfit();
            }
            
            // Add visual feedback
            sellingPriceInput.classList.add('bg-green-50', 'border-green-300');
            setTimeout(() => {
                sellingPriceInput.classList.remove('bg-green-50', 'border-green-300');
            }, 500);
        }
    }
    
    // LUÔN cập nhật giá gốc = giá bán + 20,000đ (dù checkbox có bật hay không)
    // Giá gốc phải lớn hơn giá bán để hiển thị discount badge
    const originalPriceInput = document.getElementById('productOriginalPrice');
    if (originalPriceInput) {
        const newOriginalPrice = newSellingPrice + 20000;
        originalPriceInput.value = formatNumber(newOriginalPrice);
        
        // Add visual feedback
        originalPriceInput.classList.add('bg-blue-50', 'border-blue-300');
        setTimeout(() => {
            originalPriceInput.classList.remove('bg-blue-50', 'border-blue-300');
        }, 500);
    }
    
    // Highlight matching preset button
    highlightActivePresetButton();
}

// Update price hint text based on markup
function updatePriceHint(materialCount = 0) {
    const priceHint = document.getElementById('priceHint');
    if (!priceHint) return;
    
    const markupInput = document.getElementById('markupMultiplier');
    const markupValue = markupInput ? parseFloat(markupInput.value) : 2.5;
    
    if (markupValue && markupValue > 0) {
        const profit = ((markupValue - 1) * 100).toFixed(0);
        priceHint.textContent = `💡 Hệ số ×${markupValue.toFixed(1)} (Lãi ${profit}%)`;
    } else {
        priceHint.textContent = `💡 Nhập hệ số markup`;
    }
}

// Update markup multiplier when user changes selling price or cost price manually
function updateMarkupFromPrices() {
    const markupInput = document.getElementById('markupMultiplier');
    const priceInput = document.getElementById('productPrice');
    const costPriceInput = document.getElementById('productCostPrice');
    
    // Chỉ cập nhật nếu tất cả các input tồn tại
    if (!markupInput || !priceInput || !costPriceInput) return;
    
    // In profit mode:
    // - editing cost should keep target profit fixed and recalc selling price
    // - editing selling price should update target profit (reverse mode)
    if (currentPricingMethod === 'profit') {
        const activeId = document.activeElement?.id;
        if (activeId === 'productCostPrice') {
            updateSellingPriceFromProfit();
        } else if (activeId === 'productPrice') {
            updateTargetProfitFromPrices();
        }
        return;
    }

    // Lấy giá trị hiện tại
    const sellingPrice = parseFormattedNumber(priceInput.value);
    const costPrice = parseFormattedNumber(costPriceInput.value);
    
    // Kiểm tra giá trị hợp lệ
    if (!sellingPrice || !costPrice || costPrice <= 0) {
        return;
    }
    
    // Tính hệ số markup = giá bán / giá vốn
    const calculatedMarkup = sellingPrice / costPrice;
    
    // Chỉ cập nhật nếu hệ số hợp lệ (>= 1.0)
    if (calculatedMarkup >= 1.0 && calculatedMarkup <= 10.0) {
        // Làm tròn đến 1 chữ số thập phân
        const roundedMarkup = Math.round(calculatedMarkup * 10) / 10;
        markupInput.value = roundedMarkup.toFixed(1);
        
        // Highlight matching preset button
        highlightActivePresetButton(roundedMarkup);
        
        // Update price hint
        updatePriceHint();
        
        // Visual feedback
        markupInput.classList.add('bg-blue-50', 'border-blue-300');
        setTimeout(() => {
            markupInput.classList.remove('bg-blue-50', 'border-blue-300');
        }, 300);
    }
    
    // If using profit method, update target profit
    updateTargetProfitFromPrices();
}

// Close product modal
function closeProductModal() {
    resetPendingImageSelection();
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.remove();
    }
}

// Handle image upload
async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    console.log('🖼️ Selected image file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
    });
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('❌ Vui lòng chọn file ảnh (JPG, PNG, WEBP)', 'error');
        input.value = ''; // Reset input
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Kích thước ảnh không được vượt quá 5MB', 'error');
        input.value = ''; // Reset input
        return;
    }
    
    // Keep selected file in memory and preview locally.
    resetPendingImageSelection();
    pendingImageFile = file;
    pendingImagePreviewUrl = URL.createObjectURL(file);

    const container = document.getElementById('imagePreviewContainer');
    const preview = document.getElementById('imagePreview');

    if (preview && container) {
        preview.onerror = null;
        preview.onload = null;
        preview.style.opacity = '1';
        preview.style.padding = '';
        preview.style.backgroundColor = '';
        preview.src = pendingImagePreviewUrl;
        container.classList.remove('hidden');
    }
    input.value = '';
    showToast('🖼️ Đã chọn ảnh. Ảnh sẽ được upload khi bấm Lưu', 'info');
}

// Update image preview
function updateImagePreview(url) {
    const container = document.getElementById('imagePreviewContainer');
    const preview = document.getElementById('imagePreview');
    const hiddenInput = document.getElementById('productImageURL');
    
    if (!container || !preview) return;
    
    if (url && url.trim()) {
        // Clear any previous error handlers
        preview.onerror = null;
        preview.onload = null;
        
        // Add loading state
        preview.style.opacity = '0.5';
        
        // Sync inputs
        if (hiddenInput) hiddenInput.value = url.trim();
        
        // Handle successful load
        preview.onload = function() {
            this.style.opacity = '1';
            this.style.padding = '';
            this.style.backgroundColor = '';
            console.log('✅ Image loaded successfully:', url);
        };
        
        // Handle load error
        preview.onerror = function() {
            console.error('❌ Failed to load image:', url);
            const encodedUrl = encodeURI(url.trim());
            console.error('❌ Encoded URL:', encodedUrl);
            
            // Try alternative loading methods
            tryAlternativeImageLoad(this, url, encodedUrl);
        };
        
        // Set the source (this will trigger onload or onerror)
        const encodedUrl = encodeURI(url.trim());
        preview.src = encodedUrl;
        
        // Show container
        container.classList.remove('hidden');
        
        console.log('🖼️ Loading image preview:', encodedUrl);
    } else {
        // Clear everything
        container.classList.add('hidden');
        if (hiddenInput) hiddenInput.value = '';
        preview.src = '';
        preview.style.opacity = '1';
        preview.style.padding = '';
        preview.style.backgroundColor = '';
    }
}

// Clear image preview
function clearImagePreview() {
    resetPendingImageSelection();
    const hiddenInput = document.getElementById('productImageURL');
    const container = document.getElementById('imagePreviewContainer');
    const preview = document.getElementById('imagePreview');
    
    if (hiddenInput) hiddenInput.value = '';
    if (container) container.classList.add('hidden');
    if (preview) {
        preview.src = '';
        preview.style.opacity = '1';
        preview.style.padding = '';
        preview.style.backgroundColor = '';
    }
    console.log('🗑️ Image preview cleared');
}

// Open image in new tab (helpful for CORS issues)
function openImageInNewTab() {
    const hiddenInput = document.getElementById('productImageURL');
    const url = hiddenInput?.value;
    
    if (url && url.trim()) {
        console.log('🔗 Opening image in new tab:', url.trim());
        window.open(url.trim(), '_blank');
        showToast('🔗 Đã mở ảnh trong tab mới', 'info', 3000);
    } else {
        showToast('⚠️ Không có URL ảnh để mở', 'warning');
    }
}

// Load categories inline (checkbox list)
async function loadCategoriesInline() {
    const container = document.getElementById('categoryCheckboxList');
    if (!container) return;
    
    try {
        let categories = Array.isArray(allCategories) ? allCategories : [];
        if (!categories.length) {
            const response = await fetch(`${CONFIG.API_URL}?action=getAllCategories&timestamp=${Date.now()}`);
            const data = await response.json();
            if (data.success && Array.isArray(data.categories)) {
                categories = data.categories;
                allCategories = categories;
            }
        }

        if (categories.length > 0) {
            // Render categories in 2 columns
            container.innerHTML = `
                <div class="grid grid-cols-2 gap-3">
                    ${categories.map(cat => `
                        <label class="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-all">
                            <input type="checkbox" 
                                   class="category-checkbox w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" 
                                   value="${cat.id}"
                                   data-name="${cat.name}"
                                   data-icon="${cat.icon || '📦'}"
                                   data-color="${cat.color || '#9333ea'}">
                            <span class="flex items-center gap-1.5 text-sm">
                                <span class="font-medium text-gray-700">${cat.name}</span>
                            </span>
                        </label>
                    `).join('')}
                </div>
            `;
            
            // Add change event listeners
            const checkboxes = container.querySelectorAll('.category-checkbox');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', updateSelectedCategoryCount);
            });
        } else {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <p class="text-sm">Chưa có danh mục nào</p>
                    <p class="text-xs mt-1">Vui lòng tạo danh mục trước</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        container.innerHTML = `
            <div class="text-center py-4 text-red-500">
                <p class="text-sm">Lỗi tải danh mục</p>
            </div>
        `;
    }
}

// Update selected category count
function updateSelectedCategoryCount() {
    const checkboxes = document.querySelectorAll('.category-checkbox:checked');
    const countEl = document.getElementById('selectedCategoryCount');
    if (countEl) {
        countEl.textContent = `Đã chọn: ${checkboxes.length}`;
    }
}

// Get selected category IDs
function getSelectedCategoryIds() {
    const checkboxes = document.querySelectorAll('.category-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Set selected category IDs
function setSelectedCategoryIds(ids) {
    const checkboxes = document.querySelectorAll('.category-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = ids.includes(parseInt(cb.value));
    });
    updateSelectedCategoryCount();
}

// Save product (create or update)
async function saveProduct(productId = null) {
    const name = document.getElementById('productName')?.value.trim();
    const priceInput = document.getElementById('productPrice');
    const price = parseFormattedNumber(priceInput?.value);
    const originalPriceInput = document.getElementById('productOriginalPrice');
    const originalPrice = parseFormattedNumber(originalPriceInput?.value);
    const costPriceInput = document.getElementById('productCostPrice');
    const costPrice = parseFormattedNumber(costPriceInput?.value);
    const categoryIds = getSelectedCategoryIds();
    const stockQuantity = parseFormattedNumber(document.getElementById('productStockQuantity')?.value);
    const rating = document.getElementById('productRating')?.value;
    const purchases = parseFormattedNumber(document.getElementById('productPurchases')?.value);
    const sku = document.getElementById('productSKU')?.value.trim();
    const description = document.getElementById('productDescription')?.value.trim();
    const braceletType = normalizeBraceletType(document.getElementById('productBraceletType')?.value);
    let image_url = document.getElementById('productImageURL')?.value.trim();
    
    // Get pricing method and target profit
    const pricing_method = currentPricingMethod || 'markup';
    const targetProfitInput = document.getElementById('targetProfit');
    const target_profit = (pricing_method === 'profit' && targetProfitInput) 
        ? parseFormattedNumber(targetProfitInput.value) || null 
        : null;
    
    // Get markup_multiplier - calculate based on pricing method
    let markup_multiplier;
    if (pricing_method === 'profit' && costPrice > 0 && price > 0) {
        // Calculate markup from price and cost when using profit method
        markup_multiplier = price / costPrice;
    } else {
        // Use input value for markup method
        const markupInput = document.getElementById('markupMultiplier');
        const markupValue = markupInput ? parseFloat(markupInput.value) : null;
        markup_multiplier = (markupValue && markupValue > 0) ? markupValue : null;
    }

    // Debug: Log collected values
    console.log('💾 Saving product with values:', {
        name,
        price,
        'priceInput.value': priceInput?.value,
        originalPrice,
        'originalPriceInput.value': originalPriceInput?.value,
        costPrice,
        'costPriceInput.value': costPriceInput?.value,
        markup_multiplier,
        pricing_method,
        target_profit,
        productId
    });

    // Validation
    if (!name) {
        showToast('Vui lòng nhập tên sản phẩm', 'warning');
        document.getElementById('productName')?.focus();
        return;
    }

    if (!productId) {
        const normalizedName = name.toLowerCase().trim();
        const duplicateName = allProducts.some(product =>
            Number(product.is_active) !== 0 &&
            String(product.name || '').toLowerCase().trim() === normalizedName
        );

        if (duplicateName) {
            showToast('Tên sản phẩm bị trùng, vui lòng nhập tên khác', 'warning');
            document.getElementById('productName')?.focus();
            return;
        }
    }

    if (!price || price <= 0) {
        showToast('Vui lòng nhập giá hợp lệ', 'warning');
        document.getElementById('productPrice')?.focus();
        return;
    }

    if (isNaN(costPrice) || costPrice < 0) {
        showToast('Vui lòng nhập giá vốn hợp lệ', 'warning');
        document.getElementById('productCostPrice')?.focus();
        return;
    }

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 danh mục cho sản phẩm', 'warning');
        document.getElementById('categoryCheckboxList')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Validate image URL if provided
    if (image_url && !isValidUrl(image_url)) {
        showToast('URL ảnh không hợp lệ. Vui lòng nhập URL đầy đủ (http://...) hoặc đường dẫn tương đối (./assets/...)', 'warning');
        document.getElementById('productImageURL')?.focus();
        return;
    }

    const productData = {
        action: productId ? 'updateProduct' : 'createProduct',
        name,
        price: price,
        original_price: originalPrice || null,
        cost_price: costPrice,
        markup_multiplier: markup_multiplier,
        category_ids: categoryIds,
        stock_quantity: stockQuantity || 0,
        rating: rating ? parseFloat(rating) : 0,
        purchases: purchases || 0,
        sku: sku || null,
        description: description || null,
        bracelet_type: braceletType,
        image_url: image_url || null,
        pricing_method: pricing_method,
        target_profit: target_profit
    };

    if (productId) {
        productData.id = productId;
    }
    
    // Debug: Log data being sent to server
    console.log('📤 Sending to server:', JSON.stringify(productData, null, 2));

    const saveBtnLoadingHtml = (label) => `
        <span class="inline-flex items-center justify-center gap-2">
            <svg class="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>${label}</span>
        </span>`;

    const restoreProductSaveButton = (productId) => {
        const btn = document.getElementById('productSaveBtn');
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove('cursor-wait', 'opacity-90');
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        } else {
            btn.textContent = productId ? 'Cập nhật' : 'Lưu sản phẩm';
        }
    };

    try {
        const saveBtn = document.getElementById('productSaveBtn');
        if (saveBtn) {
            saveBtn.dataset.originalHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.classList.add('cursor-wait', 'opacity-90');
            saveBtn.innerHTML = saveBtnLoadingHtml('Đang lưu...');
        }

        // Upload selected image only when user confirms by clicking Save.
        if (pendingImageFile) {
            if (saveBtn) {
                saveBtn.innerHTML = saveBtnLoadingHtml('Đang upload ảnh...');
            }
            image_url = await uploadImageToR2(pendingImageFile);
            const hiddenInput = document.getElementById('productImageURL');
            if (hiddenInput) hiddenInput.value = image_url;
            resetPendingImageSelection();

            if (saveBtn) {
                saveBtn.innerHTML = saveBtnLoadingHtml('Đang lưu...');
            }
        }

        productData.image_url = image_url || null;

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        const data = await response.json();

        if (data.success) {
            const savedProductId = productId || data.productId || data.product_id || data.id;
            const selectedMaterials = window.getSelectedMaterials ? window.getSelectedMaterials() : [];
            
            console.log('🔍 Debug productId:', {
                productId,
                'data.productId': data.productId,
                'data.product_id': data.product_id,
                'data.id': data.id,
                savedProductId,
                'selectedMaterials.length': selectedMaterials?.length
            });
            
            // Save materials formula if any
            if (savedProductId && selectedMaterials.length > 0) {
                await saveProductMaterialsFormula(savedProductId);
            }
            
            // Update local product data immediately for instant UI update
            if (productId) {
                const localProduct = allProducts.find(p => p.id == productId);
                if (localProduct) {
                    localProduct.name = name;
                    localProduct.price = price;
                    localProduct.original_price = originalPrice;
                    localProduct.cost_price = costPrice;
                    localProduct.markup_multiplier = markup_multiplier;
                    localProduct.pricing_method = pricing_method;
                    localProduct.target_profit = target_profit;
                    localProduct.stock_quantity = stockQuantity;
                    localProduct.rating = rating;
                    localProduct.purchases = purchases;
                    localProduct.sku = sku;
                    localProduct.description = description;
                    localProduct.bracelet_type = braceletType;
                    localProduct.image_url = image_url;
                }
            }

            // For newly created products:
            // - switch to the first selected category
            // - clear search
            // - pin new product to top on first render
            if (!productId && categoryIds.length > 0) {
                currentFilters.categoryId = parseInt(categoryIds[0]);
                currentFilters.searchTerm = '';
                currentPage = 1;
                pinnedProductId = savedProductId;
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = '';
                populateCategoryFilter();
                updateURL();
            }

            showToast(productId ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới', 'success');
            closeProductModal();
            await reloadProductsKeepPage();
        } else {
            throw new Error(data.error || 'Không thể lưu sản phẩm');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Lỗi: ' + error.message, 'error');
        restoreProductSaveButton(productId);
    }
}

// Validate URL (accepts both absolute and relative URLs)
function isValidUrl(string) {
    if (!string || string.trim() === '') {
        return true; // Empty is valid (optional field)
    }

    // Allow relative paths (starts with ./ or ../ or /)
    if (string.startsWith('./') || string.startsWith('../') || string.startsWith('/') || string.startsWith('assets/')) {
        return true;
    }

    // Validate absolute URLs
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        // If not a valid absolute URL, check if it's a simple filename
        // Allow filenames without special characters except . - _
        return /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(string);
    }
}

// Calculate expected profit
function calculateExpectedProfit() {
    const price = parseFormattedNumber(document.getElementById('productPrice')?.value) || 0;
    const costPrice = parseFormattedNumber(document.getElementById('productCostPrice')?.value) || 0;

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

// Smart rounding for prices (làm tròn thông minh)
// Làm tròn LÊN đến giá dạng X9.000đ (29k, 59k, 139k, 169k, ...)
function smartRound(price) {
    if (price <= 0) return 0;
    return Math.ceil((price + 1000) / 10000) * 10000 - 1000;
}

// Get smart markup based on product complexity
function getSmartMarkup(materialCount = 0) {
    // Phương án B: Hệ số tổng hợp theo độ phức tạp
    if (materialCount === 0) {
        // Không có nguyên liệu → Dùng mặc định trung bình
        return 250; // 2.5x
    } else if (materialCount <= 3) {
        // Sản phẩm đơn giản (1-3 nguyên liệu)
        return 250; // 2.5x - VD: Vòng trơn, vòng đơn giản
    } else if (materialCount <= 6) {
        // Sản phẩm trung bình (4-6 nguyên liệu)
        return 300; // 3.0x - VD: Vòng có charm, bi bạc
    } else {
        // Sản phẩm phức tạp (7+ nguyên liệu)
        return 350; // 3.5x - VD: Vòng nhiều chi tiết, mix phức tạp
    }
}

// Auto-calculate selling price from cost price (Phương án B)
function autoCalculateSellingPrice(costPrice, materialCount = 0) {
    if (!costPrice || costPrice <= 0) return 0;
    
    // Lấy giá trị markup từ input (number)
    const markupInput = document.getElementById('markupMultiplier');
    const markupValue = markupInput ? parseFloat(markupInput.value) : null;
    
    let multiplier;
    
    if (!markupValue || markupValue <= 0) {
        // Fallback to auto if invalid
        if (materialCount <= 3) {
            multiplier = 2.5;
        } else if (materialCount <= 6) {
            multiplier = 3.0;
        } else {
            multiplier = 3.5;
        }
    } else {
        // Dùng giá trị từ input
        multiplier = markupValue;
    }
    
    // Tính giá bán = giá vốn × multiplier
    const calculatedPrice = costPrice * multiplier;
    
    // Làm tròn thông minh
    return smartRound(calculatedPrice);
}

// Get markup description for UI
function getMarkupDescription(materialCount = 0) {
    const markup = getSmartMarkup(materialCount);
    const multiplier = (1 + markup / 100).toFixed(1);
    
    if (materialCount === 0) return `Giá vốn × ${multiplier}`;
    if (materialCount <= 3) return `Giá vốn × ${multiplier} (Đơn giản)`;
    if (materialCount <= 6) return `Giá vốn × ${multiplier} (Trung bình)`;
    return `Giá vốn × ${multiplier} (Phức tạp)`;
}

// Format number with thousand separators
function formatNumber(num) {
    if (!num) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Parse formatted number back to integer
function parseFormattedNumber(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/\./g, ''));
}

// Auto-format number input on keyup
function autoFormatNumberInput(inputElement) {
    const cursorPosition = inputElement.selectionStart;
    const oldValue = inputElement.value;
    const oldLength = oldValue.length;

    // Remove all dots and parse
    const numericValue = parseFormattedNumber(oldValue);

    // Format with dots
    const formattedValue = formatNumber(numericValue);

    // Update input value
    inputElement.value = formattedValue;

    // Restore cursor position (adjust for added/removed dots)
    const newLength = formattedValue.length;
    const lengthDiff = newLength - oldLength;
    const newCursorPosition = cursorPosition + lengthDiff;
    inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
}


// Edit product
async function editProduct(productId) {
    // Open modal shell immediately for instant feedback
    closeProductModal();
    const modal = document.createElement('div');
    modal.id = 'productModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                <h3 class="text-xl font-bold text-white">Chỉnh sửa sản phẩm</h3>
                <button onclick="closeProductModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="flex-1 bg-gray-50 flex items-center justify-center p-8">
                <div class="flex items-center gap-3 text-gray-600">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span>Đang tải thông tin sản phẩm...</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getProduct&id=${productId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error('Không tìm thấy sản phẩm');
        }

        const product = data.product;
        if (!document.body.contains(modal)) {
            return; // User closed modal while data was loading
        }

        // Replace loading shell with full modal content
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white">Chỉnh sửa sản phẩm</h3>
                        </div>
                    </div>
                    <button onclick="closeProductModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <form id="productForm" class="flex-1 overflow-y-auto bg-gray-50" onsubmit="event.preventDefault(); saveProduct(${productId});">
                    <div class="p-6 space-y-5">
                        <!-- Thông tin cơ bản -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Thông tin cơ bản</h4>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                    Tên sản phẩm <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="productName" required value="${escapeHtml(product.name)}"
                                    class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="VD: Vòng dâu tằm trơn" autofocus>
                            </div>
                            <div class="mt-4">
                                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                    Loại vòng
                                </label>
                                <input type="hidden" id="productBraceletType" value="${normalizeBraceletType(product.bracelet_type)}">
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button type="button"
                                        data-bracelet-type="elastic"
                                        onclick="setBraceletTypePreset('elastic')"
                                        class="px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${normalizeBraceletType(product.bracelet_type) === 'elastic' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:text-indigo-700'}">
                                        <span class="inline-block w-2.5 h-2.5 rounded-full ${normalizeBraceletType(product.bracelet_type) === 'elastic' ? 'bg-white/90' : 'bg-indigo-500'}"></span>
                                        Dây co giãn
                                    </button>
                                    <button type="button"
                                        data-bracelet-type="adjustable"
                                        onclick="setBraceletTypePreset('adjustable')"
                                        class="px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${normalizeBraceletType(product.bracelet_type) === 'adjustable' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:text-indigo-700'}">
                                        <span class="inline-block w-2.5 h-2.5 rounded-full ${normalizeBraceletType(product.bracelet_type) === 'adjustable' ? 'bg-white/90' : 'bg-indigo-500'}"></span>
                                        Dây rút
                                    </button>
                                    <button type="button"
                                        data-bracelet-type="other"
                                        onclick="setBraceletTypePreset('other')"
                                        class="px-3.5 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${normalizeBraceletType(product.bracelet_type) === 'other' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:text-indigo-700'}">
                                        <span class="inline-block w-2.5 h-2.5 rounded-full ${normalizeBraceletType(product.bracelet_type) === 'other' ? 'bg-white/90' : 'bg-indigo-500'}"></span>
                                        Loại khác
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Ảnh sản phẩm -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                                <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Ảnh sản phẩm
                            </h4>
                            
                            <div class="flex items-stretch gap-4">
                                <!-- Image Preview -->
                                <div id="imagePreviewContainer" class="${product.image_url ? '' : 'hidden'} flex-shrink-0">
                                    <div class="relative w-28 h-28 bg-white rounded-xl border-2 border-purple-200 overflow-hidden shadow-sm group">
                                        <img id="imagePreview" src="${escapeHtml(product.image_url || '')}" alt="Preview" class="w-full h-full object-cover">
                                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                            <div class="opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 flex gap-1">
                                                <button type="button" onclick="openImageInNewTab()" 
                                                    class="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-lg" 
                                                    title="Mở ảnh trong tab mới">
                                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </button>
                                                <button type="button" onclick="clearImagePreview()" 
                                                    class="p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 shadow-lg"
                                                    title="Xóa ảnh">
                                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Upload Area -->
                                <div class="flex-1">
                                    <label class="relative cursor-pointer group block h-28">
                                        <div class="h-full w-full bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 hover:shadow-md transition-all px-6 flex items-center gap-4">
                                            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                                                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                            </div>
                                            <div class="flex-1">
                                                <p class="text-sm font-semibold text-gray-900 mb-0.5">Tải ảnh lên</p>
                                                <p class="text-xs text-gray-500">JPG, PNG, WEBP • Tối đa 5MB</p>
                                            </div>
                                            <div class="text-purple-600 group-hover:translate-x-1 transition-transform">
                                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                        <input type="file" id="productImageFile" accept="image/*" class="hidden" onchange="handleImageUpload(this)">
                                    </label>
                                    
                                    <input type="hidden" id="productImageURL" value="${escapeHtml(product.image_url || '')}">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Giá cả -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                <h4 class="text-base font-semibold text-gray-900">Giá cả</h4>
                                <label class="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" id="autoPricingEnabled" checked
                                        class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                        onchange="toggleMarkupSelector()">
                                    <span class="text-xs text-gray-600 group-hover:text-purple-600 transition-colors">
                                        🤖 Tự động tính giá bán
                                    </span>
                                </label>
                            </div>
                            
                            <!-- Markup Selector (shown when auto-pricing is enabled) -->
                            <div id="markupSelectorContainer" class="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <!-- Pricing Method Toggle -->
                                <div class="mb-3">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        ⚙️ Phương thức tính giá
                                    </label>
                                    <div class="flex bg-white rounded-lg p-1 border border-purple-200">
                                        <button type="button" id="markupMethodBtn" onclick="setPricingMethod('markup')"
                                            class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${(product.pricing_method || 'markup') === 'markup' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-purple-600'}">
                                            Theo hệ số markup
                                        </button>
                                        <button type="button" id="profitMethodBtn" onclick="setPricingMethod('profit')"
                                            class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${(product.pricing_method || 'markup') === 'profit' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-purple-600'}">
                                            Theo lãi mong muốn
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Markup Method Container -->
                                <div id="markupMethodContainer" ${(product.pricing_method || 'markup') === 'profit' ? 'class="hidden"' : ''}>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        📊 Hệ số markup
                                    </label>
                                    
                                    <!-- Input + Preset Buttons on same line -->
                                    <div class="flex items-center gap-2">
                                        <!-- Custom Input -->
                                        <div class="relative w-24 flex-shrink-0">
                                            <input type="number" 
                                                id="markupMultiplier" 
                                                step="0.1" 
                                                min="1.0" 
                                                max="10.0"
                                                value="${product.markup_multiplier || 2.5}"
                                                oninput="updateSellingPriceFromMarkup()"
                                                class="w-full px-3 py-2 pr-7 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-semibold text-center">
                                            <span class="absolute right-2 top-2.5 text-gray-500 font-medium text-sm">×</span>
                                        </div>
                                        
                                        <!-- Preset Buttons -->
                                        <div class="flex flex-wrap gap-2 flex-1">
                                            <button type="button" onclick="setMarkupPreset(2.0)" data-markup="2.0"
                                                class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                                ×2.0
                                            </button>
                                            <button type="button" onclick="setMarkupPreset(2.5)" data-markup="2.5"
                                                class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                                ×2.5
                                            </button>
                                            <button type="button" onclick="setMarkupPreset(3.0)" data-markup="3.0"
                                                class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                                ×3.0
                                            </button>
                                            <button type="button" onclick="setMarkupPreset(3.5)" data-markup="3.5"
                                                class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                                ×3.5
                                            </button>
                                            <button type="button" onclick="setMarkupPreset(4.0)" data-markup="4.0"
                                                class="preset-btn px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all">
                                                ×4.0
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Profit Method Container -->
                                <div id="profitMethodContainer" ${(product.pricing_method || 'markup') === 'markup' ? 'class="hidden"' : ''}>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">
                                        💰 Lãi mong muốn
                                    </label>
                                    
                                    <div class="flex items-center gap-2">
                                        <!-- Profit Input -->
                                        <div class="relative flex-1">
                                            <input type="text" 
                                                id="targetProfit" 
                                                placeholder="120.000"
                                                value="${product.target_profit ? formatNumber(product.target_profit) : ''}"
                                                oninput="autoFormatNumberInput(this); updateSellingPriceFromProfit()"
                                                onpaste="setTimeout(() => { autoFormatNumberInput(this); updateSellingPriceFromProfit(); }, 0)"
                                                class="w-full px-3 py-2 pr-8 bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-semibold">
                                            <span class="absolute right-2 top-2.5 text-gray-500 font-medium text-sm">đ</span>
                                        </div>
                                        
                                        <!-- Calculated Markup Display -->
                                        <div class="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border">
                                            Hệ số: <span id="calculatedMarkup" class="font-semibold text-purple-600">-</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="space-y-4">
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                            Giá bán <span class="text-red-500">*</span>
                                        </label>
                                        <div class="relative">
                                            <input type="text" id="productPrice" required value="${formatNumber(product.price)}"
                                                class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                placeholder="179.000"
                                                oninput="autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices()"
                                                onpaste="setTimeout(() => { autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices(); }, 0)">
                                            <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Giá gốc</label>
                                        <div class="relative">
                                            <input type="text" id="productOriginalPrice" value="${formatNumber(product.original_price || 0)}"
                                                class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                placeholder="189.000"
                                                oninput="autoFormatNumberInput(this)"
                                                onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                                            <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1.5">
                                            💰 Giá vốn <span class="text-red-500">*</span>
                                        </label>
                                        <div class="relative">
                                            <input type="text" id="productCostPrice" required value="${formatNumber(product.cost_price || 0)}"
                                                class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                placeholder="89.500"
                                                oninput="autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices()"
                                                onpaste="setTimeout(() => { autoFormatNumberInput(this); calculateExpectedProfit(); updateMarkupFromPrices(); }, 0)">
                                            <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Outdated Price Warning Banner (moved here) -->
                            <div id="outdatedPriceWarning" class="hidden mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                                <div class="flex items-center justify-between">
                                    <p class="text-xs text-yellow-800">
                                        ⚠️ Giá chưa cập nhật theo nguyên liệu mới. Giá đề xuất: <span id="expectedSellingPrice" class="font-semibold"></span>
                                        <button type="button" onclick="applyNewPrices()" class="ml-2 text-yellow-700 hover:text-yellow-900 underline font-semibold">
                                            Áp dụng ngay
                                        </button>
                                    </p>
                                    <button type="button" onclick="document.getElementById('outdatedPriceWarning').classList.add('hidden')" class="text-yellow-600 hover:text-yellow-800">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Nguyên liệu (NEW) -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                <div class="flex items-center gap-2">
                                    <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    <h4 class="text-base font-semibold text-gray-900">Công thức nguyên liệu</h4>
                                </div>
                                <button type="button" onclick="showAddMaterialModal()" 
                                    class="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium flex items-center gap-1.5">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Thêm nguyên liệu
                                </button>
                            </div>
                            
                            <!-- Materials Formula Container -->
                            <div id="materialsFormulaContainer" class="space-y-3">
                                <div class="flex items-center justify-center py-8 text-gray-400">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Danh mục -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                                Danh mục
                                <span id="selectedCategoryCount" class="ml-2 text-sm font-normal text-gray-500">(0 đã chọn)</span>
                            </h4>
                            <div id="categoryCheckboxList" class="space-y-2">
                                <div class="flex items-center justify-center py-8 text-gray-400">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Thông tin bổ sung -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Thông tin bổ sung</h4>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tồn kho</label>
                                    <input type="text" id="productStockQuantity" value="${formatNumber(product.stock_quantity || 0)}"
                                        class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        placeholder="15"
                                        oninput="autoFormatNumberInput(this)"
                                        onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Đánh giá</label>
                                    <input type="number" id="productRating" min="0" max="5" step="0.1" value="${product.rating || 0}"
                                        class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        placeholder="4.9">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Lượt mua</label>
                                    <input type="text" id="productPurchases" value="${formatNumber(product.purchases || 0)}"
                                        class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        placeholder="0"
                                        oninput="autoFormatNumberInput(this)"
                                        onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Chi tiết sản phẩm -->
                        <div class="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                            <h4 class="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Chi tiết sản phẩm</h4>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã SKU</label>
                                    <input type="text" id="productSKU" value="${escapeHtml(product.sku || '')}"
                                        class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        placeholder="VD: SP001">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                                    <textarea id="productDescription" rows="2"
                                        class="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                                        placeholder="Mô tả chi tiết về sản phẩm...">${escapeHtml(product.description || '')}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
                
                <!-- Footer -->
                <div class="border-t border-gray-200 px-6 py-4 bg-white flex justify-between items-center">
                    <div class="text-sm text-gray-500">
                        <span class="text-red-500">*</span> Trường bắt buộc
                    </div>
                    <div class="flex gap-3">
                        <button type="button" onclick="closeProductModal()"
                            class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                            Hủy
                        </button>
                        <button type="button" id="productSaveBtn" onclick="saveProduct(${productId})"
                            class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-flex items-center justify-center gap-2 min-w-[10rem]">
                            Cập nhật
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Highlight current markup preset button
        const currentMarkup = product.markup_multiplier;
        if (currentMarkup) {
            const presetButtons = modal.querySelectorAll('.preset-btn[data-markup]');
            presetButtons.forEach(btn => {
                const btnMarkup = parseFloat(btn.dataset.markup);
                if (btnMarkup === currentMarkup) {
                    btn.classList.remove('bg-white', 'border-gray-300', 'text-gray-700');
                    btn.classList.add('bg-indigo-600', 'text-white', 'ring-2', 'ring-indigo-300');
                }
            });
        }

        // Load heavy data in parallel to improve edit modal responsiveness.
        await Promise.all([
            (async () => {
                await loadCategoriesInline();
                if (product.category_ids && product.category_ids.length > 0) {
                    setSelectedCategoryIds(product.category_ids);
                } else if (product.category_id) {
                    // Fallback for old data
                    setSelectedCategoryIds([product.category_id]);
                }
            })(),
            loadProductFormula(productId),
            checkProductPriceOutdated(product)
        ]);

        // Calculate profit on load
        setTimeout(() => {
            calculateExpectedProfit();
            // Initialize pricing method
            initializePricingMethod(product);
        }, 100);

    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Không thể tải thông tin sản phẩm', 'error');
    }
}

// Multi-category selector is now handled by MultiCategorySelector component

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
            reloadProductsKeepPage();
        } else {
            throw new Error(data.error || 'Không thể xóa sản phẩm');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Toggle categories display
function toggleCategories(productId, allCategories) {
    const container = document.getElementById(`categories-${productId}`);
    if (!container) return;

    const isExpanded = container.dataset.expanded === 'true';

    if (isExpanded) {
        // Collapse - show only first 3
        const maxVisible = 3;
        const visibleCategories = allCategories.slice(0, maxVisible);
        const remainingCount = allCategories.length - maxVisible;

        container.innerHTML = visibleCategories.map(cat => `
            <span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                ${cat.color ? `<span class="w-2 h-2 rounded-full" style="background-color: ${cat.color}"></span>` : `<span class="w-2 h-2 rounded-full bg-purple-500"></span>`}
                <span>${escapeHtml(cat.name)}</span>
            </span>
        `).join('') + `
            <button type="button" 
                onclick="toggleCategories(${productId}, ${JSON.stringify(allCategories).replace(/"/g, '&quot;')})"
                class="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-medium rounded transition-colors">
                +${remainingCount} danh mục
            </button>
        `;
        container.dataset.expanded = 'false';
    } else {
        // Expand - show all
        container.innerHTML = allCategories.map(cat => `
            <span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                ${cat.color ? `<span class="w-2 h-2 rounded-full" style="background-color: ${cat.color}"></span>` : `<span class="w-2 h-2 rounded-full bg-purple-500"></span>`}
                <span>${escapeHtml(cat.name)}</span>
            </span>
        `).join('') + `
            <button type="button" 
                onclick="toggleCategories(${productId}, ${JSON.stringify(allCategories).replace(/"/g, '&quot;')})"
                class="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-medium rounded transition-colors">
                Thu gọn
            </button>
        `;
        container.dataset.expanded = 'true';
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

// showToast is now provided by toast-manager.js


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


// ============================================
// SORT FUNCTIONS
// ============================================

// Sort by Price
function sortByPrice(direction) {
    currentSort = { field: 'price', direction };
    console.log('📊 Sorting by price:', direction);
    searchAndSort();
    showToast(`Đã sắp xếp theo giá ${direction === 'desc' ? 'cao → thấp' : 'thấp → cao'}`, 'success');
}

// Sort by Profit Margin
function sortByMargin(direction) {
    currentSort = { field: 'margin', direction };
    console.log('📊 Sorting by margin:', direction);
    searchAndSort();
    showToast(`Đã sắp xếp theo tỷ suất ${direction === 'desc' ? 'cao → thấp' : 'thấp → cao'}`, 'success');
}

// Sort by Net Profit
function sortByProfit(direction) {
    currentSort = { field: 'profit', direction };
    console.log('📊 Sorting by profit:', direction);
    searchAndSort();
    showToast(`Đã sắp xếp theo lãi ròng ${direction === 'desc' ? 'cao → thấp' : 'thấp → cao'}`, 'success');
}

// Sort by Purchases (Best Selling)
function sortByPurchases(direction) {
    currentSort = { field: 'purchases', direction };
    console.log('📊 Sorting by purchases:', direction);
    searchAndSort();
    showToast(`Đã sắp xếp theo sản phẩm bán chạy ${direction === 'desc' ? 'nhiều → ít' : 'ít → nhiều'}`, 'success');
}

// Reset Sort
function resetSort() {
    currentSort = { field: null, direction: null };
    console.log('🔄 Reset sorting');
    searchAndSort();
    showToast('Đã đặt lại sắp xếp', 'info');
}

// Apply sorting to filtered products
function applySorting(products) {
    if (!currentSort.field || !currentSort.direction) {
        return products;
    }

    const sorted = [...products].sort((a, b) => {
        let aVal, bVal;

        switch (currentSort.field) {
            case 'price':
                aVal = a.price || 0;
                bVal = b.price || 0;
                break;

            case 'margin':
                // Calculate profit margin: (price - cost_price) / price * 100
                const aMargin = a.price > 0 ? ((a.price - (a.cost_price || 0)) / a.price * 100) : 0;
                const bMargin = b.price > 0 ? ((b.price - (b.cost_price || 0)) / b.price * 100) : 0;
                aVal = aMargin;
                bVal = bMargin;
                break;

            case 'profit':
                // Calculate net profit per unit: price - cost_price
                aVal = (a.price || 0) - (a.cost_price || 0);
                bVal = (b.price || 0) - (b.cost_price || 0);
                break;

            case 'purchases':
                // Sort by purchases (best selling)
                aVal = a.purchases || 0;
                bVal = b.purchases || 0;
                break;

            default:
                return 0;
        }

        // Apply direction
        return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    console.log(`✅ Sorted ${sorted.length} products by ${currentSort.field} (${currentSort.direction})`);
    return sorted;
}

// Search and Sort (combined function)
// ============================================
// BULK ACTIONS
// ============================================

let selectedProductIds = new Set();

// Handle individual product checkbox
function handleProductCheckbox(productId, isChecked) {
    if (isChecked) {
        selectedProductIds.add(productId);
    } else {
        selectedProductIds.delete(productId);
    }
    updateBulkActionsUI();
}

// Update bulk actions UI
function updateBulkActionsUI() {
    const count = selectedProductIds.size;
    const total = filteredProducts.length;
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');
    const totalCount = document.getElementById('totalCount');
    const selectCurrentPageLabel = document.getElementById('selectCurrentPageLabel');
    const selectCurrentPageBtn = document.getElementById('selectCurrentPageBtn');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);
    const allPageSelected = pageProducts.length > 0 && pageProducts.every(p => selectedProductIds.has(p.id));

    if (count > 0) {
        if (selectedCount) selectedCount.textContent = count;
        if (totalCount) totalCount.textContent = total;
        if (selectCurrentPageLabel) {
            selectCurrentPageLabel.textContent = allPageSelected ? 'Bỏ chọn' : 'Chọn trang này';
        }
        if (selectCurrentPageBtn) {
            selectCurrentPageBtn.title = allPageSelected ? 'Bỏ chọn các sản phẩm trong trang này' : 'Chọn tất cả sản phẩm trong trang này';
        }
        if (bulkActionsBar) {
            bulkActionsBar.classList.remove('hidden');
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';

            requestAnimationFrame(() => {
                bulkActionsBar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                bulkActionsBar.style.opacity = '1';
                bulkActionsBar.style.transform = 'translateX(-50%) translateY(0)';
            });
        }
    } else {
        if (selectCurrentPageLabel) {
            selectCurrentPageLabel.textContent = 'Chọn trang này';
        }
        if (selectCurrentPageBtn) {
            selectCurrentPageBtn.title = 'Chọn tất cả sản phẩm trong trang này';
        }
        if (bulkActionsBar) {
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => {
                bulkActionsBar.classList.add('hidden');
            }, 300);
        }
    }
}

// Select all products (on current page or all filtered products)
function selectAllProducts() {
    // Check if all are already selected
    const allSelected = filteredProducts.every(p => selectedProductIds.has(p.id));
    
    if (allSelected) {
        // Deselect all
        filteredProducts.forEach(p => selectedProductIds.delete(p.id));
        document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = false);
        showToast('Đã bỏ chọn tất cả sản phẩm', 'info');
    } else {
        // Select all filtered products
        filteredProducts.forEach(p => selectedProductIds.add(p.id));
        document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = true);
        showToast(`Đã chọn tất cả ${filteredProducts.length} sản phẩm`, 'success');
    }
    
    updateBulkActionsUI();
}

// Select products on current page only
function selectCurrentPage() {
    // Get products on current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);
    
    // Check if all on current page are selected
    const allPageSelected = pageProducts.every(p => selectedProductIds.has(p.id));
    
    if (allPageSelected) {
        // Deselect current page
        pageProducts.forEach(p => selectedProductIds.delete(p.id));
        document.querySelectorAll('.product-checkbox').forEach(cb => {
            const productId = parseInt(cb.dataset.productId);
            if (pageProducts.find(p => p.id === productId)) {
                cb.checked = false;
            }
        });
        showToast(`Đã bỏ chọn ${pageProducts.length} sản phẩm trên trang này`, 'info');
    } else {
        // Select current page
        pageProducts.forEach(p => selectedProductIds.add(p.id));
        document.querySelectorAll('.product-checkbox').forEach(cb => {
            const productId = parseInt(cb.dataset.productId);
            if (pageProducts.find(p => p.id === productId)) {
                cb.checked = true;
            }
        });
        showToast(`Đã chọn ${pageProducts.length} sản phẩm trên trang này`, 'success');
    }
    
    updateBulkActionsUI();
}

// Select all filtered products (across all pages)
function selectAllFiltered() {
    // Check if all filtered products are selected
    const allSelected = filteredProducts.every(p => selectedProductIds.has(p.id));
    
    if (allSelected) {
        // Deselect all filtered products
        filteredProducts.forEach(p => selectedProductIds.delete(p.id));
        document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = false);
        showToast(`Đã bỏ chọn tất cả ${filteredProducts.length} sản phẩm`, 'info');
    } else {
        // Select all filtered products
        filteredProducts.forEach(p => selectedProductIds.add(p.id));
        
        // Only check checkboxes for products on current page
        document.querySelectorAll('.product-checkbox').forEach(cb => {
            const productId = parseInt(cb.dataset.productId);
            if (filteredProducts.find(p => p.id === productId)) {
                cb.checked = true;
            }
        });
        
        const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
        showToast(`Đã chọn tất cả ${filteredProducts.length} sản phẩm (${totalPages} trang)`, 'success');
    }
    
    updateBulkActionsUI();
}

// Clear all selections
function clearSelection() {
    selectedProductIds.clear();
    document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = false);
    updateBulkActionsUI();
}

// Bulk Delete
async function bulkDeleteProducts() {
    if (selectedProductIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một sản phẩm', 'warning');
        return;
    }

    const count = selectedProductIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa ${count} sản phẩm đã chọn?\n\nHành động này không thể hoàn tác!`);

    if (!confirmed) return;

    try {
        showToast(`Đang xóa ${count} sản phẩm...`, 'info');

        let successCount = 0;
        let failCount = 0;

        for (const productId of selectedProductIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deleteProduct',
                        id: productId
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error deleting product ${productId}:`, error);
            }
        }

        clearSelection();
        await reloadProductsKeepPage();

        if (failCount === 0) {
            showToast(`Đã xóa thành công ${successCount} sản phẩm`, 'success');
        } else {
            showToast(`Đã xóa ${successCount} sản phẩm, thất bại ${failCount} sản phẩm`, 'warning');
        }
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast('Không thể xóa sản phẩm: ' + error.message, 'error');
    }
}

// Show Bulk Stock Update Modal
function showBulkStockModal() {
    if (selectedProductIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một sản phẩm', 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'bulkStockModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Sửa tồn kho hàng loạt
                </h3>
                <p class="text-blue-100 text-sm mt-1">Đã chọn ${selectedProductIds.size} sản phẩm</p>
            </div>
            
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phương thức cập nhật</label>
                    <select id="bulkStockMethod" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" onchange="toggleStockInputs()">
                        <option value="set">Đặt số lượng cố định</option>
                        <option value="increase">Tăng thêm</option>
                        <option value="decrease">Giảm đi</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        <span id="stockValueLabel">Số lượng mới</span>
                    </label>
                    <div class="relative">
                        <input type="text" id="bulkStockValue" 
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Nhập số lượng"
                            onkeyup="autoFormatNumberInput(this)"
                            onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                        <span class="absolute right-4 top-2.5 text-gray-500">sp</span>
                    </div>
                </div>

                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div class="flex items-start gap-2">
                        <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div class="text-sm text-amber-800">
                            <p class="font-medium mb-1">Lưu ý:</p>
                            <ul class="list-disc list-inside space-y-1 text-xs">
                                <li>Số lượng tồn kho sẽ được cập nhật cho tất cả sản phẩm đã chọn</li>
                                <li>Nếu chọn "Giảm đi", số lượng không thể âm (tối thiểu là 0)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3">
                <button onclick="closeBulkStockModal()"
                    class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                    Hủy
                </button>
                <button onclick="applyBulkStockUpdate()"
                    class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function toggleStockInputs() {
    const method = document.getElementById('bulkStockMethod').value;
    const label = document.getElementById('stockValueLabel');

    switch (method) {
        case 'set':
            label.textContent = 'Số lượng mới';
            break;
        case 'increase':
            label.textContent = 'Tăng thêm';
            break;
        case 'decrease':
            label.textContent = 'Giảm đi';
            break;
    }
}

function closeBulkStockModal() {
    const modal = document.getElementById('bulkStockModal');
    if (modal) modal.remove();
}

async function applyBulkStockUpdate() {
    const method = document.getElementById('bulkStockMethod').value;
    const inputValue = document.getElementById('bulkStockValue').value;
    const value = parseFormattedNumber(inputValue);

    if (isNaN(value) || value < 0) {
        showToast('Vui lòng nhập số lượng hợp lệ', 'warning');
        return;
    }

    try {
        const totalCount = selectedProductIds.size;
        let processedCount = 0;
        let successCount = 0;
        let failCount = 0;
        /** @type {Array<{id:number, status?:number, error:string}>} */
        const failedItems = [];

        // Persistent toast (duration = 0) + fixed id so we can update progress continuously
        showToast(
            `Đang cập nhật tồn kho... (0/${totalCount})`,
            'info',
            0,
            'bulk-stock-update'
        );
        closeBulkStockModal();

        for (const rawProductId of selectedProductIds) {
            processedCount++;

            try {
                const productId = parseInt(String(rawProductId), 10);
                if (!Number.isFinite(productId)) {
                    failCount++;
                    failedItems.push({ id: -1, error: `Invalid productId: ${String(rawProductId)}` });
                    continue;
                }

                const product = allProducts.find(p => p.id === productId);
                if (!product) {
                    failCount++;
                    failedItems.push({ id: productId, error: 'Không tìm thấy sản phẩm trong danh sách hiện tại' });
                    continue;
                }

                // Pre-check: API hiện tại yêu cầu sản phẩm phải có ít nhất 1 danh mục.
                // Một số sản phẩm legacy có thể bị mất category link → sẽ luôn lỗi 400.
                const hasAnyCategory =
                    (Array.isArray(product.category_ids) && product.category_ids.length > 0) ||
                    (Array.isArray(product.categories) && product.categories.length > 0) ||
                    Boolean(product.category_id);

                if (!hasAnyCategory) {
                    failCount++;
                    failedItems.push({
                        id: productId,
                        error: 'Sản phẩm chưa có danh mục (cần gán ít nhất 1 danh mục trước khi cập nhật)'
                    });
                    console.warn('⚠️ Skipped bulk stock update (missing category):', { productId });
                    continue;
                }

                let newStock;
                const currentStock = product.stock_quantity || 0;

                switch (method) {
                    case 'set':
                        newStock = value;
                        break;
                    case 'increase':
                        newStock = currentStock + value;
                        break;
                    case 'decrease':
                        newStock = Math.max(0, currentStock - value);
                        break;
                }

                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateProduct',
                        id: productId,
                        stock_quantity: newStock
                    })
                });

                let data = null;
                try {
                    data = await response.json();
                } catch (e) {
                    // Non-JSON response (still capture HTTP status)
                }

                if (!response.ok) {
                    failCount++;
                    const errMsg = (data && (data.error || data.message))
                        ? String(data.error || data.message)
                        : `HTTP ${response.status}`;
                    failedItems.push({ id: productId, status: response.status, error: errMsg });
                    console.error('❌ Bulk stock update failed:', { productId, status: response.status, error: errMsg, payload: data });
                } else if (data && data.success) {
                    successCount++;
                } else {
                    failCount++;
                    const errMsg = data && (data.error || data.message)
                        ? String(data.error || data.message)
                        : 'API trả về success=false';
                    failedItems.push({ id: productId, status: response.status, error: errMsg });
                    console.error('❌ Bulk stock update failed (success=false):', { productId, status: response.status, error: errMsg, payload: data });
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating product ${productId}:`, error);
                const productId = parseInt(String(rawProductId), 10);
                failedItems.push({
                    id: Number.isFinite(productId) ? productId : -1,
                    error: error?.message ? String(error.message) : String(error)
                });
            }

            // Update progress toast after each product
            showToast(
                `Đang cập nhật tồn kho... (${processedCount}/${totalCount}) | OK: ${successCount} | Lỗi: ${failCount}`,
                'info',
                0,
                'bulk-stock-update'
            );
        }

        clearSelection();
        await reloadProductsKeepPage();

        // Final toast: keep it GREEN when flow completes.
        // If there are failures, still show as success but include failure count in message
        // (user requested stable green success completion toast).
        const failedIdsPreview = failedItems
            .slice(0, 5)
            .map((x) => (x.id && x.id > 0 ? `#${x.id}` : '(id?)'))
            .join(', ');

        showToast(
            failCount === 0
                ? `Đã cập nhật tồn kho thành công cho ${successCount}/${totalCount} sản phẩm`
                : `Đã cập nhật xong tồn kho: OK ${successCount}/${totalCount} · Lỗi ${failCount}${failedIdsPreview ? ` (${failedIdsPreview}${failedItems.length > 5 ? ', …' : ''})` : ''}`,
            'success',
            failCount === 0 ? 3000 : 6000,
            'bulk-stock-update'
        );

        if (failedItems.length) {
            console.groupCollapsed(`❌ Bulk stock update errors (${failedItems.length})`);
            failedItems.forEach((f) => console.log(f));
            console.groupEnd();
        }
    } catch (error) {
        console.error('Error bulk updating stock:', error);
        showToast(
            'Không thể cập nhật tồn kho: ' + error.message,
            'error',
            5000,
            'bulk-stock-update'
        );
    }
}


// ============================================
// BULK UPDATE MARKUP
// ============================================

// Show Bulk Markup Update Modal
function showBulkMarkupModal() {
    if (selectedProductIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một sản phẩm', 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'bulkMarkupModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Sửa giá hàng loạt
                </h3>
                <p class="text-purple-100 text-sm mt-1">Đã chọn ${selectedProductIds.size} sản phẩm</p>
            </div>
            
            <div class="p-6 space-y-5">
                <!-- Pricing Method Toggle -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        ⚙️ Phương thức tính giá
                    </label>
                    <div class="flex bg-gray-100 rounded-lg p-1">
                        <button type="button" id="bulkMarkupMethodBtn" onclick="setBulkPricingMethod('markup')"
                            class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all bg-purple-600 text-white">
                            Theo hệ số markup
                        </button>
                        <button type="button" id="bulkProfitMethodBtn" onclick="setBulkPricingMethod('profit')"
                            class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-gray-600 hover:text-purple-600">
                            Theo lãi mong muốn
                        </button>
                    </div>
                </div>

                <!-- Markup Method Container -->
                <div id="bulkMarkupMethodContainer">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Phương thức cập nhật</label>
                        <select id="bulkMarkupMethod" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" onchange="toggleBulkMarkupInputs()">
                            <option value="set">Đặt hệ số cố định</option>
                            <option value="increase">Tăng thêm (%)</option>
                            <option value="decrease">Giảm đi (%)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <span id="markupValueLabel">📊 Hệ số lãi mới</span>
                        </label>
                        <div class="relative">
                            <input type="number" id="bulkMarkupValue" 
                                class="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="VD: 2.5"
                                step="0.1"
                                min="1.0"
                                max="10.0"
                                value="2.5">
                            <span id="markupUnit" class="absolute right-4 top-2.5 text-gray-500 font-medium">×</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1" id="markupHint">Giá bán = Giá vốn × Hệ số lãi</p>
                    </div>

                    <!-- Quick Presets -->
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p class="text-xs font-medium text-purple-900 mb-2">Hệ số phổ biến:</p>
                        <div class="flex gap-2">
                            <button type="button" onclick="setBulkMarkupPreset(2.0)" 
                                class="flex-1 px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                                ×2.0
                            </button>
                            <button type="button" onclick="setBulkMarkupPreset(2.5)" 
                                class="flex-1 px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                                ×2.5
                            </button>
                            <button type="button" onclick="setBulkMarkupPreset(3.0)" 
                                class="flex-1 px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                                ×3.0
                            </button>
                            <button type="button" onclick="setBulkMarkupPreset(3.5)" 
                                class="flex-1 px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                                ×3.5
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Profit Method Container -->
                <div id="bulkProfitMethodContainer" class="hidden">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Phương thức cập nhật</label>
                        <select id="bulkProfitMethod" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" onchange="toggleBulkProfitInputs()">
                            <option value="set">Đặt lãi cố định</option>
                            <option value="increase">Tăng thêm (%)</option>
                            <option value="decrease">Giảm đi (%)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <span id="profitValueLabel">💰 Lãi mong muốn</span>
                        </label>
                        <div class="relative">
                            <input type="text" id="bulkProfitValue" 
                                class="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="120.000"
                                oninput="autoFormatNumberInput(this)"
                                onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                            <span id="profitUnit" class="absolute right-4 top-2.5 text-gray-500 font-medium">đ</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1" id="profitHint">Giá bán = Giá vốn + Lãi mong muốn</p>
                    </div>

                    <!-- Quick Presets -->
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p class="text-xs font-medium text-green-900 mb-2">Lãi phổ biến:</p>
                        <div class="grid grid-cols-2 gap-2">
                            <button type="button" onclick="setBulkProfitPreset(50000)" 
                                class="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                                50.000đ
                            </button>
                            <button type="button" onclick="setBulkProfitPreset(80000)" 
                                class="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                                80.000đ
                            </button>
                            <button type="button" onclick="setBulkProfitPreset(100000)" 
                                class="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                                100.000đ
                            </button>
                            <button type="button" onclick="setBulkProfitPreset(120000)" 
                                class="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                                120.000đ
                            </button>
                        </div>
                    </div>
                </div>

                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div class="flex items-start gap-2">
                        <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div class="text-sm text-amber-800">
                            <p class="font-medium mb-1">Lưu ý:</p>
                            <ul class="list-disc list-inside space-y-1 text-xs">
                                <li>Giá sẽ được cập nhật cho tất cả sản phẩm đã chọn</li>
                                <li>Giá bán sẽ được làm tròn thông minh</li>
                                <li>Giá gốc = Giá bán + 20,000đ (để hiển thị giảm giá)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3">
                <button onclick="closeBulkMarkupModal()"
                    class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                    Hủy
                </button>
                <button onclick="applyBulkPricingUpdate()"
                    class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Set bulk markup preset
function setBulkMarkupPreset(value) {
    const input = document.getElementById('bulkMarkupValue');
    if (input) {
        input.value = value;
    }
}

// Toggle markup inputs based on method
function toggleBulkMarkupInputs() {
    const method = document.getElementById('bulkMarkupMethod').value;
    const label = document.getElementById('markupValueLabel');
    const unit = document.getElementById('markupUnit');
    const hint = document.getElementById('markupHint');

    switch (method) {
        case 'set':
            label.textContent = 'Hệ số lãi mới';
            unit.textContent = '×';
            hint.textContent = 'Giá bán = Giá vốn × Hệ số lãi';
            break;
        case 'increase':
            label.textContent = 'Tăng thêm';
            unit.textContent = '%';
            hint.textContent = 'Hệ số mới = Hệ số cũ × (1 + %)';
            break;
        case 'decrease':
            label.textContent = 'Giảm đi';
            unit.textContent = '%';
            hint.textContent = 'Hệ số mới = Hệ số cũ × (1 - %)';
            break;
    }
}

// Close bulk markup modal
function closeBulkMarkupModal() {
    const modal = document.getElementById('bulkMarkupModal');
    if (modal) modal.remove();
}

// Smart rounding function (copy from existing logic)
function smartRound(price) {
    if (price < 10000) {
        return Math.round(price / 1000) * 1000;
    } else if (price < 100000) {
        return Math.round(price / 1000) * 1000;
    } else if (price < 500000) {
        return Math.round(price / 5000) * 5000;
    } else {
        return Math.round(price / 10000) * 10000;
    }
}

// Apply bulk markup update
async function applyBulkMarkupUpdate() {
    const method = document.getElementById('bulkMarkupMethod').value;
    const inputValue = document.getElementById('bulkMarkupValue').value;
    const value = parseFloat(inputValue);

    if (isNaN(value) || value <= 0) {
        showToast('Vui lòng nhập giá trị hợp lệ', 'warning');
        return;
    }

    // Validate based on method
    if (method === 'set' && (value < 1.0 || value > 10.0)) {
        showToast('Hệ số lãi phải từ 1.0 đến 10.0', 'warning');
        return;
    }

    if ((method === 'increase' || method === 'decrease') && (value < 0 || value > 100)) {
        showToast('Phần trăm phải từ 0 đến 100', 'warning');
        return;
    }

    try {
        // Show persistent toast with ID
        showToast(`Đang cập nhật hệ số lãi cho ${selectedProductIds.size} sản phẩm...`, 'info', 0, 'bulk-markup-update');
        closeBulkMarkupModal();

        let successCount = 0;
        let failCount = 0;

        for (const productId of selectedProductIds) {
            try {
                const product = allProducts.find(p => p.id === productId);
                if (!product) continue;

                const currentCostPrice = product.cost_price || 0;
                const currentMarkup = product.markup_multiplier || 2.5;

                // Calculate new markup
                let newMarkup;
                switch (method) {
                    case 'set':
                        newMarkup = value;
                        break;
                    case 'increase':
                        newMarkup = currentMarkup * (1 + value / 100);
                        break;
                    case 'decrease':
                        newMarkup = currentMarkup * (1 - value / 100);
                        break;
                }

                // Ensure markup is within valid range
                newMarkup = Math.max(1.0, Math.min(10.0, newMarkup));

                // Calculate new price: price = cost_price × markup
                const newPrice = smartRound(currentCostPrice * newMarkup);

                // Calculate new original price: original_price = price + 20,000
                const newOriginalPrice = newPrice + 20000;

                // Update product via API
                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateProduct',
                        id: productId,
                        pricing_method: 'markup',
                        markup_multiplier: newMarkup,
                        price: newPrice,
                        original_price: newOriginalPrice
                    })
                });

                const data = await response.json();
                if (data.success) {
                    // Update local data immediately for instant UI update
                    product.pricing_method = 'markup';
                    product.markup_multiplier = newMarkup;
                    product.price = newPrice;
                    product.original_price = newOriginalPrice;
                    
                    successCount++;
                    
                    // Update progress in toast
                    showToast(
                        `Đang cập nhật... (${successCount}/${selectedProductIds.size})`, 
                        'info', 
                        0, 
                        'bulk-markup-update'
                    );
                } else {
                    failCount++;
                    console.error(`Failed to update product ${productId}:`, data.error);
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating product ${productId}:`, error);
            }
        }

        clearSelection();
        
        // Re-filter and render products with updated data
        searchAndSort();

        // Update final toast with result
        if (failCount === 0) {
            showToast(`Đã cập nhật hệ số lãi thành công cho ${successCount} sản phẩm`, 'success', 3000, 'bulk-markup-update');
        } else {
            showToast(`Đã cập nhật ${successCount} sản phẩm, thất bại ${failCount} sản phẩm`, 'warning', 4000, 'bulk-markup-update');
        }
    } catch (error) {
        console.error('Error bulk updating markup:', error);
        showToast('Không thể cập nhật hệ số lãi: ' + error.message, 'error', 5000, 'bulk-markup-update');
    }
}


// ============================================
// OUTDATED PRODUCTS NOTIFICATION
// ============================================

async function checkOutdatedProducts() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=checkOutdatedProducts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            shouldShowMaterialOutdatedWarnings = Number(data.outdated_count || 0) > 0;
        }

        if (data.success && data.outdated_count > 0) {
            showOutdatedNotification(data.outdated_count);
        } else if (data.success) {
            hideOutdatedNotification();
        }
    } catch (error) {
        console.error('Error checking outdated products:', error);
    }
}

async function canShowMaterialOutdatedWarning() {
    if (typeof shouldShowMaterialOutdatedWarnings === 'boolean') {
        return shouldShowMaterialOutdatedWarnings;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=checkOutdatedProducts&timestamp=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            shouldShowMaterialOutdatedWarnings = Number(data.outdated_count || 0) > 0;
            return shouldShowMaterialOutdatedWarnings;
        }
    } catch (error) {
        console.warn('Cannot verify material outdated context:', error);
    }

    // Safe default: do not show warning if we cannot prove material price changed.
    shouldShowMaterialOutdatedWarnings = false;
    return false;
}

function showOutdatedNotification(count) {
    const notification = document.getElementById('outdatedProductsNotification');
    const countElement = document.getElementById('outdatedProductsCount');
    
    if (notification && countElement) {
        countElement.textContent = count;
        notification.classList.remove('hidden');
    }
}

function hideOutdatedNotification() {
    const notification = document.getElementById('outdatedProductsNotification');
    if (notification) {
        notification.classList.add('hidden');
    }
}

async function dismissOutdatedProducts() {
    const btn = document.getElementById('dismissOutdatedBtn');
    const originalHTML = btn ? btn.innerHTML : null;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Đang xử lý...</span>';
    }

    const restoreBtn = () => {
        if (btn && originalHTML) { btn.disabled = false; btn.innerHTML = originalHTML; }
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'dismissOutdatedNotification' })
        });
        const data = await response.json();
        if (data.success) {
            hideOutdatedNotification();
            outdatedProductsCache = null;
            shouldShowMaterialOutdatedWarnings = false;
            showToast('Đã bỏ qua cập nhật giá sản phẩm', 'success', 3000);
        } else {
            restoreBtn();
            showToast('Không thể bỏ qua: ' + (data.error || 'Lỗi không xác định'), 'error', 4000);
        }
    } catch (error) {
        console.error('Error dismissing outdated notification:', error);
        restoreBtn();
        showToast('Lỗi kết nối, vui lòng thử lại', 'error', 4000);
    }
}

function hasMeaningfulDifference(a, b, epsilon = 0.01) {
    const n1 = Number(a || 0);
    const n2 = Number(b || 0);
    return Math.abs(n1 - n2) > epsilon;
}

function smartRoundPrice(price) {
    if (price <= 0) return 0;
    return Math.ceil((price + 1000) / 10000) * 10000 - 1000;
}

const smartRoundPriceUp = smartRoundPrice;

async function fetchOutdatedProductsDetailsLegacy() {
    const products = Array.isArray(allProducts) ? allProducts : [];
    if (!products.length) {
        return { success: true, outdated_count: 0, products: [] };
    }

    const concurrency = 8;
    const outdatedProducts = [];

    for (let i = 0; i < products.length; i += concurrency) {
        const chunk = products.slice(i, i + concurrency);
        const chunkResults = await Promise.all(chunk.map(async (product) => {
            try {
                const res = await fetch(`${CONFIG.API_URL}?action=getProductMaterials&product_id=${product.id}&timestamp=${Date.now()}`);
                const data = await res.json();
                if (!data.success) return null;

                const materials = Array.isArray(data.materials) ? data.materials : [];
                if (!materials.length) return null;

                let expectedCostPrice = 0;
                for (const material of materials) {
                    expectedCostPrice += Number(material.quantity || 0) * Number(material.item_cost || 0);
                }
                expectedCostPrice = Math.round(expectedCostPrice * 100) / 100;

                const pricingMethod = product.pricing_method || 'markup';
                const targetProfit = Number(product.target_profit || 0);
                let expectedPrice;

                if (pricingMethod === 'profit' && product.target_profit !== null && product.target_profit !== undefined && targetProfit >= 0) {
                    expectedPrice = smartRoundPriceUp(expectedCostPrice + targetProfit);
                } else {
                    let markupToUse = product.markup_multiplier;
                    if (markupToUse === null || markupToUse === undefined) {
                        if (materials.length <= 3) markupToUse = 2.5;
                        else if (materials.length <= 6) markupToUse = 3.0;
                        else markupToUse = 3.5;
                    }
                    expectedPrice = smartRoundPrice(expectedCostPrice * Number(markupToUse || 0));
                }

                if (hasMeaningfulDifference(expectedCostPrice, product.cost_price) ||
                    hasMeaningfulDifference(expectedPrice, product.price)) {
                    return {
                        id: product.id,
                        name: product.name,
                        current_price: Number(product.price || 0),
                        expected_price: expectedPrice,
                        current_cost_price: Number(product.cost_price || 0),
                        expected_cost_price: expectedCostPrice,
                        delta_price: expectedPrice - Number(product.price || 0),
                        delta_cost_price: expectedCostPrice - Number(product.cost_price || 0)
                    };
                }
                return null;
            } catch (error) {
                console.warn('Fallback outdated-check failed for product:', product?.id, error);
                return null;
            }
        }));

        for (const item of chunkResults) {
            if (item) outdatedProducts.push(item);
        }
    }

    outdatedProducts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
    return { success: true, outdated_count: outdatedProducts.length, products: outdatedProducts };
}

async function fetchOutdatedProductsDetails(forceRefresh = false) {
    if (!forceRefresh && outdatedProductsCache && Array.isArray(outdatedProductsCache.products)) {
        return outdatedProductsCache;
    }

    const response = await fetch(`${CONFIG.API_URL}?action=getOutdatedProductsDetails&timestamp=${Date.now()}`);
    let data;
    try {
        data = await response.json();
    } catch {
        data = { success: false, error: `HTTP ${response.status}` };
    }

    const isUnknownAction = String(data?.error || '').toLowerCase().includes('unknown action');
    if (!response.ok || !data.success) {
        // Backward-compatible fallback for APIs that don't have getOutdatedProductsDetails yet.
        if (response.status === 400 && isUnknownAction) {
            data = await fetchOutdatedProductsDetailsLegacy();
        } else {
            throw new Error(data.error || 'Không thể tải chi tiết sản phẩm');
        }
    }

    outdatedProductsCache = data;
    return data;
}

function closeOutdatedProductsDetailsModal() {
    const modal = document.getElementById('outdatedProductsDetailsModal');
    if (modal) modal.remove();
}

function renderOutdatedProductsDetails(container, products) {
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m-7 4h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="text-sm font-medium">Hiện không có sản phẩm cần cập nhật</p>
            </div>
        `;
        return;
    }

    const rows = products.map((product) => {
        const priceDelta = Number(product.delta_price || 0);
        const costDelta = Number(product.delta_cost_price || 0);
        const priceDeltaClass = priceDelta >= 0 ? 'text-red-600' : 'text-green-600';
        const costDeltaClass = costDelta >= 0 ? 'text-red-600' : 'text-green-600';
        const priceDeltaText = `${priceDelta >= 0 ? '+' : ''}${formatCurrency(priceDelta)}`;
        const costDeltaText = `${costDelta >= 0 ? '+' : ''}${formatCurrency(costDelta)}`;

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${escapeHtml(product.name || `#${product.id}`)}</div>
                    <div class="text-xs text-gray-500">ID: ${product.id}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    <div>${formatCurrency(product.current_price || 0)}</div>
                    <div class="text-xs ${priceDeltaClass}">${priceDeltaText}</div>
                </td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900">${formatCurrency(product.expected_price || 0)}</td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    <div>${formatCurrency(product.current_cost_price || 0)}</div>
                    <div class="text-xs ${costDeltaClass}">${costDeltaText}</div>
                </td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900">${formatCurrency(product.expected_cost_price || 0)}</td>
                <td class="px-4 py-3 text-right">
                    <button type="button" onclick="closeOutdatedProductsDetailsModal(); editProduct(${product.id})"
                        class="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Sửa
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
                <thead class="bg-gray-50 text-gray-600">
                    <tr>
                        <th class="px-4 py-3 text-left font-semibold">Sản phẩm</th>
                        <th class="px-4 py-3 text-left font-semibold">Giá hiện tại</th>
                        <th class="px-4 py-3 text-left font-semibold">Giá đề xuất</th>
                        <th class="px-4 py-3 text-left font-semibold">Giá vốn hiện tại</th>
                        <th class="px-4 py-3 text-left font-semibold">Giá vốn đề xuất</th>
                        <th class="px-4 py-3 text-right font-semibold">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

async function openOutdatedProductsDetailsModal() {
    closeOutdatedProductsDetailsModal();

    const modal = document.createElement('div');
    modal.id = 'outdatedProductsDetailsModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[86vh] overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-bold text-gray-900">Sản phẩm cần cập nhật giá</h3>
                    <p class="text-sm text-gray-600">Danh sách chi tiết theo giá nguyên liệu hiện tại</p>
                </div>
                <button onclick="closeOutdatedProductsDetailsModal()" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="p-6 overflow-y-auto" id="outdatedProductsDetailsContent">
                <div class="flex items-center justify-center py-10 text-gray-500">
                    <svg class="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Đang tải danh sách...
                </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <button type="button" onclick="quickRecalculatePrices(); closeOutdatedProductsDetailsModal();"
                    class="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Cập nhật tất cả ngay
                </button>
                <button type="button" onclick="closeOutdatedProductsDetailsModal()"
                    class="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const content = document.getElementById('outdatedProductsDetailsContent');
    try {
        const details = await fetchOutdatedProductsDetails();
        renderOutdatedProductsDetails(content, details.products || []);
    } catch (error) {
        if (content) {
            content.innerHTML = `
                <div class="text-center py-10 text-red-600">
                    <p class="font-medium">Không thể tải danh sách chi tiết</p>
                    <p class="text-sm mt-1">${escapeHtml(error.message || 'Đã có lỗi xảy ra')}</p>
                </div>
            `;
        }
    }
}

async function quickRecalculatePrices() {
    // Show confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmRecalculateModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="p-6">
                <div class="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 text-center mb-2">Cập nhật giá sản phẩm?</h3>
                <p class="text-sm text-gray-600 text-center mb-6">
                    Hệ thống sẽ tự động tính lại giá bán cho tất cả sản phẩm dựa trên giá nguyên liệu hiện tại và hệ số markup đã lưu.
                </p>
                <div class="flex gap-3">
                    <button onclick="closeRecalculateModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Hủy
                    </button>
                    <button onclick="executeQuickRecalculate()" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeRecalculateModal() {
    const modal = document.getElementById('confirmRecalculateModal');
    if (modal) modal.remove();
}

async function executeQuickRecalculate() {
    closeRecalculateModal();
    
    // Show loading toast
    const loadingId = 'recalculate-loading-' + Date.now();
    showToast('Đang tính toán và cập nhật giá...', 'info', 0, loadingId);
    
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'recalculateAllPrices' })
        });

        const data = await response.json();

        // Hide loading toast — products.js uses its own showToast (DOM-based, not toastManager)
        document.getElementById(`productsSimpleToast-${loadingId}`)?.remove();

        if (data.success) {
            const { updated, skipped, updates } = data;
            
            hideOutdatedNotification();
            outdatedProductsCache = null;
            shouldShowMaterialOutdatedWarnings = false;

            const productListHtml = (updates && updates.length > 0) ? `
                <div class="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4">
                    ${updates.map((p, i) => `
                        <div class="px-3 py-2 flex items-center gap-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                            <span class="text-xs text-gray-400 w-5 text-right flex-shrink-0">${i + 1}</span>
                            <span class="text-sm text-gray-800 flex-1 truncate" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                            <span class="text-xs text-gray-400 line-through flex-shrink-0">${formatCurrency(p.old_price)}</span>
                            <span class="text-xs font-bold text-green-600 flex-shrink-0">${formatCurrency(p.new_price)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            const resultModal = document.createElement('div');
            resultModal.id = 'recalculateResultModal';
            resultModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
            resultModal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
                    <div class="p-6 flex-shrink-0">
                        <div class="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 text-center mb-1">Cập nhật thành công!</h3>
                        <p class="text-sm text-gray-500 text-center mb-4">Đã cập nhật <strong class="text-green-600">${updated}</strong> sản phẩm${skipped > 0 ? ` • Bỏ qua ${skipped}` : ''}</p>
                        ${productListHtml}
                    </div>
                    <div class="p-4 pt-0 flex-shrink-0">
                        <button onclick="document.getElementById('recalculateResultModal')?.remove()" class="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Đóng</button>
                    </div>
                </div>
            `;
            document.body.appendChild(resultModal);

            await reloadProductsKeepPage();
            
        } else {
            throw new Error(data.error || 'Không thể cập nhật giá');
        }
    } catch (error) {
        document.getElementById(`productsSimpleToast-${loadingId}`)?.remove();
        console.error('Error recalculating prices:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}


// Check if product price is outdated compared to current material costs
async function checkProductPriceOutdated(product) {
    const warningBanner = document.getElementById('outdatedPriceWarning');
    if (warningBanner) {
        warningBanner.classList.add('hidden');
    }

    // System rule: warning only appears after material price changes.
    const canShowWarning = await canShowMaterialOutdatedWarning();
    if (!canShowWarning) {
        return;
    }

    // Only check if product has materials
    if (!selectedMaterials || selectedMaterials.length === 0) {
        return;
    }

    try {
        // Calculate expected cost from current materials
        let expectedCostPrice = 0;
        for (const material of selectedMaterials) {
            const materialInfo = allMaterialsForProduct.find(m => m.item_name === material.material_name);
            if (materialInfo) {
                expectedCostPrice += (material.quantity || 0) * materialInfo.item_cost;
            }
        }
        expectedCostPrice = Math.round(expectedCostPrice * 100) / 100;

        // Calculate expected selling price
        let expectedSellingPrice;
        const materialCount = selectedMaterials.length;

        if (product.markup_multiplier !== null && product.markup_multiplier !== undefined) {
            expectedSellingPrice = expectedCostPrice * product.markup_multiplier;
        } else {
            let autoMarkup;
            if (materialCount <= 3) {
                autoMarkup = 2.5;
            } else if (materialCount <= 6) {
                autoMarkup = 3.0;
            } else {
                autoMarkup = 3.5;
            }
            expectedSellingPrice = expectedCostPrice * autoMarkup;
        }

        // Smart rounding
        if (expectedSellingPrice < 10000) {
            expectedSellingPrice = Math.round(expectedSellingPrice / 1000) * 1000;
        } else if (expectedSellingPrice < 100000) {
            expectedSellingPrice = Math.round(expectedSellingPrice / 1000) * 1000;
        } else if (expectedSellingPrice < 500000) {
            expectedSellingPrice = Math.round(expectedSellingPrice / 5000) * 5000;
        } else {
            expectedSellingPrice = Math.round(expectedSellingPrice / 10000) * 10000;
        }

        // Check if prices are different
        const currentCostPrice = product.cost_price || 0;
        const currentSellingPrice = product.price || 0;

        if (Math.abs(expectedCostPrice - currentCostPrice) > 0.01 || 
            Math.abs(expectedSellingPrice - currentSellingPrice) > 0.01) {
            
            // Show warning banner
            if (warningBanner) {
                warningBanner.classList.remove('hidden');
                
                // Update expected selling price only
                document.getElementById('expectedSellingPrice').textContent = formatCurrency(expectedSellingPrice);
                
                // Store expected values for later use
                warningBanner.dataset.expectedCostPrice = expectedCostPrice;
                warningBanner.dataset.expectedSellingPrice = expectedSellingPrice;
            }
        }
    } catch (error) {
        console.error('Error checking product price:', error);
    }
}

// Apply new prices from warning banner
function applyNewPrices() {
    const warningBanner = document.getElementById('outdatedPriceWarning');
    if (!warningBanner) return;

    const expectedCostPrice = parseFloat(warningBanner.dataset.expectedCostPrice);
    const expectedSellingPrice = parseFloat(warningBanner.dataset.expectedSellingPrice);

    if (expectedCostPrice && expectedSellingPrice) {
        // Update cost price input
        const costPriceInput = document.getElementById('productCostPrice');
        if (costPriceInput) {
            costPriceInput.value = formatNumber(expectedCostPrice);
            // Flash animation
            costPriceInput.classList.add('bg-green-50', 'border-green-300');
            setTimeout(() => {
                costPriceInput.classList.remove('bg-green-50', 'border-green-300');
            }, 500);
        }

        // Update selling price input
        const sellingPriceInput = document.getElementById('productPrice');
        if (sellingPriceInput) {
            sellingPriceInput.value = formatNumber(expectedSellingPrice);
            // Flash animation
            sellingPriceInput.classList.add('bg-green-50', 'border-green-300');
            setTimeout(() => {
                sellingPriceInput.classList.remove('bg-green-50', 'border-green-300');
            }, 500);
        }

        // Update original price (selling price - 20,000)
        const originalPriceInput = document.getElementById('productOriginalPrice');
        if (originalPriceInput) {
            const originalPrice = Math.max(0, expectedSellingPrice - 20000);
            originalPriceInput.value = formatNumber(originalPrice);
            // Flash animation
            originalPriceInput.classList.add('bg-blue-50', 'border-blue-300');
            setTimeout(() => {
                originalPriceInput.classList.remove('bg-blue-50', 'border-blue-300');
            }, 500);
        }

        // Hide warning banner
        warningBanner.classList.add('hidden');

        // Show success toast
        showToast('Đã áp dụng giá mới', 'success');

        // Recalculate profit
        if (typeof calculateExpectedProfit === 'function') {
            setTimeout(() => calculateExpectedProfit(), 100);
        }
    }
}

// ============================================
// PRICING METHOD FUNCTIONS
// ============================================

// Current pricing method ('markup' or 'profit')
let currentPricingMethod = 'markup';

// Set pricing method
function setPricingMethod(method) {
    currentPricingMethod = method;
    
    const markupBtn = document.getElementById('markupMethodBtn');
    const profitBtn = document.getElementById('profitMethodBtn');
    const markupContainer = document.getElementById('markupMethodContainer');
    const profitContainer = document.getElementById('profitMethodContainer');
    
    if (method === 'markup') {
        // Show markup method
        markupBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all bg-purple-600 text-white';
        profitBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-gray-600 hover:text-purple-600';
        markupContainer.classList.remove('hidden');
        profitContainer.classList.add('hidden');
        
        // Update price from markup
        updateSellingPriceFromMarkup();
    } else {
        // Show profit method
        profitBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all bg-purple-600 text-white';
        markupBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-gray-600 hover:text-purple-600';
        profitContainer.classList.remove('hidden');
        markupContainer.classList.add('hidden');
        
        // Update price from profit
        updateSellingPriceFromProfit();
    }
}

// Update selling price from target profit
function updateSellingPriceFromProfit() {
    const targetProfitInput = document.getElementById('targetProfit');
    const costPriceInput = document.getElementById('productCostPrice');
    const priceInput = document.getElementById('productPrice');
    const calculatedMarkupSpan = document.getElementById('calculatedMarkup');
    const markupInput = document.getElementById('markupMultiplier');
    
    if (!targetProfitInput || !costPriceInput || !priceInput) return;
    
    const targetProfit = parseFormattedNumber(targetProfitInput.value) || 0;
    const costPrice = parseFormattedNumber(costPriceInput.value) || 0;
    
    if (costPrice > 0 && targetProfit >= 0) {
        const rawPrice = costPrice + targetProfit;
        const sellingPrice = smartRound(rawPrice);

        priceInput.value = formatNumber(sellingPrice);

        // Lãi thực tế sau làm tròn — chỉ cập nhật khi user KHÔNG đang gõ vào ô lãi
        const adjustedProfit = sellingPrice - costPrice;
        if (adjustedProfit !== targetProfit && document.activeElement !== targetProfitInput) {
            targetProfitInput.value = formatNumber(adjustedProfit);
        }

        const markup = sellingPrice / costPrice;
        calculatedMarkupSpan.textContent = `×${markup.toFixed(2)}`;

        if (markupInput) {
            markupInput.value = markup.toFixed(2);
        }

        calculateExpectedProfit();
    } else {
        calculatedMarkupSpan.textContent = '-';
    }
}

// Update target profit when cost price or selling price changes (reverse calculation)
function updateTargetProfitFromPrices() {
    if (currentPricingMethod !== 'profit') return;
    
    const targetProfitInput = document.getElementById('targetProfit');
    const costPriceInput = document.getElementById('productCostPrice');
    const priceInput = document.getElementById('productPrice');
    
    if (!targetProfitInput || !costPriceInput || !priceInput) return;
    
    const costPrice = parseFormattedNumber(costPriceInput.value) || 0;
    const sellingPrice = parseFormattedNumber(priceInput.value) || 0;
    
    if (costPrice > 0 && sellingPrice > costPrice) {
        const profit = sellingPrice - costPrice;
        targetProfitInput.value = formatNumber(profit);
        
        // Update calculated markup
        const calculatedMarkupSpan = document.getElementById('calculatedMarkup');
        const markup = sellingPrice / costPrice;
        calculatedMarkupSpan.textContent = `×${markup.toFixed(2)}`;
    }
}

// Initialize pricing method when modal opens
function initializePricingMethod(product) {
    const method = product?.pricing_method || 'markup';
    currentPricingMethod = method;
    
    // Set the correct method
    setPricingMethod(method);
    
    // If profit method and has target_profit, populate the field
    if (method === 'profit' && product?.target_profit) {
        const targetProfitInput = document.getElementById('targetProfit');
        if (targetProfitInput) {
            targetProfitInput.value = formatNumber(product.target_profit);
        }
    }
    
    // Update calculated values
    if (method === 'profit') {
        updateSellingPriceFromProfit();
    } else {
        updateSellingPriceFromMarkup();
    }
}
// ============================================
// BULK PRICING METHOD FUNCTIONS
// ============================================

// Current bulk pricing method ('markup' or 'profit')
let currentBulkPricingMethod = 'markup';

// Set bulk pricing method
function setBulkPricingMethod(method) {
    currentBulkPricingMethod = method;
    
    const markupBtn = document.getElementById('bulkMarkupMethodBtn');
    const profitBtn = document.getElementById('bulkProfitMethodBtn');
    const markupContainer = document.getElementById('bulkMarkupMethodContainer');
    const profitContainer = document.getElementById('bulkProfitMethodContainer');
    
    if (method === 'markup') {
        // Show markup method
        markupBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all bg-purple-600 text-white';
        profitBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-gray-600 hover:text-purple-600';
        markupContainer.classList.remove('hidden');
        profitContainer.classList.add('hidden');
    } else {
        // Show profit method
        profitBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all bg-purple-600 text-white';
        markupBtn.className = 'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-gray-600 hover:text-purple-600';
        profitContainer.classList.remove('hidden');
        markupContainer.classList.add('hidden');
    }
}

// Toggle bulk markup inputs based on method
function toggleBulkMarkupInputs() {
    const method = document.getElementById('bulkMarkupMethod')?.value;
    const label = document.getElementById('markupValueLabel');
    const unit = document.getElementById('markupUnit');
    const hint = document.getElementById('markupHint');
    const input = document.getElementById('bulkMarkupValue');
    
    if (method === 'set') {
        label.textContent = '📊 Hệ số lãi mới';
        unit.textContent = '×';
        hint.textContent = 'Giá bán = Giá vốn × Hệ số lãi';
        input.placeholder = 'VD: 2.5';
        input.step = '0.1';
        input.min = '1.0';
        input.max = '10.0';
    } else {
        label.textContent = method === 'increase' ? '📈 Tăng thêm (%)' : '📉 Giảm đi (%)';
        unit.textContent = '%';
        hint.textContent = method === 'increase' ? 'Hệ số mới = Hệ số cũ × (1 + %)' : 'Hệ số mới = Hệ số cũ × (1 - %)';
        input.placeholder = 'VD: 10';
        input.step = '1';
        input.min = '0';
        input.max = '100';
    }
}

// Toggle bulk profit inputs based on method
function toggleBulkProfitInputs() {
    const method = document.getElementById('bulkProfitMethod')?.value;
    const label = document.getElementById('profitValueLabel');
    const unit = document.getElementById('profitUnit');
    const hint = document.getElementById('profitHint');
    const input = document.getElementById('bulkProfitValue');
    
    if (method === 'set') {
        label.textContent = '💰 Lãi mong muốn';
        unit.textContent = 'đ';
        hint.textContent = 'Giá bán = Giá vốn + Lãi mong muốn';
        input.placeholder = '120.000';
    } else {
        label.textContent = method === 'increase' ? '📈 Tăng thêm (%)' : '📉 Giảm đi (%)';
        unit.textContent = '%';
        hint.textContent = method === 'increase' ? 'Lãi mới = Lãi cũ × (1 + %)' : 'Lãi mới = Lãi cũ × (1 - %)';
        input.placeholder = '10';
    }
}

// Set bulk markup preset
function setBulkMarkupPreset(value) {
    const input = document.getElementById('bulkMarkupValue');
    if (input) {
        input.value = value.toFixed(1);
    }
}

// Set bulk profit preset
function setBulkProfitPreset(value) {
    const input = document.getElementById('bulkProfitValue');
    if (input) {
        input.value = formatNumber(value);
    }
}

// Apply bulk pricing update (unified function)
async function applyBulkPricingUpdate() {
    if (currentBulkPricingMethod === 'markup') {
        await applyBulkMarkupUpdate();
    } else {
        await applyBulkProfitUpdate();
    }
}

// Apply bulk profit update (new function)
async function applyBulkProfitUpdate() {
    const method = document.getElementById('bulkProfitMethod').value;
    const inputValue = document.getElementById('bulkProfitValue').value;
    
    let value;
    if (method === 'set') {
        value = parseFormattedNumber(inputValue);
        if (isNaN(value) || value <= 0) {
            showToast('Vui lòng nhập lãi mong muốn hợp lệ', 'warning');
            return;
        }
    } else {
        value = parseFloat(inputValue);
        if (isNaN(value) || value < 0 || value > 100) {
            showToast('Phần trăm phải từ 0 đến 100', 'warning');
            return;
        }
    }

    try {
        showToast(`Đang cập nhật giá cho ${selectedProductIds.size} sản phẩm...`, 'info', 0, 'bulk-profit-update');
        closeBulkMarkupModal();

        let successCount = 0;
        let failCount = 0;

        for (const productId of selectedProductIds) {
            try {
                const product = allProducts.find(p => p.id === productId);
                if (!product) continue;

                const currentCostPrice = product.cost_price || 0;
                const currentProfit = (product.price || 0) - currentCostPrice;

                // Calculate new profit
                let newProfit;
                switch (method) {
                    case 'set':
                        newProfit = value;
                        break;
                    case 'increase':
                        newProfit = currentProfit * (1 + value / 100);
                        break;
                    case 'decrease':
                        newProfit = currentProfit * (1 - value / 100);
                        break;
                }

                // Ensure profit is not negative
                newProfit = Math.max(0, newProfit);

                // Calculate new price and markup
                const newPrice = smartRound(currentCostPrice + newProfit);
                const newMarkup = currentCostPrice > 0 ? newPrice / currentCostPrice : 2.5;
                const newOriginalPrice = newPrice + 20000;

                // Update product via API
                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateProduct',
                        id: productId,
                        pricing_method: 'profit',
                        target_profit: newProfit,
                        markup_multiplier: newMarkup,
                        price: newPrice,
                        original_price: newOriginalPrice
                    })
                });

                const data = await response.json();
                if (data.success) {
                    // Update local data immediately
                    product.pricing_method = 'profit';
                    product.target_profit = newProfit;
                    product.markup_multiplier = newMarkup;
                    product.price = newPrice;
                    product.original_price = newOriginalPrice;
                    
                    successCount++;
                    
                    // Update progress
                    showToast(
                        `Đang cập nhật... (${successCount}/${selectedProductIds.size})`, 
                        'info', 
                        0, 
                        'bulk-profit-update'
                    );
                } else {
                    failCount++;
                    console.error(`Failed to update product ${productId}:`, data.error);
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating product ${productId}:`, error);
            }
        }

        clearSelection();
        
        // Re-filter and render products with updated data
        searchAndSort();

        // Update final toast with result
        if (failCount === 0) {
            showToast(`Đã cập nhật giá thành công cho ${successCount} sản phẩm`, 'success', 3000, 'bulk-profit-update');
        } else {
            showToast(`Đã cập nhật ${successCount} sản phẩm, thất bại ${failCount} sản phẩm`, 'warning', 4000, 'bulk-profit-update');
        }
    } catch (error) {
        console.error('Error bulk updating profit:', error);
        showToast('Không thể cập nhật giá: ' + error.message, 'error', 5000, 'bulk-profit-update');
    }
}

// Export functions for global access
window.selectCategoryFilter = selectCategoryFilter;

// ============================================
// QUICK EDIT PRODUCT NAME - OPTIMISTIC UI
// ============================================

let editingProductId = null;
let originalProductName = null;

// Start editing product name
function startEditProductName(productId, element) {
    // Prevent multiple edits
    if (editingProductId) {
        return;
    }
    
    editingProductId = productId;
    originalProductName = element.textContent.trim();
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalProductName;
    input.className = 'product-name-editing';
    input.maxLength = 255;
    
    // Replace the entire container with input
    const container = element.closest('.group');
    const parent = container.parentElement;
    parent.replaceChild(input, container);
    
    // Focus and select all text
    input.focus();
    input.select();
    
    // Handle save on Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveProductNameEdit(productId, input);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelProductNameEdit(productId, input);
        }
    });
    
    // Handle save on blur (click outside)
    input.addEventListener('blur', () => {
        // Small delay to allow click events to process
        setTimeout(() => {
            if (editingProductId === productId) {
                saveProductNameEdit(productId, input);
            }
        }, 100);
    });
    
    console.log(`🖊️ Started editing product ${productId}: "${originalProductName}"`);
}

// Save product name edit with Optimistic UI
async function saveProductNameEdit(productId, input) {
    const newName = input.value.trim();
    
    // Validate name
    if (!newName) {
        showToast('Tên sản phẩm không được để trống', 'error');
        input.focus();
        return;
    }
    
    if (newName === originalProductName) {
        // No change, just cancel
        cancelProductNameEdit(productId, input);
        return;
    }
    
    console.log(`💾 Saving product name: ${originalProductName} → ${newName}`);
    
    // 1. OPTIMISTIC UPDATE - Update UI immediately
    const productCard = input.closest('.bg-white');
    const newContainer = createProductNameElement(productId, newName);
    input.parentElement.replaceChild(newContainer, input);
    
    // Update local data
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        product.name = newName;
    }
    const filteredProduct = filteredProducts.find(p => p.id === productId);
    if (filteredProduct) {
        filteredProduct.name = newName;
    }
    
    // Show saving state
    const h3 = newContainer.querySelector('h3');
    h3.classList.add('product-name-saving');
    const savingIndicator = document.createElement('div');
    savingIndicator.className = 'absolute -top-1 -right-1 w-4 h-4 z-20';
    savingIndicator.innerHTML = `
        <svg class="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    `;
    newContainer.appendChild(savingIndicator);
    
    // Reset editing state
    editingProductId = null;
    originalProductName = null;
    
    try {
        // 2. API CALL - Save to server
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({
                action: 'updateProduct',
                id: productId,
                name: newName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 3. SUCCESS - Remove saving indicator and show success
            savingIndicator.remove();
            h3.classList.remove('product-name-saving');
            
            // Brief success indication
            h3.style.backgroundColor = '#dcfce7';
            setTimeout(() => {
                h3.style.backgroundColor = '';
            }, 1000);
            
            console.log(`✅ Product name saved successfully: ${newName}`);
            showToast('✅ Đã cập nhật tên sản phẩm', 'success', 2000);
            
        } else {
            throw new Error(data.error || 'Failed to update product name');
        }
        
    } catch (error) {
        console.error('❌ Failed to save product name:', error);
        
        // 4. ERROR RECOVERY - Revert optimistic update
        savingIndicator.remove();
        h3.classList.remove('product-name-saving');
        
        // Revert to original name
        const revertedContainer = createProductNameElement(productId, originalProductName);
        newContainer.parentElement.replaceChild(revertedContainer, newContainer);
        
        // Revert local data
        if (product) {
            product.name = originalProductName;
        }
        if (filteredProduct) {
            filteredProduct.name = originalProductName;
        }
        
        // Show error with retry option
        showToast(`❌ Lỗi cập nhật tên: ${error.message}`, 'error', 5000);
        
        // Add error styling briefly
        const revertedH3 = revertedContainer.querySelector('h3');
        revertedH3.style.backgroundColor = '#fef2f2';
        revertedH3.style.borderColor = '#ef4444';
        setTimeout(() => {
            revertedH3.style.backgroundColor = '';
            revertedH3.style.borderColor = '';
        }, 2000);
    }
}

// Start editing product stock inline
function startEditProductStock(productId, element) {
    if (editingProductStockId && editingProductStockId !== productId) {
        cancelProductStockEdit();
    }

    if (editingProductStockId === productId) return;

    const stockText = element.closest('span') || element;
    const currentStock = stockText.textContent.trim() === 'Hết hàng'
        ? 0
        : parseInt(stockText.textContent.trim(), 10) || 0;

    editingProductStockId = productId;
    originalProductStockValue = currentStock;

    const stockContainer = stockText.parentElement;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = currentStock;
    input.className = 'w-20 px-2 py-0.5 text-sm border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
    input.dataset.productId = productId;

    stockContainer.replaceChild(input, stockText);
    input.focus();
    input.select();

    const finishEdit = () => saveProductStockEdit(productId, input);

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelProductStockEdit();
        }
    });
}

function cancelProductStockEdit() {
    if (!editingProductStockId) return;

    const input = document.querySelector(`input[data-product-id="${editingProductStockId}"]`);
    if (!input) {
        editingProductStockId = null;
        originalProductStockValue = null;
        return;
    }

    const stockContainer = input.parentElement;
    const stockSpan = document.createElement('span');
    const stockValue = Number(originalProductStockValue || 0);
    stockSpan.className = `text-sm font-medium ${stockValue > 0 ? 'text-green-600' : 'text-red-600'} cursor-pointer`;
    stockSpan.title = 'Click để chỉnh sửa tồn kho';
    stockSpan.setAttribute('data-product-id', editingProductStockId);
    stockSpan.setAttribute('data-original-stock', stockValue);
    stockSpan.onclick = () => startEditProductStock(editingProductStockId, stockSpan);
    stockSpan.textContent = stockValue > 0 ? `${stockValue} SP` : 'Hết hàng';

    stockContainer.replaceChild(stockSpan, input);
    editingProductStockId = null;
    originalProductStockValue = null;
}

async function saveProductStockEdit(productId, input) {
    if (!input || !editingProductStockId) return;

    const newStock = Math.max(0, parseInt(input.value, 10) || 0);

    // No change: restore quickly without network call
    if (newStock === Number(originalProductStockValue || 0)) {
        cancelProductStockEdit();
        return;
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateProduct',
                id: productId,
                stock_quantity: newStock
            })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Không thể cập nhật tồn kho');
        }

        // Update local cache then re-render
        const localProduct = allProducts.find(p => p.id === productId);
        if (localProduct) localProduct.stock_quantity = newStock;
        filteredProducts = [...allProducts];
        searchAndSort();
        showToast('Đã cập nhật tồn kho', 'success');
    } catch (error) {
        console.error('Error updating stock inline:', error);
        showToast(error.message || 'Lỗi cập nhật tồn kho', 'error');
        cancelProductStockEdit();
    } finally {
        editingProductStockId = null;
        originalProductStockValue = null;
    }
}

// Cancel product name edit
function cancelProductNameEdit(productId, input) {
    console.log(`❌ Cancelled editing product ${productId}`);
    
    // Create original container element
    const originalContainer = createProductNameElement(productId, originalProductName);
    input.parentElement.replaceChild(originalContainer, input);
    
    // Reset editing state
    editingProductId = null;
    originalProductName = null;
}

// Create product name element
function createProductNameElement(productId, name) {
    const container = document.createElement('div');
    container.className = 'flex-1 flex items-center gap-2 group';
    
    const h3 = document.createElement('h3');
    h3.className = 'product-name text-base font-semibold text-gray-900 line-clamp-2 cursor-pointer hover:text-admin-primary transition-colors flex-1';
    h3.title = 'Click để chỉnh sửa tên sản phẩm';
    h3.textContent = name;
    h3.setAttribute('data-product-id', productId);
    h3.setAttribute('data-original-name', name);
    h3.onclick = () => startEditProductName(productId, h3);
    
    const editIcon = document.createElement('div');
    editIcon.className = 'opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer';
    editIcon.onclick = () => startEditProductName(productId, h3);
    editIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-400 hover:text-admin-primary">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
        </svg>
    `;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'edit-name-tooltip';
    tooltip.textContent = 'Click để chỉnh sửa';
    
    container.appendChild(h3);
    container.appendChild(editIcon);
    container.appendChild(tooltip);
    
    return container;
}

// Enhanced toast function for better UX
function showToast(message, type = 'info', duration = 4000, toastId = null) {
    // Keep toast behavior simple + stable:
    // - If toastId is provided, update/replace only that toast
    // - Otherwise keep a single default toast
    const resolvedId = toastId ? `productsSimpleToast-${toastId}` : 'productsSimpleToast';
    const existing = document.getElementById(resolvedId);
    if (existing) existing.remove();

    // For non-ID toasts, remove previous default to avoid stacking/flicker.
    if (!toastId) {
        document.querySelectorAll('[id^="productsSimpleToast-"]').forEach(el => el.remove());
    }

    const toast = document.createElement('div');
    toast.id = resolvedId;
    toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white';

    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-amber-500',
        info: 'bg-blue-600'
    };
    // Ensure spinner keyframes exist (no dependency on Tailwind)
    if (!document.getElementById('productsSimpleToastSpinStyle')) {
        const style = document.createElement('style');
        style.id = 'productsSimpleToastSpinStyle';
        style.textContent = `
            @keyframes productsSimpleToastSpin { 
                from { transform: rotate(0deg); } 
                to { transform: rotate(360deg); } 
            }
        `;
        document.head.appendChild(style);
    }

    const icons = {
        success: '<span aria-hidden="true">✓</span>',
        error: '<span aria-hidden="true">✕</span>',
        warning: '<span aria-hidden="true">!</span>',
        info: `
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" style="animation: productsSimpleToastSpin 1s linear infinite">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25"></circle>
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.9"></path>
            </svg>
        `
    };

    toast.className += ` ${colors[type] || colors.info}`;
    toast.innerHTML = `
        <span class="font-bold flex items-center justify-center">${icons[type] || icons.info}</span>
        <span class="font-medium">${message}</span>
    `;

    document.body.appendChild(toast);

    // duration <= 0 => persistent toast (for loading/progress)
    if (duration > 0) {
        setTimeout(() => {
            const current = document.getElementById(resolvedId);
            if (current) current.remove();
        }, duration);
    }
}

// Export functions for global access
window.startEditProductName = startEditProductName;
window.startEditProductStock = startEditProductStock;

function resetPendingImageSelection() {
    pendingImageFile = null;
    if (pendingImagePreviewUrl) {
        URL.revokeObjectURL(pendingImagePreviewUrl);
        pendingImagePreviewUrl = null;
    }
}

async function uploadImageToR2(file) {
    const ext = (file.name || '').split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const filename = `products/${timestamp}.${ext}`;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('filename', filename);

    // Khi chạy local dev, Wrangler chỉ mô phỏng R2 cục bộ → URL trả về là localhost,
    // lưu vào DB dùng chung sẽ không truy cập được trên production.
    // Vì vậy luôn upload qua production Worker để ảnh nằm trên Cloudflare R2 thật.
    const isLocalDev = ['127.0.0.1', 'localhost'].includes(location.hostname);
    const uploadApiUrl = isLocalDev
        ? 'https://ctv-api.yendev96.workers.dev/?action=uploadImage'
        : `${CONFIG.API_URL}/?action=uploadImage`;

    const response = await fetch(uploadApiUrl, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { const e = await response.json(); errMsg = e.error || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }

    const data = await response.json();
    if (!data.success || !data.url) {
        throw new Error(data.error || 'Upload thất bại - không nhận được URL');
    }

    return data.url;
}

// Try alternative methods to load image
async function tryAlternativeImageLoad(imgElement, originalUrl, encodedUrl) {
    console.log('🔄 Trying alternative image loading methods for CORS issue...');
    
    // Method 1: Try direct image loading without CORS (most likely to work)
    console.log('🔄 Method 1: Direct image loading without CORS...');
    const img1 = new Image();
    
    const method1Promise = new Promise((resolve, reject) => {
        img1.onload = function() {
            console.log('✅ Method 1 success: Direct image loading works');
            resolve(this);
        };
        img1.onerror = function() {
            console.log('❌ Method 1 failed: Direct image loading');
            reject(new Error('Direct image loading failed'));
        };
        
        // Timeout after 3 seconds (faster)
        setTimeout(() => {
            reject(new Error('Method 1 timeout'));
        }, 3000);
    });
    
    img1.src = encodedUrl;
    
    try {
        const successImg = await method1Promise;
        imgElement.src = successImg.src;
        imgElement.style.opacity = '1';
        imgElement.style.padding = '';
        imgElement.style.backgroundColor = '';
        showToast('✅ Đã load ảnh thành công', 'success');
        return;
    } catch (error) {
        console.log('❌ Method 1 failed:', error.message);
    }
    
    // Method 2: Try with crossOrigin anonymous
    console.log('🔄 Method 2: Direct image loading with CORS...');
    const img2 = new Image();
    img2.crossOrigin = 'anonymous';
    
    const method2Promise = new Promise((resolve, reject) => {
        img2.onload = function() {
            console.log('✅ Method 2 success: Direct image loading with CORS works');
            resolve(this);
        };
        img2.onerror = function() {
            console.log('❌ Method 2 failed: Direct image loading with CORS');
            reject(new Error('Direct image loading with CORS failed'));
        };
        
        // Timeout after 3 seconds
        setTimeout(() => {
            reject(new Error('Method 2 timeout'));
        }, 3000);
    });
    
    img2.src = encodedUrl;
    
    try {
        const successImg = await method2Promise;
        imgElement.src = successImg.src;
        imgElement.crossOrigin = 'anonymous';
        imgElement.style.opacity = '1';
        imgElement.style.padding = '';
        imgElement.style.backgroundColor = '';
        showToast('✅ Đã load ảnh thành công (bypass CORS)', 'success');
        return;
    } catch (error) {
        console.log('❌ Method 2 failed:', error.message);
    }
    
    // All methods failed - show CORS error
    showFinalCORSError(originalUrl);
}

function showFinalCORSError(url) {
    console.error('❌ All image loading methods failed due to CORS policy');
    
    const imgElement = document.getElementById('imagePreview');
    if (imgElement) {
        // Check if we're in development mode
        const isDevelopment = window.location.port === '5500' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Create a more informative placeholder with preview option
        const placeholderSvg = `
            <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="150" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="8,4"/>
                <circle cx="100" cy="50" r="15" fill="#10b981"/>
                <path d="M92 50L98 56L108 46" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="100" y="80" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="12" font-weight="bold">Upload thanh cong!</text>
                <text x="100" y="95" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">${isDevelopment ? 'Dev mode: R2 simulation' : 'CORS Policy Error'}</text>
                <text x="100" y="110" text-anchor="middle" fill="#3b82f6" font-family="Arial" font-size="10" style="cursor:pointer">Click de xem anh</text>
                <text x="100" y="125" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="8">${isDevelopment ? 'Preview khong kha dung trong dev' : 'Anh da duoc luu thanh cong'}</text>
            </svg>
        `;
        
        imgElement.style.opacity = '1';
        // Use encodeURIComponent instead of btoa for Unicode safety
        imgElement.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(placeholderSvg);
        imgElement.style.padding = '10px';
        imgElement.style.backgroundColor = '#f8fafc';
        imgElement.style.border = '2px dashed #10b981';
        imgElement.style.borderRadius = '8px';
        imgElement.style.cursor = 'pointer';
        
        // Add click handler to open image
        imgElement.onclick = () => window.open(url, '_blank');
        
        // Add hover effect
        imgElement.onmouseenter = () => {
            imgElement.style.backgroundColor = '#f0fdf4';
            imgElement.style.borderColor = '#059669';
        };
        imgElement.onmouseleave = () => {
            imgElement.style.backgroundColor = '#f8fafc';
            imgElement.style.borderColor = '#10b981';
        };
    }
    
    // Show concise success message with action
    const isDevelopment = window.location.port === '5500' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDevelopment) {
        showToast('✅ Upload thành công! Click ảnh để xem (Dev mode: Preview không khả dụng)', 'success', 6000);
    } else {
        showToast('✅ Upload thành công! Click ảnh để xem (CORS issue)', 'success', 6000);
    }
    
    console.log('💡 CORS Solution needed: Configure R2 bucket CORS settings');
    console.log('💡 R2 CORS config:', {
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3600
    });
}

// Export function for global access
window.tryAlternativeImageLoad = tryAlternativeImageLoad;