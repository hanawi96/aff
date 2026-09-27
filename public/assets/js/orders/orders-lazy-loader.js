/**
 * Orders Lazy Loader - Pagination & Infinite Scroll
 * 
 * Thay thế logic load 1000 đơn một lúc bằng:
 * - Initial load: 50 đơn đầu tiên
 * - Infinite scroll: Load thêm 50 đơn khi scroll gần cuối
 * - Cache: Lưu các page đã xem
 * - Prefetch: Tự động tải page tiếp theo trong background
 * 
 * Dependencies:
 * - CONFIG.API_URL
 * - allOrdersData (global)
 * - renderOrdersTable() from orders-table.js
 * - showLoading(), hideLoading() from orders-ui-states.js
 * - showToast() from toast-manager.js (optional)
 */

class OrdersLazyLoader {
    constructor() {
        this.currentPage = 0; // Chưa load page nào
        this.pageSize = 50;
        this.totalOrders = 0;
        this.totalPages = 0;
        this.hasMore = true;
        this.loading = false;
        this.cache = new Map(); // Cache theo page number
        this.observer = null;
    }

    /**
     * Initial load - Load page 1
     */
    async initialLoad() {
        console.log('🚀 OrdersLazyLoader: Initial load...');
        
        if (typeof showLoading === 'function') {
            showLoading();
        }

        try {
            const data = await this.fetchPage(1);
            
            if (!data || !data.success) {
                throw new Error(data?.error || 'Không thể tải dữ liệu');
            }

            // Update global data
            if (typeof window.allOrdersData !== 'undefined') {
                window.allOrdersData = data.orders || [];
            }

            // Update state
            this.currentPage = 1;
            this.totalOrders = data.pagination?.totalOrders || 0;
            this.totalPages = data.pagination?.totalPages || 0;
            this.hasMore = data.pagination?.hasMore || false;

            console.log(`✅ Loaded page 1: ${data.orders.length} orders (Total: ${this.totalOrders})`);

            // Render
            if (typeof renderOrdersTable === 'function') {
                renderOrdersTable();
            }

            // Setup infinite scroll
            this.setupInfiniteScroll();

            // Prefetch page 2 sau 1 giây
            if (this.hasMore) {
                setTimeout(() => this.prefetchPage(2), 1000);
            }

        } catch (error) {
            console.error('❌ Initial load error:', error);
            
            if (typeof showError === 'function') {
                showError('Không thể tải dữ liệu đơn hàng. Vui lòng thử lại.');
            }
        } finally {
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
        }
    }

    /**
     * Fetch một page từ API
     */
    async fetchPage(page, useCache = true) {
        const cacheKey = `page_${page}`;

        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
            console.log(`📦 Cache hit: page ${page}`);
            return this.cache.get(cacheKey);
        }

        console.log(`🌐 Fetching page ${page}...`);

        const url = `${CONFIG.API_URL}?action=getOrdersPaginated&page=${page}&pageSize=${this.pageSize}&timestamp=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Cache result
        if (data.success) {
            this.cache.set(cacheKey, data);
            
            // Limit cache size: chỉ giữ 10 pages gần nhất
            if (this.cache.size > 10) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
                console.log(`🗑️ Removed old cache: ${firstKey}`);
            }
        }

        return data;
    }

    /**
     * Load thêm page tiếp theo (infinite scroll)
     */
    async loadMore() {
        if (this.loading || !this.hasMore) {
            return;
        }

        this.loading = true;
        this.showLoadingMore();

        try {
            const nextPage = this.currentPage + 1;
            console.log(`📄 Loading more: page ${nextPage}...`);

            const data = await this.fetchPage(nextPage);

            if (!data || !data.success) {
                throw new Error(data?.error || 'Không thể tải thêm');
            }

            // Append to global data
            if (typeof window.allOrdersData !== 'undefined') {
                window.allOrdersData.push(...(data.orders || []));
            }

            // Update state
            this.currentPage = nextPage;
            this.hasMore = data.pagination?.hasMore || false;

            console.log(`✅ Loaded page ${nextPage}: ${data.orders.length} orders`);

            // Re-render table (sẽ render tất cả orders trong allOrdersData)
            if (typeof renderOrdersTable === 'function') {
                renderOrdersTable();
            }

            // Prefetch page tiếp theo
            if (this.hasMore) {
                setTimeout(() => this.prefetchPage(nextPage + 1), 500);
            }

        } catch (error) {
            console.error('❌ Load more error:', error);
            
            if (typeof showToast === 'function') {
                showToast('Không thể tải thêm đơn hàng', 'error');
            }
        } finally {
            this.loading = false;
            this.hideLoadingMore();
        }
    }

    /**
     * Prefetch page trong background (không hiển thị)
     */
    async prefetchPage(page) {
        const cacheKey = `page_${page}`;
        
        if (this.cache.has(cacheKey)) {
            return; // Already cached
        }

        try {
            await this.fetchPage(page, false);
            console.log(`✨ Prefetched page ${page}`);
        } catch (error) {
            console.warn(`⚠️ Prefetch page ${page} failed:`, error);
        }
    }

    /**
     * Setup Intersection Observer cho infinite scroll
     */
    setupInfiniteScroll() {
        const sentinel = document.getElementById('orders-load-more-sentinel');
        
        if (!sentinel) {
            console.warn('⚠️ Sentinel element not found, infinite scroll disabled');
            return;
        }

        // Cleanup old observer
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && this.hasMore && !this.loading) {
                        console.log('👁️ Sentinel visible, loading more...');
                        this.loadMore();
                    }
                });
            },
            {
                root: null,
                rootMargin: '300px', // Trigger 300px trước khi chạm cuối
                threshold: 0.01
            }
        );

        this.observer.observe(sentinel);
        console.log('👀 Infinite scroll observer active');
    }

    /**
     * Show loading indicator ở cuối bảng
     */
    showLoadingMore() {
        const loadingEl = document.getElementById('orders-loading-more');
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoadingMore() {
        const loadingEl = document.getElementById('orders-loading-more');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }

        // Update "no more" message
        if (!this.hasMore) {
            const noMoreEl = document.getElementById('orders-no-more');
            if (noMoreEl) {
                noMoreEl.classList.remove('hidden');
                noMoreEl.textContent = `Đã hiển thị tất cả ${this.totalOrders} đơn hàng`;
            }
        }
    }

    /**
     * Reset loader (dùng khi filter/search)
     */
    reset() {
        console.log('🔄 Resetting loader...');
        
        this.currentPage = 0;
        this.hasMore = true;
        this.loading = false;
        this.cache.clear();

        // Hide messages
        const noMoreEl = document.getElementById('orders-no-more');
        if (noMoreEl) {
            noMoreEl.classList.add('hidden');
        }

        // Disconnect observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.cache.clear();
        console.log('🧹 OrdersLazyLoader destroyed');
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            currentPage: this.currentPage,
            pageSize: this.pageSize,
            totalOrders: this.totalOrders,
            totalPages: this.totalPages,
            hasMore: this.hasMore,
            loadedOrders: window.allOrdersData?.length || 0,
            cacheSize: this.cache.size
        };
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.OrdersLazyLoader = OrdersLazyLoader;
}
