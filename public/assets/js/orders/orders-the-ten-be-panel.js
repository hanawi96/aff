/**
 * Panel "Lọc thẻ tên" — danh sách từng dòng thẻ tên cần đặt tiệm bạc (Phase A).
 * Dùng chung logic nhận diện SP với orderHasTheTenBeProduct / _orderLineHasTheTenBeProduct.
 * Một lượt quét allOrdersData; cache stamp tránh quét lại khi dữ liệu không đổi.
 */

const _THE_TEN_BE_ACTION_STATUSES = new Set(['pending', 'awaiting_reship', 'send_later']);

const _THE_TEN_BE_STATUS_LABELS = {
    pending: 'Chưa gửi hàng',
    awaiting_reship: 'Chờ gửi lại',
    send_later: 'Gửi sau'
};

/** Ưu tiên hiển thị: chưa gửi (pending/reship) → gửi sau */
function _theTenBeStatusSortRank(status) {
    const st = String(status || 'pending').toLowerCase().trim();
    if (st === 'pending' || st === 'awaiting_reship') return 0;
    if (st === 'send_later') return 1;
    return 2;
}

let _theTenBePanelSig = '';
let _theTenBeInputStampCache = '';
let _theTenBeModalOpen = false;
let _theTenBePanelBound = false;
/** Cache dòng thẻ tên lần quét gần nhất — modal/copy dùng lại, không quét lại */
let _theTenBeLinesCache = [];

function resetTheTenBePanelCache() {
    _theTenBePanelSig = '';
    _theTenBeInputStampCache = '';
    _theTenBeLinesCache = [];
}

/** Gọi sau khi sửa/xóa đơn hoặc SP — ép làm mới cache + badge ngay. */
function refreshTheTenBePanelAfterDataChange() {
    resetTheTenBePanelCache();
    updateTheTenBePanelBanner();
}

/** Fingerprint nhẹ: đơn actionable + products length (đổi khi sửa SP / trạng thái). */
function _computeTheTenBeInputStamp(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '0';
    let h = rows.length | 0;
    for (let i = 0; i < rows.length; i++) {
        const o = rows[i];
        const st = String(o.status || 'pending').toLowerCase().trim();
        if (!_THE_TEN_BE_ACTION_STATUSES.has(st)) continue;
        if (typeof orderHasTheTenBeProduct === 'function' && !orderHasTheTenBeProduct(o)) continue;
        h = (((h << 5) - h + (Number(o.id) | 0)) | 0) ^ String(o.products || '').length;
    }
    return String(h);
}

function _theTenBeLineSizeWeight(item) {
    if (!item || typeof item !== 'object') return '';
    const raw = item.size ?? item.weight ?? '';
    if (raw == null || raw === '') return '';
    const norm = typeof normalizeOrderItemSizeClient === 'function'
        ? normalizeOrderItemSizeClient(raw)
        : String(raw).trim();
    return norm || String(raw).trim();
}

/** Tên khắc: lưu ý SP → phần sau "thẻ tên" trong tên SP → (fallback đơn xử lý ở collect) */
function _extractEngravingFromLine(item) {
    if (item == null) return '';
    if (typeof item === 'string') {
        return _extractEngravingFromProductName(item);
    }
    if (typeof item !== 'object') return '';
    const notes = item.notes && String(item.notes).trim();
    if (notes) return notes;
    for (const nm of (typeof _orderLineNameCandidates === 'function' ? _orderLineNameCandidates(item) : [item.name || ''])) {
        const fromName = _extractEngravingFromProductName(nm);
        if (fromName) return fromName;
    }
    return '';
}

function _extractEngravingFromProductName(name) {
    const marker = typeof _findTheTenBeMarkerInText === 'function'
        ? _findTheTenBeMarkerInText(name)
        : null;
    if (!marker) return '';
    let rest = marker.source.slice(marker.idx + marker.len).trim();
    rest = rest.replace(/\s*[xX×]\s*\d+\s*$/, '').trim();
    rest = rest.replace(/\s*\d+(\.\d+)?\s*(kg|cm|g)\s*$/i, '').trim();
    return rest;
}

/**
 * Quét allOrdersData → mảng dòng thẻ tên cần xử lý (mỗi SP thẻ tên = 1 dòng).
 * @returns {Array<{orderId, orderCode, customerName, productName, sizeLabel, engraveText, missingName, status, statusLabel, createdMs, plannedMs, dayKey}>}
 */
function collectTheTenBeLines(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const cat21Ids = typeof _getCategory21ProductIds === 'function'
        ? _getCategory21ProductIds()
        : new Set();

    const out = [];
    for (let i = 0; i < rows.length; i++) {
        const order = rows[i];
        const st = String(order.status || 'pending').toLowerCase().trim();
        if (!_THE_TEN_BE_ACTION_STATUSES.has(st)) continue;

        let products = [];
        try {
            products = typeof order.products === 'string'
                ? JSON.parse(order.products)
                : order.products;
            if (!Array.isArray(products)) continue;
        } catch {
            continue;
        }

        const orderNote = (order.notes || '').trim();
        let orderNoteUsed = false;
        const createdMs = parseOrderTimestampMs(order.created_at_unix);
        const plannedMs = parseOrderTimestampMs(order.planned_send_at_unix);
        const dayKey = Number.isFinite(createdMs)
            ? new Date(createdMs).toLocaleDateString('vi-VN', {
                timeZone: VIETNAM_TIMEZONE,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
            : '—';

        let orderLineCount = 0;
        for (let j = 0; j < products.length; j++) {
            const item = products[j];
            if (typeof _orderLineHasTheTenBeProduct !== 'function') continue;
            if (!_orderLineHasTheTenBeProduct(item, cat21Ids)) continue;

            let engraveText = _extractEngravingFromLine(item);
            if (!engraveText && orderNote && !orderNoteUsed) {
                engraveText = orderNote;
                orderNoteUsed = true;
            }

            const productName = typeof item === 'string'
                ? item.replace(/\s*[xX×]\s*\d+\s*$/, '').trim()
                : ((typeof _orderLineNameCandidates === 'function' ? _orderLineNameCandidates(item)[0] : null) || item.name || 'Sản phẩm');
            const sizeLabel = _theTenBeLineSizeWeight(item);

            out.push({
                orderId: Number(order.id),
                orderCode: String(order.order_id || order.id || ''),
                customerName: String(order.customer_name || '').trim() || '—',
                productName,
                sizeLabel,
                engraveText,
                missingName: !engraveText,
                status: st,
                statusLabel: _THE_TEN_BE_STATUS_LABELS[st] || st,
                createdMs: Number.isFinite(createdMs) ? createdMs : 0,
                plannedMs: Number.isFinite(plannedMs) ? plannedMs : 0,
                dayKey
            });
            orderLineCount++;
        }

        // Lưu ý đơn có "thẻ" nhưng không có dòng SP nào khớp — vẫn đưa vào panel
        if (orderLineCount === 0
            && orderNote
            && typeof _productTextHasTheTenBe === 'function'
            && _productTextHasTheTenBe(orderNote)) {
            out.push({
                orderId: Number(order.id),
                orderCode: String(order.order_id || order.id || ''),
                customerName: String(order.customer_name || '').trim() || '—',
                productName: '—',
                sizeLabel: '',
                engraveText: orderNote,
                missingName: false,
                status: st,
                statusLabel: _THE_TEN_BE_STATUS_LABELS[st] || st,
                createdMs: Number.isFinite(createdMs) ? createdMs : 0,
                plannedMs: Number.isFinite(plannedMs) ? plannedMs : 0,
                dayKey
            });
        }
    }

    out.sort((a, b) => {
        const sr = _theTenBeStatusSortRank(a.status) - _theTenBeStatusSortRank(b.status);
        if (sr !== 0) return sr;
        return b.createdMs - a.createdMs;
    });
    return out;
}

function _theTenBeLinesSignature(lines) {
    if (!lines.length) return '0';
    return lines.length + '#' + lines.map((l) =>
        `${l.orderId}:${l.productName}:${l.engraveText}:${l.missingName ? 1 : 0}`
    ).join('|');
}

function _formatTheTenBeCopyLine(line) {
    const date = line.dayKey || '—';
    const name = line.engraveText || '(THIẾU TÊN)';
    let prod = line.productName;
    if (line.sizeLabel) prod += ` ${line.sizeLabel}`;
    return `${date} - ${name} - ${prod} - ${line.orderCode}`;
}

function copyTheTenBeListToClipboard() {
    const lines = _theTenBeLinesCache;
    if (!lines.length) {
        showToast('Không có thẻ tên để copy', 'info');
        return;
    }
    const text = lines.map(_formatTheTenBeCopyLine).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Đã copy ${lines.length} dòng thẻ tên`, 'success');
        }).catch(() => {
            _fallbackCopyTheTenBe(text, lines.length);
        });
    } else {
        _fallbackCopyTheTenBe(text, lines.length);
    }
}

function _fallbackCopyTheTenBe(text, n) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast(`Đã copy ${n} dòng thẻ tên`, 'success');
    } catch {
        showToast('Không thể copy — hãy chọn thủ công', 'error');
    }
    document.body.removeChild(ta);
}

function _theTenBeStatusBadge(status, label) {
    const st = String(status || '').toLowerCase();
    let cls = 'the-ten-be-status the-ten-be-status--default';
    if (st === 'pending' || st === 'awaiting_reship') cls = 'the-ten-be-status the-ten-be-status--pending';
    else if (st === 'send_later') cls = 'the-ten-be-status the-ten-be-status--send_later';
    return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function _renderTheTenBeStats(lines) {
    const stats = document.getElementById('theTenBePanelStats');
    if (!stats) return;

    if (!lines.length) {
        stats.innerHTML = '<span class="the-ten-be-stat the-ten-be-stat--count">Không có thẻ tên cần xử lý</span>';
        return;
    }

    const orderCount = new Set(lines.map((l) => l.orderId)).size;
    const missing = lines.filter((l) => l.missingName).length;
    let html = `<span class="the-ten-be-stat the-ten-be-stat--count"><span class="the-ten-be-stat-num">${lines.length}</span> thẻ</span>`;
    html += `<span class="the-ten-be-stat the-ten-be-stat--orders"><span class="the-ten-be-stat-num">${orderCount}</span> đơn</span>`;
    if (missing > 0) {
        html += `<span class="the-ten-be-stat the-ten-be-stat--warn"><span class="the-ten-be-stat-num">${missing}</span> thiếu tên</span>`;
    }
    stats.innerHTML = html;
}

function _renderTheTenBeModalContent(lines) {
    const list = document.getElementById('theTenBePanelList');
    if (!list) return;

    _renderTheTenBeStats(lines);

    if (!lines.length) {
        list.innerHTML = `<div class="the-ten-be-empty">
            <svg class="the-ten-be-empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p>Không có thẻ tên trong các đơn chưa xử lý.</p>
        </div>`;
        return;
    }

    const groups = new Map();
    for (const line of lines) {
        const key = line.dayKey || '—';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(line);
    }

    let html = '';
    for (const [dayKey, groupLines] of groups) {
        html += `<section>
            <div class="the-ten-be-day">
                <span class="the-ten-be-day-label">Ngày đặt ${escapeHtml(dayKey)}</span>
                <span class="the-ten-be-day-count">${groupLines.length} thẻ</span>
            </div>
            <div class="the-ten-be-cards">`;

        for (const line of groupLines) {
            const missing = line.missingName;
            const dot = '<span class="the-ten-be-name-dot" aria-hidden="true"></span>';
            const nameBlock = missing
                ? `<span class="the-ten-be-name-row">${dot}<span class="the-ten-be-name the-ten-be-name--missing">Chưa có tên khắc</span></span>`
                : `<span class="the-ten-be-name-row">${dot}<span class="the-ten-be-name">${escapeHtml(line.engraveText)}</span></span>`;

            const prodParts = [line.productName];
            if (line.sizeLabel) prodParts.push(line.sizeLabel);
            const prodLine = prodParts.filter(Boolean).join(' · ');

            const planned = line.status === 'send_later' && line.plannedMs > 0
                ? `<p class="the-ten-be-planned">Gửi ${escapeHtml(formatOrderTimeDisplayParts(line.plannedMs).title || '—')}</p>`
                : '';

            const cardCls = missing ? 'the-ten-be-panel-item the-ten-be-panel-item--missing' : 'the-ten-be-panel-item';

            html += `<button type="button" class="${cardCls}" data-order-id="${line.orderId}">
                <div class="the-ten-be-panel-item-top">
                    ${nameBlock}
                    ${_theTenBeStatusBadge(line.status, line.statusLabel)}
                </div>
                <p class="the-ten-be-prod">${escapeHtml(prodLine)}</p>
                <div class="the-ten-be-meta">
                    <span class="the-ten-be-meta-code">${escapeHtml(line.orderCode)}</span>
                    <span>·</span>
                    <span>${escapeHtml(line.customerName)}</span>
                </div>
                ${planned}
            </button>`;
        }
        html += '</div></section>';
    }
    list.innerHTML = html;
}

function closeTheTenBePanelModal() {
    const modal = document.getElementById('theTenBePanelModal');
    if (modal?.classList.contains('hidden') && !_theTenBeModalOpen) return;

    const btn = document.getElementById('theTenBePanelBtn');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
    _theTenBeModalOpen = false;
}

function openTheTenBePanelModal() {
    const modal = document.getElementById('theTenBePanelModal');
    const btn = document.getElementById('theTenBePanelBtn');
    if (!modal) return;

    _renderTheTenBeModalContent(_theTenBeLinesCache);

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
    _theTenBeModalOpen = true;

    requestAnimationFrame(() => {
        document.getElementById('theTenBePanelModalClose')?.focus();
    });
}

function _onTheTenBePanelEscape(e) {
    if (e.key !== 'Escape' || !_theTenBeModalOpen) return;
    e.preventDefault();
    closeTheTenBePanelModal();
}

function focusTheTenBeOrderInTable(orderId) {
    const id = Number(orderId);
    if (!Number.isFinite(id)) return;

    const order = (allOrdersData || []).find((o) => Number(o.id) === id);
    const st = String(order?.status || 'pending').toLowerCase().trim();
    const tab = st === 'shipped' ? 'shipped' : st === 'send_later' ? 'send_later' : 'pending';

    const si = document.getElementById('searchInput');
    if (si) si.value = '';

    if (typeof selectStatusFilter === 'function') {
        const labels = { pending: 'Chưa gửi hàng', send_later: 'Gửi sau', shipped: 'Đã gửi hàng' };
        selectStatusFilter(tab, labels[tab] || 'Chưa gửi hàng');
    } else if (typeof filterOrdersData === 'function') {
        filterOrdersData();
    }

    theTenBeFilterActive = true;
    if (typeof _setTheTenBeFilterUI === 'function') _setTheTenBeFilterUI(true);

    if (typeof filterOrdersData === 'function') filterOrdersData();

    const idx = filteredOrdersData.findIndex((o) => Number(o.id) === id);
    if (idx < 0) {
        showToast('Không thấy đơn trong danh sách. Kiểm tra bộ lọc.', 'warning');
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
            tr.classList.add('ring-2', 'ring-pink-400', 'ring-offset-2');
            setTimeout(() => tr.classList.remove('ring-2', 'ring-pink-400', 'ring-offset-2'), 2200);
        }
    });
}

/** Cập nhật badge nút "Lọc thẻ tên" — gọi sau filterOrdersData / load đơn. */
function updateTheTenBePanelBanner() {
    const wrap = document.getElementById('theTenBePanelWrap');
    const badge = document.getElementById('theTenBePanelBadge');
    if (!wrap || !badge) return;

    if (!Array.isArray(allOrdersData)) {
        wrap.classList.add('hidden');
        _theTenBeLinesCache = [];
        closeTheTenBePanelModal();
        return;
    }

    const inputStamp = _computeTheTenBeInputStamp(allOrdersData)
        + '#'
        + (typeof _getCategory21ProductIds === 'function' ? _getCategory21ProductIds().size : 0);
    if (inputStamp !== _theTenBeInputStampCache) {
        _theTenBeInputStampCache = inputStamp;
        _theTenBeLinesCache = collectTheTenBeLines(allOrdersData);
    }

    const sig = _theTenBeLinesSignature(_theTenBeLinesCache);
    if (sig === _theTenBePanelSig && !wrap.classList.contains('hidden')) {
        if (_theTenBeModalOpen) _renderTheTenBeModalContent(_theTenBeLinesCache);
        return;
    }
    _theTenBePanelSig = sig;

    const n = _theTenBeLinesCache.length;
    if (n > 0) {
        wrap.classList.remove('hidden');
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.style.display = 'inline-flex';
    } else {
        wrap.classList.add('hidden');
        badge.textContent = '';
        badge.style.display = 'none';
        closeTheTenBePanelModal();
    }

    if (_theTenBeModalOpen) _renderTheTenBeModalContent(_theTenBeLinesCache);
}

function _setTheTenBeFilterUI(active) {
    const button = document.getElementById('theTenBeFilterBtn');
    if (!button) return;
    const icon = button.querySelector('svg');
    const span = button.querySelector('span');

    if (active) {
        button.classList.remove('border-gray-300', 'hover:bg-pink-50', 'hover:border-pink-300');
        button.classList.add('bg-pink-50', 'border-pink-500', 'ring-1', 'ring-pink-200');
        icon?.classList.remove('text-gray-500');
        icon?.classList.add('text-pink-600');
        span?.classList.remove('text-gray-700');
        span?.classList.add('text-pink-700', 'font-semibold');
    } else {
        button.classList.remove('bg-pink-50', 'border-pink-500', 'ring-1', 'ring-pink-200');
        button.classList.add('border-gray-300', 'hover:bg-pink-50', 'hover:border-pink-300');
        icon?.classList.remove('text-pink-600');
        icon?.classList.add('text-gray-500');
        span?.classList.remove('text-pink-700', 'font-semibold');
        span?.classList.add('text-gray-700');
    }
}

function initTheTenBePanel() {
    if (_theTenBePanelBound) return;
    const btn = document.getElementById('theTenBePanelBtn');
    const modal = document.getElementById('theTenBePanelModal');
    const backdrop = document.getElementById('theTenBePanelModalBackdrop');
    const closeBtn = document.getElementById('theTenBePanelModalClose');
    const list = document.getElementById('theTenBePanelList');
    if (!btn || !modal || !backdrop || !closeBtn || !list) return;
    _theTenBePanelBound = true;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!_theTenBeLinesCache.length) {
            showToast('Không có thẻ tên cần đặt tiệm bạc', 'info');
            return;
        }
        openTheTenBePanelModal();
    });

    backdrop.addEventListener('click', () => closeTheTenBePanelModal());
    closeBtn.addEventListener('click', () => closeTheTenBePanelModal());

    list.addEventListener('click', (ev) => {
        const item = ev.target.closest('.the-ten-be-panel-item');
        if (!item || !list.contains(item)) return;
        const oid = Number(item.getAttribute('data-order-id'));
        if (!Number.isFinite(oid)) return;
        closeTheTenBePanelModal();
        focusTheTenBeOrderInTable(oid);
    });

    document.addEventListener('keydown', _onTheTenBePanelEscape);
}

initTheTenBePanel();
