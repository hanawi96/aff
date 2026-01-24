// ============================================
// CATEGORY CARD COMPONENT
// ============================================

import { escapeHtml } from '../../shared/utils/formatters.js';
import { CONFIG, CATEGORY_IMAGES } from '../../shared/constants/config.js';

/**
 * Create category card HTML
 * @param {Object} category - Category data
 * @returns {string} HTML string
 */
export function createCategoryCard(category) {
    const imageUrl = CATEGORY_IMAGES[category.name] 
        ? `${CONFIG.R2_BASE_URL}${CATEGORY_IMAGES[category.name]}`
        : CONFIG.DEFAULT_IMAGE;
    
    // TODO: Get actual product count
    const productCount = Math.floor(Math.random() * 20) + 5;
    
    return `
        <div class="category-card" onclick="window.categoryActions.filterByCategory(${category.id})">
            <div class="category-image-wrapper">
                <img src="${imageUrl}" 
                     alt="${escapeHtml(category.name)}" 
                     class="category-image"
                     onerror="this.src='${CONFIG.DEFAULT_IMAGE}'">
                <div class="category-overlay"></div>
                <div class="category-icon">
                    <i class="${category.icon || 'fas fa-gem'}"></i>
                </div>
            </div>
            <div class="category-info">
                <h3 class="category-name">${escapeHtml(category.name)}</h3>
                <p class="category-count">
                    <i class="fas fa-box"></i>
                    ${productCount} sản phẩm
                </p>
            </div>
        </div>
    `;
}

/**
 * Render categories to container
 * @param {Array} categories - Array of categories
 * @param {string} containerId - Container element ID
 */
export function renderCategories(categories, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }
    
    if (categories.length === 0) {
        container.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Đang cập nhật danh mục...</p>';
        return;
    }
    
    const activeCategories = categories
        .filter(cat => cat.is_active === 1)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    container.innerHTML = activeCategories.map(createCategoryCard).join('');
}
