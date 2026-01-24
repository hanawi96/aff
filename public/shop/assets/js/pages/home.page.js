// ============================================
// HOME PAGE CONTROLLER
// ============================================

import { apiService } from '../shared/services/api.service.js';
import { cartService } from '../shared/services/cart.service.js';
import { ProductGrid, ProductActions } from '../features/products/index.js';
import { renderCategories, CategoryActions } from '../features/categories/index.js';
import { FlashSaleCarousel, FlashSaleActions, FlashSaleTimer } from '../features/flash-sale/index.js';
import { QuickCheckout } from '../features/checkout/index.js';

/**
 * Home Page Manager
 */
export class HomePage {
    constructor() {
        this.products = [];
        this.categories = [];
        this.flashSales = [];
        
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
            // Show loading state
            this.showLoading();
            
            // Load data in parallel
            await this.loadData();
            
            // Initialize components
            this.initializeComponents();
            
            // Render content
            this.render();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update cart UI
            this.updateCartUI();
            
            // Setup cart update listener
            this.setupCartUpdateListener();
            
            // Hide loading state
            this.hideLoading();
            
        } catch (error) {
            console.error('Home page initialization error:', error);
            this.showError('Có lỗi xảy ra khi tải trang. Vui lòng thử lại!');
        }
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
     * Initialize components
     */
    initializeComponents() {
        // Product Grid
        this.productGrid = new ProductGrid('productsGrid', {
            initialCount: 12,
            itemsPerPage: 12
        });
        
        // Product Actions
        this.productActions = new ProductActions(this.products);
        window.productActions = this.productActions; // For onclick handlers
        
        // Category Actions
        this.categoryActions = new CategoryActions((categoryId) => {
            this.filterByCategory(categoryId);
        });
        window.categoryActions = this.categoryActions; // For onclick handlers
        
        // Flash Sale Components
        const activeFlashSale = this.flashSales.find(fs => fs.status === 'active');
        if (activeFlashSale && activeFlashSale.products) {
            this.flashSaleCarousel = new FlashSaleCarousel('flashSaleProducts');
            this.flashSaleActions = new FlashSaleActions(this.flashSales);
            this.flashSaleTimer = new FlashSaleTimer(activeFlashSale);
            
            window.flashSaleActions = this.flashSaleActions; // For onclick handlers
        }
        
        // Quick Checkout
        this.quickCheckout = new QuickCheckout();
        window.quickCheckout = this.quickCheckout; // For onclick handlers
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
        
        // Header scroll effect
        window.addEventListener('scroll', () => {
            const header = document.querySelector('.header');
            if (header) {
                if (window.scrollY > 100) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
        });
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
        // TODO: Implement loading spinner
        console.log('Loading...');
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        console.log('Loading complete');
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
