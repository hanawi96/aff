// ============================================
// IMAGE PREVIEW UTILITY - OPTIMIZED
// High-performance modal with caching and proper cleanup
// Includes: Product Detail Modal with URL sync & share
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

// ============================================
// PRODUCT DETAIL MODAL - Main Entry Point
// Opens modal from any trigger (card click, URL, etc.)
// ============================================

/**
 * Open product detail modal by product ID.
 * Auto-finds product from cached data and syncs URL.
 * @param {number} productId - Product ID
 */
window.openProductDetail = async function(productId) {
    const product = _findProduct(productId);
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    const discount = _calculateDiscount(product.original_price, product.price);

    // Sync URL BEFORE opening modal (so URL is ready for sharing)
    const newUrl = _buildProductUrl(productId);
    window.history.pushState({ productId, fromPopstate: false }, '', newUrl);

    // Open modal with full product data
    await _openProductDetailModal(product, {
        price: product.price,
        originalPrice: product.original_price || product.price,
        discountPercent: discount
    });

    // Scroll to top of modal content
    const scrollArea = document.querySelector('#imagePreviewModal .image-preview-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
};

/**
 * Find product by ID from cached data.
 * Checks multiple sources in priority order.
 * @param {number} productId
 * @returns {Object|null}
 */
function _findProduct(productId) {
    // Priority 1: window.allProducts (set by home.page.js)
    if (window.allProducts && Array.isArray(window.allProducts)) {
        const found = window.allProducts.find(p => p.id == productId);
        if (found) return found;
    }

    // Priority 2: window.productGrid (ProductGrid instance)
    if (window.productGrid && window.productGrid.allProducts) {
        const found = window.productGrid.allProducts.find(p => p.id == productId);
        if (found) return found;
    }

    // Priority 3: window.App.currentPage.productGrid
    if (window.App?.currentPage?.productGrid?.allProducts) {
        const found = window.App.currentPage.productGrid.allProducts.find(p => p.id == productId);
        if (found) return found;
    }

    // Priority 4: window.App.currentPage.allProducts
    if (window.App?.currentPage?.allProducts) {
        const found = window.App.currentPage.allProducts.find(p => p.id == productId);
        if (found) return found;
    }

    return null;
}

/**
 * Build URL with product parameter, preserving other params.
 * @param {number} productId
 * @returns {string}
 */
function _buildProductUrl(productId) {
    const url = new URL(window.location.href);
    url.searchParams.set('product', productId);
    // Remove params that conflict with product view
    url.searchParams.delete('buy');
    url.searchParams.delete('checkout');
    return url.pathname + url.search;
}

/**
 * Get clean URL without product param.
 * @returns {string}
 */
function _buildCleanUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('product');
    return url.pathname + url.search;
}

// ============================================
// PRODUCT DETAIL MODAL - Internal Open Logic
// ============================================

/**
 * Internal: Open the modal with full product data.
 * Replaces the old previewProductImage flow.
 */
async function _openProductDetailModal(product, priceData) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewImg');
    const title = document.getElementById('imagePreviewTitle');
    const headerTitle = document.getElementById('imagePreviewHeaderTitle');
    const materialsContainer = document.getElementById('imagePreviewMaterials');
    const imageWrapper = document.getElementById('imagePreviewImageWrapper');
    const productDetailSection = document.getElementById('productDetailSection');
    const zoomHint = document.querySelector('.image-zoom-hint');

    if (!modal || !img) return;

    // Cleanup previous event listeners
    eventManager.remove('imagePreview');
    eventManager.removeController('imagePreviewEsc');
    eventManager.removeController('imagePreviewClick');

    // --- SETUP MODAL CONTENT ---

    // 1. Set image
    img.src = product.image_url || CONFIG.DEFAULT_IMAGE;
    img.alt = product.name;
    img.loading = 'eager';

    // 2. Set titles
    const displayName = product.name || 'Sản phẩm';
    if (title) title.textContent = displayName;
    if (headerTitle) headerTitle.textContent = displayName;

    // 3. Show zoom hint (now means "Xem chi tiết" more than zoom)
    if (zoomHint) {
        zoomHint.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            <span>Chạm để phóng to</span>
        `;
    }

    // 4. Update pricing
    _updatePricingDisplay(priceData);

    // 5. Show product detail info (categories, stock, SKU)
    _updateProductDetailSection(product);

    // 6. Show modal FIRST (before async operations)
    modal.classList.add('active');
    modal.dataset.productId = product.id;
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    // 7. Setup mobile fullscreen viewer
    _setupFullscreenImageViewer(imageWrapper, product.image_url || CONFIG.DEFAULT_IMAGE, product.name);

    // 8. Setup action buttons
    _setupPreviewButtons(product.id);

    // 9. Add share button to header
    _setupShareButton(product);

    // 10. Load materials async
    if (product.id) {
        await _loadProductMaterials(product.id, materialsContainer);
    } else {
        materialsContainer.innerHTML = '';
    }
}

/**
 * Update product detail section (categories, stock, SKU).
 */
function _updateProductDetailSection(product) {
    const section = document.getElementById('productDetailSection');
    if (!section) return;

    // Stock status
    const rawStock = product.stock_quantity ?? product.stockQuantity;
    const stockQty = rawStock !== undefined && rawStock !== null
        ? (typeof rawStock === 'string'
            ? parseInt(rawStock.replace(/[^\d-]/g, ''), 10)
            : Number(rawStock))
        : null;
    const isOutOfStock = stockQty !== null && Number.isFinite(stockQty) && stockQty <= 0;

    // Categories
    const categories = product.categories || [];
    const categoryBadges = categories.map(cat => {
        const color = cat.color || '#6b7280';
        const name = cat.name || cat.category_name || '';
        return `<span class="product-detail-category" style="--cat-color: ${color}">${name}</span>`;
    }).join('');

    // Rating
    const rating = product.rating || 0;
    const purchases = product.purchases || 0;
    const starsHtml = _generateStars(rating);

    // SKU
    const sku = product.sku || '';

    section.innerHTML = `
        <div class="product-detail-row">
            ${categoryBadges ? `<div class="product-detail-categories">${categoryBadges}</div>` : ''}
            ${sku ? `<div class="product-detail-sku">SKU: ${sku}</div>` : ''}
        </div>
        <div class="product-detail-rating">
            ${starsHtml}
            <span class="rating-score">${rating.toFixed(1)}</span>
            <span class="rating-count">(${purchases} đã bán)</span>
        </div>
        ${isOutOfStock
            ? `<div class="product-detail-stock out-of-stock-badge">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:0.875rem;height:0.875rem;flex-shrink:0"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z" clip-rule="evenodd" /></svg>
                <span>Hết hàng</span>
               </div>`
            : ''}
    `;
}

/**
 * Generate star rating HTML.
 */
function _generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    let html = '';
    for (let i = 0; i < fullStars; i++) {
        html += '<svg class="star filled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"/></svg>';
    }
    if (hasHalf) {
        html += '<svg class="star half" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"/></svg>';
    }
    for (let i = 0; i < emptyStars; i++) {
        html += '<svg class="star empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>';
    }
    return html;
}

/**
 * Calculate discount percentage.
 */
function _calculateDiscount(originalPrice, currentPrice) {
    if (!originalPrice || originalPrice <= currentPrice) return 0;
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

// ============================================
// SHARE FUNCTIONALITY
// ============================================

/**
 * Setup share button in modal header.
 */
function _setupShareButton(product) {
    const modal = document.getElementById('imagePreviewModal');
    if (!modal) return;

    // Find or create share button
    let shareBtn = modal.querySelector('.preview-share-btn');
    if (!shareBtn) {
        const closeBtn = modal.querySelector('.image-preview-close');
        if (closeBtn && closeBtn.parentNode) {
            shareBtn = document.createElement('button');
            shareBtn.className = 'preview-share-btn';
            shareBtn.title = 'Chia sẻ sản phẩm';
            shareBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
            `;
            closeBtn.parentNode.insertBefore(shareBtn, closeBtn);
        }
    }

    if (shareBtn) {
        // Remove old listener
        eventManager.remove('shareButton');

        eventManager.add('shareButton', shareBtn, 'click', (e) => {
            e.stopPropagation();
            _shareProduct(product);
        });
    }
}

/**
 * Share product via Web Share API or clipboard.
 */
async function _shareProduct(product) {
    const shareUrl = _buildProductUrl(product.id);
    const shareData = {
        title: product.name,
        text: `${product.name} - Chỉ ${_formatPrice(product.price)} tại Vòng dâu tằm by Ánh`,
        url: shareUrl
    };

    try {
        // Try native share first (mobile)
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
        }
    } catch (err) {
        // Fall through to clipboard copy
    }

    // Fallback: Copy to clipboard
    try {
        await navigator.clipboard.writeText(window.location.origin + shareUrl);
        _showShareToast('Đã copy link sản phẩm!');
    } catch (err) {
        // Final fallback: select text
        const textArea = document.createElement('textarea');
        textArea.value = window.location.origin + shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        _showShareToast('Đã copy link sản phẩm!');
    }
}

/**
 * Show toast for share action.
 */
let _shareToastTimer = null;
function _showShareToast(message) {
    // Remove existing toast
    const existing = document.getElementById('shareToast');
    if (existing) existing.remove();
    clearTimeout(_shareToastTimer);

    const toast = document.createElement('div');
    toast.id = 'shareToast';
    toast.style.cssText = [
        'position:fixed',
        'top:50%',
        'left:50%',
        'transform:translate(-50%,-50%)',
        'background:#1f2937',
        'color:#fff',
        'padding:12px 24px',
        'border-radius:8px',
        'font-size:14px',
        'font-weight:500',
        'z-index:100000',
        'box-shadow:0 4px 20px rgba(0,0,0,.3)',
        'animation:shareToastIn 0.3s ease'
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);

    _shareToastTimer = setTimeout(() => {
        toast.style.animation = 'shareToastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ============================================
// CLOSE & URL SYNC
// ============================================

/**
 * Close image preview modal with URL cleanup.
 */
window.closeImagePreview = function(fromPopstate = false) {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Cleanup all event listeners
    eventManager.remove('imagePreview');
    eventManager.remove('previewButtons');
    eventManager.remove('fullscreenClick');
    eventManager.remove('shareButton');
    eventManager.removeController('imagePreviewEsc');
    eventManager.removeController('imagePreviewClick');

    // Sync URL back to clean URL (only if opening from product param)
    const url = new URL(window.location.href);
    if (url.searchParams.has('product')) {
        // Don't pushState if closing from popstate (back button already changed URL)
        if (!fromPopstate) {
            window.history.pushState({}, '', _buildCleanUrl());
        }
    }
};

/**
 * Handle browser back/forward button.
 * Setup once on module load.
 */
window.addEventListener('popstate', (e) => {
    const url = new URL(window.location.href);
    const productId = url.searchParams.get('product');

    if (productId) {
        // User went forward to a product URL
        window.openProductDetail(parseInt(productId, 10));
    } else {
        // User went back to clean URL
        window.closeImagePreview(true);
    }
});

// ============================================
// LEGACY: previewProductImage (kept for backward compat)
// ============================================

/**
 * Legacy: Preview product image in modal (backward compat wrapper).
 * Now delegates to openProductDetail with product lookup.
 */
window.previewProductImage = async function(imageUrl, productName, productId, priceData = null) {
    const product = _findProduct(productId);
    if (product) {
        await window.openProductDetail(productId);
    } else {
        // Fallback: open with minimal data (for external callers)
        await _openProductDetailModal({
            id: productId,
            name: productName,
            image_url: imageUrl,
            price: priceData?.price || 0,
            original_price: priceData?.originalPrice,
            rating: 0,
            purchases: 0,
            categories: [],
            sku: ''
        }, priceData);

        const modal = document.getElementById('imagePreviewModal');
        if (modal) modal.classList.add('active');
    }
};

// ============================================
// PRICING DISPLAY
// ============================================

function _updatePricingDisplay(priceData) {
    const pricingSection = document.getElementById('productPricingSection');
    const priceCurrent = document.getElementById('priceCurrentModal');
    const priceOriginal = document.getElementById('priceOriginalModal');
    const discountBadge = document.getElementById('discountBadgeModal');
    const discountPercent = document.getElementById('discountPercentModal');

    if (!pricingSection) return;

    if (!priceData || !priceData.price || priceData.price === 0) {
        pricingSection.style.display = 'none';
        return;
    }

    pricingSection.style.display = 'block';

    if (priceCurrent) {
        priceCurrent.textContent = _formatPrice(priceData.price);
    }

    if (priceData.originalPrice && priceData.originalPrice > priceData.price) {
        if (priceOriginal) {
            priceOriginal.textContent = _formatPrice(priceData.originalPrice);
            priceOriginal.style.display = 'block';
        }
        if (discountBadge) {
            const discount = priceData.discountPercent ||
                _calculateDiscount(priceData.originalPrice, priceData.price);
            if (discountPercent) discountPercent.textContent = `-${discount}%`;
            discountBadge.style.display = 'flex';
        }
    } else {
        if (priceOriginal) priceOriginal.style.display = 'none';
        if (discountBadge) discountBadge.style.display = 'none';
    }
}

function _formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
}

// ============================================
// FULLSCREEN IMAGE VIEWER (mobile)
// ============================================

function _setupFullscreenImageViewer(imageWrapper, imageUrl, productName) {
    if (!imageWrapper) return;
    eventManager.remove('fullscreenClick');
    // Open fullscreen on all devices (mobile breakpoint check removed)
    eventManager.add('fullscreenClick', imageWrapper, 'click', () => {
        _openFullscreenImage(imageUrl, productName);
    });
}

function _openFullscreenImage(imageUrl, productName) {
    const viewer = document.getElementById('imageFullscreenViewer');
    const img = document.getElementById('fullscreenImg');
    if (!viewer || !img) return;
    img.src = imageUrl;
    img.alt = productName;
    img.loading = 'eager';
    viewer.classList.add('active');
    _setupSwipeGesture(viewer);
}

function _setupSwipeGesture(viewer) {
    let startY = 0, currentY = 0, isDragging = false;
    const container = viewer.querySelector('.fullscreen-image-container');
    if (!container) return;

    eventManager.remove('swipeGesture');

    const updateOpacity = debounce((diff) => {
        if (diff > 0) {
            viewer.style.opacity = Math.max(
                MODAL_CONSTANTS.MIN_SWIPE_OPACITY,
                1 - diff / MODAL_CONSTANTS.SWIPE_OPACITY_DIVISOR
            );
        }
    }, 16);

    eventManager.add('swipeGesture', container, 'touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
    }, { passive: true });

    eventManager.add('swipeGesture', container, 'touchmove', (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        updateOpacity(currentY - startY);
    }, { passive: true });

    eventManager.add('swipeGesture', container, 'touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        if (currentY - startY > MODAL_CONSTANTS.SWIPE_THRESHOLD) {
            window.closeFullscreenImage();
        } else {
            viewer.style.opacity = 1;
        }
    }, { passive: true });
}

window.closeFullscreenImage = function() {
    const viewer = document.getElementById('imageFullscreenViewer');
    if (viewer) {
        viewer.classList.remove('active');
        viewer.style.opacity = 1;
        eventManager.remove('swipeGesture');
    }
};

// ============================================
// ACTION BUTTONS
// ============================================

function _setupPreviewButtons(productId) {
    const addToCartBtn = document.getElementById('previewAddToCart');
    const buyNowBtn = document.getElementById('previewBuyNow');

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

    // Close on click outside
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        eventManager.addWithController('imagePreviewClick', modal, 'click', (e) => {
            if (e.target === modal) window.closeImagePreview();
        });
    }

    // Close on ESC
    eventManager.addWithController('imagePreviewEsc', document, 'keydown', (e) => {
        if (e.key === 'Escape') window.closeImagePreview();
    });
}

// ============================================
// MATERIALS
// ============================================

async function _loadProductMaterials(productId, container) {
    try {
        const cached = materialsCache.get(productId);
        if (cached) {
            _renderMaterials(cached, container);
            return;
        }

        _showMaterialsLoading(container);

        const response = await fetch(`${CONFIG.API_BASE_URL}/?action=getProductMaterials&product_id=${productId}`);
        if (!response.ok) throw new Error('Failed to load materials');

        const data = await response.json();

        if (data.success && data.materials?.length > 0) {
            materialsCache.set(productId, data.materials);
            _renderMaterials(data.materials, container);
        } else {
            container.innerHTML = '';
            _displayStringTypeInfo(false, false);
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        container.innerHTML = '';
        _displayStringTypeInfo(false, false);
    }
}

function _showMaterialsLoading(container) {
    container.innerHTML = `
        <div class="materials-header">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
            <span>Thành phần nguyên liệu</span>
        </div>
        <div style="text-align: center; padding: 1rem; color: #95a5a6;"><span>Đang tải...</span></div>
    `;
}

function _renderMaterials(materials, container) {
    const visibleMaterials = materials.filter(material => {
        const normalizedName = material.material_name.toLowerCase().replace(/\s+/g, '_');
        return !MODAL_CONSTANTS.HIDDEN_MATERIALS.includes(normalizedName) &&
               !MODAL_CONSTANTS.HIDDEN_MATERIALS.includes(material.material_name.toLowerCase());
    });

    const hasRedString = materials.some(m =>
        m.material_name === MODAL_CONSTANTS.MATERIAL_TYPES.RED_STRING ||
        m.material_name === MODAL_CONSTANTS.MATERIAL_TYPES.RAINBOW_STRING
    );
    const hasRopeString = materials.some(m => m.material_name === MODAL_CONSTANTS.MATERIAL_TYPES.ROPE_STRING);

    _displayStringTypeInfo(hasRedString, hasRopeString);

    if (visibleMaterials.length === 0) {
        container.innerHTML = '';
        return;
    }

    const fragment = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'materials-header';
    header.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
        <span>Thành phần nguyên liệu</span>
    `;
    fragment.appendChild(header);

    const list = document.createElement('div');
    list.className = 'materials-list';

    visibleMaterials.forEach(material => {
        const tag = document.createElement('div');
        tag.className = 'material-tag';
        const displayName = material.display_name || material.material_name.replace(/_/g, ' ');
        const quantity = material.quantity;
        const unit = material.unit || '';
        tag.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/></svg>
            <span class="material-name">${displayName}</span>
            ${quantity ? `<span class="material-quantity">(${quantity} ${unit})</span>` : ''}
        `;
        list.appendChild(tag);
    });

    fragment.appendChild(list);
    container.innerHTML = '';
    container.appendChild(fragment);
}

function _displayStringTypeInfo(hasRedString, hasRopeString) {
    const container = document.getElementById('productStringInfo');
    if (!container) return;

    if (hasRedString) {
        container.className = 'product-string-info red-string';
        container.style.display = 'flex';
        container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" /></svg>
            <span>Vòng có thể <strong>nới rộng khi bé lớn</strong>, mua size sơ sinh thì đến lớn bé vẫn đeo được thoải mái, không lo bị trật.</span>`;
    } else if (hasRopeString) {
        container.className = 'product-string-info rope-string';
        container.style.display = 'flex';
        container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z" clip-rule="evenodd" /></svg>
            <span>Dây vòng được làm bằng <strong>dây cước gân co giãn loại 1</strong>, rất bền chắc, khó đứt, không thấm nước, gọn gàng không lo vướng.</span>`;
    } else {
        container.style.display = 'none';
    }
}
