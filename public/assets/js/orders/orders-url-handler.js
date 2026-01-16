// ============================================
// URL HASH HANDLING FOR SHAREABLE LINKS
// ============================================

/**
 * Check URL hash and auto-open modal if needed
 */
function checkUrlHash() {
    const hash = window.location.hash;

    if (hash === '#add-order') {
        // Wait a bit for page to fully load
        setTimeout(() => {
            showAddOrderModal();
        }, 500);
    }
}

// Listen for hash changes (when user clicks back/forward)
window.addEventListener('hashchange', function () {
    checkUrlHash();
});
