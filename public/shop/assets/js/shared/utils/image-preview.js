// ============================================
// IMAGE PREVIEW UTILITY
// ============================================

/**
 * Preview product image in modal
 * @param {string} imageUrl - Image URL
 * @param {string} productName - Product name
 */
window.previewProductImage = function(imageUrl, productName) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewImg');
    const title = document.getElementById('imagePreviewTitle');
    
    if (modal && img && title) {
        img.src = imageUrl;
        img.alt = productName;
        title.textContent = productName;
        modal.classList.add('active');
        
        // Close on click outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                window.closeImagePreview();
            }
        };
        
        // Close on ESC key
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                window.closeImagePreview();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }
};
