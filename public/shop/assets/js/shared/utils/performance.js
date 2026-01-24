// ============================================
// PERFORMANCE UTILITIES
// ============================================

/**
 * Debounce function - Limits how often a function can run
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 100) {
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

/**
 * Throttle function - Ensures function runs at most once per interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Request Animation Frame wrapper for smooth animations
 * @param {Function} callback - Function to call on next frame
 */
export function rafThrottle(callback) {
    let requestId = null;
    
    return function(...args) {
        if (requestId === null) {
            requestId = requestAnimationFrame(() => {
                requestId = null;
                callback(...args);
            });
        }
    };
}

/**
 * Lazy load images when they enter viewport
 * @param {string} selector - CSS selector for images
 */
export function lazyLoadImages(selector = 'img[loading="lazy"]') {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll(selector).forEach(img => {
            imageObserver.observe(img);
        });
    }
}

/**
 * Measure performance of a function
 * @param {string} label - Label for the measurement
 * @param {Function} func - Function to measure
 */
export async function measurePerformance(label, func) {
    const startTime = performance.now();
    const result = await func();
    const endTime = performance.now();
    console.log(`⏱️ ${label}: ${(endTime - startTime).toFixed(2)}ms`);
    return result;
}

/**
 * Preload critical resources
 * @param {Array<string>} urls - URLs to preload
 * @param {string} type - Resource type (image, script, style)
 */
export function preloadResources(urls, type = 'image') {
    urls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = type;
        document.head.appendChild(link);
    });
}
