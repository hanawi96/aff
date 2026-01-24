// ============================================
// FLASH SALE CARD COMPONENT
// ============================================

import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { CONFIG } from '../../shared/constants/config.js';

/**
 * Create flash sale card HTML
 * @param {Object} product - Flash sale product data
 * @returns {string} HTML string
 */
export function createFlashSaleCard(product) {
    const discount = Math.round(((product.original_price - product.flash_price) / product.original_price) * 100);
    
    // Stock info
    const stockLimit = product.stock_limit || 50;
    const soldCount = product.sold_count || 0;
    const remaining = stockLimit - soldCount;
    const soldPercentage = Math.min((soldCount / stockLimit) * 100, 100);
    
    const savedAmount = product.original_price - product.flash_price;
    const imageUrl = product.image_url || CONFIG.DEFAULT_IMAGE;
    
    let html = '<div class="flash-sale-card">';
    
    // Image
    html += '<div class="product-image-wrapper">';
    html += '<img src="' + imageUrl + '" ';
    html += 'alt="' + escapeHtml(product.product_name) + '" class="product-image" ';
    html += 'loading="lazy" ';
    html += 'onerror="this.src=\'' + CONFIG.DEFAULT_IMAGE + '\'">';
    html += '<span class="flash-sale-badge">-' + discount + '%</span>';
    html += '</div>';
    
    // Info
    html += '<div class="product-info">';
    
    // Product name
    html += '<h3 class="product-name">' + escapeHtml(product.product_name) + '</h3>';
    
    // Price section
    html += '<div class="flash-sale-price-section">';
    html += '<div class="price-row">';
    html += '<span class="flash-price">' + formatPrice(product.flash_price) + '</span>';
    html += '<span class="save-badge">-' + formatPrice(savedAmount) + '</span>';
    html += '</div>';
    html += '<span class="original-price">' + formatPrice(product.original_price) + '</span>';
    html += '</div>';
    
    // Stock section
    html += '<div class="flash-stock-section">';
    html += '<div class="stock-info-row">';
    html += '<span class="stock-sold">Đã bán ' + soldCount + '/' + stockLimit + '</span>';
    html += '<span class="stock-remaining">Còn ' + remaining + '</span>';
    html += '</div>';
    html += '<div class="stock-bar">';
    html += '<div class="stock-bar-fill" style="width: ' + soldPercentage + '%"></div>';
    html += '</div>';
    html += '</div>';
    
    // Action buttons
    html += '<div class="flash-actions">';
    html += '<button class="flash-add-cart" onclick="window.flashSaleActions.addToCart(' + product.id + ', ' + product.flash_price + ')">';
    html += '<i class="fas fa-shopping-cart"></i>';
    html += '</button>';
    html += '<button class="flash-buy-btn" onclick="window.flashSaleActions.buyNow(' + product.id + ', ' + product.flash_price + ')">';
    html += '<i class="fas fa-bolt"></i>';
    html += '<span>MUA NGAY</span>';
    html += '</button>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    return html;
}
