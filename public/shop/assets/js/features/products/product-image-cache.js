// ============================================
// PRODUCT IMAGE CACHE — warm HTTP cache before category switch
// ============================================

import { CONFIG, productGridUrl } from '../../shared/constants/config.js?v=9';

const warmedUrls = new Set();
const MAX_WARM_PER_BATCH = 12;

export function resolveGridImageUrl(product) {
    return productGridUrl(product?.image_url || product?.image || CONFIG.DEFAULT_IMAGE);
}

/** Warm first N grid image URLs (duplicates skipped). */
export function warmProductGridImages(products, limit = MAX_WARM_PER_BATCH) {
    if (!Array.isArray(products) || products.length === 0) return;

    let started = 0;
    for (const product of products) {
        if (started >= limit) break;
        const url = resolveGridImageUrl(product);
        if (!url || warmedUrls.has(url)) continue;
        warmedUrls.add(url);
        started += 1;
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
    }
}
