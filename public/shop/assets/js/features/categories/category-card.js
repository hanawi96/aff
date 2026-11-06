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
const ALL_CATEGORY_ICON = `<span class="category-chip-all-mark" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4.75A.75.75 0 0 1 4.75 4h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-.75.75h-5.5A.75.75 0 0 1 4 10.25v-5.5Zm9 0a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-5.5ZM4.75 13a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75h-5.5Zm9 0a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75h-5.5Z"/></svg></span>`;

/** Chip "Tất cả": bỏ lọc danh mục, về danh sách mặc định. */
export function createAllCategoriesChip() {
    return `
        <button type="button" class="category-chip" onclick="window.categoryActions.filterByCategory(null)" data-category-id="all">
            <span class="category-chip-icon">${ALL_CATEGORY_ICON}</span>
            <span class="category-chip-name">Tất cả mẫu</span>
        </button>
    `;
}

export function createCategoryCard(category, index = 0) {
    const popularBadge = category.is_featured === 1 || category.is_featured === true
        ? `<span class="category-chip-badge" aria-label="Phổ biến">
                <svg class="category-chip-badge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 1.75c.28 0 .52.17.62.43l1.48 3.72a1.5 1.5 0 0 0 .9.9l3.72 1.48c.26.1.43.34.43.62s-.17.52-.43.62l-3.72 1.48a1.5 1.5 0 0 0-.9.9l-1.48 3.72a.67.67 0 0 1-1.24 0l-1.48-3.72a1.5 1.5 0 0 0-.9-.9L3.9 9.52A.67.67 0 0 1 3.9 8.28l3.72-1.48a1.5 1.5 0 0 0 .9-.9L10 2.18c.1-.26.34-.43.62-.43Z"/>
                </svg>
                <span class="category-chip-badge-text">Phổ biến</span>
           </span>`
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

function _isProductOutOfStock(product) {
    const raw = product?.stock_quantity ?? product?.stockQuantity;
    if (raw === undefined || raw === null || raw === '') return false;
    const qty = typeof raw === 'string'
        ? parseInt(String(raw).replace(/[^\d-]/g, ''), 10)
        : Number(raw);
    return Number.isFinite(qty) && qty <= 0;
}

function _productBelongsToCategory(product, categoryId) {
    const id = Number(categoryId);
    if (!Number.isFinite(id) || !product) return false;
    if (Array.isArray(product.categories)) {
        if (product.categories.some((cat) => Number(cat.id || cat.category_id) === id)) return true;
    }
    if (product.category_id != null && Number(product.category_id) === id) return true;
    if (Array.isArray(product.category_ids)) {
        if (product.category_ids.some((cid) => Number(cid) === id)) return true;
    }
    return false;
}

/** Danh mục còn ít nhất 1 SP đang bán (không tính hết hàng). */
export function categoryHasSellableProduct(categoryId, products) {
    if (!Array.isArray(products) || products.length === 0) return false;
    return products.some(
        (product) => _productBelongsToCategory(product, categoryId) && !_isProductOutOfStock(product)
    );
}

/**
 * Render categories to container
 * @param {Array} categories - Array of categories
 * @param {string} containerId - Container element ID
 * @param {Array|null} products - Nếu có: ẩn danh mục không còn SP bán được
 */
export function renderCategories(categories, containerId, products = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        // Container not ready yet - silently return
        return;
    }
    
    if (categories.length === 0) {
        container.innerHTML = '<p style="text-align: center;">Đang cập nhật danh mục...</p>';
        return;
    }
    
    // Bắt buộc có catalog SP trước khi hiện chip — không bao giờ render full rồi mới ẩn.
    const hasProductCatalog = Array.isArray(products) && products.length > 0;
    if (!hasProductCatalog) {
        container.innerHTML = '';
        return;
    }

    const activeCategories = categories
        .filter((cat) => cat.is_active === 1 || cat.is_active === true)
        .filter((cat) => categoryHasSellableProduct(cat.id, products))
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    container.innerHTML = createAllCategoriesChip()
        + activeCategories.map((cat, i) => createCategoryCard(cat, i)).join('');
}
