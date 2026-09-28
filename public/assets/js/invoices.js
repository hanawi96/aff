// =============================================================================
// Trang "Hóa đơn điện tử" (invoices.html)
// Hiển thị đơn ĐÃ GỬI HÀNG (shipped), cho phép: xuất HĐĐT 1 đơn / hàng loạt,
// đổi trạng thái xuất HĐĐT. Dùng chung API với trang đơn hàng nên đồng bộ tự nhiên:
//   - getOrdersHistoryPage (statusFilter=shipped, cursor pagination)
//   - saveInvoiceExport / markExportDownloaded / getInvoiceExportHistory
//   - toggleInvoiceExportStatus
// Tái dùng hàm build Excel từ invoice-export.js (createInvoiceExcelBuffer).
// =============================================================================

// ---- State ----
let invOrders = [];                 // đơn của trang hiện tại
const invSelectedIds = new Set();   // id đơn đang chọn (trong trang hiện tại)
let invInvoiceFilter = 'all';       // all | not_exported | exported
let invSearchTerm = '';
const INV_PAGE_SIZE = 30;
const invState = {
    loading: false,
    hasMore: false,
    pageIndex: 0,
    cursorStack: [],   // cursor đầu mỗi trang đã đi qua
    nextCursor: null,
};
let _invSearchDebounce = null;

// ---- Helpers ----
function invFormatCurrency(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('vi-VN') + 'đ';
}

function invEscapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function invFormatDate(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '—';
    const d = new Date(n);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Đơn đã xuất HĐĐT? (đồng bộ điều kiện backend: invoice_exported_at>0 HOẶC manual=1) */
function invIsExported(o) {
    return Number(o.invoice_exported_at || 0) > 0 || Number(o.manual_invoice_exported || 0) === 1;
}

/** Tải XLSX lazy (tự chứa, không phụ thuộc bundle trang đơn hàng). */
function invLoadXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Không thể tải thư viện Excel'));
        document.head.appendChild(s);
    });
}

// ============================================
// UI STATE
// ============================================
function invShowLoading() {
    document.getElementById('invLoadingState')?.classList.remove('hidden');
    document.getElementById('invTableContent')?.classList.add('hidden');
    document.getElementById('invEmptyState')?.classList.add('hidden');
}
function invShowTable() {
    document.getElementById('invLoadingState')?.classList.add('hidden');
    document.getElementById('invTableContent')?.classList.remove('hidden');
    document.getElementById('invEmptyState')?.classList.add('hidden');
}
function invShowEmpty() {
    document.getElementById('invLoadingState')?.classList.add('hidden');
    document.getElementById('invTableContent')?.classList.add('hidden');
    document.getElementById('invEmptyState')?.classList.remove('hidden');
}

/** Toast "đang xử lý" ở góc (dùng chung toast-manager). */
function invSetBusyToast(show, message) {
    if (show) {
        showToast(message || 'Đang xử lý...', 'info', 0, 'inv-busy');
    } else if (typeof toastManager !== 'undefined') {
        toastManager.removeById('inv-busy');
    }
}

// ============================================
// FILTER BAR
// ============================================
function _syncInvFilterButtons() {
    document.querySelectorAll('.inv-filter-btn').forEach((btn) => {
        const active = btn.getAttribute('data-invfilter') === invInvoiceFilter;
        btn.classList.toggle('bg-white', active);
        btn.classList.toggle('text-emerald-700', active);
        btn.classList.toggle('shadow-sm', active);
        btn.classList.toggle('text-slate-600', !active);
    });
}

function setInvoiceFilter(value) {
    if (invInvoiceFilter === value) return;
    invInvoiceFilter = value;
    _syncInvFilterButtons();
    invLoadFirstPage();
}

// ============================================
// LOAD DATA (cursor pagination, statusFilter=shipped)
// ============================================
function _invBuildParams(cursor) {
    const p = new URLSearchParams();
    p.set('action', 'getOrdersHistoryPage');
    p.set('statusFilter', 'shipped');
    p.set('invoiceStatusFilter', invInvoiceFilter);
    p.set('dateField', 'shipped');
    p.set('sortDir', 'desc');
    p.set('limit', String(INV_PAGE_SIZE));
    if (cursor && Number.isFinite(cursor.sort) && Number.isFinite(cursor.id)) {
        p.set('cursorSort', String(cursor.sort));
        p.set('cursorId', String(cursor.id));
    }
    p.set('timestamp', String(Date.now()));
    return p;
}

async function _invFetchPage(cursor, pageIndex) {
    if (invState.loading) return;
    invState.loading = true;

    const hadData = invOrders.length > 0;
    if (!hadData) invShowLoading();
    else invSetBusyToast(true, 'Đang tải đơn hàng...');

    try {
        const res = await fetch(`${CONFIG.API_URL}?${_invBuildParams(cursor).toString()}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Không tải được đơn hàng');

        // Server tìm kiếm không có ở endpoint này → lọc theo searchTerm ở client trên trang hiện tại.
        let orders = data.orders || [];
        if (invSearchTerm) {
            const t = invSearchTerm.toLowerCase();
            orders = orders.filter((o) =>
                String(o.order_id || '').toLowerCase().includes(t) ||
                String(o.customer_name || '').toLowerCase().includes(t) ||
                String(o.customer_phone || '').toLowerCase().includes(t)
            );
        }

        invOrders = orders;
        invState.hasMore = !!data.hasMore;
        invState.nextCursor = data.nextCursor || null;
        invState.pageIndex = pageIndex;
        clearInvSelection();
        invState.loading = false;
        invRender();
    } catch (err) {
        console.error('[Invoices] Lỗi tải trang:', err);
        showToast('Không tải được danh sách đơn: ' + err.message, 'error');
        invState.loading = false;
    } finally {
        invSetBusyToast(false);
    }
}

function invLoadFirstPage() {
    invState.pageIndex = 0;
    invState.cursorStack = [null];
    invState.nextCursor = null;
    invState.hasMore = false;
    _invFetchPage(null, 1);
}

function invNextPage() {
    if (invState.loading || !invState.hasMore || !invState.nextCursor) return;
    invState.cursorStack.push(invState.nextCursor);
    _invFetchPage(invState.nextCursor, invState.pageIndex + 1);
}

function invPrevPage() {
    if (invState.loading || invState.pageIndex <= 1) return;
    invState.cursorStack.pop();
    const prev = invState.cursorStack[invState.cursorStack.length - 1];
    _invFetchPage(prev || null, invState.pageIndex - 1);
}

// ============================================
// RENDER
// ============================================
function invRender() {
    const tbody = document.getElementById('invTableBody');
    if (!tbody) return;

    const countLabel = document.getElementById('invCountLabel');
    if (countLabel) countLabel.textContent = invOrders.length ? ` (trang ${invState.pageIndex})` : '';

    if (invOrders.length === 0) {
        invShowEmpty();
        _updateInvBulkBar();
        _renderInvPagination();
        return;
    }

    const base = (invState.pageIndex - 1) * INV_PAGE_SIZE;
    tbody.innerHTML = invOrders.map((o, i) => {
        const exported = invIsExported(o);
        // Thời gian xuất = mốc tải file HĐĐT về (invoice_exported_at; fallback last_invoice_downloaded_at)
        const exportedAtMs = Number(o.invoice_exported_at || 0) || Number(o.last_invoice_downloaded_at || 0);
        const exportedTimeHtml = (exported && exportedAtMs > 0)
            ? `<div class="text-[11px] text-slate-400 mt-1">${invFormatDate(exportedAtMs)}</div>`
            : (exported ? `<div class="text-[11px] text-slate-300 mt-1">Đánh dấu thủ công</div>` : '');
        const badge = exported
            ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Đã xuất${Number(o.invoice_exported_count || 0) > 1 ? ' ×' + o.invoice_exported_count : ''}
               </span>${exportedTimeHtml}`
            : `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">Chưa xuất</span>`;

        // Đơn ĐÃ XUẤT (thủ công hoặc qua hệ thống) → nút "Hủy xuất" (reset về chưa xuất).
        // Đơn CHƯA XUẤT → nút "Đánh dấu" (đánh dấu thủ công đã xuất).
        const toggleBtn = exported
            ? `<button onclick="invCancelExport(${o.id})" title="Hủy xuất HĐĐT (đưa về chưa xuất)"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all">
                    Hủy xuất
               </button>`
            : `<button onclick="invToggle(${o.id}, false)" title="Đánh dấu đã xuất HĐĐT"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all">
                    Đánh dấu
               </button>`;

        const exportOneBtn = `<button onclick="invExportOne(${o.id})" title="Xuất HĐĐT đơn này"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all inline-flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Xuất
           </button>`;

        const detailBtn = `<button onclick="invShowDetail(${o.id})" title="Xem chi tiết đơn hàng"
                class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all inline-flex items-center justify-center">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
           </button>`;

        return `<tr class="fade-in hover:bg-slate-50/70 transition-colors">
            <td class="px-4 py-3 text-center">
                <input type="checkbox" class="inv-row-cb w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" data-id="${o.id}" ${invSelectedIds.has(Number(o.id)) ? 'checked' : ''} onchange="invToggleRow(${o.id}, this.checked)">
            </td>
            <td class="px-4 py-3">
                <div class="text-sm font-mono font-semibold text-slate-900">${invEscapeHtml(o.order_id || 'N/A')}</div>
                <div class="text-xs text-slate-400">#${base + i + 1}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm font-medium text-slate-800">${invEscapeHtml(o.customer_name || 'N/A')}</div>
                <div class="text-xs text-slate-400">${invEscapeHtml(o.customer_phone || '')}</div>
            </td>
            <td class="px-4 py-3 text-right text-sm font-semibold text-slate-800 tabular-nums">${invFormatCurrency(o.total_amount)}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">${_invParseProducts(o.products).length} phân loại</span>
            </td>
            <td class="px-4 py-3 text-sm text-slate-600">${invFormatDate(o.shipped_at_unix)}</td>
            <td class="px-4 py-3 text-center">${badge}</td>
            <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-2">${detailBtn}${exportOneBtn}${toggleBtn}</div>
            </td>
        </tr>`;
    }).join('');

    invShowTable();
    _syncInvSelectAll();
    _updateInvBulkBar();
    _renderInvPagination();
}

function _renderInvPagination() {
    const info = document.getElementById('invPageInfo');
    const prev = document.getElementById('invPrevBtn');
    const next = document.getElementById('invNextBtn');
    if (info) info.textContent = `Trang ${invState.pageIndex} · ${invOrders.length} đơn`;
    if (prev) prev.disabled = invState.pageIndex <= 1 || invState.loading;
    if (next) next.disabled = !invState.hasMore || invState.loading;
}

// ============================================
// SELECTION
// ============================================
function invToggleRow(id, checked) {
    const n = Number(id);
    if (checked) invSelectedIds.add(n); else invSelectedIds.delete(n);
    _syncInvSelectAll();
    _updateInvBulkBar();
}

function toggleSelectAllInv(checked) {
    document.querySelectorAll('.inv-row-cb').forEach((cb) => {
        const id = Number(cb.dataset.id);
        cb.checked = checked;
        if (checked) invSelectedIds.add(id); else invSelectedIds.delete(id);
    });
    _updateInvBulkBar();
}

function _syncInvSelectAll() {
    const cbs = document.querySelectorAll('.inv-row-cb');
    const all = document.getElementById('invSelectAll');
    if (all) all.checked = cbs.length > 0 && Array.from(cbs).every((cb) => cb.checked);
}

function clearInvSelection() {
    invSelectedIds.clear();
    document.querySelectorAll('.inv-row-cb').forEach((cb) => { cb.checked = false; });
    const all = document.getElementById('invSelectAll');
    if (all) all.checked = false;
    _updateInvBulkBar();
}

function _updateInvBulkBar() {
    const bar = document.getElementById('invBulkBar');
    const count = document.getElementById('invSelectedCount');
    if (count) count.textContent = String(invSelectedIds.size);
    if (bar) bar.classList.toggle('hidden', invSelectedIds.size === 0);
}

/** Lấy object đơn đã chọn từ trang hiện tại. */
function _invSelectedOrders() {
    return invOrders.filter((o) => invSelectedIds.has(Number(o.id)));
}

// ============================================
// EXPORT (lưu R2 → mở modal DS file → tải → đánh dấu) — luồng A giống trang đơn hàng
// ============================================
async function _invExportOrders(orders) {
    if (!orders || orders.length === 0) {
        showToast('Không có đơn nào để xuất', 'warning');
        return;
    }
    invSetBusyToast(true, `Đang tạo file HĐĐT (${orders.length} đơn)...`);
    try {
        await invLoadXLSX();
        // exportInvoiceToR2AndSave (invoice-export.js): build Excel → base64 → saveInvoiceExport.
        const result = await exportInvoiceToR2AndSave(orders);
        invSetBusyToast(false);
        showToast(`✅ Đã tạo file HĐĐT (${result.orderCount} đơn) — mở danh sách để tải về`, 'success', 4000);
        clearInvSelection();
        // Mở modal DS file HĐĐT và highlight file vừa tạo (bước tải sẽ đánh dấu đơn đã xuất).
        await openInvoiceHistory(result.exportId);
    } catch (err) {
        invSetBusyToast(false);
        console.error('[Invoices] Export error:', err);
        showToast('Lỗi xuất HĐĐT: ' + err.message, 'error');
    }
}

function invExportOne(orderId) {
    const o = invOrders.find((x) => Number(x.id) === Number(orderId));
    if (!o) { showToast('Không tìm thấy đơn hàng', 'warning'); return; }
    _invExportOrders([o]);
}

function bulkExportInvoicesPage() {
    const orders = _invSelectedOrders();
    if (orders.length === 0) { showToast('Vui lòng chọn ít nhất một đơn', 'warning'); return; }
    _invExportOrders(orders);
}

// ============================================
// MODAL XÁC NHẬN (dùng chung — Promise: resolve(true/false))
// ============================================
/**
 * Hiện modal xác nhận nhỏ gọn, hiện đại. Trả Promise<boolean>.
 * @param {{title, message, confirmText, cancelText, tone}} opts  tone: 'emerald' | 'red'
 */
function invConfirm(opts = {}) {
    const {
        title = 'Xác nhận',
        message = '',
        confirmText = 'Xác nhận',
        cancelText = 'Hủy',
        tone = 'emerald'
    } = opts;

    return new Promise((resolve) => {
        document.getElementById('invConfirmModal')?.remove();

        const toneMap = {
            emerald: { ring: '#d1fae5', icon: '#10b981', iconBg: '#ecfdf5', btn: 'background:#10b981;', btnHover: 'emerald' },
            red: { ring: '#fee2e2', icon: '#ef4444', iconBg: '#fef2f2', btn: 'background:#ef4444;', btnHover: 'red' }
        };
        const t = toneMap[tone] || toneMap.emerald;

        const iconPath = tone === 'red'
            ? 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'
            : 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

        const overlay = document.createElement('div');
        overlay.id = 'invConfirmModal';
        overlay.className = 'fixed inset-0 z-[140] flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" data-inv-confirm-cancel></div>
            <div class="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden fade-in">
                <div class="p-6 text-center">
                    <div class="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style="background:${t.iconBg};">
                        <svg class="w-7 h-7" style="color:${t.icon};" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                            <path stroke-linecap="round" stroke-linejoin="round" d="${iconPath}" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-slate-900">${invEscapeHtml(title)}</h3>
                    <p class="text-sm text-slate-500 mt-2 leading-relaxed">${message}</p>
                </div>
                <div class="px-6 pb-6 flex gap-3">
                    <button type="button" data-inv-confirm-cancel class="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all">${invEscapeHtml(cancelText)}</button>
                    <button type="button" data-inv-confirm-ok class="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-105" style="${t.btn}">${invEscapeHtml(confirmText)}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.body.classList.add('overflow-hidden');

        const close = (result) => {
            overlay.remove();
            document.body.classList.remove('overflow-hidden');
            resolve(result);
        };

        overlay.querySelectorAll('[data-inv-confirm-cancel]').forEach((el) =>
            el.addEventListener('click', () => close(false)));
        overlay.querySelector('[data-inv-confirm-ok]').addEventListener('click', () => close(true));
    });
}

// ============================================
// TOGGLE trạng thái xuất HĐĐT (1 đơn)
// ============================================
async function invToggle(orderId, currentExported) {
    const newIsExported = !currentExported;
    const o = invOrders.find((x) => Number(x.id) === Number(orderId));
    const code = o ? (o.order_id || `#${orderId}`) : `#${orderId}`;

    const ok = await invConfirm({
        title: 'Đánh dấu đã xuất HĐĐT',
        message: `Đánh dấu đơn <span class="font-semibold text-slate-700">${invEscapeHtml(code)}</span> là <b>đã xuất hóa đơn điện tử</b>?`,
        confirmText: 'Đánh dấu',
        cancelText: 'Hủy',
        tone: 'emerald'
    });
    if (!ok) return;

    invSetBusyToast(true, 'Đang cập nhật...');
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=toggleInvoiceExportStatus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggleInvoiceExportStatus', orderId: Number(orderId), isExported: newIsExported })
        });
        const data = await res.json();
        invSetBusyToast(false);
        if (!data.success) throw new Error(data.error || 'Lỗi cập nhật');

        // Cập nhật đơn trong danh sách hiện tại theo response (đồng bộ badge ngay).
        const o = invOrders.find((x) => Number(x.id) === Number(orderId));
        if (o) {
            o.invoice_exported_count = data.invoice_exported_count || 0;
            o.invoice_exported_at = data.invoice_exported_at || 0;
            o.manual_invoice_exported = newIsExported ? 1 : 0;
            o.last_invoice_export_id = data.last_invoice_export_id ?? null;
            o.last_invoice_export_file_name = data.last_invoice_export_file_name ?? null;
        }
        showToast(data.message || (newIsExported ? 'Đã đánh dấu đã xuất HĐĐT' : 'Đã bỏ đánh dấu'), 'success');

        // Nếu đang lọc theo trạng thái HĐĐT → đơn có thể không còn khớp, tải lại trang.
        if (invInvoiceFilter !== 'all') {
            _invFetchPage(invState.cursorStack[invState.cursorStack.length - 1] || null, invState.pageIndex);
        } else {
            invRender();
        }
    } catch (err) {
        invSetBusyToast(false);
        console.error('[Invoices] Toggle error:', err);
        showToast('Lỗi: ' + err.message, 'error');
    }
}

/** Hủy xuất HĐĐT (reset đơn về "chưa xuất") — dùng action cancelInvoiceExport. */
async function invCancelExport(orderId) {
    const o = invOrders.find((x) => Number(x.id) === Number(orderId));
    const code = o ? (o.order_id || `#${orderId}`) : `#${orderId}`;

    const ok = await invConfirm({
        title: 'Hủy xuất HĐĐT',
        message: `Đưa đơn <span class="font-semibold text-slate-700">${invEscapeHtml(code)}</span> về trạng thái <b>chưa xuất</b>?<br><span class="text-xs text-slate-400">File HĐĐT đã tạo trong lịch sử vẫn được giữ.</span>`,
        confirmText: 'Hủy xuất',
        cancelText: 'Không',
        tone: 'red'
    });
    if (!ok) return;

    invSetBusyToast(true, 'Đang hủy xuất HĐĐT...');
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=cancelInvoiceExport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancelInvoiceExport', orderId: Number(orderId) })
        });
        const data = await res.json();
        invSetBusyToast(false);
        if (!data.success) throw new Error(data.error || 'Lỗi hủy xuất');

        if (o) {
            o.invoice_exported_at = 0;
            o.manual_invoice_exported = 0;
            o.invoice_exported_count = data.invoice_exported_count || 0;
            o.last_invoice_export_id = data.last_invoice_export_id ?? null;
            o.last_invoice_export_file_name = data.last_invoice_export_file_name ?? null;
        }
        showToast(data.message || 'Đã hủy xuất HĐĐT', 'success');

        // Nếu đang lọc theo trạng thái HĐĐT → đơn có thể không còn khớp, tải lại trang.
        if (invInvoiceFilter !== 'all') {
            _invFetchPage(invState.cursorStack[invState.cursorStack.length - 1] || null, invState.pageIndex);
        } else {
            invRender();
        }
    } catch (err) {
        invSetBusyToast(false);
        console.error('[Invoices] Cancel export error:', err);
        showToast('Lỗi: ' + err.message, 'error');
    }
}

/** Hủy xuất HĐĐT HÀNG LOẠT cho các đơn ĐÃ CHỌN đang ở trạng thái đã xuất. */
async function bulkCancelInvoicesPage() {
    const selected = _invSelectedOrders();
    if (selected.length === 0) { showToast('Vui lòng chọn ít nhất một đơn', 'warning'); return; }

    // Chỉ hủy được đơn đang "đã xuất"; đơn chưa xuất bỏ qua.
    const targets = selected.filter((o) => invIsExported(o));
    const skipped = selected.length - targets.length;

    if (targets.length === 0) {
        showToast('Các đơn đã chọn đều CHƯA xuất HĐĐT — không có gì để hủy', 'info');
        return;
    }

    const ok = await invConfirm({
        title: 'Hủy xuất HĐĐT hàng loạt',
        message: `Hủy xuất HĐĐT cho <b>${targets.length}</b> đơn đã chọn, đưa về trạng thái <b>chưa xuất</b>?`
            + (skipped > 0 ? `<br><span class="text-xs text-slate-400">${skipped} đơn chưa xuất sẽ được bỏ qua.</span>` : '')
            + `<br><span class="text-xs text-slate-400">File HĐĐT đã tạo trong lịch sử vẫn được giữ.</span>`,
        confirmText: 'Hủy xuất',
        cancelText: 'Không',
        tone: 'red'
    });
    if (!ok) return;

    invSetBusyToast(true, `Đang hủy xuất ${targets.length} đơn...`);
    let done = 0, fail = 0;
    for (const o of targets) {
        try {
            const res = await fetch(`${CONFIG.API_URL}?action=cancelInvoiceExport`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancelInvoiceExport', orderId: Number(o.id) })
            });
            const data = await res.json();
            if (data.success) {
                done++;
                // Cập nhật local để render lại đúng ngay
                o.invoice_exported_at = 0;
                o.manual_invoice_exported = 0;
                o.invoice_exported_count = data.invoice_exported_count || 0;
            } else {
                fail++;
            }
        } catch (err) {
            fail++;
            console.error(`[Invoices] Cancel error order ${o.id}:`, err);
        }
    }
    invSetBusyToast(false);
    clearInvSelection();

    if (fail === 0) {
        showToast(`✅ Đã hủy xuất ${done} đơn` + (skipped > 0 ? ` · bỏ qua ${skipped} đơn chưa xuất` : ''), 'success', 4000);
    } else {
        showToast(`Hủy xong ${done} đơn, thất bại ${fail} đơn`, 'warning', 5000);
    }

    // Tải lại trang hiện tại để đồng bộ (đặc biệt khi đang lọc theo trạng thái HĐĐT).
    _invFetchPage(invState.cursorStack[invState.cursorStack.length - 1] || null, invState.pageIndex || 1);
}

// ============================================
// MODAL: Danh sách file HĐĐT đã tạo (tải về → đánh dấu đơn đã xuất)
// ============================================
async function openInvoiceHistory(highlightExportId = null) {
    let modal = document.getElementById('invHistoryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'invHistoryModal';
        modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeInvoiceHistory()"></div>
            <div class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div>
                        <h3 class="text-lg font-bold text-slate-900">Lịch sử xuất HĐĐT</h3>
                        <p class="text-xs text-slate-500 mt-0.5">Tải file về để đánh dấu đơn "đã xuất"</p>
                    </div>
                    <button onclick="closeInvoiceHistory()" class="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div id="invHistoryList" class="flex-1 overflow-y-auto p-4 space-y-2"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    await _renderInvHistoryList(highlightExportId);
}

function closeInvoiceHistory() {
    const modal = document.getElementById('invHistoryModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

async function _renderInvHistoryList(highlightExportId) {
    const list = document.getElementById('invHistoryList');
    if (!list) return;
    list.innerHTML = `<div class="p-6 text-center text-sm text-slate-400">Đang tải...</div>`;
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=getInvoiceExportHistory&timestamp=${Date.now()}`);
        const data = await res.json();
        const exports = (data && data.success && data.exports) ? data.exports : [];
        if (exports.length === 0) {
            list.innerHTML = `<div class="p-8 text-center">
                <p class="text-sm font-medium text-slate-600">Chưa có file HĐĐT nào</p>
                <p class="text-xs text-slate-400 mt-1">Xuất HĐĐT để tạo file đầu tiên</p>
            </div>`;
            return;
        }
        list.innerHTML = exports.map((e) => {
            const downloaded = e.status === 'downloaded';
            const hi = highlightExportId && Number(e.id) === Number(highlightExportId);
            return `<div class="flex items-center gap-3 p-3 rounded-xl border ${hi ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-slate-200 bg-white'} transition-all">
                <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-slate-800 truncate">${invEscapeHtml(e.file_name)}</div>
                    <div class="text-xs text-slate-400">${e.order_count} đơn · ${e.invoice_row_count || 0} dòng · ${invFormatDate(e.created_at)}
                        ${downloaded ? '<span class="text-emerald-600 font-medium">· đã tải</span>' : '<span class="text-amber-600 font-medium">· chưa tải</span>'}</div>
                </div>
                <button onclick="invDownloadExport(${e.id})" class="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Tải về
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        console.error('[Invoices] History error:', err);
        list.innerHTML = `<div class="p-6 text-center text-sm text-red-500">Lỗi tải lịch sử: ${invEscapeHtml(err.message)}</div>`;
    }
}

/** Tải file HĐĐT: tải file về máy + gọi markExportDownloaded để đánh dấu đơn đã xuất. */
async function invDownloadExport(exportId) {
    // Tải file về máy
    const link = document.createElement('a');
    link.href = `${CONFIG.API_URL}?action=downloadExport&id=${exportId}`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Đánh dấu đã tải → backend set invoice_exported_at cho các đơn đủ điều kiện.
    // LƯU Ý: HĐĐT dùng action riêng 'markInvoiceExportDownloaded' (type='invoice'),
    // KHÔNG phải 'markExportDownloaded' (dùng cho export SPX).
    try {
        const res = await fetch(`${CONFIG.API_URL}?action=markInvoiceExportDownloaded`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markInvoiceExportDownloaded', exportId: Number(exportId) })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Đã tải file · đánh dấu ${data.updatedCount || 0} đơn đã xuất HĐĐT`, 'success', 4000);
        }
    } catch (err) {
        console.error('[Invoices] markExportDownloaded error:', err);
    }

    // Làm mới danh sách file + bảng đơn (đồng bộ trạng thái mới)
    await _renderInvHistoryList(exportId);
    _invFetchPage(invState.cursorStack[invState.cursorStack.length - 1] || null, invState.pageIndex || 1);
}

// ============================================
// MODAL CHI TIẾT ĐƠN HÀNG
// ============================================
/** Parse products (JSON string / array) → mảng item chuẩn. */
function _invParseProducts(products) {
    if (!products) return [];
    let arr = products;
    if (typeof products === 'string') {
        try { arr = JSON.parse(products); } catch { return []; }
    }
    return Array.isArray(arr) ? arr : [];
}

/** Địa chỉ đầy đủ từ các phần (ưu tiên tách phần, fallback address gộp). */
function _invFullAddress(o) {
    const parts = [o.street_address, o.ward_name, o.district_name, o.province_name].filter(Boolean);
    return parts.join(', ') || o.address || '—';
}

const INV_PAYMENT_LABEL = { bank: 'Chuyển khoản', cod: 'COD (thu hộ)' };
function _invPaymentLabel(pm) {
    const s = String(pm || '').toLowerCase().trim();
    const isBank = ['bank', 'bank_transfer', 'transfer', 'chuyen_khoan', 'ck'].includes(s);
    return isBank ? INV_PAYMENT_LABEL.bank : INV_PAYMENT_LABEL.cod;
}

const INV_SOURCE_LABEL = { zalo: 'Zalo', facebook: 'Facebook', tiktok: 'TikTok', web: 'Web' };

function invShowDetail(orderId) {
    const o = invOrders.find((x) => Number(x.id) === Number(orderId));
    if (!o) { showToast('Không tìm thấy đơn hàng', 'warning'); return; }

    const products = _invParseProducts(o.products);
    const productRows = products.length
        ? products.map((p, i) => {
            const name = invEscapeHtml(p.name || p.product_name || 'Sản phẩm');
            const size = p.size ? ` <span class="text-xs text-slate-400">(${invEscapeHtml(p.size)})</span>` : '';
            const qty = Number(p.quantity || 1);
            const price = Number(p.price || 0);
            const note = p.notes ? `<div class="text-xs text-amber-600 mt-0.5">${invEscapeHtml(p.notes)}</div>` : '';
            return `<tr class="border-b border-slate-100 last:border-0">
                <td class="py-2 pr-2 text-sm text-slate-400 align-top">${i + 1}</td>
                <td class="py-2 pr-2 text-sm text-slate-800 align-top">${name}${size}${note}</td>
                <td class="py-2 px-2 text-sm text-slate-600 text-center align-top tabular-nums">${qty}</td>
                <td class="py-2 pl-2 text-sm text-slate-800 text-right align-top tabular-nums">${invFormatCurrency(price)}</td>
                <td class="py-2 pl-2 text-sm font-medium text-slate-900 text-right align-top tabular-nums">${invFormatCurrency(qty * price)}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="5" class="py-3 text-center text-sm text-slate-400">Không có chi tiết sản phẩm</td></tr>`;

    const exported = invIsExported(o);
    const invoiceStatusHtml = exported
        ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Đã xuất HĐĐT${Number(o.invoice_exported_count || 0) > 1 ? ' ×' + o.invoice_exported_count : ''}</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">Chưa xuất HĐĐT</span>`;

    const sourceKey = String(o.customer_source || '').toLowerCase().trim();
    const sourceLabel = INV_SOURCE_LABEL[sourceKey] || (sourceKey ? sourceKey : 'Facebook');

    // Các dòng tài chính
    const fin = [
        ['Tổng giá trị', invFormatCurrency(o.total_amount)],
        ['Phí ship (khách trả)', invFormatCurrency(o.shipping_fee)],
        o.deposit_amount ? ['Đã cọc', invFormatCurrency(o.deposit_amount)] : null,
        o.discount_amount ? ['Giảm giá', '-' + invFormatCurrency(o.discount_amount)] : null,
        ['Thanh toán', _invPaymentLabel(o.payment_method)],
    ].filter(Boolean);

    const ctvHtml = o.referral_code
        ? `<div class="flex justify-between py-1.5"><span class="text-sm text-slate-500">Mã CTV</span><span class="text-sm font-medium text-blue-600">${invEscapeHtml(o.referral_code)}</span></div>
           <div class="flex justify-between py-1.5"><span class="text-sm text-slate-500">Hoa hồng</span><span class="text-sm font-medium text-orange-600">${invFormatCurrency(o.commission)}</span></div>`
        : `<div class="flex justify-between py-1.5"><span class="text-sm text-slate-500">CTV</span><span class="text-sm text-slate-400">Không có</span></div>`;

    const orderNote = o.notes && String(o.notes).trim()
        ? `<div class="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
               <div class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Ghi chú đơn</div>
               <div class="text-sm text-amber-900 whitespace-pre-wrap">${invEscapeHtml(o.notes)}</div>
           </div>`
        : '';

    let modal = document.getElementById('invDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'invDetailModal';
        modal.className = 'fixed inset-0 z-[130] flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeInvDetail()"></div>
        <div class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/50">
                <div class="min-w-0">
                    <h3 class="text-lg font-bold text-slate-900 font-mono">${invEscapeHtml(o.order_id || 'N/A')}</h3>
                    <div class="flex items-center gap-2 mt-1">${invoiceStatusHtml}
                        <span class="text-xs text-slate-400">Gửi: ${invFormatDate(o.shipped_at_unix)}</span>
                    </div>
                </div>
                <button onclick="closeInvDetail()" class="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-5">
                <!-- Khách hàng + giao hàng -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="rounded-xl border border-slate-200 p-4">
                        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Khách hàng</div>
                        <div class="text-sm font-semibold text-slate-900">${invEscapeHtml(o.customer_name || 'N/A')}</div>
                        <div class="text-sm text-slate-600 mt-0.5">${invEscapeHtml(o.customer_phone || '—')}</div>
                        <div class="text-xs text-slate-400 mt-1">Nguồn: ${invEscapeHtml(sourceLabel)}</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 p-4">
                        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Địa chỉ giao hàng</div>
                        <div class="text-sm text-slate-700 leading-relaxed">${invEscapeHtml(_invFullAddress(o))}</div>
                    </div>
                </div>

                <!-- Sản phẩm -->
                <div class="rounded-xl border border-slate-200 overflow-hidden">
                    <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sản phẩm (${products.length})</div>
                    <div class="p-4 overflow-x-auto">
                        <table class="w-full">
                            <thead><tr class="text-xs text-slate-400 border-b border-slate-100">
                                <th class="pb-2 pr-2 text-left font-medium">#</th>
                                <th class="pb-2 pr-2 text-left font-medium">Tên</th>
                                <th class="pb-2 px-2 text-center font-medium">SL</th>
                                <th class="pb-2 pl-2 text-right font-medium">Đơn giá</th>
                                <th class="pb-2 pl-2 text-right font-medium">Thành tiền</th>
                            </tr></thead>
                            <tbody>${productRows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- Tài chính + CTV -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="rounded-xl border border-slate-200 p-4 divide-y divide-slate-100">
                        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">Thanh toán</div>
                        ${fin.map(([k, v]) => `<div class="flex justify-between py-1.5"><span class="text-sm text-slate-500">${k}</span><span class="text-sm font-medium text-slate-900 tabular-nums">${v}</span></div>`).join('')}
                    </div>
                    <div class="rounded-xl border border-slate-200 p-4 divide-y divide-slate-100">
                        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">CTV & Hoa hồng</div>
                        ${ctvHtml}
                    </div>
                </div>

                ${orderNote}
            </div>
            <div class="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end gap-2">
                <button onclick="closeInvDetail()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white transition-all">Đóng</button>
                ${exported
                    ? `<button onclick="closeInvDetail(); invCancelExport(${o.id})" class="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all inline-flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        Hủy xuất HĐĐT
                       </button>`
                    : `<button onclick="closeInvDetail(); invExportOne(${o.id})" class="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Xuất HĐĐT
                       </button>`}
            </div>
        </div>`;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closeInvDetail() {
    const modal = document.getElementById('invDetailModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// ============================================
// SEARCH
// ============================================
function _initInvSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', () => {
        if (_invSearchDebounce) clearTimeout(_invSearchDebounce);
        _invSearchDebounce = setTimeout(() => {
            invSearchTerm = input.value.trim();
            invLoadFirstPage();
        }, 350);
    });
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    _syncInvFilterButtons();
    _initInvSearch();
    invLoadFirstPage();
});
