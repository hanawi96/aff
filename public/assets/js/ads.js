/**
 * Quản lý quảng cáo — Phase 1
 * API: getAdAnalytics, updateDailyAdSpend
 */
(function () {
    let activePeriod = 'today';
    let loading = false;
    let editDate = null;

    const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
    const fmtN = (n) => new Intl.NumberFormat('vi-VN').format(n || 0);

    function fmtDateLabel(iso) {
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    function fmtPct(v) {
        if (v == null || !Number.isFinite(v)) return '—';
        return `${v.toFixed(1)}%`;
    }

    function fmtRoas(v) {
        if (v == null || !Number.isFinite(v)) return '—';
        return `${v.toFixed(1)}×`;
    }

    /**
     * QC/DT + ROAS → badge/màu.
     * Rất tốt: QC&lt;5% &amp; ROAS&gt;20. Tốt: QC&lt;10% (hoặc ROAS&gt;10 khi QC&lt;10%).
     * Ổn: QC 10–20%. Chú ý: 20–35%. Cẩn thận: ≥35%.
     */
    function qcShareTier(adSpend, fbRevenue) {
        const spend = Number(adSpend) || 0;
        const rev = Number(fbRevenue) || 0;
        if (spend <= 0) return 'ok';
        if (rev <= 0) return 'bad';
        const pct = (spend / rev) * 100;
        const roas = rev / spend;
        if (pct < 5 && roas > 20) return 'great';
        if (pct >= 35) return 'bad';
        if (pct >= 20) return 'warn';
        if (pct >= 10) return 'ok';
        if (roas > 10 || pct < 10) return 'good';
        return 'good';
    }

    function qcSharePct(adSpend, fbRevenue) {
        const spend = Number(adSpend) || 0;
        const rev = Number(fbRevenue) || 0;
        if (rev <= 0) return spend > 0 ? null : 0;
        return (spend / rev) * 100;
    }

    function qcShareCls(adSpend, fbRevenue) {
        const map = {
            great: 'text-emerald-700',
            good: 'text-emerald-600',
            ok: 'text-emerald-600',
            warn: 'text-orange-600',
            bad: 'text-red-600'
        };
        return map[qcShareTier(adSpend, fbRevenue)] || '';
    }

    function fmtQcSharePct(adSpend, fbRevenue) {
        const pct = qcSharePct(adSpend, fbRevenue);
        if (pct == null) return '—';
        return pct.toFixed(1) + '%';
    }

    function qcShareHint(adSpend, fbRevenue) {
        const map = {
            great: 'Rất tốt · QC dưới 5% DT · ROAS trên 20×',
            good: 'Tốt · ROAS trên 10× hoặc QC dưới 10% DT',
            ok: 'Ổn · QC 10–20% DT',
            warn: 'Chú ý · QC 20–35% DT',
            bad: 'Cẩn thận · QC từ 35% DT trở lên'
        };
        return map[qcShareTier(adSpend, fbRevenue)] || '—';
    }

    function qcShareBadge(adSpend, fbRevenue) {
        const map = {
            great: '<span class="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Rất tốt</span>',
            good: '<span class="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Tốt</span>',
            ok: '<span class="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Ổn</span>',
            warn: '<span class="ml-1 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">Chú ý</span>',
            bad: '<span class="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Cẩn thận</span>'
        };
        return map[qcShareTier(adSpend, fbRevenue)] || '';
    }

    function roasClass(adSpend, fbRevenue) {
        const map = {
            great: 'ads-roas--great',
            good: 'ads-roas--good',
            ok: 'ads-roas--good',
            warn: 'ads-roas--warn',
            bad: 'ads-roas--bad'
        };
        return map[qcShareTier(adSpend, fbRevenue)] || '';
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
        const grossMargin = s.gross_margin_pct != null
            ? s.gross_margin_pct
            : (s.fb_revenue > 0 ? (s.fb_gross_profit / s.fb_revenue) * 100 : null);
        const netMargin = s.net_margin_pct != null
            ? s.net_margin_pct
            : (s.fb_revenue > 0 ? (s.net_profit / s.fb_revenue) * 100 : null);

        const breakdown = document.getElementById('heroBreakdown');
        if (breakdown) {
            breakdown.innerHTML = `
                <span class="block text-xs font-medium uppercase tracking-wide text-slate-400">Công thức</span>
                <span class="mt-1 block tabular-nums">
                    LN gộp <strong class="text-slate-800">${fmt(s.fb_gross_profit)}</strong>
                    − Chi QC <strong class="text-slate-800">${fmt(s.ad_spend)}</strong>
                </span>
                <span class="mt-1 block tabular-nums text-slate-500">
                    TS gộp ${fmtPct(grossMargin)} · TS thực ${fmtPct(netMargin)}
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
        if (body) body.innerHTML = '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400">Đang tải…</td></tr>';
        const foot = document.getElementById('dailyTableFoot');
        if (foot) foot.innerHTML = '';
        const srcBody = document.getElementById('adsSourceBody');
        if (srcBody) srcBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Đang tải…</td></tr>';
        const trend = document.getElementById('adsTrendChart');
        if (trend) trend.innerHTML = '';
        const trendSec = document.getElementById('adsTrendSection');
        if (trendSec) trendSec.classList.add('hidden');
        const ordersShare = document.getElementById('kpiOrdersShare');
        if (ordersShare) ordersShare.textContent = '';
        const roasHint = document.getElementById('kpiRoasHint');
        if (roasHint) roasHint.textContent = '';
    }

    function renderSummary(data) {
        const s = data.summary || {};
        const c = data.compare || {};

        document.getElementById('defaultBudgetLabel').textContent = fmt(data.default_ad_spend) + '/ngày';
        document.getElementById('periodRangeLabel').textContent =
            `${fmtDateLabel(data.start_date)} – ${fmtDateLabel(data.end_date)}`;

        document.getElementById('kpiOrders').textContent = `${fmtN(s.fb_orders)} đơn`;
        const shareEl = document.getElementById('kpiOrdersShare');
        if (shareEl) {
            if (s.fb_order_share_pct != null && s.total_orders > 0) {
                shareEl.textContent = `${fmtPct(s.fb_order_share_pct)} tổng đơn (${fmtN(s.fb_orders)}/${fmtN(s.total_orders)})`;
            } else if (s.fb_orders > 0) {
                shareEl.textContent = `${fmtN(s.fb_orders)} đơn Facebook`;
            } else {
                shareEl.textContent = '';
            }
        }
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
        roasEl.className = 'ads-kpi-val mt-2 text-xl font-bold ' + roasClass(s.ad_spend, s.fb_revenue);
        const roasHint = document.getElementById('kpiRoasHint');
        if (roasHint) {
            roasHint.textContent = qcShareHint(s.ad_spend, s.fb_revenue);
            roasHint.className = 'mt-1 text-xs ' + qcShareCls(s.ad_spend, s.fb_revenue);
        }

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

    function renderSourceCompare(data) {
        const body = document.getElementById('adsSourceBody');
        if (!body) return;
        const rows = data.source_compare || [];
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Chưa có đơn trong kỳ này</td></tr>';
            return;
        }
        body.innerHTML = rows.map((r) => {
            const rowCls = r.is_ad_channel ? 'ads-src-row--fb' : '';
            const qcCell = r.is_ad_channel ? fmt(r.ad_spend) : '—';
            return `
            <tr class="border-t border-slate-100 hover:bg-slate-50/50 ${rowCls}">
                <td class="px-4 py-3 font-medium text-slate-800">
                    ${r.label}${r.is_ad_channel ? ' <span class="text-[10px] font-semibold text-blue-600">(QC)</span>' : ''}
                </td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtN(r.order_count)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(r.revenue)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(r.gross_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums text-slate-600">${qcCell}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${netClass(r.net_profit)}">${fmt(r.net_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtPct(r.gross_margin_pct)}</td>
            </tr>`;
        }).join('');
    }

    function renderTrendChart(data) {
        const section = document.getElementById('adsTrendSection');
        const chart = document.getElementById('adsTrendChart');
        const sub = document.getElementById('adsTrendSub');
        const insightsEl = document.getElementById('adsPeriodInsights');
        if (!section || !chart) return;

        const showTrend = data.period === '7d' || data.period === 'month';
        if (!showTrend || !(data.days || []).length) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        const days = [...(data.days || [])].reverse();
        const ins = data.period_insights || {};
        if (sub) sub.textContent = 'LN thực QC theo ngày · màu xanh = lãi, đỏ = lỗ';
        if (insightsEl && ins.total_days > 1) {
            insightsEl.textContent = `${ins.profitable_days}/${ins.total_days} ngày lãi`;
            if (ins.loss_days > 0) insightsEl.textContent += ` · ${ins.loss_days} ngày lỗ`;
        } else if (insightsEl) {
            insightsEl.textContent = '';
        }

        const maxAbs = Math.max(...days.map((d) => Math.abs(d.net_profit || 0)), 1);
        chart.innerHTML = days.map((d) => {
            const np = d.net_profit || 0;
            const h = Math.max(4, (Math.abs(np) / maxAbs) * 100);
            const cls = np >= 0 ? 'ads-trend-bar--profit' : 'ads-trend-bar--loss';
            const label = fmtDateLabel(d.date).replace(/\/\d{4}$/, '');
            return `
            <div class="flex flex-1 flex-col items-center justify-end gap-1 min-w-0">
                <span class="text-[10px] font-medium tabular-nums ${netClass(np)}">${np >= 0 ? '+' : ''}${Math.round(np / 1000)}k</span>
                <div class="ads-trend-bar ${cls} w-full max-w-[2.5rem]" style="height:${h}%"></div>
                <span class="text-[10px] text-slate-400 truncate w-full text-center">${label}</span>
            </div>`;
        }).join('');
    }

    function ppoPerOrder(netProfit, fbOrders) {
        const n = Number(fbOrders) || 0;
        if (n <= 0) return null;
        return netProfit / n;
    }

    function sourceBadge(source) {
        if (source === 'snapshot') {
            return '<span class="ml-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">Đã lưu</span>';
        }
        if (source === 'live') {
            return '<span class="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Hôm nay</span>';
        }
        return '';
    }

    function renderSecondaryMetrics(row) {
        const ppo = ppoPerOrder(row.net_profit, row.fb_orders);
        const qcCls = qcShareCls(row.ad_spend, row.fb_revenue);
        const qcPct = fmtQcSharePct(row.ad_spend, row.fb_revenue);
        return [
            `<span>QC/DT <b class="${qcCls}">${qcPct}</b></span>`,
            `<span>ROAS <b class="${roasClass(row.ad_spend, row.fb_revenue)}">${fmtRoas(row.roas)}</b></span>`,
            `<span>CPA <b class="text-slate-800">${row.cpa != null ? fmt(row.cpa) : '—'}</b></span>`,
            ppo != null ? `<span>LN/đơn <b class="${netClass(ppo)}">${fmt(ppo)}</b></span>` : null
        ].filter(Boolean).join('<span class="text-slate-300 px-1.5 select-none" aria-hidden="true">|</span>');
    }

    function renderTable(data) {
        const body = document.getElementById('dailyTableBody');
        const foot = document.getElementById('dailyTableFoot');
        const days = (data.days || []).slice(0, 10);
        const s = data.summary || {};
        if (!body) return;

        if (!days.length) {
            body.innerHTML = '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400">Không có dữ liệu</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        body.innerHTML = days.map((row) => {
            const qcCls = qcShareCls(row.ad_spend, row.fb_revenue);
            const qcPct = fmtQcSharePct(row.ad_spend, row.fb_revenue);
            return `
            <tr class="border-t border-slate-100 hover:bg-slate-50/50">
                <td class="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    ${fmtDateLabel(row.date)}${sourceBadge(row.ad_spend_source)}${qcShareBadge(row.ad_spend, row.fb_revenue)}
                </td>
                <td class="px-4 py-3 text-right tabular-nums">
                    <div class="font-semibold ${qcCls}">${fmt(row.ad_spend)}</div>
                    <div class="text-[10px] ${qcCls}">${qcPct} DT</div>
                </td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">${fmtN(row.fb_orders)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${netClass(row.net_profit)}">${fmt(row.net_profit)}</td>
                <td class="ads-metrics-col px-4 py-3">${renderSecondaryMetrics(row)}</td>
                <td class="px-4 py-3 text-center">
                    <button type="button" class="edit-spend-btn rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" data-date="${row.date}" data-amount="${row.ad_spend}" title="Sửa chi QC" aria-label="Sửa chi QC">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        if (foot) {
            foot.innerHTML = `
            <tr>
                <td class="px-4 py-3">Tổng</td>
                <td class="px-4 py-3 text-right tabular-nums">
                    <div class="font-semibold ${qcShareCls(s.ad_spend, s.fb_revenue)}">${fmt(s.ad_spend)}</div>
                    <div class="text-[10px] ${qcShareCls(s.ad_spend, s.fb_revenue)}">${fmtQcSharePct(s.ad_spend, s.fb_revenue)} DT</div>
                </td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtN(s.fb_orders)}</td>
                <td class="px-4 py-3 text-right tabular-nums ${netClass(s.net_profit)}">${fmt(s.net_profit)}</td>
                <td class="ads-metrics-col px-4 py-3">${renderSecondaryMetrics(s)}</td>
                <td></td>
            </tr>`;
        }

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
            const ts = Date.now();
            const [res, res10d] = await Promise.all([
                fetch(`${CONFIG.API_URL}?action=getAdAnalytics&period=${encodeURIComponent(period)}&timestamp=${ts}`),
                fetch(`${CONFIG.API_URL}?action=getAdAnalytics&period=10d&timestamp=${ts}`)
            ]);
            const data = await res.json();
            const data10d = await res10d.json();
            if (!data.success) throw new Error(data.error || 'Không tải được dữ liệu');
            renderSummary(data);
            renderTrendChart(data);
            renderSourceCompare(data);
            if (data10d.success) {
                renderTable(data10d);
            } else {
                renderTable({ days: [], summary: {} });
            }
        } catch (e) {
            console.error('[Ads]', e);
            if (typeof showToast === 'function') showToast(e.message || 'Lỗi tải dữ liệu', 'error');
            const body = document.getElementById('dailyTableBody');
            if (body) body.innerHTML = '<tr><td colspan="6" class="px-4 py-10 text-center text-red-500">Không tải được dữ liệu</td></tr>';
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

    document.addEventListener('DOMContentLoaded', () => load('today'));
})();
