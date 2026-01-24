/* ============================================
   HOME PAGE LOGIC
   ============================================ */

// State
let allProducts = [];
let allCategories = [];
let activeFlashSale = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts();
    await loadFlashSales();
    setupSearch();
    
    // Check for referral code in URL
    checkReferralCode();
});

// Load categories
async function loadCategories() {
    try {
        console.log('🔄 Loading categories from API...');
        const categoriesGrid = document.getElementById('categoriesGrid');
        utils.showLoading(categoriesGrid);

        const response = await api.getAllCategories();
        console.log('📂 Categories response:', response);
        
        if (response.success && response.categories) {
            allCategories = response.categories;
            console.log('✅ Categories loaded:', allCategories.length);
            renderCategories(allCategories);
        } else {
            console.error('❌ No categories in response');
            categoriesGrid.innerHTML = '<p style="text-align: center; color: var(--gray-600); font-size: 16px;">Không có danh mục nào</p>';
        }
    } catch (error) {
        console.error('❌ Error loading categories:', error);
        const categoriesGrid = document.getElementById('categoriesGrid');
        categoriesGrid.innerHTML = '<p style="text-align: center; color: var(--error-red); font-size: 16px;">Lỗi khi tải danh mục</p>';
    }
}

// Render categories
function renderCategories(categories) {
    const categoriesGrid = document.getElementById('categoriesGrid');
    
    if (!categories || categories.length === 0) {
        categoriesGrid.innerHTML = '<p style="text-align: center; color: var(--gray-600); font-size: 16px;">Không có danh mục nào</p>';
        return;
    }

    categoriesGrid.innerHTML = categories.map(category => `
        <a href="products.html?category=${category.id}" class="category-card">
            <div class="category-icon">${category.icon || '📦'}</div>
            <div class="category-name">${category.name}</div>
        </a>
    `).join('');
}

// Load products
async function loadProducts() {
    try {
        console.log('🔄 Loading products from API...');
        console.log('API URL:', API_CONFIG.BASE_URL);
        
        const response = await api.getAllProducts();
        console.log('📦 API Response:', response);
        
        if (response.success && response.products) {
            allProducts = response.products;
            console.log('✅ Products loaded:', allProducts.length);
            
            // Render best sellers (products with highest purchases)
            const bestSellers = [...allProducts]
                .sort((a, b) => (b.purchases || 0) - (a.purchases || 0))
                .slice(0, 8);
            console.log('⭐ Best sellers:', bestSellers.length);
            renderProducts(bestSellers, 'bestSellersGrid');
            
            // Render new products (latest 8)
            const newProducts = [...allProducts]
                .slice(0, 8);
            console.log('🆕 New products:', newProducts.length);
            renderProducts(newProducts, 'newProductsGrid');
        } else {
            console.error('❌ No products in response');
        }
    } catch (error) {
        console.error('❌ Error loading products:', error);
        utils.showToast('Lỗi khi tải sản phẩm', 'error');
    }
}

// Load flash sales
async function loadFlashSales() {
    try {
        const response = await api.getActiveFlashSales();
        
        if (response.success && response.flashSales && response.flashSales.length > 0) {
            activeFlashSale = response.flashSales[0];
            
            // Show flash sales section
            const flashSalesSection = document.getElementById('flashSalesSection');
            flashSalesSection.style.display = 'block';
            
            // Start countdown
            startCountdown(activeFlashSale.end_time);
            
            // Load flash sale products
            await loadFlashSaleProducts(activeFlashSale.id);
        }
    } catch (error) {
        console.error('Error loading flash sales:', error);
    }
}

// Load flash sale products
async function loadFlashSaleProducts(flashSaleId) {
    try {
        const response = await api.getFlashSale(flashSaleId);
        
        if (response.success && response.flashSale && response.flashSale.products) {
            renderFlashSaleProducts(response.flashSale.products);
        }
    } catch (error) {
        console.error('Error loading flash sale products:', error);
    }
}

// Render flash sale products
function renderFlashSaleProducts(products) {
    const container = document.getElementById('flashSaleProducts');
    
    if (!products || products.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-600); font-size: 16px; width: 100%;">Không có sản phẩm flash sale</p>';
        return;
    }

    container.innerHTML = products.map(product => {
        const discountPercent = utils.calculateDiscountPercentage(product.original_price, product.flash_price);
        const soldPercent = product.stock_limit ? Math.round((product.sold_count / product.stock_limit) * 100) : 0;
        
        return `
            <div class="product-card" style="min-width: 280px; max-width: 280px;" onclick="goToProduct(${product.product_id})">
                <div class="product-image-wrapper">
                    <img src="${utils.getImageUrl(product.image_url)}" 
                         alt="${product.name}" 
                         class="product-image"
                         onerror="this.src='${APP_CONFIG.PLACEHOLDER_IMAGE}'">
                    <div class="product-badge">-${discountPercent}%</div>
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price-wrapper">
                        <span class="product-price">${utils.formatCurrency(product.flash_price)}</span>
                        <span class="product-original-price">${utils.formatCurrency(product.original_price)}</span>
                    </div>
                    ${product.stock_limit ? `
                        <div style="margin-top: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 16px; color: var(--gray-600); margin-bottom: 4px;">
                                <span>Đã bán ${product.sold_count}/${product.stock_limit}</span>
                                <span>${soldPercent}%</span>
                            </div>
                            <div style="height: 8px; background: var(--gray-200); border-radius: 999px; overflow: hidden;">
                                <div style="height: 100%; width: ${soldPercent}%; background: linear-gradient(90deg, var(--flash-sale), #FF5252); transition: width 0.3s;"></div>
                            </div>
                        </div>
                    ` : ''}
                    <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart(${product.product_id}, '${product.name}', ${product.flash_price}, ${product.original_price}, '${product.image_url}', true)">
                        🛒 Thêm vào giỏ
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Render products
function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    
    if (!products || products.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-600); font-size: 16px; grid-column: 1/-1;">Không có sản phẩm nào</p>';
        return;
    }

    container.innerHTML = products.map(product => `
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
                <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart(${product.id}, '${product.name}', ${product.price}, ${product.price}, '${product.image_url}', false)">
                    🛒 Thêm vào giỏ
                </button>
            </div>
        </div>
    `).join('');
}

// Start countdown timer
function startCountdown(endTime) {
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    
    function updateCountdown() {
        const now = Math.floor(Date.now() / 1000);
        const diff = endTime - now;
        
        if (diff <= 0) {
            // Flash sale ended
            document.getElementById('flashSalesSection').style.display = 'none';
            return;
        }
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Add to cart
function addToCart(id, name, price, originalPrice, image, isFlashSale) {
    const product = {
        id,
        name,
        price,
        originalPrice,
        image_url: image,
        flash_price: isFlashSale ? price : null
    };
    
    cart.addItem(product, 1);
}

// Go to product detail
function goToProduct(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}

// Setup search
function setupSearch() {
    const searchInputs = [
        document.getElementById('searchInput'),
        document.getElementById('mobileSearchInput')
    ];
    
    searchInputs.forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        window.location.href = `products.html?search=${encodeURIComponent(query)}`;
                    }
                }
            });
        }
    });
}

// Check for referral code in URL
function checkReferralCode() {
    const refCode = utils.getQueryParam('ref');
    if (refCode) {
        // Save to localStorage
        localStorage.setItem(APP_CONFIG.REFERRAL_CODE_KEY, refCode);
        utils.showToast('Đã áp dụng mã giới thiệu!', 'success');
        
        // Remove from URL
        utils.removeQueryParam('ref');
    }
}
