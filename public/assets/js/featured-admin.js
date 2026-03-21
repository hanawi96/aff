// Featured Products Admin - Simplified Version
// Quản lý sản phẩm nổi bật đơn giản với modal selection

// ============================================
// CONFIGURATION & STATE
// ============================================
const FEATURED_CONFIG = {
    API_URL: (() => {
        if (window.location.port === '5500' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://127.0.0.1:8787';
        }
        return 'https://ctv-api.yendev96.workers.dev';
    })(),
    MAX_FEATURED: 20,
    DEBOUNCE_DELAY: 300
};

// Global state
let state = {
    featuredProducts: [],
    availableProducts: [],
    filteredAvailable: [],
    categories: [],
    selectedCategory: 'all',
    selectedProducts: [], // Array để track sản phẩm đã chọn trong modal
    selectedFeaturedProducts: [], // Array để track sản phẩm featured đã chọn để bulk action
    isLoading: false,
    isReordering: false, // Prevent spam reordering
    searchTimeout: null
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Initializing Featured Products Admin...');
    
    try {
        // Setup event listeners
        setupEventListeners();
        
        // Initialize bulk action bar state
        const bulkActionBar = document.getElementById('bulkActionBar');
        if (bulkActionBar) {
            bulkActionBar.classList.add('hidden');
            bulkActionBar.classList.remove('show');
        }
        
        // Load initial data
        await loadFeaturedData();
        
        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showToast('Lỗi khởi tạo ứng dụng', 'error');
    }
}

function setupEventListeners() {
    // Product search in modal
    const productSearch = document.getElementById('productSearch');
    if (productSearch) {
        productSearch.addEventListener('input', debounce(handleProductSearch, FEATURED_CONFIG.DEBOUNCE_DELAY));
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Close modal on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
        }
    });
}

// ============================================
// DATA LOADING
// ============================================
async function loadFeaturedData() {
    if (state.isLoading) return;
    
    state.isLoading = true;
    showLoadingState();
    
    try {
        console.log('📡 Loading featured products data...');
        
        // Load featured products and categories in parallel
        const [featuredResponse, categoriesResponse] = await Promise.all([
            fetch(`${FEATURED_CONFIG.API_URL}?action=getFeaturedProductsForAdmin`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('session_token')}`
                }
            }),
            fetch(`${FEATURED_CONFIG.API_URL}?action=getAllCategories`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('session_token')}`
                }
            })
        ]);
        
        const [featuredData, categoriesData] = await Promise.all([
            featuredResponse.json(),
            categoriesResponse.json()
        ]);
        
        if (featuredData.success && categoriesData.success) {
            // Update state
            state.featuredProducts = featuredData.featured_products || [];
            state.availableProducts = featuredData.available_products || [];
            state.categories = categoriesData.categories || [];
            state.filteredAvailable = [...state.availableProducts];
            
            // Update UI
            updateFeaturedCount(featuredData.stats);
            renderFeaturedProducts();
            
            console.log(`✅ Loaded ${state.featuredProducts.length} featured products and ${state.categories.length} categories`);
        } else {
            throw new Error(featuredData.error || categoriesData.error || 'Failed to load data');
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showToast('Lỗi tải dữ liệu: ' + error.message, 'error');
        showErrorState();
    } finally {
        state.isLoading = false;
        hideLoadingState();
    }
}

// ============================================
// UI RENDERING
// ============================================
function renderFeaturedProducts() {
    const container = document.getElementById('featuredList');
    const emptyState = document.getElementById('featuredEmpty');
    const addProductBtn = document.getElementById('addProductBtn');
    const selectAllContainer = document.getElementById('selectAllContainer');
    
    if (state.featuredProducts.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        addProductBtn.classList.add('hidden');
        if (selectAllContainer) selectAllContainer.style.display = 'none';
        return;
    }
    
    emptyState.classList.add('hidden');
    addProductBtn.classList.remove('hidden');
    if (selectAllContainer) selectAllContainer.style.display = 'flex';
    
    // Render featured products với optimized DOM manipulation
    const fragment = document.createDocumentFragment();
    
    state.featuredProducts.forEach((product, index) => {
        const productElement = createFeaturedProductElement(product, index);
        fragment.appendChild(productElement);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Update bulk action UI
    updateBulkActionUI();
    
    console.log(`✅ Rendered ${state.featuredProducts.length} featured products`);
}

function createFeaturedProductElement(product, index) {
    const div = document.createElement('div');
    const isSelected = state.selectedFeaturedProducts.includes(product.id);
    const isFirst = index === 0;
    const isLast = index === state.featuredProducts.length - 1;
    const totalCount = state.featuredProducts.length;
    
    div.className = `product-card rounded-xl border bg-white p-4 transition-all duration-200 hover:shadow-md ${
        isSelected ? 'border-admin-primary bg-admin-primary/5' : 'border-slate-200'
    }`;
    div.dataset.productId = product.id;
    div.dataset.productIndex = index;
    
    div.innerHTML = `
        <div class="flex items-center space-x-4">
            <!-- Bulk Selection Checkbox -->
            <div class="flex-shrink-0">
                <input type="checkbox" ${isSelected ? 'checked' : ''} 
                       class="w-4 h-4 text-admin-primary border-gray-300 rounded focus:ring-admin-primary focus:ring-2"
                       onclick="event.stopPropagation(); toggleFeaturedProductSelection(${product.id});">
            </div>
            
            <!-- Order Badge -->
            <div class="flex-shrink-0">
                <span class="inline-flex items-center justify-center w-8 h-8 bg-admin-primary text-white text-sm font-semibold rounded-full">
                    ${index + 1}
                </span>
            </div>
            
            <!-- Product Image -->
            <div class="flex-shrink-0">
                <img src="${product.image_url || '/assets/images/no-image.jpg'}" 
                     alt="${product.name}"
                     class="w-12 h-12 object-cover rounded-lg border border-gray-200"
                     loading="lazy"
                     onerror="this.src='/assets/images/no-image.jpg'">
            </div>
            
            <!-- Product Info -->
            <div class="flex-1 min-w-0">
                <h3 class="text-sm font-medium text-gray-900 truncate">${product.name}</h3>
                <p class="text-sm text-gray-500">${formatPrice(product.price)}</p>
            </div>
            
            <!-- Reorder Controls -->
            <div class="flex-shrink-0 flex items-center space-x-1">
                ${totalCount > 1 ? `
                    <!-- Up Button -->
                    <button onclick="moveProductUp(${product.id}, ${index})" 
                            class="reorder-btn rounded-lg p-1.5 text-indigo-500 transition-all duration-150 hover:bg-indigo-50 hover:text-indigo-700 ${isFirst ? 'invisible' : ''}"
                            title="Di chuyển lên"
                            ${isFirst ? 'disabled' : ''}>
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    
                    <!-- Down Button -->
                    <button onclick="moveProductDown(${product.id}, ${index})" 
                            class="reorder-btn rounded-lg p-1.5 text-indigo-500 transition-all duration-150 hover:bg-indigo-50 hover:text-indigo-700 ${isLast ? 'invisible' : ''}"
                            title="Di chuyển xuống"
                            ${isLast ? 'disabled' : ''}>
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                ` : ''}
                
                <!-- Remove Button -->
                <button onclick="removeFeaturedProduct(${product.id})" 
                        class="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-150"
                        title="Xóa khỏi nổi bật">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    return div;
}

function renderAvailableProducts() {
    const container = document.getElementById('availableProducts');
    const loading = document.getElementById('modalLoading');
    const empty = document.getElementById('modalEmpty');
    
    // Hide loading
    loading.classList.add('hidden');
    
    if (state.filteredAvailable.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    
    // Render available products
    const fragment = document.createDocumentFragment();
    
    state.filteredAvailable.forEach(product => {
        const productElement = createAvailableProductElement(product);
        fragment.appendChild(productElement);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

function createAvailableProductElement(product) {
    const div = document.createElement('div');
    const isSelected = state.selectedProducts.includes(product.id);
    
    div.className = `cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:border-admin-primary hover:shadow-md ${
        isSelected ? 'border-admin-primary bg-admin-primary/5' : 'border-slate-200'
    }`;
    div.onclick = () => toggleProductSelection(product.id);
    
    div.innerHTML = `
        <div class="flex items-center space-x-3">
            <!-- Checkbox -->
            <div class="flex-shrink-0">
                <input type="checkbox" ${isSelected ? 'checked' : ''} 
                       class="w-5 h-5 text-admin-primary border-gray-300 rounded focus:ring-admin-primary focus:ring-2"
                       onclick="event.stopPropagation(); toggleProductSelection(${product.id});">
            </div>
            
            <!-- Product Image -->
            <div class="flex-shrink-0">
                <img src="${product.image_url || '/assets/images/no-image.jpg'}" 
                     alt="${product.name}"
                     class="w-12 h-12 object-cover rounded-lg border border-gray-200"
                     loading="lazy"
                     onerror="this.src='/assets/images/no-image.jpg'">
            </div>
            
            <!-- Product Info -->
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900 truncate">${product.name}</h4>
                <p class="text-xs text-gray-500">${formatPrice(product.price)}</p>
            </div>
        </div>
    `;
    
    return div;
}

// ============================================
// MODAL MANAGEMENT
// ============================================
async function openProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Reset selection
    state.selectedProducts = [];
    updateSelectionUI();
    
    // Render category tabs
    renderCategoryTabs();
    
    // Load available products if not loaded
    if (state.availableProducts.length === 0) {
        await loadAvailableProducts();
    }
    
    // Apply current filters
    applyFilters();
    renderAvailableProducts();
    
    // Focus search input
    setTimeout(() => {
        document.getElementById('productSearch').focus();
    }, 100);
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    
    // Clear search and reset filters
    document.getElementById('productSearch').value = '';
    state.selectedCategory = 'all';
    state.filteredAvailable = [...state.availableProducts];
    
    // Reset selection
    state.selectedProducts = [];
    updateSelectionUI();
}

async function loadAvailableProducts() {
    const loading = document.getElementById('modalLoading');
    loading.classList.remove('hidden');
    
    try {
        // Apply current filters
        applyFilters();
        
        console.log(`📦 Available products: ${state.filteredAvailable.length}`);
        
    } catch (error) {
        console.error('Error loading available products:', error);
        showToast('Lỗi tải danh sách sản phẩm', 'error');
    }
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================
function renderCategoryTabs() {
    const container = document.getElementById('categoryTabs');
    if (!container) return;
    
    console.log('🏷️ Rendering category tabs...');
    console.log('   Available products:', state.availableProducts.length);
    console.log('   Categories:', state.categories.length);
    
    const fragment = document.createDocumentFragment();
    
    // Calculate total available products (excluding featured)
    const featuredIds = state.featuredProducts.map(p => p.id);
    const availableProducts = state.availableProducts.filter(product => 
        !featuredIds.includes(product.id)
    );
    
    // "Tất cả" tab
    const allTab = createCategoryTab('all', 'Tất cả', availableProducts.length);
    fragment.appendChild(allTab);
    
    // Category tabs - show all categories with product counts
    state.categories.forEach(category => {
        // Count products in this category (excluding featured)
        const productCount = availableProducts.filter(product => {
            // Check multiple ways a product can belong to a category
            const primaryCategory = product.category_id === category.id;
            const additionalCategories = product.all_category_ids && 
                product.all_category_ids.split(',').map(id => parseInt(id)).includes(category.id);
            
            return primaryCategory || additionalCategories;
        }).length;
        
        console.log(`   Category "${category.name}" (ID: ${category.id}): ${productCount} products`);
        
        // Show all categories, even with 0 products for better UX
        const tab = createCategoryTab(category.id, category.name, productCount);
        fragment.appendChild(tab);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    console.log('✅ Category tabs rendered');
}

function createCategoryTab(categoryId, name, count) {
    const button = document.createElement('button');
    const isActive = state.selectedCategory == categoryId;
    
    button.className = `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
        isActive 
            ? 'bg-admin-primary text-white shadow-md' 
            : 'border border-slate-200 bg-white text-slate-700 hover:border-admin-primary/20 hover:bg-admin-primary/5 hover:text-admin-primary'
    }`;
    
    button.onclick = () => selectCategory(categoryId);
    
    button.innerHTML = `
        <span>${name}</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${
            isActive 
                ? 'bg-white/20 text-white' 
                : 'bg-gray-100 text-gray-600'
        }">${count}</span>
    `;
    
    return button;
}

function selectCategory(categoryId) {
    state.selectedCategory = categoryId;
    
    // Update tab styles
    renderCategoryTabs();
    
    // Apply filters and render
    applyFilters();
    renderAvailableProducts();
}

// ============================================
// FILTERING SYSTEM
// ============================================
function applyFilters() {
    const searchQuery = document.getElementById('productSearch')?.value.toLowerCase().trim() || '';
    const featuredIds = state.featuredProducts.map(p => p.id);
    
    console.log('🔍 Applying filters...');
    console.log('   Search query:', searchQuery);
    console.log('   Selected category:', state.selectedCategory);
    console.log('   Featured products to exclude:', featuredIds.length);
    
    // Start with all available products (excluding featured)
    let filtered = state.availableProducts.filter(product => 
        !featuredIds.includes(product.id)
    );
    
    console.log('   After excluding featured:', filtered.length);
    
    // Apply category filter
    if (state.selectedCategory !== 'all') {
        filtered = filtered.filter(product => {
            // Check multiple ways a product can belong to a category
            const primaryCategory = product.category_id == state.selectedCategory;
            const additionalCategories = product.all_category_ids && 
                product.all_category_ids.split(',').map(id => parseInt(id)).includes(parseInt(state.selectedCategory));
            
            const belongsToCategory = primaryCategory || additionalCategories;
            
            if (belongsToCategory) {
                console.log(`   Product "${product.name}" belongs to category ${state.selectedCategory}`);
            }
            
            return belongsToCategory;
        });
        
        console.log(`   After category filter (${state.selectedCategory}):`, filtered.length);
    }
    
    // Apply search filter
    if (searchQuery) {
        filtered = filtered.filter(product =>
            product.name.toLowerCase().includes(searchQuery) ||
            (product.description && product.description.toLowerCase().includes(searchQuery))
        );
        
        console.log(`   After search filter ("${searchQuery}"):`, filtered.length);
    }
    
    state.filteredAvailable = filtered;
    
    console.log(`✅ Final filtered products: ${filtered.length}`);
}

function handleProductSearch(event) {
    // Apply all filters when search changes
    applyFilters();
    renderAvailableProducts();
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

// ============================================
// SMART REORDERING SYSTEM - SIÊU NHANH & MƯỢT
// ============================================

// Optimized reorder với debounce và batch processing
let reorderQueue = [];
let reorderTimeout = null;
const REORDER_DEBOUNCE = 150; // ms

// 🚀 Di chuyển sản phẩm lên - Siêu tối ưu
async function moveProductUp(productId, currentIndex) {
    if (currentIndex === 0) return; // Đã ở đầu
    
    const newIndex = currentIndex - 1;
    await performSmartReorder(currentIndex, newIndex, 'up');
}

// 🚀 Di chuyển sản phẩm xuống - Siêu tối ưu  
async function moveProductDown(productId, currentIndex) {
    if (currentIndex === state.featuredProducts.length - 1) return; // Đã ở cuối
    
    const newIndex = currentIndex + 1;
    await performSmartReorder(currentIndex, newIndex, 'down');
}

// 🧠 Smart reorder với optimistic UI và error recovery
async function performSmartReorder(oldIndex, newIndex, direction) {
    // Prevent spam clicking
    if (state.isReordering) {
        console.log('🚫 Reorder in progress, ignoring request');
        return;
    }
    
    state.isReordering = true;
    
    try {
        console.log(`🔄 Smart reorder: ${oldIndex} → ${newIndex} (${direction})`);
        
        // 1. Instant UI feedback - Optimistic update
        const originalProducts = [...state.featuredProducts];
        performOptimisticReorder(oldIndex, newIndex);
        
        // 2. Visual feedback với smooth animation
        showReorderFeedback(oldIndex, newIndex, direction);
        
        // 3. Debounced API call để tránh spam
        clearTimeout(reorderTimeout);
        reorderTimeout = setTimeout(async () => {
            try {
                await executeReorderAPI();
                console.log('✅ Smart reorder completed successfully');
                showToast('Đã cập nhật thứ tự', 'success', 1500);
            } catch (error) {
                console.error('❌ Smart reorder failed:', error);
                // Rollback optimistic update
                state.featuredProducts = originalProducts;
                renderFeaturedProducts();
                showToast('Lỗi cập nhật thứ tự', 'error');
            }
        }, REORDER_DEBOUNCE);
        
    } finally {
        // Reset state sau một chút để tránh race condition
        setTimeout(() => {
            state.isReordering = false;
        }, 100);
    }
}

// ⚡ Optimistic UI update - Instant feedback
function performOptimisticReorder(oldIndex, newIndex) {
    // Swap elements in state
    const movedProduct = state.featuredProducts.splice(oldIndex, 1)[0];
    state.featuredProducts.splice(newIndex, 0, movedProduct);
    
    // Instant UI update
    renderFeaturedProducts();
}

// 🎨 Visual feedback với smooth animations
function showReorderFeedback(oldIndex, newIndex, direction) {
    const container = document.getElementById('featuredList');
    const cards = container.querySelectorAll('.product-card');
    
    if (cards[newIndex]) {
        // Highlight moved card
        cards[newIndex].style.transform = 'scale(1.02)';
        cards[newIndex].style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.15)';
        cards[newIndex].style.borderColor = '#6366f1';
        
        // Reset after animation
        setTimeout(() => {
            cards[newIndex].style.transform = '';
            cards[newIndex].style.boxShadow = '';
            cards[newIndex].style.borderColor = '';
        }, 300);
    }
}

// 🚀 Optimized API execution
async function executeReorderAPI() {
    // Prepare optimized payload
    const productOrders = state.featuredProducts.map((product, index) => ({
        product_id: product.id,
        display_order: index + 1
    }));
    
    console.log('📡 Executing smart reorder API...');
    console.log('📦 Products count:', productOrders.length);
    console.log('📋 Product orders:', productOrders);
    
    const requestBody = { product_orders: productOrders };
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${FEATURED_CONFIG.API_URL}?action=reorderFeaturedProducts`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('session_token')}`
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log('📊 Response status:', response.status);
    
    const data = await response.json();
    console.log('📥 Response data:', data);
    
    if (!data.success) {
        throw new Error(data.error || 'Reorder API failed');
    }
    
    // Clear cache for instant shop page update
    localStorage.removeItem('featured_products_cache');
    console.log('🗑️ Cache cleared for instant shop update');
    
    return data;
}

// ============================================
// BULK ACTIONS FOR FEATURED PRODUCTS
// ============================================
function toggleFeaturedProductSelection(productId) {
    console.log('🔄 Toggling selection for product:', productId);
    const index = state.selectedFeaturedProducts.indexOf(productId);
    
    if (index > -1) {
        // Bỏ chọn
        state.selectedFeaturedProducts.splice(index, 1);
        console.log('❌ Deselected product:', productId);
    } else {
        // Chọn
        state.selectedFeaturedProducts.push(productId);
        console.log('✅ Selected product:', productId);
    }
    
    console.log('📊 Current selection:', state.selectedFeaturedProducts);
    
    // Update UI
    updateBulkActionUI();
    renderFeaturedProducts(); // Re-render để update checkbox states
}

function selectAllFeaturedProducts() {
    state.selectedFeaturedProducts = [...state.featuredProducts.map(p => p.id)];
    updateBulkActionUI();
    renderFeaturedProducts();
}

function deselectAllFeaturedProducts() {
    state.selectedFeaturedProducts = [];
    updateBulkActionUI();
    renderFeaturedProducts();
}

function updateBulkActionUI() {
    const count = state.selectedFeaturedProducts.length;
    const totalCount = state.featuredProducts.length;
    
    console.log('🔄 Updating bulk action UI:', { count, totalCount, selected: state.selectedFeaturedProducts });
    
    // Update bulk action bar visibility
    const bulkActionBar = document.getElementById('bulkActionBar');
    const mainContent = document.querySelector('main');
    
    if (bulkActionBar) {
        if (count > 0) {
            console.log('✅ Showing bulk action bar');
            bulkActionBar.classList.remove('hidden');
            bulkActionBar.classList.add('show');
            
            // Add padding to main content to prevent overlap
            if (mainContent) {
                mainContent.classList.add('main-content-with-bulk-bar');
            }
            
            const selectedCountElement = bulkActionBar.querySelector('#selectedCount');
            if (selectedCountElement) {
                selectedCountElement.textContent = count;
            }
        } else {
            console.log('❌ Hiding bulk action bar');
            bulkActionBar.classList.remove('show');
            bulkActionBar.classList.add('hidden');
            
            // Remove padding from main content
            if (mainContent) {
                mainContent.classList.remove('main-content-with-bulk-bar');
            }
        }
    } else {
        console.error('❌ Bulk action bar element not found');
    }
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        if (count === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (count === totalCount) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
}

async function bulkRemoveFeaturedProducts() {
    if (state.selectedFeaturedProducts.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 sản phẩm để xóa', 'warning');
        return;
    }
    
    const count = state.selectedFeaturedProducts.length;
    if (!confirm(`Bạn có chắc muốn xóa ${count} sản phẩm khỏi danh sách nổi bật?`)) {
        return;
    }
    
    // Disable bulk action button to prevent double-click
    const bulkRemoveBtn = document.querySelector('button[onclick="bulkRemoveFeaturedProducts()"]');
    if (bulkRemoveBtn) {
        bulkRemoveBtn.disabled = true;
        bulkRemoveBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Đang xóa...</span>
        `;
    }
    
    try {
        const response = await fetch(`${FEATURED_CONFIG.API_URL}?action=removeMultipleFeaturedProducts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({ product_ids: state.selectedFeaturedProducts })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ ${data.message}`, 'success', 3000);
            
            // Clear featured products cache for shop page
            localStorage.removeItem('featured_products_cache');
            console.log('🗑️ Cleared featured products cache');
            
            // Reset selection
            state.selectedFeaturedProducts = [];
            updateBulkActionUI();
            
            // Reload data
            await loadFeaturedData();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('❌ Bulk remove featured failed:', error);
        showToast(`❌ Lỗi xóa sản phẩm: ${error.message}`, 'error');
    } finally {
        // Re-enable bulk action button
        if (bulkRemoveBtn) {
            bulkRemoveBtn.disabled = false;
            bulkRemoveBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Xóa khỏi nổi bật</span>
            `;
        }
    }
}

// ============================================
// MULTI-SELECT FUNCTIONALITY
// ============================================
function toggleProductSelection(productId) {
    const index = state.selectedProducts.indexOf(productId);
    
    if (index > -1) {
        // Bỏ chọn
        state.selectedProducts.splice(index, 1);
    } else {
        // Chọn
        state.selectedProducts.push(productId);
    }
    
    // Update UI
    updateSelectionUI();
    renderAvailableProducts(); // Re-render để update checkbox states
}

function updateSelectionUI() {
    const count = state.selectedProducts.length;
    
    // Update counter in header
    const counter = document.getElementById('selectedCounter');
    if (counter) {
        counter.textContent = `(Đã chọn: ${count})`;
    }
    
    // Update button in footer
    const addBtn = document.getElementById('addSelectedBtn');
    if (addBtn) {
        addBtn.textContent = `Thêm ${count} sản phẩm`;
        addBtn.disabled = count === 0;
    }
}

async function addSelectedProducts() {
    if (state.selectedProducts.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 sản phẩm', 'warning');
        return;
    }
    
    const count = state.selectedProducts.length;
    
    // Disable add button to prevent double-click
    const addBtn = document.getElementById('addSelectedBtn');
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Đang thêm...
        `;
    }
    
    try {
        const response = await fetch(`${FEATURED_CONFIG.API_URL}?action=addMultipleFeaturedProducts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({ product_ids: state.selectedProducts })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ ${data.message}`, 'success');
            
            // Clear featured products cache for shop page
            localStorage.removeItem('featured_products_cache');
            console.log('🗑️ Cleared featured products cache');
            
            // Reset selection
            state.selectedProducts = [];
            updateSelectionUI();
            
            // Close modal and reload data
            closeProductModal();
            await loadFeaturedData();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('❌ Add multiple featured failed:', error);
        showToast(`❌ Lỗi thêm sản phẩm: ${error.message}`, 'error');
    } finally {
        // Re-enable add button
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = `Thêm ${count} sản phẩm`;
        }
    }
}

// ============================================
// FEATURED PRODUCTS MANAGEMENT
// ============================================
async function addFeaturedProduct(productId) {
    if (state.featuredProducts.length >= FEATURED_CONFIG.MAX_FEATURED) {
        showToast(`Tối đa ${FEATURED_CONFIG.MAX_FEATURED} sản phẩm nổi bật`, 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${FEATURED_CONFIG.API_URL}?action=addFeaturedProduct`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({ product_id: productId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Đã thêm vào nổi bật', 'success');
            
            // Clear featured products cache for shop page
            localStorage.removeItem('featured_products_cache');
            console.log('🗑️ Cleared featured products cache');
            
            // Reload data to get updated lists
            await loadFeaturedData();
            
            // Update modal if it's open
            const modal = document.getElementById('productModal');
            if (!modal.classList.contains('hidden')) {
                renderCategoryTabs();
                applyFilters();
                renderAvailableProducts();
            }
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('❌ Add featured failed:', error);
        showToast('Lỗi thêm sản phẩm: ' + error.message, 'error');
    }
}

async function removeFeaturedProduct(productId) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này khỏi danh sách nổi bật?')) {
        return;
    }
    
    // Find and disable the remove button to prevent double-click
    const removeBtn = document.querySelector(`button[onclick="removeFeaturedProduct(${productId})"]`);
    if (removeBtn) {
        removeBtn.disabled = true;
        removeBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        `;
    }
    
    try {
        const response = await fetch(`${FEATURED_CONFIG.API_URL}?action=removeFeaturedProduct`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('session_token')}`
            },
            body: JSON.stringify({ product_id: productId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Đã xóa khỏi nổi bật', 'success');
            
            // Clear featured products cache for shop page
            localStorage.removeItem('featured_products_cache');
            console.log('🗑️ Cleared featured products cache');
            
            // Reload data
            await loadFeaturedData();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('❌ Remove featured failed:', error);
        showToast(`❌ Lỗi xóa sản phẩm: ${error.message}`, 'error');
    } finally {
        // Re-enable button (will be replaced when data reloads, but good practice)
        if (removeBtn) {
            removeBtn.disabled = false;
            removeBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            `;
        }
    }
}

// ============================================
// UI STATE MANAGEMENT
// ============================================
function showLoadingState() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
}

function hideLoadingState() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
}

function showErrorState() {
    // TODO: Implement error state UI
}

function updateFeaturedCount(stats) {
    if (!stats) return;
    
    // Update stats cards only
    document.getElementById('statsFeaturedCount').textContent = stats.featured_count;
    document.getElementById('statsAvailableSlots').textContent = stats.available_slots;
    document.getElementById('statsTotalProducts').textContent = stats.total_products;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(state.searchTimeout);
            func(...args);
        };
        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(later, wait);
    };
}

function handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + R: Refresh data
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        loadFeaturedData();
    }
}

// ============================================
// ADMIN ACTIONS
// ============================================
function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_info');
        window.location.href = '../login.html';
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 slide-up`;
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOut 0.3s ease-in-out';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

function handleSelectAllChange() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (selectAllCheckbox.checked) {
        selectAllFeaturedProducts();
    } else {
        deselectAllFeaturedProducts();
    }
}

// ============================================
// GLOBAL FUNCTIONS - OPTIMIZED EXPORTS
// ============================================
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.loadFeaturedData = loadFeaturedData;
window.addFeaturedProduct = addFeaturedProduct;
window.removeFeaturedProduct = removeFeaturedProduct;
window.selectCategory = selectCategory;
window.toggleProductSelection = toggleProductSelection;
window.addSelectedProducts = addSelectedProducts;
window.toggleFeaturedProductSelection = toggleFeaturedProductSelection;
window.selectAllFeaturedProducts = selectAllFeaturedProducts;
window.deselectAllFeaturedProducts = deselectAllFeaturedProducts;
window.bulkRemoveFeaturedProducts = bulkRemoveFeaturedProducts;
window.handleSelectAllChange = handleSelectAllChange;
window.moveProductUp = moveProductUp; // 🚀 NEW
window.moveProductDown = moveProductDown; // 🚀 NEW
window.logout = logout;