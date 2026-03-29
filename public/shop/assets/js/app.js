// ============================================
// APP.JS - MAIN ENTRY POINT (MODULAR)
// ============================================

import { loadCommonPartials } from './shared/partials-loader.js';
import { HomePage } from './pages/home.page.js';
import './shared/utils/image-preview.js'; // Import image preview utility
import { checkAndSaveReferralFromURL } from './shared/utils/ctv-tracking.js'; // Import CTV tracking

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
            // Run referral tracking in background to avoid blocking initial render.
            checkAndSaveReferralFromURL().catch((error) => {
                console.warn('Referral tracking init failed (non-blocking):', error);
            });
            
            // Detect current page
            const page = this.detectPage();
            
            // Load common partials (header, footer, modals) for all pages except cart
            if (page !== 'cart') {
                await loadCommonPartials();
            }
            
            // Initialize appropriate page
            switch (page) {
                case 'home':
                    // Load debug panel only when explicitly requested.
                    if (new URLSearchParams(window.location.search).get('ctvdebug') === '1') {
                        import('./shared/components/ctv-debug-panel.js').catch((error) => {
                            console.warn('CTV debug panel load failed:', error);
                        });
                    }
                    this.currentPage = new HomePage();
                    await this.currentPage.init();
                    break;
                    
                case 'cart':
                    // Cart page uses its own cart.js (no partials needed)
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
        
        if (path.includes('shop/cart.html')) {
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
