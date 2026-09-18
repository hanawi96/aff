// Orders Bulk Actions Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (selectedOrderIds, allOrdersData)

// ============================================
// CHECKBOX HANDLING
// ============================================

/**
 * Handle individual order checkbox change
 */
function handleOrderCheckbox(orderId, isChecked) {
    if (isChecked) {
        selectedOrderIds.add(orderId);
    } else {
        selectedOrderIds.delete(orderId);
    }
    _setQuickSelectActive(null);
    updateBulkActionsUI();
    scheduleSyncQuickSelectDayChipStates();
}

/**
 * Select/deselect all orders on current page
 */
function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        const orderId = parseInt(cb.dataset.orderId);
        if (checked) {
            selectedOrderIds.add(orderId);
        } else {
            selectedOrderIds.delete(orderId);
        }
    });
    if (!checked) _setQuickSelectActive(null);
    updateBulkActionsUI();
    scheduleSyncQuickSelectDayChipStates();
}

let _bulkBarHideTimer = null;
let _bulkBarVisible = false;
let _syncDayChipsRaf = null;
let _quickSelectActiveKey = null;

/**
 * Update bulk actions UI — chỉ animate lần đầu hiện / lần cuối ẩn; tick thêm checkbox chỉ đổi số.
 */
function updateBulkActionsUI() {
    const count = selectedOrderIds.size;
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');

    if (_bulkBarHideTimer != null) {
        clearTimeout(_bulkBarHideTimer);
        _bulkBarHideTimer = null;
    }

    if (!bulkActionsBar) return;

    if (count > 0) {
        if (selectedCount) selectedCount.textContent = count;

        if (_bulkBarVisible) return;

        _bulkBarVisible = true;
        bulkActionsBar.classList.remove('hidden');
        bulkActionsBar.style.transition = 'opacity 0.12s ease-out, transform 0.12s ease-out';
        bulkActionsBar.style.opacity = '1';
        bulkActionsBar.style.transform = 'translateX(-50%) translateY(0)';
        return;
    }

    if (!_bulkBarVisible) return;

    _bulkBarVisible = false;
    bulkActionsBar.style.transition = 'opacity 0.1s ease-in';
    bulkActionsBar.style.opacity = '0';
    _bulkBarHideTimer = setTimeout(() => {
        bulkActionsBar.classList.add('hidden');
        bulkActionsBar.style.transition = '';
        bulkActionsBar.style.opacity = '';
        _bulkBarHideTimer = null;
    }, 100);
}

function scheduleSyncQuickSelectDayChipStates() {
    if (_syncDayChipsRaf != null) cancelAnimationFrame(_syncDayChipsRaf);
    _syncDayChipsRaf = requestAnimationFrame(() => {
        _syncDayChipsRaf = null;
        if (document.querySelector('.quick-select-day-btn')) {
            syncQuickSelectDayChipStates();
        }
    });
}

/**
 * Clear all selections
 * @param {{ skipUI?: boolean }} [options]
 */
function clearSelection(options = {}) {
    selectedOrderIds.clear();
    document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = false);
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) selectAllCb.checked = false;
    _setQuickSelectActive(null);
    if (!options.skipUI) updateBulkActionsUI();
    syncQuickSelectDayChipStates();
}

/**
 * Highlight chip chọn nhanh (10 / 15 / 20 / page)
 */
function _setQuickSelectActive(key) {
    _quickSelectActiveKey = key;
    document.querySelectorAll('.quick-select-btn').forEach((btn) => {
        const active = key != null && btn.dataset.quickSelect === String(key);
        btn.classList.toggle('border-purple-300', active);
        btn.classList.toggle('bg-purple-100', active);
        btn.classList.toggle('text-purple-800', active);
    });
}

/**
 * Rút gọn DD/MM/YYYY → D/M (cùng năm) hoặc D/M/YYYY
 */
function _formatQuickSelectVNDate(ddmmyyyy) {
    const parts = String(ddmmyyyy || '').split('/');
    if (parts.length !== 3) return ddmmyyyy;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    const todayParts = formatDateTimeSplit(Date.now()).date.split('/');
    const todayYear = parseInt(todayParts[2], 10);
    if (y === todayYear) return `${d}/${m}`;
    return `${d}/${m}/${y}`;
}

/**
 * Ngày đặt hàng (lịch VN) của đơn — dùng created_at, không dùng shipped_at.
 */
function _getOrderPlaceDayVN(order) {
    const raw = order.created_at_unix ?? order.created_at ?? order.order_date;
    const ms = parseOrderTimestampMs(raw);
    if (!Number.isFinite(ms)) return null;
    const { date } = formatDateTimeSplit(ms);
    return date || null;
}

/**
 * Đếm đơn theo nguồn khách (mặc định thiếu field → Facebook).
 */
function countOrdersByCustomerSource(orders) {
    const counts = { facebook: 0, zalo: 0, tiktok: 0 };
    if (!Array.isArray(orders)) return counts;
    for (const o of orders) {
        const key = typeof orderCustomerSourceFilterKey === 'function'
            ? orderCustomerSourceFilterKey(o)
            : 'facebook';
        if (counts[key] != null) counts[key]++;
    }
    return counts;
}

function formatDayChipSourceTooltip(orders) {
    const counts = countOrdersByCustomerSource(orders);
    const labels = [
        { slug: 'facebook', label: 'Facebook' },
        { slug: 'zalo', label: 'Zalo' },
        { slug: 'tiktok', label: 'TikTok' }
    ];
    const parts = labels
        .filter(({ slug }) => counts[slug] > 0)
        .map(({ slug, label }) => `${label}: ${counts[slug]} đơn`);
    return parts.join(' | ');
}

/**
 * Gom đơn theo ngày đặt (lịch VN), sắp cũ → mới, tối đa N ngày.
 */
const QUICK_SELECT_MAX_DAY_CHIPS = 7;

function getOrderDayBundles(orders) {
    if (!Array.isArray(orders) || !orders.length) return [];

    const map = new Map();
    for (const o of orders) {
        const day = _getOrderPlaceDayVN(o);
        if (!day) continue;
        if (!map.has(day)) map.set(day, []);
        map.get(day).push(o);
    }

    const bundles = [];
    for (const [dateLabel, matched] of map.entries()) {
        const raw = matched[0].created_at_unix ?? matched[0].created_at ?? matched[0].order_date;
        const sortMs = parseOrderTimestampMs(raw);
        bundles.push({
            dateLabel,
            shortLabel: _formatQuickSelectVNDate(dateLabel),
            count: matched.length,
            orders: matched,
            sortMs: Number.isFinite(sortMs) ? sortMs : 0,
        });
    }

    bundles.sort((a, b) => a.sortMs - b.sortMs);
    return bundles.slice(0, QUICK_SELECT_MAX_DAY_CHIPS);
}

/**
 * Render chip từng ngày đặt hàng trong danh sách đang lọc.
 */
function updateQuickSelectDayChips() {
    const wrap = document.getElementById('quickSelectDayChips');
    if (!wrap) return;

    const bundles = getOrderDayBundles(filteredOrdersData);
    if (!bundles.length) {
        wrap.innerHTML = '';
        wrap.classList.add('hidden');
        return;
    }

    const chipClass =
        'quick-select-day-btn whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-gray-700 transition-colors hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400/40';

    wrap.classList.remove('hidden');
    wrap.innerHTML = bundles.map((b) => {
        const day = escapeHtml(b.dateLabel);
        const label = escapeHtml(`${b.shortLabel} (${b.count} đơn)`);
        const sourceTip = formatDayChipSourceTooltip(b.orders);
        const sourceTipAttr = escapeHtml(sourceTip);
        const ariaLabel = escapeHtml(`${sourceTip}. Bấm để chọn/bỏ chọn ${b.count} đơn đặt ngày ${b.dateLabel}`);
        return `<button type="button" class="${chipClass} quick-select-day-btn--tip" data-order-day="${day}" data-source-tip="${sourceTipAttr}" aria-label="${ariaLabel}">${label}</button>`;
    }).join('');

    syncQuickSelectDayChipStates();
}

function updateQuickSelectOldestDateChip() {
    updateQuickSelectDayChips();
}

/**
 * Đồng bộ highlight chip ngày theo selection hiện tại.
 */
function syncQuickSelectDayChipStates() {
    const bundles = getOrderDayBundles(filteredOrdersData);
    const bundleByDay = new Map(bundles.map((b) => [b.dateLabel, b]));

    document.querySelectorAll('.quick-select-day-btn').forEach((btn) => {
        const bundle = bundleByDay.get(btn.dataset.orderDay);
        if (!bundle) return;

        const ids = bundle.orders.map((o) => Number(o.id));
        const allSelected = ids.length > 0 && ids.every((id) => selectedOrderIds.has(id));
        const someSelected = ids.some((id) => selectedOrderIds.has(id));

        btn.classList.toggle('border-purple-300', allSelected);
        btn.classList.toggle('bg-purple-100', allSelected);
        btn.classList.toggle('text-purple-800', allSelected);
        btn.classList.toggle('border-purple-200', someSelected && !allSelected);
        btn.classList.toggle('bg-purple-50', someSelected && !allSelected);
    });
}

/**
 * Bật/tắt chọn tất cả đơn của một ngày — cộng dồn với các ngày khác.
 */
function toggleQuickSelectDay(dayKey) {
    const bundle = getOrderDayBundles(filteredOrdersData).find((b) => b.dateLabel === dayKey);
    if (!bundle?.orders.length) return;

    const ids = bundle.orders.map((o) => Number(o.id));
    const allSelected = ids.every((id) => selectedOrderIds.has(id));

    if (allSelected) {
        ids.forEach((id) => selectedOrderIds.delete(id));
    } else {
        ids.forEach((id) => selectedOrderIds.add(id));
    }

    _setQuickSelectActive(null);
    scheduleSyncQuickSelectDayChipStates();
    syncOrderTableSelection();
    updateBulkActionsUI();
}

function initQuickSelectDayChips() {
    if (initQuickSelectDayChips._bound) return;
    initQuickSelectDayChips._bound = true;

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-select-day-btn');
        if (!btn || !btn.dataset.orderDay) return;
        e.preventDefault();
        toggleQuickSelectDay(btn.dataset.orderDay);
    });
}

initQuickSelectDayChips();

/**
 * Chọn nhanh N đơn đầu danh sách đang lọc (replace selection), hoặc cả trang hiện tại.
 * @param {number} count — 10, 15, 20 (bỏ qua khi mode === 'page')
 * @param {'page'|undefined} mode
 */
function selectQuickOrders(count, mode) {
    if (!filteredOrdersData?.length) return;

    const key = mode === 'page' ? 'page' : String(Math.max(1, parseInt(count, 10) || 0));

    if (_quickSelectActiveKey === key) {
        clearSelection();
        syncOrderTableSelection();
        return;
    }

    clearSelection({ skipUI: true });

    if (mode === 'page') {
        toggleSelectAll(true);
        _setQuickSelectActive('page');
        return;
    }

    const pageBefore = currentPage;
    const n = Math.max(1, parseInt(count, 10) || 0);
    const picked = filteredOrdersData.slice(0, n);
    picked.forEach((o) => selectedOrderIds.add(Number(o.id)));

    if (typeof currentPage !== 'undefined' && currentPage !== 1) {
        currentPage = 1;
    }

    _setQuickSelectActive(key);
    scheduleSyncQuickSelectDayChipStates();

    if (pageBefore !== currentPage) {
        renderOrdersTable({ skipRowAnimation: true });
    } else {
        syncOrderTableSelection();
    }
    updateBulkActionsUI();
}

// ============================================
// BULK EXPORT
// ============================================

/**
 * Modal cảnh báo: trong các đơn đã chọn có đơn còn sản phẩm thiếu cân/size (giống copy SPX)
 * @param {Array<{ order: object, missing: string[] }>} entries
 * @param {function} onConfirm — gọi khi bấm "Có, export tiếp"
 */
function showBulkExportMissingSizeModal(entries, onConfirm) {
    const modalId = 'bulkExportMissingSizeModal';
    document.getElementById(modalId)?.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4';

    const listHtml = entries.map(({ order, missing }) => {
        const code = escapeHtml(String(order.order_id || order.id || ''));
        const names = missing.slice(0, 10).map((n) => escapeHtml(n)).join(', ');
        const more = missing.length > 10 ? ` … (+${missing.length - 10} SP)` : '';
        return `<li class="text-sm text-gray-800 border-b border-gray-100 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
            <span class="font-semibold text-amber-800">${code}</span>
            <span class="text-gray-600"> — ${names}${more}</span>
        </li>`;
    }).join('');

    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-amber-200 overflow-hidden" role="dialog" aria-modal="true">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Thiếu cân nặng / size
                </h3>
            </div>
            <div class="p-5">
                <p class="text-sm text-gray-700 mb-3">Có <strong>${entries.length}</strong> đơn (trong số đã chọn) còn sản phẩm chưa có cân hoặc size. Export Excel thường cần đủ thông tin.</p>
                <ul class="max-h-56 overflow-y-auto space-y-0 pr-1 list-none pl-0">${listHtml}</ul>
                <p class="text-sm font-medium text-gray-900 mt-4">Bạn vẫn muốn export?</p>
                <div class="flex flex-wrap gap-2 justify-end mt-5">
                    <button type="button" class="bulk-export-miss-cancel px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">Hủy</button>
                    <button type="button" class="bulk-export-miss-ok px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">Có, export tiếp</button>
                </div>
            </div>
        </div>
    `;

    const close = () => overlay.remove();

    overlay.querySelector('.bulk-export-miss-cancel').addEventListener('click', close);
    overlay.querySelector('.bulk-export-miss-ok').addEventListener('click', () => {
        close();
        onConfirm();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
}

/**
 * Sau khi qua cảnh báo thiếu size (nếu có): kiểm tra đơn đã gửi hàng rồi export
 */
async function proceedBulkExportFlow(selectedOrders) {
    const shippedOrders = selectedOrders.filter((o) => o.status === 'shipped');

    if (shippedOrders.length > 0) {
        showShippedOrdersConfirmModal(shippedOrders.length, selectedOrders);
        return;
    }

    await performExport(selectedOrders);
}

/**
 * Phát hiện trong danh sách chọn có đơn đã được xuất HĐ trước đó (đã tải về).
 * Trả về mảng đơn đã xuất + map theo id để tra nhanh.
 * @param {Array} selectedOrders
 * @returns {{ duplicates: Array, duplicateIds: Set }}
 */
function detectInvoicedDuplicates(selectedOrders) {
    const duplicates = [];
    const duplicateIds = new Set();
    for (const o of selectedOrders || []) {
        if (Number(o.invoice_exported_count || 0) > 0) {
            duplicates.push(o);
            duplicateIds.add(Number(o.id));
        }
    }
    return { duplicates, duplicateIds };
}

/**
 * Modal cảnh báo xuất trùng HĐĐT — hiển thị trước khi tạo file.
 * @param {Array} duplicates — các đơn đã xuất HĐ trước đó
 * @param {number} totalSelected — tổng số đơn đang chọn
 * @param {function(string)} onResolve — callback với 'skip' | 'all' | 'cancel'
 */
function showInvoiceDuplicateWarningModal(duplicates, totalSelected, onResolve) {
    const modalId = 'invoiceDuplicateWarningModal';
    document.getElementById(modalId)?.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4';

    const dupCount = duplicates.length;
    const skipCount = totalSelected - dupCount;

    // Gom theo file để hiển thị gọn — mỗi đơn đã xuất nằm trong 1 file gần nhất
    const fileGroups = new Map();
    for (const o of duplicates) {
        const fid = Number(o.last_invoice_export_id || 0);
        const fname = o.last_invoice_export_file_name || '(không rõ file)';
        if (!fileGroups.has(fid)) fileGroups.set(fid, { fileName: fname, orders: [] });
        fileGroups.get(fid).orders.push(o);
    }

    const fileLines = Array.from(fileGroups.values()).slice(0, 5).map((g) => {
        const codes = g.orders.slice(0, 6).map((o) => escapeHtml(String(o.order_id || o.id))).join(', ');
        const more = g.orders.length > 6 ? ` … (+${g.orders.length - 6})` : '';
        return `
            <li class="text-sm text-gray-800 border-b border-gray-100 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                <div class="font-mono text-xs text-emerald-700 mb-1 truncate" title="${escapeHtml(g.fileName)}">${escapeHtml(g.fileName)}</div>
                <div class="text-gray-700"><span class="font-semibold">${g.orders.length} đơn:</span> ${codes}${more}</div>
            </li>`;
    }).join('');
    const moreFiles = fileGroups.size > 5 ? `<li class="text-xs text-gray-500 italic">… và ${fileGroups.size - 5} file khác</li>` : '';

    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-amber-200 overflow-hidden" role="dialog" aria-modal="true">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    Phát hiện đơn đã xuất hóa đơn
                </h3>
            </div>
            <div class="p-5">
                <p class="text-sm text-gray-700 mb-3">
                    Trong <strong>${totalSelected}</strong> đơn đang chọn có <strong class="text-amber-700">${dupCount} đơn đã được xuất HĐĐT trước đó</strong>${skipCount > 0 ? ` (còn ${skipCount} đơn mới)` : ''}.
                    Xuất lại có thể tạo hóa đơn trùng.
                </p>
                <ul class="max-h-60 overflow-y-auto space-y-0 pr-1 list-none pl-0">${fileLines}${moreFiles}</ul>

                <p class="text-sm font-medium text-gray-900 mt-4">Bạn muốn xử lý thế nào?</p>
                <div class="flex flex-wrap gap-2 justify-end mt-5">
                    <button type="button" data-act="cancel" class="inv-dup-cancel px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">Hủy</button>
                    <button type="button" data-act="all" class="inv-dup-all px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium" title="Vẫn xuất tất cả ${totalSelected} đơn">Xuất lại cả ${totalSelected} đơn</button>
                    <button type="button" data-act="skip" class="inv-dup-skip px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm" title="Bỏ qua ${dupCount} đơn đã xuất, chỉ xuất ${skipCount} đơn mới">Bỏ qua đã xuất · Xuất ${skipCount} mới</button>
                </div>
            </div>
        </div>
    `;

    const close = () => overlay.remove();
    const resolve = (action) => {
        close();
        onResolve(action);
    };

    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => resolve('cancel'));
    overlay.querySelector('[data-act="all"]').addEventListener('click', () => resolve('all'));
    overlay.querySelector('[data-act="skip"]').addEventListener('click', () => resolve('skip'));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) resolve('cancel');
    });

    document.body.appendChild(overlay);
}

/**
 * Bulk Export Invoice - Export selected orders to E-Invoice Excel format (MauUploadHD.xlsx)
 * Saves to R2 and opens invoice history modal.
 *
 * Flow chống xuất trùng:
 *  - Nếu có đơn đã xuất HĐ trước đó → hiện modal cảnh báo
 *    · Mặc định chọn "Bỏ qua đơn đã xuất" → chỉ xuất các đơn mới
 *    · Có thể chọn "Xuất lại tất cả" nếu chắc chắn
 *    · Hoặc "Hủy"
 *
 * Toast flow: hiện "đang tạo" → ẩn ngay khi xong → hiện "thành công" mới (mượt, không chồng).
 */
async function bulkExportInvoice() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const TOAST_ID = 'invoice-creating';

    // Helper: ẩn toast creating (không throw nếu đã ẩn)
    const hideCreatingToast = () => {
        try { toastManager.removeById(TOAST_ID); } catch (_) { /* noop */ }
    };

    try {
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const selectedOrders = allOrdersData.filter((o) => selectedOrderIds.has(o.id));
        if (selectedOrders.length === 0) {
            showToast('Không tìm thấy dữ liệu các đơn đã chọn', 'warning');
            return;
        }

        // ===== Chống xuất trùng HĐĐT =====
        const { duplicates, duplicateIds } = detectInvoicedDuplicates(selectedOrders);
        let ordersToExport = selectedOrders;
        let skippedDuplicates = 0;

        if (duplicates.length > 0) {
            const action = await new Promise((resolve) => {
                showInvoiceDuplicateWarningModal(duplicates, selectedOrders.length, resolve);
            });
            if (action === 'cancel') {
                return; // User hủy
            }
            if (action === 'skip') {
                ordersToExport = selectedOrders.filter((o) => !duplicateIds.has(Number(o.id)));
                skippedDuplicates = duplicates.length;
                if (ordersToExport.length === 0) {
                    showToast('Tất cả đơn đã chọn đều đã được xuất HĐ trước đó. Không có gì để xuất.', 'warning', 4000);
                    return;
                }
                showToast(`Bỏ qua ${skippedDuplicates} đơn đã xuất, xuất ${ordersToExport.length} đơn mới`, 'info', 3000);
            }
            // 'all' → xuất lại tất cả
        }

        // Toast "đang tạo" với id cố định — sẽ bị ẩn ngay khi xong
        showToast('Đang tạo file hóa đơn điện tử...', 'info', 0, TOAST_ID);

        // Tạo buffer Excel (đồng bộ, nhanh vì đã có data trong RAM)
        const { buffer, filename, rowCount } = createInvoiceExcelBuffer(ordersToExport);

        // Convert sang base64 theo chunk (không block UI) rồi upload
        const base64 = await _uint8ArrayToBase64(buffer);
        const orderIds = ordersToExport.map((o) => o.id);

        const response = await fetch(`${CONFIG.API_URL}?action=saveInvoiceExport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: filename,
                fileData: base64,
                orderIds,
                orderCount: ordersToExport.length,
                invoiceRowCount: rowCount,
            }),
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Không thể lưu file hóa đơn điện tử');
        }

        // Ẩn toast "đang tạo" ngay, rồi hiện toast thành công mới (animation mượt)
        hideCreatingToast();
        const skippedNote = skippedDuplicates > 0 ? ` (bỏ qua ${skippedDuplicates} đơn đã xuất)` : '';
        showToast(
            `✅ Đã xuất hóa đơn điện tử (${ordersToExport.length} đơn, ${rowCount} dòng)${skippedNote}. Tải từ danh sách bên dưới.`,
            'success',
            4000,
        );

        // Clear selection
        clearSelection();

        // Refresh badge + mở modal DS HDDT (chạy song song, không await tuần tự)
        invoiceHistoryCache = null;
        updateInvoiceHistoryBadge();
        showInvoiceHistoryModal();
    } catch (err) {
        console.error('Error exporting e-invoice:', err);
        hideCreatingToast();
        showToast('Lỗi xuất hóa đơn: ' + (err && err.message ? err.message : err), 'error', 5000);
    }
}

/**
 * Convert Uint8Array to base64 in chunks (non-blocking).
 * @param {Uint8Array} buffer
 * @returns {Promise<string>}
 */
async function _uint8ArrayToBase64(buffer) {
    const chunkSize = 8192;
    let binary = '';
    let offset = 0;

    return new Promise((resolve) => {
        function processChunk() {
            const end = Math.min(offset + chunkSize, buffer.length);
            for (let i = offset; i < end; i++) {
                binary += String.fromCharCode(buffer[i]);
            }
            offset = end;
            if (offset < buffer.length) {
                setTimeout(processChunk, 0);
            } else {
                resolve(btoa(binary));
            }
        }
        processChunk();
    });
}

/**
 * Bulk Export - Export selected orders to SPX Excel format
 */
async function bulkExport() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    try {
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const selectedOrders = allOrdersData.filter((o) => selectedOrderIds.has(o.id));

        const missingEntries = [];
        for (const order of selectedOrders) {
            const missing = getOrderProductsMissingSizeWeight(order);
            if (missing.length > 0) {
                missingEntries.push({ order, missing });
            }
        }

        if (missingEntries.length > 0) {
            showBulkExportMissingSizeModal(missingEntries, () => {
                proceedBulkExportFlow(selectedOrders).catch((err) => {
                    console.error('Error exporting:', err);
                    showToast('Lỗi: ' + err.message, 'error');
                });
            });
            return;
        }

        await proceedBulkExportFlow(selectedOrders);
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Show confirmation modal for shipped orders
 */
function showShippedOrdersConfirmModal(shippedCount, allSelectedOrders) {
    console.log('📢 showShippedOrdersConfirmModal called');
    console.log('  Shipped count:', shippedCount);
    console.log('  All selected orders:', allSelectedOrders.length);
    
    const modal = document.getElementById('shippedOrdersConfirmModal');
    const countElement = document.getElementById('shippedOrdersCount');
    
    console.log('  Modal element:', modal);
    console.log('  Count element:', countElement);
    
    if (!modal) {
        console.error('❌ Modal element not found!');
        return;
    }
    
    if (!countElement) {
        console.error('❌ Count element not found!');
        return;
    }
    
    countElement.textContent = shippedCount;
    modal.classList.remove('hidden');
    
    console.log('  ✅ Modal shown, classes:', modal.className);
    
    // Store orders for later use
    window.pendingExportOrders = allSelectedOrders;
}

/**
 * Đóng modal xác nhận export (không export), xóa pending
 */
function closeShippedOrdersConfirmModal() {
    const modal = document.getElementById('shippedOrdersConfirmModal');
    if (modal) modal.classList.add('hidden');
    window.pendingExportOrders = null;
}

/**
 * Continue export all orders (including shipped)
 */
async function continueExportAll() {
    const modal = document.getElementById('shippedOrdersConfirmModal');
    modal.classList.add('hidden');
    
    if (window.pendingExportOrders) {
        await performExport(window.pendingExportOrders);
        window.pendingExportOrders = null;
    }
}

/**
 * Skip shipped orders and export only non-shipped
 */
async function skipShippedOrders() {
    const modal = document.getElementById('shippedOrdersConfirmModal');
    modal.classList.add('hidden');
    
    if (window.pendingExportOrders) {
        const nonShippedOrders = window.pendingExportOrders.filter(o => o.status !== 'shipped');
        
        if (nonShippedOrders.length === 0) {
            showToast('Không có đơn hàng nào để export (tất cả đã gửi hàng)', 'warning');
            window.pendingExportOrders = null;
            return;
        }
        
        showToast(`Đang export ${nonShippedOrders.length} đơn hàng (bỏ qua ${window.pendingExportOrders.length - nonShippedOrders.length} đơn đã gửi)`, 'info');
        await performExport(nonShippedOrders);
        window.pendingExportOrders = null;
    }
}

/**
 * Perform the actual export (SPX + HĐĐT đồng thời)
 */
async function performExport(orders) {
    showToast('Đang tạo file Excel...', 'info');

    // Cần tree_2 để resolve province_id/ward_id → tên (đơn extension thường thiếu *_name)
    if (window.addressSelector && !window.addressSelector.loaded) {
        try {
            await window.addressSelector.init();
        } catch (e) {
            console.warn('⚠️ Không load được tree địa chỉ trước khi export:', e);
        }
    }

    // --- 1. Export SPX ---
    const spxResult = await exportToSPXExcelAndSave(orders);

    // --- 2. Export HĐĐT đồng thời ---
    let invoiceResult = null;
    try {
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const { duplicates, duplicateIds } = detectInvoicedDuplicates(orders);
        let invoiceOrders = orders;

        if (duplicates.length > 0) {
            // Tự động bỏ qua đơn đã xuất HĐ trước đó (không hỏi modal)
            invoiceOrders = orders.filter(o => !duplicateIds.has(Number(o.id)));
            if (invoiceOrders.length === 0) {
                console.log('[performExport] Tất cả đơn đã xuất HĐ trước, bỏ qua export HĐĐT.');
            }
        }

        if (invoiceOrders.length > 0) {
            const { buffer, filename, rowCount } = createInvoiceExcelBuffer(invoiceOrders);
            const base64 = await _uint8ArrayToBase64(buffer);
            const orderIds = invoiceOrders.map(o => o.id);

            const resp = await fetch(`${CONFIG.API_URL}?action=saveInvoiceExport`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: filename,
                    fileData: base64,
                    orderIds,
                    orderCount: invoiceOrders.length,
                    invoiceRowCount: rowCount,
                }),
            });
            const data = await resp.json();
            if (data.success) {
                invoiceResult = { filename, orderCount: invoiceOrders.length, rowCount };
            } else {
                console.warn('[performExport] Lưu HĐĐT thất bại:', data.error);
            }
        }
    } catch (err) {
        console.warn('[performExport] Export HĐĐT lỗi (không ảnh hưởng SPX):', err);
    }

    // --- 3. Hiển thị kết quả ---
    let message = `✅ Đã tạo file export - ${spxResult.filename}`;
    if (invoiceResult) {
        message += `\n✅ Đã tạo file HĐĐT (${invoiceResult.orderCount} đơn, ${invoiceResult.rowCount} dòng)`;
    }
    showToast(message, 'success');

    // Clear selection
    clearSelection();

    // Invalidate cache and update badges
    exportHistoryCache = null;
    invoiceHistoryCache = null;
    await updateExportHistoryBadge();
    updateInvoiceHistoryBadge();

    // Show export history modal
    showExportHistoryModal();
}

/**
 * Load XLSX library dynamically
 */
function loadXLSXLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không thể tải thư viện Excel'));
        document.head.appendChild(script);
    });
}

// ============================================
// BULK STATUS UPDATE
// ============================================

/**
 * Show bulk status menu
 */
function showBulkStatusMenu(event) {
    event.stopPropagation();

    // Close any existing menu
    const existingMenu = document.getElementById('bulkStatusMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'pending', label: 'Chờ xử lý', color: 'yellow' },
        { value: 'shipped', label: 'Đã gửi hàng', color: 'blue' },
        { value: 'awaiting_reship', label: 'Chờ gửi lại', color: 'orange' },
        { value: 'in_transit', label: 'Đang vận chuyển', color: 'purple' },
        { value: 'delivered', label: 'Đã giao hàng', color: 'emerald' },
        { value: 'failed', label: 'Giao hàng thất bại', color: 'red' }
    ];

    // Get button position
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    // Create menu
    const menu = document.createElement('div');
    menu.id = 'bulkStatusMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]';
    menu.style.zIndex = '10000';
    menu.style.left = rect.left + 'px';
    menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="bulkUpdateStatus('${s.value}', '${s.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-sm text-gray-700 flex-1">${s.label}</span>
        </button>
    `).join('');

    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.contains(e.target) && !menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

/**
 * Bulk Update Status - Update status for selected orders
 */
async function bulkUpdateStatus(newStatus, statusLabel) {
    // Close menu
    const menu = document.getElementById('bulkStatusMenu');
    if (menu) menu.remove();

    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn đổi trạng thái ${count} đơn hàng sang "${statusLabel}"?`);

    if (!confirmed) return;

    try {
        showToast(`Đang cập nhật ${count} đơn hàng...`, 'info', 0, 'bulk-status');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateOrderStatus',
                        orderId: orderId,
                        status: newStatus
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                    const patch = { status: newStatus };
                    if (Object.prototype.hasOwnProperty.call(data, 'shipped_at_unix')) {
                        patch.shipped_at_unix = data.shipped_at_unix;
                    }
                    updateOrderData(orderId, patch);
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating order ${orderId}:`, error);
            }
        }

        // Clear selection — refilter để đơn đổi trạng thái không còn khớp bộ lọc sẽ biến khỏi danh sách
        clearSelection();
        filterOrdersData(true);

        // Show result
        if (failCount === 0) {
            showToast(`Đã cập nhật thành công ${successCount} đơn hàng sang "${statusLabel}"`, 'success', null, 'bulk-status');
        } else {
            showToast(`Đã cập nhật ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-status');
        }
    } catch (error) {
        console.error('Error bulk updating status:', error);
        showToast('Không thể cập nhật trạng thái: ' + error.message, 'error', null, 'bulk-status');
    }
}

// ============================================
// BULK DELETE
// ============================================

/**
 * Bulk Delete - Delete selected orders
 */
async function bulkDelete() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa ${count} đơn hàng đã chọn?\n\nHành động này không thể hoàn tác!`);

    if (!confirmed) return;

    try {
        showToast(`Đang xóa ${count} đơn hàng...`, 'info', 0, 'bulk-delete');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deleteOrder',
                        orderId: orderId
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error deleting order ${orderId}:`, error);
            }
        }

        // Clear selection and reload data
        clearSelection();
        await loadOrdersData();

        // Show result
        if (failCount === 0) {
            showToast(`Đã xóa thành công ${successCount} đơn hàng`, 'success', null, 'bulk-delete');
        } else {
            showToast(`Đã xóa ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-delete');
        }
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast('Không thể xóa đơn hàng: ' + error.message, 'error', null, 'bulk-delete');
    }
}

// ============================================
// BULK PRIORITY TOGGLE
// ============================================

/**
 * Bulk Toggle Priority - Mark/unmark selected orders as priority
 * @param {boolean} setPriority - true to mark as priority, false to unmark
 */
async function bulkTogglePriority(setPriority) {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const action = setPriority ? 'đánh dấu ưu tiên' : 'bỏ đánh dấu ưu tiên';

    try {
        showToast(`Đang ${action} ${count} đơn hàng...`, 'info', 0, 'bulk-priority');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggleOrderPriority',
                        orderId: orderId,
                        isPriority: setPriority ? 1 : 0 // Explicit value for bulk actions
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                    // Update local data with actual value from backend
                    updateOrderData(orderId, { is_priority: data.isPriority });
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error toggling priority for order ${orderId}:`, error);
            }
        }

        // Re-sort and re-render to move priority orders to top
        applySorting();
        renderOrdersTable();
        if (typeof updateExportPriorityButton === 'function') {
            updateExportPriorityButton();
        }
        
        // Clear selection
        clearSelection();

        // Show result
        if (failCount === 0) {
            showToast(`✅ Đã ${action} ${successCount} đơn hàng`, 'success', null, 'bulk-priority');
        } else {
            showToast(`⚠️ Đã ${action} ${successCount} đơn, ${failCount} đơn lỗi`, 'warning', null, 'bulk-priority');
        }
    } catch (error) {
        console.error('Error bulk toggling priority:', error);
        showToast(`Lỗi: ${error.message}`, 'error', null, 'bulk-priority');
    }
}

/**
 * Export all priority orders — reuses the full export flow
 * (checks missing size/weight, shipped orders, etc.)
 */
async function exportPriorityOrders() {
    const priorityOrders = Array.isArray(allOrdersData)
        ? allOrdersData.filter(o => o.is_priority === 1)
        : [];

    if (priorityOrders.length === 0) {
        showToast('Không có đơn ưu tiên nào để export', 'warning');
        return;
    }

    try {
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const missingEntries = [];
        for (const order of priorityOrders) {
            const missing = getOrderProductsMissingSizeWeight(order);
            if (missing.length > 0) missingEntries.push({ order, missing });
        }

        if (missingEntries.length > 0) {
            showBulkExportMissingSizeModal(missingEntries, () => {
                proceedBulkExportFlow(priorityOrders).catch(err => {
                    console.error('Error exporting priority orders:', err);
                    showToast('Lỗi: ' + err.message, 'error');
                });
            });
            return;
        }

        await proceedBulkExportFlow(priorityOrders);
    } catch (error) {
        console.error('Error exporting priority orders:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Show/hide the "Export ưu tiên" button based on current priority order count.
 * Called after data loads or priority changes.
 */
function updateExportPriorityButton() {
    const btn = document.getElementById('exportPriorityBtn');
    const countEl = document.getElementById('exportPriorityCount');
    if (!btn) return;

    const n = Array.isArray(allOrdersData)
        ? allOrdersData.filter(o => o.is_priority === 1).length
        : 0;

    if (n === 0) {
        btn.classList.add('hidden');
    } else {
        btn.classList.remove('hidden');
        if (countEl) countEl.textContent = n;
    }
}
