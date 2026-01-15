// Orders Utility Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility

// ============================================
// DEBOUNCE
// ============================================

/**
 * Debounce function - delays execution until after wait milliseconds
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// CLIPBOARD
// ============================================

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy: ' + text);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// ============================================
// HTML & TEXT FORMATTING
// ============================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format number as Vietnamese currency
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string (e.g., "100.000đ")
 */
function formatCurrency(amount) {
    // Handle invalid values
    if (amount === null || amount === undefined || isNaN(amount)) return '0đ';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0đ';

    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(numAmount);
}

// ============================================
// WEIGHT/SIZE FORMATTING
// ============================================

/**
 * Format weight/size value with proper unit
 * @param {string|number} value - Weight or size value
 * @returns {string} Formatted value with unit (e.g., "5kg", "100g")
 */
function formatWeightSize(value) {
    if (!value) return '';
    let str = String(value).trim();

    // Loại bỏ khoảng trắng thừa: "5 kg" -> "5kg"
    str = str.replace(/\s+/g, '');

    // Nếu chỉ là số thuần túy (không có chữ cái) thì thêm "kg"
    if (/^\d+(\.\d+)?$/.test(str)) {
        return str + 'kg';
    }

    // Chuẩn hóa các đơn vị phổ biến
    str = str
        .replace(/^(\d+(\.\d+)?)g$/i, '$1g')           // "5g" -> "5g"
        .replace(/^(\d+(\.\d+)?)kg$/i, '$1kg')         // "5kg" -> "5kg"
        .replace(/^(\d+(\.\d+)?)cm$/i, '$1cm')         // "5cm" -> "5cm"
        .replace(/^(\d+(\.\d+)?)mm$/i, '$1mm')         // "5mm" -> "5mm"
        .replace(/gram$/i, 'g')                         // "5gram" -> "5g"
        .replace(/kilogram$/i, 'kg');                   // "5kilogram" -> "5kg"

    return str;
}

// ============================================
// DATE/TIME FORMATTING
// ============================================

/**
 * Format date string to Vietnamese format
 * Uses timezone-utils for UTC to VN timezone conversion
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Use timezone-utils to convert UTC to VN timezone
        return toVNDateString(dateString);
    } catch (e) {
        return dateString;
    }
}

/**
 * Format date string to separate time and date parts
 * @param {string} dateString - ISO date string
 * @returns {{time: string, date: string}} Object with time (HH:mm:ss) and date (DD/MM/YYYY)
 */
function formatDateTimeSplit(dateString) {
    if (!dateString) return { time: 'N/A', date: '' };
    try {
        // Convert to VN timezone
        const vnDate = toVNDate(dateString);

        // Format time (HH:mm:ss)
        const hours = vnDate.getHours().toString().padStart(2, '0');
        const minutes = vnDate.getMinutes().toString().padStart(2, '0');
        const seconds = vnDate.getSeconds().toString().padStart(2, '0');
        const time = `${hours}:${minutes}:${seconds}`;

        // Format date (DD/MM/YYYY)
        const day = vnDate.getDate().toString().padStart(2, '0');
        const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
        const year = vnDate.getFullYear();
        const date = `${day}/${month}/${year}`;

        return { time, date };
    } catch (e) {
        return { time: dateString, date: '' };
    }
}
