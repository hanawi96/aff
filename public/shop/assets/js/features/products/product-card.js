// ============================================
// PRODUCT CARD COMPONENT
// ============================================

import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { calculateDiscount } from '../../shared/utils/helpers.js';
import { CONFIG, productGridUrl } from '../../shared/constants/config.js?v=9';
import { comboSavingsText, isComboAnchor } from '../combo/combo-shelf.js?v=7';

/**
 * Create product card HTML
 * @param {Object} product - Product data
 * @param {number} cardIndex - vị trí trong lưới (0-based); 6 ảnh đầu ưu tiên tải cao
 * @returns {string} HTML string
 */
export function createProductCard(product, cardIndex = 0) {
    const discount = calculateDiscount(product.original_price, product.price);
    const rating = product.rating || 4.5;
    const purchases = product.purchases || 0;
    // R2 trực tiếp — hiện ngay khi load trang (không CDN phụ thuộc domain).
    const imageUrl = productGridUrl(product.image_url || product.image || CONFIG.DEFAULT_IMAGE);
    const fetchPriority = cardIndex < 6 ? 'high' : 'auto';

    // Stock status
    const rawStock = product.stock_quantity ?? product.stockQuantity;
    const stockQty =
        rawStock === undefined || rawStock === null
            ? null
            : (typeof rawStock === 'string'
                ? parseInt(rawStock.replace(/[^\d-]/g, ''), 10)
                : Number(rawStock));
    const isOutOfStock = stockQty !== null && Number.isFinite(stockQty) && stockQty <= 0;
    
    // Check badges - only hide for "Bi, charm bạc" category (ID 24)
    // Other categories like "Hạt dâu tằm mài sẵn" and "Sản phẩm bán kèm" still show badges
    const isBiCharmBac = product.categories?.some(cat => 
        (cat.id === 24 || cat.category_id === 24)
    );
    
    // Badges are hidden - Thủ công 100% and Không hóa chất removed per user request
    const hasHandmadeBadge = false;
    const hasChemicalFreeBadge = false;
    const hasSilverBadge = isBiCharmBac; // Show "Cam kết bạc thật" badge for Bi, charm bạc category
    
    // Check if product should show "bạc thật" mini badge next to rating
    // Exclude by category: Mix hạt bồ đề (13), Mix hổ phách (16), Mix chỉ màu các loại (20), Sản phẩm bán kèm (23)
    const EXCLUDE_SILVER_MINI_BADGE_CATEGORIES = [13, 16, 20, 23];
    
    // Exclude by specific product ID: 
    // - Vòng trơn buộc mối (8)
    // - Vòng ngũ sắc mix 1 hạt dâu (26)
    // - [NGƯỜI LỚN] Vòng trơn co giãn (79)
    const EXCLUDE_SILVER_MINI_BADGE_PRODUCTS = [8, 26, 79];
    
    const hasExcludedCategory = product.categories?.some(cat => 
        EXCLUDE_SILVER_MINI_BADGE_CATEGORIES.includes(cat.id || cat.category_id)
    );
    
    const isExcludedProduct = EXCLUDE_SILVER_MINI_BADGE_PRODUCTS.includes(product.id);

    // Vòng trơn (8) / vòng co giãn (11) không phải mix bạc.
    // Các mẫu mix bạc trong hai nhóm này đều ghi chữ "bạc" trong tên.
    const categoryIds = [
        ...(product.categories || []).map(cat => Number(cat.id || cat.category_id)),
        ...(product.category_ids || []).map(id => Number(id)),
        Number(product.category_id)
    ].filter(id => Number.isFinite(id));
    const nameHasSilver = /bạc/i.test(String(product.name || ''));
    const onlyPlainLoop = categoryIds.length > 0
        && categoryIds.every(id => id === 8 || id === 11);
    const plainLoopWithoutSilver = onlyPlainLoop && !nameHasSilver;
    
    const showSilverMiniBadge = !hasExcludedCategory && !isExcludedProduct && !plainLoopWithoutSilver;
    
    const shouldShowMarketingBadges = !isOutOfStock;

    return `
        <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-product-id="${product.id}">
            <div class="product-image-wrapper">
                <div class="product-image-container">
                    <img src="${escapeHtml(imageUrl)}"
                         alt="${escapeHtml(product.name)}"
                         class="product-image"
                         width="400"
                         height="400"
                         loading="eager"
                         decoding="async"
                         fetchpriority="${fetchPriority}"
                         onclick="window.openProductDetail(${product.id})"
                         onerror="this.onerror=null;this.src='${escapeHtml(CONFIG.DEFAULT_IMAGE)}'">
                </div>
                ${isOutOfStock ? `<span class="product-badge out-of-stock">Hết hàng</span>` : ''}
                ${shouldShowMarketingBadges && discount > 0 ? `<span class="product-badge sale">-${discount}%</span>` : ''}
                ${product.string_type === 'draw' ? '<span class="product-badge string-draw">Dây nới rộng</span>' : ''}
                ${product.string_type === 'elastic' ? '<span class="product-badge string-elastic">Dây co giãn</span>' : ''}
                ${shouldShowMarketingBadges && hasHandmadeBadge ? `<span class="product-badge handmade">Thủ công 100%</span>` : ''}
                ${shouldShowMarketingBadges && hasChemicalFreeBadge ? `<span class="product-badge chemical-free">Không hóa chất</span>` : ''}
                ${shouldShowMarketingBadges && hasSilverBadge ? `<span class="product-badge silver-guarantee"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 0.875rem; height: 0.875rem; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>Bạc thật 100%</span>` : ''}
                ${shouldShowMarketingBadges ? `<span class="freeship-tag" aria-label="Đơn từ 100 nghìn được miễn phí ship"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" /><path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z" /><path d="M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" /></svg>Đơn 100k miễn ship</span>` : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name" onclick="window.openProductDetail(${product.id})" style="cursor: pointer;">${escapeHtml(product.name)}</h3>
                <div class="product-rating">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="rating-star"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" /></svg>
                    <span class="rating-score">${rating.toFixed(1)}</span>
                    <span class="rating-count">(${purchases})</span>
                    ${showSilverMiniBadge ? '<span class="silver-mini-badge"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 0.75rem; height: 0.75rem; display: inline-block; vertical-align: middle; margin-right: 0.2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>Bạc thật</span>' : ''}
                </div>
                <div class="product-price-wrapper">
                    <div class="product-price">
                        <span class="current-price">${formatPrice(product.price)}</span>
                        ${product.original_price && product.original_price > product.price 
                            ? `<span class="original-price">${formatPrice(product.original_price)}</span>` 
                            : ''}
                    </div>
                </div>
                ${!isOutOfStock && isComboAnchor(product.id) && comboSavingsText() ? `
                    <button type="button" class="product-combo-hint" onclick="window.comboShelf&&window.comboShelf.focusCard(${product.id})">
                        <span>Thêm bó dâu để phòng</span>
                        <strong>${escapeHtml(comboSavingsText())}</strong>
                    </button>
                ` : ''}
                <div class="product-button-actions">
                    <button class="bundle-btn-primary" ${isOutOfStock ? 'disabled aria-disabled="true"' : ''} onclick="window.productActions.buyNow(${product.id})" ${isOutOfStock ? 'title="Hết hàng"' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>
                        <span>Mua ngay</span>
                    </button>
                    <button class="bundle-btn-cart" ${isOutOfStock ? 'disabled aria-disabled="true"' : ''} onclick="window.productActions.addToCart(${product.id})" title="${isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

export function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Không tìm thấy sản phẩm nào.</p>';
        return;
    }

    container.innerHTML = products.map((product, index) => createProductCard(product, index)).join('');
}
