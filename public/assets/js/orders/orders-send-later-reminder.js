/**
 * Banner nhắc đơn "Gửi sau": từ đầu ngày VN (ngày dự kiến − 7) đến hết ngày dự kiến, hoặc đã quá ngày dự kiến mà vẫn send_later.
 * Chỉ quét nặng khi ngày VN / dữ liệu đơn send_later đổi (cache input stamp). getVNStartOfToday một lần / lần quét.
 */

const _SEND_LATER_DAY_MS = 86400000;

let _sendLaterUrgentSig = '';
let _sendLaterInputStampCache = '';
let _sendLaterModalOpen = false;
let _sendLaterBannerBound = false;

function resetSendLaterUrgentBannerCache() {
    _sendLaterUrgentSig = '';
    _sendLaterInputStampCache = '';
}

/** Fingerprint nhẹ: chỉ đơn send_later + ngày VN (đổi khi qua ngày hoặc sửa id/planned). */
function _computeSendLaterInputStamp(rows) {
    const day =
        typeof getTodayDateString === 'function' ? getTodayDateString() : '';
    if (!Array.isArray(rows) || rows.length === 0) {
        return `${day}|0`;
    }
    let h = rows.length | 0;
    for (let i = 0; i < rows.length; i++) {
        const o = rows[i];
        if (String(o.status || '').toLowerCase().trim() !== 'send_later') continue;
        const id = Number(o.id) | 0;
        const p = parseOrderTimestampMs(o.planned_send_at_unix);
        const pm = Number.isFinite(p) ? p | 0 : 0;
        h = (((h << 5) - h + id) | 0) ^ pm;
    }
    return `${day}|${h}`;
}

function _plannedDayBoundsVN(plannedMs) {
    let pStr;
    try {
        pStr = new Date(plannedMs).toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    } catch {
        return null;
    }
    const pStart = new Date(pStr + 'T00:00:00+07:00').getTime();
    const pEnd = new Date(pStr + 'T23:59:59.999+07:00').getTime();
    return { pStart, pEnd };
}

/** null nếu không cần nhắc; { plannedMs } nếu cần. `todayStart` = getVNStartOfToday().getTime() (gọi 1 lần ngoài vòng lặp). */
function _sendLaterUrgentEntry(order, todayStart) {
    const st = String(order.status || '')
        .toLowerCase()
        .trim();
    if (st !== 'send_later') return null;
    const plannedMs = parseOrderTimestampMs(order.planned_send_at_unix);
    if (!Number.isFinite(plannedMs) || plannedMs <= 0) return null;
    const bounds = _plannedDayBoundsVN(plannedMs);
    if (!bounds) return null;
    const winStart = bounds.pStart - 7 * _SEND_LATER_DAY_MS;
    if (todayStart < winStart) return null;
    return { plannedMs };
}

function collectSendLaterUrgentOrders(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const todayStart = getVNStartOfToday().getTime();
    const out = [];
    for (let i = 0; i < rows.length; i++) {
        const o = rows[i];
        const entry = _sendLaterUrgentEntry(o, todayStart);
        if (!entry) continue;
        out.push({ order: o, plannedMs: entry.plannedMs });
    }
    out.sort((a, b) => a.plannedMs - b.plannedMs);
    return out;
}

function closeSendLaterUrgentModal() {
    const modal = document.getElementById('sendLaterUrgentModal');
    if (modal?.classList.contains('hidden') && !_sendLaterModalOpen) return;

    const eye = document.getElementById('sendLaterUrgentEyeBtn');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (eye) eye.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
    _sendLaterModalOpen = false;
}

function openSendLaterUrgentModal() {
    const modal = document.getElementById('sendLaterUrgentModal');
    const list = document.getElementById('sendLaterUrgentList');
    const eye = document.getElementById('sendLaterUrgentEyeBtn');
    if (!modal || !list) return;
    if (!list.querySelector('.send-later-urgent-item')) return;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (eye) eye.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
    _sendLaterModalOpen = true;

    requestAnimationFrame(() => {
        document.getElementById('sendLaterUrgentModalClose')?.focus();
    });
}

function _onSendLaterUrgentEscape(e) {
    if (e.key !== 'Escape' || !_sendLaterModalOpen) return;
    e.preventDefault();
    closeSendLaterUrgentModal();
}

function focusSendLaterOrderInTable(orderId) {
    const id = Number(orderId);
    if (!Number.isFinite(id)) return;

    const si = document.getElementById('searchInput');
    if (si) si.value = '';

    if (typeof selectStatusFilter === 'function') {
        selectStatusFilter('send_later', 'Gửi sau');
    } else {
        const h = document.getElementById('statusFilter');
        const lb = document.getElementById('statusFilterLabel');
        if (h) h.value = 'send_later';
        if (lb) lb.textContent = 'Gửi sau';
        if (typeof filterOrdersData === 'function') filterOrdersData();
    }

    const idx = filteredOrdersData.findIndex((o) => Number(o.id) === id);
    if (idx < 0) {
        showToast('Không thấy đơn trong danh sách. Kiểm tra bộ lọc ngày / CTV.', 'warning');
        return;
    }

    const ipp = typeof itemsPerPage === 'number' && itemsPerPage > 0 ? itemsPerPage : 30;
    const totalPages = Math.max(1, Math.ceil(filteredOrdersData.length / ipp) || 1);
    currentPage = Math.min(totalPages, Math.floor(idx / ipp) + 1);

    if (typeof renderOrdersTable === 'function') renderOrdersTable();

    requestAnimationFrame(() => {
        const tr = document.querySelector(`tr[data-order-id="${id}"]`);
        if (tr) {
            tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            tr.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
            setTimeout(() => tr.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'), 2200);
        }
    });
}

function updateSendLaterUrgentBanner() {
    const wrap = document.getElementById('sendLaterUrgentWrap');
    if (!wrap) return;

    if (!Array.isArray(allOrdersData)) {
        wrap.classList.add('hidden');
        closeSendLaterUrgentModal();
        return;
    }

    const inputStamp = _computeSendLaterInputStamp(allOrdersData);
    if (inputStamp === _sendLaterInputStampCache) {
        return;
    }
    _sendLaterInputStampCache = inputStamp;

    const urgent = collectSendLaterUrgentOrders(allOrdersData);
    const sig = urgent.length + '#' + urgent.map((u) => `${u.order.id}:${u.plannedMs}`).join(',');
    if (sig === _sendLaterUrgentSig) return;
    _sendLaterUrgentSig = sig;

    const txt = document.getElementById('sendLaterUrgentText');
    const list = document.getElementById('sendLaterUrgentList');
    if (!txt || !list) return;

    if (!urgent.length) {
        wrap.classList.add('hidden');
        closeSendLaterUrgentModal();
        list.innerHTML = '';
        return;
    }

    wrap.classList.remove('hidden');
    const n = urgent.length;
    txt.textContent =
        n === 1 ? 'Có 1 đơn gửi sau cần phải làm' : `Có ${n} đơn hàng gửi sau cần làm`;

    list.innerHTML = urgent
        .map(({ order }) => {
            const code = escapeHtml(String(order.order_id || order.id || ''));
            const name = escapeHtml(String(order.customer_name || '').trim() || '—');
            const parts = formatOrderTimeDisplayParts(order.planned_send_at_unix);
            const when = escapeHtml(parts.sub ? `${parts.main} · ${parts.sub}` : parts.main);
            const oid = Number(order.id);
            return `<button type="button" class="send-later-urgent-item w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/90" data-order-id="${oid}">
                <span class="block text-sm font-semibold text-gray-900">${code}</span>
                <span class="mt-0.5 block text-xs text-gray-600">${name}</span>
                <span class="mt-0.5 block text-xs font-medium text-amber-900">Dự kiến gửi: ${when}</span>
            </button>`;
        })
        .join('');
}

function initSendLaterUrgentBanner() {
    if (_sendLaterBannerBound) return;
    const eye = document.getElementById('sendLaterUrgentEyeBtn');
    const modal = document.getElementById('sendLaterUrgentModal');
    const backdrop = document.getElementById('sendLaterUrgentModalBackdrop');
    const closeBtn = document.getElementById('sendLaterUrgentModalClose');
    const list = document.getElementById('sendLaterUrgentList');
    if (!eye || !modal || !backdrop || !closeBtn || !list) return;
    _sendLaterBannerBound = true;

    eye.addEventListener('click', (e) => {
        e.stopPropagation();
        openSendLaterUrgentModal();
    });

    backdrop.addEventListener('click', () => closeSendLaterUrgentModal());
    closeBtn.addEventListener('click', () => closeSendLaterUrgentModal());

    list.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.send-later-urgent-item');
        if (!btn || !list.contains(btn)) return;
        const oid = Number(btn.getAttribute('data-order-id'));
        if (!Number.isFinite(oid)) return;
        closeSendLaterUrgentModal();
        focusSendLaterOrderInTable(oid);
    });

    document.addEventListener('keydown', _onSendLaterUrgentEscape);
}

initSendLaterUrgentBanner();
