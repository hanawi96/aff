// ============================================
// EVENT MANAGER
// Centralized event listener management to prevent memory leaks
// ============================================

class EventManager {
    constructor() {
        this.controllers = new Map();
        this.listeners = new Map();
    }

    /**
     * Add event listener with automatic cleanup
     * @param {string} key - Unique key for this listener group
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    add(key, element, event, handler, options = {}) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        
        const listener = { element, event, handler, options };
        this.listeners.get(key).push(listener);
        element.addEventListener(event, handler, options);
    }

    /**
     * Add event listener with AbortController
     * @param {string} key - Unique key for this controller
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    addWithController(key, element, event, handler) {
        // Remove existing controller if any
        this.removeController(key);
        
        const controller = new AbortController();
        this.controllers.set(key, controller);
        
        element.addEventListener(event, handler, { signal: controller.signal });
    }

    /**
     * Remove all listeners for a key
     * @param {string} key - Unique key
     */
    remove(key) {
        const listeners = this.listeners.get(key);
        if (listeners) {
            listeners.forEach(({ element, event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            this.listeners.delete(key);
        }
    }

    /**
     * Remove controller for a key
     * @param {string} key - Unique key
     */
    removeController(key) {
        const controller = this.controllers.get(key);
        if (controller) {
            controller.abort();
            this.controllers.delete(key);
        }
    }

    /**
     * Remove all listeners and controllers
     */
    removeAll() {
        // Remove all regular listeners
        for (const key of this.listeners.keys()) {
            this.remove(key);
        }
        
        // Abort all controllers
        for (const key of this.controllers.keys()) {
            this.removeController(key);
        }
    }

    /**
     * Check if key exists
     * @param {string} key - Unique key
     * @returns {boolean}
     */
    has(key) {
        return this.listeners.has(key) || this.controllers.has(key);
    }
}

// Export singleton instance
export const eventManager = new EventManager();
