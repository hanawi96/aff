// ============================================
// PRODUCT ACTIONS - Add to Cart, Buy Now, etc.
// ============================================

import { cartService } from '../../shared/services/cart.service.js';
import { showToast } from '../../shared/utils/helpers.js';

/**
 * Product Actions Handler
 */
export class ProductActions {
    constructor(products) {
        this.products = products;
    }
    
    /**
     * Update products data
     */
    setProducts(products) {
        this.products = products;
    }
    
    /**
     * Add product to cart
     */
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('Product not found:', productId);
            return;
        }
        
        const cartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.original_price,
            image: product.image_url,
            maxQuantity: 99,
            badges: [],
            isFlashSale: false
        };
        
        // Add badges
        if (product.is_handmade === 1) {
            cartItem.badges.push('Thủ công 100%');
        }
        if (product.is_chemical_free === 1) {
            cartItem.badges.push('Không hóa chất');
        }
        
        cartService.addItem(cartItem, 1);
        this.updateCartUI();
    }
    
    /**
     * Buy now - open quick checkout
     */
    buyNow(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('Product not found:', productId);
            return;
        }
        
        // Trigger quick checkout
        if (window.quickCheckout) {
            window.quickCheckout.open({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.original_price,
                image: product.image_url,
                maxQuantity: 99,
                isFlashSale: false,
                categories: product.categories || [] // Pass categories
            });
        }
    }
    
    /**
     * Quick view product
     */
    quickView(productId) {
        console.log('Quick view:', productId);
        showToast('Tính năng đang phát triển');
        // TODO: Implement quick view modal
    }
    
    /**
     * Add favorite (simple increment, no toggle)
     * Allow unlimited clicks
     */
    async toggleFavorite(productId) {
        const btn = document.querySelector(`[data-product-id="${productId}"] .product-favorites-btn`);
        if (!btn) return;
        
        const countSpan = btn.querySelector('.favorites-count');
        
        try {
            // Detect if running on localhost and use appropriate URL
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const baseUrl = isLocalhost ? 'http://localhost:8787' : '';
            
            // Always POST to add favorite
            const response = await fetch(`${baseUrl}/api/products/${productId}/favorite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update count
                countSpan.textContent = data.favorites_count || 0;
                
                // Show animation
                btn.classList.add('pulse');
                setTimeout(() => btn.classList.remove('pulse'), 300);
                
                showToast('❤️ +1 yêu thích');
            } else {
                throw new Error(data.error || 'Failed to add favorite');
            }
            
        } catch (error) {
            console.error('Error adding favorite:', error);
            showToast('Có lỗi xảy ra, vui lòng thử lại');
        }
    }
    
    /**
     * Add to wishlist (deprecated - use toggleFavorite instead)
     */
    addToWishlist(productId) {
        console.log('Add to wishlist:', productId);
        showToast('Đã thêm vào danh sách yêu thích');
        // TODO: Implement wishlist
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
