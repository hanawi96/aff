/* ============================================
   PRODUCTS PAGE LOGIC
   ============================================ */

// State
let allProducts = [];
let filteredProducts = [];
let allCategories = [];
let currentPage = 1;
const productsPerPage = APP_CONFIG.PRODUCTS_PER_PAGE;

// Filters
let filters = {
    category: null,
    priceRange: 'all',
    search: '',
    sort: 'default'
};

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts();
    setupFilters();
    setupSearch();
    
    // Check URL parameters
    checkUrlParams();
});

// Check URL parameters
function checkUrlParams() {
    const categoryId = utils.getQueryParam('category');
    const searchQuery = utils.getQueryParam('search');
    const sortBy = utils.getQueryParam('sort');
    
    if (categoryId) {
        filters.category = parseInt(categoryId);
        updateBreadcrumb();
    }
    
    if (searchQuery) {
        filters.search = searchQuery;
        document.getElementById('searchInput').value = searchQuery;
        document.getElementById('mobileSearchInput').value = searchQuery;
    }
    
    if (sortBy) {
        filters.sort = sortBy;
        document.getElementById('sortSelect').value = sortBy;
    }
    
    applyFilters();
}

// Update breadcrumb
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumbCurrent');
    if (filters.category) {
        const category = allCategories.find(c => c.id === filters.category);
        if (category) {
            breadcrumb.textContent = category.name;
        }
    } else if (filters.search) {
        breadcrumb.textContent = `Tìm kiếm: "${filters.search}"`;
    } else {
        breadcrumb.textContent = 'Sản phẩm';
    }
}

// Load categories
async function loadCategories() {
    try {
        const response = await api.getAllCategories();
        
        if (response.success && response.categories) {
            allCategories = response.categories;
            renderCategoryFilters(allCategories);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Render category filters
function renderCategoryFilters(categories) {
    const container = document.getElementById('categoryFilters');
    
    const html = `
        <label class="filter-option">
            <input type="radio" name="category" value="all" ${!filters.category ? 'checked' : ''}>
            <span>Tất cả</span>
        </label>
        ${categories.map(category => `
            <label class="filter-option">
                <input type="radio" name="category" value="${category.id}" ${filters.category === category.id ? 'checked' : ''}>
                <span>${category.icon || '📦'} ${category.name}</span>
            </label>
        `).join('')}
    `;
    
    container.innerHTML = html;
}

// Load products
async function loadProducts() {
    try {
        const productsGrid = document.getElementById('productsGrid');
        utils.showLoading(productsGrid);
        
        const response = await api.getAllProducts();
        
        if (response.success && response.products) {
            allProducts = response.products;
            applyFilters();
        } else {
            showEmptyState('Không có sản phẩm nào');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showEmptyState('Lỗi khi tải sản phẩm');
    }
}

// Apply filters
function applyFilters() {
    filteredProducts = [...allProducts];
    
    // Filter by category
    if (filters.category) {
        filteredProducts = filteredProducts.filter(product => {
            return product.category_ids && product.category_ids.includes(filters.category);
        });
    }
    
    // Filter by price range
    if (filters.priceRange !== 'all') {
        const [min, max] = filters.priceRange.split('-').map(Number);
        filteredProducts = filteredProducts.filter(product => {
            return product.price >= min && product.price <= max;
        });
    }
    
    // Filter by search
    if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredProducts = filteredProducts.filter(product => {
            return product.name.toLowerCase().includes(searchLower) ||
                   (product.description && product.description.toLowerCase().includes(searchLower));
        });
    }
    
    // Sort products
    sortProducts();
    
    // Reset to page 1
    currentPage = 1;
    
    // Update UI
    updateProductsCount();
    renderProducts();
    renderPagination();
    updateBreadcrumb();
}

// Sort products
function sortProducts() {
    switch (filters.sort) {
        case 'price-asc':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name-asc':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'popular':
            filteredProducts.sort((a, b) => (b.purchases || 0) - (a.purchases || 0));
            break;
        default:
            // Default sorting (by ID)
            filteredProducts.sort((a, b) => b.id - a.id);
    }
}

// Update products count
function updateProductsCount() {
    const countEl = document.getElementById('productsCount');
    countEl.textContent = filteredProducts.length;
}

// Render products
function renderProducts() {
    const productsGrid = document.getElementById('productsGrid');
    
    if (filteredProducts.length === 0) {
        showEmptyState('Không tìm thấy sản phẩm nào');
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);
    
    productsGrid.innerHTML = productsToShow.map(product => `
        <div class="product-card" onclick="goToProduct(${product.id})">
            <div class="product-image-wrapper">
                <img src="${utils.getImageUrl(product.image_url)}" 
                     alt="${product.name}" 
                     class="product-image"
                     onerror="this.src='${APP_CONFIG.PLACEHOLDER_IMAGE}'">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price-wrapper">
                    <span class="product-price">${utils.formatCurrency(product.price)}</span>
                </div>
                ${product.rating > 0 ? `
                    <div class="product-rating">
                        <span class="product-rating-stars">⭐</span>
                        <span>${product.rating.toFixed(1)} (${product.purchases || 0})</span>
                    </div>
                ` : ''}
                <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart(${product.id})">
                    🛒 Thêm vào giỏ
                </button>
            </div>
        </div>
    `).join('');
}

// Show empty state
function showEmptyState(message) {
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3 class="empty-state-title">${message}</h3>
            <p class="empty-state-text">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc</p>
            <button class="btn btn-primary" onclick="clearFilters()">Xóa bộ lọc</button>
        </div>
    `;
    
    document.getElementById('pagination').innerHTML = '';
}

// Render pagination
function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `
        <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            ‹ Trước
        </button>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding: 0 8px; color: var(--gray-400);">...</span>`;
        }
    }
    
    // Next button
    html += `
        <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Sau ›
        </button>
    `;
    
    pagination.innerHTML = html;
}

// Go to page
function goToPage(page) {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderProducts();
    renderPagination();
    utils.scrollToTop();
}

// Setup filters
function setupFilters() {
    // Category filter
    document.addEventListener('change', (e) => {
        if (e.target.name === 'category') {
            filters.category = e.target.value === 'all' ? null : parseInt(e.target.value);
            applyFilters();
        }
        
        if (e.target.name === 'priceRange') {
            filters.priceRange = e.target.value;
            applyFilters();
        }
    });
    
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.addEventListener('change', (e) => {
        filters.sort = e.target.value;
        applyFilters();
    });
}

// Setup search
function setupSearch() {
    const searchInputs = [
        document.getElementById('searchInput'),
        document.getElementById('mobileSearchInput')
    ];
    
    const handleSearch = utils.debounce((query) => {
        filters.search = query.trim();
        applyFilters();
    }, 500);
    
    searchInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                handleSearch(e.target.value);
            });
        }
    });
}

// Clear filters
function clearFilters() {
    filters = {
        category: null,
        priceRange: 'all',
        search: '',
        sort: 'default'
    };
    
    // Reset UI
    document.querySelectorAll('input[name="category"]').forEach(input => {
        input.checked = input.value === 'all';
    });
    
    document.querySelectorAll('input[name="priceRange"]').forEach(input => {
        input.checked = input.value === 'all';
    });
    
    document.getElementById('searchInput').value = '';
    document.getElementById('mobileSearchInput').value = '';
    document.getElementById('sortSelect').value = 'default';
    
    // Clear URL params
    window.history.pushState({}, '', window.location.pathname);
    
    applyFilters();
}

// Add to cart
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        cart.addItem(product, 1);
    }
}

// Go to product detail
function goToProduct(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}
