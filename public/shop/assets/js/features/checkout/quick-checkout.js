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
        this.selectedCrossSells = [];
        this.addressSelector = null;
        this.appliedDiscount = null;
        this.discountAmount = 0;
        this.shippingFee = 21000; // Default 21,000đ, will be loaded from API
        
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
        
        let html = '<div class="cross-sell-header">';
        html += '<i class="fas fa-gift"></i> ';
        html += '<span>Mua kèm - <strong style="color: #e74c3c;">MIỄN PHÍ SHIP</strong></span>';
        html += '</div>';
        
        this.crossSellProducts.forEach(product => {
            const isSelected = this.selectedCrossSells.includes(product.id);
            html += '<div class="cross-sell-item ' + (isSelected ? 'selected' : '') + '" ';
            html += 'onclick="quickCheckout.toggleCrossSell(' + product.id + ')">';
            html += '<div class="cross-sell-checkbox">';
            html += '<i class="fas fa-' + (isSelected ? 'check-square' : 'square') + '"></i>';
            html += '</div>';
            html += '<img src="' + (product.image || CONFIG.DEFAULT_IMAGE) + '" ';
            html += 'alt="' + escapeHtml(product.name) + '" class="cross-sell-image" ';
            html += 'loading="lazy">';
            html += '<div class="cross-sell-info">';
            html += '<div class="cross-sell-name">' + escapeHtml(product.name) + '</div>';
            html += '<div class="cross-sell-price">' + formatPrice(product.price) + '</div>';
            html += '</div>';
            html += '</div>';
        });
        
        container.innerHTML = html;
    }
    
    /**
     * Toggle cross-sell product selection
     */
    toggleCrossSell(productId) {
        const index = this.selectedCrossSells.indexOf(productId);
        if (index > -1) {
            this.selectedCrossSells.splice(index, 1);
        } else {
            this.selectedCrossSells.push(productId);
        }
        this.renderCrossSellProducts();
        this.updateSummary();
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
        const crossSellTotal = this.selectedCrossSells.reduce((sum, id) => {
            const product = this.crossSellProducts.find(p => p.id === id);
            return sum + (product ? product.price : 0);
        }, 0);
        
        // Check if free shipping from cross-sell or discount
        const hasFreeShipping = this.selectedCrossSells.length > 0 || 
                               (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount));
        const shippingFee = hasFreeShipping ? 0 : this.shippingFee;
        
        const beforeDiscount = subtotal + crossSellTotal + shippingFee;
        return beforeDiscount - this.discountAmount;
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
            this.selectedCrossSells.forEach(productId => {
                const product = this.crossSellProducts.find(p => p.id === productId);
                if (product) {
                    html += '<div class="order-item">';
                    html += '<div class="order-item-info">';
                    html += '<span class="order-item-name">' + escapeHtml(product.name) + '</span>';
                    html += '<span class="order-item-qty">x1</span>';
                    html += '</div>';
                    html += '<span class="order-item-price">' + formatPrice(product.price) + '</span>';
                    html += '</div>';
                }
            });
            crossSellContainer.innerHTML = html;
        } else {
            crossSellContainer.innerHTML = '';
        }
        
        // Update discount info
        const discountInfo = document.getElementById('orderDiscountInfo');
        const discountText = document.getElementById('orderDiscountText');
        
        if (this.appliedDiscount) {
            let text = `Mã ${this.appliedDiscount.code}`;
            if (this.appliedDiscount.type === 'freeship') {
                text += ' - Miễn phí ship';
            } else if (this.discountAmount > 0) {
                text += ` - Giảm ${formatPrice(this.discountAmount)}`;
            }
            discountText.textContent = text;
            discountInfo.classList.remove('hidden');
        } else {
            discountInfo.classList.add('hidden');
        }
    }
    
    /**
     * Update summary
     */
    updateSummary() {
        if (!this.product) return;
        
        // Update order details breakdown
        this.updateOrderDetails();
        
        // Calculate main product subtotal
        const subtotal = this.product.price * this.quantity;
        
        // Calculate cross-sell total
        let crossSellTotal = 0;
        this.selectedCrossSells.forEach(productId => {
            const product = this.crossSellProducts.find(p => p.id === productId);
            if (product) {
                crossSellTotal += product.price;
            }
        });
        
        // Calculate shipping (free if any cross-sell selected or discount is freeship)
        const hasFreeShipping = this.selectedCrossSells.length > 0 || 
                               (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount));
        const shippingFee = hasFreeShipping ? 0 : this.shippingFee;
        
        // Calculate total before discount
        const beforeDiscount = subtotal + crossSellTotal + shippingFee;
        
        // Calculate total after discount
        const total = beforeDiscount - this.discountAmount;
        
        // Update detailed summary
        document.getElementById('checkoutSubtotal').textContent = formatPrice(subtotal + crossSellTotal);
        
        const shippingElement = document.getElementById('checkoutShipping');
        if (hasFreeShipping) {
            shippingElement.innerHTML = '<span style="text-decoration: line-through; color: #999;">' + 
                formatPrice(this.shippingFee) + '</span> ' +
                '<span style="color: #27ae60; font-weight: bold;">MIỄN PHÍ</span>';
        } else {
            shippingElement.textContent = formatPrice(shippingFee);
        }
        
        // Update discount row
        const discountRow = document.getElementById('checkoutDiscountRow');
        if (this.appliedDiscount && this.discountAmount > 0) {
            discountRow.classList.remove('hidden');
            document.getElementById('checkoutDiscountAmount').textContent = '-' + formatPrice(this.discountAmount);
        } else {
            discountRow.classList.add('hidden');
        }
        
        document.getElementById('checkoutTotal').textContent = formatPrice(total);
        
        // Update compact summary
        document.getElementById('checkoutTotalCompact').textContent = formatPrice(total);
        
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
            crossSellProducts: this.selectedCrossSells.map(id => {
                const product = this.crossSellProducts.find(p => p.id === id);
                return {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: 1
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
            subtotal: this.product.price * this.quantity,
            crossSellTotal: this.selectedCrossSells.reduce((sum, id) => {
                const product = this.crossSellProducts.find(p => p.id === id);
                return sum + (product ? product.price : 0);
            }, 0),
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
        
        // Summary expand button
        const expandBtn = document.getElementById('summaryExpandBtn');
        const summaryDetail = document.getElementById('checkoutSummaryDetail');
        if (expandBtn && summaryDetail) {
            expandBtn.addEventListener('click', () => {
                summaryDetail.classList.toggle('hidden');
                expandBtn.classList.toggle('expanded');
            });
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

