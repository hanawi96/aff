// ============================================
// HELPERS - General Utility Functions
// ============================================

export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: fadeInUp 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

export function showToast(message, type = 'success') {
    showNotification(message, type);
}

export function getProductCountByCategory(categoryId) {
    // TODO: Implement actual count from products array
    return Math.floor(Math.random() * 20) + 5;
}

export function calculateDiscount(originalPrice, salePrice) {
    if (!originalPrice || originalPrice <= salePrice) return 0;
    return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

export function isMobile() {
    return window.innerWidth < 768;
}

export function scrollToElement(selector, behavior = 'smooth') {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({ behavior });
    }
}
