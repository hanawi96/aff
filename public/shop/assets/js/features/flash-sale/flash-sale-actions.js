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
        this.babyWeightModal = null;
    }
    
    /**
     * Set baby weight modal instance
     */
    setBabyWeightModal(modal) {
        this.babyWeightModal = modal;
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
        
        // Check if product needs baby weight selection
        if (this.babyWeightModal && this.babyWeightModal.needsBabyWeight(product)) {
            // Open modal with callback
            this.babyWeightModal.open(product, (selectedWeight, surcharge = 0) => {
                this.addToCartWithWeight(product, flashPrice, selectedWeight, surcharge);
            });
        } else {
            // Add directly without baby weight
            this.addToCartWithWeight(product, flashPrice, null, 0);
        }
    }
    
    /**
     * Add flash sale product to cart with weight
     */
    addToCartWithWeight(product, flashPrice, weight, surcharge = 0) {
        // Calculate final price with surcharge
        const finalPrice = flashPrice + surcharge;
        
        const cartItem = {
            id: product.id,
            name: product.product_name,
            price: finalPrice, // Use flash price with surcharge
            originalPrice: product.original_price,
            image: product.image_url,
            maxQuantity: product.stock_limit - product.sold_count || 99,
            badges: ['Flash Sale'],
            isFlashSale: true,
            size: weight || '', // Add weight as size
            weightSurcharge: surcharge // Store surcharge for reference
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
                isFlashSale: true,
                categories: product.categories || [] // Pass categories for baby weight check
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
    
    /**
     * Preview product image
     */
    previewImage(imageUrl, productName) {
        const modal = document.getElementById('imagePreviewModal');
        const img = document.getElementById('imagePreviewImg');
        const title = document.getElementById('imagePreviewTitle');
        
        if (modal && img && title) {
            img.src = imageUrl;
            img.alt = productName;
            title.textContent = productName;
            modal.classList.add('active');
            
            // Close on click outside
            modal.onclick = (e) => {
                if (e.target === modal) {
                    window.closeImagePreview();
                }
            };
            
            // Close on ESC key
            document.addEventListener('keydown', this.handleEscKey);
        }
    }
    
    /**
     * Handle ESC key press
     */
    handleEscKey(e) {
        if (e.key === 'Escape') {
            window.closeImagePreview();
        }
    }
}

// Global function to close image preview
window.closeImagePreview = function() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.classList.remove('active');
        document.removeEventListener('keydown', FlashSaleActions.prototype.handleEscKey);
    }
};
