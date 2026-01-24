// ============================================
// STORAGE SERVICE - LocalStorage Management
// ============================================

import { CONFIG } from '../constants/config.js';

class StorageService {
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Storage GET Error:', error);
            return null;
        }
    }
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage SET Error:', error);
            return false;
        }
    }
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage REMOVE Error:', error);
            return false;
        }
    }
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage CLEAR Error:', error);
            return false;
        }
    }
    
    // Cart specific methods
    getCart() {
        return this.get(CONFIG.STORAGE_KEY) || [];
    }
    
    saveCart(cart) {
        return this.set(CONFIG.STORAGE_KEY, cart);
    }
    
    clearCart() {
        return this.remove(CONFIG.STORAGE_KEY);
    }
    
    // Discount specific methods
    getDiscount() {
        return this.get(CONFIG.DISCOUNT_KEY);
    }
    
    saveDiscount(discount) {
        if (discount) {
            return this.set(CONFIG.DISCOUNT_KEY, discount);
        } else {
            return this.remove(CONFIG.DISCOUNT_KEY);
        }
    }
}

// Export singleton instance
export const storageService = new StorageService();
