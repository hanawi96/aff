// ============================================
// CART PAGE - OPTIMIZED & PERFORMANT
// ============================================

// Configuration
const CONFIG = {
    FREE_SHIPPING_THRESHOLD: 500000,
    SHIPPING_FEE: 30000,
    STORAGE_KEY: 'cart',
    DISCOUNT_KEY: 'discount',
    DEBOUNCE_DELAY: 300
};

// State Management
const state = {
    cart: [],
    discount: null,
    subtotal: 0,
    total: 0,
    shippingFee: CONFIG.SHIPPING_FEE
};

// Available discount codes
const DISCOUNT_CODES = [
    { code: 'FREESHIP', type: 'shipping', value: 0, description: 'Miễn phí ship' },
    { code: 'NEWMOM10', type: 'percent', value: 10, description: 'Giảm 10%' },
    { code: 'SUMMER2024', type: 'fixed', value: 20000, description: 'Giảm 20.000đ' }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const utils = {
    // Format price
    formatPrice: (price) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    },

    // Escape HTML
    escapeHtml: (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Debounce function
    debounce: (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    },

    // Show toast notification
    showToast: (message, type = 'success') => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // Show confirm dialog
    showConfirm: (message) => {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const messageEl = document.getElementById('confirmMessage');
            const cancelBtn = document.getElementById('confirmCancel');
            const okBtn = document.getElementById('confirmOk');

            messageEl.textContent = message;
            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                cancelBtn.onclick = null;
                okBtn.onclick = null;
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };

            okBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
        });
    }
};

// ============================================
// STORAGE FUNCTIONS
// ============================================

const storage = {
    // Load cart from localStorage
    loadCart: () => {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading cart:', e);
            return [];
        }
    },

    // Save cart to localStorage
    saveCart: (cart) => {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(cart));
        } catch (e) {
            console.error('Error saving cart:', e);
        }
    },

    // Load discount
    loadDiscount: () => {
        try {
            const data = localStorage.getItem(CONFIG.DISCOUNT_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    // Save discount
    saveDiscount: (discount) => {
        try {
            if (discount) {
                localStorage.setItem(CONFIG.DISCOUNT_KEY, JSON.stringify(discount));
            } else {
                localStorage.removeItem(CONFIG.DISCOUNT_KEY);
            }
        } catch (e) {
            console.error('Error saving discount:', e);
        }
    }
};

// ============================================
// CART OPERATIONS
// ============================================

const cart = {
    // Initialize cart
    init: () => {
        state.cart = storage.loadCart();
        state.discount = storage.loadDiscount();
        
        if (state.cart.length === 0) {
            cart.showEmpty();
        } else {
            cart.render();
            cart.updateSummary();
            cart.loadRecommended();
        }

        cart.setupEventListeners();
    },

    // Show empty cart
    showEmpty: () => {
        document.getElementById('emptyCart').classList.remove('hidden');
        document.getElementById('cartItems').classList.add('hidden');
        document.getElementById('discountSection').classList.add('hidden');
        document.getElementById('recommendedSection').classList.add('hidden');
        document.querySelector('.cart-summary-section').classList.add('hidden');
    },

    // Update quantity
    updateQuantity: (productId, newQuantity) => {
        const item = state.cart.find(i => i.id === productId);
        if (!item) return;

        // Validate quantity
        newQuantity = Math.max(1, Math.min(newQuantity, item.maxQuantity || 99));
        item.quantity = newQuantity;

        storage.saveCart(state.cart);
        cart.render();
        cart.updateSummary();
        
        utils.showToast('Đã cập nhật số lượng');
    },

    // Remove item
    removeItem: async (productId) => {
        const confirmed = await utils.showConfirm('Bạn có chắc muốn xóa sản phẩm này?');
        if (!confirmed) return;

        state.cart = state.cart.filter(i => i.id !== productId);
        storage.saveCart(state.cart);

        if (state.cart.length === 0) {
            cart.showEmpty();
        } else {
            cart.render();
            cart.updateSummary();
        }

        utils.showToast('Đã xóa sản phẩm', 'success');
    },

    // Render cart items
    render: () => {
        const container = document.getElementById('cartItems');
        
        const html = state.cart.map(item => {
            const badgesHtml = item.badges && item.badges.length > 0 
                ? '<div class="item-badges">' + 
                  item.badges.map(badge => {
                      const badgeClass = badge === 'Thủ công 100%' ? 'badge-handmade' : 'badge-chemical-free';
                      return '<span class="item-badge ' + badgeClass + '">' + badge + '</span>';
                  }).join('') + 
                  '</div>'
                : '';
            
            const originalPriceHtml = item.originalPrice && item.originalPrice > item.price
                ? '<span class="item-original-price">' + utils.formatPrice(item.originalPrice) + '</span>'
                : '';
            
            return '<div class="cart-item" data-id="' + item.id + '">' +
                '<img src="' + (item.image || '/assets/images/product_img/tat-ca-mau.webp') + '" ' +
                'alt="' + utils.escapeHtml(item.name) + '" ' +
                'class="item-image" ' +
                'onclick="cart.viewProduct(' + item.id + ')">' +
                '<div class="item-details">' +
                '<div class="item-name" onclick="cart.viewProduct(' + item.id + ')">' +
                utils.escapeHtml(item.name) +
                '</div>' +
                badgesHtml +
                '<div class="item-price-row">' +
                '<span class="item-price">' + utils.formatPrice(item.price) + '</span>' +
                originalPriceHtml +
                '</div>' +
                '<div class="item-actions">' +
                '<div class="quantity-selector">' +
                '<button class="qty-btn" ' +
                'onclick="cart.updateQuantity(' + item.id + ', ' + (item.quantity - 1) + ')" ' +
                (item.quantity <= 1 ? 'disabled' : '') + '>' +
                '<i class="fas fa-minus"></i>' +
                '</button>' +
                '<input type="number" class="qty-input" ' +
                'value="' + item.quantity + '" ' +
                'min="1" ' +
                'max="' + (item.maxQuantity || 99) + '" ' +
                'onchange="cart.handleQuantityInput(' + item.id + ', this.value)">' +
                '<button class="qty-btn" ' +
                'onclick="cart.updateQuantity(' + item.id + ', ' + (item.quantity + 1) + ')" ' +
                (item.quantity >= (item.maxQuantity || 99) ? 'disabled' : '') + '>' +
                '<i class="fas fa-plus"></i>' +
                '</button>' +
                '</div>' +
                '<button class="delete-btn" onclick="cart.removeItem(' + item.id + ')">' +
                '<i class="fas fa-trash"></i>' +
                '</button>' +
                '</div>' +
                '</div>' +
                '</div>';
        }).join('');

        container.innerHTML = html;
        container.classList.remove('hidden');
        
        // Show discount section
        document.getElementById('discountSection').classList.remove('hidden');
        
        // Update cart count
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('cartCount').textContent = '(' + totalItems + ')';
    },

    // Handle quantity input
    handleQuantityInput: utils.debounce((productId, value) => {
        const quantity = parseInt(value) || 1;
        cart.updateQuantity(productId, quantity);
    }, CONFIG.DEBOUNCE_DELAY),

    // View product (placeholder)
    viewProduct: (productId) => {
        console.log('View product:', productId);
        // TODO: Implement quick view modal
    },

    // Update summary
    updateSummary: () => {
        // Calculate subtotal
        state.subtotal = state.cart.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        // Calculate discount
        let discountAmount = 0;
        if (state.discount) {
            if (state.discount.type === 'percent') {
                discountAmount = Math.floor(state.subtotal * state.discount.value / 100);
            } else if (state.discount.type === 'fixed') {
                discountAmount = state.discount.value;
            } else if (state.discount.type === 'shipping') {
                state.shippingFee = 0;
            }
        }

        // Calculate shipping fee
        if (state.subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD) {
            state.shippingFee = 0;
        } else if (state.discount?.type !== 'shipping') {
            state.shippingFee = CONFIG.SHIPPING_FEE;
        }

        // Calculate total
        state.total = state.subtotal - discountAmount + state.shippingFee;

        // Update UI
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('summaryItemCount').textContent = `(${totalItems} sp)`;
        document.getElementById('subtotal').textContent = utils.formatPrice(state.subtotal);
        document.getElementById('shippingFee').textContent = state.shippingFee === 0 
            ? 'Miễn phí' 
            : utils.formatPrice(state.shippingFee);
        document.getElementById('totalAmount').textContent = utils.formatPrice(state.total);

        // Update discount row
        const discountRow = document.getElementById('discountRow');
        if (discountAmount > 0) {
            discountRow.classList.remove('hidden');
            document.getElementById('discountCodeLabel').textContent = '(' + state.discount.code + ')';
            document.getElementById('discountAmount').textContent = '-' + utils.formatPrice(discountAmount);
        } else {
            discountRow.classList.add('hidden');
        }

        // Update shipping progress
        cart.updateShippingProgress();
    },

    // Update shipping progress
    updateShippingProgress: () => {
        const progressSection = document.getElementById('shippingProgress');
        const progressFill = document.getElementById('progressFill');
        const shippingMessage = document.getElementById('shippingMessage');

        if (state.subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD) {
            shippingMessage.innerHTML = '<i class="fas fa-check-circle"></i> Bạn được MIỄN PHÍ SHIP!';
            progressFill.style.width = '100%';
            progressSection.classList.remove('hidden');
        } else {
            const remaining = CONFIG.FREE_SHIPPING_THRESHOLD - state.subtotal;
            const progress = (state.subtotal / CONFIG.FREE_SHIPPING_THRESHOLD) * 100;
            shippingMessage.textContent = 'Thêm ' + utils.formatPrice(remaining) + ' để FREE SHIP';
            progressFill.style.width = progress + '%';
            progressSection.classList.remove('hidden');
        }
    },

    // Load recommended products
    loadRecommended: () => {
        // TODO: Implement recommendation logic
        // For now, hide the section
        document.getElementById('recommendedSection').classList.add('hidden');
    },

    // Setup event listeners
    setupEventListeners: () => {
        // Checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.onclick = () => {
                if (state.cart.length === 0) {
                    utils.showToast('Giỏ hàng trống', 'error');
                    return;
                }
                window.location.href = 'checkout.html';
            };
        }

        // Apply discount button
        const applyBtn = document.getElementById('applyDiscountBtn');
        if (applyBtn) {
            applyBtn.onclick = discount.apply;
        }

        // Discount code input (Enter key)
        const discountInput = document.getElementById('discountCode');
        if (discountInput) {
            discountInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    discount.apply();
                }
            };
        }

        // Render available codes
        discount.renderAvailableCodes();
    }
};

// ============================================
// DISCOUNT OPERATIONS
// ============================================

const discount = {
    // Apply discount code
    apply: () => {
        const input = document.getElementById('discountCode');
        const code = input.value.trim().toUpperCase();

        if (!code) {
            utils.showToast('Vui lòng nhập mã giảm giá', 'error');
            return;
        }

        // Find discount code
        const discountCode = DISCOUNT_CODES.find(d => d.code === code);

        if (!discountCode) {
            discount.showResult('Mã giảm giá không hợp lệ', 'error');
            return;
        }

        // Apply discount
        state.discount = discountCode;
        storage.saveDiscount(discountCode);
        
        cart.updateSummary();
        discount.showResult(`✓ Đã áp dụng mã ${code}`, 'success');
        
        input.value = '';
        utils.showToast('Áp dụng mã thành công!', 'success');
    },

    // Remove discount
    remove: () => {
        state.discount = null;
        storage.saveDiscount(null);
        state.shippingFee = CONFIG.SHIPPING_FEE;
        
        cart.updateSummary();
        discount.showResult('', 'error');
        
        utils.showToast('Đã xóa mã giảm giá', 'success');
    },

    // Show discount result
    showResult: (message, type) => {
        const resultEl = document.getElementById('discountResult');
        
        if (!message) {
            resultEl.classList.add('hidden');
            return;
        }

        resultEl.className = 'discount-result ' + type;
        
        if (type === 'success') {
            resultEl.innerHTML = '<span>' + message + '</span>' +
                '<button class="remove-discount" onclick="discount.remove()">Xóa</button>';
        } else {
            resultEl.textContent = message;
        }
        
        resultEl.classList.remove('hidden');
    },

    // Render available codes
    renderAvailableCodes: () => {
        const container = document.getElementById('availableCodes');
        
        const html = DISCOUNT_CODES.map(code => 
            '<div class="code-item">' +
            '<div>' +
            '<span class="code-name">' + code.code + '</span>' +
            '<span> - ' + code.description + '</span>' +
            '</div>' +
            '<button class="code-apply-btn" onclick="discount.quickApply(\'' + code.code + '\')">' +
            'Áp dụng' +
            '</button>' +
            '</div>'
        ).join('');

        container.innerHTML = html;
    },

    // Quick apply discount
    quickApply: (code) => {
        document.getElementById('discountCode').value = code;
        discount.apply();
    }
};

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    cart.init();
});

// Expose to global scope for inline event handlers
window.cart = cart;
window.discount = discount;
