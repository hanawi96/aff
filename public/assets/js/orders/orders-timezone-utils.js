// ============================================
// TIMEZONE UTILITIES FOR ORDERS
// ============================================
// Custom date picker and timezone utilities for orders filter

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
