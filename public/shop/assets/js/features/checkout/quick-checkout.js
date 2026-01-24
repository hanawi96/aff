// ============================================
// QUICK CHECKOUT MODAL
// ============================================

import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { validateCheckoutForm } from '../../shared/utils/validators.js';
import { showToast } from '../../shared/utils/helpers.js';
import { CONFIG } from '../../shared/constants/config.js';
import { apiService } from '../../shared/services/api.service.js';
import { AddressSelector } from '../../components/address-selector.js';
import { DiscountModal } from '../../components/discount-modal.js';
import { discountService } from '../../shared/services/discount.service.js';

/**
 * Quick Checkout Manager
 */
export class QuickCheckout {
    constructor() {
        this.product = null;
        this.quantity = 1;
        this.crossSellProducts = [];
        this.selectedCrossSells = []; // Array of {id, quantity}
        this.addressSelector = null;
        this.appliedDiscount = null;
        this.discountAmount = 0;
        this.shippingFee = 21000; // Default 21,000đ, will be loaded from API
        this.paymentMethod = 'cod'; // Default: COD
        this.bankTransferConfirmed = false; // Bank transfer confirmation status
        this.countdownTimer = null; // Countdown timer instance
        this.countdownEndTime = null; // Countdown end timestamp
        this.needsBabyName = false; // Flag for products needing baby name
        
        // LocalStorage key for form data
        this.STORAGE_KEY = 'quickCheckoutFormData';
        
        // Initialize discount modal
        this.discountModal = new DiscountModal((discount, amount) => this.applyDiscount(discount, amount));
        this.discountModal.setupEventListeners();
        
        // Expose to window for onclick handlers
        window.discountModal = this.discountModal;
        
        // Load shipping fee from API
        this.loadShippingFee();
        
        this.setupEventListeners();
        this.setupAutoSave();
    }
    
    /**
     * Load shipping fee from API
     */
    async loadShippingFee() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/get?action=getShippingFee`);
            const data = await response.json();
            if (data.success && data.shippingFee) {
                this.shippingFee = data.shippingFee;
                console.log('📦 Shipping fee loaded:', this.shippingFee);
            }
        } catch (error) {
            console.error('Error loading shipping fee:', error);
            // Keep default 30000
        }
    }
    
    /**
     * Open quick checkout modal
     */
    async open(product) {
        this.product = product;
        this.quantity = 1;
        this.selectedCrossSells = [];
        this.appliedDiscount = null;
        this.discountAmount = 0;
        
        // Check if product needs baby name (belongs to "Mix thẻ tên bé" category)
        this.needsBabyName = this.checkNeedsBabyName(product);
        
        // Load cross-sell products
        await this.loadCrossSellProducts();
        
        this.render();
        
        // Initialize address selector
        if (!this.addressSelector) {
            this.addressSelector = new AddressSelector('addressSelectorContainer');
            await this.addressSelector.init();
        } else {
            this.addressSelector.reset();
        }
        
        // Try to restore saved form data
        this.restoreFormData();
        
        this.showModal();
    }
    
    /**
     * Check if product needs baby name input
     */
    checkNeedsBabyName(product) {
        if (!product.categories || !Array.isArray(product.categories)) {
            return false;
        }
        
        // Check if any category name contains "Mix thẻ tên bé"
        return product.categories.some(cat => 
            cat.name && cat.name.toLowerCase().includes('mix thẻ tên bé')
        );
    }
    
    /**
     * Close modal
     */
    close() {
        const modal = document.getElementById('quickCheckoutModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        
        // Stop countdown timer
        this.stopCountdown();
        
        this.product = null;
        this.quantity = 1;
        this.selectedCrossSells = [];
    }
    
    /**
     * Load cross-sell products (Hardcoded: Bó đầu 7 cành và 9 cành)
     */
    async loadCrossSellProducts() {
        // Hardcode 2 sản phẩm bán kèm
        this.crossSellProducts = [
            {
                id: 133,
                name: 'Bó đầu 7 CÀNH (bé gái)',
                price: 42000,
                originalPrice: null,
                image: 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/products/1768450336930-iwxo9u.jpg',
                is_active: 1
            },
            {
                id: 134,
                name: 'Bó đầu 9 CÀNH (bé gái)',
                price: 47000,
                originalPrice: null,
                image: 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/products/1768450336930-iwxo9u.jpg',
                is_active: 1
            }
        ];
    }
    
    /**
     * Show modal
     */
    showModal() {
        const modal = document.getElementById('quickCheckoutModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }
    
    /**
     * Render modal content
     */
    render() {
        if (!this.product) return;
        
        const productContainer = document.getElementById('checkoutProduct');
        if (!productContainer) return;
        
        // Render product info
        let html = '<img src="' + (this.product.image || CONFIG.DEFAULT_IMAGE) + '" ';
        html += 'alt="' + escapeHtml(this.product.name) + '" class="checkout-product-image">';
        html += '<div class="checkout-product-info">';
        html += '<div class="checkout-product-name">' + escapeHtml(this.product.name) + '</div>';
        html += '<div class="checkout-product-price">' + formatPrice(this.product.price) + '</div>';
        
        if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
            html += '<div style="text-decoration: line-through; color: #999; font-size: 0.9rem;">';
            html += formatPrice(this.product.originalPrice);
            html += '</div>';
        }
        
        html += '</div>';
        productContainer.innerHTML = html;
        
        // Show/hide baby name input based on product category
        const babyNameGroup = document.getElementById('babyNameGroup');
        if (babyNameGroup) {
            if (this.needsBabyName) {
                babyNameGroup.style.display = 'block';
                // Add required attribute
                const babyNameInput = document.getElementById('checkoutBabyName');
                if (babyNameInput) {
                    babyNameInput.setAttribute('required', 'required');
                }
            } else {
                babyNameGroup.style.display = 'none';
                // Remove required attribute
                const babyNameInput = document.getElementById('checkoutBabyName');
                if (babyNameInput) {
                    babyNameInput.removeAttribute('required');
                    babyNameInput.value = ''; // Clear value
                }
            }
        }
        
        // Render cross-sell products
        this.renderCrossSellProducts();
        
        // Reset form
        this.resetForm();
        
        // Update summary
        this.updateSummary();
    }
    
    /**
     * Render cross-sell products
     */
    renderCrossSellProducts() {
        const container = document.getElementById('crossSellProducts');
        if (!container || this.crossSellProducts.length === 0) return;
        
        let html = '<div class="cross-sell-header-legend">';
        html += '<i class="fas fa-gift"></i> ';
        html += '<span>Mua kèm - <strong style="color: #e74c3c;">MIỄN PHÍ SHIP</strong></span>';
        html += '</div>';
        
        html += '<div class="cross-sell-items-wrapper">';
        
        this.crossSellProducts.forEach(product => {
            const selectedItem = this.selectedCrossSells.find(item => item.id === product.id);
            const isSelected = !!selectedItem;
            const quantity = selectedItem ? selectedItem.quantity : 1;
            
            html += '<div class="cross-sell-item ' + (isSelected ? 'selected' : '') + '">';
            html += '<img src="' + (product.image || CONFIG.DEFAULT_IMAGE) + '" ';
            html += 'alt="' + escapeHtml(product.name) + '" class="cross-sell-image" ';
            html += 'loading="lazy">';
            
            html += '<div class="cross-sell-info">';
            html += '<div class="cross-sell-name">' + escapeHtml(product.name) + '</div>';
            html += '<div class="cross-sell-price">' + formatPrice(product.price) + '</div>';
            html += '</div>';
            
            html += '<div class="cross-sell-actions">';
            
            // Always show quantity selector
            html += '<div class="cross-sell-qty-compact">';
            html += '<button class="cross-sell-qty-btn-compact" onclick="quickCheckout.updateTempQty(' + product.id + ', -1)" data-product="' + product.id + '" data-action="minus">';
            html += '<i class="fas fa-minus"></i>';
            html += '</button>';
            html += '<span class="cross-sell-qty-value-compact" data-product="' + product.id + '">' + quantity + '</span>';
            html += '<button class="cross-sell-qty-btn-compact" onclick="quickCheckout.updateTempQty(' + product.id + ', 1)" data-product="' + product.id + '" data-action="plus">';
            html += '<i class="fas fa-plus"></i>';
            html += '</button>';
            html += '</div>';
            
            // Add/Remove button
            if (!isSelected) {
                html += '<button class="cross-sell-add-btn-compact" onclick="quickCheckout.addCrossSell(' + product.id + ')">';
                html += '<i class="fas fa-plus"></i> Thêm';
                html += '</button>';
            } else {
                html += '<button class="cross-sell-remove-btn-compact" onclick="quickCheckout.removeCrossSell(' + product.id + ')">';
                html += '<i class="fas fa-check"></i> Đã thêm';
                html += '</button>';
            }
            
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div>'; // close items-wrapper
        
        container.innerHTML = html;
    }
    
    /**
     * Update temporary quantity (before adding to cart)
     */
    updateTempQty(productId, change) {
        const selectedItem = this.selectedCrossSells.find(item => item.id === productId);
        
        if (selectedItem) {
            // Already in cart - update quantity directly
            const newQty = selectedItem.quantity + change;
            if (newQty < 1 || newQty > 10) return;
            selectedItem.quantity = newQty;
            
            // Update display
            const qtyElement = document.querySelector(`.cross-sell-qty-value-compact[data-product="${productId}"]`);
            if (qtyElement) {
                qtyElement.textContent = newQty;
                // Add pulse animation
                qtyElement.classList.add('qty-updated');
                setTimeout(() => qtyElement.classList.remove('qty-updated'), 600);
            }
            
            // Update button states
            const minusBtn = document.querySelector(`.cross-sell-qty-btn-compact[data-product="${productId}"][data-action="minus"]`);
            const plusBtn = document.querySelector(`.cross-sell-qty-btn-compact[data-product="${productId}"][data-action="plus"]`);
            if (minusBtn) minusBtn.disabled = newQty <= 1;
            if (plusBtn) plusBtn.disabled = newQty >= 10;
            
            // Update summary immediately
            this.updateSummary();
            this.updateOrderDetails();
            
            // Show mini feedback
            this.showQuantityFeedback(productId, newQty);
        } else {
            // Not in cart yet - just update display
            const qtyElement = document.querySelector(`.cross-sell-qty-value-compact[data-product="${productId}"]`);
            const minusBtn = document.querySelector(`.cross-sell-qty-btn-compact[data-product="${productId}"][data-action="minus"]`);
            const plusBtn = document.querySelector(`.cross-sell-qty-btn-compact[data-product="${productId}"][data-action="plus"]`);
            
            if (qtyElement) {
                const currentQty = parseInt(qtyElement.textContent);
                const newQty = currentQty + change;
                
                if (newQty >= 1 && newQty <= 10) {
                    qtyElement.textContent = newQty;
                    
                    // Update button states
                    if (minusBtn) minusBtn.disabled = newQty <= 1;
                    if (plusBtn) plusBtn.disabled = newQty >= 10;
                }
            }
        }
    }
    
    /**
     * Show quantity update feedback
     */
    showQuantityFeedback(productId, newQty) {
        // Highlight total price
        const totalElement = document.getElementById('checkoutTotalInline');
        if (totalElement) {
            totalElement.classList.add('price-updated');
            setTimeout(() => totalElement.classList.remove('price-updated'), 600);
        }
        
        // Show mini toast (subtle, non-intrusive)
        const product = this.crossSellProducts.find(p => p.id === productId);
        if (product) {
            const feedback = document.createElement('div');
            feedback.className = 'qty-feedback';
            feedback.innerHTML = '<i class="fas fa-check-circle"></i> Đã cập nhật: ' + newQty + ' sản phẩm';
            document.body.appendChild(feedback);
            
            setTimeout(() => feedback.classList.add('show'), 10);
            setTimeout(() => {
                feedback.classList.remove('show');
                setTimeout(() => feedback.remove(), 300);
            }, 1500);
        }
    }
    
    /**
     * Add cross-sell product to cart
     */
    addCrossSell(productId) {
        const qtyElement = document.querySelector(`.cross-sell-qty-value-compact[data-product="${productId}"]`);
        const quantity = qtyElement ? parseInt(qtyElement.textContent) : 1;
        
        this.selectedCrossSells.push({ id: productId, quantity: quantity });
        this.renderCrossSellProducts();
        this.updateSummary();
        this.updateOrderDetails();
    }
    
    /**
     * Remove cross-sell product from cart
     */
    removeCrossSell(productId) {
        const index = this.selectedCrossSells.findIndex(item => item.id === productId);
        if (index > -1) {
            this.selectedCrossSells.splice(index, 1);
        }
        this.renderCrossSellProducts();
        this.updateSummary();
        this.updateOrderDetails();
    }
    
    /**
     * Update cross-sell product quantity
     */
    updateCrossSellQty(productId, change) {
        const item = this.selectedCrossSells.find(item => item.id === productId);
        if (!item) return;
        
        const newQty = item.quantity + change;
        
        // Validate quantity (min: 1, max: 10)
        if (newQty < 1 || newQty > 10) return;
        
        item.quantity = newQty;
        this.renderCrossSellProducts();
        this.updateSummary();
        this.updateOrderDetails();
    }
    
    /**
     * Fill demo data for testing
     */
    async fillDemoData() {
        // Fill basic info
        document.getElementById('checkoutPhone').value = '0987654321';
        document.getElementById('checkoutName').value = 'Nguyễn Thị Hoa';
        document.getElementById('checkoutBabyWeight').value = '5kg';
        
        // Fill baby name if needed
        if (this.needsBabyName) {
            const babyNameInput = document.getElementById('checkoutBabyName');
            if (babyNameInput) {
                babyNameInput.value = 'Minh An';
            }
        }
        
        document.getElementById('checkoutNote').value = 'Giao hàng giờ hành chính';
        
        // Fill address
        if (this.addressSelector) {
            await this.addressSelector.fillDemoData();
        }
        
        showToast('Đã điền dữ liệu demo!', 'success');
    }
    
    /**
     * Select payment method
     */
    selectPaymentMethod(method) {
        this.paymentMethod = method;
        
        // Reset bank transfer confirmation when switching methods
        if (method === 'cod') {
            this.bankTransferConfirmed = false;
            this.stopCountdown();
        }
        
        // Update UI
        document.querySelectorAll('.payment-method-item').forEach(item => {
            if (item.dataset.method === method) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Show/hide bank transfer info
        const bankInfo = document.getElementById('bankTransferInfo');
        if (method === 'bank') {
            bankInfo.classList.remove('hidden');
            // Update transfer amount
            const total = this.calculateTotal();
            document.getElementById('bankTransferAmount').textContent = formatPrice(total);
            
            // Reset confirm button if switching back
            const btn = document.getElementById('bankConfirmBtn');
            if (btn && !this.bankTransferConfirmed) {
                btn.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận đã chuyển khoản';
                btn.style.background = 'linear-gradient(135deg, #4caf50, #66bb6a)';
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.style.animation = 'pulse 2s infinite';
            }
            
            // Start countdown timer (10 minutes)
            this.startCountdown(10 * 60);
        } else {
            bankInfo.classList.add('hidden');
            this.stopCountdown();
        }
        
        // Update order details to reflect payment method
        this.updateOrderDetails();
        
        // Auto-save when payment method changes
        this.saveFormData();
    }
    
    /**
     * Start countdown timer
     */
    startCountdown(seconds) {
        // Stop existing timer
        this.stopCountdown();
        
        // Set end time
        this.countdownEndTime = Date.now() + (seconds * 1000);
        
        // Update display immediately
        this.updateCountdownDisplay();
        
        // Start interval
        this.countdownTimer = setInterval(() => {
            this.updateCountdownDisplay();
        }, 1000);
    }
    
    /**
     * Stop countdown timer
     */
    stopCountdown() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
            this.countdownEndTime = null;
        }
    }
    
    /**
     * Update countdown display
     */
    updateCountdownDisplay() {
        if (!this.countdownEndTime) return;
        
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((this.countdownEndTime - now) / 1000));
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        
        const timeEl = document.getElementById('countdownTime');
        const countdownBox = document.getElementById('paymentCountdown');
        
        if (timeEl) {
            timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        // Add warning class when less than 2 minutes
        if (remaining <= 120 && remaining > 0) {
            if (countdownBox) countdownBox.classList.add('warning');
        } else {
            if (countdownBox) countdownBox.classList.remove('warning');
        }
        
        // Time expired
        if (remaining === 0) {
            this.stopCountdown();
            if (countdownBox) {
                countdownBox.classList.add('expired');
                countdownBox.innerHTML = '<i class="fas fa-times-circle"></i> <span>Hết thời gian thanh toán!</span>';
            }
            
            // Disable submit button
            const submitBtn = document.getElementById('checkoutSubmit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            }
            
            showToast('Hết thời gian thanh toán! Vui lòng đặt lại đơn hàng.', 'error');
        }
    }
    
    /**
     * Copy bank info to clipboard
     */
    copyBankInfo(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Đã sao chép: ' + text, 'success');
        }).catch(() => {
            showToast('Không thể sao chép', 'error');
        });
    }
    
    /**
     * Confirm bank transfer
     */
    confirmBankTransfer() {
        // Mark as confirmed
        this.bankTransferConfirmed = true;
        
        // Stop countdown
        this.stopCountdown();
        
        // Hide countdown box
        const countdownBox = document.getElementById('paymentCountdown');
        if (countdownBox) {
            countdownBox.style.display = 'none';
        }
        
        // Hide error message
        const errorEl = document.getElementById('bankConfirmError');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
        
        // Update button
        const btn = document.getElementById('bankConfirmBtn');
        btn.innerHTML = '<i class="fas fa-check-double"></i> Đã xác nhận chuyển khoản';
        btn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        btn.style.animation = 'none';
        
        // Update order details to show paid status
        this.updateOrderDetails();
        
        showToast('Đã xác nhận! Vui lòng hoàn tất đơn hàng.', 'success');
    }
    
    /**
     * Reset form
     */
    resetForm() {
        document.getElementById('checkoutQty').value = 1;
        document.getElementById('checkoutPhone').value = '';
        document.getElementById('checkoutName').value = '';
        document.getElementById('checkoutBabyWeight').value = '';
        document.getElementById('checkoutNote').value = '';
        
        // Reset baby name if exists
        const babyNameInput = document.getElementById('checkoutBabyName');
        if (babyNameInput) {
            babyNameInput.value = '';
        }
        
        if (this.addressSelector) {
            this.addressSelector.reset();
        }
        
        // Reset submit button state
        const submitBtn = document.getElementById('checkoutSubmit');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'ĐẶT HÀNG';
            submitBtn.style.opacity = '';
            submitBtn.style.cursor = '';
        }
    }
    
    /**
     * Calculate total
     */
    calculateTotal() {
        const subtotal = this.product.price * this.quantity;
        const crossSellTotal = this.selectedCrossSells.reduce((sum, item) => { const product = this.crossSellProducts.find(p => p.id === item.id); return sum + (product ? product.price * item.quantity : 0); }, 0);
        
        // Check if free shipping from cross-sell or discount
        const hasFreeShipping = this.selectedCrossSells.length > 0 || 
                               (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount));
        const shippingFee = hasFreeShipping ? 0 : this.shippingFee;
        
        const beforeDiscount = subtotal + crossSellTotal + shippingFee;
        return beforeDiscount - this.discountAmount;
    }
    
    /**
     * Update summary (calls updateOrderDetails)
     */
    updateSummary() {
        this.updateOrderDetails();
    }
    
    /**
     * Update quantity
     */
    updateQuantity(delta) {
        const newQty = this.quantity + delta;
        
        if (newQty < 1 || newQty > this.product.maxQuantity) return;
        
        this.quantity = newQty;
        document.getElementById('checkoutQty').value = this.quantity;
        this.updateSummary();
        
        // Update button states
        document.getElementById('checkoutQtyMinus').disabled = this.quantity <= 1;
        document.getElementById('checkoutQtyPlus').disabled = this.quantity >= this.product.maxQuantity;
    }
    
    /**
     * Update order details breakdown
     */
    updateOrderDetails() {
        // Update main product
        document.getElementById('orderMainProductName').textContent = this.product.name;
        document.getElementById('orderMainProductQty').textContent = `x${this.quantity}`;
        document.getElementById('orderMainProductPrice').textContent = formatPrice(this.product.price * this.quantity);
        
        // Update cross-sell products
        const crossSellContainer = document.getElementById('orderCrossSellItems');
        if (this.selectedCrossSells.length > 0) {
            let html = '';
            this.selectedCrossSells.forEach(item => {
                const product = this.crossSellProducts.find(p => p.id === item.id);
                if (product) {
                    html += '<div class="order-item">';
                    html += '<div class="order-item-info">';
                    html += '<span class="order-item-name">' + escapeHtml(product.name) + '</span>';
                    html += '<span class="order-item-qty">x' + item.quantity + '</span>';
                    html += '</div>';
                    html += '<div class="order-item-actions">';
                    html += '<span class="order-item-price">' + formatPrice(product.price * item.quantity) + '</span>';
                    html += '<button class="order-item-remove" onclick="quickCheckout.removeCrossSell(' + product.id + ')" title="Xóa sản phẩm">';
                    html += '<i class="fas fa-trash-alt"></i>';
                    html += '</button>';
                    html += '</div>';
                    html += '</div>';
                }
            });
            crossSellContainer.innerHTML = html;
            crossSellContainer.classList.remove('hidden');
        } else {
            crossSellContainer.classList.add('hidden');
        }
        
        // Calculate totals
        const subtotal = this.product.price * this.quantity;
        const crossSellTotal = this.selectedCrossSells.reduce((sum, item) => {
            const product = this.crossSellProducts.find(p => p.id === item.id);
            return sum + (product ? product.price * item.quantity : 0);
        }, 0);
        
        // Calculate shipping (free if any cross-sell selected or discount is freeship)
        const hasFreeShipping = this.selectedCrossSells.length > 0 || 
                               (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount));
        const shippingFee = hasFreeShipping ? 0 : this.shippingFee;
        
        // Calculate total before discount
        const beforeDiscount = subtotal + crossSellTotal + shippingFee;
        
        // Calculate total after discount
        const total = beforeDiscount - this.discountAmount;
        
        // Update detailed summary (if exists - old design)
        const subtotalEl = document.getElementById('checkoutSubtotal');
        if (subtotalEl) {
            subtotalEl.textContent = formatPrice(subtotal + crossSellTotal);
        }
        
        const shippingElement = document.getElementById('checkoutShipping');
        if (shippingElement) {
            if (hasFreeShipping) {
                shippingElement.innerHTML = '<span style="text-decoration: line-through; color: #999;">' + 
                    formatPrice(this.shippingFee) + '</span> ' +
                    '<span style="color: #27ae60; font-weight: bold;">MIỄN PHÍ</span>';
            } else {
                shippingElement.textContent = formatPrice(shippingFee);
            }
        }
        
        // Update order details summary section
        const orderSubtotal = document.getElementById('orderSubtotal');
        if (orderSubtotal) {
            orderSubtotal.textContent = formatPrice(subtotal + crossSellTotal);
        }
        
        const orderShipping = document.getElementById('orderShipping');
        if (orderShipping) {
            if (hasFreeShipping) {
                orderShipping.innerHTML = '<span style="text-decoration: line-through; color: #999;">' + 
                    formatPrice(this.shippingFee) + '</span> ' +
                    '<span style="color: #27ae60; font-weight: bold; font-size: 0.85rem;">MIỄN PHÍ</span>';
            } else {
                orderShipping.textContent = formatPrice(shippingFee);
            }
        }
        
        const orderDiscountRow = document.getElementById('orderDiscountRow');
        const orderDiscountAmount = document.getElementById('orderDiscountAmount');
        if (orderDiscountRow && orderDiscountAmount) {
            if (this.appliedDiscount && this.discountAmount > 0) {
                orderDiscountRow.classList.remove('hidden');
                orderDiscountAmount.textContent = '-' + formatPrice(this.discountAmount);
            } else {
                orderDiscountRow.classList.add('hidden');
            }
        }
        
        const orderTotalDetail = document.getElementById('orderTotalDetail');
        if (orderTotalDetail) {
            orderTotalDetail.textContent = formatPrice(total);
        }
        
        // Update payment row based on payment method
        const orderPaymentRow = document.getElementById('orderPaymentRow');
        const orderPaymentLabel = document.getElementById('orderPaymentLabel');
        const orderPaymentAmount = document.getElementById('orderPaymentAmount');
        
        if (orderPaymentRow && orderPaymentLabel && orderPaymentAmount) {
            if (this.paymentMethod === 'bank' && this.bankTransferConfirmed) {
                // Đã chuyển khoản
                orderPaymentRow.classList.add('paid');
                orderPaymentLabel.innerHTML = '<i class="fas fa-check-circle"></i> Đã thanh toán';
                orderPaymentAmount.textContent = '0đ';
            } else if (this.paymentMethod === 'bank' && !this.bankTransferConfirmed) {
                // Chưa xác nhận chuyển khoản
                orderPaymentRow.classList.remove('paid');
                orderPaymentLabel.innerHTML = '<i class="fas fa-university"></i> Cần thanh toán trước';
                orderPaymentAmount.textContent = formatPrice(total);
            } else {
                // COD
                orderPaymentRow.classList.remove('paid');
                orderPaymentLabel.innerHTML = '<i class="fas fa-money-bill-wave"></i> Thanh toán khi nhận hàng';
                orderPaymentAmount.textContent = formatPrice(total);
            }
        }
        
        // Update discount row (if exists - old design)
        const discountRow = document.getElementById('checkoutDiscountRow');
        if (discountRow) {
            if (this.appliedDiscount && this.discountAmount > 0) {
                discountRow.classList.remove('hidden');
                const discountAmountEl = document.getElementById('checkoutDiscountAmount');
                if (discountAmountEl) {
                    discountAmountEl.textContent = '-' + formatPrice(this.discountAmount);
                }
            } else {
                discountRow.classList.add('hidden');
            }
        }
        
        const totalEl = document.getElementById('checkoutTotal');
        if (totalEl) {
            totalEl.textContent = formatPrice(total);
        }
        
        // Update inline total (new design)
        const inlineTotal = document.getElementById('checkoutTotalInline');
        const totalLabelMain = document.getElementById('checkoutTotalLabel');
        const savingsLabel = document.getElementById('checkoutSavingsLabel');
        const totalBox = document.querySelector('.checkout-total-box');
        
        if (inlineTotal && totalLabelMain && savingsLabel && totalBox) {
            // Determine display based on payment method
            if (this.paymentMethod === 'bank' && this.bankTransferConfirmed) {
                // Đã chuyển khoản - hiển thị 0đ
                totalLabelMain.textContent = 'Thanh toán khi nhận';
                inlineTotal.textContent = '0đ';
                totalBox.classList.add('paid');
                
                // Show total order value in savings label
                savingsLabel.textContent = 'Đơn hàng: ' + formatPrice(total);
                savingsLabel.style.color = '#666';
            } else if (this.paymentMethod === 'bank' && !this.bankTransferConfirmed) {
                // Chưa xác nhận chuyển khoản
                totalLabelMain.textContent = 'Cần thanh toán';
                inlineTotal.textContent = formatPrice(total);
                totalBox.classList.remove('paid');
                
                // Show savings
                const savings = this.discountAmount + (hasFreeShipping ? this.shippingFee : 0);
                if (savings > 0) {
                    savingsLabel.textContent = 'Tiết kiệm ' + formatPrice(savings);
                    savingsLabel.style.color = '#27ae60';
                } else {
                    savingsLabel.textContent = '';
                }
            } else {
                // COD
                totalLabelMain.textContent = 'Tổng cộng';
                inlineTotal.textContent = formatPrice(total);
                totalBox.classList.remove('paid');
                
                // Show savings
                const savings = this.discountAmount + (hasFreeShipping ? this.shippingFee : 0);
                if (savings > 0) {
                    savingsLabel.textContent = 'Tiết kiệm ' + formatPrice(savings);
                    savingsLabel.style.color = '#27ae60';
                } else {
                    savingsLabel.textContent = '';
                }
            }
        }
        
        // Update discount input display
        this.updateDiscountDisplay();
    }
    
    /**
     * Update discount display
     */
    updateDiscountDisplay() {
        const discountInput = document.getElementById('discountCodeInput');
        const discountBtnText = document.getElementById('discountBtnText');
        
        if (this.appliedDiscount) {
            // Có mã giảm giá
            discountInput.value = this.appliedDiscount.code;
            discountInput.classList.add('has-discount');
            discountBtnText.textContent = 'Đổi mã';
        } else {
            // Chưa có mã giảm giá
            discountInput.value = '';
            discountInput.classList.remove('has-discount');
            discountBtnText.textContent = 'Chọn mã';
        }
    }
    
    /**
     * Open discount modal
     */
    async openDiscountModal() {
        console.log('🎫 Opening discount modal...');
        const orderAmount = this.calculateTotal() + this.discountAmount; // Get amount before discount
        console.log('Order amount:', orderAmount);
        await this.discountModal.open(orderAmount);
    }
    
    /**
     * Apply discount
     */
    applyDiscount(discount, amount) {
        this.appliedDiscount = discount;
        this.discountAmount = amount;
        this.updateSummary();
        showToast('Đã áp dụng mã giảm giá!', 'success');
    }
    
    /**
     * Remove discount
     */
    removeDiscount() {
        this.appliedDiscount = null;
        this.discountAmount = 0;
        this.updateSummary();
        showToast('Đã xóa mã giảm giá', 'info');
    }
    
    /**
     * Submit checkout
     */
    async submit() {
        if (!this.product) return;
        
        // Get form data
        const formData = {
            phone: document.getElementById('checkoutPhone').value.trim(),
            name: document.getElementById('checkoutName').value.trim(),
            babyWeight: document.getElementById('checkoutBabyWeight').value,
            babyName: document.getElementById('checkoutBabyName')?.value.trim() || '',
            note: document.getElementById('checkoutNote').value.trim()
        };
        
        // Validate basic fields
        if (!formData.phone) {
            showToast('Vui lòng nhập số điện thoại', 'error');
            document.getElementById('checkoutPhone').focus();
            return;
        }
        
        if (!formData.name) {
            showToast('Vui lòng nhập tên khách hàng', 'error');
            document.getElementById('checkoutName').focus();
            return;
        }
        
        if (!formData.babyWeight) {
            showToast('Vui lòng chọn cân nặng của bé', 'error');
            document.getElementById('checkoutBabyWeight').focus();
            return;
        }
        
        // Validate baby name if needed
        if (this.needsBabyName && !formData.babyName) {
            showToast('Vui lòng nhập tên bé để khắc lên thẻ', 'error');
            document.getElementById('checkoutBabyName').focus();
            return;
        }
        
        // Validate bank transfer confirmation
        if (this.paymentMethod === 'bank' && !this.bankTransferConfirmed) {
            // Show error message
            const errorEl = document.getElementById('bankConfirmError');
            if (errorEl) {
                errorEl.classList.remove('hidden');
                
                // Scroll to bank confirm button smoothly
                const bankInfo = document.getElementById('bankTransferInfo');
                if (bankInfo) {
                    bankInfo.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
                
                // Shake the button
                const btn = document.getElementById('bankConfirmBtn');
                if (btn) {
                    btn.style.animation = 'none';
                    setTimeout(() => {
                        btn.style.animation = 'shakeAndPulse 0.6s ease';
                    }, 10);
                }
            }
            return;
        }
        
        // Validate address
        const addressValidation = this.addressSelector.validate();
        if (!addressValidation.isValid) {
            showToast(addressValidation.message, 'error');
            return;
        }
        
        // Get address data
        const addressData = this.addressSelector.getAddressData();
        
        // Calculate totals
        const productTotal = this.product.price * this.quantity;
        const crossSellTotal = this.selectedCrossSells.reduce((sum, item) => { 
            const product = this.crossSellProducts.find(p => p.id === item.id); 
            return sum + (product ? product.price * item.quantity : 0); 
        }, 0);
        const hasFreeShipping = this.selectedCrossSells.length > 0 || 
                               (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount));
        const shippingFee = hasFreeShipping ? 0 : this.shippingFee;
        const totalAmount = productTotal + crossSellTotal + shippingFee - this.discountAmount;
        
        // Prepare cart items (products array)
        const cart = [
            {
                id: this.product.id,
                name: this.product.name,
                price: this.product.price,
                cost_price: this.product.cost_price || 0,
                quantity: this.quantity,
                image: this.product.image,
                size: formData.babyWeight, // Add baby weight to size
                notes: this.needsBabyName && formData.babyName ? `Tên bé: ${formData.babyName}` : '' // Add baby name to notes
            }
        ];
        
        // Add cross-sell products to cart
        this.selectedCrossSells.forEach(item => {
            const product = this.crossSellProducts.find(p => p.id === item.id);
            if (product) {
                cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    cost_price: product.cost_price || 0,
                    quantity: item.quantity,
                    image: product.image,
                    size: formData.babyWeight // Same baby weight for all items in order
                });
            }
        });
        
        // Build notes: only custom note (baby weight is in order_items.size)
        const orderNotes = formData.note || null;
        
        // Prepare order data matching backend format
        const orderData = {
            orderId: 'DH' + Date.now(),
            orderDate: Date.now(),
            customer: {
                name: formData.name,
                phone: formData.phone
            },
            address: addressData.fullAddress,
            province_id: addressData.provinceCode,
            province_name: addressData.provinceName,
            district_id: addressData.districtCode,
            district_name: addressData.districtName,
            ward_id: addressData.wardCode,
            ward_name: addressData.wardName,
            street_address: addressData.street,
            paymentMethod: this.paymentMethod,
            payment_method: this.paymentMethod,
            status: 'pending',
            referralCode: null,
            shippingFee: shippingFee,
            shipping_fee: shippingFee,
            shippingCost: 0,
            shipping_cost: 0,
            total: totalAmount,
            totalAmount: totalAmount,
            cart: cart,
            notes: orderNotes,
            discount_id: this.appliedDiscount ? this.appliedDiscount.id : null,
            discountCode: this.appliedDiscount ? this.appliedDiscount.code : null,
            discount_code: this.appliedDiscount ? this.appliedDiscount.code : null,
            discountAmount: this.discountAmount,
            discount_amount: this.discountAmount,
            is_priority: 0,
            source: 'shop' // Mark as coming from shop
        };
        
        // Disable submit button
        const submitBtn = document.getElementById('checkoutSubmit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        
        try {
            // Send to API
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/shop/order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Success
                showToast('Đặt hàng thành công! Chúng tôi sẽ liên hệ với bạn sớm.', 'success');
                
                // Clear saved form data after successful order
                this.clearSavedData();
                
                // Stop countdown
                this.stopCountdown();
                
                this.close();
                
                // TODO: Redirect to success page or show order confirmation
                console.log('✅ Order created:', result.order);
            } else {
                throw new Error(result.error || 'Không thể tạo đơn hàng');
            }
            
        } catch (error) {
            console.error('Checkout error:', error);
            showToast(`Lỗi: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'ĐẶT HÀNG';
        }
    }
    
    /**
     * Setup auto-save for form fields
     */
    setupAutoSave() {
        // Debounce function to avoid too many saves
        let saveTimeout;
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => this.saveFormData(), 500);
        };
        
        // Listen to form changes
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (target.id === 'checkoutPhone' || 
                target.id === 'checkoutName' || 
                target.id === 'checkoutBabyWeight' ||
                target.id === 'checkoutBabyName' || 
                target.id === 'checkoutNote') {
                debouncedSave();
            }
        });
        
        // Listen to address changes
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target.id === 'provinceSelect' || 
                target.id === 'districtSelect' || 
                target.id === 'wardSelect' || 
                target.id === 'streetInput') {
                debouncedSave();
            }
        });
    }
    
    /**
     * Save form data to localStorage
     */
    saveFormData() {
        try {
            const formData = {
                phone: document.getElementById('checkoutPhone')?.value || '',
                name: document.getElementById('checkoutName')?.value || '',
                babyWeight: document.getElementById('checkoutBabyWeight')?.value || '',
                babyName: document.getElementById('checkoutBabyName')?.value || '',
                note: document.getElementById('checkoutNote')?.value || '',
                paymentMethod: this.paymentMethod,
                timestamp: Date.now()
            };
            
            // Save address data if available
            if (this.addressSelector) {
                const addressData = this.addressSelector.getAddressData();
                formData.address = addressData;
            }
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(formData));
            console.log('💾 Form data auto-saved');
        } catch (error) {
            console.error('Error saving form data:', error);
        }
    }
    
    /**
     * Restore form data from localStorage
     */
    async restoreFormData() {
        try {
            const savedData = localStorage.getItem(this.STORAGE_KEY);
            if (!savedData) return;
            
            const formData = JSON.parse(savedData);
            
            // Check if data is not too old (7 days)
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            if (Date.now() - formData.timestamp > maxAge) {
                this.clearSavedData();
                return;
            }
            
            // Wait a bit for modal to fully render
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Restore basic fields
            if (formData.phone) {
                const phoneInput = document.getElementById('checkoutPhone');
                if (phoneInput) phoneInput.value = formData.phone;
            }
            if (formData.name) {
                const nameInput = document.getElementById('checkoutName');
                if (nameInput) nameInput.value = formData.name;
            }
            if (formData.babyWeight) {
                const babyWeightSelect = document.getElementById('checkoutBabyWeight');
                if (babyWeightSelect) babyWeightSelect.value = formData.babyWeight;
            }
            if (formData.babyName) {
                const babyNameInput = document.getElementById('checkoutBabyName');
                if (babyNameInput) babyNameInput.value = formData.babyName;
            }
            if (formData.note) {
                const noteTextarea = document.getElementById('checkoutNote');
                if (noteTextarea) noteTextarea.value = formData.note;
            }
            
            // Restore payment method
            if (formData.paymentMethod) {
                await new Promise(resolve => setTimeout(resolve, 100));
                this.selectPaymentMethod(formData.paymentMethod);
            }
            
            // Restore address (needs more time for selects to be ready)
            if (formData.address && this.addressSelector) {
                await new Promise(resolve => setTimeout(resolve, 200));
                await this.addressSelector.restoreAddress(formData.address);
            }
            
            console.log('✅ Form data restored from auto-save');
            showToast('Đã khôi phục thông tin đã lưu', 'info');
        } catch (error) {
            console.error('Error restoring form data:', error);
            this.clearSavedData();
        }
    }
    
    /**
     * Clear saved form data
     */
    clearSavedData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('🗑️ Saved form data cleared');
        } catch (error) {
            console.error('Error clearing saved data:', error);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('quickCheckoutClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Click outside to close
        const modal = document.getElementById('quickCheckoutModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }
        
        // Quantity buttons
        const qtyMinus = document.getElementById('checkoutQtyMinus');
        const qtyPlus = document.getElementById('checkoutQtyPlus');
        
        if (qtyMinus) {
            qtyMinus.addEventListener('click', () => this.updateQuantity(-1));
        }
        
        if (qtyPlus) {
            qtyPlus.addEventListener('click', () => this.updateQuantity(1));
        }
        
        // Submit button
        const submitBtn = document.getElementById('checkoutSubmit');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submit());
        }
        
        // Order details toggle
        const orderDetailsToggle = document.getElementById('orderDetailsToggle');
        const orderDetailsContent = document.getElementById('orderDetailsContent');
        if (orderDetailsToggle && orderDetailsContent) {
            orderDetailsToggle.addEventListener('click', () => {
                orderDetailsToggle.classList.toggle('active');
                orderDetailsContent.classList.toggle('hidden');
                orderDetailsContent.classList.toggle('show');
            });
        }
        
        // Discount button
        const discountActionBtn = document.getElementById('discountActionBtn');
        
        if (discountActionBtn) {
            discountActionBtn.addEventListener('click', () => this.openDiscountModal());
        }
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('quickCheckoutModal');
                if (modal && !modal.classList.contains('hidden')) {
                    this.close();
                }
            }
        });
    }
}



