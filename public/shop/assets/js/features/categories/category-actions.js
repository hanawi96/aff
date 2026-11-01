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
        this._warmCategoryImages = null;
    }

    /**
     * null = Tất cả (bỏ lọc). Id danh mục luôn là số.
     */
    normalizeCategoryId(categoryId) {
        if (categoryId === 'all' || categoryId == null || categoryId === '') return null;
        const id = Number(categoryId);
        return Number.isFinite(id) ? id : null;
    }

    /**
     * Preload first-page product images when user hovers / touches a chip
     * so category switch paints from cache.
     * @param {(categoryId: number|null) => void} warmFn
     */
    setImageWarmer(warmFn) {
        this._warmCategoryImages = typeof warmFn === 'function' ? warmFn : null;
    }

    /**
     * Bind hover/touch preload on current category chips (re-call after re-render).
     */
    bindImageWarmup() {
        if (!this._warmCategoryImages) return;

        document.querySelectorAll('#categoriesGrid .category-chip').forEach((chip) => {
            if (chip.dataset.imageWarmBound === '1') return;
            chip.dataset.imageWarmBound = '1';

            const warm = () => {
                const id = this.normalizeCategoryId(chip.dataset.categoryId);
                this._warmCategoryImages(id);
            };

            chip.addEventListener('pointerenter', warm, { passive: true });
            chip.addEventListener('touchstart', warm, { passive: true });
        });
    }

    filterByCategory(categoryId) {
        const normalizedId = this.normalizeCategoryId(categoryId);
        console.log('Filter by category:', normalizedId);

        // Start warming immediately on click (covers tap without prior hover).
        if (this._warmCategoryImages) {
            this._warmCategoryImages(normalizedId);
        }

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
