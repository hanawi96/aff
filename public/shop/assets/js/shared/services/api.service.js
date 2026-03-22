// ============================================
// API SERVICE - All API Calls
// ============================================

import { CONFIG } from '../constants/config.js';

class ApiService {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.storageKey = 'shop_api_cache_v1';
        // Cache for API responses
        this.cache = {
            products: null,
            categories: null,
            flashSales: null,
            timestamp: {}
        };
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        /** true nếu getProductsPage không dùng được — chỉ phân trang client, tránh lặp fallback mỗi trang */
        this._shopUseClientPagination = false;
        this.hydrateCacheFromSession();
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
     * Catalog SP còn TTL — trả về mảng ngay (sync), không gọi mạng.
     * Dùng cho paint tức thì (không chờ microtask của await).
     */
    getValidCachedProductsSync() {
        if (!this.isCacheValid('products')) return null;
        const list = this.cache.products;
        if (!Array.isArray(list) || list.length === 0) return null;
        return list;
    }

    /**
     * Session còn mảng SP nhưng TTL hết — dùng stale-first paint, sau đó revalidate nền.
     */
    peekStaleProducts() {
        if (this.isCacheValid('products')) return null;
        const list = this.cache.products;
        if (!Array.isArray(list) || list.length === 0) return null;
        return list;
    }
    
    /**
     * Set cache
     */
    setCache(key, data) {
        this.cache[key] = data;
        this.cache.timestamp[key] = Date.now();
        this.persistCacheToSession();
    }

    hydrateCacheFromSession() {
        try {
            const raw = sessionStorage.getItem(this.storageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;

            this.cache = {
                products: parsed.products || null,
                categories: parsed.categories || null,
                flashSales: parsed.flashSales || null,
                timestamp: parsed.timestamp || {}
            };
        } catch (error) {
            console.warn('Failed to hydrate API cache from sessionStorage:', error);
        }
    }

    persistCacheToSession() {
        try {
            sessionStorage.setItem(this.storageKey, JSON.stringify(this.cache));
        } catch (error) {
            // Ignore quota / private mode errors
        }
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
     * Paginated products for shop home (same fields as getAllProducts, smaller per request).
     * @param {number} page - 1-based
     * @param {number} limit - max 100 on server
     *
     * Fallback: nếu API trả 400 (Worker cũ chưa có action getProductsPage) hoặc lỗi mạng —
     * dùng getAllProducts + cắt trang phía client (ORDER BY name giống server).
     */
    async getProductsPage(page = 1, limit = 16) {
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(String(limit), 10) || 16), 100);

        const fallbackFromFullCatalog = async () => {
            console.warn(
                '📦 getProductsPage: fallback — getAllProducts + phân trang client (API không hỗ trợ getProductsPage hoặc lỗi)'
            );
            const all = await this.getAllProducts();
            const sorted = [...all].sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' })
            );
            const total = sorted.length;
            const offset = (pageNum - 1) * limitNum;
            const products = sorted.slice(offset, offset + limitNum);
            return {
                products,
                total,
                page: pageNum,
                limit: limitNum,
                hasMore: offset + products.length < total
            };
        };

        if (this._shopUseClientPagination) {
            return await fallbackFromFullCatalog();
        }

        try {
            const data = await this.get('/get', {
                action: 'getProductsPage',
                page: String(pageNum),
                limit: String(limitNum)
            });
            const products = (data.products || []).filter((p) => p.is_active === 1);
            return {
                products,
                total: data.total ?? 0,
                page: data.page ?? pageNum,
                limit: data.limit ?? limitNum,
                hasMore: Boolean(data.hasMore)
            };
        } catch (err) {
            console.warn('getProductsPage request failed:', err?.message || err);
            this._shopUseClientPagination = true;
            return await fallbackFromFullCatalog();
        }
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

        this.persistCacheToSession();
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

        // Load products for each flash sale in parallel to reduce total wait time.
        await Promise.all(salesArray.map(async (flashSale) => {
            const productsData = await this.get('/get', {
                action: 'getFlashSaleProducts',
                flashSaleId: flashSale.id
            });
            flashSale.products = productsData.products || productsData || [];
        }));
        
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
    
}

// Export singleton instance
export const apiService = new ApiService();
