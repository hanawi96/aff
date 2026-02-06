// ============================================
// IMAGE PREVIEW UTILITY - OPTIMIZED
// High-performance modal with caching and proper cleanup
// ============================================

import { CONFIG } from '../constants/config.js';
import { MODAL_CONSTANTS } from '../constants/modal-constants.js';
import { materialsCache } from './materials-cache.js';
import { eventManager } from './event-manager.js';

// Debounce utility for performance
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Preview product image in modal with materials
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 * @param {number} productId - Product ID
 * @param {Object} priceData - Price data {price, originalPrice, discountPercent}
 */
window.previewProductImage = async function(imageUrl, productName, productId, priceData = null) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewImg');
    const title = document.getElementById('imagePreviewTitle');
    const headerTitle = document.getElementById('imagePreviewHeaderTitle');
    const materialsContainer = document.getElementById('imagePreviewMaterials');
    const imageWrapper = document.getElementById('imagePreviewImageWrapper');

    if (!modal || !img) return;

    // Cleanup previous event listeners
    eventManager.remove('imagePreview');
    eventManager.removeController('imagePreviewEsc');
    eventManager.removeController('imagePreviewClick');

    // Set image with lazy loading
    img.src = imageUrl;
    img.alt = productName;
    img.loading = 'lazy';
    
    if (title) title.textContent = productName;
    if (headerTitle) headerTitle.textContent = productName;
    
    // Update pricing information
    updatePricingDisplay(priceData);
    
    // Show modal
    modal.classList.add('active');
    
    // Store productId for button actions
    modal.dataset.productId = productId;

    // Setup fullscreen image viewer for mobile
    setupFullscreenImageViewer(imageWrapper, imageUrl, productName);

    // Setup button event listeners
    setupPreviewButtons(productId);

    // Load materials (with caching)
    if (productId) {
        await loadProductMaterials(productId, materialsContainer);
    } else {
        materialsContainer.innerHTML = '';
    }

    // Close on click outside - using AbortController
    eventManager.addWithController('imagePreviewClick', modal, 'click', (e) => {
        if (e.target === modal) {
            window.closeImagePreview();
        }
    });

    // Close on ESC key - using AbortController
    eventManager.addWithController('imagePreviewEsc', document, 'keydown', (e) => {
        if (e.key === 'Escape') {
            window.closeImagePreview();
        }
    });
};

/**
 * Update pricing display in modal
 * @param {Object} priceData - Price data {price, originalPrice, discountPercent}
 */
function updatePricingDisplay(priceData) {
    const pricingSection = document.getElementById('productPricingSection');
    const priceCurrent = document.getElementById('priceCurrentModal');
    const priceOriginal = document.getElementById('priceOriginalModal');
    const discountBadge = document.getElementById('discountBadgeModal');
    const discountPercent = document.getElementById('discountPercentModal');

    console.log('updatePricingDisplay called with:', priceData);
    console.log('pricingSection found:', !!pricingSection);

    if (!pricingSection) {
        console.error('productPricingSection not found in DOM');
        return;
    }

    // If no price data or price is 0/null, hide the section
    if (!priceData || !priceData.price || priceData.price === 0) {
        console.log('No valid price data, hiding section');
        pricingSection.style.display = 'none';
        return;
    }

    // Show pricing section
    pricingSection.style.display = 'block';
    console.log('Showing pricing section with price:', priceData.price);

    // Format price with thousand separator
    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    };

    // Update current price
    if (priceCurrent) {
        priceCurrent.textContent = formatPrice(priceData.price);
        console.log('Set current price to:', priceCurrent.textContent);
    }

    // Update original price and discount badge
    if (priceData.originalPrice && priceData.originalPrice > priceData.price) {
        // Has discount
        if (priceOriginal) {
            priceOriginal.textContent = formatPrice(priceData.originalPrice);
            priceOriginal.style.display = 'block';
            console.log('Set original price to:', priceOriginal.textContent);
        }

        if (discountBadge) {
            const discount = priceData.discountPercent || 
                Math.round(((priceData.originalPrice - priceData.price) / priceData.originalPrice) * 100);
            
            if (discountPercent) {
                discountPercent.textContent = `-${discount}%`;
            }
            discountBadge.style.display = 'flex';
            console.log('Set discount to:', discount + '%');
        }
    } else {
        // No discount
        if (priceOriginal) {
            priceOriginal.style.display = 'none';
        }
        if (discountBadge) {
            discountBadge.style.display = 'none';
        }
        console.log('No discount, hiding original price and badge');
    }
}

/**
 * Setup fullscreen image viewer for mobile
 * @param {HTMLElement} imageWrapper - Image wrapper element
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 */
function setupFullscreenImageViewer(imageWrapper, imageUrl, productName) {
    if (!imageWrapper) return;

    // Remove old listener
    eventManager.remove('fullscreenClick');

    // Add click listener to open fullscreen on mobile
    eventManager.add('fullscreenClick', imageWrapper, 'click', () => {
        if (window.innerWidth <= MODAL_CONSTANTS.MOBILE_BREAKPOINT) {
            openFullscreenImage(imageUrl, productName);
        }
    });
}

/**
 * Open fullscreen image viewer with optimized swipe gesture
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 */
function openFullscreenImage(imageUrl, productName) {
    const viewer = document.getElementById('imageFullscreenViewer');
    const img = document.getElementById('fullscreenImg');

    if (!viewer || !img) return;

    img.src = imageUrl;
    img.alt = productName;
    img.loading = 'lazy';
    viewer.classList.add('active');

    // Setup swipe down to close with debounced updates
    setupSwipeGesture(viewer);
}

/**
 * Setup optimized swipe gesture with debouncing
 * @param {HTMLElement} viewer - Fullscreen viewer element
 */
function setupSwipeGesture(viewer) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const container = viewer.querySelector('.fullscreen-image-container');
    if (!container) return;

    // Remove old listeners
    eventManager.remove('swipeGesture');

    // Debounced opacity update for performance
    const updateOpacity = debounce((diff) => {
        if (diff > 0) {
            viewer.style.opacity = Math.max(
                MODAL_CONSTANTS.MIN_SWIPE_OPACITY,
                1 - diff / MODAL_CONSTANTS.SWIPE_OPACITY_DIVISOR
            );
        }
    }, 16); // ~60fps

    const handleTouchStart = (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        updateOpacity(diff);
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = currentY - startY;
        if (diff > MODAL_CONSTANTS.SWIPE_THRESHOLD) {
            window.closeFullscreenImage();
        } else {
            viewer.style.opacity = 1;
        }
    };

    eventManager.add('swipeGesture', container, 'touchstart', handleTouchStart, { passive: true });
    eventManager.add('swipeGesture', container, 'touchmove', handleTouchMove, { passive: true });
    eventManager.add('swipeGesture', container, 'touchend', handleTouchEnd, { passive: true });
}

/**
 * Close fullscreen image viewer
 */
window.closeFullscreenImage = function() {
    const viewer = document.getElementById('imageFullscreenViewer');
    if (viewer) {
        viewer.classList.remove('active');
        viewer.style.opacity = 1;
        // Cleanup swipe gesture listeners
        eventManager.remove('swipeGesture');
    }
};

/**
 * Setup button event listeners for preview modal
 * @param {number} productId - Product ID
 */
function setupPreviewButtons(productId) {
    const addToCartBtn = document.getElementById('previewAddToCart');
    const buyNowBtn = document.getElementById('previewBuyNow');

    // Remove old listeners
    eventManager.remove('previewButtons');

    if (addToCartBtn) {
        eventManager.add('previewButtons', addToCartBtn, 'click', () => {
            if (window.productActions?.addToCart) {
                window.productActions.addToCart(productId);
            }
        });
    }

    if (buyNowBtn) {
        eventManager.add('previewButtons', buyNowBtn, 'click', () => {
            if (window.productActions?.buyNow) {
                window.productActions.buyNow(productId);
                window.closeImagePreview();
            }
        });
    }
}

/**
 * Load and display product materials with caching
 * @param {number} productId - Product ID
 * @param {HTMLElement} container - Container element
 */
async function loadProductMaterials(productId, container) {
    try {
        // Check cache first
        const cached = materialsCache.get(productId);
        if (cached) {
            renderMaterials(cached, container);
            return;
        }

        // Show loading state
        showLoadingState(container);

        const response = await fetch(`${CONFIG.API_BASE_URL}/?action=getProductMaterials&product_id=${productId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load materials');
        }

        const data = await response.json();
        
        if (data.success && data.materials?.length > 0) {
            // Cache the data
            materialsCache.set(productId, data.materials);
            
            // Render materials
            renderMaterials(data.materials, container);
        } else {
            container.innerHTML = '';
            displayStringTypeInfo(false, false);
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        container.innerHTML = '';
        displayStringTypeInfo(false, false);
    }
}

/**
 * Show loading state
 * @param {HTMLElement} container - Container element
 */
function showLoadingState(container) {
    container.innerHTML = `
        <div class="materials-header">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
            </svg>
            <span>Thành phần nguyên liệu</span>
        </div>
        <div style="text-align: center; padding: 1rem; color: #95a5a6;">
            <span>Đang tải...</span>
        </div>
    `;
}

/**
 * Render materials to DOM
 * @param {Array} materials - Materials array
 * @param {HTMLElement} container - Container element
 */
function renderMaterials(materials, container) {
    // Filter out hidden materials - check both original name and normalized name
    const visibleMaterials = materials.filter(material => {
        const normalizedName = material.material_name.toLowerCase().replace(/\s+/g, '_');
        return !MODAL_CONSTANTS.HIDDEN_MATERIALS.includes(normalizedName) &&
               !MODAL_CONSTANTS.HIDDEN_MATERIALS.includes(material.material_name.toLowerCase());
    });
    
    // Check for string types
    const hasRedString = materials.some(m => 
        m.material_name === MODAL_CONSTANTS.MATERIAL_TYPES.RED_STRING || 
        m.material_name === MODAL_CONSTANTS.MATERIAL_TYPES.RAINBOW_STRING
    );
    const hasRopeString = materials.some(m => m.material_name === MODAL_CONSTANTS.MATERIAL_TYPES.ROPE_STRING);
    
    // Display string type info
    displayStringTypeInfo(hasRedString, hasRopeString);
    
    // If no visible materials, hide the section
    if (visibleMaterials.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Create header
    const header = document.createElement('div');
    header.className = 'materials-header';
    header.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
        </svg>
        <span>Thành phần nguyên liệu</span>
    `;
    fragment.appendChild(header);
    
    // Create materials list
    const list = document.createElement('div');
    list.className = 'materials-list';
    
    visibleMaterials.forEach(material => {
        const tag = document.createElement('div');
        tag.className = 'material-tag';
        
        const displayName = material.display_name || material.material_name.replace(/_/g, ' ');
        const quantity = material.quantity;
        const unit = material.unit || '';
        
        tag.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2"/>
            </svg>
            <span class="material-name">${displayName}</span>
            ${quantity ? `<span class="material-quantity">(${quantity} ${unit})</span>` : ''}
        `;
        
        list.appendChild(tag);
    });
    
    fragment.appendChild(list);
    
    // Single DOM update
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Display string type information based on material
 * @param {boolean} hasRedString - Has red string material
 * @param {boolean} hasRopeString - Has rope string material
 */
function displayStringTypeInfo(hasRedString, hasRopeString) {
    const stringInfoContainer = document.getElementById('productStringInfo');
    
    if (!stringInfoContainer) return;
    
    if (hasRedString) {
        stringInfoContainer.className = 'product-string-info red-string';
        stringInfoContainer.style.display = 'flex';
        stringInfoContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" />
            </svg>
            <span>Vòng có thể <strong>nới rộng khi bé lớn</strong>, mua size sơ sinh thì đến lớn bé vẫn đeo được thoải mái, không lo bị trật.</span>
        `;
    } else if (hasRopeString) {
        stringInfoContainer.className = 'product-string-info rope-string';
        stringInfoContainer.style.display = 'flex';
        stringInfoContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z" clip-rule="evenodd" />
            </svg>
            <span>Dây vòng được làm bằng <strong>dây cước gân co giãn loại 1</strong>, rất bền chắc, khó đứt, không thấm nước, gọn gàng không lo vướng.</span>
        `;
    } else {
        stringInfoContainer.style.display = 'none';
    }
}

/**
 * Close image preview modal with cleanup
 */
window.closeImagePreview = function() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.classList.remove('active');
        
        // Cleanup all event listeners
        eventManager.remove('imagePreview');
        eventManager.remove('previewButtons');
        eventManager.remove('fullscreenClick');
        eventManager.removeController('imagePreviewEsc');
        eventManager.removeController('imagePreviewClick');
    }
};
