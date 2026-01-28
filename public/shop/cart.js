// ============================================
// CART PAGE - OPTIMIZED & PERFORMANT
// ============================================

// Import discount service
import { discountService } from './assets/js/shared/services/discount.service.js';
// Import success modal
import { successModal } from './assets/js/shared/components/success-modal.js';
// Import bundle products service
import { bundleProductsService } from './assets/js/shared/services/bundle-products.service.js';
// Import form validator
import { FormValidator } from './assets/js/shared/utils/form-validator.js';
import { checkoutValidationRules } from './assets/js/shared/constants/validation-rules.js';
// Import error display service for address errors
import { errorDisplayService } from './assets/js/shared/services/error-display.service.js';

// Configuration
const CONFIG = {
    FREE_SHIPPING_THRESHOLD: 500000,
    SHIPPING_FEE: 30000,
    STORAGE_KEY: 'cart',
    DISCOUNT_KEY: 'discount',
    DEBOUNCE_DELAY: 300,
    // Backend API URL - use port 8787 if running on Live Server
    API_BASE_URL: window.location.port === '5500' ? 'http://localhost:8787' : '',
    // Animation timing constants
    FADE_IN_BASE_DELAY: 50,      // Base delay for first section
    FADE_IN_STAGGER: 30,          // Delay between each section
    ADDRESS_INIT_DELAY: 100       // Wait time for address selector init
};

// State Management
const state = {
    cart: [],
    discount: null,
    subtotal: 0,
    total: 0,
    shippingFee: CONFIG.SHIPPING_FEE,
    availableDiscounts: [], // Store available discounts from API
    orderNote: '', // Store order note
    bundleProducts: [], // Will be loaded from API
    paymentMethod: 'cod', // Default payment method
    openNoteInputs: new Set(), // Track which note inputs are open
    validator: null // Form validator instance
};

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
    init: async () => {
        state.cart = storage.loadCart();
        state.discount = storage.loadDiscount();
        
        // Load available discounts in background (non-blocking)
        cart.loadAvailableDiscounts();
        
        // Wait for bundle products to load
        await cart.loadBundleProducts();
        console.log('✅ Bundle products loaded:', state.bundleProducts.length);
        
        // Hide skeleton
        await cart.hideSkeleton();
        
        if (state.cart.length === 0) {
            cart.showEmpty();
        } else {
            // Ensure summary is visible before rendering
            const summarySection = document.querySelector('.cart-summary-section');
            summarySection?.classList.remove('hidden');
            
            cart.render();
            cart.updateSummary();
            cart.loadRecommended();
        }

        cart.setupEventListeners();
        
        // Initialize form validator (ALWAYS, even if cart is empty)
        // User might add items later
        cart.initializeValidator();
        
        // Fill demo data for testing
        cart.fillDemoData();
        
        // If there's a saved discount, show it in the input
        if (state.discount) {
            const input = document.getElementById('discountCode');
            const applyBtn = document.getElementById('applyDiscountBtn');
            
            if (input) {
                input.value = state.discount.code;
                input.disabled = true;
            }
            
            if (applyBtn) {
                applyBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Đổi mã';
                applyBtn.onclick = discount.changeCode;
                applyBtn.classList.add('btn-change-code');
            }
            
            // Show discount result
            const discountText = discountService.formatDiscountText(state.discount);
            discount.showResult(`✓ Đã áp dụng mã ${state.discount.code} - ${discountText}`, 'success');
        }
    },
    
    // Initialize form validator
    initializeValidator: () => {
        console.log('🔧 [CART] Initializing form validator...');
        
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            // Check if elements exist
            const phoneInput = document.getElementById('cartPhone');
            const nameInput = document.getElementById('cartName');
            
            console.log('🔍 [CART] Phone input:', phoneInput);
            console.log('🔍 [CART] Name input:', nameInput);
            
            if (!phoneInput || !nameInput) {
                console.error('❌ [CART] Form inputs not found! Retrying...');
                // Retry after 500ms
                setTimeout(() => cart.initializeValidator(), 500);
                return;
            }
            
            state.validator = new FormValidator({
                formId: 'customerInfoSection', // Use section as form container
                rules: {
                    cartPhone: checkoutValidationRules.phone,
                    cartName: checkoutValidationRules.name,
                    // Address fields validated separately by AddressSelector
                },
                isModal: false,
                scrollOffset: 100, // Page has sticky header
                autoClear: true
            });
            
            console.log('✅ [CART] Form validator initialized:', state.validator);
            
            // Setup auto-clear for address fields
            cart.setupAddressAutoClear();
        }, 100);
    },
    
    // Setup auto-clear for address fields
    setupAddressAutoClear: () => {
        // Wait for address selector to be ready
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
            
            console.log('✅ [CART] Address auto-clear setup complete');
        }, 500);
    },

    // Load available discounts from API
    loadAvailableDiscounts: async () => {
        try {
            const allDiscounts = await discountService.getActiveDiscounts();
            state.availableDiscounts = allDiscounts.filter(d => d.active && d.visible);
        } catch (error) {
            console.error('Error loading discounts:', error);
            state.availableDiscounts = [];
        }
    },

    // Fill demo data for testing
    fillDemoData: async () => {
        // Helper to wait for element
        const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        await waitFor(500);
        
        // Fill basic info
        const phoneInput = document.getElementById('cartPhone');
        const nameInput = document.getElementById('cartName');
        
        if (phoneInput && !phoneInput.value) phoneInput.value = '0987654321';
        if (nameInput && !nameInput.value) nameInput.value = 'Nguyễn Văn A';
        
        // Fill address if selector is ready
        if (!window.cartAddressSelector) return;
        
        await waitFor(1000);
        
        const provinceSelect = document.getElementById('cartProvince');
        if (provinceSelect && !provinceSelect.value) {
            provinceSelect.value = '01';
            provinceSelect.dispatchEvent(new Event('change'));
            
            await waitFor(500);
            
            const districtSelect = document.getElementById('cartDistrict');
            if (districtSelect && districtSelect.options.length > 1) {
                districtSelect.selectedIndex = 1;
                districtSelect.dispatchEvent(new Event('change'));
                
                await waitFor(500);
                
                const wardSelect = document.getElementById('cartWard');
                if (wardSelect && wardSelect.options.length > 1) {
                    wardSelect.selectedIndex = 1;
                }
                
                const streetInput = document.getElementById('cartStreet');
                if (streetInput && !streetInput.value) {
                    streetInput.value = 'Số 123, Ngõ 456';
                }
            }
        }
    },

    // Load bundle products - Using shared service
    loadBundleProducts: async () => {
        try {
            state.bundleProducts = await bundleProductsService.loadBundleProducts();
            console.log('✅ Bundle products loaded:', state.bundleProducts.length);
        } catch (error) {
            console.error('Error loading bundle products:', error);
            state.bundleProducts = [];
        }
    },

    // Hide skeleton and show content with smooth transition
    hideSkeleton: () => {
        const skeleton = document.getElementById('cartSkeleton');
        const skeletonSummary = document.getElementById('cartSummarySkeleton');
        
        // Fade out skeleton with reduced delay (150ms for better performance)
        const fadeOutPromises = [];
        
        if (skeleton) {
            const promise = new Promise(resolve => {
                skeleton.style.opacity = '0';
                skeleton.style.transition = 'opacity 0.15s ease';
                setTimeout(() => {
                    skeleton.classList.add('hidden');
                    resolve();
                }, 150);
            });
            fadeOutPromises.push(promise);
        }
        
        if (skeletonSummary) {
            const promise = new Promise(resolve => {
                skeletonSummary.style.opacity = '0';
                skeletonSummary.style.transition = 'opacity 0.15s ease';
                setTimeout(() => {
                    skeletonSummary.classList.add('hidden');
                    resolve();
                }, 150);
            });
            fadeOutPromises.push(promise);
        }
        
        // Return promise that resolves when all skeletons are hidden
        return Promise.all(fadeOutPromises);
    },

    // Show empty cart
    showEmpty: () => {
        const emptyCart = document.getElementById('emptyCart');
        
        emptyCart.classList.remove('hidden');
        emptyCart.style.opacity = '0';
        
        // Fade in empty cart
        requestAnimationFrame(() => {
            emptyCart.style.transition = 'opacity 0.5s ease';
            emptyCart.style.opacity = '1';
        });
        
        document.getElementById('cartItems').classList.add('hidden');
        document.getElementById('discountSection').classList.add('hidden');
        document.getElementById('paymentSection').classList.add('hidden');
        document.getElementById('customerInfoSection').classList.add('hidden');
        document.getElementById('recommendedSection').classList.add('hidden');
        const summarySection = document.querySelector('.cart-summary-section');
        summarySection.classList.add('hidden');
    },

    // Update quantity - optimized with proper state sync
    updateQuantity: (productId, delta) => {
        const item = state.cart.find(i => i.id === productId);
        if (!item) return;

        // Calculate new quantity
        const newQuantity = Math.max(1, Math.min(item.quantity + delta, item.maxQuantity || 99));
        
        // No change needed
        if (newQuantity === item.quantity) return;
        
        item.quantity = newQuantity;
        storage.saveCart(state.cart);
        
        // Update DOM
        const cartItem = document.querySelector(`.cart-item[data-id="${productId}"]`);
        if (cartItem) {
            const qtyInput = cartItem.querySelector('.qty-input');
            const minusBtn = cartItem.querySelector('[data-action="decrease"]');
            const plusBtn = cartItem.querySelector('[data-action="increase"]');
            
            if (qtyInput) qtyInput.value = newQuantity;
            if (minusBtn) minusBtn.disabled = newQuantity <= 1;
            if (plusBtn) plusBtn.disabled = newQuantity >= (item.maxQuantity || 99);
        }
        
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
            const originalPriceHtml = item.originalPrice && item.originalPrice > item.price
                ? '<span class="item-original-price">' + utils.formatPrice(item.originalPrice) + '</span>'
                : '';
            
            // Calculate discount percentage
            const discountPercent = item.originalPrice && item.originalPrice > item.price
                ? Math.round((1 - item.price / item.originalPrice) * 100)
                : 0;
            
            const discountBadgeHtml = discountPercent > 0
                ? '<span class="item-discount-badge">-' + discountPercent + '%</span>'
                : '';
            
            // Note display
            let noteHtml = '';
            if (item.note) {
                noteHtml = '<div class="item-note-row">' +
                    '<div class="item-note-saved">' +
                    '<i class="fas fa-sticky-note"></i>' +
                    '<div class="item-note-text">' + utils.escapeHtml(item.note) + '</div>' +
                    '<div class="item-note-actions">' +
                    '<button class="btn-note-action btn-edit-note" onclick="cart.editItemNote(' + item.id + ')">' +
                    '<i class="fas fa-edit"></i> Sửa' +
                    '</button>' +
                    '</div>' +
                    '</div>' +
                    '<button class="delete-btn" onclick="cart.removeItem(' + item.id + ')">' +
                    '<i class="fas fa-trash"></i>' +
                    '</button>' +
                    '</div>';
            } else {
                noteHtml = '<div class="item-note-row">' +
                    '<div class="item-note-toggle" onclick="cart.toggleItemNote(' + item.id + ')">' +
                    '<i class="fas fa-plus-circle"></i>' +
                    '<span>Thêm lưu ý cho sản phẩm</span>' +
                    '</div>' +
                    '<button class="delete-btn" onclick="cart.removeItem(' + item.id + ')">' +
                    '<i class="fas fa-trash"></i>' +
                    '</button>' +
                    '</div>' +
                    '<div class="item-note-input hidden" id="noteInput' + item.id + '">' +
                    '<textarea class="item-note-textarea" ' +
                    'id="noteText' + item.id + '" ' +
                    'placeholder="Ví dụ: Làm size nhỏ hơn, thêm charm hình tim..." ' +
                    'maxlength="200"></textarea>' +
                    '<div class="item-note-actions">' +
                    '<button class="btn-note-action btn-save-item-note" onclick="cart.saveItemNote(' + item.id + ')">' +
                    '<i class="fas fa-check"></i> Lưu' +
                    '</button>' +
                    '<button class="btn-note-action btn-cancel-item-note" onclick="cart.cancelItemNote(' + item.id + ')">' +
                    '<i class="fas fa-times"></i> Hủy' +
                    '</button>' +
                    '</div>' +
                    '</div>';
            }
            
            // Baby weight badge display - now below image
            let babyWeightHtml = '';
            if (item.size) {
                babyWeightHtml = '<div class="item-baby-weight-badge">' +
                    '<span>Size: ' + utils.escapeHtml(item.size) + '</span>' +
                    '</div>';
            }
            
            // Weight surcharge notice (separate line)
            let weightSurchargeHtml = '';
            if (item.weightSurcharge && item.weightSurcharge > 0) {
                // Determine threshold based on weight in size
                const weightMatch = item.size ? item.size.match(/(\d+)/) : null;
                const weight = weightMatch ? parseInt(weightMatch[1]) : 0;
                const threshold = weight > 50 ? '65kg' : '15kg'; // If weight > 50, it's adult bracelet
                
                weightSurchargeHtml = '<div class="item-weight-surcharge-notice">' +
                    '<i class="fas fa-info-circle"></i>' +
                    '<span>Đã bao gồm phụ phí cân nặng trên ' + threshold + ': +' + utils.formatPrice(item.weightSurcharge) + '</span>' +
                    '</div>';
            }
            
            return '<div class="cart-item" data-id="' + item.id + '" data-item-id="' + item.id + '">' +
                '<div class="cart-item-main">' +
                '<div class="item-image-container">' +
                '<img src="' + (item.image || '/assets/images/product_img/tat-ca-mau.webp') + '" ' +
                'alt="' + utils.escapeHtml(item.name) + '" ' +
                'class="item-image" ' +
                'onclick="cart.viewProduct(' + item.id + ')">' +
                babyWeightHtml +
                '</div>' +
                '<div class="item-info">' +
                '<div class="item-name" onclick="cart.viewProduct(' + item.id + ')">' +
                utils.escapeHtml(item.name) +
                '</div>' +
                '<div class="item-price-quantity-row">' +
                '<div class="item-price-group">' +
                originalPriceHtml +
                '<span class="item-price">' + utils.formatPrice(item.price) + '</span>' +
                discountBadgeHtml +
                '</div>' +
                '<div class="quantity-selector">' +
                '<button class="qty-btn" ' +
                'data-action="decrease" ' +
                'data-product-id="' + item.id + '" ' +
                (item.quantity <= 1 ? 'disabled' : '') + '>' +
                '<i class="fas fa-minus"></i>' +
                '</button>' +
                '<input type="number" class="qty-input" ' +
                'value="' + item.quantity + '" ' +
                'min="1" ' +
                'max="' + (item.maxQuantity || 99) + '" ' +
                'data-product-id="' + item.id + '" ' +
                'onchange="cart.handleQuantityInput(' + item.id + ', this.value)">' +
                '<button class="qty-btn" ' +
                'data-action="increase" ' +
                'data-product-id="' + item.id + '" ' +
                (item.quantity >= (item.maxQuantity || 99) ? 'disabled' : '') + '>' +
                '<i class="fas fa-plus"></i>' +
                '</button>' +
                '</div>' +
                '</div>' +
                (weightSurchargeHtml ? weightSurchargeHtml : '') +
                '</div>' +
                '</div>' +
                noteHtml +
                '</div>';
        }).join('');

        container.innerHTML = html;
        
        // Remove hidden class but keep opacity 0 initially
        container.classList.remove('hidden');
        container.style.opacity = '0';
        
        // Show sections in priority order: customer info first (most important)
        const sectionsToShow = [
            'customerInfoSection',  // Hiện đầu tiên - quan trọng nhất
            'discountSection',
            'paymentSection',
            'orderNoteSection'
        ];
        
        // Prepare all sections (remove hidden but keep opacity 0)
        sectionsToShow.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.remove('hidden');
                section.style.opacity = '0';
            }
        });
        
        // Dispatch event for address selector initialization BEFORE fade-in
        window.dispatchEvent(new Event('cartInitialized'));
        
        // Show bundle offer section (prepare it too)
        cart.renderBundleOffer();
        
        // Small delay to let address selector initialize
        setTimeout(() => {
            // Fade in all content together
            requestAnimationFrame(() => {
                // Fade in cart items
                container.style.transition = 'opacity 0.5s ease';
                container.style.opacity = '1';
                
                // Fade in all sections with slight stagger (including bundle section)
                const allSections = [...sectionsToShow, 'bundleOfferSection'];
                allSections.forEach((sectionId, index) => {
                    const section = document.getElementById(sectionId);
                    if (section && !section.classList.contains('hidden')) {
                        section.style.transition = 'opacity 0.5s ease';
                        setTimeout(() => {
                            section.style.opacity = '1';
                        }, CONFIG.FADE_IN_BASE_DELAY + (index * CONFIG.FADE_IN_STAGGER));
                    }
                });
            });
        }, CONFIG.ADDRESS_INIT_DELAY); // Wait for address selector to initialize
        
        // Show cart summary section
        const summarySection = document.querySelector('.cart-summary-section');
        const cartSummary = document.querySelector('.cart-summary');
        
        summarySection.classList.remove('hidden');
        
        // Update cart count
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('cartCount').textContent = '(' + totalItems + ' sản phẩm)';
    },

    // Render bundle offer
    renderBundleOffer: () => {
        const section = document.getElementById('bundleOfferSection');
        const container = document.getElementById('bundleProducts');
        
        if (!section || !container) return;
        
        // Check if cart has non-bundle products
        const hasRegularProducts = state.cart.some(item => !item.isBundleProduct);
        
        if (!hasRegularProducts) {
            section.classList.add('hidden');
            return;
        }
        
        if (!state.bundleProducts || state.bundleProducts.length === 0) {
            section.classList.add('hidden');
            return;
        }
        
        // Render real products
        section.classList.remove('hidden');
        section.style.opacity = '0';
        
        const html = state.bundleProducts.map(product => {
            const isInCart = state.cart.some(item => item.id === product.id);
            
            // Calculate discount percent only if originalPrice exists and is greater than price
            const hasDiscount = product.originalPrice && product.originalPrice > product.price;
            const discountPercent = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
            
            return '<div class="bundle-product-card ' + (isInCart ? 'selected' : '') + '">' +
                '<img src="' + product.image + '" alt="' + utils.escapeHtml(product.name) + '" class="bundle-product-image">' +
                '<div class="bundle-product-info">' +
                '<div class="bundle-product-name">' + utils.escapeHtml(product.name) + '</div>' +
                '<div class="bundle-product-pricing">' +
                (hasDiscount ? '<div class="bundle-original-price">' + utils.formatPrice(product.originalPrice) + '</div>' : '') +
                '<div class="bundle-price">' + utils.formatPrice(product.price) + '</div>' +
                (hasDiscount ? '<div class="bundle-discount-badge">-' + discountPercent + '%</div>' : '') +
                '</div>' +
                '<button class="bundle-add-btn ' + (isInCart ? 'added' : '') + '" ' +
                'onclick="cart.toggleBundleProduct(' + product.id + ')">' +
                '<i class="fas fa-' + (isInCart ? 'check' : 'plus') + '-circle"></i>' +
                '<span>' + (isInCart ? 'Đã thêm' : 'Thêm ngay') + '</span>' +
                '</button>' +
                '</div>' +
                '</div>';
        }).join('');
        
        container.innerHTML = html;
    },

    // Toggle bundle product
    // Toggle bundle product
    toggleBundleProduct: (productId) => {
        const existingItem = state.cart.find(item => item.id === productId);
        
        if (existingItem) {
            // Remove from cart
            state.cart = state.cart.filter(item => item.id !== productId);
            utils.showToast('Đã xóa khỏi giỏ hàng', 'success');
        } else {
            // Add to cart directly (bundle products don't need baby weight)
            const bundleProduct = state.bundleProducts.find(p => p.id === productId);
            if (bundleProduct) {
                state.cart.push({
                    ...bundleProduct,
                    quantity: 1,
                    maxQuantity: 10
                });
                utils.showToast('Đã thêm vào giỏ hàng! 🎉', 'success');
            }
        }
        
        storage.saveCart(state.cart);
        cart.render();
        cart.updateSummary();
    },

    // Toggle item note input
    toggleItemNote: (productId) => {
        const noteInput = document.getElementById('noteInput' + productId);
        const toggle = noteInput.previousElementSibling;
        
        if (noteInput.classList.contains('hidden')) {
            noteInput.classList.remove('hidden');
            toggle.classList.add('active');
            document.getElementById('noteText' + productId).focus();
        } else {
            noteInput.classList.add('hidden');
            toggle.classList.remove('active');
        }
    },

    // Save item note
    saveItemNote: (productId) => {
        const noteText = document.getElementById('noteText' + productId).value.trim();
        
        if (!noteText) {
            utils.showToast('Vui lòng nhập lưu ý', 'error');
            return;
        }
        
        const item = state.cart.find(i => i.id === productId);
        if (item) {
            item.note = noteText;
            storage.saveCart(state.cart);
            cart.render();
            utils.showToast('Đã lưu lưu ý cho sản phẩm', 'success');
        }
    },

    // Cancel item note
    cancelItemNote: (productId) => {
        const noteInput = document.getElementById('noteInput' + productId);
        const toggle = noteInput.previousElementSibling;
        const noteText = document.getElementById('noteText' + productId);
        
        noteText.value = '';
        noteInput.classList.add('hidden');
        toggle.classList.remove('active');
    },

    // Edit item note
    editItemNote: (productId) => {
        const item = state.cart.find(i => i.id === productId);
        if (item && item.note) {
            // Không xóa note, chỉ render lại với textarea
            const oldNote = item.note;
            
            // Tìm container của item này
            const itemElement = document.querySelector(`[data-item-id="${productId}"]`);
            if (!itemElement) return;
            
            // Tìm phần note row
            const noteRow = itemElement.querySelector('.item-note-row');
            if (!noteRow) return;
            
            // Thay thế HTML để hiển thị textarea với note cũ
            noteRow.innerHTML = 
                '<div class="item-note-toggle active">' +
                '<i class="fas fa-edit"></i>' +
                '<span>Đang sửa lưu ý</span>' +
                '</div>' +
                '<button class="delete-btn" onclick="cart.removeItem(' + productId + ')">' +
                '<i class="fas fa-trash"></i>' +
                '</button>';
            
            // Thêm textarea sau note row
            const noteInput = document.createElement('div');
            noteInput.className = 'item-note-input';
            noteInput.id = 'noteInput' + productId;
            noteInput.innerHTML = 
                '<textarea class="item-note-textarea" ' +
                'id="noteText' + productId + '" ' +
                'placeholder="Ví dụ: Làm size nhỏ hơn, thêm charm hình tim..." ' +
                'maxlength="200">' + utils.escapeHtml(oldNote) + '</textarea>' +
                '<div class="item-note-actions">' +
                '<button class="btn-note-action btn-save-item-note" onclick="cart.saveItemNote(' + productId + ')">' +
                '<i class="fas fa-check"></i> Lưu' +
                '</button>' +
                '<button class="btn-note-action btn-cancel-item-note" onclick="cart.cancelEditNote(' + productId + ')">' +
                '<i class="fas fa-times"></i> Hủy' +
                '</button>' +
                '</div>';
            
            noteRow.parentNode.insertBefore(noteInput, noteRow.nextSibling);
            
            // Focus textarea
            const textarea = document.getElementById('noteText' + productId);
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(oldNote.length, oldNote.length);
            }
        }
    },

    // Cancel edit note (restore original note)
    cancelEditNote: (productId) => {
        // Chỉ cần render lại, note vẫn còn trong state
        cart.render();
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

        // Check if cart has bundle products
        const hasBundleProduct = state.cart.some(item => item.isBundleProduct);

        // Calculate discount using discountService
        let discountAmount = 0;
        if (state.discount) {
            discountAmount = discountService.calculateDiscountAmount(state.discount, state.subtotal);
            
            // Handle free shipping discount
            if (state.discount.type === 'freeship') {
                state.shippingFee = 0;
            }
        }

        // Calculate shipping fee
        if (state.subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD) {
            state.shippingFee = 0;
        } else if (hasBundleProduct) {
            // Free shipping if cart has at least 1 bundle product
            state.shippingFee = 0;
        } else if (!state.discount || state.discount.type !== 'freeship') {
            state.shippingFee = CONFIG.SHIPPING_FEE;
        }

        // Calculate total
        state.total = state.subtotal - discountAmount + state.shippingFee;

        console.log('=== UPDATE SUMMARY ===');
        console.log('Subtotal:', state.subtotal);
        console.log('Has bundle product:', hasBundleProduct);
        console.log('Discount:', discountAmount);
        console.log('Shipping:', state.shippingFee);
        console.log('Total:', state.total);

        // Ensure cart summary section is visible
        const summarySection = document.querySelector('.cart-summary-section');
        const cartSummary = document.querySelector('.cart-summary');
        console.log('Summary section exists:', !!summarySection);
        console.log('Cart summary exists:', !!cartSummary);
        
        summarySection?.classList.remove('hidden');
        
        // Prepare summary (remove hidden but keep opacity 0)
        if (cartSummary) {
            cartSummary.classList.remove('hidden');
            cartSummary.style.opacity = '0';
            
            // Fade in summary after a small delay
            requestAnimationFrame(() => {
                cartSummary.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    cartSummary.style.opacity = '1';
                }, 100);
            });
        }

        // Update UI
        const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        document.getElementById('summaryItemCount').textContent = `(${totalItems} sp)`;
        document.getElementById('subtotal').textContent = utils.formatPrice(state.subtotal);
        
        // Always show shipping fee (30k)
        const shippingFeeElement = document.getElementById('shippingFee');
        shippingFeeElement.textContent = utils.formatPrice(CONFIG.SHIPPING_FEE);
        
        // Show freeship discount row if applicable
        const freeshipRow = document.getElementById('freeshipRow');
        const freeshipLabel = document.getElementById('freeshipLabel');
        const freeshipAmount = document.getElementById('freeshipAmount');
        
        if (state.shippingFee === 0) {
            freeshipRow.classList.remove('hidden');
            freeshipAmount.textContent = '-' + utils.formatPrice(CONFIG.SHIPPING_FEE);
            
            // Set label based on reason
            if (hasBundleProduct) {
                freeshipLabel.textContent = '(Mua kèm)';
            } else if (state.subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD) {
                freeshipLabel.textContent = '(Đơn ≥500k)';
            } else if (state.discount && state.discount.type === 'freeship') {
                freeshipLabel.textContent = '(' + state.discount.code + ')';
            } else {
                freeshipLabel.textContent = '';
            }
        } else {
            freeshipRow.classList.add('hidden');
        }
        
        document.getElementById('totalAmount').textContent = utils.formatPrice(state.total);
        
        // Update checkout button total
        const checkoutTotal = document.getElementById('checkoutTotal');
        if (checkoutTotal) {
            checkoutTotal.textContent = utils.formatPrice(state.total);
        }
        
        console.log('Total amount element text:', document.getElementById('totalAmount').textContent);
        console.log('Total amount element display:', window.getComputedStyle(document.getElementById('totalAmount')).display);
        
        // Check if total-row is visible
        const totalRow = document.querySelector('.total-row');
        console.log('Total row element:', totalRow);
        console.log('Total row display:', window.getComputedStyle(totalRow).display);
        console.log('Total row visibility:', window.getComputedStyle(totalRow).visibility);
        
        // Check checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        console.log('Checkout button:', checkoutBtn);
        console.log('Checkout button display:', window.getComputedStyle(checkoutBtn).display);
        console.log('Checkout button visibility:', window.getComputedStyle(checkoutBtn).visibility);

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
        
        // Re-render available codes based on new subtotal
        discount.renderAvailableCodes();
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
    
    // Proceed to checkout
    proceedToCheckout: async () => {
        console.log('🚀 Starting checkout process...');
        console.log('🔍 [CART] Validator instance:', state.validator);
        
        // Check if validator exists
        if (!state.validator) {
            console.error('❌ [CART] Validator not initialized!');
            // This is a system error, not validation error
            // Keep toast for system errors
            utils.showToast('Lỗi hệ thống, vui lòng tải lại trang', 'error');
            return;
        }
        
        // Validate form using validator
        console.log('🔍 [CART] Calling validator.validate()...');
        const validationResult = state.validator.validate();
        console.log('📊 [CART] Validation result:', validationResult);
        
        if (!validationResult.isValid) {
            console.log('❌ [CART] Validation failed, errors:', validationResult.errors);
            // Errors are already displayed inline
            // Scroll to customer info section
            document.getElementById('customerInfoSection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            return;
        }
        
        console.log('✅ [CART] Validation passed!');
        
        // Get validated form data
        const formData = state.validator.getFormData();
        const phone = formData.cartPhone;
        const name = formData.cartName;
        
        // Validate address
        if (!window.cartAddressSelector) {
            // This is a system error (address selector not loaded)
            // Keep toast for system errors
            utils.showToast('Đang tải địa chỉ, vui lòng thử lại', 'error');
            return;
        }
        
        const addressValidation = window.cartAddressSelector.validate();
        if (!addressValidation.isValid) {
            // Show inline error instead of toast
            console.log('❌ [CART] Address validation failed:', addressValidation.message);
            
            // Determine which field has error and show inline message
            if (!window.cartAddressSelector.provinceCode) {
                errorDisplayService.showError('provinceSelect', addressValidation.message);
            } else if (!window.cartAddressSelector.districtCode) {
                errorDisplayService.showError('districtSelect', addressValidation.message);
            } else if (!window.cartAddressSelector.wardCode) {
                errorDisplayService.showError('wardSelect', addressValidation.message);
            } else if (!window.cartAddressSelector.street) {
                errorDisplayService.showError('streetInput', addressValidation.message);
            }
            
            // Scroll to address section
            document.getElementById('customerInfoSection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            return;
        }
        
        // Clear any address errors if validation passed
        errorDisplayService.clearError('provinceSelect');
        errorDisplayService.clearError('districtSelect');
        errorDisplayService.clearError('wardSelect');
        errorDisplayService.clearError('streetInput');
        
        // Get address data
        const addressData = window.cartAddressSelector.getAddressData();
        
        // Prepare cart items for API (products array)
        const cartItems = state.cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            cost_price: item.cost_price || 0,
            quantity: item.quantity,
            image: item.image,
            size: item.size || '', // Baby weight
            notes: item.note || '' // Product note
        }));
        
        console.log('📦 Cart items:', cartItems);
        
        // Prepare order data matching backend format
        const orderData = {
            orderId: 'DH' + Date.now(),
            orderDate: Date.now(),
            customer: {
                name: name,
                phone: phone
            },
            address: addressData.fullAddress,
            province_id: addressData.provinceCode,
            province_name: addressData.provinceName,
            district_id: addressData.districtCode,
            district_name: addressData.districtName,
            ward_id: addressData.wardCode,
            ward_name: addressData.wardName,
            street_address: addressData.street,
            paymentMethod: state.paymentMethod,
            payment_method: state.paymentMethod,
            status: 'pending',
            referralCode: null,
            shippingFee: state.shippingFee,
            shipping_fee: state.shippingFee,
            shippingCost: 0,
            shipping_cost: 0,
            total: state.total,
            totalAmount: state.total,
            cart: cartItems,
            notes: state.orderNote || null,
            discount_id: state.discount ? state.discount.id : null,
            discountCode: state.discount ? state.discount.code : null,
            discount_code: state.discount ? state.discount.code : null,
            discountAmount: state.discount ? discountService.calculateDiscountAmount(state.discount, state.subtotal) : 0,
            discount_amount: state.discount ? discountService.calculateDiscountAmount(state.discount, state.subtotal) : 0,
            is_priority: 0,
            source: 'shop-cart' // Mark as coming from cart page
        };
        
        console.log('📤 Sending order data:', orderData);
        
        // Show loading state on checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('loading');
        
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
                console.log('✅ Order created successfully:', result.order);
                
                // Clear cart
                storage.saveCart([]);
                storage.saveDiscount(null);
                localStorage.removeItem('orderNote');
                
                // Show success modal with order info
                successModal.show({
                    orderId: result.order.id,
                    total: result.order.total
                });
                
            } else {
                throw new Error(result.error || 'Không thể tạo đơn hàng');
            }
            
        } catch (error) {
            console.error('❌ Checkout error:', error);
            utils.showToast(`Lỗi: ${error.message}`, 'error');
            
            // Re-enable button
            checkoutBtn.disabled = false;
            checkoutBtn.classList.remove('loading');
        }
    },

    // Setup event listeners
    setupEventListeners: () => {
        // Event delegation for quantity buttons
        const cartItemsContainer = document.getElementById('cartItems');
        if (cartItemsContainer) {
            cartItemsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                
                const action = btn.dataset.action;
                const productId = parseInt(btn.dataset.productId);
                
                if (action === 'increase') {
                    cart.updateQuantity(productId, 1);
                } else if (action === 'decrease') {
                    cart.updateQuantity(productId, -1);
                }
            });
        }
        
        // Checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.onclick = () => {
                if (state.cart.length === 0) {
                    utils.showToast('Giỏ hàng trống', 'error');
                    return;
                }
                
                // Validate payment method
                if (!cartPayment.validatePayment()) {
                    return;
                }
                
                // Redirect to quick checkout modal with cart data
                cart.proceedToCheckout();
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

        // View all codes button
        const viewAllBtn = document.getElementById('viewAllCodesBtn');
        if (viewAllBtn) {
            viewAllBtn.onclick = discount.showAllDiscounts;
        }

        // Close all discounts modal
        const closeAllBtn = document.getElementById('closeAllDiscountsModal');
        if (closeAllBtn) {
            closeAllBtn.onclick = discount.closeAllDiscounts;
        }

        // Click outside modal to close
        const allDiscountsModal = document.getElementById('allDiscountsModal');
        if (allDiscountsModal) {
            allDiscountsModal.onclick = (e) => {
                if (e.target === allDiscountsModal) {
                    discount.closeAllDiscounts();
                }
            };
        }

        // Render available codes
        discount.renderAvailableCodes();
        
        // Setup order note
        const orderNoteTextarea = document.getElementById('orderNote');
        const orderNoteCharCount = document.getElementById('orderNoteCharCount');
        
        if (orderNoteTextarea) {
            // Load saved note
            const savedNote = localStorage.getItem('orderNote') || '';
            orderNoteTextarea.value = savedNote;
            state.orderNote = savedNote;
            orderNoteCharCount.textContent = savedNote.length + '/500';
            
            // Auto-save on input with debounce
            let saveTimeout;
            orderNoteTextarea.addEventListener('input', () => {
                const length = orderNoteTextarea.value.length;
                orderNoteCharCount.textContent = length + '/500';
                
                if (length > 450) {
                    orderNoteCharCount.style.color = 'var(--secondary)';
                } else {
                    orderNoteCharCount.style.color = 'var(--text-light)';
                }
                
                // Auto-save after 1 second of no typing
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    const note = orderNoteTextarea.value.trim();
                    state.orderNote = note;
                    localStorage.setItem('orderNote', note);
                }, 1000);
            });
        }
        
        // Update bank transfer note when phone changes
        const phoneInput = document.getElementById('cartPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                // Only update if bank transfer is selected
                if (state.paymentMethod === 'bank') {
                    const bankTransferNote = document.getElementById('bankTransferNote');
                    if (bankTransferNote) {
                        const phone = phoneInput.value.trim() || '0386190596';
                        bankTransferNote.textContent = phone;
                        
                        // Update copy button onclick
                        const copyBtn = bankTransferNote.nextElementSibling;
                        if (copyBtn && copyBtn.classList.contains('copy-btn')) {
                            copyBtn.onclick = () => cartPayment.copyBankInfo(phone);
                        }
                    }
                }
            });
        }
    }
};

// ============================================
// DISCOUNT OPERATIONS
// ============================================

const discount = {
    // Calculate actual savings for a discount
    calculateSavings: (discountCode) => {
        if (!discountCode) return 0;
        
        const amount = discountService.calculateDiscountAmount(discountCode, state.subtotal);
        
        // For freeship, add shipping fee as savings
        if (discountCode.type === 'freeship' && state.subtotal < CONFIG.FREE_SHIPPING_THRESHOLD) {
            return amount + CONFIG.SHIPPING_FEE;
        }
        
        return amount;
    },

    // Get best discounts sorted by savings
    getBestDiscounts: (limit = 3) => {
        if (!state.availableDiscounts || state.availableDiscounts.length === 0) {
            return [];
        }

        // Calculate savings for each discount
        const discountsWithSavings = state.availableDiscounts.map(d => {
            const savings = discount.calculateSavings(d);
            const isApplicable = !d.min_order_amount || state.subtotal >= d.min_order_amount;
            
            return {
                ...d,
                savings,
                isApplicable
            };
        });

        // Sort by: applicable first, then by savings (highest first)
        const sorted = discountsWithSavings.sort((a, b) => {
            // Applicable discounts first
            if (a.isApplicable && !b.isApplicable) return -1;
            if (!a.isApplicable && b.isApplicable) return 1;
            
            // Then by savings amount
            return b.savings - a.savings;
        });

        return limit ? sorted.slice(0, limit) : sorted;
    },

    // Apply discount code
    apply: async () => {
        const input = document.getElementById('discountCode');
        const code = input.value.trim().toUpperCase();

        if (!code) {
            utils.showToast('Vui lòng nhập mã giảm giá', 'error');
            return;
        }

        // Find discount code from available discounts
        const discountCode = state.availableDiscounts.find(d => d.code.toUpperCase() === code);

        if (!discountCode) {
            discount.showResult('Mã giảm giá không hợp lệ hoặc đã hết hạn', 'error');
            return;
        }

        // Check if discount is active
        if (!discountCode.active) {
            discount.showResult('Mã giảm giá đã hết hạn', 'error');
            return;
        }

        // Check minimum order amount
        if (discountCode.min_order_amount && state.subtotal < discountCode.min_order_amount) {
            const minAmount = utils.formatPrice(discountCode.min_order_amount);
            discount.showResult(`Đơn hàng tối thiểu ${minAmount} để áp dụng mã này`, 'error');
            return;
        }

        // Apply discount
        state.discount = discountCode;
        storage.saveDiscount(discountCode);
        
        cart.updateSummary();
        
        const discountText = discountService.formatDiscountText(discountCode);
        discount.showResult(`✓ Đã áp dụng mã ${code} - ${discountText}`, 'success');
        
        // Keep the code in input and disable it
        input.value = code;
        input.disabled = true;
        
        // Update apply button to show "Đổi mã" with special styling
        const applyBtn = document.getElementById('applyDiscountBtn');
        if (applyBtn) {
            applyBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Đổi mã';
            applyBtn.onclick = discount.changeCode;
            applyBtn.classList.add('btn-change-code');
        }
        
        utils.showToast('Áp dụng mã thành công!', 'success');
    },

    // Change discount code
    changeCode: () => {
        const input = document.getElementById('discountCode');
        const applyBtn = document.getElementById('applyDiscountBtn');
        
        // Clear input and enable it
        input.value = '';
        input.disabled = false;
        input.focus();
        
        // Reset apply button
        if (applyBtn) {
            applyBtn.innerHTML = '<i class="fas fa-check"></i> Áp dụng';
            applyBtn.onclick = discount.apply;
            applyBtn.classList.remove('btn-change-code');
        }
        
        // Remove current discount
        discount.remove();
    },

    // Remove discount
    remove: () => {
        const input = document.getElementById('discountCode');
        const applyBtn = document.getElementById('applyDiscountBtn');
        
        state.discount = null;
        storage.saveDiscount(null);
        state.shippingFee = CONFIG.SHIPPING_FEE;
        
        // Clear and enable input
        if (input) {
            input.value = '';
            input.disabled = false;
        }
        
        // Reset apply button
        if (applyBtn) {
            applyBtn.innerHTML = '<i class="fas fa-check"></i> Áp dụng';
            applyBtn.onclick = discount.apply;
        }
        
        cart.updateSummary();
        discount.showResult('', 'error');
        
        utils.showToast('Đã xóa mã giảm giá', 'success');
    },

    // Show discount result
    showResult: (message, type) => {
        const resultEl = document.getElementById('discountResult');
        
        if (!message || type === 'success') {
            // Hide result for success (code shows in input) or when no message
            resultEl.classList.add('hidden');
            resultEl.classList.remove('success', 'error');
            return;
        }

        // Only show for error messages
        resultEl.className = 'discount-result ' + type;
        resultEl.textContent = message;
        resultEl.classList.remove('hidden');
    },

    // Render available codes (top 3 best)
    renderAvailableCodes: () => {
        const container = document.getElementById('availableCodes');
        const viewAllBtn = document.getElementById('viewAllCodesBtn');
        
        if (!state.availableDiscounts || state.availableDiscounts.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; padding: 1rem; font-size: 0.9rem;">Không có mã giảm giá khả dụng</div>';
            viewAllBtn.classList.add('hidden');
            return;
        }

        // Get top 3 best discounts
        const bestDiscounts = discount.getBestDiscounts(3);

        const html = bestDiscounts.map(code => {
            const discountText = discountService.formatDiscountText(code);
            const savingsText = code.savings > 0 ? `Tiết kiệm ${utils.formatPrice(code.savings)}` : '';
            
            return '<div class="code-item">' +
                '<div>' +
                '<span class="code-name">' + utils.escapeHtml(code.code) + '</span>' +
                '<span> - ' + utils.escapeHtml(discountText) + '</span>' +
                (savingsText ? '<div style="font-size: 0.75rem; color: var(--success); font-weight: 700; margin-top: 0.25rem;">💰 ' + savingsText + '</div>' : '') +
                '</div>' +
                '<button class="code-apply-btn" ' +
                'onclick="discount.quickApply(\'' + utils.escapeHtml(code.code) + '\')" ' +
                (code.isApplicable ? '' : 'disabled') + '>' +
                'Áp dụng' +
                '</button>' +
                '</div>';
        }).join('');

        container.innerHTML = html;

        // Show "View All" button if there are more than 3 discounts
        if (state.availableDiscounts.length > 3) {
            viewAllBtn.classList.remove('hidden');
        } else {
            viewAllBtn.classList.add('hidden');
        }
    },

    // Show all discounts modal
    showAllDiscounts: () => {
        const modal = document.getElementById('allDiscountsModal');
        const container = document.getElementById('allDiscountsList');
        
        if (!state.availableDiscounts || state.availableDiscounts.length === 0) {
            container.innerHTML = '<div class="no-discounts-message">' +
                '<i class="fas fa-tags"></i>' +
                '<p>Không có mã giảm giá khả dụng</p>' +
                '</div>';
            modal.classList.remove('hidden');
            return;
        }

        // Get all discounts sorted by best savings
        const allDiscounts = discount.getBestDiscounts(null);

        const html = allDiscounts.map(code => {
            const discountText = discountService.formatDiscountText(code);
            const savings = code.savings;
            
            let icon = 'fa-tag';
            if (code.type === 'freeship') icon = 'fa-shipping-fast';
            if (code.type === 'gift') icon = 'fa-gift';
            
            let detailsHtml = '';
            
            if (code.min_order_amount) {
                detailsHtml += '<div class="discount-card-detail">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>' +
                    '<span>Đơn tối thiểu: ' + utils.formatPrice(code.min_order_amount) + '</span>' +
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
            
            if (code.usage_limit) {
                detailsHtml += '<div class="discount-card-detail">' +
                    '<i class="fas fa-users"></i>' +
                    '<span>Giới hạn: ' + code.usage_limit + ' lượt</span>' +
                    '</div>';
            }
            
            return '<div class="discount-card ' + (code.isApplicable ? '' : 'disabled') + '">' +
                (savings > 0 && code.isApplicable ? '<div class="discount-card-savings">💰 Tiết kiệm ' + utils.formatPrice(savings) + '</div>' : '') +
                '<div class="discount-card-header">' +
                '<div class="discount-card-icon">' +
                '<i class="fas ' + icon + '"></i>' +
                '</div>' +
                '<div class="discount-card-info">' +
                '<div class="discount-card-code">' + utils.escapeHtml(code.code) + '</div>' +
                (code.title ? '<div class="discount-card-title">' + utils.escapeHtml(code.title) + '</div>' : '') +
                '</div>' +
                '</div>' +
                (detailsHtml ? '<div class="discount-card-details">' + detailsHtml + '</div>' : '') +
                '<button class="discount-card-apply" ' +
                'onclick="discount.applyFromModal(\'' + utils.escapeHtml(code.code) + '\')" ' +
                (code.isApplicable ? '' : 'disabled') + '>' +
                '<i class="fas fa-check"></i>' +
                (code.isApplicable ? 'Áp dụng ngay' : 'Chưa đủ điều kiện') +
                '</button>' +
                '</div>';
        }).join('');

        container.innerHTML = html;
        modal.classList.remove('hidden');
    },

    // Close all discounts modal
    closeAllDiscounts: () => {
        const modal = document.getElementById('allDiscountsModal');
        modal.classList.add('hidden');
    },

    // Apply discount from modal
    applyFromModal: (code) => {
        discount.closeAllDiscounts();
        document.getElementById('discountCode').value = code;
        discount.apply();
    },

    // Quick apply discount
    quickApply: (code) => {
        document.getElementById('discountCode').value = code;
        discount.apply();
    }
};

// ============================================
// PAYMENT METHODS
// ============================================

const cartPayment = {
    bankTransferConfirmed: false, // Track if bank transfer is confirmed
    
    // Select payment method
    selectPaymentMethod: (method) => {
        state.paymentMethod = method;
        
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
            
            // Update bank transfer amount
            const amountEl = document.getElementById('bankTransferAmount');
            if (amountEl) {
                amountEl.textContent = utils.formatPrice(state.total);
            }
            
            // Update bank transfer note with customer phone
            const phoneInput = document.getElementById('cartPhone');
            const bankTransferNote = document.getElementById('bankTransferNote');
            if (phoneInput && bankTransferNote) {
                const phone = phoneInput.value.trim() || '0386190596';
                bankTransferNote.textContent = phone;
                
                // Update copy button onclick
                const copyBtn = bankTransferNote.nextElementSibling;
                if (copyBtn && copyBtn.classList.contains('copy-btn')) {
                    copyBtn.onclick = () => cartPayment.copyBankInfo(phone);
                }
            }
            
            // Reset confirmation state
            cartPayment.bankTransferConfirmed = false;
            const confirmBtn = document.getElementById('cartBankConfirmBtn');
            if (confirmBtn) {
                confirmBtn.style.display = 'flex';
                confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận đã chuyển khoản';
            }
        } else {
            bankInfo.classList.add('hidden');
        }
        
        console.log('Payment method selected:', method);
    },
    
    // Confirm bank transfer
    confirmBankTransfer: () => {
        cartPayment.bankTransferConfirmed = true;
        
        const confirmBtn = document.getElementById('cartBankConfirmBtn');
        const errorMsg = document.getElementById('cartBankConfirmError');
        
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-check-double"></i> Đã xác nhận';
            confirmBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            confirmBtn.style.cursor = 'default';
            confirmBtn.onclick = null;
        }
        
        if (errorMsg) {
            errorMsg.classList.add('hidden');
        }
        
        utils.showToast('Đã xác nhận chuyển khoản! ✓', 'success');
        console.log('Bank transfer confirmed');
    },
    
    // Copy bank info to clipboard
    copyBankInfo: (text) => {
        navigator.clipboard.writeText(text).then(() => {
            utils.showToast('Đã sao chép: ' + text, 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            utils.showToast('Không thể sao chép', 'error');
        });
    },
    
    // Validate payment before checkout
    validatePayment: () => {
        if (state.paymentMethod === 'bank' && !cartPayment.bankTransferConfirmed) {
            const errorMsg = document.getElementById('cartBankConfirmError');
            if (errorMsg) {
                errorMsg.classList.remove('hidden');
            }
            // Scroll to error
            const bankInfo = document.getElementById('bankTransferInfo');
            if (bankInfo) {
                bankInfo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }
        return true;
    }
};

// ============================================
// BUNDLE COUNTDOWN TIMER
// ============================================

const bundleCountdown = {
    endTime: null,
    intervalId: null,
    
    init: () => {
        // Set countdown to end at midnight (00:00:00)
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        bundleCountdown.endTime = midnight.getTime();
        
        // Start countdown
        bundleCountdown.update();
        bundleCountdown.intervalId = setInterval(bundleCountdown.update, 1000);
    },
    
    update: () => {
        const now = new Date().getTime();
        const distance = bundleCountdown.endTime - now;
        
        if (distance < 0) {
            // Reset to next midnight
            const tomorrow = new Date();
            tomorrow.setHours(24, 0, 0, 0);
            bundleCountdown.endTime = tomorrow.getTime();
            return;
        }
        
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        const countdownText = document.getElementById('bundleCountdownText');
        if (countdownText) {
            countdownText.textContent = 
                String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0') + ':' +
                String(seconds).padStart(2, '0');
        }
    },
    
    destroy: () => {
        if (bundleCountdown.intervalId) {
            clearInterval(bundleCountdown.intervalId);
            bundleCountdown.intervalId = null;
        }
    }
};

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    cart.init();
    bundleCountdown.init();
    
    // Event delegation for remove discount button
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="remove-discount"]')) {
            e.preventDefault();
            discount.remove();
        }
    });
});

// Expose to global scope for inline event handlers
window.cart = cart;
window.discount = discount;
window.cartPayment = cartPayment;
