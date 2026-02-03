// ============================================
// PRODUCT GRID COMPONENT
// ============================================

import { renderProducts } from './product-card.js';

/**
 * Product Grid Manager
 */
export class ProductGrid {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.products = []; // Deprecated - chỉ để tương thích
        this.allProducts = []; // NGUỒN DỮ LIỆU CHÍNH - Tất cả sản phẩm
        this.filteredProducts = []; // Sản phẩm sau khi filter
        this.initialCount = options.initialCount || 16;    // Số sản phẩm hiển thị ban đầu
        this.itemsPerPage = options.itemsPerPage || 8;     // Số sản phẩm load thêm mỗi lần
        this.displayedCount = this.initialCount;           // Bắt đầu với initialCount
        this.currentFilter = 'best-selling'; // Mặc định hiển thị "Bán chạy"
        this.currentSort = 'default';
    }
    
    /**
     * Set all products (NGUỒN DỮ LIỆU CHÍNH)
     * Đây là method chính để set dữ liệu
     */
    setAllProducts(products) {
        this.allProducts = products;
        this.products = products; // Sync để tương thích
        
        // Áp dụng lại filter hiện tại
        this.applyCurrentFilter();
        
        console.log('✅ All products set:', products.length);
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
        if (this.currentFilter) {
            this.filter(this.currentFilter);
        } else {
            this.filteredProducts = [...this.allProducts];
            this.displayedCount = this.initialCount; // Reset về initialCount (16)
            this.render();
        }
    }
    
    /**
     * Filter products
     */
    filter(filterType) {
        this.currentFilter = filterType;
        
        // LUÔN dùng allProducts làm nguồn
        const sourceProducts = this.allProducts;
        
        // Nếu chưa có dữ liệu, không làm gì
        if (!sourceProducts || sourceProducts.length === 0) {
            console.warn('⚠️ No products to filter');
            return;
        }
        
        switch (filterType) {
            case 'best-selling':
                // Bán chạy: Sắp xếp theo số lượng đã bán (purchases)
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.purchases || 0) - (a.purchases || 0));
                break;
            case 'favorite':
                // Yêu thích: Sắp xếp theo số lượt yêu thích (favorites_count)
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.favorites_count || 0) - (a.favorites_count || 0));
                break;
            case 'new':
                // Mới nhất: Sắp xếp theo ID giảm dần
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.id || 0) - (a.id || 0));
                break;
            case 'popular':
                // Giữ lại để tương thích ngược
                this.filteredProducts = sourceProducts.filter(p => (p.purchases || 0) > 10);
                break;
            case 'sale':
                // Giữ lại để tương thích ngược
                this.filteredProducts = sourceProducts.filter(p => 
                    p.original_price && p.original_price > p.price
                );
                break;
            default:
                this.filteredProducts = [...sourceProducts];
        }
        
        // Reset về số lượng ban đầu
        this.displayedCount = this.initialCount; // Reset về initialCount (16)
        this.render();
        
        console.log(`🔍 Filter "${filterType}": ${this.filteredProducts.length} products`);
    }
    
    /**
     * Filter products by category
     */
    filterByCategory(categoryId) {
        console.log('ProductGrid: Filtering by category:', categoryId);
        
        // LUÔN dùng allProducts làm nguồn
        const sourceProducts = this.allProducts;
        
        // Nếu chưa có dữ liệu, không làm gì
        if (!sourceProducts || sourceProducts.length === 0) {
            console.warn('⚠️ No products to filter by category');
            return;
        }
        
        if (!categoryId) {
            // No category selected, show all products
            this.filteredProducts = [...sourceProducts];
        } else {
            // Filter products by category
            this.filteredProducts = sourceProducts.filter(product => {
                // Check if product has categories array
                if (Array.isArray(product.categories)) {
                    return product.categories.some(cat => cat.id === categoryId);
                }
                // Check if product has category_id
                if (product.category_id) {
                    return product.category_id === categoryId;
                }
                // Check if product has category_ids array
                if (Array.isArray(product.category_ids)) {
                    return product.category_ids.includes(categoryId);
                }
                return false;
            });
        }
        
        console.log('ProductGrid: Filtered products:', this.filteredProducts.length);
        
        // Reset về số lượng ban đầu
        this.displayedCount = this.initialCount; // Reset về initialCount (16)
        this.render();
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
        this.displayedCount += this.itemsPerPage;
        this.render();
    }
    
    /**
     * Check if has more products
     */
    hasMore() {
        return this.displayedCount < this.filteredProducts.length;
    }
    
    /**
     * Render products
     */
    render() {
        const productsToShow = this.filteredProducts.slice(0, this.displayedCount);
        renderProducts(productsToShow, this.containerId);
        
        // Update load more button
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
