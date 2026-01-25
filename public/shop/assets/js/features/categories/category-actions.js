// ============================================
// CATEGORY ACTIONS
// ============================================

import { scrollToElement } from '../../shared/utils/helpers.js';

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
        
        // Scroll to products section
        scrollToElement('#products');
        
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
