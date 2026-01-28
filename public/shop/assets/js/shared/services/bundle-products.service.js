// ============================================
// BUNDLE PRODUCTS SERVICE - Shared service for cross-sell/bundle products
// ============================================

import { CONFIG } from '../constants/config.js';

/**
 * Bundle Products Service
 * Centralized service to load bundle/cross-sell products
 * Used by both cart page and quick checkout modal
 */
class BundleProductsService {
    constructor() {
        // Fixed product IDs for bundle products (cross-sell)
        // These are the ONLY products shown in bundle/cross-sell sections
        this.BUNDLE_PRODUCT_IDS = [133, 134];
        
        // Cache to avoid multiple API calls
        this.cachedProducts = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }
    
    /**
     * Load bundle products from API
     * Returns only products with IDs in BUNDLE_PRODUCT_IDS
     * 
     * @returns {Promise<Array>} Array of bundle products with full data
     */
    async loadBundleProducts() {
        // Check cache first
        if (this.cachedProducts && this.cacheTimestamp) {
            const now = Date.now();
            if (now - this.cacheTimestamp < this.CACHE_DURATION) {
                console.log('📦 [BUNDLE] Using cached products');
                return this.cachedProducts;
            }
        }
        
        try {
            console.log('📦 [BUNDLE] Loading products from API...');
            
            // Load all active products
            const apiUrl = `${CONFIG.API_BASE_URL}/api/shop/products`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.products) {
                throw new Error('Invalid API response');
            }
            
            // Filter to get only our bundle products by ID
            const bundleProducts = data.products.filter(product => 
                this.BUNDLE_PRODUCT_IDS.includes(product.id)
            );
            
            if (bundleProducts.length === 0) {
                console.warn('⚠️ [BUNDLE] No products found with IDs:', this.BUNDLE_PRODUCT_IDS);
                throw new Error('Bundle products not found in database');
            }
            
            // Sort by our predefined order
            bundleProducts.sort((a, b) => {
                return this.BUNDLE_PRODUCT_IDS.indexOf(a.id) - this.BUNDLE_PRODUCT_IDS.indexOf(b.id);
            });
            
            // Transform to consistent format
            const transformedProducts = bundleProducts.map(product => ({
                // Basic info
                id: product.id,
                name: product.name,
                description: product.description || '',
                
                // Pricing
                price: product.price,
                originalPrice: product.original_price || null,
                
                // Images
                image: product.image_url || product.image || '/assets/images/product_img/tat-ca-mau.webp',
                
                // Stock & availability
                stock_quantity: product.stock_quantity || 99,
                maxQuantity: product.stock_quantity || 99,
                is_active: product.is_active,
                
                // Categories (full data for filtering/display)
                categories: product.categories || [],
                category_name: product.category_name || '',
                category_id: product.category_id || null,
                
                // Badges & features
                badges: product.badges || [],
                
                // Metadata
                isBundleProduct: true,
                
                // Keep all other fields for compatibility
                ...product
            }));
            
            // Cache the results
            this.cachedProducts = transformedProducts;
            this.cacheTimestamp = Date.now();
            
            console.log('✅ [BUNDLE] Loaded', transformedProducts.length, 'bundle products');
            return transformedProducts;
            
        } catch (error) {
            console.error('❌ [BUNDLE] Error loading products:', error);
            
            // Fallback: Return minimal data structure
            // This ensures UI doesn't break, but data may be outdated
            console.warn('⚠️ [BUNDLE] Using fallback minimal data');
            return this.getFallbackProducts();
        }
    }
    
    /**
     * Get fallback products (minimal data)
     * Used only when API fails
     */
    getFallbackProducts() {
        return [
            {
                id: 133,
                name: 'Bó đầu 7 CÀNH (bé trai)',
                description: 'Bó dâu tằm 7 cành tự nhiên',
                price: 42000,
                originalPrice: null,
                image: 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/products/1768450336930-iwxo9u.jpg',
                stock_quantity: 99,
                maxQuantity: 99,
                is_active: 1,
                categories: [],
                isBundleProduct: true
            },
            {
                id: 134,
                name: 'Bó đầu 9 CÀNH (bé gái)',
                description: 'Bó dâu tằm 9 cành tự nhiên',
                price: 47000,
                originalPrice: null,
                image: 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/products/1768450336930-iwxo9u.jpg',
                stock_quantity: 99,
                maxQuantity: 99,
                is_active: 1,
                categories: [],
                isBundleProduct: true
            }
        ];
    }
    
    /**
     * Clear cache (useful for testing or after product updates)
     */
    clearCache() {
        this.cachedProducts = null;
        this.cacheTimestamp = null;
        console.log('🗑️ [BUNDLE] Cache cleared');
    }
    
    /**
     * Update bundle product IDs
     * Call this if you want to change which products are shown
     * 
     * @param {Array<number>} productIds - Array of product IDs
     */
    setBundleProductIds(productIds) {
        this.BUNDLE_PRODUCT_IDS = productIds;
        this.clearCache();
        console.log('🔄 [BUNDLE] Updated product IDs:', productIds);
    }
    
    /**
     * Get current bundle product IDs
     */
    getBundleProductIds() {
        return [...this.BUNDLE_PRODUCT_IDS];
    }
}

// Export singleton instance
export const bundleProductsService = new BundleProductsService();
