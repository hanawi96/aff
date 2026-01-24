// ============================================
// FLASH SALE CAROUSEL COMPONENT
// ============================================

import { createFlashSaleCard } from './flash-sale-card.js';
import { isMobile } from '../../shared/utils/helpers.js';
import { CONFIG } from '../../shared/constants/config.js';

/**
 * Flash Sale Carousel Manager
 */
export class FlashSaleCarousel {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.products = [];
        this.currentPage = 0;
        this.totalPages = 0;
        this.itemsPerPage = this.getItemsPerPage();
        this.autoPlayInterval = null;
        this.autoPlayDelay = options.autoPlayDelay || CONFIG.FLASH_SALE_AUTO_PLAY_INTERVAL;
    }
    
    /**
     * Get items per page based on screen size
     */
    getItemsPerPage() {
        return isMobile() 
            ? CONFIG.FLASH_SALE_ITEMS_PER_PAGE_MOBILE 
            : CONFIG.FLASH_SALE_ITEMS_PER_PAGE_DESKTOP;
    }
    
    /**
     * Set products and initialize carousel
     */
    setProducts(products) {
        this.products = products.filter(p => p.is_active === 1);
        this.totalPages = Math.ceil(this.products.length / this.itemsPerPage);
        this.currentPage = 0;
        this.render();
        this.createDots();
        this.setupEventListeners();
        this.startAutoPlay();
    }
    
    /**
     * Render carousel
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container #${this.containerId} not found`);
            return;
        }
        
        if (this.products.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: white;">Hiện không có flash sale nào.</p>';
            return;
        }
        
        container.innerHTML = this.products.map(createFlashSaleCard).join('');
        this.updateDisplay();
    }
    
    /**
     * Update carousel display
     */
    updateDisplay() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        const translateX = -(this.currentPage * 100);
        container.style.transform = `translateX(${translateX}%)`;
        
        // Update buttons
        this.updateButtons();
        this.updateDots();
    }
    
    /**
     * Update button states
     */
    updateButtons() {
        const prevBtn = document.getElementById('flashSalePrev');
        const nextBtn = document.getElementById('flashSaleNext');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= this.totalPages - 1;
        }
    }
    
    /**
     * Create dots indicator
     */
    createDots() {
        const dotsContainer = document.getElementById('flashSaleDots');
        if (!dotsContainer) return;
        
        dotsContainer.innerHTML = '';
        
        for (let i = 0; i < this.totalPages; i++) {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Go to page ${i + 1}`);
            dot.addEventListener('click', () => this.goToPage(i));
            dotsContainer.appendChild(dot);
        }
    }
    
    /**
     * Update dots
     */
    updateDots() {
        const dots = document.querySelectorAll('.carousel-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentPage);
        });
    }
    
    /**
     * Go to specific page
     */
    goToPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= this.totalPages) return;
        
        this.currentPage = pageIndex;
        this.updateDisplay();
        this.resetAutoPlay();
    }
    
    /**
     * Next page
     */
    nextPage() {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
        } else {
            this.currentPage = 0; // Loop back
        }
        this.updateDisplay();
        this.resetAutoPlay();
    }
    
    /**
     * Previous page
     */
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.updateDisplay();
            this.resetAutoPlay();
        }
    }
    
    /**
     * Start auto play
     */
    startAutoPlay() {
        this.stopAutoPlay();
        this.autoPlayInterval = setInterval(() => {
            this.nextPage();
        }, this.autoPlayDelay);
    }
    
    /**
     * Stop auto play
     */
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    /**
     * Reset auto play
     */
    resetAutoPlay() {
        this.startAutoPlay();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation buttons
        const prevBtn = document.getElementById('flashSalePrev');
        const nextBtn = document.getElementById('flashSaleNext');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevPage());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
        
        // Touch/swipe support
        this.setupTouchEvents();
        
        // Keyboard navigation
        this.setupKeyboardEvents();
        
        // Resize handler
        this.setupResizeHandler();
        
        // Pause on hover
        this.setupHoverPause();
    }
    
    /**
     * Setup touch events
     */
    setupTouchEvents() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        const carousel = document.getElementById('flashSaleCarousel');
        if (!carousel) return;
        
        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        }, { passive: true });
    }
    
    /**
     * Handle swipe gesture
     */
    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                this.nextPage();
            } else {
                this.prevPage();
            }
        }
    }
    
    /**
     * Setup keyboard events
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prevPage();
            } else if (e.key === 'ArrowRight') {
                this.nextPage();
            }
        });
    }
    
    /**
     * Setup resize handler
     */
    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const oldItemsPerPage = this.itemsPerPage;
                this.itemsPerPage = this.getItemsPerPage();
                
                if (oldItemsPerPage !== this.itemsPerPage) {
                    this.totalPages = Math.ceil(this.products.length / this.itemsPerPage);
                    this.currentPage = 0;
                    this.createDots();
                    this.updateDisplay();
                }
            }, 250);
        });
    }
    
    /**
     * Setup hover pause
     */
    setupHoverPause() {
        const carousel = document.getElementById('flashSaleCarousel');
        if (!carousel) return;
        
        carousel.addEventListener('mouseenter', () => this.stopAutoPlay());
        carousel.addEventListener('mouseleave', () => this.startAutoPlay());
    }
}
