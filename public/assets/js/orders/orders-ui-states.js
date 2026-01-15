// Orders UI State Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility

// ============================================
// LOADING STATE
// ============================================

/**
 * Show loading state - displays skeleton loader
 */
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

// ============================================
// TABLE STATE
// ============================================

/**
 * Show table content - displays orders table
 */
function showTable() {
    document.getElementById('tableContent').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

/**
 * Show empty state - displays "no orders" message
 */
function showEmptyState() {
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

// ============================================
// ERROR STATE
// ============================================

/**
 * Show error message and empty state
 * @param {string} message - Error message to display
 */
function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}
