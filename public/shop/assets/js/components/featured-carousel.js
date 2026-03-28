// Featured Products Carousel - Siêu mượt và nhẹ
// Component hiển thị sản phẩm nổi bật với performance cao

class FeaturedCarousel {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            autoPlay: true,
            autoPlayDelay: 4000,
            showDots: true,
            showArrows: true,
            itemsPerView: {
                mobile: 1,
                tablet: 2,
                desktop: 4
            },
            gap: 16,
            ...options
        };
        
        this.state = {
            products: [],
            currentIndex: 0,
            isLoading: false,
            autoPlayTimer: null,
            isAutoPlaying: false
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Featured Carousel...');
        if (!this.container) {
            console.error('❌ Featured carousel container not found');
            return;
        }
        
        console.log('✅ Container found:', this.container);
        console.log('   Container ID:', this.container.id);
        console.log('   Container classes:', this.container.className);
        console.log('   Container parent:', this.container.parentElement);
        console.log('   Container visible:', this.container.offsetWidth > 0 && this.container.offsetHeight > 0);
        
        this.createStructure();
        this.setupEventListeners();
        await this.loadProducts();
    }
    
    createStructure() {
        this.container.innerHTML = `
            <div class="featured-products-grid">
                <!-- Header -->
                <div class="text-center mb-8">
                    <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                        Sản phẩm
                    </h2>
                    <h3 class="font-handwritten text-primary text-4xl md:text-5xl mb-4">
                        nổi bật
                    </h3>
                    <!-- Handmade divider with star -->
                    <div class="flex items-center justify-center gap-2 my-6">
                        <div class="w-24 h-0.5 bg-gradient-to-r from-transparent to-primary/30"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="text-primary" style="width: 0.875rem; height: 0.875rem;"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" /></svg>
                        <div class="w-24 h-0.5 bg-gradient-to-l from-transparent to-primary/30"></div>
                    </div>
                    <p class="text-gray-600 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">
                        Những sản phẩm được chọn lọc đặc biệt, được nhiều mẹ tin dùng và yêu thích nhất
                    </p>
                </div>
                
                <!-- Loading State (cùng style với placeholder HTML trang chủ + shop-skeleton-grid) -->
                <div id="loadingState" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 shop-skeleton-grid">
                    ${Array(4).fill(0).map(() => this.createSkeletonCard()).join('')}
                </div>
                
                <!-- Products Grid (ID riêng — không dùng productsGrid để tránh trùng với lưới "yêu thích nhất" / load more) -->
                <div id="featuredCarouselProductsGrid" class="hidden grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                    <!-- Products will be inserted here -->
                </div>
                
                <!-- Empty State -->
                <div id="emptyState" class="hidden text-center py-12">
                    <div class="text-6xl mb-4">🌟</div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Chưa có sản phẩm nổi bật</h3>
                    <p class="text-gray-500">Các sản phẩm hot nhất sẽ xuất hiện tại đây</p>
                </div>
            </div>
        `;
        
        // Cache DOM elements
        this.elements = {
            loadingState: this.container.querySelector('#loadingState'),
            productsGrid: this.container.querySelector('#featuredCarouselProductsGrid'),
            emptyState: this.container.querySelector('#emptyState')
        };
    }
    
    createSkeletonCard() {
        return `
            <div class="skeleton-product-card skeleton-loading">
                <div class="skeleton-product-image"></div>
                <div class="skeleton-product-info">
                    <div class="skeleton skeleton-product-title"></div>
                    <div class="skeleton skeleton-product-meta"></div>
                    <div class="skeleton skeleton-product-price"></div>
                    <div class="skeleton skeleton-product-button"></div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // No carousel functionality needed for grid layout
        // Just basic responsive handling
        window.addEventListener('resize', this.debounce(() => this.handleResize(), 250));
        
        // Intersection Observer for performance
        this.setupIntersectionObserver();
    }
    
    setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Grid is visible, no special action needed
                } else {
                    // Grid is not visible
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(this.container);
    }
    
    async loadProducts() {
        console.log('📡 Starting to load featured products...');
        this.state.isLoading = true;
        this.showLoading();
        
        try {
            // Check cache first
            const cached = this.getCachedProducts();
            if (cached) {
                console.log('📦 Using cached featured products:', cached.length);
                this.state.products = cached;
                this.renderProducts();
                return;
            }
            
            console.log('📡 Fetching featured products from API...');
            // Use the same API URL detection as the main config
            const apiUrl = (() => {
                if (window.location.port === '5500' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    return 'http://127.0.0.1:8787';
                }
                return 'https://ctv-api.yendev96.workers.dev';
            })();
            
            console.log('🌐 API URL:', `${apiUrl}?action=getFeaturedProducts`);
            const response = await fetch(`${apiUrl}?action=getFeaturedProducts`);
            console.log('📡 Response status:', response.status);
            
            const data = await response.json();
            console.log('📦 API Response:', data);
            
            if (data.success && data.products) {
                console.log(`✅ Loaded ${data.products.length} featured products`);
                this.state.products = data.products;
                this.cacheProducts(data.products);
                this.renderProducts();
            } else {
                console.error('❌ API returned error:', data.error);
                throw new Error(data.error || 'Failed to load products');
            }
            
        } catch (error) {
            console.error('❌ Error loading featured products:', error);
            this.showEmpty();
        } finally {
            this.state.isLoading = false;
        }
    }
    
    renderProducts() {
        console.log('🎨 Rendering products...');
        console.log('   Products to render:', this.state.products.length);
        console.log('   Products data:', this.state.products);
        
        if (this.state.products.length === 0) {
            console.log('⚠️ No products to render, showing empty state');
            this.showEmpty();
            return;
        }
        
        this.hideLoading();
        
        // Render product cards in grid
        const grid = this.elements.productsGrid;
        console.log('   Grid element:', grid);
        
        const cardsHtml = this.state.products.map(product => this.createProductCard(product)).join('');
        console.log('   Generated HTML length:', cardsHtml.length);
        
        grid.innerHTML = cardsHtml;
        console.log('   Grid innerHTML set, length:', grid.innerHTML.length);
        
        // Show grid
        this.elements.productsGrid.classList.remove('hidden');
        if (this.container) {
            this.container.setAttribute('aria-busy', 'false');
        }
        console.log('✅ Products rendered and grid shown');
        console.log('   Grid classes:', this.elements.productsGrid.className);
        console.log('   Grid visible:', this.elements.productsGrid.offsetWidth > 0 && this.elements.productsGrid.offsetHeight > 0);
    }
    
    createProductCard(product) {
        try {
            console.log('🎨 Creating card for product:', product.id, product.name);
            
            // Use exact same format as regular product cards
            const formatPrice = (price) => {
                return new Intl.NumberFormat('vi-VN', {
                    style: 'currency',
                    currency: 'VND'
                }).format(price);
            };
            
            const escapeHtml = (text) => {
                if (!text) return '';
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };
            
            const calculateDiscount = (originalPrice, currentPrice) => {
                if (!originalPrice || originalPrice <= currentPrice) return 0;
                return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
            };
            
            const discount = calculateDiscount(product.original_price, product.price);
            const rating = product.rating || 4.5;
            const purchases = product.purchases || 0;
            const imageUrl = product.image_url || '/assets/images/no-image.jpg';
            const savedAmount = product.original_price && product.original_price > product.price
                ? product.original_price - product.price
                : 0;

            // Stock status (UI disable + badge)
            const rawStock = product.stock_quantity ?? product.stockQuantity;
            const stockQty =
                rawStock === undefined || rawStock === null
                    ? null
                    : (typeof rawStock === 'string'
                        ? parseInt(rawStock.replace(/[^\d-]/g, ''), 10)
                        : Number(rawStock));
            const isOutOfStock = stockQty !== null && Number.isFinite(stockQty) && stockQty <= 0;
            
            // Check badges - only hide for "Bi, charm bạc" category (ID 24)
            const isBiCharmBac = product.categories?.some(cat => 
                (cat.id === 24 || cat.category_id === 24)
            );
            
            const hasHandmadeBadge = !isBiCharmBac && (product.is_handmade === 1 || product.tags?.includes('handmade'));
            const hasChemicalFreeBadge = !isBiCharmBac && (product.is_chemical_free === 1 || product.tags?.includes('chemical-free'));
            const hasSilverBadge = isBiCharmBac;
            
            // Check if product should show "bạc thật" mini badge next to rating
            const EXCLUDE_SILVER_MINI_BADGE_CATEGORIES = [13, 16, 20, 23];
            const EXCLUDE_SILVER_MINI_BADGE_PRODUCTS = [8, 26, 79];
            
            const hasExcludedCategory = product.categories?.some(cat => 
                EXCLUDE_SILVER_MINI_BADGE_CATEGORIES.includes(cat.id || cat.category_id)
            );
            
            const isExcludedProduct = EXCLUDE_SILVER_MINI_BADGE_PRODUCTS.includes(product.id);
            const showSilverMiniBadge = !hasExcludedCategory && !isExcludedProduct;
            
            // Check if product is favorited
            const isFavorited = product.is_favorited === 1 || product.is_favorited === true;
            const favoritedClass = isFavorited ? 'favorited' : '';
            
            const shouldShowMarketingBadges = !isOutOfStock;

            return `
                <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-product-id="${product.id}">
                    <div class="product-image-wrapper">
                        <div class="product-image-container">
                            <img src="${imageUrl}" 
                                 alt="${escapeHtml(product.name)}" 
                                 class="product-image"
                                 loading="lazy"
                                 onclick="window.previewProductImage && window.previewProductImage('${imageUrl.replace(/'/g, "\\'")}', '${escapeHtml(product.name).replace(/'/g, "\\'")}', ${product.id}, {price: ${product.price}, originalPrice: ${product.original_price || product.price}, discountPercent: ${discount}})"
                                 onerror="this.src='/assets/images/no-image.jpg'">
                        </div>
                        ${isOutOfStock ? `<span class="product-badge out-of-stock">Hết hàng</span>` : ''}
                        ${shouldShowMarketingBadges && discount > 0 ? `<span class="product-badge sale">-${discount}%</span>` : ''}
                        ${shouldShowMarketingBadges && hasHandmadeBadge ? `<span class="product-badge handmade">Thủ công 100%</span>` : ''}
                        ${shouldShowMarketingBadges && hasChemicalFreeBadge ? `<span class="product-badge chemical-free">Không hóa chất</span>` : ''}
                        ${shouldShowMarketingBadges && hasSilverBadge ? `<span class="product-badge silver-guarantee"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>Bạc thật 100%</span>` : ''}
                        <div class="product-favorites-section">
                            <button class="product-favorites-btn ${favoritedClass}" onclick="window.productActions && window.productActions.toggleFavorite(${product.id})" title="Yêu thích" data-product-id="${product.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" style="width: 0.8rem; height: 0.8rem;"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" /></svg>
                                <span class="favorites-count">${product.favorites_count || 0}</span>
                            </button>
                        </div>
                    </div>
                    <div class="product-info">
                        <h3 class="product-name" onclick="window.previewProductImage && window.previewProductImage('${imageUrl.replace(/'/g, "\\'")}', '${escapeHtml(product.name).replace(/'/g, "\\'")}', ${product.id}, {price: ${product.price}, originalPrice: ${product.original_price || product.price}, discountPercent: ${discount}})" style="cursor: pointer;">${escapeHtml(product.name)}</h3>
                        <div class="product-rating">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="rating-star"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" /></svg>
                            <span class="rating-score">${rating.toFixed(1)}</span>
                            <span class="rating-count">(${purchases})</span>
                            ${showSilverMiniBadge ? '<span class="silver-mini-badge"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 0.75rem; height: 0.75rem; display: inline-block; vertical-align: middle; margin-right: 0.2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>Bạc thật</span>' : ''}
                        </div>
                        <div class="product-price-wrapper">
                            <div class="product-price">
                                <span class="current-price">${formatPrice(product.price)}</span>
                                ${product.original_price && product.original_price > product.price 
                                    ? `<span class="original-price">${formatPrice(product.original_price)}</span>` 
                                    : ''}
                            </div>
                            ${savedAmount > 0 ? `
                                <div class="price-save-info">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block;"><path fill-rule="evenodd" d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 0 0 5.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 0 0-2.122-.879H5.25ZM6.375 7.5a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" /></svg>
                                    <span>Tiết kiệm ${formatPrice(savedAmount)}</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="product-button-actions">
                            <button class="bundle-btn-primary" ${isOutOfStock ? 'disabled aria-disabled="true"' : ''} onclick="window.productActions && window.productActions.buyNow(${product.id})" ${isOutOfStock ? 'title="Hết hàng"' : ''}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>
                                <span>Mua ngay</span>
                            </button>
                            <button class="bundle-btn-cart" ${isOutOfStock ? 'disabled aria-disabled="true"' : ''} onclick="window.productActions && window.productActions.addToCart(${product.id})" title="${isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('❌ Error creating product card for product:', product.id, error);
            // Return a simple fallback card
            return `
                <div class="product-card bg-white rounded-lg shadow-sm p-4">
                    <div class="text-center text-gray-500">
                        <p>Lỗi hiển thị sản phẩm</p>
                        <p class="text-sm">ID: ${product.id}</p>
                        <p class="text-xs">${product.name || 'Không có tên'}</p>
                    </div>
                </div>
            `;
        }
    }
    
    // State management
    showLoading() {
        this.elements.loadingState.classList.remove('hidden');
        this.elements.productsGrid.classList.add('hidden');
        this.elements.emptyState.classList.add('hidden');
    }
    
    hideLoading() {
        this.elements.loadingState.classList.add('hidden');
    }
    
    showEmpty() {
        this.elements.loadingState.classList.add('hidden');
        this.elements.productsGrid.classList.add('hidden');
        this.elements.emptyState.classList.remove('hidden');
        if (this.container) {
            this.container.setAttribute('aria-busy', 'false');
        }
    }
    
    handleResize() {
        // No special handling needed for grid layout
    }
    
    // Cache management
    getCachedProducts() {
        try {
            const cached = localStorage.getItem('featured_products_cache');
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const now = Date.now();
            
            if (now - data.timestamp > 5 * 60 * 1000) { // 5 minutes
                localStorage.removeItem('featured_products_cache');
                return null;
            }
            
            return data.products;
        } catch {
            return null;
        }
    }
    
    cacheProducts(products) {
        try {
            localStorage.setItem('featured_products_cache', JSON.stringify({
                products,
                timestamp: Date.now()
            }));
        } catch {
            // Ignore cache errors
        }
    }
    
    debounce(func, wait) {
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
    
    // Public API
    refresh() {
        return this.loadProducts();
    }
    
    destroy() {
        // Clean up if needed
    }
}

// Export for use
window.FeaturedCarousel = FeaturedCarousel;