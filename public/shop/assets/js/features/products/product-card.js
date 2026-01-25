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
    
    // Always show empty heart (far) by default
    // User can click to add favorite, no need to track state
    const heartClass = 'far';
    const favoritedClass = '';
    
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
                        <i class="${heartClass} fa-heart"></i>
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
                        <i class="fas fa-shopping-bag"></i>
                        <span>Mua ngay</span>
                    </button>
                    <button class="btn-add-to-cart" onclick="window.productActions.addToCart(${product.id})" title="Thêm vào giỏ hàng">
                        <i class="fas fa-shopping-cart"></i>
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
