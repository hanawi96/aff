// Orders Export History — with Pagination
// ============================================
// CACHE
// ============================================
let exportHistoryCache = null;
let exportHistoryCacheTime = 0;
const CACHE_DURATION = 30000;

// ============================================
// PAGINATION STATE
// ============================================
const EXPORTS_PER_PAGE = 8;
let exportHistoryPage = 1;
let exportHistoryAllItems = [];

// ============================================
// SELECTION STATE
// ============================================
let selectedExportIds = new Set();

// ============================================
// HELPERS
// ============================================
function getEmptyStateHTML() {
    return `
        <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                <svg class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
            <h3 class="text-base font-semibold text-gray-700 mb-1">Chưa có file export nào</h3>
            <p class="text-sm text-gray-400">Export đơn hàng để tạo file Excel đầu tiên</p>
        </div>`;
}

function loadXLSXLibrary() {
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
// LOAD DATA
// ============================================
async function loadExportHistory(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && exportHistoryCache && (now - exportHistoryCacheTime < CACHE_DURATION)) {
        return exportHistoryCache;
    }
    const response = await fetch(`${CONFIG.API_URL}?action=getExportHistory&timestamp=${now}`);
    const data = await response.json();
    if (data.success) {
        exportHistoryCache = data;
        exportHistoryCacheTime = now;
        return data;
    }
    throw new Error(data.error || 'Không thể tải lịch sử export');
}

async function updateExportHistoryBadge() {
    try {
        const data = await loadExportHistory();
        if (data.exports) {
            const pendingCount = data.exports.filter(e => e.status === 'pending').length;
            const badge = document.getElementById('exportHistoryBadge');
            if (badge) {
                badge.textContent = pendingCount;
                badge.classList.toggle('hidden', pendingCount === 0);
            }
        }
    } catch (e) { console.error('Badge update error:', e); }
}

// ============================================
// MODAL — OPEN
// ============================================
async function showExportHistoryModal() {
    try {
        selectedExportIds.clear();
        exportHistoryPage = 1;

        const data = await loadExportHistory();
        exportHistoryAllItems = data.exports || [];

        const modal = document.createElement('div');
        modal.id = 'exportHistoryModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modal.innerHTML = _buildModalShell();
        document.body.appendChild(modal);

        renderExportListPage();

    } catch (error) {
        console.error('Error showing export history:', error);
        showToast('Không thể tải lịch sử export: ' + error.message, 'error');
    }
}

function _buildModalShell() {
    return `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200">
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-gray-900 leading-tight">Lịch sử Export</h2>
                        <p class="text-xs text-gray-500">Quản lý các file Excel đã export</p>
                    </div>
                </div>
                <button onclick="closeExportHistoryModal()" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Toolbar (select-all + bulk actions) -->
            <div id="exportToolbar" class="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-100 flex-shrink-0">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="selectAllExports" onchange="toggleSelectAllExports()"
                        class="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500/30 cursor-pointer"/>
                    <span class="text-sm text-gray-600 font-medium">Chọn tất cả</span>
                    <span id="selectedCount" class="text-xs text-gray-400 hidden ml-0.5"></span>
                </label>
                <div id="bulkActions" class="hidden flex items-center gap-1.5">
                    <button onclick="bulkMergeAndDownloadExports()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 transition-opacity shadow-sm">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                        Gộp & Tải
                    </button>
                    <button onclick="bulkDownloadExports()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        Tải từng file
                    </button>
                    <button onclick="bulkDeleteExports()"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Xóa
                    </button>
                </div>
            </div>

            <!-- List (scrollable) -->
            <div id="exportListContent" class="flex-1 overflow-y-auto min-h-0"></div>

            <!-- Pagination footer -->
            <div id="exportPaginationBar" class="flex-shrink-0"></div>
        </div>`;
}

// ============================================
// MODAL — RENDER PAGE
// ============================================
function renderExportListPage() {
    const total = exportHistoryAllItems.length;
    const totalPages = Math.max(1, Math.ceil(total / EXPORTS_PER_PAGE));
    exportHistoryPage = Math.max(1, Math.min(exportHistoryPage, totalPages));

    const start = (exportHistoryPage - 1) * EXPORTS_PER_PAGE;
    const end   = Math.min(start + EXPORTS_PER_PAGE, total);
    const items = exportHistoryAllItems.slice(start, end);

    // Render list
    const listEl = document.getElementById('exportListContent');
    if (listEl) {
        listEl.innerHTML = total === 0
            ? getEmptyStateHTML()
            : `<div class="p-4 space-y-2">${items.map(exp => renderExportItem(exp)).join('')}</div>`;
    }

    // Render pagination
    const pagEl = document.getElementById('exportPaginationBar');
    if (pagEl) {
        pagEl.innerHTML = total > EXPORTS_PER_PAGE
            ? _buildPaginationHTML(exportHistoryPage, totalPages, start, end, total)
            : '';
    }

    // Toolbar visibility
    const toolbar = document.getElementById('exportToolbar');
    if (toolbar) toolbar.classList.toggle('hidden', total === 0);

    updateSelectionUI();
}

function _buildPaginationHTML(page, totalPages, start, end, total) {
    const nums = _getPageNumbers(page, totalPages);

    const numBtns = nums.map(p => p === '...'
        ? `<span class="w-8 h-8 flex items-center justify-center text-gray-400 text-sm select-none">…</span>`
        : `<button onclick="goToExportPage(${p})"
                class="w-8 h-8 rounded-lg text-sm font-medium transition-all
                    ${p === page
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
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
                <button onclick="goToExportPage(${page - 1})" ${prevDisabled ? 'disabled' : ''}
                    class="${btnCls(prevDisabled)}">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                ${numBtns}
                <button onclick="goToExportPage(${page + 1})" ${nextDisabled ? 'disabled' : ''}
                    class="${btnCls(nextDisabled)}">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        </div>`;
}

function _getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
}

function goToExportPage(page) {
    const totalPages = Math.max(1, Math.ceil(exportHistoryAllItems.length / EXPORTS_PER_PAGE));
    if (page < 1 || page > totalPages) return;
    exportHistoryPage = page;
    renderExportListPage();
}

// ============================================
// RENDER ITEM
// ============================================
function renderExportItem(exp) {
    const d = new Date(exp.created_at);
    const dateStr = d.toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const isChecked = selectedExportIds.has(exp.id);
    const isPending = exp.status !== 'downloaded';

    const badge = isPending
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
               <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
               Chưa tải</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
               <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
               Đã tải</span>`;

    return `
        <div class="export-item flex items-center gap-3 px-4 py-3 rounded-xl border
            ${isPending ? 'border-amber-100 bg-amber-50/40' : 'border-gray-100 bg-white'}
            hover:border-blue-200 hover:shadow-sm transition-all"
            data-export-item-id="${exp.id}">

            <input type="checkbox" ${isChecked ? 'checked' : ''}
                class="export-checkbox w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500/30 cursor-pointer flex-shrink-0"
                data-export-id="${exp.id}"
                onchange="toggleExportSelection(${exp.id})"/>

            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg class="w-4.5 h-4.5 w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
            </div>

            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span class="font-semibold text-sm text-gray-800 truncate">${exp.file_name}</span>
                    ${badge}
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-400">
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        ${dateStr}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        ${exp.order_count} đơn
                    </span>
                </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
                <button onclick="downloadAndUpdateExport(${exp.id})"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Tải xuống
                </button>
                <button onclick="deleteExportFile(${exp.id})" title="Xóa"
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
function closeExportHistoryModal() {
    const modal = document.getElementById('exportHistoryModal');
    if (modal) modal.remove();
    selectedExportIds.clear();
}

// ============================================
// SELECTION
// ============================================
function toggleExportSelection(exportId) {
    if (selectedExportIds.has(exportId)) {
        selectedExportIds.delete(exportId);
    } else {
        selectedExportIds.add(exportId);
    }
    updateSelectionUI();
}

function toggleSelectAllExports() {
    const cb = document.getElementById('selectAllExports');
    if (cb.checked) {
        exportHistoryAllItems.forEach(exp => selectedExportIds.add(exp.id));
    } else {
        selectedExportIds.clear();
    }
    // Re-render to sync checkboxes on current page
    renderExportListPage();
}

function updateSelectionUI() {
    const count = selectedExportIds.size;
    const total = exportHistoryAllItems.length;

    // Count label
    const countEl = document.getElementById('selectedCount');
    if (countEl) {
        countEl.textContent = count > 0 ? `· ${count} đã chọn` : '';
        countEl.classList.toggle('hidden', count === 0);
    }

    // Select-all checkbox state
    const selectAllCb = document.getElementById('selectAllExports');
    if (selectAllCb) {
        selectAllCb.checked = count > 0 && count === total;
        selectAllCb.indeterminate = count > 0 && count < total;
    }

    // Bulk actions bar
    const bulkEl = document.getElementById('bulkActions');
    if (bulkEl) {
        bulkEl.classList.toggle('hidden', count === 0);
        if (count > 0) {
            const mergeBtn = bulkEl.querySelector('button[onclick="bulkMergeAndDownloadExports()"]');
            const dlBtn    = bulkEl.querySelector('button[onclick="bulkDownloadExports()"]');
            if (mergeBtn) mergeBtn.classList.toggle('hidden', count < 2);
            if (dlBtn)    dlBtn.classList.toggle('hidden', count < 2);
        }
    }
}

// ============================================
// DOWNLOAD HELPERS
// ============================================
async function downloadExportFile(exportId) {
    const link = document.createElement('a');
    link.href = `${CONFIG.API_URL}?action=downloadExport&id=${exportId}`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function markExportAsDownloaded(exportId) {
    const response = await fetch(`${CONFIG.API_URL}?action=markExportDownloaded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportId })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Không thể cập nhật trạng thái');
    return data.updatedCount || 0;
}

async function downloadAndUpdateExport(exportId) {
    try {
        showToast('Đang tải file...', 'info');
        await downloadExportFile(exportId);
        closeExportHistoryModal();

        setTimeout(async () => {
            try {
                const updatedCount = await markExportAsDownloaded(exportId);
                exportHistoryCache = null;
                updateExportHistoryBadge().catch(() => {});
                loadOrdersData().catch(() => {});
                if (updatedCount > 0) {
                    showToast(`✅ Đã tải file và cập nhật ${updatedCount} đơn sang "Đã gửi hàng"`, 'success');
                }
            } catch (e) { console.error('Mark downloaded error:', e); }
        }, 500);

    } catch (error) {
        console.error('Download error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ============================================
// DELETE SINGLE (optimistic — no rollback animation since we re-render)
// ============================================
async function deleteExportFile(exportId) {
    if (!confirm('Bạn có chắc chắn muốn xóa file export này?')) return;

    // Optimistic: remove from data array immediately
    exportHistoryAllItems = exportHistoryAllItems.filter(e => e.id !== exportId);
    selectedExportIds.delete(exportId);

    // Adjust page if needed
    const totalPages = Math.max(1, Math.ceil(exportHistoryAllItems.length / EXPORTS_PER_PAGE));
    if (exportHistoryPage > totalPages) exportHistoryPage = totalPages;

    renderExportListPage();

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=deleteExport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportId })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể xóa file');

        showToast('Đã xóa file export', 'success');
        exportHistoryCache = null;
        updateExportHistoryBadge().catch(() => {});

    } catch (error) {
        console.error('Delete error:', error);
        showToast('Lỗi xóa: ' + error.message + ' — đang tải lại...', 'error');
        // Rollback: reload from server
        try {
            const fresh = await loadExportHistory(true);
            exportHistoryAllItems = fresh.exports || [];
            renderExportListPage();
        } catch (e) { console.error('Rollback reload error:', e); }
    }
}

// ============================================
// BULK MERGE & DOWNLOAD
// ============================================
async function bulkMergeAndDownloadExports() {
    if (selectedExportIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để gộp', 'warning');
        return;
    }
    const count = selectedExportIds.size;
    if (count === 1) {
        await downloadAndUpdateExport(Array.from(selectedExportIds)[0]);
        return;
    }
    if (!confirm(`Bạn có muốn gộp ${count} file thành 1 file Excel duy nhất?`)) return;

    try {
        if (typeof XLSX === 'undefined') {
            showToast('Đang tải thư viện Excel...', 'info');
            await loadXLSXLibrary();
        }
        showToast(`Đang gộp ${count} file...`, 'info');

        const response = await fetch(`${CONFIG.API_URL}?action=mergeExports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exportIds: Array.from(selectedExportIds) })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Không thể gộp file');

        showToast(`Đã gộp ${data.exportCount} file (${data.totalOrders} đơn), đang tạo Excel...`, 'info');
        const { wb, filename } = createSPXExcelWorkbook(data.orders);
        const exportIdsArr = Array.from(selectedExportIds);
        closeExportHistoryModal();

        requestAnimationFrame(() => {
            XLSX.writeFile(wb, filename);
            setTimeout(async () => {
                let updated = 0;
                for (const id of exportIdsArr) {
                    try { updated += await markExportAsDownloaded(id); } catch (e) {}
                }
                exportHistoryCache = null;
                updateExportHistoryBadge().catch(() => {});
                if (updated > 0) loadOrdersData().catch(() => {});
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
async function bulkDownloadExports() {
    if (selectedExportIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để tải', 'warning');
        return;
    }
    const count = selectedExportIds.size;
    if (!confirm(`Bạn có chắc chắn muốn tải ${count} file đã chọn?`)) return;

    try {
        showToast(`Đang tải ${count} file...`, 'info');
        let ok = 0, fail = 0, updated = 0;
        for (const id of selectedExportIds) {
            try {
                await downloadExportFile(id);
                updated += await markExportAsDownloaded(id);
                ok++;
                await new Promise(r => setTimeout(r, 500));
            } catch (e) { fail++; }
        }
        closeExportHistoryModal();
        exportHistoryCache = null;
        updateExportHistoryBadge().catch(() => {});
        loadOrdersData().catch(() => {});
        showToast(
            fail === 0
                ? `✅ Đã tải ${ok} file, cập nhật ${updated} đơn sang "Đã gửi hàng"`
                : `⚠️ Tải ${ok} file thành công, ${fail} file lỗi. Cập nhật ${updated} đơn`,
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
async function bulkDeleteExports() {
    if (selectedExportIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 file để xóa', 'warning');
        return;
    }
    const count = selectedExportIds.size;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${count} file đã chọn? Hành động này không thể hoàn tác.`)) return;

    const idsToDelete = Array.from(selectedExportIds);

    // Optimistic: remove from array
    exportHistoryAllItems = exportHistoryAllItems.filter(e => !selectedExportIds.has(e.id));
    selectedExportIds.clear();
    const totalPages = Math.max(1, Math.ceil(exportHistoryAllItems.length / EXPORTS_PER_PAGE));
    if (exportHistoryPage > totalPages) exportHistoryPage = totalPages;
    renderExportListPage();

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
        exportHistoryCache = null;
        updateExportHistoryBadge().catch(() => {});
    } catch (error) {
        console.error('Bulk delete error:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}
