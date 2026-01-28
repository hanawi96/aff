// ============================================
// VALIDATION RULES - Shared validation rules for forms
// ============================================

/**
 * Validation rules for checkout forms
 * Used by both cart page and quick checkout modal
 */
export const checkoutValidationRules = {
    // Phone number validation
    phone: {
        required: true,
        pattern: /^0\d{9}$/,
        message: 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0'
    },
    
    // Customer name validation
    name: {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-ZÀ-ỹ\s]+$/,
        message: 'Tên phải có ít nhất 2 ký tự và chỉ chứa chữ cái'
    },
    
    // Baby weight validation (conditional - only if field exists)
    babyWeight: {
        required: false, // Will be set dynamically
        pattern: /^(Chưa sinh|\d+kg)$/i,
        message: 'Cân nặng phải có dạng: 5kg, 10kg... hoặc "Chưa sinh"'
    },
    
    // Baby name validation (conditional - only if field exists)
    babyName: {
        required: false, // Will be set dynamically
        minLength: 2,
        maxLength: 50,
        message: 'Tên bé phải có ít nhất 2 ký tự'
    },
    
    // Address fields
    province: {
        required: true,
        message: 'Vui lòng chọn Tỉnh/Thành phố'
    },
    
    district: {
        required: true,
        message: 'Vui lòng chọn Quận/Huyện'
    },
    
    ward: {
        required: true,
        message: 'Vui lòng chọn Phường/Xã'
    },
    
    street: {
        required: true,
        minLength: 5,
        maxLength: 200,
        message: 'Địa chỉ cụ thể phải có ít nhất 5 ký tự'
    },
    
    // Optional fields
    note: {
        required: false,
        maxLength: 500,
        message: 'Ghi chú không được vượt quá 500 ký tự'
    }
};

/**
 * Get validation rule for a specific field
 * @param {string} fieldName - Field name
 * @returns {Object|null} Validation rule or null
 */
export function getValidationRule(fieldName) {
    return checkoutValidationRules[fieldName] || null;
}

/**
 * Update validation rule dynamically
 * @param {string} fieldName - Field name
 * @param {Object} updates - Updates to apply
 */
export function updateValidationRule(fieldName, updates) {
    if (checkoutValidationRules[fieldName]) {
        Object.assign(checkoutValidationRules[fieldName], updates);
    }
}
