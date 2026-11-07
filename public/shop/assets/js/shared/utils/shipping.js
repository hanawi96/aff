// ============================================
// SHIPPING FEE — shared rule for Quickbuy + Cart
// Free ship when:
//  1) tiền hàng >= FREE_SHIPPING_THRESHOLD (100k)
//     — KHÔNG áp dụng nếu mọi SP (trừ bó dâu) thuộc "Bi, charm bạc"
//  2) OR có SP thường + bó dâu 7/9 cành (mua kèm)
// ============================================

import { CONFIG } from '../constants/config.js';
import { isBouquetProduct, cartHasCompanionProduct } from './bouquet-deal.js';

/** Danh mục Bi, charm bạc — SP mới thêm vào đây tự theo rule miễn ship đặc biệt */
export const BI_CHARM_SILVER_CATEGORY_ID = 24;

/**
 * SP thuộc danh mục Bi, charm bạc (theo id 24 hoặc tên danh mục).
 * @param {object|null|undefined} item
 */
export function isBiCharmSilverProduct(item) {
    if (!item || typeof item !== 'object') return false;
    if (Number(item.category_id) === BI_CHARM_SILVER_CATEGORY_ID) return true;
    if (Array.isArray(item.category_ids)
        && item.category_ids.some((id) => Number(id) === BI_CHARM_SILVER_CATEGORY_ID)) {
        return true;
    }
    const cats = Array.isArray(item.categories) ? item.categories : [];
    return cats.some((cat) => {
        if (!cat) return false;
        if (Number(cat.id || cat.category_id) === BI_CHARM_SILVER_CATEGORY_ID) return true;
        return /bi,?\s*charm\s*bạc/i.test(String(cat.name || ''));
    });
}

/**
 * Đơn chỉ toàn Bi/charm bạc (bỏ qua bó dâu) → không được miễn ship theo ngưỡng 100k.
 * @param {Array|null|undefined} cartOrItems
 */
export function cartBlocksThresholdFreeShip(cartOrItems) {
    if (!Array.isArray(cartOrItems) || cartOrItems.length === 0) return false;
    const nonBouquet = cartOrItems.filter((item) => !isBouquetProduct(item));
    if (!nonBouquet.length) return false;
    return nonBouquet.every((item) => isBiCharmSilverProduct(item));
}

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
 * @param {Array|null|undefined} [cartOrItems] giỏ / dòng hàng để check kèm bó dâu / bi-charm
 */
export function isOrderFreeShipping(merchandiseTotal, cartOrItems) {
    if (cartHasBouquetFreeShip(cartOrItems)) return true;
    if (Number(merchandiseTotal) < CONFIG.FREE_SHIPPING_THRESHOLD) return false;
    if (cartBlocksThresholdFreeShip(cartOrItems)) return false;
    return true;
}

/**
 * @param {number} merchandiseTotal
 * @param {Array|null|undefined} [cartOrItems]
 * @returns {'threshold'|'bouquet'|null}
 */
export function getFreeShippingReason(merchandiseTotal, cartOrItems) {
    if (cartHasBouquetFreeShip(cartOrItems)) return 'bouquet';
    if (Number(merchandiseTotal) >= CONFIG.FREE_SHIPPING_THRESHOLD
        && !cartBlocksThresholdFreeShip(cartOrItems)) {
        return 'threshold';
    }
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
