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
    
    // Image container with eye icon (left side)
    html += '<div class="bundle-product-image-container">';
    html += '<img src="' + imageUrl + '" ';
    html += 'alt="' + escapeHtml(product.product_name) + '" ';
    html += 'class="bundle-product-image" ';
    html += 'loading="lazy" ';
    html += 'data-product-id="' + product.id + '" ';
    html += 'onclick="window.flashSaleActions.previewImage(\'' + imageUrl + '\', \'' + escapeHtml(product.product_name) + '\')" ';
    html += 'onerror="this.src=\'' + CONFIG.DEFAULT_IMAGE + '\'">';
    
    // Eye icon for image preview
    html += '<button class="bundle-image-preview-btn" onclick="window.flashSaleActions.previewImage(\'' + imageUrl + '\', \'' + escapeHtml(product.product_name) + '\'); event.stopPropagation();" title="Xem ảnh lớn">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" /></svg>';
    html += '</button>';
    html += '</div>'; // Close image-container
    
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
    html += '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>';
    html += '</button>';
    html += '</div>';
    html += '</div>'; // Close product-card
    
    return html;
}
