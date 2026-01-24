// ============================================
// API SERVICE - All API Calls
// ============================================

import { CONFIG } from '../config/constants.js';

class ApiService {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
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
    
    // Product APIs
    async getAllProducts() {
        const data = await this.get('/get', { action: 'getAllProducts' });
        const allProducts = data.products || data || [];
        return allProducts.filter(p => p.is_active === 1);
    }
    
    async getProductById(id) {
        const data = await this.get('/get', { action: 'getProductById', id });
        return data.product || null;
    }
    
    // Category APIs
    async getAllCategories() {
        const data = await this.get('/get', { action: 'getAllCategories' });
        return data.categories || data || [];
    }
    
    // Flash Sale APIs
    async getActiveFlashSales() {
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
