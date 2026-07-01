/**
 * Quản lý quảng cáo — Phase 1
 * API: getAdAnalytics, updateDailyAdSpend
 */
(function () {
    let activePeriod = 'yesterday';
    let loading = false;
    let editDate = null;

    const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
    const fmtN = (n) => new Intl.NumberFormat('vi-VN').format(n || 0);

    function fmtDateLabel(iso) {
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    function fmtRoas(v) {
        if (v == null || !Number.isFinite(v)) return '—';
        return `${v.toFixed(1)}×`;
    }

    function roasClass(v) {
        if (v == null || !Number.isFinite(v)) return '';
        if (v >= 3) return 'ads-roas--good';
        if (v >= 2) return 'ads-roas--warn';
        return 'ads-roas--bad';
    }

    function netClass(v) {
        if (v == null) return 'text-slate-900';
        return v >= 0 ? 'text-emerald-600' : 'text-red-600';
    }

    function fmtCmp(pct, invert) {
        if (pct == null || !Number.isFinite(pct)) return '';
        const abs = Math.abs(pct).toFixed(1);
        const up = pct > 0.05;
        const down = pct < -0.05;
        if (!up && !down) return '≈ bằng kỳ trước';
        const good = invert ? down : up;
        const sign = up ? '+' : '−';
        const color = good ? 'text-emerald-600' : (pct === 0 ? 'text-slate-500' : 'text-red-600');
        return `<span class="${color}">${sign}${abs}% vs kỳ trước</span>`;
    }

    const PERIOD_LABELS = {
        yesterday: 'Hôm qua',
        today: 'Hôm nay',
        '7d': '7 ngày qua',
        month: 'Tháng này'
    };

    function heroTone(netProfit) {
        if (netProfit == null || !Number.isFinite(netProfit)) return 'flat';
        if (netProfit > 0) return 'profit';
        if (netProfit < 0) return 'loss';
        return 'flat';
    }

    function renderHero(data) {
        const s = data.summary || {};
        const c = data.compare || {};
        const tone = heroTone(s.net_profit);
        const hero = document.getElementById('adsHero');
        if (hero) hero.className = `ads-hero ads-hero--${tone}`;

        const periodBadge = document.getElementById('heroPeriodBadge');
        if (periodBadge) {
            periodBadge.textContent = PERIOD_LABELS[data.period] || PERIOD_LABELS.yesterday;
        }

        const statusBadge = document.getElementById('heroStatusBadge');
        if (statusBadge) {
            const labels = { profit: 'Đang lãi', loss: 'Đang lỗ', flat: 'Hòa vốn' };
            statusBadge.textContent = labels[tone];
            statusBadge.className = `ads-hero-badge ads-hero-badge--${tone}`;
        }

        const valEl = document.getElementById('heroNetProfit');
        if (valEl) {
            valEl.textContent = fmt(s.net_profit);
            valEl.className = `ads-hero-val ads-hero-val--${tone} mt-2`;
        }

        const cmpEl = document.getElementById('heroNetProfitCmp');
        if (cmpEl) cmpEl.innerHTML = fmtCmp(c.net_profit_pct, false) || '—';

        const netProfitPerOrder = s.net_profit_per_order != null
            ? s.net_profit_per_order
            : (s.fb_orders > 0 ? s.net_profit / s.fb_orders : null);

        const breakdown = document.getElementById('heroBreakdown');
        if (breakdown) {
            breakdown.innerHTML = `
                <span class="block text-xs font-medium uppercase tracking-wide text-slate-400">Công thức</span>
                <span class="mt-1 block tabular-nums">
                    LN gộp <strong class="text-slate-800">${fmt(s.fb_gross_profit)}</strong>
                    − Chi QC <strong class="text-slate-800">${fmt(s.ad_spend)}</strong>
                </span>
                <span class="mt-1 block tabular-nums text-slate-500">
                    ${netProfitPerOrder != null ? `${fmt(netProfitPerOrder)}/đơn · ` : ''}${fmtN(s.fb_orders)} đơn FB
                </span>`;
        }
    }

    function showHeroLoading() {
        const hero = document.getElementById('adsHero');
        if (hero) hero.className = 'ads-hero ads-hero--flat';
        const valEl = document.getElementById('heroNetProfit');
        if (valEl) valEl.innerHTML = '<span class="ads-skel inline-block h-9 w-48 rounded-lg"></span>';
        const cmpEl = document.getElementById('heroNetProfitCmp');
        if (cmpEl) cmpEl.textContent = '';
        const breakdown = document.getElementById('heroBreakdown');
        if (breakdown) breakdown.innerHTML = '<span class="ads-skel inline-block h-4 w-56 rounded"></span>';
    }

    function setPeriodTab(period) {
        document.querySelectorAll('#periodTabs [data-period]').forEach((btn) => {
            const on = btn.dataset.period === period;
            btn.classList.toggle('ads-period-tab--active', on);
        });
    }

    function showLoading() {
        showHeroLoading();
        ['kpiOrders', 'kpiRevenue', 'kpiRevenuePerOrder', 'kpiRoas', 'kpiCpa', 'kpiProfitPerOrder'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="ads-skel inline-block h-7 w-32"></span>';
        });
        ['kpiOrdersCmp', 'kpiRevenueCmp', 'kpiRevenuePerOrderCmp', 'kpiCpaCmp', 'kpiProfitPerOrderCmp'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        const body = document.getElementById('dailyTableBody');
        if (body) body.innerHTML = '<tr><td colspan="11" class="px-4 py-10 text-center text-slate-400">Đang tải…</td></tr>';
        const foot = document.getElementById('dailyTableFoot');
        if (foot) foot.innerHTML = '';
    }

    function renderSummary(data) {
        const s = data.summary || {};
        const c = data.compare || {};

        document.getElementById('defaultBudgetLabel').textContent = fmt(data.default_ad_spend) + '/ngày';
        document.getElementById('periodRangeLabel').textContent =
            `${fmtDateLabel(data.start_date)} – ${fmtDateLabel(data.end_date)}`;

        document.getElementById('kpiOrders').textContent = `${fmtN(s.fb_orders)} đơn`;
        document.getElementById('kpiOrdersCmp').innerHTML = fmtCmp(c.fb_orders_pct, false);

        document.getElementById('kpiRevenue').textContent = fmt(s.fb_revenue);
        document.getElementById('kpiRevenueCmp').innerHTML = fmtCmp(c.fb_revenue_pct, false);

        const revenuePerOrder = s.revenue_per_order != null
            ? s.revenue_per_order
            : (s.fb_orders > 0 ? s.fb_revenue / s.fb_orders : null);
        document.getElementById('kpiRevenuePerOrder').textContent =
            revenuePerOrder != null ? fmt(revenuePerOrder) + '/đơn' : '—';
        document.getElementById('kpiRevenuePerOrderCmp').innerHTML =
            fmtCmp(c.revenue_per_order_pct, false);

        renderHero(data);

        const roasEl = document.getElementById('kpiRoas');
        roasEl.textContent = fmtRoas(s.roas);
        roasEl.className = 'ads-kpi-val mt-2 text-xl font-bold ' + roasClass(s.roas);

        document.getElementById('kpiCpa').textContent = s.cpa != null ? fmt(s.cpa) + '/đơn' : '—';
        document.getElementById('kpiCpaCmp').innerHTML = fmtCmp(c.cpa_pct, true);

        const netProfitPerOrder = s.net_profit_per_order != null
            ? s.net_profit_per_order
            : (s.fb_orders > 0 ? s.net_profit / s.fb_orders : null);

        const ppoEl = document.getElementById('kpiProfitPerOrder');
        ppoEl.textContent = netProfitPerOrder != null ? fmt(netProfitPerOrder) + '/đơn' : '—';
        ppoEl.className = 'ads-kpi-val mt-2 text-xl font-bold ' + netClass(netProfitPerOrder);
        document.getElementById('kpiProfitPerOrderCmp').innerHTML =
            fmtCmp(c.net_profit_per_order_pct, false);
    }

    function sourceBadge(source) {
        if (source === 'snapshot') {
            return '<span class="ml-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">Đã lưu</span>';
        }
        return '<span class="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Mặc định</span>';
    }

    function renderTable(data) {
        const body = document.getElementById('dailyTableBody');
        const foot = document.getElementById('dailyTableFoot');
        const days = data.days || [];
        const s = data.summary || {};

        if (!days.length) {
            body.innerHTML = '<tr><td colspan="11" class="px-4 py-10 text-center text-slate-400">Không có dữ liệu</td></tr>';
            foot.innerHTML = '';
            return;
        }

        body.innerHTML = days.map((row) => {
            const rpo = row.revenue_per_order != null
                ? row.revenue_per_order
                : (row.fb_orders > 0 ? row.fb_revenue / row.fb_orders : null);
            const ppo = row.net_profit_per_order != null
                ? row.net_profit_per_order
                : (row.fb_orders > 0 ? row.net_profit / row.fb_orders : null);
            return `
            <tr class="border-t border-slate-100 hover:bg-slate-50/50">
                <td class="px-4 py-3 font-medium text-slate-800">${fmtDateLabel(row.date)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(row.ad_spend)}${sourceBadge(row.ad_spend_source)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtN(row.fb_orders)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(row.fb_revenue)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${rpo != null ? fmt(rpo) : '—'}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(row.fb_gross_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${roasClass(row.roas)}">${fmtRoas(row.roas)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${row.cpa != null ? fmt(row.cpa) : '—'}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${netClass(row.net_profit)}">${fmt(row.net_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${netClass(ppo)}">${ppo != null ? fmt(ppo) : '—'}</td>
                <td class="px-4 py-3 text-center">
                    <button type="button" class="edit-spend-btn rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" data-date="${row.date}" data-amount="${row.ad_spend}" title="Sửa chi QC" aria-label="Sửa chi QC">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                </td>
            </tr>
        `;
        }).join('');

        const totalPpo = s.net_profit_per_order != null
            ? s.net_profit_per_order
            : (s.fb_orders > 0 ? s.net_profit / s.fb_orders : null);
        const totalRpo = s.revenue_per_order != null
            ? s.revenue_per_order
            : (s.fb_orders > 0 ? s.fb_revenue / s.fb_orders : null);

        foot.innerHTML = `
            <tr>
                <td class="px-4 py-3">Tổng</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(s.ad_spend)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtN(s.fb_orders)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(s.fb_revenue)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${totalRpo != null ? fmt(totalRpo) : '—'}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(s.fb_gross_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums ${roasClass(s.roas)}">${fmtRoas(s.roas)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${s.cpa != null ? fmt(s.cpa) : '—'}</td>
                <td class="px-4 py-3 text-right tabular-nums ${netClass(s.net_profit)}">${fmt(s.net_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums ${netClass(totalPpo)}">${totalPpo != null ? fmt(totalPpo) : '—'}</td>
                <td></td>
            </tr>`;

        body.querySelectorAll('.edit-spend-btn').forEach((btn) => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.date, Number(btn.dataset.amount)));
        });
    }

    async function load(period) {
        if (loading) return;
        loading = true;
        activePeriod = period;
        setPeriodTab(period);
        showLoading();

        try {
            const res = await fetch(
                `${CONFIG.API_URL}?action=getAdAnalytics&period=${encodeURIComponent(period)}&timestamp=${Date.now()}`
            );
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Không tải được dữ liệu');
            renderSummary(data);
            renderTable(data);
        } catch (e) {
            console.error('[Ads]', e);
            if (typeof showToast === 'function') showToast(e.message || 'Lỗi tải dữ liệu', 'error');
            document.getElementById('dailyTableBody').innerHTML =
                '<tr><td colspan="11" class="px-4 py-10 text-center text-red-500">Không tải được dữ liệu</td></tr>';
        } finally {
            loading = false;
        }
    }

    function openEditModal(date, amount) {
        editDate = date;
        document.getElementById('editSpendDateLabel').textContent = fmtDateLabel(date);
        document.getElementById('editSpendAmount').value = amount || 0;
        const modal = document.getElementById('editSpendModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('editSpendAmount').focus();
    }

    function closeEditModal() {
        editDate = null;
        const modal = document.getElementById('editSpendModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    async function saveEditSpend() {
        const amount = Number(document.getElementById('editSpendAmount').value);
        if (!editDate || !Number.isFinite(amount) || amount < 0) {
            if (typeof showToast === 'function') showToast('Số tiền không hợp lệ', 'error');
            return;
        }
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateDailyAdSpend', spendDate: editDate, amount })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Lưu thất bại');
            if (typeof showToast === 'function') showToast('Đã cập nhật chi QC', 'success');
            closeEditModal();
            load(activePeriod);
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message || 'Lưu thất bại', 'error');
        }
    }

    document.querySelectorAll('#periodTabs [data-period]').forEach((btn) => {
        btn.addEventListener('click', () => load(btn.dataset.period));
    });

    document.getElementById('editSpendCancel')?.addEventListener('click', closeEditModal);
    document.getElementById('editSpendSave')?.addEventListener('click', saveEditSpend);
    document.getElementById('editSpendModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'editSpendModal') closeEditModal();
    });

    document.addEventListener('DOMContentLoaded', () => load('yesterday'));
})();
