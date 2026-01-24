/* ============================================
   CART MANAGEMENT
   ============================================ */

class Cart {
    constructor() {
        this.items = this.loadCart();
        this.updateCartBadge();
    }

    // Load cart from localStorage
    loadCart() {
        try {
            const cartData = localStorage.getItem(APP_CONFIG.CART_STORAGE_KEY);
            return cartData ? JSON.parse(cartData) : [];
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }

    // Save cart to localStorage
    saveCart() {
        try {
            localStorage.setItem(APP_CONFIG.CART_STORAGE_KEY, JSON.stringify(this.items));
            this.updateCartBadge();
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    // Add item to cart
    addItem(product, quantity = 1) {
        // Check if product already exists in cart
        const existingItem = this.items.find(item => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                price: product.flash_price || product.price,
                originalPrice: product.price,
                image: product.image_url,
                quantity: quantity,
                isFlashSale: !!product.flash_price
            });
        }

        this.saveCart();
        utils.showToast(`Đã thêm "${product.name}" vào giỏ hàng`, 'success');
        return true;
    }

    // Update item quantity
    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        
        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId);
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
        }
    }

    // Remove item from cart
    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveCart();
        utils.showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'info');
    }

    // Clear cart
    clearCart() {
        this.items = [];
        this.saveCart();
    }

    // Get cart items
    getItems() {
        return this.items;
    }

    // Get cart count
    getCount() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }

    // Get cart total
    getTotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Get cart subtotal (before discount)
    getSubtotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Update cart badge
    updateCartBadge() {
        const count = this.getCount();
        const badges = document.querySelectorAll('.cart-badge');
        
        badges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        });
    }

    // Check if product is in cart
    hasProduct(productId) {
        return this.items.some(item => item.id === productId);
    }

    // Get product quantity in cart
    getProductQuantity(productId) {
        const item = this.items.find(item => item.id === productId);
        return item ? item.quantity : 0;
    }
}

// Initialize cart
const cart = new Cart();

// Export to window
window.cart = cart;

// Update cart badge on page load
document.addEventListener('DOMContentLoaded', () => {
    cart.updateCartBadge();
});
