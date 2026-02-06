// ============================================
// MARQUEE BANNER CONFIGURATION
// ============================================

/**
 * Marquee Banner Config
 * 
 * ⚠️ QUAN TRỌNG: Để BẬT/TẮT marquee banner, thay đổi ở 2 NƠI:
 * 
 * 1. Inline script trong HTML (cart.html và index.html):
 *    window.MARQUEE_ENABLED = true/false
 * 
 * 2. Config này (để đồng bộ - optional):
 *    MARQUEE_CONFIG.enabled = true/false
 */
export const MARQUEE_CONFIG = {
    // BẬT/TẮT marquee banner (phải match với window.MARQUEE_ENABLED)
    enabled: true, // true = hiển thị, false = ẩn
    
    // Nội dung marquee (có thể thay đổi)
    text: '🎁 Mua thêm bó dâu tằm để được miễn phí ship 🚚',
    
    // Tốc độ animation (giây)
    animationDuration: 30,
    
    // Chiều cao (px)
    height: {
        desktop: 40,
        mobile: 36
    }
};

/**
 * Initialize marquee banner based on config
 * This syncs with the inline script in HTML
 */
export function initMarqueeBanner() {
    // Check if inline script already set the state
    const isEnabled = window.MARQUEE_ENABLED !== undefined 
        ? window.MARQUEE_ENABLED 
        : MARQUEE_CONFIG.enabled;
    
    const html = document.documentElement;
    
    if (isEnabled) {
        // Enable marquee
        html.classList.remove('marquee-disabled');
        console.log('✅ Marquee banner enabled');
    } else {
        // Disable marquee (should already be disabled by inline script)
        html.classList.add('marquee-disabled');
        console.log('❌ Marquee banner disabled');
    }
}

/**
 * Toggle marquee banner on/off
 */
export function toggleMarqueeBanner(enabled) {
    window.MARQUEE_ENABLED = enabled;
    MARQUEE_CONFIG.enabled = enabled;
    initMarqueeBanner();
}
