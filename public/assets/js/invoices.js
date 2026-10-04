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
let invInvoiceFilter = 'not_exported';  // all | not_exported | exported — mặc định: đơn CHƯA xuất
let invSearchTerm = '';
let invPageSize = 30;               // số đơn / trang (chọn được: 30/50/100/200)
let invDateStartMs = null;          // mốc đầu khoảng ngày gửi (ms UTC, tính theo giờ VN)
let invDateEndMs = null;            // mốc cuối khoảng ngày gửi
const invSelectedExportIds = new Set(); // file HĐĐT đang chọn trong modal lịch sử
// Kho đơn đã tick "cần xuất" xuyên trang (từ getDueInvoiceOrders) — map id → order object.
// Dùng để export đúng cả đơn KHÔNG nằm trong trang hiện tại (invOrders).
const invPickedOrders = new Map();
const INV_PAGE_SIZE_OPTIONS = [30, 50, 100, 200];
// Mốc 05/09/2026 (00:00 giờ VN). Trang HĐĐT lấy đơn đặt từ mốc này,
// hoặc đơn đặt trước nhưng gửi hàng từ mốc này. Đơn đặt và gửi đều trước mốc thì bỏ.
const INV_CREATED_FROM_MS = new Date('2026-09-05T00:00:00+07:00').getTime();
const invState = {
    loading: false,
    hasMore: false,
    pageIndex: 0,
    cursorStack: [],   // cursor đầu mỗi trang đã đi qua
    nextCursor: null,
    totalCount: 0,     // tổng đơn khớp bộ lọc (cập nhật từ trang đầu)
};
let _invSearchDebounce = null;

// ---- Helpers ----
function _invRefreshDueBadge() {
    if (typeof window.refreshInvoiceDueBadge === 'function') window.refreshInvoiceDueBadge(true);
}

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

// Mốc nhắc xuất HĐĐT: 10 ngày kể từ ngày GỬI HÀNG (đủ thời gian giao + xử lý hoàn/đổi).
const INV_REMIND_DAYS = 10;
const _INV_DAY_MS = 86400000;

/**
 * Tính trạng thái nhắc xuất HĐĐT cho 1 đơn dựa trên shipped_at_unix.
 * @returns {{ state:'due'|'soon'|'none', daysLeft:number } }
 *   - due  : đã đủ ≥10 ngày kể từ ngày gửi → NÊN xuất
 *   - soon : chưa đủ 10 ngày → còn daysLeft ngày nữa
 *   - none : không có mốc gửi (không tính được)
 */
function invRemindStatus(o) {
    const shippedMs = Number(o.shipped_at_unix || 0);
    if (!Number.isFinite(shippedMs) || shippedMs <= 0) return { state: 'none', daysLeft: 0 };
    const dueMs = shippedMs + INV_REMIND_DAYS * _INV_DAY_MS;
    const now = Date.now();
    if (now >= dueMs) return { state: 'due', daysLeft: 0 };
    const daysLeft = Math.ceil((dueMs - now) / _INV_DAY_MS);
    return { state: 'soon', daysLeft };
}

/** HTML ô cột "Nhắc xuất". Đơn đã xuất → không cần nhắc. */
function _invRemindCell(o, exported) {
    if (exported) {
        return `<span class="text-xs text-slate-300">—</span>`;
    }
    const r = invRemindStatus(o);
    if (r.state === 'due') {
        return `<span class="inv-due-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white" title="Đã đủ ${INV_REMIND_DAYS} ngày kể từ ngày gửi — cần xuất HĐĐT">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Cần xuất HĐĐT
                </span>`;
    }
    if (r.state === 'soon') {
        return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-400 border border-slate-200" title="Còn ${r.daysLeft} ngày nữa mới đủ ${INV_REMIND_DAYS} ngày kể từ ngày gửi">Còn ${r.daysLeft} ngày</span>`;
    }
    return `<span class="text-xs text-slate-300">—</span>`;
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

/** Đổi số đơn / trang → tải lại từ trang 1 (cursor reset). */
function onInvPageSizeChange(value) {
    const v = parseInt(value, 10);
    if (!INV_PAGE_SIZE_OPTIONS.includes(v) || v === invPageSize) return;
    invPageSize = v;
    invLoadFirstPage();
}

// ---- Lọc theo khoảng ngày (giờ VN) ----
/** Mốc đầu ngày VN (00:00:00 +07) từ chuỗi 'YYYY-MM-DD' → ms. */
function _invVNStartOfDate(dateStr) {
    if (!dateStr) return null;
    const t = new Date(`${dateStr}T00:00:00+07:00`).getTime();
    return Number.isFinite(t) ? t : null;
}
/** Mốc cuối ngày VN (23:59:59.999 +07) từ chuỗi 'YYYY-MM-DD' → ms. */
function _invVNEndOfDate(dateStr) {
    if (!dateStr) return null;
    const t = new Date(`${dateStr}T23:59:59.999+07:00`).getTime();
    return Number.isFinite(t) ? t : null;
}

/** Định dạng dd/mm/yyyy từ chuỗi 'YYYY-MM-DD' để hiển thị chip. */
function _invFmtDMY(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

/** Mở modal chọn khoảng ngày. */
function openInvDateModal() {
    document.getElementById('invDateModal')?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

/** Đóng modal chọn khoảng ngày. */
function closeInvDateModal() {
    document.getElementById('invDateModal')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

/** Áp dụng khoảng ngày từ modal → cập nhật mốc + chip + tải lại. */
function applyInvDateModal() {
    const startEl = document.getElementById('invDateStart');
    const endEl = document.getElementById('invDateEnd');
    let start = startEl?.value || '';
    let end = endEl?.value || '';

    // Nếu chọn ngược (từ > đến) → tự hoán đổi cho đúng, tránh query rỗng.
    if (start && end && start > end) {
        [start, end] = [end, start];
        if (startEl) startEl.value = start;
        if (endEl) endEl.value = end;
    }

    invDateStartMs = _invVNStartOfDate(start);
    invDateEndMs = _invVNEndOfDate(end);
    _syncInvDateIndicator(start, end);
    closeInvDateModal();
    invLoadFirstPage();
}

/** Hiện/ẩn chấm trên icon + chip khoảng ngày đang lọc. */
function _syncInvDateIndicator(start, end) {
    const hasFilter = !!(start || end);
    document.getElementById('invDateDot')?.classList.toggle('hidden', !hasFilter);
    const bar = document.getElementById('invDateActiveBar');
    const label = document.getElementById('invDateActiveLabel');
    if (bar) bar.classList.toggle('hidden', !hasFilter);
    if (label && hasFilter) {
        const s = _invFmtDMY(start), e = _invFmtDMY(end);
        label.textContent = s && e ? `Ngày gửi: ${s} – ${e}` : (s ? `Ngày gửi từ: ${s}` : `Ngày gửi đến: ${e}`);
    }
}

function clearInvDateFilter() {
    const startEl = document.getElementById('invDateStart');
    const endEl = document.getElementById('invDateEnd');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    invDateStartMs = null;
    invDateEndMs = null;
    _syncInvDateIndicator('', '');
    invLoadFirstPage();
}

// ============================================
// LOAD DATA (cursor pagination, statusFilter=shipped)
// ============================================
// Trang đầu của hai tab Chưa xuất / Đã xuất, tải sẵn lúc mở trang.
const INV_TAB_PRELOAD = 30;
const invTabCache = { not_exported: null, exported: null };
const invTabInflight = { not_exported: null, exported: null };
let invFetchToken = 0;

function _invDateKey() {
    return `${invDateStartMs || ''}|${invDateEndMs || ''}`;
}

function _invIsTabFilter(filter) {
    return filter === 'not_exported' || filter === 'exported';
}

function _invBuildParams(cursor, overrides = {}) {
    const p = new URLSearchParams();
    p.set('action', 'getOrdersHistoryPage');
    p.set('statusFilter', 'shipped');
    p.set('invoiceStatusFilter', overrides.filter || invInvoiceFilter);
    p.set('dateField', 'shipped');
    // sort ASC theo ngày gửi: đơn gửi CŨ NHẤT (gần/đã đến hạn xuất, còn ít ngày nhất) lên ĐẦU.
    p.set('sortDir', 'asc');
    // Mốc 05/09/2026: server nhận đơn đặt từ mốc, hoặc gửi từ mốc.
    p.set('createdFromMs', String(INV_CREATED_FROM_MS));
    p.set('limit', String(overrides.limit || invPageSize));
    // Lọc khoảng ngày GỬI HÀNG (server so trên shipped_at_unix theo dateField=shipped)
    if (invDateStartMs != null) p.set('dateStartMs', String(invDateStartMs));
    if (invDateEndMs != null) p.set('dateEndMs', String(invDateEndMs));
    if (cursor && Number.isFinite(cursor.sort) && Number.isFinite(cursor.id)) {
        p.set('cursorSort', String(cursor.sort));
        p.set('cursorId', String(cursor.id));
    }
    p.set('timestamp', String(Date.now()));
    return p;
}

function _invFilterSearch(orders) {
    if (!invSearchTerm) return orders;
    const t = invSearchTerm.toLowerCase();
    return orders.filter((o) =>
        String(o.order_id || '').toLowerCase().includes(t) ||
        String(o.customer_name || '').toLowerCase().includes(t) ||
        String(o.customer_phone || '').toLowerCase().includes(t)
    );
}

function _invStoreTabCache(filter, data, limit, dateKey) {
    if (!_invIsTabFilter(filter)) return;
    invTabCache[filter] = {
        orders: data.orders || [],
        hasMore: !!data.hasMore,
        nextCursor: data.nextCursor || null,
        totalCount: data.totalCount != null ? Number(data.totalCount) : 0,
        limit,
        dateKey,
    };
}

function _invTabCacheReady(filter) {
    if (!_invIsTabFilter(filter)) return false;
    if (invDateStartMs != null || invDateEndMs != null) return false;
    const cached = invTabCache[filter];
    if (!cached || cached.dateKey !== _invDateKey()) return false;
    if (cached.limit === invPageSize) return true;
    return !cached.hasMore && cached.orders.length <= invPageSize;
}

async function _invRequestPage(filter, cursor, limit) {
    const res = await fetch(`${CONFIG.API_URL}?${_invBuildParams(cursor, { filter, limit }).toString()}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Không tải được đơn hàng');
    return data;
}

function _invPreloadTab(filter) {
    if (!_invIsTabFilter(filter)) return Promise.resolve(null);
    const dateKey = _invDateKey();
    const cached = invTabCache[filter];
    if (cached && cached.dateKey === dateKey && cached.limit === INV_TAB_PRELOAD && invPageSize <= INV_TAB_PRELOAD && dateKey === '|') {
        return Promise.resolve(cached);
    }
    if (invTabInflight[filter]) return invTabInflight[filter];
    const run = _invRequestPage(filter, null, INV_TAB_PRELOAD).then((data) => {
        _invStoreTabCache(filter, data, INV_TAB_PRELOAD, dateKey);
        return invTabCache[filter];
    });
    invTabInflight[filter] = run;
    run.finally(() => {
        if (invTabInflight[filter] === run) invTabInflight[filter] = null;
    });
    return run;
}

/** Tải sẵn trang đầu của Chưa xuất và Đã xuất. Không chặn nhau. */
function _invWarmTabs() {
    if (invDateStartMs != null || invDateEndMs != null) return;
    void _invPreloadTab('not_exported');
    void _invPreloadTab('exported');
}

/** Sau khi đánh dấu/hủy xuất: bỏ cache cũ, tải lại tab còn lại ở nền. */
function _invNoteTabsStale() {
    invTabCache.not_exported = null;
    invTabCache.exported = null;
    if (invDateStartMs != null || invDateEndMs != null) return;
    const other = invInvoiceFilter === 'exported'
        ? 'not_exported'
        : (invInvoiceFilter === 'not_exported' ? 'exported' : null);
    if (other) void _invPreloadTab(other);
    else _invWarmTabs();
}

function _invPaintOrders(orders, pageIndex, hasMore, nextCursor, totalCount) {
    invOrders = orders;
    invState.hasMore = !!hasMore;
    invState.nextCursor = nextCursor || null;
    invState.pageIndex = pageIndex;
    if (totalCount != null) invState.totalCount = Number(totalCount);
    const visibleIds = new Set(invOrders.map((o) => Number(o.id)));
    Array.from(invSelectedIds).forEach((id) => {
        if (!visibleIds.has(id) && !invPickedOrders.has(id)) invSelectedIds.delete(id);
    });
    invState.loading = false;
    invSetBusyToast(false);
    invRender();
}

function _invShowTabCache(filter) {
    if (!_invTabCacheReady(filter)) return false;
    const cached = invTabCache[filter];
    invFetchToken += 1;
    invState.cursorStack = [null];
    _invPaintOrders(
        _invFilterSearch(cached.orders.slice(0, invPageSize)),
        1,
        cached.hasMore,
        cached.nextCursor,
        cached.totalCount
    );
    return true;
}

async function _invFetchPage(cursor, pageIndex) {
    const token = ++invFetchToken;
    const filter = invInvoiceFilter;
    const dateKey = _invDateKey();
    invState.loading = true;

    const hadData = invOrders.length > 0;
    if (!hadData) invShowLoading();
    else invSetBusyToast(true, 'Đang tải đơn hàng...');

    try {
        const data = await _invRequestPage(filter, cursor, invPageSize);
        if (token !== invFetchToken || invInvoiceFilter !== filter) return;
        if (pageIndex === 1 && !cursor && _invIsTabFilter(filter) && invPageSize === INV_TAB_PRELOAD) {
            _invStoreTabCache(filter, data, invPageSize, dateKey);
        }
        _invPaintOrders(
            _invFilterSearch(data.orders || []),
            pageIndex,
            data.hasMore,
            data.nextCursor,
            data.totalCount != null ? data.totalCount : null
        );
    } catch (err) {
        if (token !== invFetchToken) return;
        console.error('[Invoices] Lỗi tải trang:', err);
        showToast('Không tải được danh sách đơn: ' + err.message, 'error');
        invState.loading = false;
        invSetBusyToast(false);
    }
}

function invLoadFirstPage() {
    invState.pageIndex = 0;
    invState.cursorStack = [null];
    invState.nextCursor = null;
    invState.hasMore = false;

    const filter = invInvoiceFilter;
    if (_invShowTabCache(filter)) return;

    const pending = _invIsTabFilter(filter) ? invTabInflight[filter] : null;
    if (pending && invDateStartMs == null && invDateEndMs == null && invPageSize <= INV_TAB_PRELOAD) {
        const token = ++invFetchToken;
        if (invOrders.length === 0) invShowLoading();
        else invSetBusyToast(true, 'Đang tải đơn hàng...');
        invState.loading = true;
        pending.then(() => {
            if (token !== invFetchToken || invInvoiceFilter !== filter) return;
            if (!_invShowTabCache(filter)) void _invFetchPage(null, 1);
        }).catch((err) => {
            if (token !== invFetchToken) return;
            console.error('[Invoices] Lỗi tải sẵn tab:', err);
            void _invFetchPage(null, 1);
        });
        return;
    }

    void _invFetchPage(null, 1);
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
    if (countLabel) {
        const suffix = invInvoiceFilter === 'exported' ? 'đã xuất HĐĐT'
            : invInvoiceFilter === 'not_exported' ? 'chưa xuất HĐĐT'
            : 'đã gửi';
        countLabel.textContent = ` (${invState.totalCount} đơn ${suffix})`;
    }

    if (invOrders.length === 0) {
        invShowEmpty();
        _updateInvBulkBar();
        _renderInvPagination();
        return;
    }

    const base = (invState.pageIndex - 1) * invPageSize;
    tbody.innerHTML = invOrders.map((o, i) => {
        const exported = invIsExported(o);
        // Đơn đến hạn xuất (chưa xuất + đủ 10 ngày) → làm nổi mã đơn màu green đậm.
        const isDue = !exported && invRemindStatus(o).state === 'due';
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
            : `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200">Chưa xuất</span>`;

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
                <div class="text-sm font-mono ${isDue ? 'font-bold text-emerald-600' : 'font-semibold text-slate-900'}">${invEscapeHtml(o.order_id || 'N/A')}</div>
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
            <td class="px-4 py-3 text-center">${_invRemindCell(o, exported)}</td>
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
    invPickedOrders.clear();
    document.querySelectorAll('.inv-row-cb').forEach((cb) => { cb.checked = false; });
    const all = document.getElementById('invSelectAll');
    if (all) all.checked = false;
    _updateInvBulkBar();
}

/**
 * Chọn nhanh TẤT CẢ đơn đến hạn xuất HĐĐT — XUYÊN TRANG (gọi getDueInvoiceOrders).
 * Đơn không nằm trong trang hiện tại được lưu vào invPickedOrders để export vẫn đúng.
 */
let _invSelectDueBusy = false; // chặn bấm liên tục nút "Chọn đơn cần xuất"
async function selectAllDueInvoices() {
    if (_invSelectDueBusy) return; // đang xử lý → bỏ qua click mới
    _invSelectDueBusy = true;
    const btn = document.getElementById('invSelectDueBtn');
    if (btn) btn.disabled = true;
    try {
        const params = new URLSearchParams();
        params.set('action', 'getDueInvoiceOrders');
        params.set('remindDays', String(INV_REMIND_DAYS));
        params.set('createdFromMs', String(INV_CREATED_FROM_MS));
        params.set('maxLimit', '1000');
        params.set('timestamp', String(Date.now()));

        const res = await fetch(`${CONFIG.API_URL}?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Không lấy được danh sách đơn cần xuất');

        const due = data.orders || [];
        if (due.length === 0) {
            showToast('Không có đơn hàng', 'warning', 2500);
            return;
        }

        // Tick chọn tất cả + lưu object vào kho (để export xuyên trang).
        due.forEach((o) => {
            const id = Number(o.id);
            invSelectedIds.add(id);
            invPickedOrders.set(id, o);
        });

        // Đồng bộ checkbox trên trang hiện tại (các đơn trang khác không có DOM row, không sao).
        document.querySelectorAll('.inv-row-cb').forEach((cb) => {
            if (invSelectedIds.has(Number(cb.dataset.id))) cb.checked = true;
        });
        _syncInvSelectAll();
        _updateInvBulkBar();

        const extra = due.length - invOrders.filter((o) => invRemindStatus(o).state === 'due' && !invIsExported(o)).length;
        let msg = `Đã chọn ${due.length} đơn cần xuất HĐĐT`;
        if (data.capped) msg += ' — đã đạt giới hạn 1000, có thể còn nữa';
        showToast(msg, 'success', 3000);
    } catch (err) {
        console.error('[Invoices] selectAllDue error:', err);
        showToast('Lỗi: ' + err.message, 'error');
    } finally {
        _invSelectDueBusy = false;
        if (btn) btn.disabled = false;
    }
}

function _updateInvBulkBar() {
    const bar = document.getElementById('invBulkBar');
    const count = document.getElementById('invSelectedCount');
    if (count) count.textContent = String(invSelectedIds.size);
    if (bar) bar.classList.toggle('hidden', invSelectedIds.size === 0);
}

/**
 * Lấy object đơn đã chọn — GỘP từ trang hiện tại (invOrders) VÀ kho chọn xuyên trang
 * (invPickedOrders), khử trùng theo id. Đảm bảo export đúng cả đơn không nằm trên trang hiện tại.
 */
function _invSelectedOrders() {
    const map = new Map();
    invOrders.forEach((o) => { if (invSelectedIds.has(Number(o.id))) map.set(Number(o.id), o); });
    invPickedOrders.forEach((o, id) => { if (invSelectedIds.has(id) && !map.has(id)) map.set(id, o); });
    return Array.from(map.values());
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
        _invRefreshDueBadge();
        _invNoteTabsStale();

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
        _invRefreshDueBadge();
        _invNoteTabsStale();

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

    _invRefreshDueBadge();
    _invNoteTabsStale();
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
                <!-- Thanh hành động: chọn tất cả + xóa đã chọn -->
                <div id="invHistoryToolbar" class="hidden px-6 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                    <label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" id="invHistorySelectAll" onchange="invHistoryToggleSelectAll(this.checked)" class="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer">
                        <span>Chọn tất cả</span>
                    </label>
                    <button id="invHistoryDeleteBtn" onclick="invHistoryBulkDelete()" disabled
                        class="px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Xóa <span id="invHistoryDeleteCount"></span>
                    </button>
                </div>
                <div id="invHistoryList" class="flex-1 overflow-y-auto p-4 space-y-2"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    invSelectedExportIds.clear();
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
        const toolbar = document.getElementById('invHistoryToolbar');
        if (exports.length === 0) {
            if (toolbar) toolbar.classList.add('hidden');
            list.innerHTML = `<div class="p-8 text-center">
                <p class="text-sm font-medium text-slate-600">Chưa có file HĐĐT nào</p>
                <p class="text-xs text-slate-400 mt-1">Xuất HĐĐT để tạo file đầu tiên</p>
            </div>`;
            return;
        }
        if (toolbar) toolbar.classList.remove('hidden');
        // Bỏ khỏi selection những file không còn tồn tại (đã bị xóa).
        const validIds = new Set(exports.map((e) => Number(e.id)));
        Array.from(invSelectedExportIds).forEach((id) => { if (!validIds.has(id)) invSelectedExportIds.delete(id); });

        list.innerHTML = exports.map((e) => {
            const downloaded = e.status === 'downloaded';
            const hi = highlightExportId && Number(e.id) === Number(highlightExportId);
            const checked = invSelectedExportIds.has(Number(e.id)) ? 'checked' : '';
            return `<div class="flex items-center gap-3 p-3 rounded-xl border ${hi ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-slate-200 bg-white'} transition-all">
                <input type="checkbox" class="inv-history-cb w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0" data-id="${e.id}" ${checked} onchange="invHistoryToggleFile(${e.id}, this.checked)">
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
        _syncInvHistorySelectionUI();
    } catch (err) {
        console.error('[Invoices] History error:', err);
        list.innerHTML = `<div class="p-6 text-center text-sm text-red-500">Lỗi tải lịch sử: ${invEscapeHtml(err.message)}</div>`;
    }
}

/** Tải file HĐĐT: tải file về máy + gọi markExportDownloaded để đánh dấu đơn đã xuất. */
async function invDownloadExport(exportId) {
    openPancakeInvoiceTab();
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
            _invRefreshDueBadge();
        }
    } catch (err) {
        console.error('[Invoices] markExportDownloaded error:', err);
    }

    // Làm mới danh sách file + bảng đơn (đồng bộ trạng thái mới)
    await _renderInvHistoryList(exportId);
    _invNoteTabsStale();
    _invFetchPage(invState.cursorStack[invState.cursorStack.length - 1] || null, invState.pageIndex || 1);
}

// ---- Chọn / xóa hàng loạt file HĐĐT trong modal lịch sử ----
function invHistoryToggleFile(id, checked) {
    const n = Number(id);
    if (checked) invSelectedExportIds.add(n); else invSelectedExportIds.delete(n);
    _syncInvHistorySelectionUI();
}

function invHistoryToggleSelectAll(checked) {
    document.querySelectorAll('.inv-history-cb').forEach((cb) => {
        const id = Number(cb.dataset.id);
        cb.checked = checked;
        if (checked) invSelectedExportIds.add(id); else invSelectedExportIds.delete(id);
    });
    _syncInvHistorySelectionUI();
}

function _syncInvHistorySelectionUI() {
    const cbs = document.querySelectorAll('.inv-history-cb');
    const all = document.getElementById('invHistorySelectAll');
    if (all) all.checked = cbs.length > 0 && Array.from(cbs).every((cb) => cb.checked);

    const btn = document.getElementById('invHistoryDeleteBtn');
    const countEl = document.getElementById('invHistoryDeleteCount');
    const n = invSelectedExportIds.size;
    if (btn) btn.disabled = n === 0;
    if (countEl) countEl.textContent = n > 0 ? `(${n})` : '';
}

async function invHistoryBulkDelete() {
    const ids = Array.from(invSelectedExportIds);
    if (ids.length === 0) return;

    const ok = await invConfirm({
        title: 'Xóa file HĐĐT',
        message: `Xóa <b>${ids.length}</b> file hóa đơn điện tử đã chọn?<br><span class="text-xs text-slate-400">File Excel sẽ bị xóa khỏi hệ thống. Trạng thái "đã xuất" của các đơn KHÔNG bị thay đổi.</span>`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        tone: 'red'
    });
    if (!ok) return;

    invSetBusyToast(true, `Đang xóa ${ids.length} file...`);
    let done = 0, fail = 0;
    for (const id of ids) {
        try {
            const res = await fetch(`${CONFIG.API_URL}?action=deleteExport`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteExport', exportId: Number(id) })
            });
            const data = await res.json();
            if (data.success) { done++; invSelectedExportIds.delete(Number(id)); } else { fail++; }
        } catch (err) {
            fail++;
            console.error(`[Invoices] Delete export ${id} error:`, err);
        }
    }
    invSetBusyToast(false);

    if (fail === 0) showToast(`✅ Đã xóa ${done} file HĐĐT`, 'success', 3500);
    else showToast(`Xóa xong ${done} file, thất bại ${fail} file`, 'warning', 5000);

    await _renderInvHistoryList();
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
    _invWarmTabs();
    invLoadFirstPage();
});
