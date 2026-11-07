// ============================================
// SHIPPING FEE — shared rule for Quickbuy + Cart
// Free ship when:
//  1) tiền hàng >= FREE_SHIPPING_THRESHOLD (100k), OR
//  2) có SP thường + bó dâu 7/9 cành (mua kèm)
// ============================================

import { CONFIG } from '../constants/config.js';
import { isBouquetProduct, cartHasCompanionProduct } from './bouquet-deal.js';

/**
 * Đủ điều kiện miễn ship nhờ mua kèm bó dâu (7/9 cành).
 * Cần có cả bó dâu lẫn ít nhất 1 SP không phải bó dâu.
 * @param {Array|null|undefined} cartOrItems
 */
export function cartHasBouquetFreeShip(cartOrItems) {
    if (!Array.isArray(cartOrItems) || cartOrItems.length === 0) return false;
    const hasBouquet = cartOrItems.some((item) => isBouquetProduct(item));
    return hasBouquet && cartHasCompanionProduct(cartOrItems);
}

/**
 * @param {number} merchandiseTotal tiền hàng (chưa gồm ship, chưa trừ mã giảm)
 * @param {Array|null|undefined} [cartOrItems] giỏ / dòng hàng để check kèm bó dâu
 */
export function isOrderFreeShipping(merchandiseTotal, cartOrItems) {
    if (Number(merchandiseTotal) >= CONFIG.FREE_SHIPPING_THRESHOLD) return true;
    return cartHasBouquetFreeShip(cartOrItems);
}

/**
 * @param {number} merchandiseTotal
 * @param {Array|null|undefined} [cartOrItems]
 * @returns {'threshold'|'bouquet'|null}
 */
export function getFreeShippingReason(merchandiseTotal, cartOrItems) {
    if (Number(merchandiseTotal) >= CONFIG.FREE_SHIPPING_THRESHOLD) return 'threshold';
    if (cartHasBouquetFreeShip(cartOrItems)) return 'bouquet';
    return null;
}

/**
 * @param {number} merchandiseTotal
 * @param {number} [baseFee=CONFIG.SHIPPING_FEE]
 * @param {Array|null|undefined} [cartOrItems]
 * @returns {number}
 */
export function resolveShippingFee(merchandiseTotal, baseFee = CONFIG.SHIPPING_FEE, cartOrItems) {
    return isOrderFreeShipping(merchandiseTotal, cartOrItems) ? 0 : (Number(baseFee) || 0);
}
