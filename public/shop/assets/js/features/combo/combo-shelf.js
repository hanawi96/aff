// ============================================
// COMBO SHELF — 3 vòng bán chạy + bó dâu để phòng
// ============================================

import { bundleProductsService } from '../../shared/services/bundle-products.service.js';
import { formatPrice, escapeHtml } from '../../shared/utils/formatters.js';
import { productThumbUrl, CONFIG } from '../../shared/constants/config.js?v=9';
import { showToast } from '../../shared/utils/helpers.js';

/** Giá bó dâu khi mua cùng một trong ba vòng bán chạy. */
export const COMBO_BUNDLE_PRICE = 29000;

const BUNDLE_CATEGORY_ID = 23;
const selectedByProduct = new Map();
let bound = false;

function isOutOfStock(product) {
    const raw = product?.stock_quantity ?? product?.stockQuantity;
    if (raw === undefined || raw === null || raw === '') return false;
    const qty = typeof raw === 'string'
        ? parseInt(String(raw).replace(/[^\d-]/g, ''), 10)
        : Number(raw);
    return Number.isFinite(qty) && qty <= 0;
}

function categoryNames(product) {
    return [
        ...(product?.categories || []),
        product?.category_id != null ? { id: product.category_id, name: product.category_name } : null
    ].filter(Boolean).map((cat) => String(cat.name || ''));
}

/** Nguyên liệu bán lẻ, không phải chiếc vòng mẹ đeo cho bé. */
function isMaterialOnly(product) {
    const names = categoryNames(product).filter(Boolean);
    if (!names.length) return false;
    return names.every((name) => /bán kèm|hạt dâu tằm mài sẵn|hạt đầu tâm|bi,?\s*charm bạc/i.test(name));
}

function isBundleCatalogProduct(product) {
    if (!product) return false;
    const bundleIds = new Set(bundleProductsService.getBundleProductIds().map(Number));
    if (bundleIds.has(Number(product.id))) return true;
    const categories = [
        ...(product.categories || []),
        product.category_id != null ? { id: product.category_id, name: product.category_name } : null
    ].filter(Boolean);
    return categories.some((cat) => {
        const id = Number(cat.id || cat.category_id);
        const name = String(cat.name || '');
        return id === BUNDLE_CATEGORY_ID || /bán kèm/i.test(name);
    });
}

function choiceLabel(bundle) {
    const name = String(bundle?.name || '');
    const branches = name.match(/(\d+)\s*cành/i);
    let sub = 'để phòng';
    if (/trai/i.test(name)) sub = 'bé trai';
    else if (/gái/i.test(name)) sub = 'bé gái';
    return {
        title: branches ? `${branches[1]} cành` : name,
        sub
    };
}

export function getComboBundles() {
    return bundleProductsService.getBundleProductsSync();
}

export function comboSavingsAmount(listPrice) {
    const list = Number(listPrice);
    if (!Number.isFinite(list)) return 0;
    return Math.max(0, list - COMBO_BUNDLE_PRICE);
}

/** Câu giảm giá dùng chung, lấy mức nhỏ nhất để không hứa quá. */
export function comboSavingsText() {
    const bundles = getComboBundles();
    if (!bundles.length) return '';
    const save = Math.min(...bundles.map((bundle) => comboSavingsAmount(bundle.price)));
    if (save <= 0) return '';
    return `rẻ hơn ${formatPrice(save)}`;
}

export function pickTopBracelets(products, limit = 3) {
    if (!Array.isArray(products)) return [];
    const ranked = [...products]
        .filter((product) => product && !isOutOfStock(product))
        .sort((a, b) => {
            const bySales = (Number(b.purchases) || 0) - (Number(a.purchases) || 0);
            if (bySales !== 0) return bySales;
            return Number(a.id) - Number(b.id);
        });
    const picks = [];
    for (const product of ranked) {
        if ((Number(product.purchases) || 0) <= 0) break;
        if (isBundleCatalogProduct(product) || isMaterialOnly(product)) continue;
        picks.push({ product, rank: picks.length + 1 });
        if (picks.length === limit) break;
    }
    return picks;
}

export function isComboAnchor(productId, products) {
    const list = Array.isArray(products)
        ? products
        : (typeof window !== 'undefined' ? window.allProducts : []);
    return pickTopBracelets(list, 3).some((item) => Number(item.product.id) === Number(productId));
}

function heartRule() {
    return `
        <div class="combo-rule" aria-hidden="true">
            <span></span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/></svg>
            <span></span>
        </div>
    `;
}

function renderCard(product, rank, bundles) {
    const image = productThumbUrl(product.image_url || product.image || CONFIG.DEFAULT_IMAGE);
    const preview = bundles[0];
    const previewImage = productThumbUrl(preview.image || CONFIG.DEFAULT_IMAGE);
    const listPrice = Number(preview.price) || 0;
    const save = comboSavingsAmount(listPrice);
    const chosen = selectedByProduct.get(Number(product.id));
    const chosenStillThere = bundles.some((bundle) => Number(bundle.id) === chosen);
    const activeId = chosenStillThere ? chosen : null;

    const pills = bundles.map((bundle) => {
        const label = choiceLabel(bundle);
        const on = activeId === Number(bundle.id);
        return `
            <button type="button" class="combo-pill${on ? ' is-selected' : ''}" role="radio" aria-checked="${on ? 'true' : 'false'}" data-combo-bundle="${bundle.id}">
                <span class="combo-pill-title">${escapeHtml(label.title)}</span>
                <span class="combo-pill-sub">${escapeHtml(label.sub)}</span>
            </button>
        `;
    }).join('');

    const activeBundle = bundles.find((bundle) => Number(bundle.id) === activeId);
    const hint = activeBundle
        ? `Đã chọn bó ${choiceLabel(activeBundle).title}`
        : 'Mẹ chọn bó 7 cành hoặc 9 cành';

    return `
        <article class="combo-card" id="combo-card-${product.id}" data-combo-product="${product.id}" data-combo-price="${Number(product.price) || 0}">
            <p class="combo-rank">Bán chạy số ${rank}</p>
            <div class="combo-photos">
                <img class="combo-photo-main" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" width="480" height="480" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${escapeHtml(CONFIG.DEFAULT_IMAGE)}'">
                <span class="combo-plus" aria-hidden="true">+</span>
                <img class="combo-photo-addon" src="${escapeHtml(activeBundle ? productThumbUrl(activeBundle.image) : previewImage)}" alt="${escapeHtml(activeBundle ? activeBundle.name : 'Bó dâu để phòng')}" width="240" height="240" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${escapeHtml(CONFIG.DEFAULT_IMAGE)}'">
            </div>
            <h3 class="combo-name">${escapeHtml(product.name)}</h3>
            <p class="combo-card-kicker">Kèm bó dâu để phòng</p>
            <div class="combo-pills" role="radiogroup" aria-label="Chọn bó dâu để phòng">${pills}</div>
            <p class="combo-hint">${escapeHtml(hint)}</p>
            <div class="combo-prices">
                <div><span>Vòng</span><strong>${formatPrice(product.price)}</strong></div>
                <div>
                    <span>Bó dâu</span>
                    <strong>${save > 0 ? `<s>${formatPrice(listPrice)}</s>` : ''}${formatPrice(save > 0 ? COMBO_BUNDLE_PRICE : listPrice)}</strong>
                </div>
            </div>
            ${save > 0 ? `<p class="combo-save">Rẻ hơn ${formatPrice(save)}</p>` : ''}
            <button type="button" class="combo-buy${activeId ? '' : ' is-waiting'}" data-combo-buy aria-disabled="${activeId ? 'false' : 'true'}">Mua Combo</button>
        </article>
    `;
}

function bindShelf(root) {
    if (bound) return;
    bound = true;
    root.addEventListener('click', (event) => {
        const pill = event.target.closest('[data-combo-bundle]');
        if (pill) {
            const card = pill.closest('[data-combo-product]');
            if (card) applyChoice(card, Number(pill.dataset.comboBundle));
            return;
        }
        const buy = event.target.closest('[data-combo-buy]');
        if (buy) {
            const card = buy.closest('[data-combo-product]');
            if (card) buyCombo(Number(card.dataset.comboProduct));
        }
    });
}

function applyChoice(card, bundleId) {
    const productId = Number(card.dataset.comboProduct);
    const bundle = getComboBundles().find((item) => Number(item.id) === bundleId);
    if (!bundle) return;
    selectedByProduct.set(productId, bundleId);
    card.classList.remove('needs-choice');
    card.querySelectorAll('.combo-pill').forEach((button) => {
        const on = Number(button.dataset.comboBundle) === bundleId;
        button.classList.toggle('is-selected', on);
        button.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const addon = card.querySelector('.combo-photo-addon');
    if (addon) {
        addon.src = productThumbUrl(bundle.image || CONFIG.DEFAULT_IMAGE);
        addon.alt = bundle.name;
    }
    const hint = card.querySelector('.combo-hint');
    if (hint) hint.textContent = `Đã chọn bó ${choiceLabel(bundle).title}`;
    const buy = card.querySelector('[data-combo-buy]');
    if (buy) {
        buy.classList.remove('is-waiting');
        buy.setAttribute('aria-disabled', 'false');
    }
}

function findBracelet(productId) {
    const lists = [window.allProducts, window.productActions?.products];
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        const found = list.find((product) => Number(product.id) === Number(productId));
        if (found) return found;
    }
    return null;
}

function buyCombo(productId) {
    const bundleId = selectedByProduct.get(Number(productId));
    const card = document.getElementById(`combo-card-${productId}`);
    if (!bundleId) {
        card?.classList.remove('needs-choice');
        void card?.offsetWidth;
        card?.classList.add('needs-choice');
        return;
    }
    const product = findBracelet(productId);
    if (!product) {
        showToast('Không tìm thấy sản phẩm. Vui lòng tải lại trang và thử lại.', 'error');
        return;
    }
    if (isOutOfStock(product)) {
        showToast('Sản phẩm hiện đã hết hàng.', 'error');
        return;
    }
    if (!window.quickCheckout) {
        showToast('Hệ thống đang tải. Vui lòng thử lại sau vài giây.', 'error');
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('buy', String(product.id));
    url.searchParams.set('combo', String(bundleId));
    window.history.pushState({ productId: product.id, combo: bundleId }, '', url);

    window.quickCheckout.open({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.original_price,
        image: product.image_url || product.image,
        maxQuantity: 99,
        isFlashSale: false,
        categories: product.categories || [],
        comboBundleId: bundleId
    });
}

export function focusComboCard(productId) {
    const card = document.getElementById(`combo-card-${productId}`);
    const shelf = document.getElementById('comboShelf');
    const target = card || shelf;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!card) return;
    card.classList.remove('is-focus');
    void card.offsetWidth;
    card.classList.add('is-focus');
}

export function renderComboShelf(products) {
    const root = document.getElementById('comboShelf');
    if (!root) return;

    const bundles = getComboBundles();
    const top = pickTopBracelets(products, 3);
    const savings = comboSavingsText();
    if (!top.length || !bundles.length || !savings) {
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '';
        return;
    }

    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    root.innerHTML = `
        <header class="combo-head">
            <h2 class="combo-title">Combo tiết kiệm nhất <span>cho mẹ</span></h2>
            ${heartRule()}
            <p class="combo-lead">Ba mẫu vòng bán chạy, kèm bó dâu để phòng. Mua cùng, bó dâu ${escapeHtml(savings)}.</p>
        </header>
        <div class="combo-track">
            ${top.map(({ product, rank }) => renderCard(product, rank, bundles)).join('')}
        </div>
        <p class="combo-swipe">Vuốt ngang để xem mẫu khác</p>
    `;
    bindShelf(root);
}

window.comboShelf = {
    focusCard: focusComboCard,
    savingsText: comboSavingsText
};
