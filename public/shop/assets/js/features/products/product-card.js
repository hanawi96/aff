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
    
    return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image-wrapper">
                <img src="${imageUrl}" 
                     alt="${escapeHtml(product.name)}" 
                     class="product-image"
                     onerror="this.src='${CONFIG.DEFAULT_IMAGE}'">
                ${discount > 0 ? `<span class="product-badge sale">-${discount}%</span>` : ''}
                ${hasHandmadeBadge ? `<span class="product-badge handmade">Thủ công 100%</span>` : ''}
                ${hasChemicalFreeBadge ? `<span class="product-badge chemical-free">Không hóa chất</span>` : ''}
                <div class="product-hover-actions">
                    <button class="product-action-btn" onclick="window.productActions.quickView(${product.id})" title="Xem nhanh">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="product-action-btn" onclick="window.productActions.addToWishlist(${product.id})" title="Yêu thích">
                        <i class="far fa-heart"></i>
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
                <div class="product-buy-actions">
                    <button class="btn-add-cart" onclick="window.productActions.addToCart(${product.id})">
                        <i class="fas fa-shopping-cart"></i>
                        <span>Thêm giỏ</span>
                    </button>
                    <button class="btn-buy-now" onclick="window.productActions.buyNow(${product.id})">
                        <i class="fas fa-bolt"></i>
                        <span>Mua ngay</span>
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
