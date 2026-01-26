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
        this.products = [];
        this.allProducts = []; // Store all products for filtering
        this.filteredProducts = [];
        this.displayedCount = options.initialCount || 12;
        this.itemsPerPage = options.itemsPerPage || 12;
        this.currentFilter = 'best-selling'; // Mặc định hiển thị "Bán chạy"
        this.currentSort = 'default';
    }
    
    /**
     * Set all products (for filtering/sorting)
     */
    setAllProducts(products) {
        this.allProducts = products;
        
        // Update filteredProducts to use all products
        if (this.currentFilter === 'all' || this.currentFilter === 'best-selling') {
            // Apply default filter (best-selling)
            this.filter(this.currentFilter);
            return; // filter() already calls render()
        } else {
            // Re-apply current filter with all products
            this.filter(this.currentFilter);
            return; // filter() already calls render()
        }
    }
    
    /**
     * Set products data
     */
    setProducts(products) {
        this.products = products;
        this.filteredProducts = [...products];
        this.render();
    }
    
    /**
     * Filter products
     */
    filter(filterType) {
        this.currentFilter = filterType;
        
        // Use allProducts if available, otherwise use products
        const sourceProducts = this.allProducts.length > 0 ? this.allProducts : this.products;
        
        switch (filterType) {
            case 'best-selling':
                // Bán chạy: Sắp xếp theo số lượng đã bán (purchases)
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.purchases || 0) - (a.purchases || 0))
                    .slice(0, 20); // Lấy top 20 sản phẩm bán chạy nhất
                break;
            case 'favorite':
                // Yêu thích: Sắp xếp theo số lượt yêu thích (favorites_count)
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.favorites_count || 0) - (a.favorites_count || 0))
                    .slice(0, 20); // Lấy top 20 sản phẩm được yêu thích nhất
                break;
            case 'new':
                // Mới nhất: Sắp xếp theo ID giảm dần
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.id || 0) - (a.id || 0))
                    .slice(0, 20);
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
        
        this.displayedCount = this.itemsPerPage;
        this.render();
    }
    
    /**
     * Filter products by category
     */
    filterByCategory(categoryId) {
        console.log('ProductGrid: Filtering by category:', categoryId);
        
        // Use allProducts if available, otherwise use products
        const sourceProducts = this.allProducts.length > 0 ? this.allProducts : this.products;
        
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
        
        this.displayedCount = this.itemsPerPage;
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
