/**
 * Timezone Utilities for Vietnam (UTC+7)
 * 
 * Backend stores all timestamps in UTC (ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ)
 * Frontend converts to Vietnam timezone for display and filtering
 * 
 * IMPORTANT: All dates from backend are in UTC. All dates sent to backend must be in UTC.
 */

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_HOURS = 7;
const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Convert UTC date to Vietnam local date string
 * @param {string|Date} utcDate - UTC date
 * @returns {string} - Formatted date string in Vietnam timezone
 */
function toVNDateString(utcDate) {
    if (!utcDate) return '';
    const date = new Date(utcDate);
    return date.toLocaleString('vi-VN', { 
        timeZone: VIETNAM_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Convert UTC date to Vietnam short date (DD/MM/YYYY)
 * @param {string|Date} utcDate - UTC date
 * @returns {string} - Short date string
 */
function toVNShortDate(utcDate) {
    if (!utcDate) return '';
    const date = new Date(utcDate);
    return date.toLocaleDateString('vi-VN', { 
        timeZone: VIETNAM_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Convert UTC date to Vietnam time only (HH:mm)
 * @param {string|Date} utcDate - UTC date
 * @returns {string} - Time string
 */
function toVNTime(utcDate) {
    if (!utcDate) return '';
    const date = new Date(utcDate);
    return date.toLocaleTimeString('vi-VN', { 
        timeZone: VIETNAM_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get start of today in Vietnam timezone (as UTC timestamp)
 * @returns {Date} - UTC date representing start of today in VN (00:00:00 VN time)
 */
function getVNStartOfToday() {
    const now = new Date();
    // Get current date in VN timezone
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE }); // YYYY-MM-DD
    // Create date at midnight VN time, then convert to UTC
    const vnMidnight = new Date(vnDateStr + 'T00:00:00+07:00');
    return vnMidnight;
}

/**
 * Get end of today in Vietnam timezone (as UTC timestamp)
 * @returns {Date} - UTC date representing end of today in VN (23:59:59.999 VN time)
 */
function getVNEndOfToday() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const vnEndOfDay = new Date(vnDateStr + 'T23:59:59.999+07:00');
    return vnEndOfDay;
}

/**
 * Get start of current week in Vietnam timezone (Monday 00:00:00 VN time)
 * @returns {Date} - UTC date representing start of week in VN
 */
function getVNStartOfWeek() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const vnDate = new Date(vnDateStr + 'T00:00:00+07:00');
    
    // Get day of week in VN timezone (0 = Sunday, 1 = Monday, ...)
    const dayOfWeek = vnDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    
    return new Date(vnDate.getTime() - diff * 24 * 60 * 60 * 1000);
}

/**
 * Get start of current month in Vietnam timezone (1st day 00:00:00 VN time)
 * @returns {Date} - UTC date representing start of month in VN
 */
function getVNStartOfMonth() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const [year, month] = vnDateStr.split('-');
    const monthStart = new Date(`${year}-${month}-01T00:00:00+07:00`);
    return monthStart;
}

/**
 * Get end of current month in Vietnam timezone (last day 23:59:59.999 VN time)
 * @returns {Date} - UTC date representing end of month in VN
 */
function getVNEndOfMonth() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const [year, month] = vnDateStr.split('-');
    
    // Get first day of next month, then subtract 1ms
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const nextMonthStart = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+07:00`);
    
    return new Date(nextMonthStart.getTime() - 1);
}

/**
 * Get start of current year in Vietnam timezone (Jan 1st 00:00:00 VN time)
 * @returns {Date} - UTC date representing start of year in VN
 */
function getVNStartOfYear() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const year = vnDateStr.split('-')[0];
    const yearStart = new Date(`${year}-01-01T00:00:00+07:00`);
    return yearStart;
}

/**
 * Get end of current year in Vietnam timezone (Dec 31st 23:59:59.999 VN time)
 * @returns {Date} - UTC date representing end of year in VN
 */
function getVNEndOfYear() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const year = vnDateStr.split('-')[0];
    const nextYearStart = new Date(`${parseInt(year) + 1}-01-01T00:00:00+07:00`);
    return new Date(nextYearStart.getTime() - 1);
}

/**
 * Check if a UTC date is today in Vietnam timezone
 * @param {string|Date} utcDate - UTC date to check
 * @returns {boolean}
 */
function isVNToday(utcDate) {
    if (!utcDate) return false;
    const date = new Date(utcDate);
    const vnDateStr = date.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const todayVNStr = new Date().toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return vnDateStr === todayVNStr;
}

/**
 * Get relative time string in Vietnamese
 * @param {string|Date} utcDate - UTC date
 * @returns {string} - Relative time string
 */
function getVNRelativeTime(utcDate) {
    if (!utcDate) return '';
    const date = new Date(utcDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return toVNShortDate(utcDate);
}

/**
 * Convert local VN datetime input to UTC ISO string
 * @param {string} vnDateTimeStr - Date time string in VN timezone (e.g., "2024-01-15T10:30")
 * @returns {string} - UTC ISO string
 */
function vnDateTimeToUTC(vnDateTimeStr) {
    if (!vnDateTimeStr) return new Date().toISOString();
    
    // If already has timezone, parse directly
    if (vnDateTimeStr.includes('+') || vnDateTimeStr.includes('Z')) {
        return new Date(vnDateTimeStr).toISOString();
    }
    
    // Assume input is in VN timezone, add +07:00
    const vnDateTime = new Date(vnDateTimeStr + '+07:00');
    return vnDateTime.toISOString();
}

/**
 * Get current time in UTC ISO format
 * @returns {string} - Current UTC timestamp
 */
function getCurrentUTC() {
    return new Date().toISOString();
}

/**
 * Parse any date string to UTC Date object
 * @param {string|Date} dateStr - Date string or Date object
 * @returns {Date} - Date object in UTC
 */
function parseToUTC(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    return new Date(dateStr);
}

/**
 * Format currency in Vietnamese
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
function formatVNCurrency(amount) {
    if (amount === null || amount === undefined) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount).replace('₫', 'đ');
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toVNDateString,
        toVNShortDate,
        toVNTime,
        getVNStartOfToday,
        getVNEndOfToday,
        getVNStartOfWeek,
        getVNStartOfMonth,
        getVNEndOfMonth,
        getVNStartOfYear,
        getVNEndOfYear,
        isVNToday,
        getVNRelativeTime,
        vnDateTimeToUTC,
        getCurrentUTC,
        parseToUTC,
        formatVNCurrency,
        VIETNAM_TIMEZONE,
        VN_OFFSET_HOURS,
        VN_OFFSET_MS
    };
}
