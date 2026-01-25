// ============================================
// HOME PAGE CONTROLLER
// ============================================

import { apiService } from '../shared/services/api.service.js';
import { cartService } from '../shared/services/cart.service.js';
import { ProductGrid, ProductActions } from '../features/products/index.js';
import { renderCategories, CategoryActions } from '../features/categories/index.js';
import { FlashSaleCarousel, FlashSaleActions, FlashSaleTimer } from '../features/flash-sale/index.js';
import { QuickCheckout } from '../features/checkout/index.js';
import { throttle, rafThrottle } from '../shared/utils/performance.js';

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
            
            // Phase 1: Load critical above-the-fold content FIRST
            await this.loadCriticalContent();
            
            // Hide skeleton and show critical content
            this.showCriticalContent();
            
            // Phase 2: Load remaining content in background
            this.loadRemainingContent();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update cart UI
            this.updateCartUI();
            
            // Setup cart update listener
            this.setupCartUpdateListener();
            
        } catch (error) {
            console.error('Home page initialization error:', error);
            this.showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại!');
        }
    }
    
    /**
     * Load critical above-the-fold content FIRST
     * Priority: Flash Sales + First 12 Products
     */
    async loadCriticalContent() {
        // Load flash sales and first page of products in parallel
        const [flashSales, productsPage] = await Promise.all([
            apiService.getActiveFlashSales(),
            apiService.getProductsPaginated(1, 12) // Only first 12 products
        ]);
        
        this.flashSales = flashSales;
        this.products = productsPage.products;
        this.hasMoreProducts = productsPage.hasMore;
        this.currentPage = 1;
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
        
        // Load all products for filtering/sorting (in background)
        setTimeout(async () => {
            const allProducts = await apiService.getAllProducts();
            this.allProducts = allProducts;
            
            // Update ProductGrid with all products
            if (this.productGrid) {
                this.productGrid.setAllProducts(allProducts);
            }
            
            // Update ProductActions with all products
            if (this.productActions) {
                this.productActions.products = allProducts;
            }
        }, 500);
    }
    
    /**
     * Show critical content (Flash Sales + First Products)
     */
    showCriticalContent() {
        // Initialize components for critical content
        this.initializeCriticalComponents();
        
        // Render critical content
        this.renderFlashSales();
        this.renderProducts();
        
        // Hide skeleton for flash sales and products
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
        // Product Grid
        this.productGrid = new ProductGrid('productsGrid', {
            initialCount: 12,
            itemsPerPage: 12
        });
        
        // Product Actions
        this.productActions = new ProductActions(this.products);
        window.productActions = this.productActions;
        
        // Flash Sale Components
        const activeFlashSale = this.flashSales.find(fs => fs.status === 'active');
        if (activeFlashSale && activeFlashSale.products) {
            this.flashSaleCarousel = new FlashSaleCarousel('flashSaleProducts');
            this.flashSaleActions = new FlashSaleActions(this.flashSales);
            this.flashSaleTimer = new FlashSaleTimer(activeFlashSale);
            
            window.flashSaleActions = this.flashSaleActions;
        }
        
        // Quick Checkout
        this.quickCheckout = new QuickCheckout();
        window.quickCheckout = this.quickCheckout;
    }
    
    /**
     * Render page content
     */
    render() {
        // Render categories
        renderCategories(this.categories, 'categoriesGrid');
        
        // Render products
        this.productGrid.setProducts(this.products);
        
        // Render flash sales
        if (this.flashSaleCarousel) {
            const activeFlashSale = this.flashSales.find(fs => fs.status === 'active');
            this.flashSaleCarousel.setProducts(activeFlashSale.products);
            this.flashSaleTimer.start();
        }
    }
    
    /**
     * Render flash sales
     */
    renderFlashSales() {
        if (this.flashSaleCarousel) {
            const activeFlashSale = this.flashSales.find(fs => fs.status === 'active');
            if (activeFlashSale && activeFlashSale.products) {
                this.flashSaleCarousel.setProducts(activeFlashSale.products);
                this.flashSaleTimer.start();
            }
        }
    }
    
    /**
     * Render products
     */
    renderProducts() {
        this.productGrid.setProducts(this.products);
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
        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const filter = tab.dataset.filter;
                this.productGrid.filter(filter);
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
                this.productGrid.loadMore();
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
        console.log('Filter by category:', categoryId);
        // TODO: Implement category filtering
        // For now, just show all products
        this.productGrid.filter('all');
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
}
