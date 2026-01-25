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
        this.currentFilter = 'all';
        this.currentSort = 'default';
    }
    
    /**
     * Set all products (for filtering/sorting)
     */
    setAllProducts(products) {
        this.allProducts = products;
        
        // Update filteredProducts to use all products
        if (this.currentFilter === 'all') {
            this.filteredProducts = [...products];
        } else {
            // Re-apply current filter with all products
            this.filter(this.currentFilter);
            return; // filter() already calls render()
        }
        
        console.log('📦 All products loaded:', products.length);
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
            case 'popular':
                this.filteredProducts = sourceProducts.filter(p => (p.purchases || 0) > 10);
                break;
            case 'new':
                this.filteredProducts = [...sourceProducts]
                    .sort((a, b) => (b.id || 0) - (a.id || 0))
                    .slice(0, 20);
                break;
            case 'sale':
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
    }
}
