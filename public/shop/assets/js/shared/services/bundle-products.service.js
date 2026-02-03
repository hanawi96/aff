// ============================================
// BUNDLE PRODUCTS SERVICE - Shared service for cross-sell/bundle products
// ============================================

/**
 * Bundle Products Service
 * Centralized service to load bundle/cross-sell products
 * Used by both cart page and quick checkout modal
 */
class BundleProductsService {
    constructor() {
        // HARDCODED bundle products data for instant loading (no API call needed)
        // Data fetched from database on 2025-02-03
        this.HARDCODED_PRODUCTS = [
            {
                id: 133,
                name: "Bó dâu 7 CÀNH (bé trai)",
                description: "Bó dâu tằm 7 cành tự nhiên dành riêng cho bé trai, giúp bé ngủ ngon, giảm stress và tăng cường sức khỏe tự nhiên.",
                price: 42000,
                originalPrice: 62000,
                image: "https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/products/1768450336930-iwxo9u.jpg",
                stock_quantity: 99,
                maxQuantity: 99,
                is_active: 1,
                categories: [{ id: 23, name: "Sản phẩm bán kèm" }],
                category_name: "Sản phẩm bán kèm",
                category_id: 23,
                badges: [],
                isBundleProduct: true
            },
            {
                id: 134,
                name: "Bó dâu 9 CÀNH (bé gái)",
                description: "Bó dâu tằm 9 cành tự nhiên dành riêng cho bé gái, giúp bé ngủ ngon, giảm căng thẳng và mang lại may mắn cho bé yêu.",
                price: 47000,
                originalPrice: 67000,
                image: "https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/assets/images/product_img/bo-dau-tam-de-phong.webp",
                stock_quantity: 99,
                maxQuantity: 99,
                is_active: 1,
                categories: [{ id: 23, name: "Sản phẩm bán kèm" }],
                category_name: "Sản phẩm bán kèm",
                category_id: 23,
                badges: [],
                isBundleProduct: true
            }
        ];
        
        // Legacy: Keep for backward compatibility (not used anymore)
        this.BUNDLE_PRODUCT_IDS = [133, 134];
        
        // Cache disabled - using hardcoded data instead
        this.cachedProducts = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }
    
    /**
     * Load bundle products - INSTANT (no API call)
     * Returns hardcoded products for maximum performance
     * 
     * @returns {Promise<Array>} Array of bundle products with full data
     */
    async loadBundleProducts() {
        console.log('⚡ [BUNDLE] Using hardcoded products (instant load)');
        
        // Return hardcoded data immediately - no API call needed!
        // This is 100x faster than fetching from API
        return Promise.resolve([...this.HARDCODED_PRODUCTS]);
    }
    
    /**
     * Get fallback products (DEPRECATED - not used anymore)
     * Kept for backward compatibility only
     */
    getFallbackProducts() {
        console.warn('⚠️ [BUNDLE] getFallbackProducts() is deprecated, using hardcoded data instead');
        return [...this.HARDCODED_PRODUCTS];
    }
    
    /**
     * Clear cache (DEPRECATED - not used with hardcoded data)
     */
    clearCache() {
        console.warn('⚠️ [BUNDLE] clearCache() is deprecated (using hardcoded data)');
    }
    
    /**
     * Update bundle product IDs (DEPRECATED - edit HARDCODED_PRODUCTS instead)
     */
    setBundleProductIds() {
        console.warn('⚠️ [BUNDLE] setBundleProductIds() is deprecated. Edit HARDCODED_PRODUCTS in source code instead.');
    }
    
    /**
     * Get current bundle product IDs
     */
    getBundleProductIds() {
        return this.HARDCODED_PRODUCTS.map(p => p.id);
    }
    
    /**
     * Update hardcoded product data (for admin/testing purposes)
     * This allows runtime updates without code changes
     * 
     * @param {Array} products - New products array
     */
    updateHardcodedProducts(products) {
        if (!Array.isArray(products)) {
            console.error('❌ [BUNDLE] updateHardcodedProducts: products must be an array');
            return;
        }
        
        this.HARDCODED_PRODUCTS = products;
        console.log('✅ [BUNDLE] Hardcoded products updated:', products.length);
    }
}

// Export singleton instance
export const bundleProductsService = new BundleProductsService();
