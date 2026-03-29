// Payments V2 - Pay by Individual Orders
let allCommissions = [];
let filteredCommissions = [];
let currentMonth = '';
let selectedOrders = new Set();
let rankingData = [];
let rankingSummary = {};
let currentRankingMonth = '';

/**
 * Tháng gửi API getCTVRanking (YYYY-MM) — khớp với bộ lọc thời gian phía trên:
 * - Có khoảng ngày: lấy theo tháng của ngày bắt đầu (currentMonth)
 * - "Tất cả" / không khoảng: tháng hiện tại theo giờ VN
 */
function getRankingApiMonth() {
    if (currentFilters.period === 'all' || !currentFilters.dateRange) {
        const vnDateStr = new Date().toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
        const [y, m] = vnDateStr.split('-');
        return `${y}-${m}`;
    }
    if (currentMonth && /^\d{4}-\d{2}$/.test(currentMonth)) {
        return currentMonth;
    }
    const vnDateStr = new Date().toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const [y, m] = vnDateStr.split('-');
    return `${y}-${m}`;
}

// Filter state
let currentFilters = {
    period: 'thisMonth',
    status: 'all',
    search: '',
    dateRange: null
};

/** YYYY-MM-DD theo lịch local (gửi API khoảng ngày — tab Đã loại) */
function formatDateYMDLocal(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Payments V2 initialized');

    // Read tab from URL hash (e.g. #ranking), fall back to 'unpaid'
    const hash = window.location.hash.replace('#', '');
    const initialTab = VALID_TABS.has(hash) ? hash : 'unpaid';

    // Set default month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    currentMonth = `${year}-${month}`;

    // Initialize filters with default period (thisMonth); runAfter syncs lịch sử + applyFilters (sau khi có dữ liệu)
    filterByPeriod('thisMonth');

    // Switch to the tab from URL (this also sets window.location.hash)
    switchTab(initialTab);

    loadUnpaidOrders();
    updateExcludedBadge();
});

// Listen for browser back/forward navigation
window.addEventListener('hashchange', function() {
    const hash = window.location.hash.replace('#', '');
    const tab = VALID_TABS.has(hash) ? hash : 'unpaid';
    if (tab !== currentTab) {
        switchTab(tab);
    }
});

// Load unpaid orders
async function loadUnpaidOrders() {
    try {
        showLoading();
        selectedOrders.clear();
        
        const response = await fetch(`${CONFIG.API_URL}?action=getUnpaidOrdersByMonth&month=${currentMonth}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        console.log('📊 API Response:', data);
        
        if (data.success) {
            allCommissions = data.commissions || [];
            console.log('✅ Loaded commissions:', allCommissions.length);

            // Áp dụng bộ lọc thời gian/trạng thái/tìm kiếm + cập nhật đúng tab đang mở
            applyFilters();

            // Cập nhật badge Đã loại từ summary API (không cần fetch lại)
            const exclCount = data.summary?.total_excluded ?? 0;
            const exclBadge = document.getElementById('excludedCount');
            if (exclBadge) exclBadge.textContent = exclCount;

        } else {
            throw new Error(data.error || 'Failed to load data');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Không thể tải dữ liệu: ' + error.message, 'error');
        showEmptyState();
    } finally {
        hideLoading();
    }
}

/** Nhãn 4 ô summary theo tab (cùng một hàng, đổi nghĩa theo ngữ cảnh) */
function applySummaryLabels(mode) {
    const L = {
        unpaid: {
            ctvTitle: 'Tổng CTV',
            ctvSub: 'Có đơn chưa trả',
            ordersTitle: 'Đơn hàng',
            ordersSub: 'Chưa thanh toán',
            commTitle: 'Hoa hồng',
            commSub: 'Chưa thanh toán',
            selTitle: 'Đã chọn',
            selSub: 'Sẵn sàng thanh toán'
        },
        excluded: {
            ctvTitle: 'CTV bị ảnh hưởng',
            ctvSub: 'Theo bộ lọc hiện tại',
            ordersTitle: 'Đơn đã loại',
            ordersSub: 'Không tính thanh toán',
            commTitle: 'Hoa hồng đã loại',
            commSub: 'Theo bộ lọc hiện tại',
            selTitle: 'Đã chọn',
            selSub: 'Không áp dụng ở tab này'
        },
        history: {
            ctvTitle: 'Đợt thanh toán',
            ctvSub: 'Theo ngày trả trong khoảng lọc',
            ordersTitle: 'Đơn đã trả',
            ordersSub: 'Tổng qua các đợt (đang lọc)',
            commTitle: 'Đã thanh toán',
            commSub: 'Tổng tiền đã chuyển',
            selTitle: 'Đã chọn',
            selSub: '—'
        }
    }[mode] || {
        ctvTitle: 'Tổng CTV',
        ctvSub: 'Có đơn chưa trả',
        ordersTitle: 'Đơn hàng',
        ordersSub: 'Chưa thanh toán',
        commTitle: 'Hoa hồng',
        commSub: 'Chưa thanh toán',
        selTitle: 'Đã chọn',
        selSub: 'Sẵn sàng thanh toán'
    };

    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    set('summaryLabelCtv', L.ctvTitle);
    set('summarySubCtv', L.ctvSub);
    set('summaryLabelOrders', L.ordersTitle);
    set('summarySubOrders', L.ordersSub);
    set('summaryLabelCommission', L.commTitle);
    set('summarySubCommission', L.commSub);
    set('summaryLabelSelected', L.selTitle);
    set('summarySubSelected', L.selSub);
}


// Cập nhật badge Đã loại từ dữ liệu đã có (không cần fetch API)
function updateExcludedBadge() {
    const badge = document.getElementById('excludedCount');
    if (!badge) return;
    const exclCount = allCommissions.reduce((sum, ctv) =>
        sum + (ctv.orders || []).filter(o => o.is_excluded === 1).length, 0);
    badge.textContent = exclCount;
}

// ============================================
// RANKING TAB
// ============================================

function applyRankingSummaryLabels() {
    const s = rankingSummary;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('summaryLabelCtv', 'Tổng CTV');
    set('summarySubCtv', 'Có đơn tháng');
    set('summaryLabelOrders', 'CTV đạt CT');
    set('summarySubOrders', 'Trong tháng');
    set('summaryLabelCommission', 'Tổng thưởng');
    set('summarySubCommission', 'Thưởng chỉ tiêu');
    set('summaryLabelSelected', 'HH tổng');
    set('summarySubSelected', 'Theo bộ lọc thời gian');
    set('totalCTV', s.total_ctv || 0);
    set('totalOrders', s.met_target_count || 0);
    set('totalCommission', formatCurrency(s.total_bonus || 0));
    set('selectedAmount', formatCurrency(s.total_commission || 0));
}

async function loadRanking() {
    const month = getRankingApiMonth();
    currentRankingMonth = month;

    document.getElementById('rankingLoadingState')?.classList.remove('hidden');
    document.getElementById('rankingEmptyState')?.classList.add('hidden');
    document.getElementById('rankingTableWrapper')?.classList.add('hidden');

    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=getCTVRanking&month=${month}&timestamp=${Date.now()}`);
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);

        rankingData = data.ranking || [];
        rankingSummary = data.summary || {};

        applyRankingSummaryLabels();
        renderRankingTable();
    } catch (err) {
        console.error('❌ loadRanking error:', err);
        showToast('Không thể tải bảng xếp hạng: ' + err.message, 'error');
    } finally {
        document.getElementById('rankingLoadingState')?.classList.add('hidden');
    }
}

function renderRankingTable() {
    const wrapper = document.getElementById('rankingTableWrapper');
    const empty = document.getElementById('rankingEmptyState');
    const tbody = document.getElementById('rankingTableBody');

    wrapper?.classList.add('hidden');
    empty?.classList.add('hidden');

    if (rankingData.length === 0) {
        empty?.classList.remove('hidden');
        return;
    }

    wrapper?.classList.remove('hidden');
    if (!tbody) return;

    tbody.innerHTML = rankingData.map(c => {
        const rankClass = c.rank === 1 ? 'bg-yellow-50 border-yellow-300 ring-1 ring-yellow-200'
            : c.rank === 2 ? 'bg-slate-50 border-slate-200'
            : c.rank === 3 ? 'bg-orange-50 border-orange-200'
            : 'bg-white border-slate-100';
        const rankBadge = c.rank <= 3
            ? `<span class="inline-flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs ${c.rank === 1 ? 'bg-yellow-400 text-yellow-900' : c.rank === 2 ? 'bg-slate-300 text-slate-700' : 'bg-orange-300 text-orange-900'}">${c.rank}</span>`
            : `<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-500 text-xs">${c.rank}</span>`;
        const metBadge = c.met_target
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>Đạt CT</span>`
            : c.target_revenue > 0
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>Chưa đạt</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">Chưa set CT</span>`;
        const pctColor = c.met_target ? 'text-emerald-600 font-bold' : c.achieved_percent >= 80 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold';
        const pctBar = c.target_revenue > 0
            ? `<div class="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full transition-all ${c.met_target ? 'bg-emerald-500' : 'bg-red-400'}" style="width:${Math.min(c.achieved_percent, 100)}%"></div></div>`
            : '';
        const bonusDisplay = c.bonus_amount > 0
            ? `<span class="text-emerald-600 font-bold">+${formatCurrency(c.bonus_amount)}</span><span class="text-xs text-slate-400">(+${c.bonus_percent}%)</span>`
            : `<span class="text-slate-300">—</span>`;

        return `
            <tr class="border ${rankClass} hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    ${rankBadge}
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            ${escapeHtml(c.ctv_name.charAt(0))}
                        </div>
                        <div>
                            <p class="font-semibold text-slate-900 text-sm">${escapeHtml(c.ctv_name)}</p>
                            <p class="text-xs text-slate-400">${escapeHtml(c.referral_code)}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-bold text-slate-900 tabular-nums">${formatCurrency(c.revenue)}</p>
                </td>
                <td class="px-6 py-4 text-center">
                    <p class="font-semibold text-slate-900 tabular-nums">${c.order_count}</p>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-semibold text-slate-700 tabular-nums">${c.target_revenue > 0 ? formatCurrency(c.target_revenue) : '<span class="text-slate-300">—</span>'}</p>
                </td>
                <td class="px-6 py-4 text-center">
                    <p class="${pctColor} tabular-nums text-sm">${c.target_revenue > 0 ? c.achieved_percent + '%' : '—'}</p>
                    ${pctBar}
                </td>
                <td class="px-6 py-4 text-center">
                    ${metBadge}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex flex-col items-end gap-0.5">${bonusDisplay}</div>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-semibold text-slate-700 tabular-nums">${formatCurrency(c.base_commission)}</p>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="font-bold text-violet-700 tabular-nums">${formatCurrency(c.total_commission)}</p>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// TARGET SETTING MODAL
// ============================================

let targetModalMonth = '';
let targetModalAllCTV = [];

/** Hiển thị số nguyên VND trong ô chỉ tiêu (vd. 20.000.000) */
function formatTargetRevenueDisplay(num) {
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) return '';
    return n.toLocaleString('vi-VN');
}

/** Đọc giá trị từ ô đã format (bỏ dấu .) */
function parseTargetRevenueValue(str) {
    return parseInt(String(str || '').replace(/\D/g, ''), 10) || 0;
}

function wireTargetRevenueInputs(container) {
    container.querySelectorAll('input[id^="target_"]').forEach(inp => {
        inp.addEventListener('input', function () {
            const digits = this.value.replace(/\D/g, '');
            if (digits === '') {
                this.value = '';
                return;
            }
            const n = parseInt(digits, 10);
            if (!Number.isFinite(n)) {
                this.value = '';
                return;
            }
            const formatted = n.toLocaleString('vi-VN');
            const len = formatted.length;
            this.value = formatted;
            requestAnimationFrame(() => this.setSelectionRange(len, len));
        });
    });
}

async function showTargetModal() {
    targetModalMonth = getRankingApiMonth();

    const modal = document.getElementById('targetModal');
    const form = document.getElementById('targetModalForm');
    const monthLabel = document.getElementById('targetModalMonth');
    if (!modal || !form) return;

    const [year, month] = targetModalMonth.split('-');
    if (monthLabel) monthLabel.textContent = `Tháng ${parseInt(month)}/${year}`;

    form.innerHTML = '<div class="text-center py-8 text-slate-500"><div class="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-2"></div>Đang tải...</div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        const [rankingResp, targetsResp] = await Promise.all([
            fetch(`${CONFIG.API_URL}?action=getCTVRanking&month=${targetModalMonth}&timestamp=${Date.now()}`),
            fetch(`${CONFIG.API_URL}?action=getCTVTargets&month=${targetModalMonth}&timestamp=${Date.now()}`)
        ]);
        const [rankingData, targetsData] = await Promise.all([rankingResp.json(), targetsResp.json()]);

        targetModalAllCTV = rankingData.ranking || [];
        const existingTargets = {};
        (targetsData.targets || []).forEach(t => { existingTargets[t.referral_code] = t; });

        if (targetModalAllCTV.length === 0) {
            form.innerHTML = '<p class="text-center text-slate-500 py-8">Không có CTV nào có đơn trong tháng này</p>';
            return;
        }

        form.innerHTML = targetModalAllCTV.map(c => {
            const saved = existingTargets[c.referral_code];
            const savedRevenue = saved?.target_revenue || c.target_revenue || 0;
            const savedBonus = saved?.bonus_percent || 10;
            return `
                <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                    <div class="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        ${escapeHtml(c.ctv_name.charAt(0))}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(c.ctv_name)}</p>
                        <p class="text-xs text-slate-400">${escapeHtml(c.referral_code)} • ${c.order_count} đơn</p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <label class="text-xs text-slate-500 font-medium">CT (VNĐ):</label>
                        <input type="text" inputmode="numeric" autocomplete="off" id="target_${escapeHtml(c.referral_code)}"
                            value="${formatTargetRevenueDisplay(savedRevenue)}"
                            placeholder="VD: 5.000.000"
                            class="w-40 h-9 px-3 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200">
                        <label class="text-xs text-slate-500 font-medium">% Thưởng:</label>
                        <input type="number" id="bonus_${escapeHtml(c.referral_code)}"
                            value="${savedBonus}"
                            min="0" max="100" step="1"
                            class="w-20 h-9 px-3 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200">
                    </div>
                </div>
            `;
        }).join('');
        wireTargetRevenueInputs(form);
    } catch (err) {
        form.innerHTML = `<p class="text-center text-red-500 py-8">Lỗi tải dữ liệu: ${err.message}</p>`;
    }
}

function closeTargetModal() {
    const modal = document.getElementById('targetModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function applyToAll() {
    const firstRevenue = '';
    const firstBonus = '10';
    const inputs = document.querySelectorAll('#targetModalForm input[id^="target_"]');
    inputs.forEach(inp => {
        const ref = inp.id.replace('target_', '');
        const revenueInp = document.getElementById('target_' + ref);
        const bonusInp = document.getElementById('bonus_' + ref);
        if (revenueInp) revenueInp.value = firstRevenue;
        if (bonusInp) bonusInp.value = firstBonus;
    });
    showToast('Đã đặt lại tất cả: chỉ tiêu trống, thưởng 10%', 'success');
}

async function saveTargets() {
    const targets = [];
    targetModalAllCTV.forEach(c => {
        const revenueInp = document.getElementById('target_' + c.referral_code);
        const bonusInp = document.getElementById('bonus_' + c.referral_code);
        if (!revenueInp) return;
        const revenue = parseTargetRevenueValue(revenueInp.value);
        const bonus = parseFloat(bonusInp?.value || '10');
        targets.push({
            referralCode: c.referral_code,
            targetRevenue: revenue,
            bonusPercent: bonus,
            note: ''
        });
    });

    const validTargets = targets.filter(t => t.targetRevenue > 0);
    if (validTargets.length === 0) {
        showToast('Vui lòng nhập ít nhất 1 chỉ tiêu > 0', 'warning');
        return;
    }

    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=setCTVTargets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targets: validTargets,
                month: targetModalMonth
            })
        });
        const result = await resp.json();
        if (!result.success) throw new Error(result.error);

        showToast(result.message || `Đã lưu ${validTargets.length} chỉ tiêu`, 'success');
        closeTargetModal();
        loadRanking();
    } catch (err) {
        showToast('Lỗi lưu chỉ tiêu: ' + err.message, 'error');
    }
}

// Update selected amount
function updateSelectedAmount() {
    let total = 0;
    selectedOrders.forEach(orderId => {
        // Find order in all commissions
        for (const ctv of allCommissions) {
            const order = ctv.orders.find(o => o.order_id === orderId);
            if (order) {
                total += order.commission || 0;
                break;
            }
        }
    });
    document.getElementById('selectedAmount').textContent = formatCurrency(total);
}

// Render CTV list
function renderCTVList() {
    const container = document.getElementById('ctvListContainer');
    
    // Hide loading and empty states
    hideLoading();
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.classList.add('hidden');
    
    if (filteredCommissions.length === 0) {
        showEmptyState();
        return;
    }
    
    // Remove old CTV cards but keep loading and empty states
    const existingCards = container.querySelectorAll('.ctv-card');
    existingCards.forEach(card => card.remove());
    
    filteredCommissions.forEach((ctv, index) => {
        // Only count non-excluded orders for selection
        const activeOrders = ctv.orders.filter(o => o.is_excluded !== 1);
        const excludedCount = ctv.orders.filter(o => o.is_excluded === 1).length;
        const activeCommission = activeOrders.reduce((sum, o) => sum + (o.commission || 0), 0);

        const allActiveSelected = activeOrders.length > 0 && activeOrders.every(o => selectedOrders.has(o.order_id));
        const someSelected = activeOrders.some(o => selectedOrders.has(o.order_id));

        const excludedBadge = excludedCount > 0 ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                ${excludedCount} đơn đã loại
            </span>
        ` : '';

        const html = `
            <div class="ctv-card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <!-- CTV Header -->
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                                ${ctv.ctv_name.charAt(0)}
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-lg font-bold text-gray-900">${escapeHtml(ctv.ctv_name)}</h3>
                                    ${excludedBadge}
                                </div>
                                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span class="text-sm text-gray-600">
                                        <span class="font-mono font-semibold text-indigo-600">${escapeHtml(ctv.referral_code)}</span>
                                    </span>
                                    <span class="text-sm text-gray-400">•</span>
                                    <span class="text-sm text-gray-600">${escapeHtml(ctv.phone)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right ml-3">
                            <p class="text-sm text-gray-600">Chưa thanh toán</p>
                            <p class="text-2xl font-bold text-orange-600">${formatCurrency(activeCommission)}</p>
                            <p class="text-sm text-gray-500 mt-1">${activeOrders.length} đơn hàng</p>
                        </div>
                    </div>
                </div>

                <!-- Orders List -->
                <div class="p-6">
                    ${activeOrders.length > 0 ? `
                    <div class="flex items-center justify-between mb-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                                   ${allActiveSelected ? 'checked' : ''}
                                   onchange="toggleAllOrders('${ctv.referral_code}')"
                                   class="w-5 h-5 text-indigo-600 border-gray-300 rounded">
                            <span class="text-sm font-medium text-gray-700">Chọn tất cả</span>
                        </label>
                        <button onclick="paySelectedCTV('${ctv.referral_code}')"
                                class="px-4 py-2 bg-green-600 text-white text-sm rounded-lg ${someSelected ? '' : 'opacity-50 cursor-not-allowed'}"
                                ${someSelected ? '' : 'disabled'}>
                            <svg class="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Thanh toán đã chọn
                        </button>
                    </div>
                    ` : `
                    <div class="mb-4 p-3 bg-red-50 rounded-lg border border-red-100">
                        <p class="text-sm text-red-600 font-medium text-center">Tất cả đơn hàng đã được loại khỏi thanh toán</p>
                    </div>
                    `}

                    <div class="space-y-2">
                        ${ctv.orders.map(order => createOrderRow(order, ctv.referral_code)).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Append to container
        container.insertAdjacentHTML('beforeend', html);
    });
}

// Create order row
function createOrderRow(order, referralCode) {
    const isSelected = selectedOrders.has(order.order_id);
    const isExcluded = order.is_excluded === 1;

    // created_at_unix is already in milliseconds, no need to multiply by 1000
    const timestamp = order.created_at_unix
        ? new Date(typeof order.created_at_unix === 'string' ? parseInt(order.created_at_unix) : order.created_at_unix)
        : new Date(order.created_at);
    const date = toVNShortDate(timestamp);

    // Format excluded info
    const excludedBadge = isExcluded ? `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            Đã loại
        </span>
    ` : '';

    const excludedReason = isExcluded && order.exclude_reason ? `
        <p class="text-xs text-red-500 mt-1">${escapeHtml(order.exclude_reason)}</p>
    ` : '';

    const excludedBy = isExcluded && order.excluded_by ? `
        <p class="text-xs text-gray-400 mt-0.5">Bởi: ${escapeHtml(order.excluded_by)}</p>
    ` : '';

    return `
        <div class="relative flex items-center gap-4 p-4 border rounded-xl transition-all ${isExcluded ? 'bg-red-50/50 border-red-200 opacity-80' : isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-sm'}">
            ${!isExcluded ? `
            <input type="checkbox"
                   ${isSelected ? 'checked' : ''}
                   onchange="toggleOrder(${order.order_id})"
                   class="w-5 h-5 text-indigo-600 border-gray-300 rounded flex-shrink-0">
            ` : `
            <div class="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                </svg>
            </div>
            `}
            <div class="flex-1 grid grid-cols-5 gap-3 items-center">
                <div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <p class="text-sm font-mono font-semibold text-blue-600">${escapeHtml(order.order_code)}</p>
                        ${excludedBadge}
                    </div>
                    ${excludedReason}
                    ${excludedBy}
                </div>
                <div>
                    <p class="text-xs text-gray-500">Ngày đặt</p>
                    <p class="text-sm font-medium text-gray-900">${date}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Khách hàng</p>
                    <p class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">Hoa hồng</p>
                    <p class="text-sm font-bold ${isExcluded ? 'text-red-400 line-through' : 'text-orange-600'}">${formatCurrency(order.commission)}</p>
                </div>
                <div class="flex items-center justify-end gap-2">
                    ${isExcluded ? `
                    <button type="button"
                            onclick="restoreCommission(${order.order_id}, '${escapeHtml(order.order_code)}')"
                            class="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-200 transition-colors border border-emerald-200"
                            title="Khôi phục hoa hồng">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Khôi phục
                    </button>
                    ` : `
                    <button type="button"
                            onclick="showExcludeModal(${order.order_id}, '${escapeHtml(order.order_code)}')"
                            class="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                            title="Loại khỏi thanh toán">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Loại
                    </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

// Toggle single order
function toggleOrder(orderId) {
    // Find the order to check if it's excluded
    let order = null;
    for (const ctv of allCommissions) {
        order = ctv.orders.find(o => o.order_id === orderId);
        if (order) break;
    }
    if (order && order.is_excluded === 1) {
        showToast('Đơn hàng này đã bị loại khỏi thanh toán', 'warning');
        return;
    }
    if (selectedOrders.has(orderId)) {
        selectedOrders.delete(orderId);
    } else {
        selectedOrders.add(orderId);
    }
    updateSelectedAmount();
    renderCTVList();
}

// Toggle all orders for a CTV
function toggleAllOrders(referralCode) {
    const ctv = filteredCommissions.find(c => c.referral_code === referralCode);
    if (!ctv) return;

    // Only toggle non-excluded orders
    const activeOrders = ctv.orders.filter(o => o.is_excluded !== 1);
    const allActiveSelected = activeOrders.length > 0 && activeOrders.every(o => selectedOrders.has(o.order_id));

    if (allActiveSelected) {
        activeOrders.forEach(o => selectedOrders.delete(o.order_id));
    } else {
        activeOrders.forEach(o => selectedOrders.add(o.order_id));
    }

    updateSelectedAmount();
    renderCTVList();
}

// Pay selected orders for a CTV
async function paySelectedCTV(referralCode) {
    const ctv = filteredCommissions.find(c => c.referral_code === referralCode);
    if (!ctv) return;
    
    const selectedCTVOrders = ctv.orders.filter(o => selectedOrders.has(o.order_id));
    
    if (selectedCTVOrders.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 đơn hàng', 'warning');
        return;
    }
    
    const totalCommission = selectedCTVOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
    
    // Show payment modal
    showPaymentModal(ctv, selectedCTVOrders, totalCommission);
}

// Show payment modal
function showPaymentModal(ctv, orders, totalCommission) {
    // Debug: Log CTV data
    console.log('💳 CTV Data:', JSON.stringify(ctv, null, 2));
    console.log('🏦 Bank Name:', ctv.bank_name);
    console.log('💰 Bank Account:', ctv.bank_account_number);
    console.log('🔍 All CTV keys:', Object.keys(ctv));
    
    const modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div class="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Xác nhận thanh toán</h2>
                        <p class="text-sm text-white/80">${orders.length} đơn hàng</p>
                    </div>
                </div>
                <button onclick="closePaymentModal()" class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div class="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <p class="text-sm text-gray-600">Thanh toán cho</p>
                    <p class="text-lg font-bold text-gray-900">${escapeHtml(ctv.ctv_name)}</p>
                    <p class="text-sm text-gray-600 mt-1">Mã: ${escapeHtml(ctv.referral_code)} • ${escapeHtml(ctv.phone)}</p>
                    
                    ${ctv.bank_account_number || ctv.bank_name ? `
                        <div class="mt-3 pt-3 border-t border-green-200">
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span class="text-sm font-semibold text-gray-700">Thông tin ngân hàng</span>
                            </div>
                            <div class="bg-white rounded-lg p-3 space-y-2">
                                ${ctv.bank_name ? `
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">Ngân hàng:</span>
                                        <span class="text-sm font-semibold text-gray-900">${escapeHtml(ctv.bank_name)}</span>
                                    </div>
                                ` : ''}
                                ${ctv.bank_account_number ? `
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">Số tài khoản:</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-mono font-bold text-blue-600">${escapeHtml(ctv.bank_account_number)}</span>
                                            <button type="button" onclick="copyToClipboard('${escapeHtml(ctv.bank_account_number)}')" 
                                                class="p-1 hover:bg-gray-100 rounded transition-colors" title="Sao chép">
                                                <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="mt-3 pt-3 border-t border-green-200">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">${orders.length} đơn hàng</span>
                            <span class="text-2xl font-bold text-green-600">${formatCurrency(totalCommission)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-3">Danh sách đơn hàng:</h3>
                    <div class="space-y-2 max-h-48 overflow-y-auto">
                        ${orders.map(order => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p class="text-sm font-mono font-semibold text-blue-600">${escapeHtml(order.order_code)}</p>
                                    <p class="text-xs text-gray-500">${toVNShortDate(order.created_at_unix || order.created_at)}</p>
                                </div>
                                <p class="text-sm font-bold text-orange-600">${formatCurrency(order.commission)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <form id="paymentForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Ngày thanh toán</label>
                        <input type="date" id="paymentDate" value="${new Date().toISOString().split('T')[0]}" required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Phương thức thanh toán</label>
                        <select id="paymentMethod" required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                            <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                            <option value="cash">Tiền mặt</option>
                            <option value="momo">Ví MoMo</option>
                            <option value="zalopay">ZaloPay</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Ghi chú (Mã GD, ...)</label>
                        <textarea id="paymentNote" rows="2" placeholder="VD: Mã GD: 123456789, Chuyển khoản MB Bank"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg resize-none"></textarea>
                    </div>
                    
                    <input type="hidden" id="paymentReferralCode" value="${escapeHtml(ctv.referral_code)}">
                    <input type="hidden" id="paymentOrderIds" value="${orders.map(o => o.order_id).join(',')}">
                </form>
            </div>
            
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button type="button" onclick="closePaymentModal()" 
                    class="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium">
                    Hủy
                </button>
                <button type="submit" form="paymentForm" onclick="submitPayment(event)"
                    class="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium">
                    <svg class="w-5 h-5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Xác nhận thanh toán
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Submit payment
async function submitPayment(event) {
    event.preventDefault();
    
    const referralCode = document.getElementById('paymentReferralCode').value;
    const orderIdsStr = document.getElementById('paymentOrderIds').value;
    const orderIds = orderIdsStr.split(',').map(id => parseInt(id));
    const paymentDate = document.getElementById('paymentDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const note = document.getElementById('paymentNote').value;
    
    // Get submit button
    const submitBtn = event.target;
    const originalBtnContent = submitBtn.innerHTML;
    
    try {
        // Show loading state on button
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5 inline mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Đang xử lý...
        `;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        
        showToast('Đang xử lý thanh toán...', 'info');
        
        const response = await fetch(`${CONFIG.API_URL}?action=paySelectedOrders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                referralCode,
                orderIds,
                paymentDate,
                paymentMethod,
                note
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ ${data.message}`, 'success');
            closePaymentModal();
            
            // Remove paid orders from selected
            orderIds.forEach(id => selectedOrders.delete(id));
            
            // Reload both tabs data sequentially to avoid race condition
            await loadUnpaidOrders();
            if (currentTab === 'history') {
                await loadPaymentHistory();
            }
        } else {
            throw new Error(data.error || 'Failed to process payment');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Không thể thanh toán: ' + error.message, 'error');
        
        // Restore button state on error
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.remove();
    }
}

// ── Unified debounced filter (dùng chung cho cả unpaid tab + search) ──
let filterDebounceTimer;
function onSearchInput() {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
        currentFilters.search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
        const clearBtn = document.getElementById('searchClearBtn');
        if (clearBtn) clearBtn.classList.toggle('hidden', !currentFilters.search);
        applyFilters();
    }, 300);
}

// Load previous month (DEPRECATED - Use filterByPeriod('lastMonth') instead)
function loadPreviousMonth() {
    // Redirect to new filter system
    filterByPeriod('lastMonth');
    
    loadUnpaidOrders();
}

// Refresh data
async function refreshData() {
    showToast('Đang tải lại dữ liệu...', 'info');
    await loadUnpaidOrders();
    await loadPaymentHistory();
    if (currentTab === 'excluded') {
        await loadExcludedCommissions();
    }
    if (currentTab === 'ranking') {
        await loadRanking();
    }
}

// UI State functions
function showLoading() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    if (loadingState) loadingState.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    const container = document.getElementById('ctvListContainer');
    const existingCards = container.querySelectorAll('.ctv-card');
    existingCards.forEach(card => card.remove());
}

function hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.classList.add('hidden');
}

function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    
    if (emptyState) emptyState.classList.remove('hidden');
    if (loadingState) loadingState.classList.add('hidden');
}

// ── History tab loading helpers ──
function showHistoryLoading() {
    const ls = document.getElementById('historyLoadingState');
    const es = document.getElementById('historyEmptyState');
    if (ls) ls.classList.remove('hidden');
    if (es) es.classList.add('hidden');
    // Remove old cards
    document.querySelectorAll('.history-card').forEach(c => c.remove());
}

function hideHistoryLoading() {
    const ls = document.getElementById('historyLoadingState');
    if (ls) ls.classList.add('hidden');
}

// Utility functions
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

// showToast is now provided by toast-manager.js


// Copy to clipboard helper
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Đã sao chép: ' + text, 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('❌ Không thể sao chép', 'error');
    });
}


// Tab Management
let currentTab = 'unpaid';
let paymentHistory = [];

const VALID_TABS = new Set(['unpaid', 'history', 'excluded', 'ranking']);

function switchTab(tab) {
    if (!tab || !VALID_TABS.has(tab)) tab = 'unpaid';
    currentTab = tab;

    // Update URL hash without scrolling
    history.replaceState(null, '', '#' + tab);

    const tabUnpaid = document.getElementById('tabUnpaid');
    const tabHistory = document.getElementById('tabHistory');
    const tabExcluded = document.getElementById('tabExcluded');
    const tabRanking = document.getElementById('tabRanking');
    const unpaidContent = document.getElementById('unpaidContent');
    const historyContent = document.getElementById('historyContent');
    const excludedContent = document.getElementById('excludedContent');
    const rankingContent = document.getElementById('rankingContent');

    // Ẩn cả 4 vùng nội dung — tránh tab trước (vd. Xếp hạng) còn hiển thị khi chuyển tab
    if (unpaidContent) unpaidContent.classList.add('hidden');
    if (historyContent) historyContent.classList.add('hidden');
    if (excludedContent) excludedContent.classList.add('hidden');
    if (rankingContent) rankingContent.classList.add('hidden');

    // Reset trạng thái nút tab (chỉ tab đang chọn mới active)
    if (tabUnpaid) {
        tabUnpaid.classList.remove('active', 'border-emerald-600', 'text-emerald-700', 'bg-emerald-50/50');
        tabUnpaid.classList.add('border-transparent', 'text-slate-500');
    }
    if (tabHistory) {
        tabHistory.classList.remove('active', 'border-emerald-600', 'text-emerald-700', 'bg-emerald-50/50');
        tabHistory.classList.add('border-transparent', 'text-slate-500');
    }
    if (tabExcluded) {
        tabExcluded.classList.remove('active', 'border-red-500', 'text-red-700', 'bg-red-50/50');
        tabExcluded.classList.add('border-transparent', 'text-slate-500');
    }
    if (tabRanking) {
        tabRanking.classList.remove('active', 'border-amber-500', 'text-amber-700', 'bg-amber-50/50');
        tabRanking.classList.add('border-transparent', 'text-slate-500');
    }

    if (tab === 'unpaid') {
        if (tabUnpaid) {
            tabUnpaid.classList.add('active', 'border-emerald-600', 'text-emerald-700', 'bg-emerald-50/50');
            tabUnpaid.classList.remove('border-transparent', 'text-slate-500');
        }
        if (unpaidContent) unpaidContent.classList.remove('hidden');

        applyFilters();
    } else if (tab === 'history') {
        if (tabHistory) {
            tabHistory.classList.add('active', 'border-emerald-600', 'text-emerald-700', 'bg-emerald-50/50');
            tabHistory.classList.remove('border-transparent', 'text-slate-500');
        }
        if (historyContent) historyContent.classList.remove('hidden');
        loadPaymentHistory(); // loads + renders + shows skeleton while waiting
    } else if (tab === 'excluded') {
        if (tabExcluded) {
            tabExcluded.classList.add('active', 'border-red-500', 'text-red-700', 'bg-red-50/50');
            tabExcluded.classList.remove('border-transparent', 'text-slate-500');
        }
        if (excludedContent) excludedContent.classList.remove('hidden');

        const sel = document.getElementById('selectedAmount');
        if (sel) sel.textContent = '0đ';

        loadExcludedCommissions();
    } else if (tab === 'ranking') {
        if (tabRanking) {
            tabRanking.classList.remove('border-transparent', 'text-slate-500');
            tabRanking.classList.add('active', 'border-amber-500', 'text-amber-700', 'bg-amber-50/50');
        }
        if (rankingContent) rankingContent.classList.remove('hidden');

        loadRanking();
    }
}

// Load Payment History (theo ngày thực trả payment_date_unix, hoặc tất cả khi period = all)
async function loadPaymentHistory() {
    try {
        showHistoryLoading();

        const params = new URLSearchParams({
            action: 'getPaidOrdersByMonth',
            timestamp: Date.now()
        });

        if (currentFilters.period === 'all' || !currentFilters.dateRange) {
            params.set('allPaid', '1');
        } else {
            const { startDate, endDate } = currentFilters.dateRange;
            params.set('paymentStartMs', String(startDate.getTime()));
            params.set('paymentEndMs', String(endDate.getTime()));
        }

        const response = await fetch(`${CONFIG.API_URL}?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            paymentHistory = data.payments || [];
            renderHistoryFromFilters();
        }
    } catch (error) {
        console.error('Error loading payment history:', error);
        showToast('Không thể tải lịch sử thanh toán', 'error');
    } finally {
        hideHistoryLoading();
    }
}

/** Lọc lịch sử theo trạng thái + ô tìm kiếm (client) */
function getFilteredPaymentHistoryForDisplay() {
    // Thống nhất: đọc filter từ state thay vì DOM
    const { status, search } = currentFilters;

    let list = paymentHistory;

    if (status && status !== 'all') {
        list = list.filter(p => (p.status || 'paid') === status);
    }

    if (search) {
        list = list.filter(payment => {
            const fields = [
                payment.ctv_name?.toLowerCase() || '',
                payment.referral_code?.toLowerCase() || '',
                payment.phone?.toLowerCase() || '',
                payment.bank_name?.toLowerCase() || '',
                String(payment.bank_account_number || '').toLowerCase(),
                payment.payment_method?.toLowerCase() || '',
                payment.note?.toLowerCase() || ''
            ];
            return fields.some(f => f.includes(search));
        });
    }

    return list;
}

function updateSummaryForHistoryFiltered(list) {
    applySummaryLabels('history');
    const totalAmount = list.reduce((sum, p) => sum + (p.commission_amount || 0), 0);
    const totalOrders = list.reduce((sum, p) => sum + (p.order_count || 0), 0);
    const totalCTV = list.length;

    document.getElementById('totalCTV').textContent = totalCTV;
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalCommission').textContent = formatCurrency(totalAmount);
    document.getElementById('selectedAmount').textContent = '0đ';
}

function renderHistoryFromFilters() {
    const filtered = getFilteredPaymentHistoryForDisplay();
    const badge = document.getElementById('historyCount');
    if (badge) badge.textContent = filtered.length;

    if (currentTab === 'history') {
        renderPaymentHistory(filtered);
        updateSummaryForHistoryFiltered(filtered);
    }
}

// Render Payment History
function renderPaymentHistory(history) {
    const container = document.getElementById('historyListContainer');
    const loadingState = document.getElementById('historyLoadingState');
    const emptyState = document.getElementById('historyEmptyState');
    
    loadingState.classList.add('hidden');
    
    if (history.length === 0) {
        emptyState.classList.remove('hidden');
        // Remove existing cards
        const existingCards = container.querySelectorAll('.history-card');
        existingCards.forEach(card => card.remove());
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Remove existing cards
    const existingCards = container.querySelectorAll('.history-card');
    existingCards.forEach(card => card.remove());
    
    // Render history cards
    history.forEach(payment => {
        const card = createHistoryCard(payment);
        container.appendChild(card);
    });
}

// Create History Card
function createHistoryCard(payment) {
    const card = document.createElement('div');
    card.className = 'history-card bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow';
    
    // Debug: Log payment data
    console.log('💳 Payment data:', {
        payment_date_unix: payment.payment_date_unix,
        type: typeof payment.payment_date_unix,
        date: payment.payment_date_unix ? new Date(payment.payment_date_unix) : null,
        formatted: payment.payment_date_unix ? toVNShortDate(new Date(payment.payment_date_unix)) : 'N/A'
    });
    
    // Format payment date - handle both number and string
    let paymentDateDisplay = 'N/A';
    if (payment.payment_date_unix) {
        const timestamp = typeof payment.payment_date_unix === 'string' 
            ? parseInt(payment.payment_date_unix) 
            : payment.payment_date_unix;
        
        if (timestamp && timestamp > 0) {
            // payment_date_unix is already in milliseconds, no need to multiply by 1000
            paymentDateDisplay = toVNShortDate(new Date(timestamp));
        }
    }
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                    <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900">${escapeHtml(payment.ctv_name)}</h3>
                    <p class="text-sm text-gray-500">Mã: ${escapeHtml(payment.referral_code)} • ${escapeHtml(payment.phone)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-2xl font-bold text-green-600">${formatCurrency(payment.commission_amount)}</p>
                <p class="text-xs text-gray-500 mt-1">${payment.order_count} đơn hàng</p>
            </div>
        </div>
        
        ${payment.bank_account_number || payment.bank_name ? `
            <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span class="text-xs font-semibold text-gray-600">Thông tin ngân hàng</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    ${payment.bank_name ? `
                        <div>
                            <span class="text-gray-500">Ngân hàng:</span>
                            <span class="font-semibold text-gray-900 ml-1">${escapeHtml(payment.bank_name)}</span>
                        </div>
                    ` : ''}
                    ${payment.bank_account_number ? `
                        <div>
                            <span class="text-gray-500">STK:</span>
                            <span class="font-mono font-semibold text-blue-600 ml-1">${escapeHtml(payment.bank_account_number)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
        
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
                <p class="text-xs text-gray-500 mb-1">Ngày thanh toán</p>
                <p class="text-sm font-semibold text-gray-900">${paymentDateDisplay}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-1">Phương thức</p>
                <p class="text-sm font-semibold text-gray-900">${getPaymentMethodLabel(payment.payment_method)}</p>
            </div>
        </div>
        
        ${payment.note ? `
            <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p class="text-xs text-gray-600 mb-1">Ghi chú:</p>
                <p class="text-sm text-gray-900">${escapeHtml(payment.note)}</p>
            </div>
        ` : ''}
    `;
    
    return card;
}

// Get Payment Method Label
function getPaymentMethodLabel(method) {
    const labels = {
        'bank_transfer': 'Chuyển khoản',
        'cash': 'Tiền mặt',
        'momo': 'Ví MoMo',
        'zalopay': 'ZaloPay'
    };
    return labels[method] || method || 'N/A';
}


// ============================================
// ENHANCED FILTER FUNCTIONS
// ============================================

// Filter by period
function filterByPeriod(period) {
    currentFilters.period = period;
    
    // Clear custom date values when selecting preset
    if (period !== 'custom') {
        document.getElementById('customDateStartPayments').value = '';
        document.getElementById('customDateEndPayments').value = '';
        document.getElementById('customDateLabelPayments').textContent = 'Chọn ngày';
    }
    
    // Update button states - use new class names
    document.querySelectorAll('.period-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`filter-${period}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Update mobile select
    const mobileSelect = document.getElementById('mobileTimeFilter');
    if (mobileSelect) {
        mobileSelect.value = period;
    }
    
    // Calculate date range based on period using VN timezone
    let startDate, endDate;
    
    switch(period) {
        case 'today':
            startDate = getVNStartOfToday();
            endDate = getVNEndOfToday();
            break;
        case 'thisWeek':
            startDate = getVNStartOfWeek();
            endDate = getVNEndOfToday();
            break;
        case 'thisMonth':
            startDate = getVNStartOfMonth();
            endDate = getVNEndOfMonth();
            break;
        case 'lastMonth':
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthYear = lastMonth.getFullYear();
            const lastMonthNum = lastMonth.getMonth();
            startDate = new Date(lastMonthYear, lastMonthNum, 1);
            endDate = new Date(lastMonthYear, lastMonthNum + 1, 0, 23, 59, 59, 999);
            break;
        case '3months':
            const now3 = new Date();
            startDate = new Date(now3.getFullYear(), now3.getMonth() - 2, 1);
            endDate = getVNEndOfMonth();
            break;
        case '6months':
            const now6 = new Date();
            startDate = new Date(now6.getFullYear(), now6.getMonth() - 5, 1);
            endDate = getVNEndOfMonth();
            break;
        case 'thisYear':
            startDate = getVNStartOfYear();
            endDate = getVNEndOfYear();
            break;
        case 'all':
            startDate = null;
            endDate = null;
            break;
    }

    // Derive currentMonth from startDate — dùng chung cho API call
    if (startDate) {
        const y = startDate.getFullYear();
        const m = String(startDate.getMonth() + 1).padStart(2, '0');
        currentMonth = `${y}-${m}`;
    }
    
    currentFilters.dateRange = startDate && endDate ? { startDate, endDate } : null;

    console.log('📅 Filter period:', period, {
        startDate: startDate ? startDate.toISOString() : 'null',
        endDate: endDate ? endDate.toISOString() : 'null'
    });

    runAfterPeriodFilterChange();
}

/**
 * Sau khi đổi khoảng thời gian: cập nhật đúng tab + luôn làm mới cache lịch sử (để sang tab Lịch sử không lệch bộ lọc).
 */
function runAfterPeriodFilterChange() {
    if (currentTab === 'history') {
        loadPaymentHistory();
    } else if (currentTab === 'excluded') {
        loadExcludedCommissions();
    } else if (currentTab === 'ranking') {
        loadRanking();
    } else {
        applyFilters();
    }
    // Badge tab "Lịch sử" cần số lượng theo khoảng thời gian — trước đây chỉ fetch khi đang mở tab Lịch sử nên badge mãi là "-"
    if (currentTab !== 'history') {
        void loadPaymentHistory();
    }
}

// Apply all filters
function applyFilters() {
    // Đọc từ state — onSearchInput/selectStatusFilter/clearAllFilters đã sync vào currentFilters
    const { status, search } = currentFilters;

    // Clear button: chỉ toggle, tránh gọi classList nhiều lần
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !search);

    updateActiveFiltersDisplay();

    if (currentTab === 'history') {
        renderHistoryFromFilters();
        return;
    }

    if (currentTab === 'ranking') {
        renderHistoryFromFilters();
        return;
    }

    // Filter data - Create deep copy to avoid modifying original
    let filtered = allCommissions.map(ctv => ({
        ...ctv,
        orders: ctv.orders ? [...ctv.orders] : []
    }));
    
    // Filter by date range
    if (currentFilters.dateRange) {
        const { startDate, endDate } = currentFilters.dateRange;
        
        console.log('📅 Date Range Filter:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startDateLocal: startDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            endDateLocal: endDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        });
        
        let totalOrdersChecked = 0;
        let totalOrdersMatched = 0;
        
        filtered = filtered.map(ctv => {
            // Filter orders within each CTV
            if (ctv.orders && Array.isArray(ctv.orders)) {
                const filteredOrders = ctv.orders.filter(order => {
                    totalOrdersChecked++;

                    // IMPORTANT: Use created_at_unix (milliseconds timestamp) if available
                    // Otherwise fallback to created_at (ISO string)
                    let orderDate;
                    if (order.created_at_unix) {
                        // created_at_unix is already in milliseconds, no need to multiply by 1000
                        const timestamp = typeof order.created_at_unix === 'string'
                            ? parseInt(order.created_at_unix)
                            : order.created_at_unix;
                        orderDate = new Date(timestamp);
                    } else {
                        // Fallback to ISO string
                        orderDate = new Date(order.created_at || order.payment_date);
                    }

                    const matches = orderDate >= startDate && orderDate <= endDate;

                    if (matches) totalOrdersMatched++;

                    // Debug log for first 5 orders
                    if (totalOrdersChecked <= 5) {
                        console.log(`  📦 Order ${order.order_id || order.order_code}:`, {
                            created_at_unix: order.created_at_unix,
                            created_at: order.created_at,
                            orderDate_ISO: orderDate.toISOString(),
                            orderDate_VN: orderDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                            startDate_VN: startDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                            endDate_VN: endDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                            matches,
                            'orderDate >= startDate': orderDate >= startDate,
                            'orderDate <= endDate': orderDate <= endDate
                        });
                    }

                    return matches;
                });

                // Active orders = non-excluded only (for commission totals)
                const activeOrders = filteredOrders.filter(o => o.is_excluded !== 1);

                return {
                    ...ctv,
                    orders: filteredOrders,
                    commission_amount: activeOrders.reduce((sum, o) => sum + (o.commission || 0), 0),
                    order_count: activeOrders.length
                };
            }
            return ctv;
        }).filter(ctv => ctv.order_count > 0);
        
        console.log(`✅ Date filter result: ${totalOrdersMatched}/${totalOrdersChecked} orders matched`);
    }
    
    // Filter by status
    if (status && status !== 'all') {
        filtered = filtered.map(ctv => {
            if (ctv.orders && Array.isArray(ctv.orders)) {
                const filteredOrders = ctv.orders.filter(order => {
                    const orderStatus = order.payment_status || order.status || 'pending';
                    return orderStatus === status;
                });

                // Active orders = non-excluded only (for commission totals)
                const activeOrders = filteredOrders.filter(o => o.is_excluded !== 1);

                return {
                    ...ctv,
                    orders: filteredOrders,
                    commission_amount: activeOrders.reduce((sum, o) => sum + (o.commission || 0), 0),
                    order_count: activeOrders.length
                };
            }
            return ctv;
        }).filter(ctv => ctv.order_count > 0);
    }
    
    // Filter by search (CTTV name, referral code, phone, bank)
    if (search) {
        filtered = filtered.filter(ctv => {
            return (
                (ctv.referral_code && ctv.referral_code.toLowerCase().includes(search)) ||
                (ctv.full_name && ctv.full_name.toLowerCase().includes(search)) ||
                (ctv.phone && ctv.phone.includes(search)) ||
                (ctv.bank_account_number && ctv.bank_account_number.includes(search)) ||
                (ctv.bank_name && ctv.bank_name.toLowerCase().includes(search))
            );
        });
    }
    
    filteredCommissions = filtered;
    
    console.log('✅ Filtered:', {
        original: allCommissions.length,
        filtered: filteredCommissions.length,
        filters: currentFilters
    });

    // Tab "Đã loại": vẫn phải tính filteredCommissions + badge "Chưa thanh toán" (trước đây return sớm → badge sai)
    if (currentTab === 'excluded') {
        updateUnpaidBadge();
        renderHistoryFromFilters(); // badge tab Lịch sử theo search/status (đã có paymentHistory trong cache)
        return;
    }

    renderCTVList();
    updateFilteredSummary();
    renderHistoryFromFilters();
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const container = document.getElementById('activeFilters');
    const tagsContainer = document.getElementById('activeFilterTags');
    
    // Check if elements exist (they were removed in compact layout)
    if (!container || !tagsContainer) {
        return;
    }
    
    const hasFilters = currentFilters.period !== 'thisMonth' || 
                      currentFilters.status !== 'all' || 
                      currentFilters.search;
    
    if (!hasFilters) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    let tags = [];
    
    // Period tag
    const periodLabels = {
        'today': 'Hôm nay',
        'thisWeek': 'Tuần này',
        'thisMonth': 'Tháng này',
        'lastMonth': 'Tháng trước',
        '3months': '3 tháng gần đây',
        '6months': '6 tháng gần đây',
        'thisYear': 'Năm nay',
        'all': 'Tất cả'
    };
    
    if (currentFilters.period !== 'thisMonth') {
        tags.push(`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                ${periodLabels[currentFilters.period]}
                <button onclick="filterByPeriod('thisMonth')" class="hover:text-indigo-900 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `);
    }
    
    // Status tag
    if (currentFilters.status !== 'all') {
        const statusLabel = currentFilters.status === 'pending' ? 'Chưa thanh toán' : 'Đã thanh toán';
        tags.push(`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                ${statusLabel}
                <button onclick="document.getElementById('statusFilter').value='all'; applyFilters();" class="hover:text-blue-900 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `);
    }
    
    // Search tag
    if (currentFilters.search) {
        tags.push(`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Tìm: "${currentFilters.search}"
                <button onclick="clearSearch()" class="hover:text-green-900 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `);
    }
    
    tagsContainer.innerHTML = tags.join('');
}

// Cập nhật badge count trên tab Chưa thanh toán — gọi được từ bất kỳ tab nào
function updateUnpaidBadge() {
    document.getElementById('unpaidCount').textContent = filteredCommissions.length;
}

// Update summary with filtered data
function updateFilteredSummary() {
    applySummaryLabels('unpaid');
    const totalCTV = filteredCommissions.length;
    // Only count non-excluded orders
    const totalOrders = filteredCommissions.reduce((sum, ctv) => {
        const activeOrders = (ctv.orders || []).filter(o => o.is_excluded !== 1);
        return sum + activeOrders.length;
    }, 0);
    const totalCommission = filteredCommissions.reduce((sum, ctv) => {
        const activeOrders = (ctv.orders || []).filter(o => o.is_excluded !== 1);
        return sum + activeOrders.reduce((s, o) => s + (o.commission || 0), 0);
    }, 0);

    document.getElementById('totalCTV').textContent = totalCTV;
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);
    document.getElementById('unpaidCount').textContent = totalCTV;
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {
        period: 'thisMonth',
        status: 'all',
        search: '',
        dateRange: null
    };
    
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').classList.add('hidden');
    
    filterByPeriod('thisMonth');
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').classList.add('hidden');
    currentFilters.search = '';
    applyFilters();
}


// ============================================
// Custom Date Picker for Payments Filter
// ============================================

let currentDateModePayments = 'single'; // 'single' or 'range'
let customDatePickerModalPayments = null;

/**
 * Show custom date picker modal for payments
 */
function showCustomDatePickerPayments(event) {
    event.stopPropagation();
    
    // Remove existing modal if any
    if (customDatePickerModalPayments) {
        customDatePickerModalPayments.remove();
    }
    
    // Get current values or default to today
    const today = getTodayDateString();
    const startDate = document.getElementById('customDateStartPayments').value || today;
    const endDate = document.getElementById('customDateEndPayments').value || today;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'date-picker-modal';
    modal.innerHTML = `
        <div class="date-picker-content">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Chọn thời gian</h3>
                <button onclick="closeCustomDatePickerPayments()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Mode Tabs -->
            <div class="date-mode-tabs">
                <button class="date-mode-tab ${currentDateModePayments === 'single' ? 'active' : ''}" onclick="switchDateModePayments('single')">
                    Một ngày
                </button>
                <button class="date-mode-tab ${currentDateModePayments === 'range' ? 'active' : ''}" onclick="switchDateModePayments('range')">
                    Khoảng thời gian
                </button>
            </div>
            
            <!-- Single Date Mode -->
            <div id="singleDateModePayments" class="${currentDateModePayments === 'single' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Chọn ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="singleDateInputPayments" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Range Date Mode -->
            <div id="rangeDateModePayments" class="${currentDateModePayments === 'range' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Từ ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="startDateInputPayments" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="endDateInputPayments" value="${endDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mt-6">
                <button onclick="clearCustomDatePayments()" 
                    class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Xóa bộ lọc
                </button>
                <button onclick="applyCustomDatePayments()" 
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    customDatePickerModalPayments = modal;
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCustomDatePickerPayments();
        }
    });
}

/**
 * Close custom date picker modal
 */
function closeCustomDatePickerPayments() {
    if (customDatePickerModalPayments) {
        customDatePickerModalPayments.remove();
        customDatePickerModalPayments = null;
    }
}

/**
 * Switch between single and range date mode
 */
function switchDateModePayments(mode) {
    currentDateModePayments = mode;
    
    // Update tabs
    document.querySelectorAll('.date-mode-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide modes
    const singleMode = document.getElementById('singleDateModePayments');
    const rangeMode = document.getElementById('rangeDateModePayments');
    
    if (mode === 'single') {
        singleMode.classList.remove('hidden');
        rangeMode.classList.add('hidden');
    } else {
        singleMode.classList.add('hidden');
        rangeMode.classList.remove('hidden');
    }
}

/**
 * Apply custom date filter
 */
function applyCustomDatePayments() {
    let startDate, endDate;
    
    if (currentDateModePayments === 'single') {
        const singleDate = document.getElementById('singleDateInputPayments').value;
        if (!singleDate) {
            showToast('Vui lòng chọn ngày', 'warning');
            return;
        }
        startDate = singleDate;
        endDate = singleDate;
    } else {
        startDate = document.getElementById('startDateInputPayments').value;
        endDate = document.getElementById('endDateInputPayments').value;
        
        if (!startDate || !endDate) {
            showToast('Vui lòng chọn đầy đủ khoảng thời gian', 'warning');
            return;
        }
        
        // Validate date range
        if (new Date(startDate) > new Date(endDate)) {
            showToast('Ngày bắt đầu phải trước ngày kết thúc', 'warning');
            return;
        }
    }
    
    // Store values
    document.getElementById('customDateStartPayments').value = startDate;
    document.getElementById('customDateEndPayments').value = endDate;
    
    // Update button label
    updateCustomDateLabelPayments(startDate, endDate);
    
    // Update button states
    document.querySelectorAll('.period-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('customDateBtnPayments').classList.add('active');
    
    // Set custom date range in filters
    const customStart = getVNStartOfDate(startDate);
    const customEnd = getVNEndOfDate(endDate);
    currentFilters.period = 'custom';
    currentFilters.dateRange = { startDate: customStart, endDate: customEnd };
    
    // Load data for the month of startDate
    // This ensures we have data for the selected date range
    const startDateObj = new Date(startDate);
    const year = startDateObj.getFullYear();
    const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const targetMonth = `${year}-${month}`;
    
    // Only reload unpaid API if commission month thay đổi
    if (currentMonth !== targetMonth) {
        currentMonth = targetMonth;
        showToast('Đang tải dữ liệu...', 'info');

        loadUnpaidOrders()
            .then(() => {
                runAfterPeriodFilterChange();
                showToast('Đã áp dụng bộ lọc thời gian', 'success');
            })
            .catch(() => {
                showToast('Không thể tải dữ liệu', 'error');
            });
    } else {
        runAfterPeriodFilterChange();
        showToast('Đã áp dụng bộ lọc thời gian', 'success');
    }
    
    // Close modal
    closeCustomDatePickerPayments();
}

/**
 * Clear custom date filter
 */
function clearCustomDatePayments() {
    document.getElementById('customDateStartPayments').value = '';
    document.getElementById('customDateEndPayments').value = '';
    
    // Reset button label
    document.getElementById('customDateLabelPayments').textContent = 'Chọn ngày';
    
    // Apply default filter (thisMonth)
    filterByPeriod('thisMonth');
    
    // Close modal
    closeCustomDatePickerPayments();
    
    showToast('Đã xóa bộ lọc thời gian', 'info');
}

/**
 * Update custom date button label
 */
function updateCustomDateLabelPayments(startDate, endDate) {
    const label = document.getElementById('customDateLabelPayments');
    
    if (startDate === endDate) {
        // Single date - format as DD/MM/YYYY
        const date = new Date(startDate + 'T00:00:00');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        label.textContent = `${day}/${month}/${year}`;
    } else {
        // Date range - format as DD/MM - DD/MM/YYYY
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        
        const startDay = String(start.getDate()).padStart(2, '0');
        const startMonth = String(start.getMonth() + 1).padStart(2, '0');
        const endDay = String(end.getDate()).padStart(2, '0');
        const endMonth = String(end.getMonth() + 1).padStart(2, '0');
        const endYear = end.getFullYear();
        
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
            // Same month
            label.textContent = `${startDay}-${endDay}/${endMonth}/${endYear}`;
        } else {
            // Different months
            label.textContent = `${startDay}/${startMonth}-${endDay}/${endMonth}/${endYear}`;
        }
    }
}

/**
 * Get today's date string in YYYY-MM-DD format (VN timezone)
 */
function getTodayDateString() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return vnDateStr;
}

/**
 * Get start of a specific date in VN timezone
 */
function getVNStartOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T00:00:00+07:00');
    return vnDateTime;
}

/**
 * Get end of a specific date in VN timezone
 */
function getVNEndOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T23:59:59.999+07:00');
    return vnDateTime;
}


// ============================================
// CUSTOM STATUS FILTER DROPDOWN
// ============================================

// Toggle status filter dropdown
function toggleStatusFilter(event) {
    event.stopPropagation();

    // Close if already open
    const existingMenu = document.getElementById('statusFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'all', label: 'Tất cả trạng thái', color: 'gray', icon: '●' },
        { value: 'pending', label: 'Chưa thanh toán', color: 'yellow', icon: '●' },
        { value: 'paid', label: 'Đã thanh toán', color: 'green', icon: '●' }
    ];

    const currentValue = document.getElementById('statusFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'statusFilterMenu';
    menu.className = 'absolute left-0 right-0 top-full z-[100] mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-xl';

    menu.innerHTML = statuses.map(s => {
        const colorClasses = {
            'gray': 'text-gray-500',
            'yellow': 'text-yellow-500',
            'green': 'text-emerald-500'
        };
        
        const bgClasses = {
            'gray': 'bg-gray-50',
            'yellow': 'bg-yellow-50',
            'green': 'bg-emerald-50'
        };

        return `
        <button 
            onclick="selectStatusFilter('${s.value}', '${s.label}')"
            class="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left ${s.value === currentValue ? bgClasses[s.color] : ''}"
        >
            <span class="text-lg ${colorClasses[s.color]}">${s.icon}</span>
            <span class="text-sm text-gray-700 flex-1">${s.label}</span>
            ${s.value === currentValue ? `
                <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `}).join('');

    button.parentElement.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.parentElement.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select status filter
function selectStatusFilter(value, label) {
    document.getElementById('statusFilter').value = value;
    document.getElementById('statusFilterLabel').textContent = label;
    document.getElementById('statusFilterMenu')?.remove();
    currentFilters.status = value;
    applyFilters();
}


// ============================================
// EXCLUDE / RESTORE COMMISSION MODAL
// ============================================

let excludeModal = null;

/**
 * Show modal to exclude a commission
 */
function showExcludeModal(orderId, orderCode) {
    if (excludeModal) excludeModal.remove();

    excludeModal = document.createElement('div');
    excludeModal.id = 'excludeModal';
    excludeModal.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm';
    excludeModal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden fade-in">
            <div class="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Loại khỏi thanh toán</h2>
                        <p class="text-sm text-white/80">Mã đơn: ${escapeHtml(orderCode)}</p>
                    </div>
                </div>
                <button onclick="closeExcludeModal()" class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="p-6">
                <div class="mb-5 p-4 bg-red-50 rounded-xl border border-red-100">
                    <div class="flex items-start gap-3">
                        <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p class="text-sm font-semibold text-red-800">Hành động này sẽ loại hoa hồng đơn hàng này khỏi tổng thanh toán.</p>
                            <p class="text-xs text-red-600 mt-1">Sử dụng khi đơn hàng giao không thành công, hoàn tiền, hoặc không hợp lệ.</p>
                        </div>
                    </div>
                </div>

                <div class="mb-5">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Lý do loại
                        <span class="text-gray-400 font-normal">(tùy chọn)</span>
                    </label>
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <button type="button" onclick="setExcludeReason('Giao không thành công')"
                            class="reason-btn px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-red-300 hover:bg-red-50 transition-colors text-center">
                            Giao không thành công
                        </button>
                        <button type="button" onclick="setExcludeReason('Khách hàng hoàn đơn')"
                            class="reason-btn px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-red-300 hover:bg-red-50 transition-colors text-center">
                            Khách hàng hoàn đơn
                        </button>
                        <button type="button" onclick="setExcludeReason('Đơn hàng không hợp lệ')"
                            class="reason-btn px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-red-300 hover:bg-red-50 transition-colors text-center">
                            Đơn không hợp lệ
                        </button>
                        <button type="button" onclick="setExcludeReason('Hoàn tiền')"
                            class="reason-btn px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-red-300 hover:bg-red-50 transition-colors text-center">
                            Hoàn tiền
                        </button>
                    </div>
                    <textarea id="excludeReason" rows="2"
                        placeholder="Nhập lý do khác (tùy chọn)"
                        class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none transition-colors"></textarea>
                </div>

                <div class="flex items-center gap-3">
                    <button type="button" onclick="closeExcludeModal()"
                        class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                        Hủy
                    </button>
                    <button type="button" onclick="confirmExclude(${orderId})"
                        class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                        <span id="excludeBtnContent">
                            <svg class="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Xác nhận loại
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(excludeModal);

    excludeModal.addEventListener('click', function(e) {
        if (e.target === excludeModal) closeExcludeModal();
    });
}

function setExcludeReason(reason) {
    document.getElementById('excludeReason').value = reason;
    // Highlight selected button
    document.querySelectorAll('.reason-btn').forEach(btn => {
        btn.classList.remove('border-red-400', 'bg-red-50', 'text-red-700', 'font-semibold');
        btn.classList.add('border-gray-200', 'text-gray-600');
    });
    event.target.classList.remove('border-gray-200', 'text-gray-600');
    event.target.classList.add('border-red-400', 'bg-red-50', 'text-red-700', 'font-semibold');
}

function closeExcludeModal() {
    if (excludeModal) {
        excludeModal.remove();
        excludeModal = null;
    }
}

/**
 * Confirm and submit exclude commission
 */
async function confirmExclude(orderId) {
    const reason = document.getElementById('excludeReason').value.trim();
    const btnContent = document.getElementById('excludeBtnContent');
    const originalContent = btnContent.innerHTML;

    btnContent.innerHTML = `
        <svg class="w-4 h-4 inline mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Đang xử lý...
    `;
    btnContent.parentElement.disabled = true;

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=excludeOrderCommission`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                reason,
                adminUsername: window.currentUser?.username || 'admin'
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Đã loại hoa hồng khỏi danh sách thanh toán`, 'success');
            closeExcludeModal();
            await loadUnpaidOrders();
            if (currentTab === 'excluded') {
                await loadExcludedCommissions();
            }
        } else {
            throw new Error(data.error || 'Không thể loại hoa hồng');
        }
    } catch (error) {
        console.error('❌ Error excluding commission:', error);
        showToast(error.message || 'Không thể loại hoa hồng', 'error');
        btnContent.innerHTML = originalContent;
        btnContent.parentElement.disabled = false;
    }
}

/**
 * Restore an excluded commission
 */
async function restoreCommission(orderId, orderCode) {
    if (!confirm(`Khôi phục hoa hồng cho đơn "${orderCode}"?\nĐơn này sẽ trở lại danh sách thanh toán.`)) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=restoreOrderCommission`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                adminUsername: window.currentUser?.username || 'admin'
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Đã khôi phục hoa hồng cho đơn ${orderCode}`, 'success');
            // loadUnpaidOrders cập nhật cả hai badge; chỉ load excluded tab nếu đang ở tab đó
            await loadUnpaidOrders();
            if (currentTab === 'excluded') {
                await loadExcludedCommissions();
            }
        } else {
            throw new Error(data.error || 'Không thể khôi phục hoa hồng');
        }
    } catch (error) {
        console.error('❌ Error restoring commission:', error);
        showToast(error.message || 'Không thể khôi phục hoa hồng', 'error');
    }
}


// ============================================
// EXCLUDED COMMISSIONS TAB
// ============================================

let excludedData = [];
let excludedCTVList = [];

/**
 * Load excluded commissions from API
 */
async function loadExcludedCommissions() {
    const ctvFilter = document.getElementById('excludedCTVFilter')?.value || '';
    const statusFilter = document.getElementById('excludedStatusFilter')?.value || 'excluded';

    const loadingState = document.getElementById('excludedLoadingState');
    const emptyState = document.getElementById('excludedEmptyState');
    const container = document.getElementById('excludedListContainer');

    if (loadingState) loadingState.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    const existingCards = container?.querySelectorAll('.excl-card');
    existingCards?.forEach(card => card.remove());

    try {
        let url = `${CONFIG.API_URL}?action=getExcludedCommissions&timestamp=${Date.now()}`;
        if (currentFilters.dateRange) {
            url += `&startDate=${encodeURIComponent(formatDateYMDLocal(currentFilters.dateRange.startDate))}`;
            url += `&endDate=${encodeURIComponent(formatDateYMDLocal(currentFilters.dateRange.endDate))}`;
        } else if (currentFilters.period === 'all') {
            url += `&startDate=1970-01-01&endDate=${encodeURIComponent(formatDateYMDLocal(new Date()))}`;
        } else {
            url += `&month=${encodeURIComponent(currentMonth)}`;
        }
        if (ctvFilter) url += `&referralCode=${encodeURIComponent(ctvFilter)}`;
        url += `&status=${encodeURIComponent(statusFilter)}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            excludedData = data.excludedCommissions || [];
            excludedCTVList = data.ctvList || [];

            // Populate CTV dropdown
            populateExcludedCTVDropdown(data.ctvList || []);

            // Update summary cards
            updateExcludedSummary(data.summary);

            // Update badge count
            const exclCount = excludedData.filter(r => r.is_excluded === 1).length;
            const badge = document.getElementById('excludedCount');
            if (badge) badge.textContent = exclCount;

            renderExcludedList();
        } else {
            throw new Error(data.error || 'Không thể tải danh sách');
        }
    } catch (error) {
        console.error('❌ Error loading excluded commissions:', error);
        showToast('Không thể tải danh sách hoa hồng đã loại', 'error');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            const h3 = emptyState.querySelector('h3');
            const p = emptyState.querySelector('p');
            if (h3) h3.textContent = 'Không thể tải dữ liệu';
            if (p) p.textContent = error.message;
        }
    } finally {
        if (loadingState) loadingState.classList.add('hidden');
    }
}

/**
 * Populate CTV dropdown in excluded tab
 */
function populateExcludedCTVDropdown(ctvList) {
    const select = document.getElementById('excludedCTVFilter');
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'Tất cả CTV';
    select.appendChild(allOpt);

    ctvList.forEach(ctv => {
        const opt = document.createElement('option');
        opt.value = ctv.referral_code;
        opt.textContent = `${ctv.full_name} (${ctv.referral_code})`;
        select.appendChild(opt);
    });

    if (currentValue && [...select.options].some(o => o.value === currentValue)) {
        select.value = currentValue;
    } else {
        select.value = '';
    }
}

/**
 * Cập nhật 4 ô summary phía trên theo dữ liệu tab Đã loại (không dùng thêm hàng summary riêng)
 */
function updateExcludedSummary(summary) {
    applySummaryLabels('excluded');
    const total = summary || {};
    const totalCount = total.total || 0;
    const ctvCount = new Set((excludedData || []).map(r => r.referral_code).filter(Boolean)).size;

    const elCtv = document.getElementById('totalCTV');
    const elOrders = document.getElementById('totalOrders');
    const elComm = document.getElementById('totalCommission');
    const elSel = document.getElementById('selectedAmount');
    if (elCtv) elCtv.textContent = ctvCount;
    if (elOrders) elOrders.textContent = totalCount;
    if (elComm) elComm.textContent = formatCurrency(total.totalAmount || 0);
    if (elSel) elSel.textContent = '0đ';
}

/**
 * Render the excluded commissions list
 */
function renderExcludedList() {
    const container = document.getElementById('excludedListContainer');
    const emptyState = document.getElementById('excludedEmptyState');
    const loadingState = document.getElementById('excludedLoadingState');

    if (loadingState) loadingState.classList.add('hidden');

    // Remove existing cards
    const existingCards = container?.querySelectorAll('.excl-card');
    existingCards?.forEach(card => card.remove());

    if (excludedData.length === 0) {
        if (emptyState) {
            emptyState.classList.remove('hidden');
            const h3 = emptyState.querySelector('h3');
            const p = emptyState.querySelector('p');
            if (h3) h3.textContent = 'Chưa có hoa hồng nào bị loại';
            if (p) p.textContent = 'Danh sách hoa hồng bị loại sẽ hiển thị ở đây';
        }
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Group by CTV for cleaner display
    const groupedByCTV = {};
    excludedData.forEach(item => {
        const key = item.referral_code || 'unknown';
        if (!groupedByCTV[key]) {
            groupedByCTV[key] = [];
        }
        groupedByCTV[key].push(item);
    });

    // Render each CTV group as a card
    Object.entries(groupedByCTV).forEach(([referralCode, items]) => {
        const firstItem = items[0];
        const card = createExcludedCTVCard(referralCode, firstItem.ctv_name, firstItem.ctv_phone, items);
        container.appendChild(card);
    });
}

/**
 * Create a CTV group card for excluded tab
 */
function createExcludedCTVCard(referralCode, ctvName, ctvPhone, items) {
    const card = document.createElement('div');
    card.className = 'excl-card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden';

    const exclItems = items.filter(i => i.is_excluded === 1);
    const restoredItems = items.filter(i => i.is_excluded === 0 && i.restored_at_unix);
    const totalAmount = exclItems.reduce((s, i) => s + (i.commission_amount || 0), 0);

    card.innerHTML = `
        <div class="bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-red-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        ${(ctvName || 'N').charAt(0)}
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-sm font-bold text-gray-900 truncate">${escapeHtml(ctvName || 'Không xác định')}</h4>
                        <p class="text-xs text-gray-500">${escapeHtml(referralCode || '')}${ctvPhone ? ' • ' + escapeHtml(ctvPhone) : ''}</p>
                    </div>
                </div>
                <div class="text-right ml-3 flex-shrink-0">
                    <p class="text-lg font-bold text-red-600">${formatCurrency(totalAmount)}</p>
                    <p class="text-xs text-gray-500">${exclItems.length} đơn đã loại${restoredItems.length > 0 ? `, ${restoredItems.length} đã khôi phục` : ''}</p>
                </div>
            </div>
        </div>
        <div class="p-4 space-y-2">
            ${items.map(item => createExcludedOrderRow(item)).join('')}
        </div>
    `;

    return card;
}

/**
 * Create a single row for excluded commission item
 */
function createExcludedOrderRow(item) {
    const isExcluded = item.is_excluded === 1;
    const isRestored = item.is_excluded === 0 && item.restored_at_unix;

    const orderDate = item.order_created_at
        ? toVNShortDate(new Date(
            (typeof item.order_created_at === 'string' ? parseInt(item.order_created_at) : item.order_created_at)
        ))
        : 'N/A';

    const actionTime = isRestored
        ? toVNShortDate(new Date(item.restored_at_unix))
        : toVNShortDate(new Date(item.excluded_at_unix));

    const actionBy = isRestored ? item.restored_by : item.excluded_by;
    const reason = item.exclude_reason || (isExcluded ? 'Không có lý do' : 'Khôi phục thành công');

    const statusColor = isExcluded
        ? { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', text: 'text-red-600', muted: 'text-red-400' }
        : { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600', muted: 'text-emerald-400' };

    return `
        <div class="p-3 rounded-xl border ${statusColor.border} ${statusColor.bg}">
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-mono font-semibold text-blue-600">${escapeHtml(item.order_code || '')}</p>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor.badge}">
                            ${isExcluded ? `
                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                Đã loại
                            ` : `
                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Đã khôi phục
                            `}
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${escapeHtml(item.customer_name || '')}</p>
                    <p class="text-xs ${statusColor.muted} mt-1">
                        ${isExcluded ? 'Loại' : 'Khôi phục'} lúc: ${actionTime}
                        ${actionBy ? ` bởi ${escapeHtml(actionBy)}` : ''}
                    </p>
                    ${reason ? `<p class="text-xs ${statusColor.text} mt-0.5">${escapeHtml(reason)}</p>` : ''}
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="text-sm font-bold ${isExcluded ? 'text-red-500 line-through' : 'text-emerald-600'}">${formatCurrency(item.commission_amount)}</p>
                    <p class="text-xs text-gray-400 mt-1">${orderDate}</p>
                    ${isExcluded ? `
                    <button type="button" onclick="restoreCommission(${item.order_id}, '${escapeHtml(item.order_code || '')}')"
                        class="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-200 text-emerald-600 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors shadow-sm">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Khôi phục
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}
