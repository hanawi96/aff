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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                </svg>
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
        // Container not ready yet - silently return
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
