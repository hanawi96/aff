// Orders Invoice History (Hóa Đơn Điện Tử - HDDT) Modal
// ============================================

// ============================================
// CACHE & STATE
// ============================================
let invoiceHistoryCache = null;
let invoiceHistoryCacheTime = 0;
const INVOICE_CACHE_DURATION = 30000;

const INVOICES_PER_PAGE = 8;
let invoiceHistoryPage = 1;
let invoiceHistoryAllItems = [];
let selectedInvoiceIds = new Set();

// ============================================
// BADGE UPDATE
// ============================================
async function updateInvoiceHistoryBadge() {
    try {
        const data = await loadInvoiceHistory();
        if (data.exports) {
            const pendingCount = data.exports.filter(e => e.status === 'pending').length;
            const badge = document.getElementById('invoiceHistoryBadge');
            if (badge) {
                badge.textContent = pendingCount;
                badge.classList.toggle('hidden', pendingCount === 0);
            }
        }
    } catch (e) {
        console.warn('Invoice badge update error:', e);
    }
}

// ============================================
// LOAD DATA
// ============================================
async function loadInvoiceHistory(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && invoiceHistoryCache && (now - invoiceHistoryCacheTime < INVOICE_CACHE_DURATION)) {
        return invoiceHistoryCache;
    }

    const response = await fetch(`${CONFIG.API_URL}?action=getInvoiceExportHistory&timestamp=${now}`);
    const data = await response.json();

    if (data.success) {
        invoiceHistoryCache = data;
        invoiceHistoryCacheTime = now;
        return data;
    }

    throw new Error(data.error || 'Không thể tải lịch sử hóa đơn điện tử');
}

// ============================================
// MODAL — OPEN
// ============================================
let _invoiceHistoryHighlightId = null;

async function showInvoiceHistoryModal(options = {}) {
    try {
        const { highlightExportId } = options || {};
        _invoiceHistoryHighlightId = highlightExportId ? Number(highlightExportId) : null;

        selectedInvoiceIds.clear();
        invoiceHistoryPage = 1;

        const data = await loadInvoiceHistory();
        invoiceHistoryAllItems = data.exports || [];

        // Nếu yêu cầu highlight, đảm bảo file đó hiển thị: nếu không nằm trong trang hiện tại → chuyển trang
        if (_invoiceHistoryHighlightId && !_isExportOnCurrentPage(_invoiceHistoryHighlightId)) {
            const targetPage = _findPageOfExport(_invoiceHistoryHighlightId);
            if (targetPage > 0) invoiceHistoryPage = targetPage;
        }

        // Remove existing modal if any
        document.getElementById('invoiceHistoryModal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'invoiceHistoryModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modal.innerHTML = _buildInvoiceModalShell();
        document.body.appendChild(modal);

        renderInvoiceListPage();

    } catch (error) {
        console.error('Error showing invoice history:', error);
        showToast('Không thể tải lịch sử hóa đơn điện tử: ' + error.message, 'error');
    }
}

function _findPageOfExport(exportId) {
    const idx = invoiceHistoryAllItems.findIndex((e) => Number(e.id) === Number(exportId));
    if (idx === -1) return 0;
    return Math.floor(idx / INVOICES_PER_PAGE) + 1;
}

function _isExportOnCurrentPage(exportId) {
    return _findPageOfExport(exportId) === invoiceHistoryPage;
}

function _buildInvoiceModalShell() {
    return `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-200">
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-gray-900 leading-tight">Danh sách Hóa Đơn Điện Tử</h2>
                        <p class="text-xs text-gray-500">File HDDT đã export từ MauUploadHD.xlsx</p>
                    </div>
                </div>
                <button onclick="closeInvoiceHistoryModal()" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Toolbar -->
            <div id="invoiceToolbar" class="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-100 flex-shrink-0">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="selectAllInvoices" onchange="toggleSelectAllInvoices()"
                        class="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"/>
                    <span class="text-sm text-gray-600 font-medium">Chọn tất cả</span>
                    <span id="invoiceSelectedCount" class="text-xs text-gray-400 hidden ml-0.5"></span>
                </label>
                <div id="invoiceBulkActions" class="hidden flex items-center gap-1.5">
                    <button onclick="bulkMergeInvoices()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 transition-opacity shadow-sm">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                        </svg>
                        Gộp & Tải
                    </button>
                    <button onclick="bulkDownloadInvoices()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Tải từng file
                    </button>
                    <button onclick="bulkDeleteInvoices()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Xóa
                    </button>
                </div>
            </div>

            <!-- List (scrollable) -->
            <div id="invoiceListContent" class="flex-1 overflow-y-auto min-h-0"></div>

            <!-- Pagination footer -->
            <div id="invoicePaginationBar" class="flex-shrink-0"></div>
        </div>`;
}

// ============================================
// MODAL — RENDER PAGE
// ============================================
function renderInvoiceListPage() {
    const total = invoiceHistoryAllItems.length;
    const totalPages = Math.max(1, Math.ceil(total / INVOICES_PER_PAGE));
    invoiceHistoryPage = Math.max(1, Math.min(invoiceHistoryPage, totalPages));

    const start = (invoiceHistoryPage - 1) * INVOICES_PER_PAGE;
    const end = Math.min(start + INVOICES_PER_PAGE, total);
    const items = invoiceHistoryAllItems.slice(start, end);

    // Render list
    const listEl = document.getElementById('invoiceListContent');
    if (listEl) {
        listEl.innerHTML = total === 0
            ? _getInvoiceEmptyState()
            : `<div class="p-4 space-y-2">${items.map(exp => _renderInvoiceItem(exp)).join('')}</div>`;
    }

    // Render pagination
    const pagEl = document.getElementById('invoicePaginationBar');
    if (pagEl) {
        pagEl.innerHTML = total > INVOICES_PER_PAGE
            ? _buildInvoicePaginationHTML(invoiceHistoryPage, totalPages, start, end, total)
            : '';
    }

    // Toolbar visibility
    const toolbar = document.getElementById('invoiceToolbar');
    if (toolbar) toolbar.classList.toggle('hidden', total === 0);

    _updateInvoiceSelectionUI();

    // Nếu user mở modal từ badge "Đã xuất HĐ" → highlight + scroll dòng tương ứng
    if (_invoiceHistoryHighlightId) {
        _highlightInvoiceRow(_invoiceHistoryHighlightId);
        _invoiceHistoryHighlightId = null;
    }
}

/**
 * Highlight dòng HDDT đang được tham chiếu (mở từ badge trên order row).
 * Đợi 1 frame để DOM chắc chắn đã paint, rồi cuộn + flash highlight.
 * @param {number} exportId
 */
function _highlightInvoiceRow(exportId) {
    requestAnimationFrame(() => {
        const el = document.querySelector(`[data-invoice-item-id="${exportId}"]`);
        if (!el) return;
        el.classList.add('invoice-row-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Bỏ highlight sau 3s để tránh gây rối khi user tương tác
        setTimeout(() => el.classList.remove('invoice-row-highlight'), 3000);
    });
}

function _getInvoiceEmptyState() {
    return `
        <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-20 h-20 mx-auto mb-4 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <svg class="w-10 h-10 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
            </div>
            <h3 class="text-base font-semibold text-gray-700 mb-1">Chưa có file HDDT nào</h3>
            <p class="text-sm text-gray-400">Export hóa đơn điện tử để tạo file đầu tiên</p>
        </div>`;
}

function _buildInvoicePaginationHTML(page, totalPages, start, end, total) {
    const nums = _getInvoicePageNumbers(page, totalPages);

    const numBtns = nums.map(p => p === '...'
        ? `<span class="w-8 h-8 flex items-center justify-center text-gray-400 text-sm select-none">…</span>`
        : `<button onclick="goToInvoicePage(${p})"
                class="w-8 h-8 rounded-lg text-sm font-medium transition-all
                    ${p === page
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                        : 'text-gray-500 hover:bg-gray-100'}">${p}</button>`
    ).join('');

    const prevDisabled = page <= 1;
    const nextDisabled = page >= totalPages;
    const btnCls = (disabled) => `w-8 h-8 rounded-lg flex items-center justify-center transition-colors
        ${disabled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`;

    return `
        <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
            <span class="text-xs text-gray-400">
                Hiển thị <span class="font-semibold text-gray-600">${start + 1}–${end}</span>
                / <span class="font-semibold text-gray-600">${total}</span> file
            </span>
            <div class="flex items-center gap-1">
                <button onclick="goToInvoicePage(${page - 1})" ${prevDisabled ? 'disabled' : ''}
                    class="${btnCls(prevDisabled)}">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                ${numBtns}
                <button onclick="goToInvoicePage(${page + 1})" ${nextDisabled ? 'disabled' : ''}
                    class="${btnCls(nextDisabled)}">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        </div>`;
}

function _getInvoicePageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
}

function goToInvoicePage(page) {
    const totalPages = Math.max(1, Math.ceil(invoiceHistoryAllItems.length / INVOICES_PER_PAGE));
    if (page < 1 || page > totalPages) return;
    invoiceHistoryPage = page;
    renderInvoiceListPage();
}

// ============================================
// RENDER ITEM
// ============================================
function _renderInvoiceItem(exp) {
    const d = new Date(exp.created_at);
    const dateStr = d.toLocaleString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
    const isChecked = selectedInvoiceIds.has(exp.id);
    const isDownloaded = exp.status === 'downloaded';

    // Badge "Đã tải xuống" or "Chưa tải"
    const badge = isDownloaded
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
               <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                   <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
               </svg>
               Đã tải xuống</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
               <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                   <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
               </svg>
               Chưa tải</span>`;

    const rowCount = exp.invoice_row_count || 0;

    return `
        <div class="invoice-item flex items-center gap-3 px-4 py-3 rounded-xl border
            ${isDownloaded ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-100 bg-white'}
            hover:border-emerald-200 hover:shadow-sm transition-all"
            data-invoice-item-id="${exp.id}">

            <input type="checkbox" ${isChecked ? 'checked' : ''}
                class="invoice-checkbox w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-2 focus:ring-emerald-500/30 cursor-pointer flex-shrink-0"
                data-invoice-id="${exp.id}"
                onchange="toggleInvoiceSelection(${exp.id})"/>

            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg class="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
            </div>

            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(exp.file_name)}</span>
                    ${badge}
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        ${dateStr}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        ${exp.order_count} đơn
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                        </svg>
                        ${rowCount} dòng
                    </span>
                </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
                <button onclick="downloadAndUpdateInvoice(${exp.id})"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Tải xuống
                </button>
                <button onclick="deleteInvoiceExport(${exp.id})" title="Xóa"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>`;
}

// ============================================
// MODAL — CLOSE
// ============================================
function closeInvoiceHistoryModal() {
    const modal = document.getElementById('invoiceHistoryModal');
    if (modal) modal.remove();
    selectedInvoiceIds.clear();
}

// ============================================
// SELECTION
// ============================================
function toggleInvoiceSelection(invoiceId) {
    if (selectedInvoiceIds.has(invoiceId)) {
        selectedInvoiceIds.delete(invoiceId);
    } else {
        selectedInvoiceIds.add(invoiceId);
    }
    _updateInvoiceSelectionUI();
}

function toggleSelectAllInvoices() {
    const cb = document.getElementById('selectAllInvoices');
    if (cb.checked) {
        invoiceHistoryAllItems.forEach(exp => selectedInvoiceIds.add(exp.id));
    } else {
        selectedInvoiceIds.clear();
    }
    renderInvoiceListPage();
}

function _updateInvoiceSelectionUI() {
    const count = selectedInvoiceIds.size;
    const total = invoiceHistoryAllItems.length;

    const countEl = document.getElementById('invoiceSelectedCount');
    if (countEl) {
        countEl.textContent = count > 0 ? `· ${count} đã chọn` : '';
        countEl.classList.toggle('hidden', count === 0);
    }

    const selectAllCb = document.getElementById('selectAllInvoices');
    if (selectAllCb) {
        selectAllCb.checked = count > 0 && count === total;
        selectAllCb.indeterminate = count > 0 && count < total;
    }

    const bulkEl = document.getElementById('invoiceBulkActions');
    if (bulkEl) {
        bulkEl.classList.toggle('hidden', count === 0);
        if (count > 0) {
            const mergeBtn = bulkEl.querySelector('button[onclick="bulkMergeInvoices()"]');
            const dlBtn = bulkEl.querySelector('button[onclick="bulkDownloadInvoices()"]');
            if (mergeBtn) mergeBtn.classList.toggle('hidden', count < 2);
            if (dlBtn) dlBtn.classList.toggle('hidden', count < 2);
        }
    }
}

// ============================================
// DOWNLOAD SINGLE
// ============================================
async function downloadInvoiceExport(invoiceId) {
    const link = document.createElement('a');
    link.href = `${CONFIG.API_URL}?action=downloadExport&id=${invoiceId}`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function _markInvoiceAsDownloaded(invoiceId) {
    const response = await fetch(`${CONFIG.API_URL}?action=markInvoiceExportDownloaded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportId: invoiceId })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Không thể cập nhật trạng thái');
    return data; // { success, updatedCount, orderIds }
}

async function downloadAndUpdateInvoice(invoiceId) {
    try {
        showToast('Đang tải file...', 'info');
        await downloadInvoiceExport(invoiceId);

        setTimeout(async () => {
            try {
                const result = await _markInvoiceAsDownloaded(invoiceId);

                // Patch local order data: set manual_invoice_exported = 1
                if (result.orderIds && result.orderIds.length > 0) {
                    for (const orderId of result.orderIds) {
                        updateOrderData(Number(orderId), {
                            invoice_exported_at: Date.now(),
                            manual_invoice_exported: 1
                        });
                    }
                    // Re-render table so badge changes from red → green
                    if (typeof filterOrdersData === 'function') {
                        filterOrdersData(false);
                    } else if (typeof renderOrdersTable === 'function') {
                        renderOrdersTable();
                    }
                }

                invoiceHistoryCache = null;
                await updateInvoiceHistoryBadge();
                // Reload list to show updated badge
                const data = await loadInvoiceHistory(true);
                invoiceHistoryAllItems = data.exports || [];
                renderInvoiceListPage();
                showToast('✅ Đã tải file hóa đơn điện tử', 'success');
            } catch (e) {
                console.error('Mark downloaded error:', e);
            }
        }, 500);
    } catch (error) {
        console.error('Download error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ============================================
// DELETE SINGLE (optimistic)
// ============================================
async function deleteInvoiceExport(invoiceId) {
    if (!confirm('Bạn có chắc muốn xóa file HDDT này?')) return;

    invoiceHistoryAllItems = invoiceHistoryAllItems.filter(e => e.id !== invoiceId);
    selectedInvoiceIds.delete(invoiceId);

    const totalPages = Math.max(1, Math.ceil(invoiceHistoryAllItems.length / INVOICES_PER_PAGE));
    if (invoiceHistoryPage > totalPages) invoiceHistoryPage = totalPages;

    renderInvoiceListPage();

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=deleteExport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportId: invoiceId })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể xóa file');

        showToast('Đã xóa file HDDT', 'success');
        invoiceHistoryCache = null;
        await updateInvoiceHistoryBadge();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Lỗi xóa: ' + error.message + ' — đang tải lại...', 'error');
        try {
            const fresh = await loadInvoiceHistory(true);
            invoiceHistoryAllItems = fresh.exports || [];
            renderInvoiceListPage();
        } catch (e) { console.error('Rollback error:', e); }
    }
}

// ============================================
// BULK MERGE & DOWNLOAD
// ============================================
async function bulkMergeInvoices() {
    if (selectedInvoiceIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để gộp', 'warning');
        return;
    }

    const count = selectedInvoiceIds.size;
    if (count === 1) {
        await downloadAndUpdateInvoice(Array.from(selectedInvoiceIds)[0]);
        return;
    }

    if (!confirm(`Bạn có muốn gộp ${count} file HDDT thành 1 file Excel duy nhất?`)) return;

    try {
        if (typeof XLSX === 'undefined') {
            showToast('Đang tải thư viện Excel...', 'info');
            await loadXLSXLibrary();
        }

        showToast(`Đang gộp ${count} file HDDT...`, 'info');

        const response = await fetch(`${CONFIG.API_URL}?action=mergeInvoiceExports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportIds: Array.from(selectedInvoiceIds) })
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.error || 'Không thể gộp file');

        showToast(`Đã gộp ${data.exportCount} file (${data.totalOrders} đơn), đang tạo Excel...`, 'info');

        const { wb, filename } = createInvoiceExcelWorkbook(data.orders);
        const exportIdsArr = Array.from(selectedInvoiceIds);
        closeInvoiceHistoryModal();

        requestAnimationFrame(() => {
            XLSX.writeFile(wb, filename);
            setTimeout(async () => {
                // Patch all merged orders to invoice_exported_at
                for (const order of data.orders) {
                    updateOrderData(Number(order.id), {
                        invoice_exported_at: Date.now(),
                        manual_invoice_exported: 1
                    });
                }
                if (typeof filterOrdersData === 'function') {
                    filterOrdersData(false);
                } else if (typeof renderOrdersTable === 'function') {
                    renderOrdersTable();
                }

                for (const id of exportIdsArr) {
                    try { await _markInvoiceAsDownloaded(id); } catch (e) {}
                }
                invoiceHistoryCache = null;
                updateInvoiceHistoryBadge().catch(() => {});
            }, 1000);
        });

    } catch (error) {
        console.error('Merge error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ============================================
// BULK DOWNLOAD
// ============================================
async function bulkDownloadInvoices() {
    if (selectedInvoiceIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để tải', 'warning');
        return;
    }

    const count = selectedInvoiceIds.size;
    if (!confirm(`Bạn có chắc muốn tải ${count} file đã chọn?`)) return;

    try {
        showToast(`Đang tải ${count} file...`, 'info');
        let ok = 0, fail = 0;

        for (const id of selectedInvoiceIds) {
            try {
                await downloadInvoiceExport(id);
                const result = await _markInvoiceAsDownloaded(id);
                // Patch order badges in local data
                if (result.orderIds) {
                    for (const orderId of result.orderIds) {
                        updateOrderData(Number(orderId), {
                            invoice_exported_at: Date.now(),
                            manual_invoice_exported: 1
                        });
                    }
                }
                ok++;
                await new Promise(r => setTimeout(r, 500));
            } catch (e) { fail++; }
        }

        // Re-render table so badge changes from red → green
        if (typeof filterOrdersData === 'function') {
            filterOrdersData(false);
        } else if (typeof renderOrdersTable === 'function') {
            renderOrdersTable();
        }

        closeInvoiceHistoryModal();
        invoiceHistoryCache = null;
        updateInvoiceHistoryBadge().catch(() => {});

        const data = await loadInvoiceHistory(true);
        invoiceHistoryAllItems = data.exports || [];
        showToast(
            fail === 0
                ? `✅ Đã tải ${ok} file HDDT`
                : `⚠️ Tải ${ok} file thành công, ${fail} file lỗi`,
            fail === 0 ? 'success' : 'warning'
        );
    } catch (error) {
        console.error('Bulk download error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ============================================
// BULK DELETE (optimistic)
// ============================================
async function bulkDeleteInvoices() {
    if (selectedInvoiceIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để xóa', 'warning');
        return;
    }

    const count = selectedInvoiceIds.size;
    if (!confirm(`Bạn có chắc muốn xóa ${count} file đã chọn? Hành động này không thể hoàn tác.`)) return;

    const idsToDelete = Array.from(selectedInvoiceIds);

    invoiceHistoryAllItems = invoiceHistoryAllItems.filter(e => !selectedInvoiceIds.has(e.id));
    selectedInvoiceIds.clear();

    const totalPages = Math.max(1, Math.ceil(invoiceHistoryAllItems.length / INVOICES_PER_PAGE));
    if (invoiceHistoryPage > totalPages) invoiceHistoryPage = totalPages;
    renderInvoiceListPage();

    try {
        let ok = 0, fail = 0;
        for (const id of idsToDelete) {
            try {
                const r = await fetch(`${CONFIG.API_URL}?action=deleteExport`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exportId: id })
                });
                const d = await r.json();
                d.success ? ok++ : fail++;
            } catch (e) { fail++; }
        }

        showToast(
            fail === 0 ? `✅ Đã xóa thành công ${ok} file` : `⚠️ Đã xóa ${ok} file, ${fail} file lỗi`,
            fail === 0 ? 'success' : 'warning'
        );

        invoiceHistoryCache = null;
        await updateInvoiceHistoryBadge();
    } catch (error) {
        console.error('Bulk delete error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ============================================
// HELPER: escape HTML
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
