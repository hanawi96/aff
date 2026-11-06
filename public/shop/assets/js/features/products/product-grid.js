// ============================================
// PRODUCT GRID COMPONENT
// ============================================

import { renderProducts } from './product-card.js?v=15';
import { warmProductGridImages } from './product-image-cache.js?v=2';

/** Phần trăm giảm đang hiện trên thẻ sản phẩm. Không giảm thì là 0. */
function _discountPercent(product) {
    const original = Number(product?.original_price) || 0;
    const price = Number(product?.price) || 0;
    if (original <= 0 || price < 0 || original <= price) return 0;
    return Math.round(((original - price) / original) * 100);
}

/** Số tiền giảm, dùng khi hai sản phẩm cùng phần trăm. */
function _discountAmount(product) {
    const original = Number(product?.original_price) || 0;
    const price = Number(product?.price) || 0;
    return original > price ? original - price : 0;
}

/** Giảm nhiều đứng trước: % giảm, rồi số tiền giảm. */
function _compareDiscountDesc(a, b) {
    const byPercent = _discountPercent(b) - _discountPercent(a);
    if (byPercent !== 0) return byPercent;
    return _discountAmount(b) - _discountAmount(a);
}

/**
 * Hết hàng khi stock đọc được và <= 0.
 * Thiếu hoặc không đọc được số lượng thì vẫn giữ, tránh ẩn nhầm.
 */
function _isOutOfStock(product) {
    const raw = product?.stock_quantity ?? product?.stockQuantity;
    if (raw === undefined || raw === null || raw === '') return false;
    const qty = typeof raw === 'string'
        ? parseInt(String(raw).replace(/[^\d-]/g, ''), 10)
        : Number(raw);
    return Number.isFinite(qty) && qty <= 0;
}

function _withoutOutOfStock(products) {
    if (!Array.isArray(products)) return [];
    return products.filter(product => !_isOutOfStock(product));
}

/**
 * Product Grid Manager
 */
export class ProductGrid {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.products = []; // Deprecated - chỉ để tương thích
        this.allProducts = []; // NGUỒN DỮ LIỆU CHÍNH - Tất cả sản phẩm
        this.filteredProducts = []; // Sản phẩm sau khi filter
        this.initialCount = options.initialCount || 12;    // Số sản phẩm hiển thị ban đầu
        this.itemsPerPage = options.itemsPerPage || 12;    // Số sản phẩm load thêm mỗi lần
        this.displayedCount = this.initialCount;           // Bắt đầu với initialCount
        this.currentFilter = 'best-selling'; // Mặc định hiển thị "Bán chạy" trong tab Tất cả
        this.currentCategoryId = null; // null = Tất cả; số = đang lọc danh mục (giữ khi setAllProducts)
        this.currentSort = 'default';
        this.isSearching = false; // Track search state
        this.currentSearchQuery = ''; // Track current search query
    }
    
    /**
     * Set all products (NGUỒN DỮ LIỆU CHÍNH)
     * Đây là method chính để set dữ liệu
     * @param {object} [options]
     * @param {boolean} [options.preserveExpandedView] - Khi API nối thêm SP ở nền: giữ số ô đang mở (Xem thêm), không reset về trang đầu.
     */
    setAllProducts(products, options = {}) {
        const preserveExpanded = options.preserveExpandedView === true;
        const prevDisplayed = this.displayedCount;

        const inStock = _withoutOutOfStock(products);
        this.allProducts = inStock;
        this.products = inStock; // Sync để tương thích

        // Áp dụng lại filter hiện tại (mặc định reset displayedCount → gây lỗi "Xem thêm" nếu không preserve)
        this.applyCurrentFilter();

        if (preserveExpanded) {
            this.displayedCount = Math.min(
                Math.max(prevDisplayed, this.initialCount),
                this.filteredProducts.length
            );
            this.render();
            this.updateLoadMoreButton();
        }

        const sourceCount = Array.isArray(products) ? products.length : 0;
        console.log('✅ All products set:', inStock.length, preserveExpanded ? '(giữ số ô đang xem)' : '', sourceCount !== inStock.length ? `(ẩn ${sourceCount - inStock.length} hết hàng)` : '');

        // Warm first page of current filter while browser is idle (helps first category taps).
        const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
        scheduleIdle(() => {
            warmProductGridImages(this.filteredProducts, this.initialCount);
        });
    }
    
    /**
     * Set products data (DEPRECATED - dùng setAllProducts thay thế)
     * Giữ lại để tương thích với code cũ
     */
    setProducts(products) {
        console.warn('⚠️ setProducts is deprecated, use setAllProducts instead');
        this.setAllProducts(products);
    }
    
    /**
     * Apply current filter (internal method)
     */
    applyCurrentFilter() {
        // Ưu tiên danh mục đang chọn (kể cả từ ?category=) — tránh flash về "Tất cả".
        if (this.currentCategoryId != null) {
            this.filterByCategory(this.currentCategoryId);
            return;
        }
        if (this.currentFilter) {
            this.filter(this.currentFilter);
        } else {
            this.filteredProducts = [...this.allProducts];
            this.displayedCount = this.initialCount; // Reset về trang đầu (12)
            this.render();
        }
    }
    
    /**
     * Filter products by category
     */
    filterByCategory(categoryId) {
        const normalized =
            categoryId == null || categoryId === '' || categoryId === 'all'
                ? null
                : Number(categoryId);
        this.currentCategoryId = Number.isFinite(normalized) ? normalized : null;

        console.log('ProductGrid: Filtering by category:', this.currentCategoryId);
        
        // LUÔN dùng allProducts làm nguồn
        const sourceProducts = this.allProducts;
        
        // Nếu chưa có dữ liệu, không làm gì
        if (!sourceProducts || sourceProducts.length === 0) {
            console.warn('⚠️ No products to filter by category');
            return;
        }
        
        if (this.currentCategoryId == null) {
            // Tất cả: về đúng danh sách mặc định (Bán chạy, hoặc tab sắp xếp đang chọn).
            this.filter(this.currentFilter || 'best-selling');
            return;
        }

        const id = this.currentCategoryId;
        this.filteredProducts = sourceProducts.filter((product) => {
            if (Array.isArray(product.categories)) {
                return product.categories.some(
                    (cat) => Number(cat.id || cat.category_id) === id
                );
            }
            if (product.category_id != null) {
                return Number(product.category_id) === id;
            }
            if (Array.isArray(product.category_ids)) {
                return product.category_ids.some((cid) => Number(cid) === id);
            }
            return false;
        });
        
        console.log('ProductGrid: Filtered products:', this.filteredProducts.length);

        // Pre-warm HTTP cache for the page about to render (instant if hover already warmed).
        warmProductGridImages(this.filteredProducts, this.initialCount);

        // Đổi danh mục: luôn về 12 SP đầu, không bung hết.
        this.displayedCount = this.initialCount;
        this.render();
    }

    /**
     * Warm grid images for a category (used on chip hover / touch).
     */
    warmCategoryImages(categoryId, limit = this.initialCount) {
        const sourceProducts = this.allProducts;
        if (!sourceProducts?.length) return;

        if (categoryId == null) {
            warmProductGridImages(sourceProducts, limit);
            return;
        }

        const id = Number(categoryId);
        const matched = sourceProducts.filter((product) => {
            if (Array.isArray(product.categories)) {
                return product.categories.some((cat) => Number(cat.id || cat.category_id) === id);
            }
            if (product.category_id != null) return Number(product.category_id) === id;
            if (Array.isArray(product.category_ids)) {
                return product.category_ids.some((cid) => Number(cid) === id);
            }
            return false;
        });
        warmProductGridImages(matched, limit);
    }
    
    /**
     * Search products by keyword (SUPER FAST - Client-side)
     * Searches in: name, sku, category names
     * Returns filtered products WITHOUT sorting (sorting handled separately)
     */
    search(query) {
        // Clear search if empty
        if (!query || query.trim() === '') {
            this.clearSearch();
            return;
        }
        
        const searchTerm = query.trim().toLowerCase();
        const sourceProducts = this.allProducts;
        
        if (!sourceProducts || sourceProducts.length === 0) {
            console.warn('⚠️ No products to search');
            return;
        }
        
        // Mark as searching
        this.isSearching = true;
        this.currentSearchQuery = query.trim();
        
        // SUPER FAST search - single pass through products
        this.filteredProducts = sourceProducts.filter(product => {
            // Search in name
            if (product.name && product.name.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            // Search in SKU
            if (product.sku && product.sku.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            // Search in category names
            if (Array.isArray(product.categories)) {
                return product.categories.some(cat => 
                    cat.name && cat.name.toLowerCase().includes(searchTerm)
                );
            }
            
            return false;
        });
        
        // Apply current filter/sort to search results
        this.applySortToSearchResults();
        
        // Reset display count
        this.displayedCount = this.initialCount;
        this.render();
        
        console.log(`🔍 Search "${query}": ${this.filteredProducts.length} products found`);
        
        // Return results for UI update
        return {
            query: this.currentSearchQuery,
            count: this.filteredProducts.length,
            hasResults: this.filteredProducts.length > 0
        };
    }
    
    /**
     * Apply sort to search results (internal method)
     */
    applySortToSearchResults() {
        if (!this.isSearching || !this.filteredProducts.length) return;
        
        // Apply current filter as sort
        switch (this.currentFilter) {
            case 'best-selling':
                // Bán chạy: Sắp xếp theo số lượng đã bán (purchases)
                this.filteredProducts.sort((a, b) => (b.purchases || 0) - (a.purchases || 0));
                break;
            case 'biggest-discount':
                this.filteredProducts.sort(_compareDiscountDesc);
                break;
        }
        
        console.log(`📊 Applied "${this.currentFilter}" sort to ${this.filteredProducts.length} search results`);
    }
    
    /**
     * Filter products (works on search results if searching)
     */
    filter(filterType) {
        this.currentFilter = filterType;
        
        // If searching, just re-sort search results
        if (this.isSearching) {
            this.applySortToSearchResults();
            this.displayedCount = this.initialCount;
            this.render();
            console.log(`🔍 Re-sorted search results by "${filterType}"`);
            return;
        }
        
        // Normal filter logic (when not searching)
        const sourceProducts = this.allProducts;
        
        if (!sourceProducts || sourceProducts.length === 0) {
            console.warn('⚠️ No products to filter');
            return;
        }
        
        switch (filterType) {
            case 'best-selling':
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.purchases || 0) - (a.purchases || 0));
                break;
            case 'biggest-discount':
                this.filteredProducts = [...sourceProducts].sort(_compareDiscountDesc);
                break;
            case 'popular':
                this.filteredProducts = sourceProducts.filter(p => (p.purchases || 0) > 10);
                break;
            case 'sale':
                this.filteredProducts = sourceProducts.filter(p => 
                    p.original_price && p.original_price > p.price
                );
                break;
            default:
                this.filteredProducts = [...sourceProducts];
        }
        
        this.displayedCount = this.initialCount;
        this.render();
        
        console.log(`🔍 Filter "${filterType}": ${this.filteredProducts.length} products`);
    }
    
    /**
     * Clear search and restore previous filter
     */
    clearSearch() {
        this.isSearching = false;
        this.currentSearchQuery = '';
        this.applyCurrentFilter();
    }
    
    /**
     * Get search state
     */
    getSearchState() {
        return {
            isSearching: this.isSearching,
            query: this.currentSearchQuery,
            count: this.isSearching ? this.filteredProducts.length : 0
        };
    }
    
    /**
     * Sort products
     */
    sort(sortType) {
        this.currentSort = sortType;
        
        switch (sortType) {
            case 'price-asc':
                this.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price-desc':
                this.filteredProducts.sort((a, b) => b.price - a.price);
                break;
            case 'name':
                this.filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                // Keep current order
                break;
        }
        
        this.render();
    }
    
    /**
     * Load more products
     */
    loadMore() {
        const next = this.displayedCount + this.itemsPerPage;
        // Không vượt quá số SP sau filter (tránh displayedCount > length → không hiện thêm)
        this.displayedCount = Math.min(next, this.filteredProducts.length);
        this.render();
    }
    
    /**
     * Check if has more products
     */
    hasMore() {
        return this.displayedCount < this.filteredProducts.length;
    }
    
    /**
     * Ba sản phẩm bán nhiều nhất trong catalog đang bán.
     * Hạng giữ nguyên khi lọc danh mục hay đổi cách sắp xếp.
     */
    bestSellerRanks() {
        const ranked = [...this.allProducts].sort((a, b) => {
            const bySales = (Number(b.purchases) || 0) - (Number(a.purchases) || 0);
            if (bySales !== 0) return bySales;
            return Number(a.id) - Number(b.id);
        });
        const ranks = new Map();
        for (const product of ranked) {
            if ((Number(product.purchases) || 0) <= 0) break;
            ranks.set(Number(product.id), ranks.size + 1);
            if (ranks.size === 3) break;
        }
        return ranks;
    }

    /**
     * Render products
     */
    render() {
        const productsToShow = this.filteredProducts.slice(0, this.displayedCount);
        renderProducts(productsToShow, this.containerId, this.bestSellerRanks());
        this.updateLoadMoreButton();
    }
    
    /**
     * Update load more button visibility
     */
    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (!loadMoreBtn) return;
        
        const hasMore = this.hasMore();
        const newDisplay = hasMore ? 'inline-flex' : 'none';
        
        // Only update if changed (prevent flickering)
        if (loadMoreBtn.style.display !== newDisplay) {
            loadMoreBtn.style.display = newDisplay;
            console.log('🔘 Button:', hasMore ? 'VISIBLE' : 'HIDDEN', `(${this.displayedCount}/${this.filteredProducts.length})`);
        }
    }
}
