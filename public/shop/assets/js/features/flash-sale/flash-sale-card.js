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
    
    // Image with badge
    html += '<div class="product-image-wrapper">';
    html += '<img src="' + imageUrl + '" ';
    html += 'alt="' + escapeHtml(product.product_name) + '" class="product-image" ';
    html += 'loading="lazy" ';
    html += 'onerror="this.src=\'' + CONFIG.DEFAULT_IMAGE + '\'">';
    html += '<span class="flash-badge">-' + discount + '%</span>';
    html += '</div>';
    
    // Product info
    html += '<div class="product-info">';
    
    // Name
    html += '<h3 class="flash-product-name">' + escapeHtml(product.product_name) + '</h3>';
    
    // Price - NEW LAYOUT
    html += '<div class="flash-price-box">';
    // Row 1: Flash price (left) | Original price (right, close together)
    html += '<div class="flash-price-row">';
    html += '<span class="flash-price-main">' + formatPrice(product.flash_price) + '</span>';
    html += '<span class="flash-price-old">' + formatPrice(product.original_price) + '</span>';
    html += '</div>';
    // Row 2: Savings
    html += '<div class="flash-save">';
    html += 'Tiết kiệm ' + formatPrice(savedAmount);
    html += '</div>';
    html += '</div>';
    
    // Stock
    html += '<div class="flash-stock">';
    html += '<div class="flash-stock-bar">';
    html += '<div class="flash-stock-fill" style="width: ' + soldPercentage + '%"></div>';
    html += '</div>';
    html += '<div class="flash-stock-text">';
    html += '<span>Đã bán ' + soldCount + '</span>';
    html += '<span>Còn ' + remaining + '</span>';
    html += '</div>';
    html += '</div>';
    
    // Button
    html += '<button class="flash-btn" onclick="window.flashSaleActions.buyNow(' + product.id + ', ' + product.flash_price + ')">';
    html += '<i class="fas fa-shopping-cart"></i> THÊM GIỎ';
    html += '</button>';
    
    html += '</div>';
    html += '</div>';
    
    return html;
}
