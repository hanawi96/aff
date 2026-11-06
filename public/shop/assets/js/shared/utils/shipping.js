// ============================================
// SHIPPING FEE — shared rule for Quickbuy + Cart
// Free ship when merchandise total >= FREE_SHIPPING_THRESHOLD
// ============================================

import { CONFIG } from '../constants/config.js';

/** @param {number} merchandiseTotal tiền hàng (chưa gồm ship, chưa trừ mã giảm) */
export function isOrderFreeShipping(merchandiseTotal) {
    return Number(merchandiseTotal) >= CONFIG.FREE_SHIPPING_THRESHOLD;
}

/**
 * @param {number} merchandiseTotal
 * @param {number} [baseFee=CONFIG.SHIPPING_FEE]
 * @returns {number}
 */
export function resolveShippingFee(merchandiseTotal, baseFee = CONFIG.SHIPPING_FEE) {
    return isOrderFreeShipping(merchandiseTotal) ? 0 : (Number(baseFee) || 0);
}
