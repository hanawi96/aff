// ============================================
// API SERVICE - All API Calls
// ============================================

import { CONFIG } from '../constants/config.js';

class ApiService {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        // Cache for API responses
        this.cache = {
            products: null,
            categories: null,
            flashSales: null,
            timestamp: {}
        };
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    /**
     * Check if cache is valid
     */
    isCacheValid(key) {
        if (!this.cache[key]) return false;
        const timestamp = this.cache.timestamp[key];
        if (!timestamp) return false;
        return (Date.now() - timestamp) < this.cacheTimeout;
    }
    
    /**
     * Set cache
     */
    setCache(key, data) {
        this.cache[key] = data;
        this.cache.timestamp[key] = Date.now();
    }
    
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    }
    
    async post(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    }
    
    // Product APIs with caching
    async getAllProducts(forceRefresh = false) {
        // Check cache first (skip if forceRefresh)
        if (!forceRefresh && this.isCacheValid('products')) {
            console.log('📦 Using cached products');
            return this.cache.products;
        }
        
        console.log('🌐 Fetching products from API');
        const data = await this.get('/get', { action: 'getAllProducts' });
        const allProducts = data.products || data || [];
        const activeProducts = allProducts.filter(p => p.is_active === 1);
        
        // Cache the result
        this.setCache('products', activeProducts);
        
        return activeProducts;
    }
    
    /**
     * Clear cache for specific key or all
     */
    clearCache(key = null) {
        if (key) {
            this.cache[key] = null;
            delete this.cache.timestamp[key];
            console.log(`🗑️ Cleared cache for: ${key}`);
        } else {
            this.cache = {
                products: null,
                categories: null,
                flashSales: null,
                timestamp: {}
            };
            console.log('🗑️ Cleared all cache');
        }
    }
    
    /**
     * Get products with pagination (client-side)
     */
    async getProductsPaginated(page = 1, limit = 12) {
        const allProducts = await this.getAllProducts();
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            products: allProducts.slice(start, end),
            total: allProducts.length,
            page,
            limit,
            hasMore: end < allProducts.length
        };
    }
    
    async getProductById(id) {
        const data = await this.get('/get', { action: 'getProductById', id });
        return data.product || null;
    }
    
    // Category APIs with caching
    async getAllCategories() {
        // Check cache first
        if (this.isCacheValid('categories')) {
            console.log('📦 Using cached categories');
            return this.cache.categories;
        }
        
        console.log('🌐 Fetching categories from API');
        const data = await this.get('/get', { action: 'getAllCategories' });
        const categories = data.categories || data || [];
        
        // Cache the result
        this.setCache('categories', categories);
        
        return categories;
    }
    
    // Flash Sale APIs with caching
    async getActiveFlashSales() {
        // Check cache first
        if (this.isCacheValid('flashSales')) {
            console.log('📦 Using cached flash sales');
            return this.cache.flashSales;
        }
        
        console.log('🌐 Fetching flash sales from API');
        const data = await this.get('/get', { action: 'getActiveFlashSales' });
        const salesArray = data.flashSales || data || [];
        
        // Load products for each flash sale
        for (let flashSale of salesArray) {
            const productsData = await this.get('/get', {
                action: 'getFlashSaleProducts',
                flashSaleId: flashSale.id
            });
            flashSale.products = productsData.products || productsData || [];
        }
        
        // Cache the result
        this.setCache('flashSales', salesArray);
        
        return salesArray;
    }
    
    // Order APIs
    async createOrder(orderData) {
        return await this.post('/post', {
            action: 'createOrder',
            ...orderData
        });
    }
    
    /**
     * Clear cache (useful for testing or after updates)
     */
    clearCache() {
        this.cache = {
            products: null,
            categories: null,
            flashSales: null,
            timestamp: {}
        };
        console.log('🗑️ Cache cleared');
    }
}

// Export singleton instance
export const apiService = new ApiService();
