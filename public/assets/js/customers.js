// Customers Management JavaScript
// The table shows `pageState.size` rows (default 20). The first request loads two
// pages (40). Opening a later page paints from that buffer and silently fetches
// one more page so the next click is already local.
let allCustomers = [];
let filteredCustomers = [];
let customerNotes = {}; // { phone: { content, updated_at, has_content } }
let sortState = { column: null, direction: 'asc' };
let pageState = { current: 1, size: 20 };
let listTotal = 0;
let listReady = false;
let listGeneration = 0;
let activeListKey = '';
let customerStats = null;
let loadChain = Promise.resolve();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Customers Management initialized');
    loadCustomers();
    setupEventListeners();
    setupKeyboardShortcuts();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchCustomers, 300));
    }

    const segmentFilter = document.getElementById('segmentFilter');
    if (segmentFilter) {
        segmentFilter.addEventListener('change', filterBySegment);
    }

    // Sortable column headers
    document.querySelectorAll('.sortable-th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            sortCustomers(col);
        });
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape') {
            closeCustomerModal();
        }
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function listParams() {
    const q = document.getElementById('searchInput')?.value.trim() || '';
    const segment = document.getElementById('segmentFilter')?.value || 'all';
    const sort = sortState.column || 'total_spent';
    const dir = sortState.column ? sortState.direction : 'desc';
    return { q, segment, sort, dir };
}

function currentListKey() {
    const p = listParams();
    return `${p.q}\n${p.segment}\n${p.sort}\n${p.dir}`;
}

function resetCustomerBuffer() {
    listGeneration += 1;
    allCustomers = [];
    filteredCustomers = [];
    listTotal = 0;
    listReady = false;
    activeListKey = '';
    pageState.current = 1;
}

async function fetchCustomerPage({ offset, limit, includeStats, params }) {
    const p = params || listParams();
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', 'getAllCustomers');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('sort', p.sort);
    url.searchParams.set('dir', p.dir);
    if (p.q) url.searchParams.set('q', p.q);
    if (p.segment && p.segment !== 'all') url.searchParams.set('segment', p.segment);
    if (includeStats) url.searchParams.set('stats', '1');
    url.searchParams.set('timestamp', String(Date.now()));

    const response = await fetch(url.toString());
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to load customers');
    return data;
}

// Load the first two pages. Later pages append one page at a time.
async function loadCustomers() {
    resetCustomerBuffer();
    try {
        await showCustomerPage();
    } catch (error) {
        console.error('❌ Error loading customers:', error);
        hideLoading();
        showError('Không thể tải danh sách khách hàng');
    }
}

function ensureCustomersLoaded(throughExclusive) {
    const gen = listGeneration;
    const key = currentListKey();
    const run = loadChain.then(() => ensureCustomersLoadedBody(throughExclusive, gen, key));
    loadChain = run.then(() => {}, () => {});
    return run;
}

async function ensureCustomersLoadedBody(throughExclusive, gen, key) {
    if (gen !== listGeneration) return;

    if (activeListKey !== key) {
        allCustomers = [];
        filteredCustomers = [];
        listTotal = 0;
        listReady = false;
        activeListKey = key;
    }

    const needed = listReady ? Math.min(throughExclusive, listTotal) : throughExclusive;
    if (listReady && allCustomers.length >= needed) return;

    const offset = allCustomers.length;
    let limit = throughExclusive - offset;
    if (limit <= 0) return;
    if (listReady) {
        limit = Math.min(limit, Math.max(listTotal - offset, 0));
        if (limit <= 0) return;
    }

    const data = await fetchCustomerPage({
        offset,
        limit,
        includeStats: offset === 0 || !customerStats,
        params: listParams(),
    });
    if (gen !== listGeneration || currentListKey() !== key) return;
    if (offset !== allCustomers.length) return;

    const rows = data.customers || [];
    allCustomers = allCustomers.concat(rows);
    filteredCustomers = allCustomers;
    listTotal = Number(data.total) || 0;
    listReady = true;
    if (data.stats) {
        customerStats = data.stats;
        updateStats();
    }
    console.log('📊 Customers buffered:', allCustomers.length, '/', listTotal);
    await loadCustomerNotes(rows.map((c) => c.phone));
}

// Notes for the phones just loaded. Missing phones are cached as empty so they are not requested again.
async function loadCustomerNotes(phones) {
    const missing = [...new Set((phones || []).filter((phone) => phone && customerNotes[phone] === undefined))];
    if (missing.length === 0) return;

    try {
        for (let i = 0; i < missing.length; i += 80) {
            const slice = missing.slice(i, i + 80);
            const response = await fetch(
                `${CONFIG.API_URL}?action=getCustomerNotesBatch&phones=${encodeURIComponent(JSON.stringify(slice))}&timestamp=${Date.now()}`
            );
            const data = await response.json();
            if (data.success && data.notes) {
                Object.assign(customerNotes, data.notes);
            }
            slice.forEach((phone) => {
                if (!customerNotes[phone]) {
                    customerNotes[phone] = { content: '', has_content: false };
                }
            });
        }
    } catch (error) {
        console.error('❌ Error loading customer notes:', error);
    }
}

// Export the current search, segment, and sort. This is the one path that reads the full match list.
async function exportCustomersCSV() {
    const params = listParams();
    let rows = [];
    try {
        showToast('Đang chuẩn bị file...', 'info');
        let offset = 0;
        let total = Infinity;
        while (offset < total) {
            const data = await fetchCustomerPage({ offset, limit: 500, includeStats: false, params });
            const chunk = data.customers || [];
            total = Number(data.total) || 0;
            rows = rows.concat(chunk);
            offset += chunk.length;
            if (chunk.length === 0) break;
        }
    } catch (error) {
        console.error('Error exporting customers:', error);
        showToast('Không thể xuất danh sách', 'error');
        return;
    }

    if (rows.length === 0) {
        showToast('Không có dữ liệu để xuất', 'error');
        return;
    }

    await loadCustomerNotes(rows.map((c) => c.phone));

    const headers = ['STT', 'Họ và tên', 'Số điện thoại', 'Địa chỉ', 'Phân khúc', 'Số đơn hàng', 'Tổng chi tiêu', 'TB / đơn', 'Đơn gần nhất', 'Khách từ', 'CTV giới thiệu', 'Ghi chú'];

    const csvRows = rows.map((c, i) => [
        i + 1,
        c.name || '',
        c.phone || '',
        c.address || '',
        c.segment || '',
        c.total_orders || 0,
        c.total_spent || 0,
        c.avg_order_value || 0,
        c.last_order_date ? formatDate(c.last_order_date) : '',
        c.first_order_date ? formatDate(c.first_order_date) : '',
        c.ctv_codes || '',
        customerNotes[c.phone]?.content || ''
    ]);

    // BOM for Excel UTF-8 compatibility (displays Vietnamese correctly)
    const BOM = '\uFEFF';
    const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.map(cell => {
            const str = String(cell);
            // Escape double quotes and wrap if contains comma, newline, or quote
            return (str.includes(',') || str.includes('\n') || str.includes('"'))
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(','))
    ].join('\n');

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
    link.href = url;
    link.download = `danh-sach-khach-hang_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất ${rows.length} khách hàng`, 'success');
}

// Search customers — same window as the default list, not the full match set
async function searchCustomers() {
    resetCustomerBuffer();
    try {
        await showCustomerPage();
    } catch (error) {
        console.error('Error searching customers:', error);
        hideLoading();
        showError('Không thể tìm khách hàng');
    }
}

// Filter by segment on the server so later pages stay inside that segment
function filterBySegment() {
    resetCustomerBuffer();
    showCustomerPage().catch((error) => {
        console.error('Error filtering customers:', error);
        hideLoading();
        showError('Không thể lọc khách hàng');
    });
}

// Sort customers by column. The loaded window is dropped because order comes from the server.
function sortCustomers(column) {
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = column === 'name' || column === 'phone' || column === 'segment' || column === 'address' ? 'asc' : 'desc';
    }

    updateSortIcons();
    resetCustomerBuffer();
    showCustomerPage().catch((error) => {
        console.error('Error sorting customers:', error);
        hideLoading();
        showError('Không thể sắp xếp khách hàng');
    });
}

function updateSortIcons() {
    document.querySelectorAll('.sortable-th').forEach(th => {
        th.classList.remove('sorted', 'sorted-asc', 'sorted-desc');
        const icons = th.querySelector('.sort-icon');
        if (!icons) return;

        if (th.dataset.sort === sortState.column) {
            th.classList.add('sorted', `sorted-${sortState.direction}`);
            // Show active arrow only
            icons.innerHTML = sortState.direction === 'asc'
                ? `<svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" class="text-indigo-500"><path d="M5 0L10 8H0L5 0Z"/></svg><svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" class="text-slate-300"><path d="M5 8L0 0H10L5 8Z"/></svg>`
                : `<svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" class="text-slate-300"><path d="M5 0L10 8H0L5 0Z"/></svg><svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" class="text-indigo-500"><path d="M5 8L0 0H10L5 8Z"/></svg>`;
        } else {
            icons.innerHTML = `<svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" class="text-slate-300"><path d="M5 0L10 8H0L5 0Z"/></svg><svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" class="text-slate-300"><path d="M5 8L0 0H10L5 8Z"/></svg>`;
        }
    });
}

// Pagination — renders bar only, zero DOM overhead when not needed
function renderPaginationBar(totalItems, totalPages) {
    const existing = document.getElementById('paginationBar');
    if (totalItems === 0) {
        existing?.remove();
        return;
    }
    if (!existing) return; // bar added via HTML, just update text

    const { current, size } = pageState;
    const start = (current - 1) * size + 1;
    const end = Math.min(current * size, totalItems);

    // Info text
    const infoEl = existing.querySelector('#paginationInfo');
    if (infoEl) infoEl.textContent = `${start}–${end} / ${totalItems.toLocaleString('vi')} khách`;

    // Page size select
    const selectEl = existing.querySelector('#pageSizeSelect');
    if (selectEl) {
        selectEl.value = size;
        selectEl.onchange = () => {
            pageState.size = Number(selectEl.value) || 20;
            pageState.current = 1;
            showCustomerPage();
        };
    }

    // Prev/Next buttons
    const prevBtn = existing.querySelector('#prevPageBtn');
    const nextBtn = existing.querySelector('#nextPageBtn');
    if (prevBtn) {
        prevBtn.disabled = current <= 1;
        prevBtn.onclick = () => {
            if (pageState.current <= 1) return;
            pageState.current--;
            scrollToTable();
            showCustomerPage();
        };
    }
    if (nextBtn) {
        nextBtn.disabled = current >= totalPages;
        nextBtn.onclick = () => {
            if (pageState.current >= totalPages) return;
            pageState.current++;
            scrollToTable();
            showCustomerPage();
        };
    }

    // Page numbers
    const pagesEl = existing.querySelector('#pageNumbers');
    if (pagesEl) pagesEl.innerHTML = buildPageNumbers(current, totalPages);
}

function buildPageNumbers(current, total) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => pageBtn(i + 1, current)).join('');
    }

    const pages = [];
    if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(pageBtn(i, current));
        pages.push('<span class="px-2 text-slate-400">…</span>');
        pages.push(pageBtn(total, current));
    } else if (current >= total - 3) {
        pages.push(pageBtn(1, current));
        pages.push('<span class="px-2 text-slate-400">…</span>');
        for (let i = total - 4; i <= total; i++) pages.push(pageBtn(i, current));
    } else {
        pages.push(pageBtn(1, current));
        pages.push('<span class="px-2 text-slate-400">…</span>');
        for (let i = current - 1; i <= current + 1; i++) pages.push(pageBtn(i, current));
        pages.push('<span class="px-2 text-slate-400">…</span>');
        pages.push(pageBtn(total, current));
    }
    return pages.join('');
}

function pageBtn(num, current) {
    const active = num === current
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200';
    return `<button onclick="goToPage(${num})" class="min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-all ${active}">${num}</button>`;
}

function goToPage(num) {
    const totalPages = Math.max(1, Math.ceil((listTotal || 0) / pageState.size));
    if (num < 1 || (listReady && num > totalPages)) return;
    pageState.current = num;
    scrollToTable();
    showCustomerPage();
}

function scrollToTable() {
    document.getElementById('tableContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Update statistics from the server summary, not from the rows loaded so far
function updateStats() {
    if (!customerStats) return;
    const totalOrders = customerStats.totalOrders || 0;
    const totalRevenue = customerStats.totalRevenue || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('totalCustomers').textContent = customerStats.totalCustomers;
    document.getElementById('newCustomers').textContent = customerStats.newCustomers;
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrderValue);
}

// Render customers table
function renderCustomers() {
    showCustomerPage();
}

let customerPageToken = 0;

// Page 1 loads two pages. Each later page paints what is already buffered, then
// fetches the following page without the table skeleton.
async function showCustomerPage() {
    const token = ++customerPageToken;
    const size = pageState.size;
    const pageEnd = pageState.current * size;
    const bufferEnd = (pageState.current + 1) * size;
    const key = currentListKey();
    const canPaint = listReady
        && activeListKey === key
        && allCustomers.length >= Math.min(pageEnd, listTotal);

    try {
        if (!canPaint) {
            showLoading();
            // First visit of a query loads the current page and the next one together.
            // A later page that is not buffered yet loads only through the rows on screen.
            const target = listReady && activeListKey === key ? pageEnd : bufferEnd;
            await ensureCustomersLoaded(target);
            if (token !== customerPageToken) return;
        }

        paintCustomers();
        if (token !== customerPageToken) return;

        // The next page is fetched quietly so the following click does not wait.
        if (listReady && allCustomers.length < Math.min(bufferEnd, listTotal)) {
            ensureCustomersLoaded(bufferEnd).catch((error) => {
                console.error('❌ Error prefetching customers:', error);
            });
        }
    } catch (error) {
        if (token !== customerPageToken) return;
        console.error('❌ Error loading customers:', error);
        hideLoading();
        showError('Không thể tải danh sách khách hàng');
    }
}

function paintCustomers() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody || !listReady) return;

    if (listTotal === 0) {
        showEmptyState();
        return;
    }

    const totalPages = Math.max(1, Math.ceil(listTotal / pageState.size));
    if (pageState.current > totalPages) pageState.current = totalPages;
    if (pageState.current < 1) pageState.current = 1;

    const start = (pageState.current - 1) * pageState.size;
    const pageData = allCustomers.slice(start, start + pageState.size);
    if (pageData.length === 0) return;

    tbody.innerHTML = pageData.map((customer, i) => createCustomerRow(customer, start + i + 1)).join('');
    renderPaginationBar(listTotal, totalPages);
    showTable();
}

// Create customer row HTML
function createCustomerRow(customer, index) {
    const segmentBadges = {
        'VIP': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 text-yellow-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>VIP</span>',
        'Regular': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Regular</span>',
        'New': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>New</span>',
        'At Risk': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-orange-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>At Risk</span>',
        'Churned': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>Churned</span>'
    };

    // Show actual date of last order instead of "days ago"
    const lastOrderText = customer.last_order_date
        ? formatDate(customer.last_order_date)
        : 'Chưa có đơn';

    const phone = escapeHtml(customer.phone || '');
    const cleanPhone = phone.replace(/[\s\-\.\/]+/g, '');
    const zaloHref = `https://zalo.me/${cleanPhone}`;

    const noteData = customerNotes[customer.phone];
    const hasNote = noteData && noteData.has_content;
    const notePreview = hasNote ? escapeHtml(noteData.content.substring(0, 40) + (noteData.content.length > 40 ? '…' : '')) : '';

    return `
        <tr class="hover:bg-slate-50/90 transition-colors group">
            <td class="px-5 py-4 whitespace-nowrap text-sm text-slate-400 font-medium tabular-nums">${index}</td>
            <td class="px-5 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-sky-500/15 ring-2 ring-white">
                        <span class="text-white font-bold text-xs">${getInitials(customer.name)}</span>
                    </div>
                    <div class="min-w-0">
                        <div class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(customer.name)}</div>
                        <div class="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs">${escapeHtml(customer.address || 'Chưa có địa chỉ')}</div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <span class="text-sm text-slate-800 font-mono tracking-tight">${phone}</span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                ${segmentBadges[customer.segment] || segmentBadges['New']}
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <span class="text-sm font-bold text-slate-900 tabular-nums">${customer.total_orders}</span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <div class="text-sm font-bold text-emerald-700 tabular-nums">${formatCurrency(customer.total_spent)}</div>
                <div class="text-xs text-slate-400 mt-0.5">TB ${formatCurrency(customer.avg_order_value)}</div>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <span class="text-sm text-slate-600 tabular-nums">${lastOrderText}</span>
            </td>
            <td class="px-5 py-4 max-w-[200px]">
                ${hasNote ? `
                <button type="button" onclick="openNoteModal('${phone}', '${escapeHtml(customer.name)}')"
                    title="${notePreview}"
                    class="text-left w-full truncate block text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg px-2.5 py-1.5 transition-colors border border-amber-100">
                    ${notePreview}
                </button>
                ` : `
                <button type="button" onclick="openNoteModal('${phone}', '${escapeHtml(customer.name)}')"
                    title="Thêm ghi chú"
                    class="text-left w-full text-xs text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg px-2.5 py-1.5 transition-colors">
                    Chưa có
                </button>
                `}
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-center">
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                    <a href="${zaloHref}" target="_blank" rel="noopener" title="Nhắn Zalo"
                        class="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-[#0068FF] hover:bg-blue-50 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                            <path fill-rule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clip-rule="evenodd" />
                        </svg>
                    </a>
                    <button type="button" onclick="viewCustomerDetail('${phone}')" title="Chi tiết" aria-label="Chi tiết"
                        class="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button type="button" onclick="confirmDeleteCustomer('${phone}', '${escapeHtml(customer.name)}')"
                        class="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa khách hàng">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}


// View customer detail
async function viewCustomerDetail(phone) {
    try {
        showToast('Đang tải...', 'info');

        const [detailRes, noteRes] = await Promise.all([
            fetch(`${CONFIG.API_URL}?action=getCustomerDetail&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`),
            fetch(`${CONFIG.API_URL}?action=getCustomerNote&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`)
        ]);

        const [detailData, noteData] = await Promise.all([detailRes.json(), noteRes.json()]);

        if (detailData.success) {
            // Pre-populate note cache for this customer
            if (noteData.success && noteData.note) {
                customerNotes[phone] = {
                    content: noteData.note.content || '',
                    updated_at: noteData.note.updated_at,
                    has_content: !!(noteData.note.content && noteData.note.content.trim())
                };
            }
            showCustomerModal(detailData.customer);
        } else {
            throw new Error(detailData.error || 'Không thể tải thông tin khách hàng');
        }
    } catch (error) {
        console.error('Error loading customer detail:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Show customer detail modal
function showCustomerModal(customer) {
    const modal = document.createElement('div');
    modal.id = 'customerModal';
    modal.className = 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    const segmentBadges = {
        'VIP': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 text-yellow-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-yellow-500 rounded-full"></span>VIP</span>',
        'Regular': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-green-500 rounded-full"></span>Regular</span>',
        'New': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-blue-500 rounded-full"></span>New</span>',
        'At Risk': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-orange-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-orange-500 rounded-full"></span>At Risk</span>',
        'Churned': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-gray-400 rounded-full"></span>Churned</span>'
    };

    // Show actual date instead of "days ago"
    const lastOrderText = customer.last_order_date
        ? formatDate(customer.last_order_date)
        : 'Chưa có đơn';

    const firstOrderText = customer.first_order_date
        ? formatDate(customer.first_order_date)
        : 'Chưa rõ';

    const orders = Array.isArray(customer.orders) ? customer.orders : [];

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-6 py-5 border-b border-slate-100 shrink-0">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-4 min-w-0">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-2 ring-white shrink-0">
                            <span class="text-white font-bold text-lg">${getInitials(customer.name)}</span>
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-xl font-bold text-slate-900 truncate">${escapeHtml(customer.name)}</h2>
                            <p class="text-sm text-slate-500 font-mono mt-0.5">${escapeHtml(customer.phone)}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeCustomerModal()" class="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0" aria-label="Đóng">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1 min-h-0">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div class="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Phân khúc</p>
                        ${segmentBadges[customer.segment] || segmentBadges['New']}
                    </div>
                    <div class="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                        <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Tổng đơn</p>
                        <p class="text-2xl font-bold text-emerald-900 tabular-nums">${customer.total_orders}</p>
                    </div>
                    <div class="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                        <p class="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Tổng chi tiêu</p>
                        <p class="text-lg font-bold text-violet-900 tabular-nums leading-tight">${formatCurrency(customer.total_spent)}</p>
                    </div>
                    <div class="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                        <p class="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">TB / đơn</p>
                        <p class="text-lg font-bold text-amber-900 tabular-nums leading-tight">${formatCurrency(customer.avg_order_value)}</p>
                    </div>
                </div>

                <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-4 mb-6">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Thông tin liên hệ</h3>
                    <div class="space-y-2.5 text-sm">
                        <div class="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                            <span class="text-slate-500 shrink-0">Địa chỉ</span>
                            <span class="text-slate-900 font-medium text-right sm:text-left">${escapeHtml(customer.address || 'Chưa có')}</span>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                            <span class="text-slate-500 shrink-0">Đơn gần nhất</span>
                            <span class="text-slate-900 font-medium tabular-nums">${lastOrderText}</span>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                            <span class="text-slate-500 shrink-0">Khách từ</span>
                            <span class="text-slate-900 font-medium tabular-nums">${firstOrderText}</span>
                        </div>
                        ${customer.ctv_codes ? `
                        <div class="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                            <span class="text-slate-500 shrink-0">CTV giới thiệu</span>
                            <span class="text-slate-900 font-medium">${escapeHtml(customer.ctv_codes)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="rounded-xl border border-amber-100 bg-amber-50/30 p-4 mb-6">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-amber-700">Ghi chú</h3>
                        <button type="button" onclick="openNoteModalFromDetail('${phone}', '${escapeHtml(customer.name)}')"
                            class="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                            ${customerNotes[customer.phone]?.has_content ? 'Sửa' : 'Thêm ghi chú'}
                        </button>
                    </div>
                    <div id="detailNoteContent" class="text-sm text-slate-700 min-h-[40px]">
                        ${customerNotes[customer.phone]?.has_content
                            ? `<div class="bg-white/70 rounded-lg p-3 border border-amber-100">${escapeHtml(customerNotes[customer.phone].content).replace(/\n/g, '<br>')}</div>`
                            : '<span class="text-slate-400 italic">Chưa có ghi chú nào</span>'
                        }
                    </div>
                </div>

                <div>
                    <h3 class="text-base font-bold text-slate-900 mb-3">Lịch sử đơn hàng <span class="text-slate-400 font-semibold">(${orders.length})</span></h3>
                    <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
                        ${orders.length === 0 ? '<p class="text-sm text-slate-500 py-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">Chưa có đơn hàng trong lịch sử.</p>' : orders.map(order => `
                            <div class="rounded-xl border border-slate-100 bg-white p-4 hover:border-slate-200 hover:shadow-sm transition-all">
                                <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-xs font-mono font-bold text-indigo-600">${escapeHtml(order.order_id)}</span>
                                        ${getStatusBadge(order.status)}
                                    </div>
                                    <span class="text-base font-bold text-emerald-700 tabular-nums">${formatCurrency(order.total_amount)}</span>
                                </div>
                                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                    <span class="tabular-nums">${formatDate(order.created_at_unix)}</span>
                                    ${order.referral_code ? `<span class="text-violet-600 font-medium">CTV ${escapeHtml(order.referral_code)}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
                <button type="button" onclick="closeCustomerModal()"
                    class="px-5 py-2.5 text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold shadow-sm">
                    Đóng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Close customer modal
function closeCustomerModal() {
    const modal = document.getElementById('customerModal');
    if (modal) {
        modal.remove();
    }
}

// Get status badge
function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-100 border border-yellow-200 text-yellow-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>Chờ xử lý</span>',
        'processing': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 border border-blue-200 text-blue-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Đang xử lý</span>',
        'shipped': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-100 border border-purple-200 text-purple-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>Đã gửi</span>',
        'delivered': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 border border-green-200 text-green-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Đã giao</span>',
        'cancelled': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-red-100 border border-red-200 text-red-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>Đã hủy</span>'
    };
    return badges[status] || badges['pending'];
}

// Utility functions
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        let date;
        
        // Check if it's a timestamp (number)
        if (typeof dateString === 'number' || !isNaN(Number(dateString))) {
            // It's a Unix timestamp in milliseconds
            date = new Date(Number(dateString));
        } else {
            // It's a date string
            date = new Date(dateString);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateString);
            return dateString;
        }
        
        // Format as DD/MM/YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('Error formatting date:', e, dateString);
        return dateString;
    }
}

function formatDaysAgo(days) {
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;
    if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
}

function showLoading() {
    document.getElementById('loadingState')?.classList.remove('hidden');
    document.getElementById('tableContent')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState')?.classList.add('hidden');
}

function showTable() {
    hideLoading();
    document.getElementById('tableContent')?.classList.remove('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function showEmptyState() {
    hideLoading();
    document.getElementById('tableContent')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}

// showToast is now provided by toast-manager.js


// ============================================
// CUSTOM DROPDOWN FILTERS
// ============================================

// Toggle segment filter dropdown
function toggleSegmentFilter(event) {
    event.stopPropagation();

    // Close if already open
    const existingMenu = document.getElementById('segmentFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const segments = [
        { value: 'all', label: 'Tất cả phân khúc', dotClass: 'bg-slate-400' },
        { value: 'VIP', label: 'VIP (≥5 đơn)', dotClass: 'bg-yellow-500' },
        { value: 'Regular', label: 'Regular (2-4 đơn)', dotClass: 'bg-emerald-500' },
        { value: 'New', label: 'New (1 đơn)', dotClass: 'bg-sky-500' },
        { value: 'At Risk', label: 'At Risk (>60 ngày)', dotClass: 'bg-orange-500' },
        { value: 'Churned', label: 'Churned (>90 ngày)', dotClass: 'bg-slate-400' }
    ];

    const currentValue = document.getElementById('segmentFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'segmentFilterMenu';
    menu.className = 'segment-filter-menu absolute left-0 top-full bg-white rounded-xl shadow-xl shadow-slate-900/15 border border-slate-200 py-1 z-[200] min-w-[260px] mt-1.5 overflow-hidden';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = segments.map(s => `
        <button 
            type="button"
            onclick="selectSegmentFilter('${s.value}', '${s.label.replace(/'/g, "\\'")}')"
            class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left text-sm ${s.value === currentValue ? 'bg-indigo-50/80' : ''}"
        >
            <div class="w-2.5 h-2.5 rounded-full ${s.dotClass} flex-shrink-0 ring-2 ring-white shadow-sm"></div>
            <span class="text-slate-700 flex-1 font-medium">${s.label}</span>
            ${s.value === currentValue ? `
                <svg class="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    button.style.position = 'relative';
    button.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select segment filter
function selectSegmentFilter(value, label) {
    document.getElementById('segmentFilter').value = value;
    document.getElementById('segmentFilterLabel').textContent = label;
    document.getElementById('segmentFilterMenu')?.remove();
    filterBySegment();
}

// Confirm delete customer
function confirmDeleteCustomer(phone, name) {
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteModal';
    modal.className = 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 max-w-md w-full overflow-hidden">
            <div class="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-red-50/80 via-white to-rose-50/50">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center ring-1 ring-red-200/60 shrink-0">
                        <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-slate-900">Xóa khách hàng?</h3>
                </div>
            </div>
            <div class="p-6">
                <p class="text-sm text-slate-600 mb-3">Hành động này không thể hoàn tác. Khách hàng sẽ bị gỡ khỏi danh sách.</p>
                <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 mb-4">
                    <p class="font-semibold text-slate-900">${escapeHtml(name)}</p>
                    <p class="text-sm text-slate-500 font-mono mt-1">${escapeHtml(phone)}</p>
                </div>
                <div class="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3">
                    <p class="text-xs text-amber-900 leading-relaxed">Lịch sử đơn hàng trong hệ thống có thể vẫn được giữ tùy cấu hình server — chỉ bản ghi khách hàng này bị xóa.</p>
                </div>
            </div>
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button type="button" onclick="closeConfirmDeleteModal()"
                    class="px-5 py-2.5 text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold">
                    Hủy
                </button>
                <button type="button" onclick="deleteCustomer('${escapeHtml(phone)}')"
                    class="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-semibold shadow-sm">
                    Xóa vĩnh viễn
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close confirm delete modal
function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) modal.remove();
}

// Delete customer
async function deleteCustomer(phone) {
    closeConfirmDeleteModal();

    try {
        showToast('Đang xóa khách hàng...', 'info');

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteCustomer',
                phone: phone
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Đã xóa khách hàng thành công', 'success');
            // Reload customers list
            await loadCustomers();
        } else {
            throw new Error(data.error || 'Không thể xóa khách hàng');
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ============================================================
// Customer Notes Modal
// ============================================================

// Open note modal for a customer (called from table row)
async function openNoteModal(phone, customerName) {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getCustomerNote&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            showNoteModal(phone, customerName, data.note?.content || '');
        } else {
            showNoteModal(phone, customerName, '');
        }
    } catch (error) {
        console.error('Error loading note:', error);
        showNoteModal(phone, customerName, '');
    }
}

// Open note modal from detail view (uses local cache first)
function openNoteModalFromDetail(phone, customerName) {
    const cached = customerNotes[phone];
    if (cached) {
        showNoteModal(phone, customerName, cached.content || '');
    } else {
        openNoteModal(phone, customerName);
    }
}

// Show note modal (create or edit)
function showNoteModal(phone, customerName, currentContent) {
    const existing = document.getElementById('noteModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'noteModal';
    modal.className = 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4';
    modal.onclick = function(e) {
        if (e.target === modal) closeNoteModal();
    };

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 w-full max-w-md">
            <div class="px-6 py-5 border-b border-slate-100">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h2 class="text-lg font-bold text-slate-900">Ghi chú khách hàng</h2>
                        <p class="text-sm text-slate-500 mt-0.5">${escapeHtml(customerName)}</p>
                    </div>
                    <button type="button" onclick="closeNoteModal()" class="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0" aria-label="Đóng">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-6">
                <textarea id="noteContent" rows="6"
                    placeholder="Nhập ghi chú cho khách hàng này..."
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-300 transition-colors bg-slate-50/50"
                >${escapeHtml(currentContent)}</textarea>
                <div id="noteError" class="hidden mt-2 text-sm text-red-600"></div>
            </div>
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" onclick="closeNoteModal()"
                    class="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm">
                    Hủy
                </button>
                <button type="button" id="saveNoteBtn" onclick="saveNote('${escapeHtml(phone)}')"
                    class="px-5 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors text-sm font-semibold shadow-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Lưu ghi chú
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('noteContent').focus();
}

// Close note modal
function closeNoteModal() {
    const modal = document.getElementById('noteModal');
    if (modal) modal.remove();
}

// Save note for a customer
async function saveNote(phone) {
    const content = document.getElementById('noteContent').value;
    const errorEl = document.getElementById('noteError');
    const saveBtn = document.getElementById('saveNoteBtn');

    if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Đang lưu…`;
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveCustomerNote',
                phone: phone,
                content: content
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local cache
            customerNotes[phone] = {
                content: data.note.content,
                updated_at: data.note.updated_at,
                has_content: data.note.has_content
            };

            closeNoteModal();
            renderCustomers();

            const msg = content.trim() ? 'Đã lưu ghi chú' : 'Đã xóa ghi chú';
            showToast(msg, 'success');
        } else {
            throw new Error(data.error || 'Không thể lưu ghi chú');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        if (errorEl) {
            errorEl.textContent = 'Lỗi: ' + error.message;
            errorEl.classList.remove('hidden');
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Lưu ghi chú`;
        }
    }
}
