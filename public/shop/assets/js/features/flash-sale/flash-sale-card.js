// ============================================
// FLASH SALE CARD COMPONENT
// ============================================

import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { CONFIG } from '../../shared/constants/config.js';

/**
 * Create flash sale card HTML - Bundle Offer Style
 * @param {Object} product - Flash sale product data
 * @returns {string} HTML string
 */
export function createFlashSaleCard(product) {
    const discount = Math.round(((product.original_price - product.flash_price) / product.original_price) * 100);
    const savedAmount = product.original_price - product.flash_price;
    const imageUrl = product.image_url || CONFIG.DEFAULT_IMAGE;
    
    // Bundle offer style HTML
    let html = '<div class="bundle-product-card">';
    
    // Image (left side)
    html += '<img src="' + imageUrl + '" ';
    html += 'alt="' + escapeHtml(product.product_name) + '" ';
    html += 'class="bundle-product-image" ';
    html += 'loading="lazy" ';
    html += 'onerror="this.src=\'' + CONFIG.DEFAULT_IMAGE + '\'">';
    
    // Product info (right side)
    html += '<div class="bundle-product-info">';
    
    // Name
    html += '<div class="bundle-product-name">' + escapeHtml(product.product_name) + '</div>';
    
    // Pricing
    html += '<div class="bundle-product-pricing">';
    html += '<div class="bundle-original-price">' + formatPrice(product.original_price) + '</div>';
    html += '<div class="bundle-price">' + formatPrice(product.flash_price) + '</div>';
    html += '<div class="bundle-discount-badge">-' + discount + '%</div>';
    html += '</div>';
    
    // Add button
    html += '<button class="bundle-add-btn" onclick="window.flashSaleActions.buyNow(' + product.id + ', ' + product.flash_price + ')">';
    html += '<i class="fas fa-plus-circle"></i>';
    html += '<span>Thêm ngay</span>';
    html += '</button>';
    
    html += '</div>'; // Close product-info
    html += '</div>'; // Close product-card
    
    return html;
}
