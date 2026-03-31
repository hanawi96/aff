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

    getModalElement() {
        return document.getElementById('babyWeightModal');
    }

    getCustomWeightInputElement() {
        const modal = this.getModalElement();
        return modal ? modal.querySelector('#customWeightInput') : null;
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
            if (customLabel) customLabel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg> Hoặc nhập cân nặng khác (96kg trở lên):';
        } else {
            if (modalTitle) modalTitle.textContent = 'Chọn cân nặng bé';
            if (customLabel) customLabel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg> Hoặc nhập cân nặng khác (16kg trở lên):';
        }
        
        // Render weight options based on product type
        this.renderWeightOptions(isAdult);
        
        // Reset selections
        document.querySelectorAll('.weight-btn').forEach(btn => btn.classList.remove('selected'));
        const customInput = this.getCustomWeightInputElement();
        const customSection = document.getElementById('babyWeightCustomSection');
        if (customInput) {
            customInput.value = '';
            customInput.placeholder = isAdult ? 'VD: 100' : 'VD: 18';
            customInput.min = isAdult ? '96' : '16';
            customInput.max = '120';
        }
        if (customSection) {
            customSection.classList.add('hidden');
        }
        
        const confirmBtn = document.getElementById('confirmWeightBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        
        // Show modal
        const modal = this.getModalElement();
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
            // Adult weights: ranges + custom
            weights = [
                { label: '35-45kg', value: '35-45kg' },
                { label: '45-55kg', value: '45-55kg' },
                { label: '55-65kg', value: '55-65kg' },
                { label: '65-75kg', value: '65-75kg' },
                { label: '75-85kg', value: '75-85kg' },
                { label: '85-95kg', value: '85-95kg' }
            ];
        } else {
            // Baby weights: "Chưa sinh" + ranges + custom
            weights = [
                { label: '❤️ Chưa sinh', value: 'unborn', icon: true },
                { label: '3-4kg', value: '3-4kg' },
                { label: '4-6kg', value: '4-6kg' },
                { label: '6-8kg', value: '6-8kg' },
                { label: '8-10kg', value: '8-10kg' },
                { label: '10-12kg', value: '10-12kg' },
                { label: '12-15kg', value: '12-15kg' }
            ];
        }
        
        container.innerHTML = weights.map(w => {
            const iconClass = w.icon ? ' weight-btn-icon' : '';
            return `<button type="button" class="weight-btn${iconClass}" data-weight="${w.value}">${w.label}</button>`;
        }).join('') + `<button type="button" class="weight-btn weight-btn-custom" data-custom="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.25rem; height: 1.25rem;">
                <path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
            Nhập khác
        </button>`;
        
        // Re-attach event listeners
        container.querySelectorAll('.weight-btn').forEach(btn => {
            if (btn.dataset.custom) {
                btn.onclick = () => this.focusCustomInput();
            } else {
                btn.onclick = () => this.selectWeight(btn.dataset.weight);
            }
        });
    }
    
    /**
     * Focus on custom input
     */
    focusCustomInput() {
        const customInput = this.getCustomWeightInputElement();
        const customSection = document.getElementById('babyWeightCustomSection');
        const customButton = document.querySelector('#babyWeightOptions .weight-btn[data-custom="true"]');
        
        if (customSection) {
            customSection.classList.remove('hidden');
        }
        
        document.querySelectorAll('#babyWeightOptions .weight-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        if (customButton) {
            customButton.classList.add('selected');
        }
        
        if (customInput) {
            customInput.focus();
            customInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    /**
     * Close modal
     */
    close() {
        const modal = this.getModalElement();
        if (modal) {
            modal.classList.add('hidden');
        }
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
        const customSection = document.getElementById('babyWeightCustomSection');
        
        // Update UI
        document.querySelectorAll('.weight-btn').forEach(btn => {
            if (btn.dataset.weight === weight) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        // Clear custom input
        const customInput = this.getCustomWeightInputElement();
        if (customInput) {
            customInput.value = '';
        }
        if (customSection) {
            customSection.classList.add('hidden');
        }
        
        // Extract weight number for surcharge calculation
        // Handle both single weights (e.g., "18kg") and ranges (e.g., "6-8kg")
        let weightKg = 0;
        
        if (weight === 'unborn') {
            weightKg = 0; // No surcharge for unborn
        } else if (weight.includes('-')) {
            // Range: use the upper bound for surcharge calculation
            const match = weight.match(/(\d+)-(\d+)kg/);
            if (match) {
                weightKg = parseInt(match[2]); // Upper bound
            }
        } else {
            // Single weight
            const match = weight.match(/(\d+)/);
            if (match) {
                weightKg = parseInt(match[1]);
            }
        }
        
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
        const weight = parseFloat(value);
        const isAdult = this.isAdultBracelet(this.currentProduct);
        
        // Validate based on product type
        const minWeight = isAdult ? 96 : 16; // Adult: 96kg+, Baby: 16kg+
        const maxWeight = 120; // Max for both
        
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
    async confirm() {
        if (!this.selectedWeight || !this.currentProduct) {
            return;
        }
        
        // Extract weight number from selectedWeight for surcharge calculation
        let weightKg = 0;
        
        if (this.selectedWeight === 'unborn') {
            weightKg = 0;
        } else if (this.selectedWeight.includes('-')) {
            // Range: use upper bound
            const match = this.selectedWeight.match(/(\d+)-(\d+)kg/);
            if (match) {
                weightKg = parseInt(match[2]);
            }
        } else {
            // Single weight
            const match = this.selectedWeight.match(/(\d+)/);
            if (match) {
                weightKg = parseInt(match[1]);
            }
        }
        
        // Calculate surcharge
        const surcharge = this.calculateSurcharge(weightKg);
        const isAdult = this.isAdultBracelet(this.currentProduct);
        const needsSurchargeConfirm = isAdult
            ? weightKg > this.ADULT_WEIGHT_THRESHOLD
            : weightKg > this.BABY_WEIGHT_THRESHOLD;

        // Keep add-to-cart flow consistent with "Mua ngay":
        // show confirmation dialog before applying surcharge.
        if (needsSurchargeConfirm && surcharge > 0) {
            const confirmed = await this.showWeightSurchargeConfirmation(weightKg, surcharge, isAdult);
            if (!confirmed) {
                return;
            }
        }
        
        // Call callback with selected weight and surcharge
        if (this.callback) {
            this.callback(this.selectedWeight, surcharge);
        }
        
        // Close modal
        this.close();
    }

    showWeightSurchargeConfirmation(weightKg, surcharge, isAdult) {
        const threshold = isAdult ? this.ADULT_WEIGHT_THRESHOLD : this.BABY_WEIGHT_THRESHOLD;
        const surchargePercent = isAdult ? this.ADULT_SURCHARGE_PERCENT : this.BABY_SURCHARGE_PERCENT;
        const surchargeFormatted = this.formatPrice(surcharge);
        const newTotalFormatted = this.formatPrice((this.currentProduct?.price || 0) + surcharge);
        const originalFormatted = this.formatPrice(this.currentProduct?.price || 0);

        return new Promise((resolve) => {
            // Avoid stacking multiple confirmation modals
            const existing = document.getElementById('babyWeightSurchargeConfirmOverlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'babyWeightSurchargeConfirmOverlay';
            overlay.className = 'modal-overlay';
            overlay.style.zIndex = '11000'; // Make sure it's above everything
            overlay.style.padding = '1rem';

            const modal = document.createElement('div');
            modal.className = 'modal-content baby-surcharge-confirm-modal';
            modal.style.maxWidth = '440px';
            modal.innerHTML = `
                <div class="baby-surcharge-confirm-header">
                    <div class="baby-surcharge-confirm-header-left">
                        <div class="baby-surcharge-confirm-icon" aria-hidden="true">
                            ⚠️
                        </div>
                        <div>
                            <div class="baby-surcharge-confirm-title">Xác nhận phụ phí</div>
                            <div class="baby-surcharge-confirm-subtitle">
                                Cân nặng <strong>${weightKg}kg</strong> vượt quá ${threshold}kg
                            </div>
                        </div>
                    </div>

                    <button type="button" aria-label="Đóng" id="babyWeightSurchargeConfirmCloseBtn" class="baby-surcharge-confirm-close-btn">
                        ×
                    </button>
                </div>

                <div class="baby-surcharge-confirm-body">
                    <div class="baby-surcharge-confirm-price-card">
                        <div class="baby-surcharge-confirm-row">
                            <span class="baby-surcharge-confirm-label">Giá gốc</span>
                            <strong class="baby-surcharge-confirm-value">${originalFormatted}</strong>
                        </div>

                        <div class="baby-surcharge-confirm-row baby-surcharge-confirm-row-warning">
                            <span>Phụ phí (+${Math.round(surchargePercent * 100)}%)</span>
                            <strong class="baby-surcharge-confirm-value baby-surcharge-confirm-fee">+${surchargeFormatted}</strong>
                        </div>

                        <div class="baby-surcharge-confirm-row baby-surcharge-confirm-row-total">
                            <span class="baby-surcharge-confirm-label">Giá mới</span>
                            <strong class="baby-surcharge-confirm-value baby-surcharge-confirm-total">${newTotalFormatted}</strong>
                        </div>
                    </div>

                    <div class="baby-surcharge-confirm-question">
                        Bạn có đồng ý với mức giá này không?
                    </div>

                    <div class="baby-surcharge-confirm-note">
                        <b>Lưu ý:</b> Giá bán gốc là dành cho các bé dưới 15kg, khi trên 15kg em sẽ phải sử dụng nhiều nguyên liệu như bạc, hổ phách, hạt dâu,...hơn để làm, vì vậy giá sẽ cao hơn 15% ạ
                    </div>

                    <div class="baby-surcharge-confirm-actions">
                        <button type="button" id="babyWeightSurchargeConfirmCancelBtn" class="baby-surcharge-confirm-btn baby-surcharge-confirm-btn-secondary">
                            Hủy
                        </button>
                        <button type="button" id="babyWeightSurchargeConfirmOkBtn" class="baby-surcharge-confirm-btn baby-surcharge-confirm-btn-primary">
                            Đồng ý
                        </button>
                    </div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = () => {
                const el = document.getElementById('babyWeightSurchargeConfirmOverlay');
                if (el) el.remove();
            };

            const okBtn = document.getElementById('babyWeightSurchargeConfirmOkBtn');
            const cancelBtn = document.getElementById('babyWeightSurchargeConfirmCancelBtn');
            const closeBtn = document.getElementById('babyWeightSurchargeConfirmCloseBtn');

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            const onOk = () => {
                cleanup();
                resolve(true);
            };

            if (okBtn) okBtn.onclick = onOk;
            if (cancelBtn) cancelBtn.onclick = onCancel;
            if (closeBtn) closeBtn.onclick = onCancel;

            // Không đóng khi bấm ra ngoài overlay — chỉ nút × / Hủy / Đồng ý
        });
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
            confirmBtn.onclick = async () => this.confirm();
        }
        
        // Weight buttons
        document.querySelectorAll('.weight-btn').forEach(btn => {
            btn.onclick = () => this.selectWeight(btn.dataset.weight);
        });
        
        // Custom input
        const customInput = this.getCustomWeightInputElement();
        if (customInput) {
            customInput.oninput = (e) => this.handleCustomInput(e.target.value);
        }
        
        // Không đóng khi bấm ra ngoài (backdrop) — đóng bằng nút X / Hủy
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
