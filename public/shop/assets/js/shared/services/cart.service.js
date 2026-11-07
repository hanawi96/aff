// ============================================
// CART SERVICE - Cart Operations
// ============================================

import { storageService } from './storage.service.js';
import { showToast } from '../utils/helpers.js';

class CartService {
    constructor() {
        this.cart = storageService.getCart();
    }
    
    getCart() {
        return this.cart;
    }
    
    getItemCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }
    
    getTotal() {
        return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
    
    addItem(product, quantity = 1) {
        // Cùng SP + cân nặng + tên khắc → cộng dồn; khác tên khắc thì tách dòng
        const existingItem = this.cart.find(item =>
            item.id === product.id
            && item.size === (product.size || '')
            && (item.note || '') === (product.note || '')
        );
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                image: product.image,
                quantity: quantity,
                maxQuantity: product.maxQuantity || 99,
                badges: product.badges || [],
                isFlashSale: product.isFlashSale || false,
                size: product.size || '', // Add baby weight (size)
                note: product.note || '', // Add product note (vd. Tên bé khắc)
                weightSurcharge: product.weightSurcharge || 0, // Add weight surcharge
                categories: product.categories || [],
                category_id: product.category_id ?? null,
                category_ids: product.category_ids || []
            });
        }
        
        this.save();
        showToast('Đã thêm vào giỏ hàng!');
        return true;
    }
    
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = Math.max(1, Math.min(quantity, item.maxQuantity));
            this.save();
            return true;
        }
        return false;
    }
    
    removeItem(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.save();
        showToast('Đã xóa sản phẩm');
        return true;
    }
    
    clear() {
        this.cart = [];
        storageService.clearCart();
        return true;
    }
    
    save() {
        storageService.saveCart(this.cart);
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('cartUpdated'));
    }
}

// Export singleton instance
export const cartService = new CartService();
