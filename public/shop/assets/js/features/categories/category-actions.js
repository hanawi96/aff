// ============================================
// CATEGORY ACTIONS
// ============================================

/**
 * Category Actions Handler
 */
export class CategoryActions {
    constructor(onFilterCallback) {
        this.onFilterCallback = onFilterCallback;
        this.activeCategory = null;
    }
    
    /**
     * Filter products by category
     */
    /**
     * null = Tất cả (bỏ lọc). Id danh mục luôn là số.
     */
    normalizeCategoryId(categoryId) {
        if (categoryId === 'all' || categoryId == null || categoryId === '') return null;
        const id = Number(categoryId);
        return Number.isFinite(id) ? id : null;
    }

    filterByCategory(categoryId) {
        const normalizedId = this.normalizeCategoryId(categoryId);
        console.log('Filter by category:', normalizedId);
        
        // Update active state
        this.updateActiveState(normalizedId);

        // Scroll runs in HomePage *after* ProductGrid re-renders (see filterByCategory), otherwise
        // layout height changes mid-scroll and the viewport ends up near the wrong row.

        // Trigger filter callback
        if (this.onFilterCallback) {
            this.onFilterCallback(normalizedId);
        }
    }
    
    /**
     * Update active state of category chips.
     * categoryId null chọn chip "Tất cả".
     */
    updateActiveState(categoryId) {
        const normalizedId = this.normalizeCategoryId(categoryId);
        const allChips = document.querySelectorAll('.category-chip');
        allChips.forEach(chip => {
            chip.classList.remove('active');
        });

        const key = normalizedId == null ? 'all' : normalizedId;
        const activeChip = document.querySelector(`.category-chip[data-category-id="${key}"]`);
        if (activeChip) {
            activeChip.classList.add('active');
        }
        this.activeCategory = normalizedId;
    }
}
