// ============================================
// QUICK CHECKOUT MODAL
// ============================================

import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { validateCheckoutForm } from '../../shared/utils/validators.js';
import { showToast } from '../../shared/utils/helpers.js';
import { CONFIG } from '../../shared/constants/config.js';
import { apiService } from '../../shared/services/api.service.js';
import { AddressSelector } from '../../components/address-selector.js';

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
        this.setupEventListeners();
    }
    
    /**
     * Open quick checkout modal
     */
    async open(product) {
        this.product = product;
        this.quantity = 1;
        this.selectedCrossSells = [];
        
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
            html += 'alt="' + escapeHtml(product.name) + '" class="cross-sell-image">';
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
        const shippingFee = this.selectedCrossSells.length > 0 ? 0 : CONFIG.SHIPPING_FEE;
        return subtotal + crossSellTotal + shippingFee;
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
     * Update summary
     */
    updateSummary() {
        if (!this.product) return;
        
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
        
        // Calculate shipping (free if any cross-sell selected)
        const shippingFee = this.selectedCrossSells.length > 0 ? 0 : CONFIG.SHIPPING_FEE;
        
        // Calculate total
        const total = subtotal + crossSellTotal + shippingFee;
        
        // Update detailed summary
        document.getElementById('checkoutSubtotal').textContent = formatPrice(subtotal + crossSellTotal);
        
        const shippingElement = document.getElementById('checkoutShipping');
        if (shippingFee === 0) {
            shippingElement.innerHTML = '<span style="text-decoration: line-through; color: #999;">' + 
                formatPrice(CONFIG.SHIPPING_FEE) + '</span> ' +
                '<span style="color: #27ae60; font-weight: bold;">MIỄN PHÍ</span>';
        } else {
            shippingElement.textContent = formatPrice(shippingFee);
        }
        
        document.getElementById('checkoutTotal').textContent = formatPrice(total);
        
        // Update compact summary
        document.getElementById('checkoutTotalCompact').textContent = formatPrice(total);
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
                note: formData.note
            },
            address: {
                provinceCode: addressData.provinceCode,
                districtCode: addressData.districtCode,
                wardCode: addressData.wardCode,
                street: addressData.street,
                fullAddress: addressData.fullAddress
            },
            subtotal: this.product.price * this.quantity,
            crossSellTotal: this.selectedCrossSells.reduce((sum, id) => {
                const product = this.crossSellProducts.find(p => p.id === id);
                return sum + (product ? product.price : 0);
            }, 0),
            shippingFee: this.selectedCrossSells.length > 0 ? 0 : CONFIG.SHIPPING_FEE,
            total: this.calculateTotal(),
            isFlashSale: this.product.isFlashSale,
            hasFreeShipping: this.selectedCrossSells.length > 0
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
