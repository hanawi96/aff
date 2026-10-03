// ============================================
// IMAGE PREVIEW UTILITY - OPTIMIZED
// High-performance modal with caching and proper cleanup
// Includes: Product Detail Modal with URL sync & share
// ============================================

import { CONFIG, productThumbUrl, productDetailUrl, productZoomUrl } from '../constants/config.js?v=4';
import { MODAL_CONSTANTS } from '../constants/modal-constants.js';
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
window.openProductDetail = async function(productId, fromPopstate = false) {
    const product = _findProduct(productId);
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    const discount = _calculateDiscount(product.original_price, product.price);

    // Đồng bộ URL: CHỈ pushState khi mở từ click (thẻ SP / SP bán chạy).
    // Khi mở từ nút Back/Forward (popstate), trình duyệt ĐÃ đổi URL rồi → KHÔNG pushState nữa,
    // nếu không sẽ đẩy thêm entry trùng → kẹt history, không quay lại modal trước được.
    if (!fromPopstate) {
        const newUrl = _buildProductUrl(productId);
        window.history.pushState({ productId, fromPopstate: false }, '', newUrl);
    }

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

    // 5. Hiện modal ngay. Ảnh thẻ đã có sẵn; bản 1200px được đổi vào sau khi tải xong.
    modal.classList.add('active');
    modal.dataset.productId = product.id;
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    // Ẩn mục gợi ý cũ (tránh nhấp nháy nội dung SP trước khi build lại)
    const relatedEl = document.getElementById('relatedProducts');
    if (relatedEl) { relatedEl.style.display = 'none'; relatedEl.innerHTML = ''; }

    // 6. Setup carousel events (touch, click, keyboard)
    _setupCarouselEvents();
    _upgradeProductSlide();

    // 7. Setup action buttons
    _setupPreviewButtons(product.id);

    // 8. Add share button to header
    _setupShareButton(product);

    // 9. Gợi ý bán chạy toàn shop và bán chạy trong danh mục của SP đang xem
    _loadBestSellers(product, document.getElementById('relatedProducts'));
}

function _catalogProducts() {
    if (Array.isArray(window.allProducts)) return window.allProducts;
    if (window.productGrid && Array.isArray(window.productGrid.allProducts)) return window.productGrid.allProducts;
    if (window.App?.currentPage?.allProducts) return window.App.currentPage.allProducts;
    return [];
}

function _primaryCategory(product) {
    const cats = Array.isArray(product?.categories) ? product.categories : [];
    const primary = cats.find((c) => c && (c.is_primary === 1 || c.is_primary === true)) || cats[0];
    const id = primary?.id ?? product?.category_id;
    const name = primary?.name || product?.category_name || '';
    return { id: id != null && id !== '' ? String(id) : '', name: String(name || '') };
}

function _productInCategory(product, categoryId) {
    if (!categoryId || !product) return false;
    if (String(product.category_id) === categoryId) return true;
    if (Array.isArray(product.category_ids) && product.category_ids.some((id) => String(id) === categoryId)) return true;
    if (Array.isArray(product.categories) && product.categories.some((c) => c && String(c.id) === categoryId)) return true;
    return false;
}

function _rankBestSellers(list, currentId) {
    return list
        .filter((p) => p && p.id != null && String(p.id) !== String(currentId))
        .filter((p) => p.is_active === undefined || p.is_active === null || p.is_active === 1 || p.is_active === true)
        .sort((a, b) => (Number(b.purchases) || 0) - (Number(a.purchases) || 0));
}

function _bestSellerRows(items) {
    return items.map((p) => {
        const fullImg = p.image_url || p.image || CONFIG.DEFAULT_IMAGE;
        const img = productThumbUrl(fullImg);
        const name = p.name || 'Sản phẩm';
        const price = _formatPrice(p.price);
        const hasSale = p.original_price && p.original_price > p.price;
        const original = hasSale ? `<span class="rp-price-original">${_formatPrice(p.original_price)}</span>` : '';
        const discount = hasSale ? _calculateDiscount(p.original_price, p.price) : 0;
        const discountTag = discount > 0 ? `<span class="rp-discount">-${discount}%</span>` : '';
        const sold = Number(p.purchases) || 0;
        const soldTag = sold > 0 ? `<span class="rp-sold">Đã bán ${sold}</span>` : '';
        const rating = Number(p.rating) > 0 ? Number(p.rating) : 5;
        const ratingTag = `<span class="rp-rating" aria-label="Đánh giá ${rating.toFixed(1)}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg><span>${rating.toFixed(1)}</span></span>`;
        return `
            <div class="rp-item" role="button" tabindex="0" data-rp-id="${p.id}" aria-label="Xem ${_escAttr(name)}">
                <div class="rp-thumb">
                    <img src="${_escAttr(img)}" alt="${_escAttr(name)}" loading="lazy" decoding="async"
                         onerror="if(!this.dataset.fullTried){this.dataset.fullTried='1';this.src='${_escAttr(fullImg)}';return;}this.src='${CONFIG.DEFAULT_IMAGE}'">
                    ${discountTag}
                </div>
                <div class="rp-info">
                    <p class="rp-name">${_escHtml(name)}</p>
                    <div class="rp-price-row">
                        <span class="rp-price">${price}</span>
                        ${original}
                    </div>
                    <div class="rp-meta">${soldTag}${ratingTag}</div>
                </div>
                <button type="button" class="rp-add" data-rp-add="${p.id}" title="Thêm vào giỏ" aria-label="Thêm ${_escAttr(name)} vào giỏ">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
            </div>`;
    }).join('');
}

function _bestSellerSection(title, items) {
    return `
        <section class="rp-section">
            <h3 class="rp-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" /></svg>
                <span>${_escHtml(title)}</span>
            </h3>
            <div class="rp-list">${_bestSellerRows(items)}</div>
        </section>`;
}

/**
 * Cuối modal: 5 bán chạy toàn shop, rồi 5 bán chạy của danh mục SP đang xem.
 * @param {Object} product
 * @param {HTMLElement} container - #relatedProducts
 */
function _loadBestSellers(product, container) {
    if (!container) return;

    const list = _catalogProducts();
    if (!Array.isArray(list) || list.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const currentId = product?.id;
    const category = _primaryCategory(product);
    const categoryItems = category.id
        ? _rankBestSellers(list.filter((p) => _productInCategory(p, category.id)), currentId).slice(0, 5)
        : [];
    const keptIds = new Set(categoryItems.map((p) => String(p.id)));
    const globalItems = _rankBestSellers(list, currentId)
        .filter((p) => !keptIds.has(String(p.id)))
        .slice(0, 5);

    if (globalItems.length === 0 && categoryItems.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const sections = [];
    if (categoryItems.length) {
        const title = category.name ? `Cùng danh  mục` : 'Bán chạy cùng danh mục';
        sections.push(_bestSellerSection(title, categoryItems));
    }
    if (globalItems.length) sections.push(_bestSellerSection('Sản phẩm bán chạy', globalItems));

    container.innerHTML = sections.join('');
    container.style.display = 'block';

    // Delegation: nút "+" → thêm nhanh vào giỏ; phần còn lại của item → mở modal SP.
    eventManager.removeController('relatedProductsClick');
    eventManager.addWithController('relatedProductsClick', container, 'click', (e) => {
        // Ưu tiên nút thêm giỏ (bấm "+" KHÔNG mở modal).
        const addBtn = e.target.closest('.rp-add');
        if (addBtn) {
            e.stopPropagation();
            const addId = parseInt(addBtn.getAttribute('data-rp-add'), 10);
            if (addId && window.productActions?.addToCart) {
                window.productActions.addToCart(addId);
            }
            return;
        }
        // Bấm vào item → mở modal SP tương ứng.
        const item = e.target.closest('.rp-item');
        if (!item) return;
        const id = item.getAttribute('data-rp-id');
        if (id && typeof window.openProductDetail === 'function') {
            window.openProductDetail(parseInt(id, 10));
        }
    });
}

/** Escape cho text content. */
function _escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}
/** Escape cho thuộc tính (src/alt). */
function _escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build the image carousel: product photo first, then the six quy trình làm vòng photos.
 */
function _buildImageCarousel(product) {
    const track = document.getElementById('imageCarouselTrack');
    const dotsContainer = document.getElementById('carouselDots');
    const totalCount = document.getElementById('carouselTotalCount');
    const currentIdx = document.getElementById('carouselCurrentIdx');
    if (!track) return;

    const processBase = 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/quy-trinh-lam-vong';
    const processImages = _processImageLabels.map((label, i) => ({
        url: `${processBase}/${i + 1}.webp`,
        fullUrl: `${processBase}/${i + 1}.webp`,
        alt: label,
        label,
        type: 'process'
    }));
    const fullProductUrl = product.image_url || CONFIG.DEFAULT_IMAGE;
    const images = [
        {
            url: productThumbUrl(fullProductUrl),
            detailUrl: productDetailUrl(fullProductUrl),
            fullUrl: productZoomUrl(fullProductUrl),
            alt: product.name || 'Sản phẩm',
            label: 'Sản phẩm',
            type: 'product'
        },
        ...processImages
    ].map((img, index) => ({ ...img, index }));

    _carouselState.images = images;
    _carouselState.currentIndex = 0;

    // Build slides HTML
    track.innerHTML = images.map((img, idx) => `
        <div class="image-carousel-slide" data-index="${idx}" data-type="${img.type}">
            <img src="${img.url}"
                 alt="${img.alt}"
                 ${img.detailUrl ? `data-detail-url="${img.detailUrl}"` : ''}
                 data-image-url="${img.fullUrl || img.url}"
                 data-image-name="${img.alt}"
                 loading="${idx === 0 ? 'eager' : 'lazy'}"
                 decoding="${idx === 0 ? 'sync' : 'async'}"
                 ${idx === 0 ? 'fetchpriority="high"' : ''}
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

/** Đổi ảnh sản phẩm trong modal từ bản thẻ sang bản 960px sau khi đã giải mã, không chặn lúc mở. */
function _upgradeProductSlide() {
    const img = document.querySelector('#imageCarouselTrack .image-carousel-slide[data-index="0"] img');
    const detailUrl = img?.dataset.detailUrl || '';
    if (!img || !detailUrl || img.getAttribute('src') === detailUrl) return;

    const apply = () => {
        if (!img.isConnected || img.dataset.detailUrl !== detailUrl) return;
        img.src = detailUrl;
    };
    const pre = new Image();
    pre.onload = apply;
    pre.src = detailUrl;
    if (pre.decode) pre.decode().then(apply).catch(() => {});
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
            if (processLabel) processLabel.textContent = currentImg.label;
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

    const kicker = document.getElementById('productCollectionLabel');
    if (kicker) {
        const categoryName = _primaryCategory(product).name.trim();
        kicker.textContent = (categoryName || 'Vòng dâu tằm by Ánh').toLocaleUpperCase('vi-VN');
    }

    // Rating + đã bán
    const rating = (product.rating && product.rating > 0) ? product.rating : 5.0;
    const purchases = product.purchases || 0;
    const starSvg = `<svg class="pd-meta-star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>`;

    section.innerHTML = `
        <div class="pd-meta">
            <span class="pd-rating">
                ${starSvg}
                <span class="pd-rating-score">${rating.toFixed(1)}</span>
            </span>
            ${purchases > 0 ? `<span class="pd-dot" aria-hidden="true"></span><span class="pd-sold">Đã bán ${purchases}</span>` : ''}
            ${isOutOfStock ? `<span class="pd-oos">Hết hàng</span>` : ''}
        </div>
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
        // Back/Forward tới 1 URL sản phẩm → mở lại modal SP đó, KHÔNG pushState (fromPopstate=true).
        window.openProductDetail(parseInt(productId, 10), true);
    } else {
        // Back về URL sạch → đóng modal.
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
// QUY TRINH PROCESS IMAGES - CLICK TO FULLSCREEN
// ============================================

function setupQuyTrinhImageClick() {
    const processImages = document.querySelectorAll('.quy-trinh-lam img');

    processImages.forEach(img => {
        img.style.cursor = 'pointer';

        eventManager.add('quyTrinhClick', img, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const imageUrl = img.dataset.full || img.src;
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
    const benefitImages = document.querySelectorAll('.benefit-card-img, .fake-warn-img, .real-vong-img');

    benefitImages.forEach(img => {
        img.style.cursor = 'pointer';

        eventManager.add('benefitsClick', img, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const imageUrl = img.dataset.full || img.src;
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
