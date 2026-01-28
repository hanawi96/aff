// ============================================
// ERROR DISPLAY SERVICE - UI error handling
// ============================================

/**
 * Error Display Service
 * Handles showing/hiding error messages in the UI
 * Manages error states, animations, and scrolling
 */
class ErrorDisplayService {
    constructor() {
        // Cache for error elements to avoid repeated DOM queries
        this.errorElementsCache = new Map();
        
        // Animation timing
        this.ANIMATION_DURATION = 200; // ms
        this.SCROLL_DURATION = 300; // ms
    }
    
    /**
     * Get or create error message element for a field
     * @param {string} fieldId - Field ID
     * @returns {HTMLElement|null} Error message element
     */
    getErrorElement(fieldId) {
        // Check cache first
        if (this.errorElementsCache.has(fieldId)) {
            return this.errorElementsCache.get(fieldId);
        }
        
        const field = document.getElementById(fieldId);
        if (!field) return null;
        
        // Look for existing error element
        let errorEl = field.parentElement?.querySelector('.error-message');
        
        // Create if doesn't exist
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.setAttribute('role', 'alert');
            errorEl.setAttribute('aria-live', 'polite');
            
            // Insert after the input
            field.parentElement?.appendChild(errorEl);
        }
        
        // Cache it
        this.errorElementsCache.set(fieldId, errorEl);
        
        return errorEl;
    }
    
    /**
     * Show error for a specific field
     * @param {string} fieldId - Field ID
     * @param {string} message - Error message
     */
    showError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorEl = this.getErrorElement(fieldId);
        
        if (!field || !errorEl) return;
        
        // Add error class to field
        field.classList.add('error');
        field.setAttribute('aria-invalid', 'true');
        
        // Add error class to parent form-group
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('has-error');
        }
        
        // Set message and show
        errorEl.textContent = message;
        errorEl.classList.add('show');
        
        // Shake animation for field
        this.shakeElement(field);
    }
    
    /**
     * Clear error for a specific field
     * @param {string} fieldId - Field ID
     */
    clearError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorEl = this.getErrorElement(fieldId);
        
        if (!field) return;
        
        // Remove error class from field
        field.classList.remove('error');
        field.removeAttribute('aria-invalid');
        
        // Remove error class from parent form-group
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('has-error');
        }
        
        // Hide error message
        if (errorEl) {
            errorEl.classList.remove('show');
            // Clear text after animation
            setTimeout(() => {
                if (!errorEl.classList.contains('show')) {
                    errorEl.textContent = '';
                }
            }, this.ANIMATION_DURATION);
        }
    }
    
    /**
     * Show multiple errors at once
     * @param {Object} errors - Object with fieldId as key and message as value
     */
    showErrors(errors) {
        for (const [fieldId, message] of Object.entries(errors)) {
            if (message) {
                this.showError(fieldId, message);
            } else {
                this.clearError(fieldId);
            }
        }
    }
    
    /**
     * Clear all errors in a form
     * @param {string} formId - Form ID or selector
     */
    clearAllErrors(formId) {
        const form = document.getElementById(formId) || document.querySelector(formId);
        if (!form) return;
        
        // Clear all error fields
        const errorFields = form.querySelectorAll('.error');
        errorFields.forEach(field => {
            this.clearError(field.id);
        });
        
        // Clear all error messages
        const errorMessages = form.querySelectorAll('.error-message.show');
        errorMessages.forEach(el => {
            el.classList.remove('show');
            setTimeout(() => {
                if (!el.classList.contains('show')) {
                    el.textContent = '';
                }
            }, this.ANIMATION_DURATION);
        });
        
        // Clear all form-group errors
        const formGroups = form.querySelectorAll('.form-group.has-error');
        formGroups.forEach(group => {
            group.classList.remove('has-error');
        });
    }
    
    /**
     * Scroll to first error field
     * @param {string} fieldId - Field ID to scroll to
     * @param {number} offset - Offset from top (default: 100px)
     */
    scrollToError(fieldId, offset = 100) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Calculate position
        const fieldRect = field.getBoundingClientRect();
        const absoluteTop = fieldRect.top + window.pageYOffset;
        const scrollTo = absoluteTop - offset;
        
        // Smooth scroll
        window.scrollTo({
            top: scrollTo,
            behavior: 'smooth'
        });
        
        // Focus field after scroll
        setTimeout(() => {
            field.focus();
            // Add highlight effect
            this.highlightElement(field);
        }, this.SCROLL_DURATION);
    }
    
    /**
     * Scroll to first error in modal
     * @param {string} fieldId - Field ID
     * @param {string} modalId - Modal container ID
     * @param {number} offset - Offset from top
     */
    scrollToErrorInModal(fieldId, modalId, offset = 20) {
        const field = document.getElementById(fieldId);
        const modal = document.getElementById(modalId);
        
        if (!field || !modal) return;
        
        // Find scrollable container
        const scrollContainer = modal.querySelector('.modal-content') || modal;
        
        // Calculate position relative to modal
        const fieldRect = field.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const relativeTop = fieldRect.top - containerRect.top + scrollContainer.scrollTop;
        
        // Smooth scroll within modal
        scrollContainer.scrollTo({
            top: relativeTop - offset,
            behavior: 'smooth'
        });
        
        // Focus field after scroll
        setTimeout(() => {
            field.focus();
            this.highlightElement(field);
        }, this.SCROLL_DURATION);
    }
    
    /**
     * Shake animation for element
     * @param {HTMLElement} element - Element to shake
     */
    shakeElement(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }
    
    /**
     * Highlight element temporarily
     * @param {HTMLElement} element - Element to highlight
     */
    highlightElement(element) {
        element.classList.add('highlight');
        setTimeout(() => {
            element.classList.remove('highlight');
        }, 1000);
    }
    
    /**
     * Setup auto-clear on input
     * Automatically clears error when user starts typing
     * @param {string} fieldId - Field ID
     */
    setupAutoClear(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Remove existing listener if any
        field.removeEventListener('input', this._handleAutoClear);
        
        // Add new listener
        const handler = () => this.clearError(fieldId);
        field.addEventListener('input', handler);
        
        // Store handler for cleanup
        field._autoClearHandler = handler;
    }
    
    /**
     * Setup auto-clear for multiple fields
     * @param {Array<string>} fieldIds - Array of field IDs
     */
    setupAutoClearForFields(fieldIds) {
        fieldIds.forEach(fieldId => this.setupAutoClear(fieldId));
    }
    
    /**
     * Clear cache (useful for dynamic forms)
     */
    clearCache() {
        this.errorElementsCache.clear();
    }
}

// Export singleton instance
export const errorDisplayService = new ErrorDisplayService();
