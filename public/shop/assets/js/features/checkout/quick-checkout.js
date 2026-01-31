// ============================================
// QUICK CHECKOUT MODAL
// ============================================

import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { validateCheckoutForm } from '../../shared/utils/validators.js';
import { showToast } from '../../shared/utils/helpers.js';
import { CONFIG } from '../../shared/constants/config.js';
import { apiService } from '../../shared/services/api.service.js';
import { AddressSelector } from '../../components/address-selector.js';
import { discountService } from '../../shared/services/discount.service.js';
import { successModal } from '../../shared/components/success-modal.js';
import { bundleProductsService } from '../../shared/services/bundle-products.service.js';
import { FormValidator } from '../../shared/utils/form-validator.js';
import { checkoutValidationRules, updateValidationRule } from '../../shared/constants/validation-rules.js';
import { errorDisplayService } from '../../shared/services/error-display.service.js';

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
        this.needsBabyWeight = true; // Flag for products needing baby weight (default: true)
        
        // LocalStorage key for form data
        this.STORAGE_KEY = 'quickCheckoutFormData';
        
        // Initialize form validator
        this.validator = null; // Will be initialized after modal opens
        
        // Load shipping fee from API
        this.loadShippingFee();
        
        // Load available discounts
        this.loadAvailableDiscounts();
        
        this.setupEventListeners();
        this.setupAutoSave();
    }
    
    /**
     * Load available discounts from API
     */
    async loadAvailableDiscounts() {
        try {
            this.availableDiscounts = await discountService.getActiveDiscounts();
        } catch (error) {
            console.error('Error loading discounts:', error);
            this.availableDiscounts = [];
        }
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
        
        // Check if product needs baby weight (not raw materials/accessories)
        this.needsBabyWeight = this.checkNeedsBabyWeight(product);
        
        // SHOW MODAL IMMEDIATELY for instant feedback
        this.showModal();
        
        // Render product info immediately (synchronous)
        this.render();
        
        // Initialize form validator
        this.initializeValidator();
        
        // Load data asynchronously in background (non-blocking)
        Promise.all([
            this.loadCrossSellProducts().then(() => {
                // Re-render cross-sell section after loaded
                this.renderCrossSellProducts();
            }),
            this.initializeAddressSelector()
        ]).catch(error => {
            console.error('Error loading checkout data:', error);
        });
        
        // Try to restore saved form data (synchronous)
        this.restoreFormData();
    }
    
    /**
     * Initialize address selector (non-blocking)
     */
    async initializeAddressSelector() {
        if (!this.addressSelector) {
            // Use HierarchicalAddressSelector instead of old AddressSelector
            const { HierarchicalAddressSelector } = await import('../../components/hierarchical-address-selector.js');
            this.addressSelector = new HierarchicalAddressSelector('quickCheckoutAddressSelectorContainer');
            await this.addressSelector.init();
        } else {
            this.addressSelector.reset();
        }
    }
    
    /**
     * Initialize form validator
     */
    initializeValidator() {
        // Update rules based on product requirements
        updateValidationRule('babyWeight', { required: this.needsBabyWeight });
        updateValidationRule('babyName', { required: this.needsBabyName });
        
        // Create validator instance
        this.validator = new FormValidator({
            formId: 'quickCheckoutModal', // Use modal ID as form container
            rules: {
                checkoutPhone: checkoutValidationRules.phone,
                checkoutName: checkoutValidationRules.name,
                checkoutBabyWeight: checkoutValidationRules.babyWeight,
                checkoutBabyName: checkoutValidationRules.babyName,
                // Address fields will be validated separately by AddressSelector
                checkoutNote: checkoutValidationRules.note
            },
            isModal: true,
            modalId: 'quickCheckoutModal',
            scrollOffset: 20,
            autoClear: true
        });
        
        // Setup auto-clear for address fields
        this.setupAddressAutoClear();
    }
    
    /**
     * Setup auto-clear for address fields
     */
    setupAddressAutoClear() {
        setTimeout(() => {
            const provinceSelect = document.getElementById('provinceSelect');
            const districtSelect = document.getElementById('districtSelect');
            const wardSelect = document.getElementById('wardSelect');
            const streetInput = document.getElementById('streetInput');
            
            if (provinceSelect) {
                provinceSelect.addEventListener('change', () => {
                    errorDisplayService.clearError('provinceSelect');
                });
            }
            
            if (districtSelect) {
                districtSelect.addEventListener('change', () => {
                    errorDisplayService.clearError('districtSelect');
                });
            }
            
            if (wardSelect) {
                wardSelect.addEventListener('change', () => {
                    errorDisplayService.clearError('wardSelect');
                });
            }
            
            if (streetInput) {
                streetInput.addEventListener('input', () => {
                    errorDisplayService.clearError('streetInput');
                });
            }
        }, 500);
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
     * Check if product needs baby weight input
     * Returns false for: Bi/charm bạc, Hạt đầu tâm, Sản phẩm bán kèm
     */
    checkNeedsBabyWeight(product) {
        if (!product.categories || !Array.isArray(product.categories)) {
            return true; // Default: require baby weight
        }
        
        // Categories that DON'T need baby weight (raw materials & accessories)
        const noWeightCategories = [
            'bi, charm bạc',
            'hạt đầu tâm mài sẵn',
            'sản phẩm bán kèm'
        ];
        
        // Check if product belongs to any of these categories
        const belongsToNoWeightCategory = product.categories.some(cat => {
            if (!cat.name) return false;
            const catName = cat.name.toLowerCase().trim();
            return noWeightCategories.some(noCat => catName === noCat);
        });
        
        // If belongs to no-weight category, don't need baby weight
        return !belongsToNoWeightCategory;
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
     * Load cross-sell products - Using shared service
     */
    async loadCrossSellProducts() {
        try {
            this.crossSellProducts = await bundleProductsService.loadBundleProducts();
            console.log('✅ [QUICK-CHECKOUT] Loaded', this.crossSellProducts.length, 'cross-sell products');
        } catch (error) {
            console.error('❌ [QUICK-CHECKOUT] Error loading cross-sell products:', error);
            this.crossSellProducts = [];
        }
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
        
        // Price container (sale price + original price on same line)
        html += '<div class="checkout-product-prices">';
        html += '<span class="checkout-product-price">' + formatPrice(this.product.price) + '</span>';
        
        if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
            html += '<span class="checkout-product-original-price">' + formatPrice(this.product.originalPrice) + '</span>';
        }
        
        html += '</div>'; // close prices container
        html += '</div>';
        productContainer.innerHTML = html;
        
        // Show/hide baby name input based on product category
        const babyNameGroup = document.getElementById('babyNameGroup');
        if (babyNameGroup) {
            const babyNameInput = document.getElementById('checkoutBabyName');
            if (this.needsBabyName) {
                babyNameGroup.style.display = 'block';
                if (babyNameInput) {
                    babyNameInput.setAttribute('required', 'required');
                }
            } else {
                babyNameGroup.style.display = 'none';
                if (babyNameInput) {
                    babyNameInput.removeAttribute('required');
                    babyNameInput.value = '';
                }
            }
        }
        
        // Show/hide baby weight input based on product category
        const babyWeightGroup = document.getElementById('babyWeightGroup');
        if (babyWeightGroup) {
            const babyWeightInput = document.getElementById('checkoutBabyWeight');
            if (this.needsBabyWeight) {
                babyWeightGroup.style.display = 'block';
                if (babyWeightInput) {
                    babyWeightInput.setAttribute('required', 'required');
                }
            } else {
                babyWeightGroup.style.display = 'none';
                if (babyWeightInput) {
                    babyWeightInput.removeAttribute('required');
                    babyWeightInput.value = '';
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
        if (!container) return;
        
        // If no products loaded yet, show skeleton
        if (this.crossSellProducts.length === 0) {
            this.renderCrossSellSkeleton(container);
            return;
        }
        
        let html = '<div class="cross-sell-header-legend">';
        html += '<svg class="gift-icon-animated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 12.75v9h6.75a2.25 2.25 0 0 0 2.25-2.25v-6.75h-9Z" /></svg> ';
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
            html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block;"><path fill-rule="evenodd" d="M4.25 12a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" /></svg>';
            html += '</button>';
            html += '<span class="cross-sell-qty-value-compact" data-product="' + product.id + '">' + quantity + '</span>';
            html += '<button class="cross-sell-qty-btn-compact" onclick="quickCheckout.updateTempQty(' + product.id + ', 1)" data-product="' + product.id + '" data-action="plus">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block;"><path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg>';
            html += '</button>';
            html += '</div>';
            
            // Add/Remove button
            if (!isSelected) {
                html += '<button class="cross-sell-add-btn-compact" onclick="quickCheckout.addCrossSell(' + product.id + ')">';
                html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block;"><path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg> Thêm';
                html += '</button>';
            } else {
                html += '<button class="cross-sell-remove-btn-compact" onclick="quickCheckout.removeCrossSell(' + product.id + ')">';
                html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg> Đã thêm';
                html += '</button>';
            }
            
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div>'; // close items-wrapper
        
        container.innerHTML = html;
    }
    
    /**
     * Render skeleton loading for cross-sell products
     */
    renderCrossSellSkeleton(container) {
        let html = '<div class="cross-sell-header-legend">';
        html += '<svg class="gift-icon-animated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 12.75v9h6.75a2.25 2.25 0 0 0 2.25-2.25v-6.75h-9Z" /></svg> ';
        html += '<span>Mua kèm - <strong style="color: #e74c3c;">MIỄN PHÍ SHIP</strong></span>';
        html += '</div>';
        
        html += '<div class="cross-sell-items-wrapper">';
        
        // Show 2 skeleton items
        for (let i = 0; i < 2; i++) {
            html += '<div class="cross-sell-item skeleton-loading">';
            html += '<div class="skeleton-box cross-sell-image"></div>';
            html += '<div class="cross-sell-info">';
            html += '<div class="skeleton-box" style="height: 16px; width: 80%; margin-bottom: 8px;"></div>';
            html += '<div class="skeleton-box" style="height: 14px; width: 50%;"></div>';
            html += '</div>';
            html += '<div class="cross-sell-actions">';
            html += '<div class="skeleton-box" style="height: 32px; width: 100px;"></div>';
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
        
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
            feedback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg> Đã cập nhật: ' + newQty + ' sản phẩm';
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
            
            // Remove 'paid' class from order details section
            const orderDetailsSection = document.querySelector('.order-details-section');
            if (orderDetailsSection) {
                orderDetailsSection.classList.remove('paid');
            }
        }
        
        // Update UI - both active class and radio button
        document.querySelectorAll('.payment-method-item').forEach(item => {
            const radio = item.querySelector('.payment-method-radio');
            if (item.dataset.method === method) {
                item.classList.add('active');
                if (radio) radio.checked = true;
            } else {
                item.classList.remove('active');
                if (radio) radio.checked = false;
            }
        });
        
        // Show/hide bank transfer info
        const bankInfo = document.getElementById('bankTransferInfo');
        const paymentRow = document.getElementById('orderPaymentRow');
        
        if (method === 'bank') {
            bankInfo.classList.remove('hidden');
            // Show payment row for bank transfer
            if (paymentRow) paymentRow.classList.remove('hidden');
            
            // Update transfer amount
            const total = this.calculateTotal();
            document.getElementById('bankTransferAmount').textContent = formatPrice(total);
            
            // Reset confirm button if switching back
            const btn = document.getElementById('bankConfirmBtn');
            if (btn && !this.bankTransferConfirmed) {
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg> Xác nhận đã chuyển khoản';
                btn.style.background = 'linear-gradient(135deg, #4caf50, #66bb6a)';
                btn.disabled = false;
                btn.style.cursor = 'pointer';
            }
            
            // Start countdown timer (10 minutes)
            this.startCountdown(10 * 60);
        } else {
            bankInfo.classList.add('hidden');
            // Hide payment row for COD
            if (paymentRow) paymentRow.classList.add('hidden');
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
                countdownBox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clip-rule="evenodd" /></svg> <span>Hết thời gian thanh toán!</span>';
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
        
        // Get bank transfer info container
        const bankInfo = document.getElementById('bankTransferInfo');
        if (bankInfo) {
            bankInfo.classList.add('confirmed');
        }
        
        // Add 'paid' class to order details section to change total amount color to green
        const orderDetailsSection = document.querySelector('.order-details-section');
        if (orderDetailsSection) {
            orderDetailsSection.classList.add('paid');
        }
        
        // Create confirmed notice
        const bankInfoContent = document.querySelector('#bankTransferInfo .bank-info-content');
        if (bankInfoContent && !document.getElementById('bankPaymentConfirmedNotice')) {
            const confirmedNotice = document.createElement('div');
            confirmedNotice.id = 'bankPaymentConfirmedNotice';
            confirmedNotice.className = 'bank-payment-confirmed-notice';
            confirmedNotice.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
                </svg>
                <div class="notice-content">
                    <div class="notice-title">Đã xác nhận thanh toán</div>
                    <div class="notice-subtitle">Không cần thanh toán khi nhận hàng</div>
                </div>
            `;
            
            // Insert before bank info content
            bankInfoContent.parentNode.insertBefore(confirmedNotice, bankInfoContent);
            
            // Collapse bank info content
            bankInfoContent.classList.add('collapsed');
            
            // Add toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'bank-info-toggle';
            toggleBtn.innerHTML = `
                <span>Xem thông tin chuyển khoản</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem;">
                    <path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />
                </svg>
            `;
            toggleBtn.onclick = () => {
                bankInfoContent.classList.toggle('show');
                toggleBtn.classList.toggle('expanded');
                const span = toggleBtn.querySelector('span');
                span.textContent = toggleBtn.classList.contains('expanded') 
                    ? 'Ẩn thông tin chuyển khoản' 
                    : 'Xem thông tin chuyển khoản';
            };
            
            bankInfoContent.parentNode.insertBefore(toggleBtn, bankInfoContent.nextSibling);
        }
        
        // Update button
        const btn = document.getElementById('bankConfirmBtn');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block;"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" /></svg> Đã xác nhận chuyển khoản';
        btn.style.background = 'linear-gradient(135deg, #1e8449, #239b56)';
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        btn.style.animation = 'none';
        btn.style.display = 'none'; // Hide the button
        
        // Update order details to show paid status
        this.updateOrderDetails();
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
        // Calculate weight surcharge
        const weightSurcharge = this.getCurrentWeightSurcharge();
        
        const subtotal = (this.product.price * this.quantity) + weightSurcharge;
        const crossSellTotal = this.selectedCrossSells.reduce((sum, item) => { const product = this.crossSellProducts.find(p => p.id === item.id); return sum + (product ? product.price * item.quantity : 0); }, 0);
        
        // Check if free shipping from cross-sell or discount
        const hasFreeShipping = this.selectedCrossSells.length > 0 || 
                               (this.appliedDiscount && discountService.isFreeShipping(this.appliedDiscount));
        const shippingFee = hasFreeShipping ? 0 : this.shippingFee;
        
        const beforeDiscount = subtotal + crossSellTotal + shippingFee;
        return beforeDiscount - this.discountAmount;
    }
    
    /**
     * Get current weight surcharge based on selected weight
     */
    getCurrentWeightSurcharge() {
        const selectedWeight = this.getSelectedBabyWeight();
        if (!selectedWeight) return 0;
        
        // Extract weight number (e.g., "18kg" -> 18)
        const weightMatch = selectedWeight.match(/(\d+)/);
        const weightKg = weightMatch ? parseInt(weightMatch[1]) : 0;
        
        return this.calculateWeightSurcharge(weightKg);
    }
    
    /**
     * Update order details with weight surcharge
     */
    updateOrderDetailsWithWeight() {
        this.updateOrderDetails();
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
     * Show weight surcharge notice
     */
    showWeightSurchargeNotice(weightKg) {
        const notice = document.getElementById('weightSurchargeNotice');
        const amountEl = document.getElementById('surchargeAmount');
        
        if (!notice || !amountEl || !this.product) return;
        
        // Calculate surcharge based on product category
        const surcharge = this.calculateWeightSurcharge(weightKg);
        
        if (surcharge > 0) {
            amountEl.textContent = '+' + formatPrice(surcharge);
            notice.classList.remove('hidden');
        } else {
            notice.classList.add('hidden');
        }
    }
    
    /**
     * Show weight surcharge confirmation dialog
     */
    showWeightSurchargeConfirmation(weightKg) {
        const surcharge = this.calculateWeightSurcharge(weightKg);
        const surchargeFormatted = formatPrice(surcharge);
        const newTotal = this.product.price + surcharge;
        const newTotalFormatted = formatPrice(newTotal);
        
        const message = `
            <div style="text-align: left; line-height: 1.6;">
                <p style="margin-bottom: 1rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block; color: #f39c12;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" /></svg>
                    <strong>Cân nặng ${weightKg}kg vượt quá 15kg</strong>
                </p>
                <p style="margin-bottom: 1rem; color: #666;">
                    Do làm size lớn hơn cần nhiều nguyên liệu hơn, giá sản phẩm sẽ tăng thêm <strong style="color: #e74c3c;">15%</strong>
                </p>
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Giá gốc:</span>
                        <span>${formatPrice(this.product.price)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #f39c12;">
                        <span>Phụ phí (+15%):</span>
                        <strong>+${surchargeFormatted}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 2px solid #e0e0e0;">
                        <strong>Giá mới:</strong>
                        <strong style="color: #e74c3c; font-size: 1.1rem;">${newTotalFormatted}</strong>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.9rem;">
                    Bạn có đồng ý với mức giá này không?
                </p>
            </div>
        `;
        
        // Show confirmation using browser confirm (simple approach)
        // You can replace this with a custom modal if needed
        if (confirm(message.replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' '))) {
            this.acceptCustomWeight(weightKg);
        } else {
            this.rejectCustomWeight();
        }
    }
    
    /**
     * Accept custom weight and apply surcharge
     */
    acceptCustomWeight(weightKg) {
        const babyWeightInput = document.getElementById('checkoutBabyWeight');
        if (babyWeightInput) {
            babyWeightInput.value = weightKg + 'kg';
        }
        
        // Hide weight selection UI
        this.hideWeightSelectionUI();
        
        // Update hint text to show confirmation
        const hintEl = document.getElementById('customWeightHint');
        const changeBtn = document.getElementById('customWeightChangeBtn');
        if (hintEl) {
            const span = hintEl.querySelector('span');
            if (span) {
                span.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block; color: #27ae60;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg> Đã xác nhận cân nặng ' + weightKg + 'kg';
            }
            hintEl.style.color = '#27ae60';
            hintEl.style.fontWeight = '600';
            
            // Show "Chọn lại" button
            if (changeBtn) {
                changeBtn.classList.remove('hidden');
            }
        }
        
        // Update order details with surcharge
        this.updateOrderDetailsWithWeight();
        
        showToast(`Đã xác nhận cân nặng ${weightKg}kg`, 'success');
    }
    
    /**
     * Accept preset weight (hide buttons and show confirmation)
     */
    acceptPresetWeight(weight, displayText) {
        // Hide weight selection UI
        this.hideWeightSelectionUI();
        
        // Show confirmation in baby weight group
        const babyWeightGroup = document.getElementById('babyWeightGroup');
        if (babyWeightGroup) {
            // Create or update confirmation message
            let confirmationDiv = document.getElementById('weightConfirmationMessage');
            if (!confirmationDiv) {
                confirmationDiv = document.createElement('div');
                confirmationDiv.id = 'weightConfirmationMessage';
                confirmationDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 2px solid #28a745; border-radius: 12px; margin-top: 0.5rem;';
                babyWeightGroup.appendChild(confirmationDiv);
            }
            
            confirmationDiv.innerHTML = `
                <span style="color: #155724; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block; color: #28a745;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg>
                    Đã chọn: ${displayText}
                </span>
                <button type="button" class="preset-weight-change-btn" style="background: white; border: 2px solid #28a745; color: #28a745; padding: 0.4rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.3s ease;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block;"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg> Chọn lại
                </button>
            `;
        }
        
        showToast(`Đã chọn cân nặng: ${displayText}`, 'success');
    }
    
    /**
     * Hide weight selection UI (common helper)
     */
    hideWeightSelectionUI() {
        // Hide preset buttons
        const presetButtons = document.querySelector('.weight-preset-buttons');
        if (presetButtons) {
            presetButtons.style.display = 'none';
        }
        
        // Hide label
        const babyWeightGroup = document.getElementById('babyWeightGroup');
        const label = babyWeightGroup?.querySelector('.checkout-form-label');
        if (label) {
            label.style.display = 'none';
        }
        
        // Hide custom input wrapper
        const inputWrapper = document.querySelector('.custom-weight-input-wrapper');
        if (inputWrapper) {
            inputWrapper.style.display = 'none';
        }
    }
    
    /**
     * Show weight selection UI (common helper)
     */
    showWeightSelectionUI() {
        // Show preset buttons
        const presetButtons = document.querySelector('.weight-preset-buttons');
        if (presetButtons) {
            presetButtons.style.display = 'grid';
        }
        
        // Show label
        const babyWeightGroup = document.getElementById('babyWeightGroup');
        const label = babyWeightGroup?.querySelector('.checkout-form-label');
        if (label) {
            label.style.display = 'flex';
        }
    }
    
    /**
     * Reject custom weight and reset
     */
    rejectCustomWeight() {
        const customWeightInput = document.getElementById('customWeightInput');
        const customWeightGroup = document.getElementById('customWeightGroup');
        const babyWeightInput = document.getElementById('checkoutBabyWeight');
        
        // Show weight selection UI again
        this.showWeightSelectionUI();
        
        // Clear custom input
        if (customWeightInput) {
            customWeightInput.value = '';
            customWeightInput.disabled = false;
        }
        
        // Hide custom group
        if (customWeightGroup) {
            customWeightGroup.classList.add('hidden');
        }
        
        // Clear hidden input
        if (babyWeightInput) {
            babyWeightInput.value = '';
        }
        
        // Remove selected class from all buttons
        const weightPresetButtons = document.querySelectorAll('.weight-preset-btn');
        weightPresetButtons.forEach(btn => btn.classList.remove('selected'));
        
        showToast('Vui lòng chọn lại cân nặng', 'info');
    }
    
    /**
     * Reset custom weight (allow user to change)
     */
    resetCustomWeight() {
        const customWeightInput = document.getElementById('customWeightInput');
        const hintEl = document.getElementById('customWeightHint');
        const confirmBtn = document.getElementById('customWeightConfirmBtn');
        const changeBtn = document.getElementById('customWeightChangeBtn');
        const babyWeightInput = document.getElementById('checkoutBabyWeight');
        const inputWrapper = document.querySelector('.custom-weight-input-wrapper');
        
        // Show weight selection UI
        this.showWeightSelectionUI();
        
        // Show input wrapper again
        if (inputWrapper) {
            inputWrapper.style.display = 'flex';
        }
        
        // Enable input
        if (customWeightInput) {
            customWeightInput.disabled = false;
            customWeightInput.value = '';
            customWeightInput.focus();
        }
        
        // Reset hint text
        if (hintEl) {
            const span = hintEl.querySelector('span');
            if (span) {
                span.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" /></svg> Nhập từ 3kg đến 50kg';
            }
            hintEl.style.color = '#666';
            hintEl.style.fontWeight = 'normal';
        }
        
        // Hide "Chọn lại" button
        if (changeBtn) {
            changeBtn.classList.add('hidden');
        }
        
        // Disable confirm button until new value entered
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
        
        // Clear hidden input
        if (babyWeightInput) {
            babyWeightInput.value = '';
        }
        
        // Remove selected class from all preset buttons
        const weightPresetButtons = document.querySelectorAll('.weight-preset-btn');
        weightPresetButtons.forEach(btn => btn.classList.remove('selected'));
        
        // Update order details (remove surcharge)
        this.updateOrderDetailsWithWeight();
        
        showToast('Vui lòng chọn lại cân nặng', 'info');
    }
    
    /**
     * Reset preset weight (allow user to change)
     */
    resetPresetWeight() {
        const babyWeightInput = document.getElementById('checkoutBabyWeight');
        const confirmationDiv = document.getElementById('weightConfirmationMessage');
        
        // Show weight selection UI
        this.showWeightSelectionUI();
        
        // Remove confirmation message
        if (confirmationDiv) {
            confirmationDiv.remove();
        }
        
        // Clear hidden input
        if (babyWeightInput) {
            babyWeightInput.value = '';
        }
        
        // Remove selected class from all preset buttons
        const weightPresetButtons = document.querySelectorAll('.weight-preset-btn');
        weightPresetButtons.forEach(btn => btn.classList.remove('selected'));
        
        // Update order details
        this.updateOrderDetailsWithWeight();
        
        showToast('Vui lòng chọn lại cân nặng', 'info');
    }
    
    /**
     * Hide weight surcharge notice
     */
    hideWeightSurchargeNotice() {
        const notice = document.getElementById('weightSurchargeNotice');
        if (notice) {
            notice.classList.add('hidden');
        }
    }
    
    /**
     * Calculate weight surcharge (15% of product price, rounded)
     */
    calculateWeightSurcharge(weightKg) {
        // Safety check
        if (!this.product) return 0;
        
        // No surcharge if weight <= 15kg
        if (weightKg <= 15) {
            return 0;
        }
        
        // Calculate 15% of product price
        const basePrice = this.product.price || 0;
        const surcharge = basePrice * 0.15;
        
        // Round down to nearest 1000
        return Math.floor(surcharge / 1000) * 1000;
    }
    
    /**
     * Get selected baby weight (including custom weight)
     */
    getSelectedBabyWeight() {
        const hiddenInput = document.getElementById('checkoutBabyWeight');
        const customInput = document.getElementById('customWeightInput');
        
        if (!hiddenInput) return '';
        
        const value = hiddenInput.value;
        
        // If custom and has custom input value
        if (value === 'custom' && customInput && customInput.value) {
            return customInput.value + 'kg';
        }
        
        // If it's a range like "3-4kg", use the max value for calculation
        if (value && value.includes('-')) {
            const match = value.match(/(\d+)-(\d+)kg/);
            if (match) {
                // Use max value of range for surcharge calculation
                return match[2] + 'kg';
            }
        }
        
        return value;
    }
    
    /**
     * Update order details breakdown
     */
    updateOrderDetails() {
        // Calculate weight surcharge once at the beginning
        const weightSurcharge = this.getCurrentWeightSurcharge();
        
        // Calculate totals (reuse weightSurcharge from above)
        const subtotal = (this.product.price * this.quantity) + weightSurcharge;
        const crossSellTotal = this.selectedCrossSells.reduce((sum, item) => {
            const product = this.crossSellProducts.find(p => p.id === item.id);
            return sum + (product ? product.price * item.quantity : 0);
        }, 0);
        
        // Calculate total item count
        const totalItemCount = this.quantity + this.selectedCrossSells.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update item count display
        const orderItemCount = document.getElementById('orderItemCount');
        if (orderItemCount) {
            orderItemCount.textContent = `(${totalItemCount} sp)`;
        }
        
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
        const orderTotalLabelText = document.getElementById('orderTotalLabelText');
        
        if (orderTotalDetail) {
            orderTotalDetail.textContent = formatPrice(total);
        }
        
        // Update total label based on payment method
        if (orderTotalLabelText) {
            if (this.paymentMethod === 'bank' && this.bankTransferConfirmed) {
                orderTotalLabelText.textContent = 'Đã thanh toán:';
            } else {
                orderTotalLabelText.textContent = 'Tổng cộng:';
            }
        }
        
        // Update payment row based on payment method
        const orderPaymentRow = document.getElementById('orderPaymentRow');
        const orderPaymentLabel = document.querySelector('#orderPaymentRow .payment-label');
        const orderPaymentAmount = document.getElementById('orderPaymentAmount');
        
        if (orderPaymentRow && orderPaymentLabel && orderPaymentAmount) {
            if (this.paymentMethod === 'bank') {
                // Bank transfer - Hide payment row (not needed)
                orderPaymentRow.classList.add('hidden');
            } else {
                // COD - Hide payment row (not needed, redundant with total)
                orderPaymentRow.classList.add('hidden');
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
                // Đã chuyển khoản - hiển thị "Đã thanh toán"
                totalLabelMain.textContent = 'Đã thanh toán';
                inlineTotal.textContent = formatPrice(total);
                totalBox.classList.add('paid');
                
                // Show savings if any
                const savings = this.discountAmount + (hasFreeShipping ? this.shippingFee : 0);
                if (savings > 0) {
                    savingsLabel.textContent = 'Tiết kiệm ' + formatPrice(savings);
                    savingsLabel.style.color = '#27ae60';
                } else {
                    savingsLabel.textContent = '';
                }
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
        const discountResult = document.getElementById('discountResultQuick');
        
        if (this.appliedDiscount) {
            discountInput.value = this.appliedDiscount.code;
            discountInput.classList.add('has-discount');
            discountBtnText.textContent = 'Đổi mã';
            
            const discountText = discountService.formatDiscountText(this.appliedDiscount);
            if (discountResult) {
                discountResult.innerHTML = '<div class="discount-success">✓ Đã áp dụng mã <strong>' + this.appliedDiscount.code + '</strong> - ' + discountText + '</div>';
                discountResult.style.display = 'block';
            }
        } else {
            discountInput.value = '';
            discountInput.classList.remove('has-discount');
            discountBtnText.textContent = 'Áp dụng';
            
            if (discountResult) {
                discountResult.style.display = 'none';
                discountResult.innerHTML = '';
            }
        }
        
        // Render available codes
        this.renderAvailableCodes();
    }
    
    /**
     * Render top 2 available discount codes
     */
    renderAvailableCodes() {
        const container = document.getElementById('codeListQuick');
        if (!container) return;
        
        if (!this.availableDiscounts || this.availableDiscounts.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; padding: 0.75rem; font-size: 0.85rem;">Không có mã giảm giá khả dụng</div>';
            return;
        }
        
        // Get top 2 best discounts
        const orderAmount = this.calculateTotal() + this.discountAmount;
        const bestDiscounts = this.availableDiscounts
            .filter(d => d.active && d.visible)
            .map(d => {
                const isApplicable = !d.min_order_amount || orderAmount >= d.min_order_amount;
                const savings = isApplicable ? discountService.calculateDiscountAmount(d, orderAmount) : 0;
                return { ...d, isApplicable, savings };
            })
            .sort((a, b) => {
                if (a.isApplicable && !b.isApplicable) return -1;
                if (!a.isApplicable && b.isApplicable) return 1;
                return b.savings - a.savings;
            })
            .slice(0, 2);
        
        const html = bestDiscounts.map(code => {
            const discountText = discountService.formatDiscountText(code);
            const isApplied = this.appliedDiscount && this.appliedDiscount.code === code.code;
            
            let savingsText = '';
            if (code.isApplicable && code.savings > 0) {
                savingsText = `💰 Tiết kiệm ${formatPrice(code.savings)}`;
            } else if (!code.isApplicable && code.min_order_amount) {
                const remaining = code.min_order_amount - orderAmount;
                savingsText = `💡 Mua thêm ${formatPrice(remaining)} để áp dụng`;
            }
            
            return '<div class="code-item-quick' + (!code.isApplicable ? ' disabled' : '') + (isApplied ? ' applied' : '') + '">' +
                '<div class="code-item-info">' +
                '<span class="code-name-quick">' + escapeHtml(code.code) + '</span>' +
                '<span class="code-desc-quick"> - ' + escapeHtml(discountText) + '</span>' +
                (savingsText ? '<div class="code-savings-quick">' + savingsText + '</div>' : '') +
                '</div>' +
                '<button class="code-apply-btn-quick' + (isApplied ? ' applied' : '') + '" ' +
                'onclick="quickCheckout.quickApplyDiscount(\'' + escapeHtml(code.code) + '\')" ' +
                (code.isApplicable && !isApplied ? '' : 'disabled') + '>' +
                (isApplied ? '✓ Đã áp dụng' : 'Áp dụng') +
                '</button>' +
                '</div>';
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Quick apply discount from available codes
     */
    quickApplyDiscount(code) {
        const discount = this.availableDiscounts.find(d => d.code === code);
        if (!discount) return;
        
        const orderAmount = this.calculateTotal() + this.discountAmount;
        const amount = discountService.calculateDiscountAmount(discount, orderAmount);
        
        this.applyDiscount(discount, amount);
    }
    
    /**
     * Apply discount manually from input
     */
    async applyDiscountManually() {
        const input = document.getElementById('discountCodeInput');
        const code = input.value.trim().toUpperCase();
        const discountResult = document.getElementById('discountResultQuick');
        
        if (!code) {
            if (this.appliedDiscount) {
                this.removeDiscount();
            }
            return;
        }
        
        // If same code already applied, remove it
        if (this.appliedDiscount && this.appliedDiscount.code === code) {
            this.removeDiscount();
            return;
        }
        
        // Find discount
        const discount = this.availableDiscounts.find(d => d.code === code && d.active);
        
        if (!discount) {
            if (discountResult) {
                discountResult.innerHTML = '<div class="discount-error">✗ Mã giảm giá không tồn tại hoặc đã hết hạn</div>';
                discountResult.style.display = 'block';
            }
            return;
        }
        
        // Check minimum order
        const orderAmount = this.calculateTotal() + this.discountAmount;
        if (discount.min_order_amount && orderAmount < discount.min_order_amount) {
            if (discountResult) {
                discountResult.innerHTML = '<div class="discount-error">✗ Đơn hàng tối thiểu ' + formatPrice(discount.min_order_amount) + ' để áp dụng mã này</div>';
                discountResult.style.display = 'block';
            }
            return;
        }
        
        // Apply discount
        const amount = discountService.calculateDiscountAmount(discount, orderAmount);
        this.applyDiscount(discount, amount);
    }
    
    /**
     * Open discount modal (using shared cart modal)
     */
    async openDiscountModal() {
        console.log('🎫 Opening discount modal...');
        const orderAmount = this.calculateTotal() + this.discountAmount; // Get amount before discount
        console.log('Order amount:', orderAmount);
        
        // Use shared modal from cart
        this.renderDiscountsToModal(orderAmount);
        
        // Show modal
        const modal = document.getElementById('allDiscountsModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        
        // Setup close handlers
        const closeBtn = document.getElementById('closeAllDiscountsModal');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeDiscountModal();
        }
        
        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeDiscountModal();
            }
        };
    }
    
    /**
     * Close discount modal
     */
    closeDiscountModal() {
        const modal = document.getElementById('allDiscountsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    /**
     * Render discounts to modal
     */
    renderDiscountsToModal(orderAmount) {
        const container = document.getElementById('allDiscountsList');
        if (!container) return;
        
        if (!this.availableDiscounts || this.availableDiscounts.length === 0) {
            container.innerHTML = '<div class="no-discounts-message">' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 2rem; height: 2rem; display: inline-block;"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" /></svg>' +
                '<p>Không có mã giảm giá khả dụng</p>' +
                '</div>';
            return;
        }
        
        // Filter and sort discounts
        const discounts = this.availableDiscounts
            .filter(d => d.active && d.visible)
            .map(d => {
                const isApplicable = !d.min_order_amount || orderAmount >= d.min_order_amount;
                const savings = isApplicable ? discountService.calculateDiscountAmount(d, orderAmount) : 0;
                return { ...d, isApplicable, savings };
            })
            .sort((a, b) => {
                if (a.isApplicable && !b.isApplicable) return -1;
                if (!a.isApplicable && b.isApplicable) return 1;
                return b.savings - a.savings;
            });
        
        const html = discounts.map(code => {
            const discountText = discountService.formatDiscountText(code);
            
            let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;"><path fill-rule="evenodd" d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 0 0 5.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 0 0-2.122-.879H5.25ZM6.375 7.5a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" /></svg>';
            if (code.type === 'freeship') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;"><path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" /><path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z" /><path d="M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" /></svg>';
            if (code.type === 'gift') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;"><path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 12.75v9h6.75a2.25 2.25 0 0 0 2.25-2.25v-6.75h-9Z" /></svg>';
            
            let detailsHtml = '';
            
            if (code.min_order_amount) {
                detailsHtml += '<div class="discount-card-detail">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>' +
                    '<span>Đơn tối thiểu: ' + formatPrice(code.min_order_amount) + '</span>' +
                    '</div>';
            }
            
            if (code.expiry_date) {
                const expiryDate = new Date(code.expiry_date);
                const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                detailsHtml += '<div class="discount-card-detail">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" /></svg>' +
                    '<span>HSD: ' + expiryDate.toLocaleDateString('vi-VN') + 
                    (daysLeft > 0 && daysLeft <= 7 ? ' (còn ' + daysLeft + ' ngày)' : '') +
                    '</span>' +
                    '</div>';
            }
            
            return '<div class="discount-card ' + (code.isApplicable ? '' : 'disabled') + '">' +
                (code.savings > 0 && code.isApplicable ? '<div class="discount-card-savings">💰 Tiết kiệm ' + formatPrice(code.savings) + '</div>' : '') +
                '<div class="discount-card-header">' +
                '<div class="discount-card-icon">' +
                iconSvg +
                '</div>' +
                '<div class="discount-card-info">' +
                '<div class="discount-card-code">' + escapeHtml(code.code) + '</div>' +
                (code.title ? '<div class="discount-card-title">' + escapeHtml(code.title) + '</div>' : '') +
                '</div>' +
                '</div>' +
                (detailsHtml ? '<div class="discount-card-details">' + detailsHtml + '</div>' : '') +
                '<button class="discount-card-apply" ' +
                'onclick="quickCheckout.applyDiscountFromModal(\'' + escapeHtml(code.code) + '\')" ' +
                (code.isApplicable ? '' : 'disabled') + '>' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" /></svg>' +
                (code.isApplicable ? 'Áp dụng ngay' : 'Chưa đủ điều kiện') +
                '</button>' +
                '</div>';
        }).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * Apply discount from modal
     */
    applyDiscountFromModal(code) {
        const discount = this.availableDiscounts.find(d => d.code === code);
        if (!discount) return;
        
        const orderAmount = this.calculateTotal() + this.discountAmount;
        const amount = discountService.calculateDiscountAmount(discount, orderAmount);
        
        this.applyDiscount(discount, amount);
        this.closeDiscountModal();
    }
    
    /**
     * Apply discount
     */
    applyDiscount(discount, amount) {
        this.appliedDiscount = discount;
        this.discountAmount = amount;
        this.updateSummary();
    }
    
    /**
     * Remove discount
     */
    removeDiscount() {
        this.appliedDiscount = null;
        this.discountAmount = 0;
        this.updateSummary();
    }
    
    /**
     * Submit checkout
     */
    async submit() {
        if (!this.product) return;
        
        // Validate form using validator
        const validationResult = this.validator.validate();
        
        if (!validationResult.isValid) {
            // Errors are already displayed by validator
            // No need for toast
            return;
        }
        
        // Validate address
        const addressValidation = this.addressSelector.validate();
        if (!addressValidation.isValid) {
            // Show inline error for address fields
            if (!this.addressSelector.provinceCode) {
                errorDisplayService.showError('provinceSelect', addressValidation.message);
            } else if (!this.addressSelector.districtCode) {
                errorDisplayService.showError('districtSelect', addressValidation.message);
            } else if (!this.addressSelector.wardCode) {
                errorDisplayService.showError('wardSelect', addressValidation.message);
            } else if (!this.addressSelector.street) {
                errorDisplayService.showError('streetInput', addressValidation.message);
            }
            
            // Scroll to address section in modal
            const addressContainer = document.getElementById('quickCheckoutAddressSelectorContainer');
            if (addressContainer) {
                addressContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
            return;
        }
        
        // Clear address errors if validation passed
        errorDisplayService.clearError('provinceSelect');
        errorDisplayService.clearError('districtSelect');
        errorDisplayService.clearError('wardSelect');
        errorDisplayService.clearError('streetInput');
        
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
            }
            return;
        }
        
        // Get form data (already validated)
        const formData = this.validator.getFormData();
        
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
                size: this.needsBabyWeight ? formData.babyWeight : '', // Only add baby weight if needed
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
                    size: this.needsBabyWeight ? formData.babyWeight : '' // Only add baby weight if needed
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
        
        // Disable submit button and show spinner only
        const submitBtn = document.getElementById('checkoutSubmit');
        submitBtn.disabled = true;
        
        // Add loading class to show spinner and hide text
        submitBtn.classList.add('loading');
        
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
                // Clear saved form data after successful order
                this.clearSavedData();
                
                // Stop countdown
                this.stopCountdown();
                
                // Remove loading class
                submitBtn.classList.remove('loading');
                
                // Close checkout modal
                this.close();
                
                // Show success modal with order info
                successModal.show({
                    orderId: result.order?.order_id || orderData.orderId,
                    total: totalAmount
                });
                
                // Reset button state
                submitBtn.disabled = false;
                
                console.log('✅ Order created:', result.order);
            } else {
                throw new Error(result.error || 'Không thể tạo đơn hàng');
            }
            
        } catch (error) {
            console.error('Checkout error:', error);
            showToast(`Lỗi: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
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
        
        // Event delegation for preset weight "Chọn lại" button
        const babyWeightGroup = document.getElementById('babyWeightGroup');
        if (babyWeightGroup) {
            babyWeightGroup.addEventListener('click', (e) => {
                // Check if clicked element is preset weight change button
                if (e.target.closest('.preset-weight-change-btn')) {
                    this.resetPresetWeight();
                }
            });
        }
        
        // Baby weight select - handle custom weight option
        const weightPresetButtons = document.querySelectorAll('.weight-preset-btn');
        const babyWeightInput = document.getElementById('checkoutBabyWeight');
        const customWeightGroup = document.getElementById('customWeightGroup');
        const customWeightInput = document.getElementById('customWeightInput');
        
        if (weightPresetButtons.length > 0 && babyWeightInput) {
            weightPresetButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const weight = btn.dataset.weight;
                    
                    // Remove selected class from all buttons
                    weightPresetButtons.forEach(b => b.classList.remove('selected'));
                    
                    // Add selected class to clicked button
                    btn.classList.add('selected');
                    
                    if (weight === 'custom') {
                        // Show custom input
                        customWeightGroup.classList.remove('hidden');
                        customWeightInput.setAttribute('required', 'required');
                        customWeightInput.focus();
                        babyWeightInput.value = 'custom';
                    } else {
                        // Hide custom input
                        customWeightGroup.classList.add('hidden');
                        customWeightInput.removeAttribute('required');
                        customWeightInput.value = '';
                        this.hideWeightSurchargeNotice();
                        
                        // Set hidden input value
                        babyWeightInput.value = weight;
                        
                        // Accept preset weight (hide buttons and show confirmation)
                        this.acceptPresetWeight(weight, btn.textContent.trim());
                        
                        // Update order details
                        this.updateOrderDetailsWithWeight();
                    }
                });
            });
            
            // Handle custom weight input change
            if (customWeightInput) {
                const confirmBtn = document.getElementById('customWeightConfirmBtn');
                const changeBtn = document.getElementById('customWeightChangeBtn');
                
                // Enable/disable confirm button based on input
                customWeightInput.addEventListener('input', (e) => {
                    const weight = parseFloat(e.target.value);
                    if (confirmBtn) {
                        confirmBtn.disabled = !weight || weight < 3 || weight > 50;
                    }
                });
                
                // Handle confirm button click
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        const weight = parseFloat(customWeightInput.value);
                        
                        if (!weight || weight < 3 || weight > 50) {
                            showToast('Vui lòng nhập cân nặng từ 3kg đến 50kg', 'error');
                            return;
                        }
                        
                        // If weight > 15kg, show confirmation dialog
                        if (weight > 15) {
                            this.showWeightSurchargeConfirmation(weight);
                        } else {
                            // Accept weight without surcharge (no modal needed)
                            this.acceptCustomWeight(weight);
                        }
                    });
                }
                
                // Handle "Chọn lại" button click
                if (changeBtn) {
                    changeBtn.addEventListener('click', () => {
                        this.resetCustomWeight();
                    });
                }
            }
        }
        
        // Discount input and button
        const discountInput = document.getElementById('discountCodeInput');
        const discountActionBtn = document.getElementById('discountActionBtn');
        const viewCodesBtn = document.getElementById('viewCodesBtn');
        
        if (discountInput) {
            // Enter key to apply
            discountInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applyDiscountManually();
                }
            });
            
            // Auto uppercase
            discountInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
        
        if (discountActionBtn) {
            discountActionBtn.addEventListener('click', () => {
                if (this.appliedDiscount) {
                    // If has discount, button acts as "change code" - remove current
                    this.removeDiscount();
                } else {
                    // Try to apply from input
                    this.applyDiscountManually();
                }
            });
        }
        
        if (viewCodesBtn) {
            viewCodesBtn.addEventListener('click', () => this.openDiscountModal());
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



