// ============================================
// MATERIALS CACHE MANAGER
// Efficient caching system for product materials
// ============================================

import { MODAL_CONSTANTS } from '../constants/modal-constants.js';

class MaterialsCache {
    constructor() {
        this.cache = new Map();
        this.timestamps = new Map();
    }

    /**
     * Get materials from cache
     * @param {number} productId - Product ID
     * @returns {Object|null} Cached materials or null
     */
    get(productId) {
        const cached = this.cache.get(productId);
        const timestamp = this.timestamps.get(productId);
        
        if (!cached || !timestamp) {
            return null;
        }
        
        // Check if cache is still valid
        const now = Date.now();
        if (now - timestamp > MODAL_CONSTANTS.MATERIALS_CACHE_TTL) {
            this.delete(productId);
            return null;
        }
        
        return cached;
    }

    /**
     * Set materials in cache
     * @param {number} productId - Product ID
     * @param {Object} materials - Materials data
     */
    set(productId, materials) {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= MODAL_CONSTANTS.MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            this.delete(oldestKey);
        }
        
        this.cache.set(productId, materials);
        this.timestamps.set(productId, Date.now());
    }

    /**
     * Delete materials from cache
     * @param {number} productId - Product ID
     */
    delete(productId) {
        this.cache.delete(productId);
        this.timestamps.delete(productId);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }

    /**
     * Get cache size
     * @returns {number} Number of cached items
     */
    size() {
        return this.cache.size;
    }
}

// Export singleton instance
export const materialsCache = new MaterialsCache();
