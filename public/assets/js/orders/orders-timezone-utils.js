// ============================================
// TIMEZONE UTILITIES FOR ORDERS
// ============================================
// Custom date picker and timezone utilities for orders filter

// Vietnam timezone constant
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds

/**
 * Convert UTC timestamp/date string to Vietnam Date object
 * @param {string|number} dateInput - ISO date string or timestamp
 * @returns {Date} Date object in Vietnam timezone
 */
function toVNDate(dateInput) {
    if (!dateInput) return new Date();
    
    // Parse input to timestamp
    let timestamp;
    if (typeof dateInput === 'number') {
        timestamp = dateInput;
    } else {
        timestamp = new Date(dateInput).getTime();
    }
    
    // Create Date object and adjust to VN timezone
    // Note: We create a Date in UTC, then format it as if it's in VN timezone
    const date = new Date(timestamp);
    
    // Get VN time string and parse it back to Date
    const vnTimeString = date.toLocaleString('en-US', { timeZone: VIETNAM_TIMEZONE });
    return new Date(vnTimeString);
}

/**
 * Convert UTC timestamp/date string to Vietnam formatted string
 * @param {string|number} dateInput - ISO date string or timestamp
 * @returns {string} Formatted date string (DD/MM/YYYY HH:mm:ss)
 */
function toVNDateString(dateInput) {
    if (!dateInput) return 'N/A';
    
    try {
        const vnDate = toVNDate(dateInput);
        
        const day = vnDate.getDate().toString().padStart(2, '0');
        const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
        const year = vnDate.getFullYear();
        const hours = vnDate.getHours().toString().padStart(2, '0');
        const minutes = vnDate.getMinutes().toString().padStart(2, '0');
        const seconds = vnDate.getSeconds().toString().padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        return String(dateInput);
    }
}

/**
 * Get start of today in VN timezone
 * @returns {Date} Start of today (00:00:00) in VN timezone
 */
function getVNStartOfToday() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return new Date(vnDateStr + 'T00:00:00+07:00');
}

/**
 * Get end of today in VN timezone
 * @returns {Date} End of today (23:59:59.999) in VN timezone
 */
function getVNEndOfToday() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return new Date(vnDateStr + 'T23:59:59.999+07:00');
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayDateString() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return vnDateStr;
}

/**
 * Get start of last 7 days in VN timezone (7 ngày qua, không phải tuần này)
 * Note: This overrides getVNStartOfWeek() from timezone-utils.js which returns "this week"
 */
function getVNStartOfLast7Days() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const today = new Date(vnDateStr + 'T00:00:00+07:00');

    // Lùi lại 7 ngày (không phải tuần này, mà là 7 ngày qua)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sevenDaysAgo;
}

/**
 * Get start of last 30 days in VN timezone (30 ngày qua)
 * Note: This overrides getVNStartOfMonth() from timezone-utils.js which returns "this month"
 */
function getVNStartOfLast30Days() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const today = new Date(vnDateStr + 'T00:00:00+07:00');

    // Lùi lại 30 ngày
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return thirtyDaysAgo;
}

/**
 * Get start of a specific date in VN timezone
 */
function getVNStartOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T00:00:00+07:00');
    return vnDateTime;
}

/**
 * Get end of a specific date in VN timezone
 */
function getVNEndOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T23:59:59.999+07:00');
    return vnDateTime;
}

// ============================================
// SHIPPING COST AUTO-SYNC
// ============================================

/**
 * Setup auto-sync shipping cost with shipping fee (for display only, not input)
 * Note: No auto-sync for input fields - keep database values
 * Only sync in display/summary section via updateOrderSummary()
 */
function setupShippingCostSync() {
    // No auto-sync for input fields - keep database values
    // Only sync in display/summary section via updateOrderSummary()
}
