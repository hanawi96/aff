// ============================================
// BABY WEIGHT SELECTION MODAL
// ============================================

import { cartService } from '../services/cart.service.js';
import { showToast } from '../utils/helpers.js';

/**
 * Baby Weight Modal Component
 */
export class BabyWeightModal {
    constructor() {
        this.currentProduct = null;
        this.selectedWeight = null;
        this.callback = null;
        
        // Categories that DON'T need baby weight selection
        this.skipCategories = [
            'vòng người lớn',
            'bi charm bạc', 
            'sản phẩm bán kèm',
            'vong nguoi lon',
            'bi, charm bac',
            'người lớn',
            'nguoi lon'
        ];
        
        this.init();
    }
    
    /**
     * Initialize modal
     */
    init() {
        console.log('🔧 BabyWeightModal: Initializing...');
        this.setupEventListeners();
        console.log('✅ BabyWeightModal: Initialized successfully');
    }
    
    /**
     * Check if product needs baby weight selection
     */
    needsBabyWeight(product) {
        console.log('🔍 BabyWeightModal: Checking needsBabyWeight for product:', product.name);
        console.log('   Product categories:', product.categories);
        
        // If no categories, assume it needs baby weight
        if (!product.categories || product.categories.length === 0) {
            console.log('   ✅ No categories found, needs baby weight');
            return true;
        }
        
        // Check if any category matches skip list
        const hasSkipCategory = product.categories.some(cat => {
            const catName = (cat.name || cat.category_name || '').toLowerCase();
            console.log('   Checking category:', catName);
            
            const shouldSkip = this.skipCategories.some(skip => 
                catName.includes(skip.toLowerCase())
            );
            
            if (shouldSkip) {
                console.log('   ❌ Found skip category:', catName);
            }
            
            return shouldSkip;
        });
        
        const needs = !hasSkipCategory;
        console.log('   Final decision - needs baby weight:', needs);
        return needs;
    }
    
    /**
     * Open modal
     */
    open(product, callback) {
        console.log('🚀 BabyWeightModal: Opening modal for product:', product.name);
        
        this.currentProduct = product;
        this.selectedWeight = null;
        this.callback = callback;
        
        // Render product info
        const productHtml = `
            <img src="${product.image_url || product.image || '/assets/images/product_img/tat-ca-mau.webp'}" 
                 alt="${product.name}" 
                 class="baby-weight-product-image">
            <div class="baby-weight-product-info">
                <div class="baby-weight-product-name">${product.name}</div>
                <div class="baby-weight-product-price">${this.formatPrice(product.price)}</div>
            </div>
        `;
        
        const productContainer = document.getElementById('babyWeightProduct');
        if (!productContainer) {
            console.error('❌ BabyWeightModal: Product container not found! #babyWeightProduct');
            return;
        }
        
        productContainer.innerHTML = productHtml;
        
        // Reset selections
        document.querySelectorAll('.weight-btn').forEach(btn => btn.classList.remove('selected'));
        const customInput = document.getElementById('customWeightInput');
        if (customInput) customInput.value = '';
        
        const confirmBtn = document.getElementById('confirmWeightBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        
        // Show modal
        const modal = document.getElementById('babyWeightModal');
        if (!modal) {
            console.error('❌ BabyWeightModal: Modal element not found! #babyWeightModal');
            return;
        }
        
        console.log('📊 Modal element:', modal);
        console.log('   Current classes:', modal.className);
        console.log('   Current display:', window.getComputedStyle(modal).display);
        console.log('   Current z-index:', window.getComputedStyle(modal).zIndex);
        console.log('   Current position:', window.getComputedStyle(modal).position);
        
        modal.classList.remove('hidden');
        
        // Check after removing hidden
        setTimeout(() => {
            console.log('📊 After removing hidden:');
            console.log('   Classes:', modal.className);
            console.log('   Display:', window.getComputedStyle(modal).display);
            console.log('   Visibility:', window.getComputedStyle(modal).visibility);
            console.log('   Opacity:', window.getComputedStyle(modal).opacity);
            console.log('   Z-index:', window.getComputedStyle(modal).zIndex);
        }, 100);
        
        console.log('✅ BabyWeightModal: Modal opened successfully');
    }
    
    /**
     * Close modal
     */
    close() {
        document.getElementById('babyWeightModal').classList.add('hidden');
        this.currentProduct = null;
        this.selectedWeight = null;
        this.callback = null;
    }
    
    /**
     * Select weight
     */
    selectWeight(weight) {
        this.selectedWeight = weight;
        
        // Update UI
        document.querySelectorAll('.weight-btn').forEach(btn => {
            if (btn.dataset.weight === weight) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        // Clear custom input
        document.getElementById('customWeightInput').value = '';
        
        // Enable confirm button
        document.getElementById('confirmWeightBtn').disabled = false;
    }
    
    /**
     * Handle custom weight input
     */
    handleCustomInput(value) {
        const weight = parseInt(value);
        
        if (weight >= 16 && weight <= 50) {
            this.selectedWeight = weight + 'kg';
            
            // Clear quick selection
            document.querySelectorAll('.weight-btn').forEach(btn => btn.classList.remove('selected'));
            
            // Enable confirm button
            document.getElementById('confirmWeightBtn').disabled = false;
        } else {
            this.selectedWeight = null;
            document.getElementById('confirmWeightBtn').disabled = true;
        }
    }
    
    /**
     * Confirm and add to cart
     */
    confirm() {
        if (!this.selectedWeight || !this.currentProduct) {
            return;
        }
        
        // Call callback with selected weight
        if (this.callback) {
            this.callback(this.selectedWeight);
        }
        
        // Close modal
        this.close();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('closeBabyWeightModal');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }
        
        // Cancel button
        const cancelBtn = document.getElementById('cancelWeightBtn');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.close();
        }
        
        // Confirm button
        const confirmBtn = document.getElementById('confirmWeightBtn');
        if (confirmBtn) {
            confirmBtn.onclick = () => this.confirm();
        }
        
        // Weight buttons
        document.querySelectorAll('.weight-btn').forEach(btn => {
            btn.onclick = () => this.selectWeight(btn.dataset.weight);
        });
        
        // Custom input
        const customInput = document.getElementById('customWeightInput');
        if (customInput) {
            customInput.oninput = (e) => this.handleCustomInput(e.target.value);
        }
        
        // Click outside to close
        const modal = document.getElementById('babyWeightModal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    this.close();
                }
            };
        }
    }
    
    /**
     * Format price
     */
    formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    }
}
