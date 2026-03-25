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
    filterByCategory(categoryId) {
        console.log('Filter by category:', categoryId);
        
        // Update active state
        this.updateActiveState(categoryId);

        // Scroll runs in HomePage *after* ProductGrid re-renders (see filterByCategory), otherwise
        // layout height changes mid-scroll and the viewport ends up near the wrong row.

        // Trigger filter callback
        if (this.onFilterCallback) {
            this.onFilterCallback(categoryId);
        }
    }
    
    /**
     * Update active state of category chips
     */
    updateActiveState(categoryId) {
        // Remove active class from all chips
        const allChips = document.querySelectorAll('.category-chip');
        allChips.forEach(chip => {
            chip.classList.remove('active');
        });
        
        // Add active class to selected chip
        if (categoryId) {
            const activeChip = document.querySelector(`.category-chip[data-category-id="${categoryId}"]`);
            if (activeChip) {
                activeChip.classList.add('active');
                this.activeCategory = categoryId;
            }
        } else {
            this.activeCategory = null;
        }
    }
}
