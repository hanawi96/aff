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
// IMAGE CAROUSEL STATE
// ============================================

const _carouselState = {
    images: [],
    currentIndex: 0,
    isDragging: false,
    startX: 0,
    currentX: 0,
    dragOffset: 0,
    track: null,
    isInitialized: false
};

// Process image labels for carousel
const _processImageLabels = [
    'Chọn nguyên liệu',
    'Bóc dâu tằm',
    'Phơi khô',
    'Mài nhỏ cành',
    'Mài mịn viền',
    'Xỏ vòng'
];

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
    const title = document.getElementById('imagePreviewTitle');
    const headerTitle = document.getElementById('imagePreviewHeaderTitle');
    const materialsContainer = document.getElementById('imagePreviewMaterials');
    const productDetailSection = document.getElementById('productDetailSection');

    if (!modal) return;

    // Cleanup previous event listeners
    eventManager.remove('imagePreview');
    eventManager.removeController('imagePreviewEsc');
    eventManager.removeController('imagePreviewClick');
    eventManager.remove('imageCarousel');

    // --- SETUP MODAL CONTENT ---

    // 1. Build carousel with product image + process images
    _buildImageCarousel(product);

    // 2. Set titles
    const displayName = product.name || 'Sản phẩm';
    if (title) title.textContent = displayName;
    if (headerTitle) headerTitle.textContent = displayName;

    // 3. Update pricing
    _updatePricingDisplay(priceData);

    // 4. Show product detail info (categories, stock, SKU)
    _updateProductDetailSection(product);

    // 5. Show modal FIRST (before async operations)
    modal.classList.add('active');
    modal.dataset.productId = product.id;
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    // 6. Setup carousel events (touch, click, keyboard)
    _setupCarouselEvents();

    // 7. Setup action buttons
    _setupPreviewButtons(product.id);

    // 8. Add share button to header
    _setupShareButton(product);

    // 9. Load materials async
    if (product.id) {
        await _loadProductMaterials(product.id, materialsContainer);
    } else {
        materialsContainer.innerHTML = '';
    }
}

/**
 * Build the image carousel with product image + process images
 */
function _buildImageCarousel(product) {
    const track = document.getElementById('imageCarouselTrack');
    const dotsContainer = document.getElementById('carouselDots');
    const totalCount = document.getElementById('carouselTotalCount');
    const currentIdx = document.getElementById('carouselCurrentIdx');
    if (!track) return;

    // Build images array - product image first, then process images
    const productImage = product.image_url || CONFIG.DEFAULT_IMAGE;
    const images = [
        {
            url: productImage,
            alt: product.name,
            label: 'Sản phẩm',
            type: 'product',
            index: 0
        },
        {
            url: '/assets/images/quy-trinh-lam-vong/1.webp',
            alt: 'Chọn nguyên liệu',
            label: 'Chọn nguyên liệu',
            type: 'process',
            index: 1
        },
        {
            url: '/assets/images/quy-trinh-lam-vong/2.webp',
            alt: 'Bóc dâu tằm',
            label: 'Bóc dâu tằm',
            type: 'process',
            index: 2
        },
        {
            url: '/assets/images/quy-trinh-lam-vong/3.webp',
            alt: 'Phơi khô',
            label: 'Phơi khô',
            type: 'process',
            index: 3
        },
        {
            url: '/assets/images/quy-trinh-lam-vong/4.webp',
            alt: 'Mài nhỏ cành',
            label: 'Mài nhỏ cành',
            type: 'process',
            index: 4
        },
        {
            url: '/assets/images/quy-trinh-lam-vong/5.webp',
            alt: 'Mài mịn viền',
            label: 'Mài mịn viền',
            type: 'process',
            index: 5
        },
        {
            url: '/assets/images/quy-trinh-lam-vong/vong-dau-tam-gia.webp',
            alt: 'Xỏ vòng - Thành phẩm',
            label: 'Xỏ vòng - Thành phẩm',
            type: 'process',
            index: 6
        }
    ];

    _carouselState.images = images;
    _carouselState.currentIndex = 0;

    // Build slides HTML
    track.innerHTML = images.map((img, idx) => `
        <div class="image-carousel-slide" data-index="${idx}" data-type="${img.type}">
            <img src="${img.url}"
                 alt="${img.alt}"
                 data-image-url="${img.url}"
                 data-image-name="${img.alt}"
                 loading="${idx === 0 ? 'eager' : 'lazy'}"
                 onerror="if(this.dataset.fallback){return}this.dataset.fallback='1';this.src='${CONFIG.DEFAULT_IMAGE}'">
        </div>
    `).join('');

    // Build dots
    if (dotsContainer) {
        dotsContainer.innerHTML = images.map((_, idx) => `
            <button class="carousel-dot ${idx === 0 ? 'active' : ''}"
                    data-dot-index="${idx}"
                    aria-label="Chuyển đến ảnh ${idx + 1}"></button>
        `).join('');
    }

    // Update counter
    if (totalCount) totalCount.textContent = images.length;
    if (currentIdx) currentIdx.textContent = 1;

    // Update state reference
    _carouselState.track = track;

    // Reset transform
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    // Force reflow then re-enable transition
    void track.offsetWidth;
    track.style.transition = '';

    // Initial UI update
    _updateCarouselUI(0);
}

/**
 * Setup carousel events - touch swipe, click navigation, keyboard, fullscreen
 */
function _setupCarouselEvents() {
    const container = document.getElementById('imageCarouselContainer');
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    const dotsContainer = document.getElementById('carouselDots');

    if (!container) return;

    // Arrow buttons
    if (prevBtn) {
        eventManager.add('imageCarousel', prevBtn, 'click', (e) => {
            e.stopPropagation();
            _goToSlide(_carouselState.currentIndex - 1);
        });
    }

    if (nextBtn) {
        eventManager.add('imageCarousel', nextBtn, 'click', (e) => {
            e.stopPropagation();
            _goToSlide(_carouselState.currentIndex + 1);
        });
    }

    // Dot clicks
    if (dotsContainer) {
        eventManager.add('imageCarousel', dotsContainer, 'click', (e) => {
            const dot = e.target.closest('.carousel-dot');
            if (!dot) return;
            const idx = parseInt(dot.dataset.dotIndex, 10);
            if (!isNaN(idx)) _goToSlide(idx);
        });
    }

    // Touch swipe events
    _setupTouchSwipe(container);

    // Click to fullscreen (only on current image)
    eventManager.add('imageCarousel', container, 'click', (e) => {
        // Don't open fullscreen if clicking arrows or dots
        if (e.target.closest('.carousel-arrow') || e.target.closest('.carousel-dot')) return;

        const currentImg = container.querySelector(`.image-carousel-slide[data-index="${_carouselState.currentIndex}"] img`);
        if (currentImg) {
            _openFullscreenImage(currentImg.dataset.imageUrl, currentImg.dataset.imageName);
        }
    });
}

/**
 * Setup touch swipe gestures for the carousel
 */
function _setupTouchSwipe(container) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    eventManager.add('imageCarousel', container, 'touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
        container.style.transition = 'none';

        if (_carouselState.track) {
            _carouselState.track.style.transition = 'none';
        }
    }, { passive: true });

    eventManager.add('imageCarousel', container, 'touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        // Apply transform with drag offset
        if (_carouselState.track && _carouselState.images.length > 0) {
            const slideWidth = container.offsetWidth || 1;
            const baseOffset = -_carouselState.currentIndex * slideWidth;
            const offset = Math.max(
                -slideWidth * 0.3,
                Math.min(slideWidth * 0.3, diff)
            );
            _carouselState.track.style.transform = `translateX(${baseOffset + offset}px)`;
            _carouselState.dragOffset = offset;
        }
    }, { passive: true });

    eventManager.add('imageCarousel', container, 'touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = currentX - startX;
        const threshold = 50; // Min drag distance to trigger slide change

        if (_carouselState.track) {
            // Re-enable transition for smooth snap
            _carouselState.track.style.transition = '';
            _carouselState.dragOffset = 0;

            if (Math.abs(diff) > threshold) {
                if (diff > 0) {
                    _goToSlide(_carouselState.currentIndex - 1);
                } else {
                    _goToSlide(_carouselState.currentIndex + 1);
                }
            } else {
                // Snap back to current
                _goToSlide(_carouselState.currentIndex);
            }
        }
    }, { passive: true });

    // Mouse drag for desktop testing
    let mouseStartX = 0;
    let mouseCurrentX = 0;
    let isMouseDragging = false;

    eventManager.add('imageCarousel', container, 'mousedown', (e) => {
        // Only left click, ignore if clicking arrows/dots
        if (e.button !== 0) return;
        if (e.target.closest('.carousel-arrow') || e.target.closest('.carousel-dot')) return;

        mouseStartX = e.clientX;
        mouseCurrentX = mouseStartX;
        isMouseDragging = true;
        container.style.cursor = 'grabbing';

        if (_carouselState.track) {
            _carouselState.track.style.transition = 'none';
        }

        e.preventDefault();
    });

    eventManager.add('imageCarousel', document, 'mousemove', (e) => {
        if (!isMouseDragging) return;
        mouseCurrentX = e.clientX;
        const diff = mouseCurrentX - mouseStartX;

        if (_carouselState.track && _carouselState.images.length > 0) {
            const slideWidth = container.offsetWidth || 1;
            const baseOffset = -_carouselState.currentIndex * slideWidth;
            const offset = Math.max(
                -slideWidth * 0.3,
                Math.min(slideWidth * 0.3, diff)
            );
            _carouselState.track.style.transform = `translateX(${baseOffset + offset}px)`;
        }
    });

    eventManager.add('imageCarousel', document, 'mouseup', () => {
        if (!isMouseDragging) return;
        isMouseDragging = false;
        container.style.cursor = '';

        const diff = mouseCurrentX - mouseStartX;
        const threshold = 50;

        if (_carouselState.track) {
            _carouselState.track.style.transition = '';
        }

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                _goToSlide(_carouselState.currentIndex - 1);
            } else {
                _goToSlide(_carouselState.currentIndex + 1);
            }
        } else {
            _goToSlide(_carouselState.currentIndex);
        }
    });

    // Keyboard navigation (when modal is open)
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        const keyHandler = (e) => {
            if (!modal.classList.contains('active')) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                _goToSlide(_carouselState.currentIndex - 1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                _goToSlide(_carouselState.currentIndex + 1);
            }
        };

        eventManager.add('imageCarousel', document, 'keydown', keyHandler);
    }
}

/**
 * Go to a specific slide index
 */
function _goToSlide(index) {
    const total = _carouselState.images.length;
    if (total === 0) return;

    // Clamp index
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;

    _carouselState.currentIndex = index;

    const track = _carouselState.track;
    const container = document.getElementById('imageCarouselContainer');
    if (!track || !container) return;

    const slideWidth = container.offsetWidth || 1;
    track.style.transform = `translateX(-${index * slideWidth}px)`;

    // Update UI (dots, counter, badges)
    _updateCarouselUI(index);
}

/**
 * Update carousel UI (dots, counter, badges)
 */
function _updateCarouselUI(index) {
    const currentImg = _carouselState.images[index];
    if (!currentImg) return;

    // Update dots
    const dots = document.querySelectorAll('.carousel-dot');
    dots.forEach((dot, idx) => {
        if (idx === index) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });

    // Update counter
    const currentIdxEl = document.getElementById('carouselCurrentIdx');
    if (currentIdxEl) currentIdxEl.textContent = index + 1;

    // Show/hide zoom hint (only for product image - first slide)
    const zoomHint = document.querySelector('.carousel-zoom-hint');
    if (zoomHint) {
        if (currentImg.type === 'product') {
            zoomHint.classList.add('show');
        } else {
            zoomHint.classList.remove('show');
        }
    }

    // Show/hide process badge (only for process images)
    const processBadge = document.getElementById('carouselProcessBadge');
    const processLabel = document.getElementById('carouselProcessLabel');
    if (processBadge) {
        if (currentImg.type === 'process') {
            processBadge.classList.add('show');
            if (processLabel) processLabel.textContent = `Quy trình ${index}/6: ${currentImg.label}`;
        } else {
            processBadge.classList.remove('show');
        }
    }

    // Show/hide arrows on first/last slide
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    const total = _carouselState.images.length;

    if (prevBtn) {
        if (index === 0) {
            prevBtn.style.opacity = '0.4';
            prevBtn.style.pointerEvents = 'none';
        } else {
            prevBtn.style.opacity = '';
            prevBtn.style.pointerEvents = '';
        }
    }

    if (nextBtn) {
        if (index === total - 1) {
            nextBtn.style.opacity = '0.4';
            nextBtn.style.pointerEvents = 'none';
        } else {
            nextBtn.style.opacity = '';
            nextBtn.style.pointerEvents = '';
        }
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

    // Categories — chỉ hiển thị 1 danh mục đầu tiên
    const categories = product.categories || [];
    const firstCat = categories[0];
    const categoryBadges = firstCat
        ? `<span class="product-detail-category" style="--cat-color: ${firstCat.color || '#6b7280'}">${firstCat.name || firstCat.category_name || ''}</span>`
        : '';

    // Rating — một ngôi sao + điểm (không dãy 5 sao)
    const rating = product.rating || 0;
    const purchases = product.purchases || 0;
    const ratingStarSingle = `<svg class="star filled rating-star-single" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"/></svg>`;

    // SKU
    const sku = product.sku || '';

    section.innerHTML = `
        <div class="product-detail-meta-row">
            <div class="product-detail-categories">${categoryBadges}</div>
            <div class="product-detail-rating">
                ${ratingStarSingle}
                <span class="rating-score">${rating.toFixed(1)}</span>
                <span class="rating-count">(${purchases} đã bán)</span>
            </div>
        </div>
        ${sku ? `<div class="product-detail-row product-detail-sku-row"><div class="product-detail-sku">SKU: ${sku}</div></div>` : ''}
        ${isOutOfStock
            ? `<div class="product-detail-stock out-of-stock-badge">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:0.875rem;height:0.875rem;flex-shrink:0"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z" clip-rule="evenodd" /></svg>
                <span>Hết hàng</span>
               </div>`
            : ''}
    `;
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
    eventManager.remove('imageCarousel');
    eventManager.remove('quyTrinhClick');
    eventManager.remove('benefitsClick');
    eventManager.removeController('imagePreviewEsc');
    eventManager.removeController('imagePreviewClick');

    // Reset carousel state
    _carouselState.currentIndex = 0;
    _carouselState.dragOffset = 0;
    _carouselState.images = [];
    _carouselState.isDragging = false;

    // Sync URL back to clean URL (only if opening from product param)
    const url = new URL(window.location.href);
    if (url.searchParams.has('product')) {
        // Don't pushState if closing from popstate (back button already changed URL)
        if (!fromPopstate) {
            window.history.pushState({}, '', _buildCleanUrl());
        }
    }
};

// Handle window resize to keep carousel position correct
let _carouselResizeHandler = null;
function _setupCarouselResize() {
    if (_carouselResizeHandler) {
        window.removeEventListener('resize', _carouselResizeHandler);
    }

    let resizeTimer;
    _carouselResizeHandler = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const modal = document.getElementById('imagePreviewModal');
            if (modal && modal.classList.contains('active')) {
                _goToSlide(_carouselState.currentIndex);
            }
        }, 150);
    };

    window.addEventListener('resize', _carouselResizeHandler, { passive: true });
}

// Initialize resize handler once
if (typeof window !== 'undefined') {
    _setupCarouselResize();
}

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

    // Lưu ý về số lượng nguyên liệu
    const note = document.createElement('p');
    note.className = 'materials-note';
    note.textContent = 'Số lượng nguyên liệu đôi khi sẽ có thay đổi, khác biệt với trong ảnh tùy theo cân nặng bé';
    fragment.appendChild(note);

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

// ============================================
// QUY TRINH PROCESS IMAGES - CLICK TO FULLSCREEN
// ============================================

function setupQuyTrinhImageClick() {
    const processImages = document.querySelectorAll('.quy-trinh-lam img');

    processImages.forEach(img => {
        img.style.cursor = 'pointer';

        eventManager.add('quyTrinhClick', img, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const imageUrl = img.src;
            const imageName = img.alt || 'Hình ảnh công đoạn';
            _openFullscreenImage(imageUrl, imageName);
        });
    });
}

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupQuyTrinhImageClick);
} else {
    setupQuyTrinhImageClick();
}

// ============================================
// BENEFITS IMAGES - CLICK TO FULLSCREEN
// ============================================

function setupBenefitsImageClick() {
    const benefitImages = document.querySelectorAll('.benefit-card-img');

    benefitImages.forEach(img => {
        img.style.cursor = 'pointer';

        eventManager.add('benefitsClick', img, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const imageUrl = img.src;
            const imageName = img.alt || 'Hình ảnh';
            _openFullscreenImage(imageUrl, imageName);
        });
    });
}

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBenefitsImageClick);
} else {
    setupBenefitsImageClick();
}
