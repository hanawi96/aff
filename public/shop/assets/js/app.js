// ============================================
// APP.JS - MAIN ENTRY POINT (MODULAR)
// ============================================

import { HomePage } from './pages/home.page.js';

/**
 * Application Entry Point
 */
class App {
    constructor() {
        this.currentPage = null;
    }
    
    /**
     * Initialize application
     */
    async init() {
        console.log('🚀 Initializing Vòng Đầu Tam Shop...');
        
        try {
            // Detect current page
            const page = this.detectPage();
            
            // Initialize appropriate page
            switch (page) {
                case 'home':
                    this.currentPage = new HomePage();
                    await this.currentPage.init();
                    break;
                    
                case 'cart':
                    // Cart page uses its own cart.js
                    console.log('Cart page - using cart.js');
                    break;
                    
                case 'checkout':
                    // TODO: Implement checkout page
                    console.log('Checkout page - TODO');
                    break;
                    
                default:
                    console.warn('Unknown page:', page);
            }
            
            console.log('✅ Application initialized successfully');
            
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
        }
    }
    
    /**
     * Detect current page
     */
    detectPage() {
        const path = window.location.pathname;
        
        if (path.includes('cart.html')) {
            return 'cart';
        } else if (path.includes('checkout.html')) {
            return 'checkout';
        } else {
            return 'home';
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});

// Export for debugging
window.App = App;
