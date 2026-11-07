// ============================================
// SP cần nhập tên bé để khắc
// - Danh mục "Mix thẻ tên bé", hoặc
// - Tên SP có "khắc tên" (vd. thẻ bạc trong Bi/charm)
// ============================================

/**
 * @param {object|null|undefined} product
 * @returns {boolean}
 */
export function needsBabyName(product) {
    if (!product) return false;

    const name = String(product.name || '').toLowerCase();
    if (/khắc\s*tên/.test(name)) return true;

    const cats = Array.isArray(product.categories) ? product.categories : [];
    return cats.some((cat) =>
        cat?.name && String(cat.name).toLowerCase().includes('mix thẻ tên bé')
    );
}
