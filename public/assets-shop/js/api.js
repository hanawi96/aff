/* ============================================
   API SERVICE
   ============================================ */

class ApiService {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
        this.timeout = API_CONFIG.TIMEOUT;
    }

    // Generic fetch with timeout
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // GET request
    async get(endpoint) {
        const fullUrl = this.baseUrl + endpoint;
        console.log('🌐 API GET:', fullUrl);
        
        try {
            const response = await this.fetchWithTimeout(fullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Response data:', data);
            return data;
        } catch (error) {
            console.error('❌ API GET Error:', error);
            throw error;
        }
    }

    // POST request
    async post(endpoint, body) {
        try {
            const response = await this.fetchWithTimeout(this.baseUrl + endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    }

    // Get all products
    async getAllProducts() {
        return this.get(API_CONFIG.ENDPOINTS.GET_ALL_PRODUCTS);
    }

    // Get single product
    async getProduct(id) {
        return this.get(`${API_CONFIG.ENDPOINTS.GET_PRODUCT}&id=${id}`);
    }

    // Get products by category
    async getProductsByCategory(categoryId) {
        return this.get(`${API_CONFIG.ENDPOINTS.GET_PRODUCTS_BY_CATEGORY}&categoryId=${categoryId}`);
    }

    // Get all categories
    async getAllCategories() {
        return this.get(API_CONFIG.ENDPOINTS.GET_ALL_CATEGORIES);
    }

    // Get all flash sales
    async getAllFlashSales() {
        return this.get(API_CONFIG.ENDPOINTS.GET_ALL_FLASH_SALES);
    }

    // Get active flash sales
    async getActiveFlashSales() {
        return this.get(API_CONFIG.ENDPOINTS.GET_ACTIVE_FLASH_SALES);
    }

    // Get single flash sale
    async getFlashSale(id) {
        return this.get(`${API_CONFIG.ENDPOINTS.GET_FLASH_SALE}&id=${id}`);
    }

    // Validate discount code
    async validateDiscount(code, orderAmount, customerPhone) {
        return this.post(API_CONFIG.ENDPOINTS.VALIDATE_DISCOUNT, {
            code,
            orderAmount,
            customerPhone
        });
    }

    // Create order
    async createOrder(orderData) {
        return this.post(API_CONFIG.ENDPOINTS.CREATE_ORDER, orderData);
    }

    // Validate referral code
    async validateReferralCode(code) {
        return this.get(`${API_CONFIG.ENDPOINTS.VALIDATE_REFERRAL_CODE}&code=${code}`);
    }
}

// Initialize API service
const api = new ApiService();

// Export to window
window.api = api;
