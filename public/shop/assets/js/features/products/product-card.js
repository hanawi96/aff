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
    
    // Check badges
    const hasHandmadeBadge = product.is_handmade === 1 || product.tags?.includes('handmade');
    const hasChemicalFreeBadge = product.is_chemical_free === 1 || product.tags?.includes('chemical-free');
    
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
                    <div class="stars">
                        ${generateStars(rating)}
                    </div>
                    <span class="rating-count">(${purchases})</span>
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
                    <button class="btn-primary-action" onclick="window.productActions.buyNow(${product.id})">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>
                        <span>Mua ngay</span>
                    </button>
                    <button class="btn-add-to-cart" onclick="window.productActions.addToCart(${product.id})" title="Thêm vào giỏ hàng">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.25rem; height: 1.25rem; display: inline-block;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>
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
