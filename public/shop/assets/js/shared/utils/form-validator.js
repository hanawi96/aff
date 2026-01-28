// ============================================
// FORM VALIDATOR - Wrapper combining validation + error display
// ============================================

import { validationService } from '../services/validation.service.js';
import { errorDisplayService } from '../services/error-display.service.js';

/**
 * Form Validator
 * High-level wrapper that combines validation logic and error display
 * Easy to use for any form
 */
export class FormValidator {
    /**
     * @param {Object} config - Configuration
     * @param {string} config.formId - Form ID
     * @param {Object} config.rules - Validation rules
     * @param {number} config.scrollOffset - Scroll offset for error (default: 100)
     * @param {boolean} config.isModal - Is this a modal form? (default: false)
     * @param {string} config.modalId - Modal container ID (if isModal = true)
     * @param {boolean} config.autoClear - Auto clear errors on input (default: true)
     * @param {Function} config.onValidationComplete - Callback after validation
     */
    constructor(config) {
        this.formId = config.formId;
        this.rules = config.rules;
        this.scrollOffset = config.scrollOffset || 100;
        this.isModal = config.isModal || false;
        this.modalId = config.modalId || null;
        this.autoClear = config.autoClear !== false; // default true
        this.onValidationComplete = config.onValidationComplete || null;
        
        // Get field names from rules
        this.fieldNames = Object.keys(this.rules);
        
        // Setup auto-clear if enabled
        if (this.autoClear) {
            this.setupAutoClear();
        }
    }
    
    /**
     * Validate the form
     * @returns {Object} { isValid: boolean, errors: Object, firstErrorField: string|null }
     */
    validate() {
        // Get form data
        const formData = validationService.getFormData(this.formId, this.fieldNames);
        
        // Validate
        const result = validationService.validateForm(formData, this.rules);
        
        // Display errors
        if (!result.isValid) {
            errorDisplayService.showErrors(result.errors);
            
            // Scroll to first error
            if (result.firstErrorField) {
                if (this.isModal && this.modalId) {
                    errorDisplayService.scrollToErrorInModal(
                        result.firstErrorField, 
                        this.modalId, 
                        this.scrollOffset
                    );
                } else {
                    errorDisplayService.scrollToError(
                        result.firstErrorField, 
                        this.scrollOffset
                    );
                }
            }
        } else {
            // Clear all errors if valid
            errorDisplayService.clearAllErrors(this.formId);
        }
        
        // Callback
        if (this.onValidationComplete) {
            this.onValidationComplete(result);
        }
        
        return result;
    }
    
    /**
     * Validate a single field
     * @param {string} fieldName - Field name
     * @returns {Object} { isValid: boolean, message: string|null }
     */
    validateField(fieldName) {
        const rule = this.rules[fieldName];
        if (!rule) return { isValid: true, message: null };
        
        const field = document.getElementById(fieldName);
        if (!field) return { isValid: true, message: null };
        
        const result = validationService.validateField(field.value, rule);
        
        // Display error if invalid
        if (!result.isValid) {
            errorDisplayService.showError(fieldName, result.message);
        } else {
            errorDisplayService.clearError(fieldName);
        }
        
        return result;
    }
    
    /**
     * Clear all errors
     */
    clearErrors() {
        errorDisplayService.clearAllErrors(this.formId);
    }
    
    /**
     * Clear error for specific field
     * @param {string} fieldName - Field name
     */
    clearFieldError(fieldName) {
        errorDisplayService.clearError(fieldName);
    }
    
    /**
     * Setup auto-clear on input
     */
    setupAutoClear() {
        errorDisplayService.setupAutoClearForFields(this.fieldNames);
    }
    
    /**
     * Update validation rules dynamically
     * @param {string} fieldName - Field name
     * @param {Object} updates - Rule updates
     */
    updateRule(fieldName, updates) {
        if (this.rules[fieldName]) {
            Object.assign(this.rules[fieldName], updates);
        }
    }
    
    /**
     * Add new field to validation
     * @param {string} fieldName - Field name
     * @param {Object} rule - Validation rule
     */
    addField(fieldName, rule) {
        this.rules[fieldName] = rule;
        this.fieldNames.push(fieldName);
        
        if (this.autoClear) {
            errorDisplayService.setupAutoClear(fieldName);
        }
    }
    
    /**
     * Remove field from validation
     * @param {string} fieldName - Field name
     */
    removeField(fieldName) {
        delete this.rules[fieldName];
        this.fieldNames = this.fieldNames.filter(name => name !== fieldName);
        errorDisplayService.clearError(fieldName);
    }
    
    /**
     * Get form data
     * @returns {Object} Form data
     */
    getFormData() {
        return validationService.getFormData(this.formId, this.fieldNames);
    }
    
    /**
     * Sanitize field value
     * @param {string} fieldName - Field name
     * @param {string} type - Sanitization type
     */
    sanitizeField(fieldName, type = 'text') {
        const field = document.getElementById(fieldName);
        if (!field) return;
        
        field.value = validationService.sanitize(field.value, type);
    }
    
    /**
     * Reset form and clear all errors
     */
    reset() {
        this.clearErrors();
        const form = document.getElementById(this.formId);
        if (form && form.reset) {
            form.reset();
        }
    }
    
    /**
     * Destroy validator and cleanup
     */
    destroy() {
        this.clearErrors();
        errorDisplayService.clearCache();
    }
}
