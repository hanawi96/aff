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
    
    html += '</div>'; // Close product-info
    
    // Button actions - OUTSIDE product-info for mobile grid layout
    html += '<div class="bundle-product-actions">';
    html += '<button class="bundle-btn-primary" onclick="window.flashSaleActions.buyNow(' + product.id + ', ' + product.flash_price + ')">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.125rem; height: 1.125rem; display: inline-block; vertical-align: middle;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>';
    html += '<span>Mua ngay</span>';
    html += '</button>';
    html += '<button class="bundle-btn-cart" onclick="window.flashSaleActions.addToCart(' + product.id + ', ' + product.flash_price + ')" title="Thêm vào giỏ hàng">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.25rem; height: 1.25rem; display: inline-block;"><path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0ZM12 3a3 3 0 0 0-3 3v.75h6V6a3 3 0 0 0-3-3Zm-3 8.25a3 3 0 1 0 6 0v-.75a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 1-9 0v-.75a.75.75 0 0 1 1.5 0v.75Z" clip-rule="evenodd" /></svg>';
    html += '</button>';
    html += '</div>';
    html += '</div>'; // Close product-card
    
    return html;
}
