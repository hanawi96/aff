// ============================================
// Combo 2 vòng — giảm PAIR_COMBO_DISCOUNT + miễn ship
// ============================================

export const PAIR_COMBO_DISCOUNT = 10000;
export const PAIR_COMBO_QTY = 2;

/** @typedef {{ id: string, title: string, match: (product: object) => boolean }} PairComboDef */

/** @type {PairComboDef[]} */
export const PAIR_COMBO_DEFS = [
    {
        id: 'pair-tron-elastic',
        title: 'Combo 2 vòng trơn co giãn',
        match: isTronCoGianProduct
    },
    {
        id: 'pair-day-do',
        title: 'Combo 2 vòng dây đỏ',
        match: isDayDoProduct
    }
];

function categoryIds(product) {
    return [
        ...(Array.isArray(product?.categories)
            ? product.categories.map((cat) => Number(cat?.id || cat?.category_id))
            : []),
        ...(Array.isArray(product?.category_ids)
            ? product.category_ids.map((id) => Number(id))
            : []),
        Number(product?.category_id)
    ].filter((id) => Number.isFinite(id));
}

/** Vòng trơn / vòng co giãn (cat 11) — không mix bạc. */
export function isTronCoGianProduct(product) {
    if (!product) return false;
    const name = String(product.name || '');
    if (/bạc/i.test(name)) return false;
    const ids = categoryIds(product);
    if (ids.includes(11)) return true;
    if (/trơn/i.test(name) && /co\s*giãn|cơ\s*giãn/i.test(name)) return true;
    return product.string_type === 'elastic' && /trơn/i.test(name);
}

/** Vòng dây đỏ (theo tên — tránh nhầm ngũ sắc). */
export function isDayDoProduct(product) {
    if (!product) return false;
    return /dây\s*đỏ/i.test(String(product.name || ''));
}

export function isPairComboId(id) {
    return PAIR_COMBO_DEFS.some((def) => def.id === id);
}

/**
 * Giảm 10k khi đủ số lượng combo đôi.
 * @param {string|null|undefined} pairComboId
 * @param {number} quantity
 */
export function pairComboDiscountAmount(pairComboId, quantity) {
    if (!isPairComboId(pairComboId)) return 0;
    if (Number(quantity) < PAIR_COMBO_QTY) return 0;
    return PAIR_COMBO_DISCOUNT;
}

/**
 * Tổng combo đôi: 2 × giá − 10k.
 * @param {number} unitPrice
 */
export function pairComboTotalNow(unitPrice) {
    const unit = Number(unitPrice) || 0;
    return Math.max(0, unit * PAIR_COMBO_QTY - PAIR_COMBO_DISCOUNT);
}

export function pairComboTotalWas(unitPrice) {
    return (Number(unitPrice) || 0) * PAIR_COMBO_QTY;
}

/**
 * Giỏ có combo đôi đủ qty → miễn ship.
 * @param {Array|null|undefined} cartOrItems
 */
export function cartHasPairComboFreeShip(cartOrItems) {
    if (!Array.isArray(cartOrItems) || !cartOrItems.length) return false;
    return cartOrItems.some((item) => {
        if (!isPairComboId(item?.pairComboId)) return false;
        return Number(item.quantity) >= PAIR_COMBO_QTY;
    });
}

/**
 * Chọn SP bán chạy nhất khớp từng combo đôi.
 * @param {object[]} products
 * @param {(product: object) => boolean} [isOutOfStock]
 */
export function pickPairComboProducts(products, isOutOfStock = () => false) {
    if (!Array.isArray(products)) return [];
    const ranked = [...products]
        .filter((product) => product && !isOutOfStock(product))
        .sort((a, b) => {
            const bySales = (Number(b.purchases) || 0) - (Number(a.purchases) || 0);
            if (bySales !== 0) return bySales;
            return Number(a.id) - Number(b.id);
        });

    return PAIR_COMBO_DEFS.map((def) => {
        const product = ranked.find((item) => def.match(item));
        if (!product) return null;
        return { def, product };
    }).filter(Boolean);
}
