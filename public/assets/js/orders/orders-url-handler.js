// ============================================
// URL HASH HANDLING FOR SHAREABLE LINKS
// ============================================

/**
 * Check URL hash and auto-open modal if needed
 */
function checkUrlHash() {
    const hash = window.location.hash;

    if (hash === '#add-order') {
        setTimeout(() => showAddOrderModal(), 500);
    } else if (hash.startsWith('#edit-order-')) {
        const id = parseInt(hash.replace('#edit-order-', ''), 10);
        if (id > 0 && typeof editFullOrder === 'function') {
            setTimeout(() => editFullOrder(id), 500);
        }
    }
}

// Listen for hash changes (when user clicks back/forward)
window.addEventListener('hashchange', function () {
    checkUrlHash();
});
