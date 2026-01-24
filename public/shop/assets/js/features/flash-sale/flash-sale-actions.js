// ============================================
// FLASH SALE ACTIONS
// ============================================

import { cartService } from '../../shared/services/cart.service.js';

/**
 * Flash Sale Actions Handler
 */
export class FlashSaleActions {
    constructor(flashSales) {
        this.flashSales = flashSales;
    }
    
    /**
     * Update flash sales data
     */
    setFlashSales(flashSales) {
        this.flashSales = flashSales;
    }
    
    /**
     * Get active flash sale
     */
    getActiveFlashSale() {
        return this.flashSales.find(fs => fs.status === 'active');
    }
    
    /**
     * Find product in flash sales
     */
    findProduct(productId) {
        const activeFlashSale = this.getActiveFlashSale();
        if (!activeFlashSale) return null;
        
        return activeFlashSale.products.find(p => p.id === productId);
    }
    
    /**
     * Add flash sale product to cart
     */
    addToCart(productId, flashPrice) {
        const product = this.findProduct(productId);
        if (!product) {
            console.error('Flash sale product not found:', productId);
            return;
        }
        
        const cartItem = {
            id: product.id,
            name: product.product_name,
            price: flashPrice,
            originalPrice: product.original_price,
            image: product.image_url,
            maxQuantity: product.stock_limit - product.sold_count || 99,
            badges: ['Flash Sale'],
            isFlashSale: true
        };
        
        cartService.addItem(cartItem, 1);
        this.updateCartUI();
    }
    
    /**
     * Buy now - open quick checkout
     */
    buyNow(productId, flashPrice) {
        const product = this.findProduct(productId);
        if (!product) {
            console.error('Flash sale product not found:', productId);
            return;
        }
        
        // Trigger quick checkout
        if (window.quickCheckout) {
            window.quickCheckout.open({
                id: product.id,
                name: product.product_name,
                price: flashPrice,
                originalPrice: product.original_price,
                image: product.image_url,
                maxQuantity: product.stock_limit - product.sold_count || 99,
                isFlashSale: true
            });
        }
    }
    
    /**
     * Update cart UI
     */
    updateCartUI() {
        const badge = document.getElementById('cartCount');
        if (badge) {
            const itemCount = cartService.getItemCount();
            badge.textContent = itemCount;
        }
    }
}
