// ============================================
// Bó dâu kèm bất kỳ SP → giảm còn BOUQUET_DEAL_PRICE
// (chênh lệch ~10k so với giá bán lẻ 39k)
// ============================================

export const BOUQUET_DEAL_PRICE = 29000;

/** @param {object|number|null|undefined} item */
export function isBouquetProduct(item) {
    if (item == null) return false;
    if (typeof item === 'number' || typeof item === 'string') {
        const id = Number(item);
        return id === 133 || id === 134;
    }
    if (item.isBundleProduct === true) return true;
    const id = Number(item.id);
    return id === 133 || id === 134;
}

/** Giỏ có ít nhất 1 SP không phải bó dâu */
export function cartHasCompanionProduct(cart) {
    if (!Array.isArray(cart)) return false;
    return cart.some((item) => !isBouquetProduct(item));
}

/**
 * Đơn giá bó dâu khi mua kèm SP khác.
 * @param {object} item
 * @param {boolean} hasCompanion
 */
export function bouquetUnitPrice(item, hasCompanion) {
    const list = Number(item?.listPrice ?? item?.price) || 0;
    const current = Number(item?.price) || 0;
    if (!isBouquetProduct(item) || !hasCompanion) return current;
    if (BOUQUET_DEAL_PRICE < list) return BOUQUET_DEAL_PRICE;
    if (BOUQUET_DEAL_PRICE < current) return BOUQUET_DEAL_PRICE;
    return current;
}

/** Gắn giá deal + listPrice để UI gạch giá cũ */
export function withBouquetDealPrice(product) {
    const listPrice = Number(product?.price) || 0;
    if (!isBouquetProduct(product) || !(BOUQUET_DEAL_PRICE < listPrice)) {
        return { ...product };
    }
    return { ...product, price: BOUQUET_DEAL_PRICE, listPrice };
}
