// ============================================
// VALIDATION SERVICE - Pure validation logic
// ============================================

/**
 * Validation Service
 * Pure functions for validating form fields
 * No DOM manipulation - only validation logic
 */
class ValidationService {
    /**
     * Validate a single field value against a rule
     * @param {string} value - Field value
     * @param {Object} rule - Validation rule
     * @returns {Object} { isValid: boolean, message: string|null }
     */
    validateField(value, rule) {
        // Skip validation if field is optional and empty
        if (!rule.required && (!value || value.trim() === '')) {
            return { isValid: true, message: null };
        }
        
        // Required check
        if (rule.required && (!value || value.trim() === '')) {
            return { 
                isValid: false, 
                message: rule.message || 'Trường này là bắt buộc' 
            };
        }
        
        const trimmedValue = value.trim();
        
        // Min length check
        if (rule.minLength && trimmedValue.length < rule.minLength) {
            return { 
                isValid: false, 
                message: rule.message || `Phải có ít nhất ${rule.minLength} ký tự` 
            };
        }
        
        // Max length check
        if (rule.maxLength && trimmedValue.length > rule.maxLength) {
            return { 
                isValid: false, 
                message: rule.message || `Không được vượt quá ${rule.maxLength} ký tự` 
            };
        }
        
        // Pattern check
        if (rule.pattern && !rule.pattern.test(trimmedValue)) {
            return { 
                isValid: false, 
                message: rule.message || 'Định dạng không hợp lệ' 
            };
        }
        
        // Custom validator
        if (rule.validator && typeof rule.validator === 'function') {
            const result = rule.validator(trimmedValue);
            if (result !== true) {
                return { 
                    isValid: false, 
                    message: typeof result === 'string' ? result : rule.message 
                };
            }
        }
        
        return { isValid: true, message: null };
    }
    
    /**
     * Validate multiple fields
     * @param {Object} formData - Object with field names as keys and values
     * @param {Object} rules - Validation rules object
     * @returns {Object} { isValid: boolean, errors: Object, firstErrorField: string|null }
     */
    validateForm(formData, rules) {
        const errors = {};
        let firstErrorField = null;
        
        // Validate each field
        for (const [fieldName, rule] of Object.entries(rules)) {
            const value = formData[fieldName];
            const result = this.validateField(value, rule);
            
            if (!result.isValid) {
                errors[fieldName] = result.message;
                if (!firstErrorField) {
                    firstErrorField = fieldName;
                }
            } else {
                errors[fieldName] = null;
            }
        }
        
        const isValid = Object.values(errors).every(error => error === null);
        
        return {
            isValid,
            errors,
            firstErrorField
        };
    }
    
    /**
     * Get form data from DOM elements
     * @param {string} formId - Form ID or selector
     * @param {Array<string>} fieldNames - Array of field names to extract
     * @returns {Object} Form data object
     */
    getFormData(formId, fieldNames) {
        const formData = {};
        
        for (const fieldName of fieldNames) {
            const element = document.getElementById(fieldName);
            if (element) {
                formData[fieldName] = element.value || '';
            } else {
                formData[fieldName] = '';
            }
        }
        
        return formData;
    }
    
    /**
     * Sanitize input value
     * @param {string} value - Input value
     * @param {string} type - Input type (text, phone, etc.)
     * @returns {string} Sanitized value
     */
    sanitize(value, type = 'text') {
        if (!value) return '';
        
        let sanitized = value.trim();
        
        switch (type) {
            case 'phone':
                // Remove all non-digits
                sanitized = sanitized.replace(/\D/g, '');
                break;
            case 'name':
                // Remove special characters, keep Vietnamese
                sanitized = sanitized.replace(/[^a-zA-ZÀ-ỹ\s]/g, '');
                break;
            case 'number':
                // Keep only digits
                sanitized = sanitized.replace(/\D/g, '');
                break;
            default:
                // Basic sanitization
                sanitized = sanitized.replace(/[<>]/g, '');
        }
        
        return sanitized;
    }
}

// Export singleton instance
export const validationService = new ValidationService();
