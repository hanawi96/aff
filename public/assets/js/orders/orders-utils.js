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
 * Parse price from various formats to number
 * Handles: number, "75000", "75.000", "75.000đ", "75 đ", etc.
 * @param {number|string} price - Price in any format
 * @returns {number} Parsed price as number
 */
function parsePrice(price) {
    if (price === null || price === undefined) return 0;
    
    // If already a number, return it
    if (typeof price === 'number') return price;
    
    // If string, clean it up
    // Remove all non-digit characters (including dots, spaces, currency symbols)
    const cleanPrice = String(price).replace(/[^\d]/g, '');
    const parsed = parseFloat(cleanPrice) || 0;
    
    return parsed;
}

/**
 * Định dạng ô nhập tiền VN (90.000) khi gõ: chỉ giữ chữ số rồi format locale vi-VN.
 * Dùng chung modal đơn hàng (SP tùy chỉnh, chỉnh sửa dòng).
 */
function formatVnMoneyInput(inputEl) {
    if (!inputEl) return;
    const digits = String(inputEl.value || '').replace(/\D/g, '');
    if (digits === '') {
        inputEl.value = '';
        return;
    }
    let num = parseInt(digits, 10);
    if (Number.isNaN(num) || num < 0) num = 0;
    if (num > 999999999) num = 999999999;
    inputEl.value = new Intl.NumberFormat('vi-VN').format(num);
    requestAnimationFrame(() => {
        try {
            const len = inputEl.value.length;
            inputEl.setSelectionRange(len, len);
        } catch (e) {
            /* ignore */
        }
    });
}

/**
 * Hiển thị số nguyên kiểu VN (90.000), chuỗi rỗng nếu <= 0 hoặc không hợp lệ
 */
function formatVnIntegerString(amount) {
    if (amount === null || amount === undefined || amount === '') return '';
    const n = Math.round(Number(amount));
    if (Number.isNaN(n) || n <= 0) return '';
    return new Intl.NumberFormat('vi-VN').format(n);
}

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
 * Chuẩn hóa cân/size trước khi gửi API: rỗng hoặc "chưa có" → null (đồng bộ DB)
 */
function normalizeOrderItemSizeClient(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const lower = s.toLowerCase();
    if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return null;
    return s;
}

/**
 * Danh sách tên sản phẩm trong đơn chưa có cân hoặc size (sau chuẩn hóa).
 * Dùng trước khi copy format SPX / in để cảnh báo.
 */
function getOrderProductsMissingSizeWeight(order) {
    if (!order || order.products == null || order.products === '') return [];
    let products = [];
    try {
        products = JSON.parse(order.products);
        if (!Array.isArray(products)) products = [];
    } catch (e) {
        const lines = String(order.products).split(/[,\n]/).map((line) => line.trim()).filter(Boolean);
        products = lines.map((line) => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
            return { name: line, quantity: 1 };
        });
    }

    const missing = [];
    for (const p of products) {
        if (typeof p === 'string') {
            missing.push(p.trim() || 'Sản phẩm');
            continue;
        }
        if (!p || typeof p !== 'object') {
            missing.push('Sản phẩm');
            continue;
        }
        const name = (p.name || 'Sản phẩm').trim() || 'Sản phẩm';
        const size = normalizeOrderItemSizeClient(p.size ?? null);
        const weight = normalizeOrderItemSizeClient(p.weight ?? null);
        if (!size && !weight) missing.push(name);
    }
    return missing;
}

/**
 * Format weight/size value with proper unit
 * @param {string|number} value - Weight or size value
 * @returns {string} Formatted value with unit (e.g., "5kg", "100g")
 */
function formatWeightSize(value) {
    if (!value) return '';
    let str = String(value).trim();
    const lower = str.toLowerCase();
    if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return '';

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
 * Format date string or Unix timestamp to separate time and date parts
 * @param {string|number} dateInput - ISO date string or Unix timestamp (milliseconds)
 * @returns {{time: string, date: string}} Object with time (HH:mm:ss) and date (DD/MM/YYYY)
 */
function formatDateTimeSplit(dateInput) {
    if (!dateInput) return { time: 'N/A', date: '' };
    try {
        // If it's a Unix timestamp (number), create Date directly
        // Unix timestamps are already in the correct timezone (Vietnam time when created)
        let vnDate;
        if (typeof dateInput === 'number' || /^\d+$/.test(dateInput)) {
            // Unix timestamp - already in Vietnam time
            vnDate = new Date(Number(dateInput));
        } else {
            // ISO string - needs timezone conversion
            vnDate = toVNDate(dateInput);
        }

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
        return { time: String(dateInput), date: '' };
    }
}
