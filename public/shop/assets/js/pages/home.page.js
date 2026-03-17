// ============================================
// HOME PAGE CONTROLLER
// ============================================

import { apiService } from '../shared/services/api.service.js';
import { cartService } from '../shared/services/cart.service.js';
import { ProductGrid, ProductActions } from '../features/products/index.js';
import { renderCategories, CategoryActions } from '../features/categories/index.js';
import { FlashSaleActions, FlashSaleTimer } from '../features/flash-sale/index.js';
import { QuickCheckout } from '../features/checkout/index.js';
import { BabyWeightModal } from '../shared/components/baby-weight-modal.js';
import { throttle, rafThrottle } from '../shared/utils/performance.js';
import { bundleProductsService } from '../shared/services/bundle-products.service.js';

/**
 * Home Page Manager
 */
export class HomePage {
    constructor() {
        this.products = [];
        this.allProducts = []; // All products for filtering
        this.categories = [];
        this.flashSales = [];
        this.currentPage = 1;
        this.hasMoreProducts = false;
        
        // Initialize components
        this.productGrid = null;
        this.productActions = null;
        this.categoryActions = null;
        this.flashSaleCarousel = null;
        this.flashSaleActions = null;
        this.flashSaleTimer = null;
        this.quickCheckout = null;
    }
    
    /**
     * Initialize home page
     */
    async init() {
        try {
            // Clean up old localStorage favorites (no longer used)
            localStorage.removeItem('product_favorites');
            
            // Check URL params
            const urlParams = new URLSearchParams(window.location.search);
            const checkoutParam = urlParams.get('checkout');
            const buyParam = urlParams.get('buy');
            const searchParam = urlParams.get('search');
            const filterParam = urlParams.get('filter');
            const categoryParam = urlParams.get('category');
            
            // Phase 1: Load critical above-the-fold content FIRST
            await this.loadCriticalContent();
            
            // Hide skeleton and show critical content
            this.showCriticalContent();
            
            // Phase 2: Load remaining content in background
            this.loadRemainingContent();
            
            // Phase 3: Pre-load bundle products for quick checkout (in background)
            this.preloadBundleProducts();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update cart UI
            this.updateCartUI();
            
            // Setup cart update listener
            this.setupCartUpdateListener();
            
            // Handle URL params (priority order)
            if (checkoutParam === 'cart') {
                // Coming from cart page
                setTimeout(() => {
                    this.openCheckoutFromCart();
                }, 500);
            } else if (buyParam) {
                // Direct buy link
                setTimeout(() => {
                    this.openQuickBuyFromURL(buyParam);
                }, 500);
            } else if (searchParam) {
                // Search from URL (higher priority than category)
                setTimeout(() => {
                    this.performSearchFromURL(searchParam, filterParam);
                }, 500);
            } else if (categoryParam) {
                // Category from URL
                setTimeout(() => {
                    this.filterByCategoryFromURL(categoryParam);
                }, 500);
            }
            
        } catch (error) {
            console.error('Home page initialization error:', error);
            this.showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại!');
        }
    }
    
    /**
     * Load critical above-the-fold content FIRST
     * Priority: ALL Products (for filtering) + Flash Sales
     */
    async loadCriticalContent() {
        // Load ALL products và flash sales song song
        const [allProducts, flashSales] = await Promise.all([
            apiService.getAllProducts(), // Load TẤT CẢ ngay từ đầu
            apiService.getActiveFlashSales()
        ]);
        
        this.allProducts = allProducts;
        this.products = allProducts; // Sync để tương thích
        this.flashSales = flashSales;
        
        console.log('✅ Critical content loaded:', {
            products: allProducts.length,
            flashSales: flashSales.length
        });
    }
    
    /**
     * Load remaining content in background (non-blocking)
     */
    async loadRemainingContent() {
        // Load categories (not critical, can wait)
        setTimeout(async () => {
            this.categories = await apiService.getAllCategories();
            this.renderCategories();
            this.hideCategoriesSkeleton();
        }, 100);
        
        // Không cần load products nữa vì đã load hết ở loadCriticalContent
    }
    
    /**
     * Pre-load bundle products for quick checkout (in background)
     * This ensures bundle products are cached and ready when user opens quick checkout modal
     */
    preloadBundleProducts() {
        setTimeout(async () => {
            try {
                console.log('📦 [HOME] Pre-loading bundle products for quick checkout...');
                await bundleProductsService.loadBundleProducts();
                console.log('✅ [HOME] Bundle products pre-loaded and cached');
            } catch (error) {
                console.error('❌ [HOME] Error pre-loading bundle products:', error);
                // Non-critical error, don't show to user
            }
        }, 1000); // Load after 1 second to not block other content
    }
    
    /**
     * Show critical content (Flash Sales + First Products)
     */
    showCriticalContent() {
        // Initialize components for critical content
        this.initializeCriticalComponents();
        
        // Render critical content - Có đủ dữ liệu rồi, render ngay!
        this.renderFlashSales();
        this.renderProducts();
        
        // Hide skeleton
        this.hideFlashSaleSkeleton();
        this.hideProductsSkeleton();
    }
    
    /**
     * Load data from API
     */
    async loadData() {
        const [products, categories, flashSales] = await Promise.all([
            apiService.getAllProducts(),
            apiService.getAllCategories(),
            apiService.getActiveFlashSales()
        ]);
        
        this.products = products;
        this.categories = categories;
        this.flashSales = flashSales;
        
        console.log('Data loaded:', {
            products: this.products.length,
            categories: this.categories.length,
            flashSales: this.flashSales.length
        });
    }
    
    /**
     * Initialize components (CRITICAL ONLY)
     */
    initializeCriticalComponents() {
        console.log('🔧 HomePage: Initializing critical components...');
        
        // Product Grid
        this.productGrid = new ProductGrid('productsGrid', {
            initialCount: 16,  // Hiển thị 16 sản phẩm ban đầu (4 hàng x 4 cột)
            itemsPerPage: 8    // Mỗi lần "Xem thêm" load thêm 8 sản phẩm
        });
        console.log('✅ HomePage: ProductGrid initialized');
        
        // Featured Carousel - Initialize if container exists
        const featuredContainer = document.getElementById('featuredCarousel');
        if (featuredContainer) {
            console.log('🎠 Found featured carousel container, initializing...');
            // Import and initialize FeaturedCarousel
            import('../components/featured-carousel.js').then(() => {
                console.log('📦 Featured carousel module loaded');
                if (window.FeaturedCarousel) {
                    console.log('🎠 Creating FeaturedCarousel instance...');
                    this.featuredCarousel = new window.FeaturedCarousel('featuredCarousel', {
                        autoPlay: true,
                        autoPlayDelay: 5000,
                        showDots: true,
                        showArrows: true,
                        itemsPerView: {
                            mobile: 1,
                            tablet: 2,
                            desktop: 4
                        }
                    });
                    window.featuredCarousel = this.featuredCarousel;
                    console.log('✅ HomePage: FeaturedCarousel initialized successfully');
                } else {
                    console.error('❌ HomePage: FeaturedCarousel class not available after import');
                }
            }).catch(error => {
                console.error('❌ HomePage: Error loading FeaturedCarousel module:', error);
            });
        } else {
            console.warn('⚠️ HomePage: Featured carousel container (#featuredCarousel) not found in DOM');
        }
        
        // Baby Weight Modal
        this.babyWeightModal = new BabyWeightModal();
        console.log('✅ HomePage: BabyWeightModal initialized');
        
        // Product Actions
        this.productActions = new ProductActions(this.products);
        this.productActions.setBabyWeightModal(this.babyWeightModal);
        window.productActions = this.productActions;
        console.log('✅ HomePage: ProductActions initialized and linked to BabyWeightModal');
        
        // Flash Sale Components - DISABLED (using vertical scroll instead)
        const activeFlashSale = this.flashSales.find(fs => fs.status === 'active');
        if (activeFlashSale && activeFlashSale.products) {
            // this.flashSaleCarousel = new FlashSaleCarousel('flashSaleProducts');
            this.flashSaleActions = new FlashSaleActions(this.flashSales);
            this.flashSaleActions.setBabyWeightModal(this.babyWeightModal);
            this.flashSaleTimer = new FlashSaleTimer(activeFlashSale);
            
            window.flashSaleActions = this.flashSaleActions;
            console.log('✅ HomePage: FlashSale components initialized and linked to BabyWeightModal');
        }
        
        // Quick Checkout
        this.quickCheckout = new QuickCheckout();
        window.quickCheckout = this.quickCheckout;
        console.log('✅ HomePage: QuickCheckout initialized');
        
        // Expose helper functions globally
        window.generateBuyNowLink = (productId) => {
            const baseUrl = window.location.origin + window.location.pathname;
            return `${baseUrl}?buy=${productId}`;
        };
        
        window.copyBuyNowLink = async (productId) => {
            const link = window.generateBuyNowLink(productId);
            try {
                await navigator.clipboard.writeText(link);
                console.log('✅ Link copied:', link);
                alert('✅ Đã copy link mua ngay!\n\n' + link);
                return true;
            } catch (error) {
                console.error('Failed to copy:', error);
                return false;
            }
        };
        
        console.log('✅ HomePage: Helper functions exposed (generateBuyNowLink, copyBuyNowLink)');
        
        console.log('🎉 HomePage: All critical components initialized successfully');
    }
    
    /**
     * Render page content
     */
    render() {
        // Render categories
        renderCategories(this.categories, 'categoriesGrid');
        
        // Render products
        const productsToRender = this.allProducts.length > 0 ? this.allProducts : this.products;
        this.productGrid.setAllProducts(productsToRender);
        
        // Render flash sales - NO CAROUSEL
        // Flash sales are rendered directly in renderFlashSales()
    }
    
    /**
     * Render flash sales
     */
    renderFlashSales() {
        console.log('🔥 Rendering flash sales:', this.flashSales);
        
        // Check if we have any flash sales
        if (!this.flashSales || this.flashSales.length === 0) {
            console.warn('🔥 No flash sales data available');
            this.hideFlashSaleSection();
            return;
        }
        
        // Carousel disabled - using vertical scroll layout instead
        // Just render the products directly without carousel
        const activeFlashSale = this.flashSales.find(fs => fs.status === 'active');
        
        console.log('🔥 Active flash sale found:', activeFlashSale);
        
        if (activeFlashSale && activeFlashSale.products && activeFlashSale.products.length > 0) {
            console.log('🔥 Flash sale products:', activeFlashSale.products.length);
            
            // Show flash sale section
            this.showFlashSaleSection();
            
            // Render products directly to container
            const container = document.getElementById('flashSaleProducts');
            if (container) {
                console.log('🔥 Container found, rendering products...');
                // Import createFlashSaleCard function
                import('../features/flash-sale/flash-sale-card.js').then(module => {
                    const { createFlashSaleCard } = module;
                    const activeProducts = activeFlashSale.products.filter(p => p.is_active === 1);
                    console.log('🔥 Active products to render:', activeProducts.length);
                    
                    if (activeProducts.length > 0) {
                        container.innerHTML = activeProducts.map(createFlashSaleCard).join('');
                    } else {
                        console.warn('🔥 No active products in flash sale');
                        this.hideFlashSaleSection();
                    }
                });
            } else {
                console.warn('🔥 Container #flashSaleProducts not found');
                this.hideFlashSaleSection();
            }
            
            // Start timer
            if (this.flashSaleTimer) {
                this.flashSaleTimer.start();
            }
        } else {
            console.warn('🔥 No active flash sale or no products');
            this.hideFlashSaleSection();
        }
    }
    
    /**
     * Hide flash sale section if no active sales
     */
    hideFlashSaleSection() {
        const section = document.getElementById('flash-sale');
        if (section) {
            section.style.display = 'none';
            console.log('🔥 Flash sale section hidden');
        }
    }
    
    /**
     * Show flash sale section
     */
    showFlashSaleSection() {
        const section = document.getElementById('flash-sale');
        if (section) {
            section.style.display = 'block';
            console.log('🔥 Flash sale section shown');
        }
    }
    
    /**
     * Render products
     */
    renderProducts() {
        // Chỉ cần set products, ProductGrid sẽ tự xử lý
        const productsToRender = this.allProducts.length > 0 ? this.allProducts : this.products;
        
        if (this.productGrid) {
            this.productGrid.setAllProducts(productsToRender);
        } else {
            console.error('❌ ProductGrid not initialized!');
        }
    }
    
    /**
     * Render categories
     */
    renderCategories() {
        if (this.categories.length > 0) {
            // Initialize category actions if not already done
            if (!this.categoryActions) {
                this.categoryActions = new CategoryActions((categoryId) => {
                    this.filterByCategory(categoryId);
                });
                window.categoryActions = this.categoryActions;
            }
            
            renderCategories(this.categories, 'categoriesGrid');
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // ============================================
        // SEARCH FUNCTIONALITY - Expandable & Smooth
        // ============================================
        this.setupSearchListeners();
        
        // Filter tabs/chips (support both .filter-tab and .filter-chip)
        const filterButtons = document.querySelectorAll('.filter-tab, .filter-chip');
        filterButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active state
                filterButtons.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Apply filter (works on search results if searching)
                const filter = tab.dataset.filter;
                this.productGrid.filter(filter);
                
                // Update URL if searching
                if (this.productGrid.isSearching) {
                    this.updateFilterURL(filter);
                }
            });
        });
        
        // Sort select
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.productGrid.sort(e.target.value);
            });
        }
        
        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                // Lưu vị trí hiện tại của button trước khi load more
                const buttonPosition = loadMoreBtn.getBoundingClientRect().top + window.scrollY;
                
                // Load more products
                this.productGrid.loadMore();
                
                // Sau khi render xong, scroll xuống vị trí button cũ (nơi sản phẩm mới bắt đầu)
                setTimeout(() => {
                    // Scroll mượt mà đến vị trí sản phẩm mới
                    window.scrollTo({
                        top: buttonPosition - 100, // Trừ 100px để có khoảng trống phía trên
                        behavior: 'smooth'
                    });
                }, 100); // Đợi 100ms để DOM render xong
            });
        }
        
        // DISABLED: Infinite scroll (use button instead for better UX)
        // this.setupInfiniteScroll();
        
        // Cart button
        const cartBtn = document.getElementById('cartBtn');
        if (cartBtn) {
            cartBtn.addEventListener('click', () => {
                window.location.href = 'cart.html';
            });
        }
        
        // Mobile menu toggle
        const menuBtn = document.getElementById('menuBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        if (menuBtn && mobileMenu) {
            menuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
        
        // Smooth scroll for nav links
        document.querySelectorAll('.nav-link, a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
        
        // Header scroll effect - Use RAF throttle for smooth performance
        const handleHeaderScroll = rafThrottle(() => {
            const header = document.querySelector('.header');
            if (header) {
                if (window.scrollY > 100) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
        });
        
        window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    }
    
    /**
     * Clear search and restore UI (helper method)
     */
    clearSearchAndRestoreUI() {
        // Clear search in ProductGrid
        if (this.productGrid) {
            this.productGrid.clearSearch();
        }
        
        // Hide search UI elements
        const searchResultsBanner = document.getElementById('searchResultsBanner');
        const searchEmptyState = document.getElementById('searchEmptyState');
        const productsGrid = document.getElementById('productsGrid');
        
        if (searchResultsBanner) searchResultsBanner.style.display = 'none';
        if (searchEmptyState) searchEmptyState.style.display = 'none';
        if (productsGrid) productsGrid.style.display = '';
        
        // Restore original titles
        const productsSectionTitle = document.getElementById('productsSectionTitle');
        const productsSectionSubtitle = document.getElementById('productsSectionSubtitle');
        const productsSectionDescription = document.getElementById('productsSectionDescription');
        
        if (productsSectionTitle) productsSectionTitle.textContent = 'Sản phẩm được';
        if (productsSectionSubtitle) productsSectionSubtitle.textContent = 'yêu thích nhất';
        if (productsSectionDescription) productsSectionDescription.textContent = 'Những chiếc vòng được làm thủ công tỉ mỉ, mang đến sự an toàn và yêu thương cho bé yêu';
    }
    
    /**
     * Setup search listeners - Expandable search with smooth animations
     */
    setupSearchListeners() {
        const searchContainer = document.getElementById('searchContainer');
        const searchIconBtn = document.getElementById('searchIconBtn');
        const searchInputWrapper = document.getElementById('searchInputWrapper');
        const searchInput = document.getElementById('searchInput');
        const searchSubmitBtn = document.getElementById('searchSubmitBtn');
        const searchClearBtn = document.getElementById('searchClearBtn');
        
        // Search results UI elements
        const searchResultsBanner = document.getElementById('searchResultsBanner');
        const searchResultsText = document.getElementById('searchResultsText');
        const searchResultsClear = document.getElementById('searchResultsClear');
        const searchEmptyState = document.getElementById('searchEmptyState');
        const emptyStateKeyword = document.getElementById('emptyStateKeyword');
        const emptyStateButton = document.getElementById('emptyStateButton');
        const productsGrid = document.getElementById('productsGrid');
        
        // Products section title elements
        const productsSectionTitle = document.getElementById('productsSectionTitle');
        const productsSectionSubtitle = document.getElementById('productsSectionSubtitle');
        const productsSectionDescription = document.getElementById('productsSectionDescription');
        
        // Store original titles
        const originalTitle = productsSectionTitle ? productsSectionTitle.textContent : 'Sản phẩm được';
        const originalSubtitle = productsSectionSubtitle ? productsSectionSubtitle.textContent : 'yêu thích nhất';
        const originalDescription = productsSectionDescription ? productsSectionDescription.textContent : 'Những chiếc vòng được làm thủ công tỉ mỉ, mang đến sự an toàn và yêu thương cho bé yêu';
        
        if (!searchContainer || !searchIconBtn || !searchInputWrapper || !searchInput || !searchSubmitBtn || !searchClearBtn) {
            console.warn('⚠️ Search elements not found');
            return;
        }
        
        // Toggle search input visibility
        const openSearch = () => {
            searchContainer.classList.add('search-active');
            searchInputWrapper.classList.add('active');
            // Focus input IMMEDIATELY (no delay)
            searchInput.focus();
        };
        
        const closeSearch = () => {
            searchContainer.classList.remove('search-active');
            searchInputWrapper.classList.remove('active');
            searchInput.value = '';
            searchClearBtn.classList.remove('visible');
        };
        
        // Clear search and restore filter
        const clearSearchResults = () => {
            // Clear search in ProductGrid
            if (this.productGrid) {
                this.productGrid.clearSearch();
            }
            
            // Hide search UI
            if (searchResultsBanner) searchResultsBanner.style.display = 'none';
            if (searchEmptyState) searchEmptyState.style.display = 'none';
            if (productsGrid) productsGrid.style.display = '';
            
            // Restore original titles
            if (productsSectionTitle) productsSectionTitle.textContent = originalTitle;
            if (productsSectionSubtitle) productsSectionSubtitle.textContent = originalSubtitle;
            if (productsSectionDescription) productsSectionDescription.textContent = originalDescription;
            
            // Clear URL params
            this.clearSearchURL();
            
            // Close search input
            closeSearch();
        };
        
        // Perform search with UI updates
        const performSearch = () => {
            const query = searchInput.value.trim();
            
            if (!query) {
                clearSearchResults();
                return;
            }
            
            // Close search input first
            closeSearch();
            
            // Update URL with search params
            this.updateSearchURL(query);
            
            // Perform search (will apply current filter automatically)
            if (this.productGrid) {
                const results = this.productGrid.search(query);
                
                if (results) {
                    // Update section titles for search
                    if (productsSectionTitle) {
                        productsSectionTitle.textContent = 'Kết quả tìm kiếm';
                    }
                    if (productsSectionSubtitle) {
                        productsSectionSubtitle.textContent = `"${results.query}"`;
                    }
                    if (productsSectionDescription) {
                        // Get current filter name
                        const currentFilterName = this.getCurrentFilterName();
                        productsSectionDescription.textContent = `Tìm thấy ${results.count} sản phẩm - Sắp xếp theo ${currentFilterName}`;
                    }
                    
                    // Update UI based on results
                    if (results.hasResults) {
                        // Show results banner
                        if (searchResultsBanner && searchResultsText) {
                            searchResultsText.textContent = `Tìm thấy ${results.count} sản phẩm cho "${results.query}"`;
                            searchResultsBanner.style.display = 'block';
                        }
                        
                        // Hide empty state
                        if (searchEmptyState) searchEmptyState.style.display = 'none';
                        
                        // Show products grid
                        if (productsGrid) productsGrid.style.display = '';
                    } else {
                        // Show empty state
                        if (searchEmptyState && emptyStateKeyword) {
                            emptyStateKeyword.textContent = results.query;
                            searchEmptyState.style.display = 'block';
                        }
                        
                        // Hide results banner
                        if (searchResultsBanner) searchResultsBanner.style.display = 'none';
                        
                        // Hide products grid
                        if (productsGrid) productsGrid.style.display = 'none';
                    }
                    
                    // Smooth scroll to products section
                    this.scrollToProducts();
                }
            }
        };
        
        // Click search icon to open
        searchIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSearch();
        });
        
        // Show/hide clear button when typing
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query) {
                searchClearBtn.classList.add('visible');
            } else {
                searchClearBtn.classList.remove('visible');
            }
        });
        
        // Click search submit button to perform search
        searchSubmitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            performSearch();
        });
        
        // Enter key to perform search
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
        
        // Clear button in search input
        searchClearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.value = '';
            searchClearBtn.classList.remove('visible');
            searchInput.focus();
        });
        
        // Clear button in results banner
        if (searchResultsClear) {
            searchResultsClear.addEventListener('click', () => {
                clearSearchResults();
            });
        }
        
        // Empty state button
        if (emptyStateButton) {
            emptyStateButton.addEventListener('click', () => {
                clearSearchResults();
                this.scrollToProducts();
            });
        }
        
        // Close search when clicking outside (desktop) or on backdrop (mobile)
        document.addEventListener('click', (e) => {
            if (!searchContainer.contains(e.target)) {
                closeSearch();
            }
        });
        
        // Mobile: Click on backdrop (wrapper) to close, but not on input
        searchInputWrapper.addEventListener('click', (e) => {
            // If clicking on the wrapper itself (backdrop), close
            if (e.target === searchInputWrapper) {
                closeSearch();
            }
            // If clicking on input or buttons, don't close
            e.stopPropagation();
        });
        
        // Prevent closing when clicking on input
        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // ESC key to close search
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchInputWrapper.classList.contains('active')) {
                closeSearch();
            }
        });
        
        console.log('✅ Search listeners setup complete (with results UI)');
    }
    
    /**
     * Smooth scroll to products section
     */
    scrollToProducts() {
        const productsSection = document.getElementById('products');
        if (productsSection) {
            // Use RAF for smooth 60fps scroll
            requestAnimationFrame(() => {
                productsSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start'
                });
            });
        }
    }
    
    /**
     * Get current filter name for display
     */
    getCurrentFilterName() {
        if (!this.productGrid) return 'mặc định';
        
        const filterMap = {
            'best-selling': 'bán chạy',
            'favorite': 'yêu thích',
            'new': 'mới nhất'
        };
        
        return filterMap[this.productGrid.currentFilter] || 'mặc định';
    }
    
    /**
     * Update URL with search params (smart URL management)
     */
    updateSearchURL(query, filter = null) {
        const url = new URL(window.location);
        
        // CLEAR category param when searching (search is global, not category-specific)
        url.searchParams.delete('category');
        
        // Set search param
        url.searchParams.set('search', query);
        
        // Set filter param if provided, otherwise use current filter
        const currentFilter = filter || (this.productGrid ? this.productGrid.currentFilter : 'best-selling');
        if (currentFilter && currentFilter !== 'best-selling') {
            // Only add filter param if not default
            url.searchParams.set('filter', currentFilter);
        } else {
            // Remove filter param if default
            url.searchParams.delete('filter');
        }
        
        // Update URL without reload
        window.history.pushState({}, '', url);
        
        console.log('🔗 URL updated:', url.toString());
    }
    
    /**
     * Update URL filter param (when changing filter during search)
     */
    updateFilterURL(filter) {
        const url = new URL(window.location);
        
        // Only update if searching
        if (url.searchParams.has('search')) {
            if (filter && filter !== 'best-selling') {
                url.searchParams.set('filter', filter);
            } else {
                url.searchParams.delete('filter');
            }
            
            // Update URL without reload
            window.history.pushState({}, '', url);
            
            console.log('🔗 Filter URL updated:', url.toString());
        }
    }
    
    /**
     * Update URL with category param
     */
    updateCategoryURL(categoryId) {
        const url = new URL(window.location);
        
        // Clear search params
        url.searchParams.delete('search');
        url.searchParams.delete('filter');
        
        // Set category param
        if (categoryId) {
            url.searchParams.set('category', categoryId);
        } else {
            url.searchParams.delete('category');
        }
        
        // Update URL without reload
        window.history.pushState({}, '', url);
        
        console.log('🔗 Category URL updated:', url.toString());
    }
    
    /**
     * Clear search URL params
     */
    clearSearchURL() {
        const url = new URL(window.location);
        url.searchParams.delete('search');
        url.searchParams.delete('filter');
        
        // Update URL without reload
        window.history.pushState({}, '', url);
        
        console.log('🔗 URL cleared');
    }
    
    /**
     * Perform search from URL params (on page load)
     */
    performSearchFromURL(searchQuery, filterType = null) {
        if (!searchQuery || !this.productGrid) return;
        
        console.log('🔗 Performing search from URL:', searchQuery, filterType);
        
        // Apply filter first if specified
        if (filterType) {
            // Update filter chip active state
            const filterButtons = document.querySelectorAll('.filter-tab, .filter-chip');
            filterButtons.forEach(btn => {
                if (btn.dataset.filter === filterType) {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
            
            // Set current filter in ProductGrid
            this.productGrid.currentFilter = filterType;
        }
        
        // Perform search
        const results = this.productGrid.search(searchQuery);
        
        if (results) {
            // Update UI
            const searchResultsBanner = document.getElementById('searchResultsBanner');
            const searchResultsText = document.getElementById('searchResultsText');
            const searchEmptyState = document.getElementById('searchEmptyState');
            const emptyStateKeyword = document.getElementById('emptyStateKeyword');
            const productsGrid = document.getElementById('productsGrid');
            const productsSectionTitle = document.getElementById('productsSectionTitle');
            const productsSectionSubtitle = document.getElementById('productsSectionSubtitle');
            const productsSectionDescription = document.getElementById('productsSectionDescription');
            
            // Update section titles
            if (productsSectionTitle) {
                productsSectionTitle.textContent = 'Kết quả tìm kiếm';
            }
            if (productsSectionSubtitle) {
                productsSectionSubtitle.textContent = `"${results.query}"`;
            }
            if (productsSectionDescription) {
                const currentFilterName = this.getCurrentFilterName();
                productsSectionDescription.textContent = `Tìm thấy ${results.count} sản phẩm - Sắp xếp theo ${currentFilterName}`;
            }
            
            // Update UI based on results
            if (results.hasResults) {
                if (searchResultsBanner && searchResultsText) {
                    searchResultsText.textContent = `Tìm thấy ${results.count} sản phẩm cho "${results.query}"`;
                    searchResultsBanner.style.display = 'block';
                }
                if (searchEmptyState) searchEmptyState.style.display = 'none';
                if (productsGrid) productsGrid.style.display = '';
            } else {
                if (searchEmptyState && emptyStateKeyword) {
                    emptyStateKeyword.textContent = results.query;
                    searchEmptyState.style.display = 'block';
                }
                if (searchResultsBanner) searchResultsBanner.style.display = 'none';
                if (productsGrid) productsGrid.style.display = 'none';
            }
            
            // Scroll to products
            this.scrollToProducts();
        }
    }
    
    /**
     * Filter by category from URL (on page load)
     */
    filterByCategoryFromURL(categoryId) {
        if (!categoryId || !this.productGrid) return;
        
        const catId = parseInt(categoryId);
        if (isNaN(catId)) return;
        
        console.log('🔗 Filtering by category from URL:', catId);
        
        // Trigger category filter
        if (window.categoryActions) {
            window.categoryActions.filterByCategory(catId);
        } else {
            // Fallback if categoryActions not ready
            this.productGrid.filterByCategory(catId);
        }
    }
    
    /**
     * Setup infinite scroll (auto load more when near bottom)
     * Smart threshold based on screen size
     */
    setupInfiniteScroll() {
        let isLoading = false;
        
        // Use throttle to limit scroll event frequency
        const handleScroll = throttle(async () => {
            if (isLoading) return;
            
            const scrollPosition = window.innerHeight + window.scrollY;
            const documentHeight = document.documentElement.scrollHeight;
            
            // Smart threshold: 
            // - Mobile (< 768px): Load when 70% scrolled (earlier)
            // - Tablet (768-1024px): Load when 80% scrolled
            // - Desktop (> 1024px): Load when 85% scrolled
            let scrollPercentage;
            if (window.innerWidth < 768) {
                scrollPercentage = 0.70; // Load earlier on mobile
            } else if (window.innerWidth < 1024) {
                scrollPercentage = 0.80; // Medium on tablet
            } else {
                scrollPercentage = 0.85; // Later on desktop
            }
            
            const threshold = documentHeight * scrollPercentage;
            
            // Debug log (only when close to threshold)
            if (scrollPosition >= threshold * 0.95) {
                console.log('📜 Scroll check:', {
                    scrollPosition: Math.round(scrollPosition),
                    threshold: Math.round(threshold),
                    percentage: Math.round((scrollPosition / documentHeight) * 100) + '%',
                    hasMore: this.productGrid?.hasMore(),
                    displayed: this.productGrid?.displayedCount,
                    total: this.productGrid?.filteredProducts?.length,
                    screenWidth: window.innerWidth
                });
            }
            
            if (scrollPosition >= threshold && this.productGrid.hasMore()) {
                isLoading = true;
                console.log('🔄 Loading more products...');
                
                // Load more products
                this.productGrid.loadMore();
                
                // Small delay to prevent rapid firing
                setTimeout(() => {
                    isLoading = false;
                }, 300);
            }
        }, 150); // Reduced throttle for better responsiveness
        
        window.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    /**
     * Load more products from API (DEPRECATED - not used anymore)
     */
    async loadMoreProducts() {
        if (!this.hasMoreProducts) return;
        
        console.log('📦 Loading more products...');
        this.currentPage++;
        
        const productsPage = await apiService.getProductsPaginated(this.currentPage, 12);
        this.products = [...this.products, ...productsPage.products];
        this.hasMoreProducts = productsPage.hasMore;
        
        // Update product grid
        this.productGrid.setProducts(this.products);
        
        console.log(`✅ Loaded page ${this.currentPage}`);
    }
    
    /**
     * Filter products by category
     */
    filterByCategory(categoryId) {
        console.log('HomePage: Filter by category:', categoryId);
        
        // If searching, clear search first
        if (this.productGrid && this.productGrid.isSearching) {
            console.log('📂 Clearing search to view category');
            this.clearSearchAndViewCategory(categoryId);
            return;
        }
        
        // Normal category filter
        if (this.productGrid) {
            this.productGrid.filterByCategory(categoryId);
        }
        
        // Update URL with category
        this.updateCategoryURL(categoryId);
    }
    
    /**
     * Clear search and view category
     */
    clearSearchAndViewCategory(categoryId) {
        // Clear search in ProductGrid
        if (this.productGrid) {
            this.productGrid.clearSearch();
        }
        
        // Hide search UI
        const searchResultsBanner = document.getElementById('searchResultsBanner');
        const searchEmptyState = document.getElementById('searchEmptyState');
        const productsGrid = document.getElementById('productsGrid');
        
        if (searchResultsBanner) searchResultsBanner.style.display = 'none';
        if (searchEmptyState) searchEmptyState.style.display = 'none';
        if (productsGrid) productsGrid.style.display = '';
        
        // Restore original titles
        const productsSectionTitle = document.getElementById('productsSectionTitle');
        const productsSectionSubtitle = document.getElementById('productsSectionSubtitle');
        const productsSectionDescription = document.getElementById('productsSectionDescription');
        
        if (productsSectionTitle) productsSectionTitle.textContent = 'Sản phẩm được';
        if (productsSectionSubtitle) productsSectionSubtitle.textContent = 'yêu thích nhất';
        if (productsSectionDescription) productsSectionDescription.textContent = 'Những chiếc vòng được làm thủ công tỉ mỉ, mang đến sự an toàn và yêu thương cho bé yêu';
        
        // Apply category filter
        if (this.productGrid) {
            this.productGrid.filterByCategory(categoryId);
        }
        
        // Update URL with category
        this.updateCategoryURL(categoryId);
    }
    
    /**
     * Update cart UI
     */
    updateCartUI() {
        const badge = document.getElementById('cartCount');
        if (badge) {
            const itemCount = cartService.getItemCount();
            badge.textContent = itemCount;
        }
    }
    
    /**
     * Setup cart update listener
     */
    setupCartUpdateListener() {
        // Listen for cart updates from any component
        window.addEventListener('cartUpdated', () => {
            this.updateCartUI();
        });
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        // Skeleton is already visible in HTML
        console.log('Loading...');
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        console.log('Loading complete');
    }
    
    /**
     * Hide skeleton and show real content with fade-in animation
     */
    hideSkeletonAndShowContent() {
        this.hideFlashSaleSkeleton();
        this.hideCategoriesSkeleton();
        this.hideProductsSkeleton();
    }
    
    /**
     * Hide flash sale skeleton
     */
    hideFlashSaleSkeleton() {
        const flashSaleSkeleton = document.getElementById('flashSaleSkeleton');
        const flashSaleProducts = document.getElementById('flashSaleProducts');
        if (flashSaleSkeleton && flashSaleProducts) {
            flashSaleSkeleton.style.display = 'none';
            flashSaleProducts.classList.remove('hidden');
            flashSaleProducts.classList.add('fade-in');
        }
    }
    
    /**
     * Hide categories skeleton
     */
    hideCategoriesSkeleton() {
        const categoriesSkeleton = document.getElementById('categoriesSkeleton');
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (categoriesSkeleton && categoriesGrid) {
            categoriesSkeleton.style.display = 'none';
            categoriesGrid.classList.remove('hidden');
            categoriesGrid.classList.add('fade-in');
        }
    }
    
    /**
     * Hide products skeleton
     */
    hideProductsSkeleton() {
        const productsSkeleton = document.getElementById('productsSkeleton');
        const productsGrid = document.getElementById('productsGrid');
        if (productsSkeleton && productsGrid) {
            productsSkeleton.style.display = 'none';
            productsGrid.classList.remove('hidden');
            productsGrid.classList.add('fade-in');
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        // TODO: Implement error UI
        alert(message);
    }
    
    /**
     * Open quick buy modal from URL parameter
     */
    async openQuickBuyFromURL(productId) {
        try {
            const id = parseInt(productId);
            if (isNaN(id)) {
                console.error('Invalid product ID:', productId);
                return;
            }
            
            console.log('🔗 Opening quick buy for product ID:', id);
            
            // Try to find product in already loaded products first
            let product = this.allProducts.find(p => p.id === id);
            
            // If not found, fetch from API
            if (!product) {
                console.log('📡 Product not in cache, fetching from API...');
                product = await apiService.getProductById(id);
            }
            
            if (!product) {
                console.error('Product not found:', id);
                alert('Không tìm thấy sản phẩm. Vui lòng thử lại!');
                // Clean URL on error
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
            
            // Open quick checkout modal (URL already has ?buy=xxx, don't change it)
            if (window.quickCheckout) {
                window.quickCheckout.open({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    originalPrice: product.original_price,
                    image: product.image_url || product.image,
                    maxQuantity: 99,
                    isFlashSale: false,
                    categories: product.categories || []
                });
            }
            
        } catch (error) {
            console.error('Error opening quick buy from URL:', error);
            alert('Có lỗi xảy ra. Vui lòng thử lại!');
            // Clean URL on error
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    /**
     * Open checkout modal from cart page
     */
    openCheckoutFromCart() {
        try {
            // Get checkout data from localStorage
            const checkoutDataStr = localStorage.getItem('checkoutData');
            if (!checkoutDataStr) {
                console.error('No checkout data found');
                return;
            }
            
            const checkoutData = JSON.parse(checkoutDataStr);
            
            // Validate data is not too old (5 minutes)
            const now = Date.now();
            if (now - checkoutData.timestamp > 5 * 60 * 1000) {
                console.error('Checkout data expired');
                localStorage.removeItem('checkoutData');
                alert('Dữ liệu giỏ hàng đã hết hạn. Vui lòng quay lại giỏ hàng.');
                window.location.href = 'cart.html';
                return;
            }
            
            // Open quick checkout modal with cart data
            if (window.quickCheckout) {
                // For now, just open with first product
                // TODO: Implement multi-product checkout
                if (checkoutData.cart && checkoutData.cart.length > 0) {
                    const firstProduct = checkoutData.cart[0];
                    window.quickCheckout.open({
                        id: firstProduct.id,
                        name: firstProduct.name,
                        price: firstProduct.price,
                        image: firstProduct.image,
                        quantity: firstProduct.quantity
                    });
                    
                    // Apply discount if exists
                    if (checkoutData.discount) {
                        setTimeout(() => {
                            window.quickCheckout.applyDiscount(checkoutData.discount);
                        }, 500);
                    }
                }
            }
            
            // Clear checkout data
            localStorage.removeItem('checkoutData');
            
        } catch (error) {
            console.error('Error opening checkout from cart:', error);
        }
    }
}
