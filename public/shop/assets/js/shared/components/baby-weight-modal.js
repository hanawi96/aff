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
        
        // Price surcharge for weight > 15kg: 15% of product price (rounded down to nearest 1000)
        this.BABY_WEIGHT_THRESHOLD = 15;        // Surcharge applies above 15kg
        this.BABY_SURCHARGE_PERCENT = 0.15;     // 15% of product price
        
        // Price surcharge for adult bracelets (weight > 65kg)
        this.ADULT_WEIGHT_THRESHOLD = 65;       // Surcharge applies above 65kg (15% of price)
        this.ADULT_SURCHARGE_PERCENT = 0.15;    // 15% of product price
        
        // Category IDs that DON'T need baby weight selection
        // These are stable and won't break if category names change
        // 
        // ONLY 3 CATEGORIES SKIP WEIGHT SELECTION:
        // 1. Bi, charm bạc - Phụ kiện riêng lẻ
        // 2. Hạt dâu tằm mài sẵn - Nguyên liệu thô
        // 3. Sản phẩm bán kèm - Phụ kiện đi kèm
        this.skipCategoryIds = [
            24,  // Bi, charm bạc
            14,  // Hạt dâu tằm mài sẵn
            23,  // Sản phẩm bán kèm
        ];
        
        // Adult bracelet category (needs weight selection but different options)
        this.adultBraceletCategoryId = 22; // Vòng người lớn
        
        // Fallback: Category names (less reliable, but works if IDs not set)
        // This will be used if skipCategoryIds is empty
        this.skipCategoryNames = [
            'bi, charm bạc',
            'hạt dâu tằm mài sẵn',
            'sản phẩm bán kèm'
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
        
        // Method 1: Check by category ID (preferred, more stable)
        if (this.skipCategoryIds.length > 0) {
            const hasSkipCategoryById = product.categories.some(cat => {
                const catId = cat.id || cat.category_id;
                const catName = cat.name || cat.category_name || '';
                
                console.log('   Checking category by ID:', catName, '(ID:', catId, ')');
                
                const shouldSkip = this.skipCategoryIds.includes(catId);
                
                if (shouldSkip) {
                    console.log('   ❌ Found skip category by ID:', catId, '(', catName, ')');
                }
                
                return shouldSkip;
            });
            
            if (hasSkipCategoryById) {
                console.log('   Final decision (by ID) - needs baby weight: false');
                return false;
            }
        }
        
        // Method 2: Fallback to category name matching (if IDs not configured)
        const normalize = (str) => {
            return str
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                .replace(/[,\s]+/g, ' ') // Replace commas and multiple spaces with single space
                .trim();
        };
        
        const hasSkipCategoryByName = product.categories.some(cat => {
            const catName = cat.name || cat.category_name || '';
            const normalizedCatName = normalize(catName);
            
            console.log('   Checking category by name:', catName, '→ normalized:', normalizedCatName);
            
            const shouldSkip = this.skipCategoryNames.some(skip => {
                const normalizedSkip = normalize(skip);
                const matches = normalizedCatName.includes(normalizedSkip) || normalizedSkip.includes(normalizedCatName);
                if (matches) {
                    console.log('   ❌ Matched skip category by name:', skip);
                }
                return matches;
            });
            
            return shouldSkip;
        });
        
        const needs = !hasSkipCategoryByName;
        console.log('   Final decision (by name) - needs baby weight:', needs);
        return needs;
    }
    
    /**
     * Check if product is adult bracelet
     */
    isAdultBracelet(product) {
        if (!product || !product.categories || product.categories.length === 0) return false;
        
        return product.categories.some(cat => {
            const catId = cat.id || cat.category_id;
            return catId === this.adultBraceletCategoryId;
        });
    }
    
    /**
     * Open modal
     */
    open(product, callback) {
        console.log('🚀 BabyWeightModal: Opening modal for product:', product.name);
        
        this.currentProduct = product;
        this.selectedWeight = null;
        this.callback = callback;
        
        const isAdult = this.isAdultBracelet(product);
        
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
        
        // Update modal title and labels based on product type
        const modalTitle = document.querySelector('#babyWeightModal .baby-weight-modal-title');
        const customLabel = document.querySelector('#babyWeightModal .custom-weight-label');
        
        if (isAdult) {
            if (modalTitle) modalTitle.textContent = 'Chọn cân nặng người lớn';
            if (customLabel) customLabel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg> Hoặc nhập cân nặng khác (35-120kg):';
        } else {
            if (modalTitle) modalTitle.textContent = 'Chọn cân nặng bé';
            if (customLabel) customLabel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg> Hoặc nhập cân nặng khác (16-50kg):';
        }
        
        // Render weight options based on product type
        this.renderWeightOptions(isAdult);
        
        // Reset selections
        document.querySelectorAll('.weight-btn').forEach(btn => btn.classList.remove('selected'));
        const customInput = document.getElementById('customWeightInput');
        if (customInput) {
            customInput.value = '';
            customInput.placeholder = isAdult ? 'VD: 60' : 'VD: 18';
        }
        
        const confirmBtn = document.getElementById('confirmWeightBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        
        // Show modal
        const modal = document.getElementById('babyWeightModal');
        if (!modal) {
            console.error('❌ BabyWeightModal: Modal element not found! #babyWeightModal');
            return;
        }
        
        modal.classList.remove('hidden');
        console.log('✅ BabyWeightModal: Modal opened successfully');
    }
    
    /**
     * Render weight options based on product type
     */
    renderWeightOptions(isAdult) {
        const container = document.getElementById('babyWeightOptions');
        if (!container) return;
        
        let weights = [];
        if (isAdult) {
            // Adult weights: 35-70kg (8 presets evenly distributed)
            weights = [35, 40, 45, 50, 55, 60, 65, 70];
        } else {
            // Baby weights: "Chưa sinh" + 3-15kg
            weights = ['unborn', 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        }
        
        container.innerHTML = weights.map(w => {
            if (w === 'unborn') {
                return `<button type="button" class="weight-btn" data-weight="unborn">Chưa sinh</button>`;
            }
            return `<button type="button" class="weight-btn" data-weight="${w}kg">${w}kg</button>`;
        }).join('');
        
        // Re-attach event listeners
        container.querySelectorAll('.weight-btn').forEach(btn => {
            btn.onclick = () => this.selectWeight(btn.dataset.weight);
        });
    }
    
    /**
     * Close modal
     */
    close() {
        document.getElementById('babyWeightModal').classList.add('hidden');
        this.hideSurchargeInfo();
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
        
        // Extract weight number and check for surcharge
        const weightMatch = weight.match(/(\d+)/);
        const weightKg = weightMatch ? parseInt(weightMatch[1]) : 0;
        const isAdult = this.isAdultBracelet(this.currentProduct);
        
        // Show surcharge info if applicable
        if (isAdult && weightKg > this.ADULT_WEIGHT_THRESHOLD) {
            this.showSurchargeInfo(weightKg);
        } else if (!isAdult && weightKg > 15) {
            this.showSurchargeInfo(weightKg);
        } else {
            this.hideSurchargeInfo();
        }
        
        // Enable confirm button
        document.getElementById('confirmWeightBtn').disabled = false;
    }
    
    /**
     * Check if product is in "Vòng trơn" category or has "trơn" in name
     */
    isVongTronCategory(product) {
        // Check by category IDs first
        if (product.categories && product.categories.length > 0) {
            const hasTronCategory = product.categories.some(cat => {
                const catId = cat.id || cat.category_id;
                return this.VONG_TRON_CATEGORY_IDS.includes(catId);
            });
            
            if (hasTronCategory) return true;
        }
        
        // Fallback: Check by product name (for adult bracelets)
        const productName = (product.name || '').toLowerCase();
        
        // Must have "trơn" or "tron" in name
        const hasTron = productName.includes('trơn') || productName.includes('tron');
        
        // If has "trơn", it's a simple bracelet (15k surcharge)
        if (hasTron) return true;
        
        // If has "co giãn" but also has "mix", it's NOT a simple bracelet (30k surcharge)
        const hasCoGian = productName.includes('co giãn') || productName.includes('cơ giãn');
        const hasMix = productName.includes('mix');
        
        if (hasCoGian && !hasMix) return true;
        
        return false;
    }
    
    /**
     * Calculate surcharge based on weight and category
     */
    calculateSurcharge(weightKg) {
        // Adult bracelets: 15% surcharge if > 65kg
        if (this.isAdultBracelet(this.currentProduct)) {
            if (weightKg <= this.ADULT_WEIGHT_THRESHOLD) {
                return 0;
            }
            
            // Calculate 15% of product price and round down to nearest 1000
            const basePrice = this.currentProduct.price || 0;
            const surcharge = basePrice * this.ADULT_SURCHARGE_PERCENT;
            return Math.floor(surcharge / 1000) * 1000;
        }
        
        // Baby products: 15% surcharge if > 15kg
        if (weightKg <= this.BABY_WEIGHT_THRESHOLD) {
            return 0;
        }
        
        // Calculate 15% of product price and round down to nearest 1000
        const basePrice = this.currentProduct.price || 0;
        const surcharge = basePrice * this.BABY_SURCHARGE_PERCENT;
        return Math.floor(surcharge / 1000) * 1000;
    }
    
    /**
     * Show surcharge info
     */
    showSurchargeInfo(weightKg) {
        const surchargeDiv = document.getElementById('babyWeightSurcharge');
        if (!surchargeDiv || !this.currentProduct) return;
        
        const surcharge = this.calculateSurcharge(weightKg);
        
        if (surcharge > 0) {
            const originalPrice = this.currentProduct.price;
            const totalPrice = originalPrice + surcharge;
            
            const isAdult = this.isAdultBracelet(this.currentProduct);
            const thresholdText = isAdult ? '65kg' : '15kg';
            
            // Update surcharge title with reason
            const surchargeTitle = surchargeDiv.querySelector('.surcharge-title');
            if (surchargeTitle) {
                surchargeTitle.textContent = `Cân nặng trên ${thresholdText} - Cần thêm nhiều nguyên liệu`;
            }
            
            document.getElementById('surchargeOriginalPrice').textContent = this.formatPrice(originalPrice);
            document.getElementById('surchargeFee').textContent = '+' + this.formatPrice(surcharge);
            document.getElementById('surchargeTotalPrice').textContent = this.formatPrice(totalPrice);
            
            surchargeDiv.classList.remove('hidden');
        } else {
            this.hideSurchargeInfo();
        }
    }
    
    /**
     * Hide surcharge info
     */
    hideSurchargeInfo() {
        const surchargeDiv = document.getElementById('babyWeightSurcharge');
        if (surchargeDiv) {
            surchargeDiv.classList.add('hidden');
        }
    }
    
    /**
     * Handle custom weight input
     */
    handleCustomInput(value) {
        const weight = parseInt(value);
        const isAdult = this.isAdultBracelet(this.currentProduct);
        
        // Validate based on product type
        const minWeight = isAdult ? 35 : 16;
        const maxWeight = isAdult ? 120 : 50;
        
        if (weight >= minWeight && weight <= maxWeight) {
            this.selectedWeight = weight + 'kg';
            
            // Clear quick selection
            document.querySelectorAll('.weight-btn').forEach(btn => btn.classList.remove('selected'));
            
            // Show surcharge info based on thresholds
            if (isAdult && weight > this.ADULT_WEIGHT_THRESHOLD) {
                this.showSurchargeInfo(weight);
            } else if (!isAdult && weight > 15) {
                this.showSurchargeInfo(weight);
            } else {
                this.hideSurchargeInfo();
            }
            
            // Enable confirm button
            document.getElementById('confirmWeightBtn').disabled = false;
        } else {
            this.selectedWeight = null;
            this.hideSurchargeInfo();
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
        
        // Extract weight number from selectedWeight (e.g., "18kg" -> 18)
        const weightMatch = this.selectedWeight.match(/(\d+)/);
        const weightKg = weightMatch ? parseInt(weightMatch[1]) : 0;
        
        // Calculate surcharge
        const surcharge = this.calculateSurcharge(weightKg);
        
        // Call callback with selected weight and surcharge
        if (this.callback) {
            this.callback(this.selectedWeight, surcharge);
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
