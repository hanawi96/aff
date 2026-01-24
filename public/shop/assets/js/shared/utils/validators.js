// ============================================
// VALIDATORS - Form Validation
// ============================================

import { CONFIG } from '../constants/config.js';

export function validatePhone(phone) {
    return CONFIG.PHONE_REGEX.test(phone);
}

export function validateRequired(value) {
    return value && value.trim().length > 0;
}

export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validateCheckoutForm(formData) {
    const errors = [];
    
    if (!validateRequired(formData.phone)) {
        errors.push({ field: 'phone', message: 'Vui lòng nhập số điện thoại' });
    } else if (!validatePhone(formData.phone)) {
        errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ' });
    }
    
    if (!validateRequired(formData.name)) {
        errors.push({ field: 'name', message: 'Vui lòng nhập họ và tên' });
    }
    
    if (!validateRequired(formData.address)) {
        errors.push({ field: 'address', message: 'Vui lòng nhập địa chỉ giao hàng' });
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}
