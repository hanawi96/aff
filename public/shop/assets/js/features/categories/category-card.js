// ============================================
// CATEGORY CARD COMPONENT
// ============================================

import { escapeHtml } from '../../shared/utils/formatters.js';
import { CATEGORY_IMAGES } from '../../shared/constants/config.js';

/**
 * Create category chip HTML (Handmade style)
 * @param {Object} category - Category data
 * @returns {string} HTML string
 */
export function createCategoryCard(category, index = 0) {
    const popularBadge = category.is_featured === 1 || category.is_featured === true
        ? '<span class="category-chip-badge">Phổ biến</span>'
        : '';

    const fromDb = category.image_url && String(category.image_url).trim()
        ? String(category.image_url).trim()
        : '';
    const fallbackStatic = CATEGORY_IMAGES[category.name] || '';
    const fallbackUrl = fromDb || fallbackStatic;
    // Ảnh 64px cùng nguồn, khoảng 1 KB. Ảnh gốc trên R2 chỉ dùng khi file nhỏ chưa có.
    const thumbUrl = `assets/images/category-thumbs/${category.id}.webp`;
    const priorityAttr = index < 6 ? ' fetchpriority="high"' : '';
    const fallbackAttr = fallbackUrl
        ? ` data-fallback="${escapeHtml(fallbackUrl)}" onerror="if(this.dataset.fallback){this.onerror=null;this.src=this.dataset.fallback}"`
        : '';
    const iconMarkup = `<img src="${thumbUrl}" alt="" class="category-chip-thumb" width="32" height="32" loading="eager" decoding="async"${priorityAttr}${fallbackAttr}>`;

    return `
        <button class="category-chip" onclick="window.categoryActions.filterByCategory(${category.id})" data-category-id="${category.id}">
            <span class="category-chip-icon">
                ${iconMarkup}
            </span>
            <span class="category-chip-name">${escapeHtml(category.name)}</span>
            ${popularBadge}
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
    
    container.innerHTML = activeCategories.map((cat, i) => createCategoryCard(cat, i)).join('');
}
