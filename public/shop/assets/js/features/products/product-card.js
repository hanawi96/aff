// ============================================
// PRODUCT CARD COMPONENT
// ============================================

import { formatPrice, generateStars, escapeHtml } from '../../shared/utils/formatters.js';
import { calculateDiscount } from '../../shared/utils/helpers.js';
import { CONFIG } from '../../shared/constants/config.js';

/**
 * Create product card HTML
 * @param {Object} product - Product data
 * @returns {string} HTML string
 */
export function createProductCard(product) {
    const discount = calculateDiscount(product.original_price, product.price);
    const rating = product.rating || 4.5;
    const purchases = product.purchases || 0;
    const imageUrl = product.image_url || CONFIG.DEFAULT_IMAGE;
    const savedAmount = product.original_price && product.original_price > product.price
        ? product.original_price - product.price
        : 0;
    
    // Check badges - only hide for "Bi, charm bạc" category (ID 24)
    // Other categories like "Hạt dâu tằm mài sẵn" and "Sản phẩm bán kèm" still show badges
    const isBiCharmBac = product.categories?.some(cat => 
        (cat.id === 24 || cat.category_id === 24)
    );
    
    const hasHandmadeBadge = !isBiCharmBac && (product.is_handmade === 1 || product.tags?.includes('handmade'));
    const hasChemicalFreeBadge = !isBiCharmBac && (product.is_chemical_free === 1 || product.tags?.includes('chemical-free'));
    const hasSilverBadge = isBiCharmBac; // Show "Cam kết bạc thật" badge for Bi, charm bạc category
    
    // Check if product should show "bạc thật" mini badge next to rating
    // Exclude by category: Mix hạt bồ đề (13), Mix hổ phách (16), Mix chỉ màu các loại (20), Sản phẩm bán kèm (23)
    const EXCLUDE_SILVER_MINI_BADGE_CATEGORIES = [13, 16, 20, 23];
    
    // Exclude by specific product ID: Vòng trơn buộc mối (8)
    const EXCLUDE_SILVER_MINI_BADGE_PRODUCTS = [8];
    
    const hasExcludedCategory = product.categories?.some(cat => 
        EXCLUDE_SILVER_MINI_BADGE_CATEGORIES.includes(cat.id || cat.category_id)
    );
    
    const isExcludedProduct = EXCLUDE_SILVER_MINI_BADGE_PRODUCTS.includes(product.id);
    
    const showSilverMiniBadge = !hasExcludedCategory && !isExcludedProduct;
    
    // Check if product is favorited
    const isFavorited = product.is_favorited === 1 || product.is_favorited === true;
    const heartClass = isFavorited ? 'fas' : 'far';
    const favoritedClass = isFavorited ? 'favorited' : '';
    
    return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image-wrapper">
                <img src="${imageUrl}" 
                     alt="${escapeHtml(product.name)}" 
                     class="product-image"
                     loading="lazy"
                     onerror="this.src='${CONFIG.DEFAULT_IMAGE}'">
                ${discount > 0 ? `<span class="product-badge sale">-${discount}%</span>` : ''}
                ${hasHandmadeBadge ? `<span class="product-badge handmade">Thủ công 100%</span>` : ''}
                ${hasChemicalFreeBadge ? `<span class="product-badge chemical-free">Không hóa chất</span>` : ''}
                ${hasSilverBadge ? `<span class="product-badge silver-guarantee">Cam kết bạc thật</span>` : ''}
                <div class="product-favorites-section">
                    <button class="product-favorites-btn ${favoritedClass}" onclick="window.productActions.toggleFavorite(${product.id})" title="Yêu thích" data-product-id="${product.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" style="width: 1.125rem; height: 1.125rem;"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" /></svg>
                        <span class="favorites-count">${product.favorites_count || 0}</span>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                <div class="product-rating">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="rating-star"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" /></svg>
                    <span class="rating-score">${rating.toFixed(1)}</span>
                    <span class="rating-count">(${purchases})</span>
                    ${showSilverMiniBadge ? '<span class="silver-mini-badge">Bạc thật</span>' : ''}
                </div>
                <div class="product-price-wrapper">
                    <div class="product-price">
                        <span class="current-price">${formatPrice(product.price)}</span>
                        ${product.original_price && product.original_price > product.price 
                            ? `<span class="original-price">${formatPrice(product.original_price)}</span>` 
                            : ''}
                    </div>
                    ${savedAmount > 0 ? `
                        <div class="price-save-info">
                            <i class="fas fa-tag"></i>
                            <span>Tiết kiệm ${formatPrice(savedAmount)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="product-button-actions">
                    <button class="bundle-btn-primary" onclick="window.productActions.buyNow(${product.id})">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>
                        <span>Mua ngay</span>
                    </button>
                    <button class="bundle-btn-cart" onclick="window.productActions.addToCart(${product.id})" title="Thêm vào giỏ hàng">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render products to container
 * @param {Array} products - Array of products
 * @param {string} containerId - Container element ID
 */
export function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }
    
    if (products.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Không tìm thấy sản phẩm nào.</p>';
        return;
    }
    
    container.innerHTML = products.map(createProductCard).join('');
}
