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
        
        // Initialize discount modal
        this.discountModal = new DiscountModal((discount, amount) => this.applyDiscount(discount, amount));
        this.discountModal.setupEventListeners();
        
        // Expose to window for onclick handlers
        window.discountModal = this.discountModal;
        
        // Load shipping fee from API
        this.loadShippingFee();
        
        this.setupEventListeners();
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
        
        this.showModal();
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
                btn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.style.animation = 'pulse 2s infinite';
            }
        } else {
            bankInfo.classList.add('hidden');
        }
        
        // Update order details to reflect payment method
        this.updateOrderDetails();
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
        
        if (this.addressSelector) {
            this.addressSelector.reset();
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
        
        // Prepare order data
        const orderData = {
            product: this.product,
            quantity: this.quantity,
            crossSellProducts: this.selectedCrossSells.map(item => {
                const product = this.crossSellProducts.find(p => p.id === item.id);
                return {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: item.quantity
                };
            }),
            customer: {
                phone: formData.phone,
                name: formData.name,
                babyWeight: formData.babyWeight,
                note: formData.note
            },
            address: {
                provinceCode: addressData.provinceCode,
                districtCode: addressData.districtCode,
                wardCode: addressData.wardCode,
                street: addressData.street,
                fullAddress: addressData.fullAddress
            },
            discount: this.appliedDiscount ? {
                id: this.appliedDiscount.id,
                code: this.appliedDiscount.code,
                type: this.appliedDiscount.type,
                amount: this.discountAmount
            } : null,
            paymentMethod: this.paymentMethod,
            subtotal: this.product.price * this.quantity,
            crossSellTotal: this.selectedCrossSells.reduce((sum, item) => { const product = this.crossSellProducts.find(p => p.id === item.id); return sum + (product ? product.price * item.quantity : 0); }, 0),
            shippingFee: (this.selectedCrossSells.length > 0 || 
                         (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount))) 
                         ? 0 : this.shippingFee,
            discountAmount: this.discountAmount,
            total: this.calculateTotal(),
            isFlashSale: this.product.isFlashSale,
            hasFreeShipping: this.selectedCrossSells.length > 0 || 
                            (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount))
        };
        
        // Disable submit button
        const submitBtn = document.getElementById('checkoutSubmit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        
        try {
            // TODO: Send to API
            console.log('Order data:', orderData);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Success
            showToast('Đặt hàng thành công! Chúng tôi sẽ liên hệ với bạn sớm.', 'success');
            this.close();
            
            // TODO: Redirect to success page
            
        } catch (error) {
            console.error('Checkout error:', error);
            showToast('Có lỗi xảy ra. Vui lòng thử lại!', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Đặt hàng ngay';
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



