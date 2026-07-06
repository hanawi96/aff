// Cảnh báo đơn trùng khi tạo mới (client) — logic đồng bộ src/utils/order-duplicate-check.js

const DUPLICATE_ORDER_WINDOW_MS = 72 * 60 * 60 * 1000;
const DUPLICATE_ACTIVE_STATUSES = new Set(['pending', 'awaiting_reship', 'send_later']);

function normalizeOrderPhoneForDup(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('84') && d.length >= 10) d = '0' + d.slice(2);
    if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
    return d;
}

function normalizeOrderStatusForDup(status) {
    const s = String(status || 'pending').toLowerCase().trim();
    const map = {
        'mới': 'pending',
        'chờ xử lý': 'pending',
        'chưa gửi hàng': 'pending',
        'chờ gửi lại': 'awaiting_reship',
        'gửi sau': 'send_later'
    };
    return map[s] || (typeof normalizeOrderStatusSlug === 'function' ? normalizeOrderStatusSlug(status) : s);
}

function parseOrderCartItemsForDup(cartOrProducts) {
    if (!cartOrProducts) return [];
    let items = cartOrProducts;
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { return []; }
    }
    if (!Array.isArray(items)) return [];
    return items.map((p) => {
        if (typeof p === 'string') {
            const m = p.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            return m ? { name: m[1].trim(), quantity: parseInt(m[2], 10) || 1 } : { name: p.trim(), quantity: 1 };
        }
        if (!p || typeof p !== 'object') return { name: 'Sản phẩm', quantity: 1 };
        return {
            product_id: p.product_id ?? p.id ?? null,
            name: String(p.name || p.product_name || 'Sản phẩm').trim(),
            quantity: parseInt(p.quantity, 10) || 1
        };
    }).filter((p) => p.name);
}

function buildOrderCartFingerprintForDup(items) {
    return parseOrderCartItemsForDup(items)
        .map((p) => {
            const qty = parseInt(p.quantity, 10) || 1;
            const pid = p.product_id != null && p.product_id !== '' ? String(p.product_id) : '';
            const name = String(p.name || '').trim().toLowerCase();
            return pid ? `id:${pid}x${qty}` : `n:${name}x${qty}`;
        })
        .sort()
        .join('|');
}

function orderCartSimilarityForDup(fpA, fpB) {
    if (!fpA || !fpB) return 0;
    if (fpA === fpB) return 1;
    const setA = new Set(fpA.split('|').filter(Boolean));
    const setB = new Set(fpB.split('|').filter(Boolean));
    if (!setA.size || !setB.size) return 0;
    let inter = 0;
    for (const x of setA) if (setB.has(x)) inter += 1;
    return inter / Math.max(setA.size, setB.size);
}

function orderLooksLikeDuplicateClient(newCart, existingOrder, newPhone, nowMs) {
    if (!existingOrder) return false;
    const phoneA = normalizeOrderPhoneForDup(newPhone);
    const phoneB = normalizeOrderPhoneForDup(existingOrder.customer_phone);
    if (!phoneA || phoneA !== phoneB) return false;

    const status = normalizeOrderStatusForDup(existingOrder.status);
    if (!DUPLICATE_ACTIVE_STATUSES.has(status)) return false;

    const created = Number(existingOrder.created_at_unix) || 0;
    const now = nowMs || Date.now();
    if (!created || now - created > DUPLICATE_ORDER_WINDOW_MS) return false;

    const sim = orderCartSimilarityForDup(
        buildOrderCartFingerprintForDup(newCart),
        buildOrderCartFingerprintForDup(existingOrder.products)
    );
    const hours = (now - created) / (3600000);
    if (sim >= 0.55) return true;
    if (hours <= 6 && sim >= 0.34) return true;
    if (hours <= 2 && sim > 0) return true;
    return false;
}

function summarizeDuplicateOrderClient(order) {
    const items = parseOrderCartItemsForDup(order.products);
    let preview = items.slice(0, 3).map((p) => `${p.name} ×${p.quantity || 1}`).join(', ');
    if (items.length > 3) preview += ` (+${items.length - 3})`;
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

/** Quét danh sách đơn đã tải — bỏ qua đơn đã gửi / đang vận chuyển / đã giao. */
function findLocalDuplicateOrders({ phone, cart, excludeOrderDbId, ordersList }) {
    const list = ordersList
        || (typeof allOrdersData !== 'undefined' ? allOrdersData : null)
        || (typeof allOrders !== 'undefined' ? allOrders : []);
    if (!Array.isArray(list) || !phone) return [];
    const out = [];
    for (const order of list) {
        if (excludeOrderDbId != null && Number(order.id) === Number(excludeOrderDbId)) continue;
        const st = normalizeOrderStatusForDup(order.status);
        if (!DUPLICATE_ACTIVE_STATUSES.has(st)) continue;
        if (orderLooksLikeDuplicateClient(cart, order, phone)) {
            out.push(summarizeDuplicateOrderClient(order));
        }
    }
    return out;
}

function escapeHtmlDupSafe(text) {
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function extractDuplicateOrderMatches(data) {
    if (!data || typeof data !== 'object') return [];
    const m = data.matches ?? data.duplicateMatches ?? data.duplicate_matches;
    return Array.isArray(m) ? m : [];
}

/** API trả 409 khi phát hiện đơn trùng (kể cả payload cũ chỉ có error). */
function isDuplicateOrderConflictResponse(response, data) {
    if (!response || Number(response.status) !== 409) return false;
    // POST /api/order/create chỉ trả 409 khi trùng đơn
    if (data && (data.duplicateWarning === true || data.duplicate_warning === true)) return true;
    if (extractDuplicateOrderMatches(data).length > 0) return true;
    const err = String(data?.error || data?.message || '');
    if (/trùng|trung|duplicate/i.test(err)) return true;
    return true;
}

/**
 * Hiện modal xác nhận khi API create trả 409 trùng đơn.
 * @returns {{ isConflict: boolean, proceed: boolean }}
 */
async function resolveDuplicateOrderConflictBeforeRetry(response, data, context = {}) {
    if (!isDuplicateOrderConflictResponse(response, data)) {
        return { isConflict: false, proceed: true };
    }

    let matches = extractDuplicateOrderMatches(data);
    if (!matches.length) {
        const cart = context.cart || [];
        const names = cart.map((p) => (typeof p === 'object' ? p.name : p)).filter(Boolean);
        matches = [{
            order_id: '—',
            customer_name: context.customerName || '',
            products_preview: names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${names.length - 3})` : '')
        }];
    }

    const ok = await confirmDuplicateOrderCreate(matches);
    return { isConflict: true, proceed: ok };
}

function formatDuplicateOrderWhen(ts) {
    if (!ts) return '';
    const ms = Number(ts);
    if (!Number.isFinite(ms)) return '';
    const diffMin = Math.round((Date.now() - ms) / 60000);
    if (diffMin < 1) return 'vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const h = Math.floor(diffMin / 60);
    if (h < 48) return `${h} giờ trước`;
    return typeof formatDateTimeVN === 'function' ? formatDateTimeVN(ms) : new Date(ms).toLocaleString('vi-VN');
}

function _isMobileOrderCreateOpen() {
    const p = document.getElementById('createPanel');
    return !!(p && !p.classList.contains('hidden'));
}

function _dimOrderCreateShellForDuplicateWarning(active) {
    const shells = [
        document.getElementById('addOrderModal'),
        document.getElementById('createPanel')
    ];
    for (const el of shells) {
        if (!el) continue;
        if (active) {
            el.dataset.dupWarnDimmed = '1';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.45';
        } else if (el.dataset.dupWarnDimmed === '1') {
            delete el.dataset.dupWarnDimmed;
            el.style.pointerEvents = '';
            el.style.opacity = '';
        }
    }
}

function _orderCreateShellStillOpen() {
    if (document.getElementById('addOrderModal')) return true;
    return _isMobileOrderCreateOpen();
}

function _duplicateModalMountEl() {
    return document.body;
}

function showDuplicateOrderWarningModal(matches, onConfirm, onCancel) {
    const modalId = 'duplicateOrderWarningModal';
    document.getElementById(modalId)?.remove();

    const mount = _duplicateModalMountEl();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.style.zIndex = '99999';
    overlay.style.pointerEvents = 'auto';

    _dimOrderCreateShellForDuplicateWarning(true);

    const rows = (matches || []).slice(0, 5).map((m) => {
        const when = formatDuplicateOrderWhen(m.created_at_unix);
        const amt = typeof formatCurrency === 'function' ? formatCurrency(m.total_amount) : `${m.total_amount || 0}đ`;
        const code = escapeHtmlDupSafe(m.order_id || `#${m.id}`);
        const name = escapeHtmlDupSafe(m.customer_name || '');
        const preview = escapeHtmlDupSafe(m.products_preview || '');
        return `<li class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm">
            <div class="font-semibold text-gray-900">${code} · ${name}</div>
            <div class="text-xs text-gray-600 mt-0.5">${when}${amt ? ` · ${amt}` : ''}</div>
            ${preview ? `<div class="text-xs text-gray-700 mt-1 line-clamp-2" title="${preview}">${preview}</div>` : ''}
        </li>`;
    }).join('');

    overlay.innerHTML = `
        <div id="dupOrderDialogPanel" role="dialog" aria-modal="true" aria-labelledby="dupOrderDialogTitle"
            class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden mx-auto pointer-events-auto">
            <div class="bg-amber-500 px-5 py-4">
                <h3 id="dupOrderDialogTitle" class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007"/></svg>
                    Có thể trùng đơn
                </h3>
                <p class="text-amber-50 text-sm mt-1">Cùng SĐT &amp; SP tương tự với đơn <strong>chưa gửi / gửi sau / chờ gửi lại</strong> gần đây.</p>
                <p class="text-amber-100/90 text-xs mt-1">Đơn đã gửi hàng không tính. Bạn có thể quay lại kiểm tra hoặc vẫn tạo đơn mới.</p>
            </div>
            <div class="px-5 py-4">
                <ul class="space-y-2 max-h-52 overflow-y-auto">${rows}</ul>
            </div>
            <div class="px-5 py-4 bg-gray-50 flex flex-col gap-2 border-t">
                <button type="button" id="dupOrderConfirmBtn" class="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold active:bg-amber-800">Vẫn tạo đơn trùng</button>
                <button type="button" id="dupOrderCancelBtn" class="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 active:bg-gray-100">Quay lại kiểm tra</button>
            </div>
        </div>`;

    document.body.classList.add('overflow-hidden');

    overlay.querySelector('#dupOrderDialogPanel')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    const close = () => {
        _dimOrderCreateShellForDuplicateWarning(false);
        overlay.remove();
        if (!document.getElementById('duplicateOrderWarningModal') && !_orderCreateShellStillOpen()) {
            document.body.classList.remove('overflow-hidden');
        }
    };

    overlay.querySelector('#dupOrderCancelBtn')?.addEventListener('click', () => {
        close();
        if (typeof onCancel === 'function') onCancel();
    });
    overlay.querySelector('#dupOrderConfirmBtn')?.addEventListener('click', () => {
        close();
        if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.addEventListener('click', () => {
        close();
        if (typeof onCancel === 'function') onCancel();
    });

    mount.appendChild(overlay);
}

function confirmDuplicateOrderCreate(matches) {
    return new Promise((resolve) => {
        if (!matches || !matches.length) {
            resolve(true);
            return;
        }
        showDuplicateOrderWarningModal(
            matches,
            () => resolve(true),
            () => resolve(false)
        );
    });
}

/**
 * Client guard trước khi gọi API tạo đơn.
 * @returns {Promise<boolean>} true = được phép tiếp tục (kèm acknowledgeDuplicate nếu user xác nhận)
 */
async function guardDuplicateOrderBeforeCreate({ phone, cart, excludeOrderDbId, isUpdate }) {
    if (isUpdate) return { proceed: true, acknowledgeDuplicate: false };
    const local = findLocalDuplicateOrders({ phone, cart, excludeOrderDbId });
    if (!local.length) return { proceed: true, acknowledgeDuplicate: false };
    const ok = await confirmDuplicateOrderCreate(local);
    return { proceed: ok, acknowledgeDuplicate: ok };
}

/** Gợi ý nhẹ khi nhập SĐT (debounce từ form tạo đơn). */
let _dupPhoneHintTimer = null;
function scheduleDuplicatePhoneHint(phone, cart, hintElId) {
    clearTimeout(_dupPhoneHintTimer);
    _dupPhoneHintTimer = setTimeout(() => {
        const el = document.getElementById(hintElId);
        if (!el) return;
        const matches = findLocalDuplicateOrders({ phone, cart });
        if (!matches.length) {
            el.classList.add('hidden');
            el.textContent = '';
            return;
        }
        const m = matches[0];
        const when = formatDuplicateOrderWhen(m.created_at_unix);
        el.textContent = `⚠ Đã có đơn ${m.order_id || ''} (${when}) cùng SĐT & SP tương tự`;
        el.classList.remove('hidden');
    }, 400);
}

function clearDuplicatePhoneHint(hintElId) {
    clearTimeout(_dupPhoneHintTimer);
    const el = document.getElementById(hintElId);
    if (!el) return;
    el.classList.add('hidden');
    el.textContent = '';
}
