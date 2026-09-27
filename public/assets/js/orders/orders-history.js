// Orders History Mode — LUỒNG 2: xem đơn ĐÃ GỬI / TẤT CẢ qua cursor pagination server.
//
// allOrdersData (LUỒNG 1) chỉ chứa đơn CHƯA GỬI HÀNG. Khi người dùng lọc trạng thái
// "Đã gửi hàng" (shipped) hoặc "Tất cả trạng thái" (all) VÀ không dùng tìm kiếm / bộ lọc
// đặc biệt / sort theo giá trị, ta chuyển sang HISTORY MODE: mỗi trang tải riêng từ API
// getOrdersHistoryPage bằng cursor keyset (Trước/Sau), KHÔNG giữ toàn bộ ở client.
//
// Dữ liệu trang hiện tại được đổ vào filteredOrdersData để renderOrdersTable dùng lại
// nguyên vẹn (không phải sửa orders-table.js). Server đã lọc + sort sẵn nên client
// KHÔNG filter/sort lại trong history mode.
//
// Dependencies (global): CONFIG.API_URL, filteredOrdersData, currentPage, itemsPerPage,
//   renderOrdersTable(), showLoading()/hideLoading(), showToast(), dateSortOrder,
//   selectedOrderIds, clearSelection(), getVN* (timezone-utils).

// Trạng thái history mode — gói trong 1 object để dễ theo dõi & reset.
const ordersHistoryState = {
    active: false,          // đang ở history mode?
    loading: false,         // đang gọi API trang?
    hasMore: false,         // còn trang sau?
    pageIndex: 0,           // trang hiện tại (1-based khi đã tải)
    cursorStack: [],        // stack cursor ĐẦU mỗi trang đã đi qua (để quay lại Trước)
    nextCursor: null,       // cursor để lấy trang KẾ TIẾP (từ response)
    lastFilterKey: '',      // chữ ký filter hiện tại — đổi thì reset về trang 1
};

/**
 * Điều kiện kích hoạt history mode: statusFilter là shipped/all VÀ không có bất kỳ
 * yếu tố nào buộc phải xử lý toàn bộ ở client (tìm kiếm, 3 bộ lọc đặc biệt, sort giá trị).
 * Nếu bất kỳ điều kiện phụ thuộc client bật lên → trả false → dùng LOCAL MODE (fallback an toàn).
 */
function shouldUseHistoryMode() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'pending';
    if (statusFilter !== 'shipped' && statusFilter !== 'all') return false;

    const searchRaw = (document.getElementById('searchInput')?.value || '').trim();
    if (searchRaw) return false;

    // 3 bộ lọc đặc biệt (parse JSON products ở client) — không đưa lên SQL được
    if (typeof missingSizeFilterActive !== 'undefined' && missingSizeFilterActive) return false;
    if (typeof theTenBeFilterActive !== 'undefined' && theTenBeFilterActive) return false;
    if (typeof hasNotesFilterActive !== 'undefined' && hasNotesFilterActive) return false;
    if (typeof sendLaterUrgentFilterActive !== 'undefined' && sendLaterUrgentFilterActive) return false;

    // Sort theo GIÁ TRỊ đơn cần toàn bộ dữ liệu để xếp đúng → client mode
    if (typeof amountSortOrder !== 'undefined' && amountSortOrder !== 'none') return false;

    return true;
}

/** Chữ ký filter hiện tại (đổi → phải reset về trang 1 & tải lại). */
function _historyFilterKey() {
    const g = (id) => document.getElementById(id)?.value || 'all';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const dir = (typeof dateSortOrder !== 'undefined' ? dateSortOrder : 'desc');
    return [
        statusFilter,
        g('paymentFilter'),
        g('customerSourceFilter'),
        g('ctvFilter'),
        g('invoiceStatusFilter'),
        g('dateFilter'),
        document.getElementById('customDateStart')?.value || '',
        document.getElementById('customDateEnd')?.value || '',
        dir,
        itemsPerPage
    ].join('|');
}

/**
 * Tính khoảng ngày (ms, VN) từ dropdown dateFilter — tái dùng các helper timezone-utils
 * để KHỚP đúng logic lọc ngày ở client (filterOrdersData local mode).
 * Trả { dateField, dateStartMs, dateEndMs }.
 */
function _historyDateRange(statusFilter) {
    // Đơn đã gửi lọc/sort theo ngày GỬI; tất cả → theo ngày TẠO (đồng bộ getOrderSortTimestampMs).
    const dateField = statusFilter === 'shipped' ? 'shipped' : 'created';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';
    let dateStartMs = null;
    let dateEndMs = null;

    try {
        if (dateFilter === 'today') {
            dateStartMs = getVNStartOfToday().getTime();
            dateEndMs = getVNEndOfToday().getTime();
        } else if (dateFilter === 'yesterday') {
            const todayStart = getVNStartOfToday().getTime();
            dateStartMs = todayStart - 24 * 60 * 60 * 1000;
            dateEndMs = todayStart - 1;
        } else if (dateFilter === 'week') {
            dateStartMs = getVNStartOfLast7Days().getTime();
            dateEndMs = getVNEndOfToday().getTime();
        } else if (dateFilter === 'month') {
            dateStartMs = getVNStartOfLast30Days().getTime();
            dateEndMs = getVNEndOfToday().getTime();
        } else if (dateFilter === 'lastMonth') {
            dateStartMs = getVNStartOfLastMonth().getTime();
            dateEndMs = getVNEndOfLastMonth().getTime();
        } else if (dateFilter === 'custom') {
            const s = document.getElementById('customDateStart')?.value;
            const e = document.getElementById('customDateEnd')?.value;
            if (s && e) {
                dateStartMs = getVNStartOfDate(s).getTime();
                dateEndMs = getVNEndOfDate(e).getTime();
            }
        }
    } catch (err) {
        console.warn('[History] Lỗi tính khoảng ngày:', err);
    }
    return { dateField, dateStartMs, dateEndMs };
}

/** Dựng query params cho getOrdersHistoryPage từ DOM filter hiện tại. */
function _historyBaseParams() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const { dateField, dateStartMs, dateEndMs } = _historyDateRange(statusFilter);
    const dir = (typeof dateSortOrder !== 'undefined' ? dateSortOrder : 'desc');
    const params = new URLSearchParams();
    params.set('action', 'getOrdersHistoryPage');
    params.set('statusFilter', statusFilter);
    params.set('paymentFilter', document.getElementById('paymentFilter')?.value || 'all');
    params.set('customerSourceFilter', document.getElementById('customerSourceFilter')?.value || 'all');
    params.set('ctvFilter', document.getElementById('ctvFilter')?.value || 'all');
    params.set('invoiceStatusFilter', document.getElementById('invoiceStatusFilter')?.value || 'all');
    params.set('dateField', dateField);
    if (dateStartMs != null) params.set('dateStartMs', String(dateStartMs));
    if (dateEndMs != null) params.set('dateEndMs', String(dateEndMs));
    params.set('sortDir', dir === 'asc' ? 'asc' : 'desc');
    params.set('limit', String(itemsPerPage));
    return params;
}

/**
 * Gọi API 1 trang history với cursor cho trước (null = trang đầu).
 * Đổ kết quả vào filteredOrdersData + render. Cập nhật ordersHistoryState.
 * @param {{sort:number,id:number}|null} cursor
 * @param {number} pageIndex - số trang sẽ hiển thị sau khi tải xong
 */
async function _fetchHistoryPage(cursor, pageIndex) {
    if (ordersHistoryState.loading) return;
    ordersHistoryState.loading = true;

    // Bảng đang trống → dùng skeleton (loadingState) như bình thường.
    // Bảng đã có dữ liệu (chuyển trang / đổi chế độ) → hiện toast "Đang tải đơn hàng..."
    // ở góc màn hình (id cố định để cập nhật/ẩn đúng, spinner quay của type 'info').
    const hadData = Array.isArray(filteredOrdersData) && filteredOrdersData.length > 0;
    if (!hadData && typeof showLoading === 'function') {
        showLoading();
    } else {
        setHistoryOverlay(true);
    }

    try {
        const params = _historyBaseParams();
        if (cursor && Number.isFinite(cursor.sort) && Number.isFinite(cursor.id)) {
            params.set('cursorSort', String(cursor.sort));
            params.set('cursorId', String(cursor.id));
        }
        params.set('timestamp', String(Date.now()));

        const url = `${CONFIG.API_URL}?${params.toString()}`;
        console.log(`[History] 🌐 Tải trang ${pageIndex} — cursor=${cursor ? cursor.sort + '/' + cursor.id : 'đầu'}`);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Không tải được đơn hàng');

        // Đổ thẳng vào filteredOrdersData — server đã lọc + sort sẵn, client KHÔNG xử lý lại.
        filteredOrdersData = data.orders || [];
        ordersHistoryState.hasMore = !!data.hasMore;
        ordersHistoryState.nextCursor = data.nextCursor || null;
        ordersHistoryState.pageIndex = pageIndex;

        // Bỏ chọn khi chuyển trang history (tránh export nhầm đơn không còn trên bảng).
        if (typeof selectedOrderIds !== 'undefined' && selectedOrderIds.size > 0
            && typeof clearSelection === 'function') {
            clearSelection();
        }

        currentPage = 1; // renderOrdersTable dùng slice; mỗi trang history chỉ chứa 1 trang dữ liệu
        console.log(`[History] ✅ Trang ${pageIndex}: ${filteredOrdersData.length} đơn, hasMore=${ordersHistoryState.hasMore}`);

        // QUAN TRỌNG: tắt cờ loading TRƯỚC khi render — vì renderHistoryPagination tính
        // canNext = hasMore && !loading. Nếu còn loading=true lúc render, nút "Sau" sẽ bị
        // disable oan dù còn trang sau. Tại đây fetch đã xong nên loading=false là đúng.
        ordersHistoryState.loading = false;

        if (typeof renderOrdersTable === 'function') renderOrdersTable();
        if (typeof updateStats === 'function') updateStats();
    } catch (err) {
        console.error('[History] ❌ Lỗi tải trang:', err);
        if (typeof showToast === 'function') showToast('Không tải được danh sách đơn: ' + err.message, 'error');
    } finally {
        ordersHistoryState.loading = false;
        if (typeof hideLoading === 'function') hideLoading();
        setHistoryOverlay(false);
    }
}

/**
 * Bật/tắt thông báo "Đang tải đơn hàng..." ở GÓC màn hình (toast) khi chuyển trang/đổi chế độ.
 * Dùng toast-manager có sẵn: type 'info' hiển thị spinner quay; id cố định để lần gọi sau
 * cập nhật cùng 1 toast thay vì chồng nhiều toast; duration 0 = không tự ẩn (ta chủ động ẩn).
 */
const HISTORY_LOADING_TOAST_ID = 'history-loading';
function setHistoryOverlay(show) {
    if (show) {
        if (typeof showToast === 'function') {
            showToast('Đang tải đơn hàng...', 'info', 0, HISTORY_LOADING_TOAST_ID);
        }
    } else if (typeof toastManager !== 'undefined' && toastManager.removeById) {
        toastManager.removeById(HISTORY_LOADING_TOAST_ID);
    }
}

/**
 * Vào / làm mới history mode ở trang 1 (gọi khi đổi filter hoặc lần đầu bật shipped/all).
 * Reset cursor stack.
 */
function enterHistoryModeFirstPage() {
    ordersHistoryState.active = true;
    ordersHistoryState.pageIndex = 0;
    ordersHistoryState.cursorStack = [null]; // cursor đầu trang 1 = null
    ordersHistoryState.nextCursor = null;
    ordersHistoryState.hasMore = false;
    ordersHistoryState.lastFilterKey = _historyFilterKey();
    void _fetchHistoryPage(null, 1);
}

/** Thoát history mode (khi quay về pending/send_later hoặc bật search/filter đặc biệt). */
function exitHistoryMode() {
    if (!ordersHistoryState.active) return;
    ordersHistoryState.active = false;
    ordersHistoryState.cursorStack = [];
    ordersHistoryState.nextCursor = null;
    ordersHistoryState.hasMore = false;
    ordersHistoryState.pageIndex = 0;
    console.log('[History] ⬅️ Thoát history mode → về local mode (đơn chưa gửi)');
}

/** Trang kế tiếp (nút "Sau"). */
function historyNextPage() {
    if (!ordersHistoryState.active || ordersHistoryState.loading) return;
    if (!ordersHistoryState.hasMore || !ordersHistoryState.nextCursor) return;
    // Lưu cursor đầu trang kế tiếp vào stack để "Trước" quay lại đúng.
    ordersHistoryState.cursorStack.push(ordersHistoryState.nextCursor);
    void _fetchHistoryPage(ordersHistoryState.nextCursor, ordersHistoryState.pageIndex + 1);
}

/** Trang trước (nút "Trước"). */
function historyPrevPage() {
    if (!ordersHistoryState.active || ordersHistoryState.loading) return;
    if (ordersHistoryState.pageIndex <= 1) return;
    // Bỏ cursor của trang hiện tại, lấy cursor đầu trang trước.
    ordersHistoryState.cursorStack.pop();
    const prevCursor = ordersHistoryState.cursorStack[ordersHistoryState.cursorStack.length - 1];
    void _fetchHistoryPage(prevCursor || null, ordersHistoryState.pageIndex - 1);
}

/**
 * Điểm vào chính từ filterOrdersData: quyết định history vs local.
 * Trả về true nếu ĐÃ xử lý bằng history mode (caller nên return sớm, không chạy local filter).
 */
function maybeHandleHistoryMode() {
    if (!shouldUseHistoryMode()) {
        if (ordersHistoryState.active) exitHistoryMode();
        return false;
    }

    const key = _historyFilterKey();
    if (!ordersHistoryState.active || key !== ordersHistoryState.lastFilterKey) {
        // Vào history mode lần đầu, hoặc filter đổi → tải lại trang 1.
        enterHistoryModeFirstPage();
    }
    // Nếu filter không đổi và đã active: giữ nguyên trang hiện tại (không tải lại vô ích).
    return true;
}

if (typeof window !== 'undefined') {
    window.maybeHandleHistoryMode = maybeHandleHistoryMode;
    window.historyNextPage = historyNextPage;
    window.historyPrevPage = historyPrevPage;
    window.ordersHistoryState = ordersHistoryState;
}
