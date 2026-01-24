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
    }
    
    /**
     * Filter products by category
     */
    filterByCategory(categoryId) {
        console.log('Filter by category:', categoryId);
        
        // Scroll to products section
        scrollToElement('#products');
        
        // Trigger filter callback
        if (this.onFilterCallback) {
            this.onFilterCallback(categoryId);
        }
        
        // TODO: Implement actual filtering
    }
}
