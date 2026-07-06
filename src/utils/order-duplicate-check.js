/** Cửa sổ coi đơn là “gần đây” (ms). */
export const DUPLICATE_ORDER_WINDOW_MS = 72 * 60 * 60 * 1000;

/** Chỉ so với đơn chưa gửi / chờ gửi lại / gửi sau. */
export const DUPLICATE_ACTIVE_STATUSES = new Set(['pending', 'awaiting_reship', 'send_later']);

export function normalizeOrderPhone(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('84') && d.length >= 10) d = '0' + d.slice(2);
    if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
    return d;
}

export function normalizeOrderStatusForDuplicate(status) {
    const s = String(status || 'pending').toLowerCase().trim();
    const map = {
        'mới': 'pending',
        'chờ xử lý': 'pending',
        'chưa gửi hàng': 'pending',
        'chờ gửi lại': 'awaiting_reship',
        'gửi sau': 'send_later'
    };
    return map[s] || s;
}

export function parseOrderCartItems(cartOrProducts) {
    if (!cartOrProducts) return [];
    let items = cartOrProducts;
    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(items)) return [];
    return items.map((p) => {
        if (typeof p === 'string') {
            const m = p.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            return m
                ? { name: m[1].trim(), quantity: parseInt(m[2], 10) || 1 }
                : { name: p.trim(), quantity: 1 };
        }
        if (!p || typeof p !== 'object') return { name: 'Sản phẩm', quantity: 1 };
        return {
            product_id: p.product_id ?? p.id ?? null,
            name: String(p.name || p.product_name || 'Sản phẩm').trim(),
            quantity: parseInt(p.quantity, 10) || 1
        };
    }).filter((p) => p.name);
}

export function buildOrderCartFingerprint(items) {
    return parseOrderCartItems(items)
        .map((p) => {
            const qty = parseInt(p.quantity, 10) || 1;
            const pid = p.product_id != null && p.product_id !== '' ? String(p.product_id) : '';
            const name = String(p.name || '').trim().toLowerCase();
            return pid ? `id:${pid}x${qty}` : `n:${name}x${qty}`;
        })
        .sort()
        .join('|');
}

export function orderCartSimilarity(fpA, fpB) {
    if (!fpA || !fpB) return 0;
    if (fpA === fpB) return 1;
    const setA = new Set(fpA.split('|').filter(Boolean));
    const setB = new Set(fpB.split('|').filter(Boolean));
    if (!setA.size || !setB.size) return 0;
    let inter = 0;
    for (const x of setA) if (setB.has(x)) inter += 1;
    return inter / Math.max(setA.size, setB.size);
}

/**
 * Đơn candidate có trùng với đơn đã có không?
 * — Cùng SĐT, trạng thái còn xử lý, trong cửa sổ thời gian, giỏ SP tương tự.
 */
export function orderLooksLikeDuplicate(newCart, existingOrder, newPhone, nowMs = Date.now()) {
    if (!existingOrder) return false;
    const phoneA = normalizeOrderPhone(newPhone);
    const phoneB = normalizeOrderPhone(existingOrder.customer_phone);
    if (!phoneA || phoneA !== phoneB) return false;

    const status = normalizeOrderStatusForDuplicate(existingOrder.status);
    if (!DUPLICATE_ACTIVE_STATUSES.has(status)) return false;

    const created = Number(existingOrder.created_at_unix) || 0;
    if (!created || nowMs - created > DUPLICATE_ORDER_WINDOW_MS) return false;

    const sim = orderCartSimilarity(
        buildOrderCartFingerprint(newCart),
        buildOrderCartFingerprint(existingOrder.products)
    );
    const hours = (nowMs - created) / (60 * 60 * 1000);

    if (sim >= 0.55) return true;
    if (hours <= 6 && sim >= 0.34) return true;
    if (hours <= 2 && sim > 0) return true;
    return false;
}

export function summarizeDuplicateOrder(order) {
    let preview = '';
    try {
        const items = parseOrderCartItems(order.products);
        preview = items.slice(0, 3).map((p) => `${p.name} ×${p.quantity || 1}`).join(', ');
        if (items.length > 3) preview += ` (+${items.length - 3})`;
    } catch {
        preview = '';
    }
    return {
        id: order.id,
        order_id: order.order_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        status: order.status,
        created_at_unix: order.created_at_unix,
        total_amount: order.total_amount,
        products_preview: preview
    };
}

/** Truy vấn DB — tối đa vài chục dòng gần đây, lọc SĐT + giỏ ở JS. */
export async function findRecentDuplicateOrders(env, phone, cart, excludeOrderDbId = null) {
    const normPhone = normalizeOrderPhone(phone);
    if (!normPhone || normPhone.length < 9) return [];

    const cutoff = Date.now() - DUPLICATE_ORDER_WINDOW_MS;
    const { results } = await env.DB.prepare(`
        SELECT id, order_id, customer_name, customer_phone, products, status, created_at_unix, total_amount
        FROM orders
        WHERE created_at_unix > ?
          AND LOWER(TRIM(status)) IN ('pending', 'awaiting_reship', 'send_later')
        ORDER BY created_at_unix DESC
        LIMIT 40
    `).bind(cutoff).all();

    const matches = [];
    for (const row of results || []) {
        if (excludeOrderDbId != null && Number(row.id) === Number(excludeOrderDbId)) continue;
        if (orderLooksLikeDuplicate(cart, row, phone)) {
            matches.push(summarizeDuplicateOrder(row));
        }
    }
    return matches;
}
