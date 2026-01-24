/* ============================================
   CONFIGURATION
   ============================================ */

// API Configuration
const API_CONFIG = {
    // Base URL - Use production API
    BASE_URL: 'https://ctv-api.yendev96.workers.dev',
    
    // Endpoints
    ENDPOINTS: {
        // Products
        GET_ALL_PRODUCTS: '/?action=getAllProducts',
        GET_PRODUCT: '/?action=getProduct',
        GET_PRODUCTS_BY_CATEGORY: '/?action=getProductsByCategory',
        
        // Categories
        GET_ALL_CATEGORIES: '/?action=getAllCategories',
        
        // Flash Sales
        GET_ALL_FLASH_SALES: '/?action=getAllFlashSales',
        GET_ACTIVE_FLASH_SALES: '/?action=getActiveFlashSales',
        GET_FLASH_SALE: '/?action=getFlashSale',
        
        // Discounts
        VALIDATE_DISCOUNT: '/?action=validateDiscount',
        
        // Orders
        CREATE_ORDER: '/?action=createOrder',
        
        // CTV
        VALIDATE_REFERRAL_CODE: '/?action=validateReferralCode',
    },
    
    // Request timeout
    TIMEOUT: 30000,
};

// App Configuration
const APP_CONFIG = {
    // Site name
    SITE_NAME: 'Vòng Đầu Tâm',
    
    // Currency
    CURRENCY: 'đ',
    
    // Shipping
    FREE_SHIPPING_THRESHOLD: 300000,
    DEFAULT_SHIPPING_FEE: 30000,
    
    // Cart
    CART_STORAGE_KEY: 'vdt_cart',
    CUSTOMER_INFO_KEY: 'vdt_customer_info',
    REFERRAL_CODE_KEY: 'vdt_referral_code',
    
    // Pagination
    PRODUCTS_PER_PAGE: 12,
    
    // Image placeholder
    PLACEHOLDER_IMAGE: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f3f4f6" width="400" height="400"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E',
};

// Export for use in other files
window.API_CONFIG = API_CONFIG;
window.APP_CONFIG = APP_CONFIG;
