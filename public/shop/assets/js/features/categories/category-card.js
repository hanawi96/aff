// ============================================
// CATEGORY CARD COMPONENT
// ============================================

import { escapeHtml } from '../../shared/utils/formatters.js';
import { CONFIG, CATEGORY_IMAGES } from '../../shared/constants/config.js';

/**
 * Create category chip HTML (Handmade style)
 * @param {Object} category - Category data
 * @returns {string} HTML string
 */
export function createCategoryCard(category) {
    return `
        <button class="category-chip" onclick="window.categoryActions.filterByCategory(${category.id})" data-category-id="${category.id}">
            <span class="category-chip-icon">
                <i class="${category.icon || 'fas fa-gem'}"></i>
            </span>
            <span class="category-chip-name">${escapeHtml(category.name)}</span>
        </button>
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
        container.innerHTML = '<p style="text-align: center;">Đang cập nhật danh mục...</p>';
        return;
    }
    
    const activeCategories = categories
        .filter(cat => cat.is_active === 1)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    container.innerHTML = activeCategories.map(createCategoryCard).join('');
}
