/**
 * Quản lý quảng cáo — Phase 1
 * API: getAdAnalytics, updateDailyAdSpend
 */
(function () {
    let activePeriod = 'today';
    let activeCustomDate = null;
    let loading = false;
    let editDate = null;
    let lastAnalyticsData = null;
    let trendChart = null;
    let adsDayPickView = { y: 0, m: 0 };

    const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
    const fmtN = (n) => new Intl.NumberFormat('vi-VN').format(n || 0);

    function fmtPerOrder(v) {
        if (v == null || !Number.isFinite(v)) return '—';
        return `${fmtN(Math.round(v))}đ/đơn`;
    }

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

    function fmtChartAxis(v) {
        const n = Number(v) || 0;
        if (n === 0) return '0';
        const sign = n < 0 ? '-' : '';
        const abs = Math.abs(n);
        if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(1)}B`;
        if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
        if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
        return `${sign}${abs}`;
    }

    function destroyTrendChart() {
        if (trendChart) {
            trendChart.destroy();
            trendChart = null;
        }
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
        month: 'Tháng này',
        custom: 'Ngày chọn'
    };

    function vnTodayIso() {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    }

    function periodBadgeLabel(data) {
        if (data.period === 'custom' && data.start_date) {
            if (data.end_date && data.start_date !== data.end_date) {
                return `${fmtDateLabel(data.start_date)} – ${fmtDateLabel(data.end_date)}`;
            }
            return fmtDateLabel(data.start_date);
        }
        return PERIOD_LABELS[data.period] || PERIOD_LABELS.yesterday;
    }

    function getDayAdSpend(data, date) {
        const row = (data.days || []).find((d) => d.date === date);
        return row ? (row.ad_spend || 0) : 0;
    }

    function isSingleDayRange(data) {
        return !!(data.start_date && data.end_date && data.start_date === data.end_date);
    }

    function resolveHeroEditTarget(data) {
        if (!data?.start_date) return null;
        const date = isSingleDayRange(data) ? data.start_date : (data.end_date || data.start_date);
        let amount = getDayAdSpend(data, date);
        if (isSingleDayRange(data) && !amount && data.summary?.ad_spend) {
            amount = data.summary.ad_spend;
        }
        return { date, amount };
    }

    function heroEditTitle(data) {
        const target = resolveHeroEditTarget(data);
        if (!target) return 'Sửa chi QC';
        if (isSingleDayRange(data)) return `Sửa chi QC · ${fmtDateLabel(target.date)}`;
        return `Sửa chi QC · ${fmtDateLabel(target.date)} (ngày gần nhất trong kỳ)`;
    }

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

        const badge = periodBadgeLabel(data);
        const periodBadge = document.getElementById('heroPeriodBadge');
        if (periodBadge) periodBadge.textContent = badge;

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

        const spendEl = document.getElementById('heroAdSpend');
        if (spendEl) {
            spendEl.textContent = fmt(s.ad_spend);
            spendEl.className = 'ads-hero-spend-val';
        }

        const spendCmpEl = document.getElementById('heroAdSpendCmp');
        if (spendCmpEl) {
            spendCmpEl.innerHTML = fmtCmp(c.ad_spend_pct, true) || '—';
        }

        const editBtn = document.getElementById('heroEditSpendBtn');
        if (editBtn) {
            const title = heroEditTitle(data);
            editBtn.title = title;
            editBtn.setAttribute('aria-label', title);
        }

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
                    − Chi QC <strong class="text-slate-600">${fmt(s.ad_spend)}</strong>
                    = LN thực <strong class="${netClass(s.net_profit)}">${fmt(s.net_profit)}</strong>
                </span>
                <span class="mt-1 block tabular-nums text-slate-500">
                    TS gộp ${fmtPct(grossMargin)} · TS thực ${fmtPct(netMargin)}
                    · ${netProfitPerOrder != null ? `${fmt(netProfitPerOrder)}/đơn · ` : ''}${fmtN(s.fb_orders)} đơn FB
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
        const spendEl = document.getElementById('heroAdSpend');
        if (spendEl) spendEl.innerHTML = '<span class="ads-skel inline-block h-5 w-24 rounded"></span>';
        const spendCmpEl = document.getElementById('heroAdSpendCmp');
        if (spendCmpEl) spendCmpEl.textContent = '';
        const breakdown = document.getElementById('heroBreakdown');
        if (breakdown) breakdown.innerHTML = '<span class="ads-skel inline-block h-4 w-full max-w-xl rounded"></span>';
    }

    function setPeriodTab(period) {
        document.querySelectorAll('#periodTabs [data-period]').forEach((btn) => {
            const on = btn.dataset.period === period;
            btn.classList.toggle('ads-period-tab--active', on);
        });
    }

    function openAdsDayPick() {
        const today = vnTodayIso();
        const src = activeCustomDate || today;
        const [y, m] = src.split('-').map(Number);
        adsDayPickView = { y, m: m - 1, selected: src };
        renderAdsDayPickCal();
        const modal = document.getElementById('adsDayPickModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeAdsDayPick() {
        const modal = document.getElementById('adsDayPickModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    function adsDayPickShiftMonth(delta) {
        let { y, m } = adsDayPickView;
        m += delta;
        if (m < 0) { m = 11; y -= 1; }
        if (m > 11) { m = 0; y += 1; }
        const today = vnTodayIso();
        const [ty, tm] = today.split('-').map(Number);
        if (y > ty || (y === ty && m + 1 > tm)) return;
        adsDayPickView.y = y;
        adsDayPickView.m = m;
        renderAdsDayPickCal();
    }

    function renderAdsDayPickCal() {
        const { y, m } = adsDayPickView;
        const today = vnTodayIso();
        const [ty, tm, td] = today.split('-').map(Number);
        const label = document.getElementById('adsDayPickMonthLabel');
        if (label) label.textContent = `Tháng ${m + 1}/${y}`;
        const nextBtn = document.getElementById('adsDayPickNext');
        if (nextBtn) nextBtn.disabled = y > ty || (y === ty && m + 1 >= tm);
        const grid = document.getElementById('adsDayPickGrid');
        if (!grid) return;
        const monthStr = String(m + 1).padStart(2, '0');
        const firstWd = (new Date(`${y}-${monthStr}-01T12:00:00+07:00`).getDay() + 6) % 7;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const selected = adsDayPickView.selected || activeCustomDate;
        const wds = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        let html = wds.map((w) => `<span class="ads-daypick-wd">${w}</span>`).join('');
        for (let i = 0; i < firstWd; i += 1) html += '<span aria-hidden="true"></span>';
        for (let day = 1; day <= daysInMonth; day += 1) {
            const iso = `${y}-${monthStr}-${String(day).padStart(2, '0')}`;
            const isFuture = y > ty || (y === ty && m + 1 > tm) || (y === ty && m + 1 === tm && day > td);
            const cls = [
                'ads-daypick-day',
                iso === today ? 'is-today' : '',
                iso === selected ? 'is-selected' : ''
            ].filter(Boolean).join(' ');
            html += `<button type="button" class="${cls}" ${isFuture ? 'disabled' : ''} data-ads-day="${iso}">${day}</button>`;
        }
        grid.innerHTML = html;
        grid.querySelectorAll('[data-ads-day]').forEach((btn) => {
            btn.addEventListener('click', () => applyAdsCustomDay(btn.dataset.adsDay));
        });
    }

    function applyAdsCustomDay(iso) {
        if (!iso) return;
        closeAdsDayPick();
        load('custom', { customDate: iso });
    }

    function adsDayPickQuick(kind) {
        const today = vnTodayIso();
        if (kind === 'today') {
            applyAdsCustomDay(today);
            return;
        }
        const prev = new Date(`${today}T12:00:00+07:00`);
        prev.setTime(prev.getTime() - 86400000);
        applyAdsCustomDay(prev.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
    }

    function buildAdAnalyticsUrl(period, customDate, ts) {
        const base = `${CONFIG.API_URL}?action=getAdAnalytics&timestamp=${ts}`;
        if (period === 'custom' && customDate) {
            return `${base}&start_date=${encodeURIComponent(customDate)}&end_date=${encodeURIComponent(customDate)}`;
        }
        return `${base}&period=${encodeURIComponent(period)}`;
    }

    function reloadAds() {
        if (activePeriod === 'custom' && activeCustomDate) {
            load('custom', { customDate: activeCustomDate });
        } else {
            load(activePeriod);
        }
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
        const srcBody = document.getElementById('adsSourceBody');
        if (srcBody) srcBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Đang tải…</td></tr>';
        const trendSec = document.getElementById('adsTrendSection');
        if (trendSec) trendSec.classList.add('hidden');
        destroyTrendChart();
        const ordersShare = document.getElementById('kpiOrdersShare');
        if (ordersShare) ordersShare.textContent = '';
        const roasHint = document.getElementById('kpiRoasHint');
        if (roasHint) roasHint.textContent = '';
    }

    function renderSummary(data) {
        lastAnalyticsData = data;
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
        const canvas = document.getElementById('adsTrendChart');
        const sub = document.getElementById('adsTrendSub');
        const insightsEl = document.getElementById('adsPeriodInsights');
        if (!section || !canvas) return;

        const showTrend = data.period === '7d' || data.period === 'month';
        if (!showTrend || !(data.days || []).length) {
            section.classList.add('hidden');
            destroyTrendChart();
            return;
        }

        section.classList.remove('hidden');
        const days = [...(data.days || [])].reverse();
        const ins = data.period_insights || {};
        if (sub) sub.textContent = 'LN thực QC theo ngày · trục dọc = số tiền, trục ngang = ngày';
        if (insightsEl && ins.total_days > 1) {
            insightsEl.textContent = `${ins.profitable_days}/${ins.total_days} ngày lãi`;
            if (ins.loss_days > 0) insightsEl.textContent += ` · ${ins.loss_days} ngày lỗ`;
        } else if (insightsEl) {
            insightsEl.textContent = '';
        }

        destroyTrendChart();
        const labels = days.map((d) => fmtDateLabel(d.date).replace(/\/\d{4}$/, ''));
        const values = days.map((d) => d.net_profit || 0);
        const bgColors = values.map((v) => (v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)'));
        const borderColors = values.map((v) => (v >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'));

        trendChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'LN thực',
                    data: values,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` LN thực: ${fmt(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Ngày',
                            color: '#64748b',
                            font: { size: 12, weight: '600' }
                        },
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 12 } }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'LN thực (VNĐ)',
                            color: '#64748b',
                            font: { size: 12, weight: '600' }
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 12 },
                            callback: (v) => fmtChartAxis(v)
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.25)' }
                    }
                }
            }
        });
    }

    function ppoPerOrder(netProfit, fbOrders) {
        const n = Number(fbOrders) || 0;
        if (n <= 0) return null;
        return netProfit / n;
    }

    function rpoPerOrder(row) {
        if (row.revenue_per_order != null) return row.revenue_per_order;
        const n = Number(row.fb_orders) || 0;
        if (n <= 0) return null;
        return (row.fb_revenue || 0) / n;
    }

    function gpoPerOrder(row) {
        if (row.gross_profit_per_order != null) return row.gross_profit_per_order;
        const n = Number(row.fb_orders) || 0;
        if (n <= 0) return null;
        return (row.fb_gross_profit || 0) / n;
    }

    function npoPerOrder(row) {
        if (row.net_profit_per_order != null) return row.net_profit_per_order;
        return ppoPerOrder(row.net_profit, row.fb_orders);
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
        const qcCls = qcShareCls(row.ad_spend, row.fb_revenue);
        const qcPct = fmtQcSharePct(row.ad_spend, row.fb_revenue);
        return [
            `<span>QC/DT <b class="${qcCls}">${qcPct}</b></span>`,
            `<span>ROAS <b class="${roasClass(row.ad_spend, row.fb_revenue)}">${fmtRoas(row.roas)}</b></span>`,
            `<span>CPA <b class="text-slate-800">${row.cpa != null ? fmt(row.cpa) : '—'}</b></span>`
        ].join('<span class="text-slate-300 px-1.5 select-none" aria-hidden="true">|</span>');
    }

    function renderTable(data) {
        const body = document.getElementById('dailyTableBody');
        const foot = document.getElementById('dailyTableFoot');
        const days = (data.days || []).slice(0, 10);
        const s = data.summary || {};
        if (!body) return;

        if (!days.length) {
            body.innerHTML = '<tr><td colspan="11" class="px-4 py-10 text-center text-slate-400">Không có dữ liệu</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        body.innerHTML = days.map((row) => {
            const qcPct = fmtQcSharePct(row.ad_spend, row.fb_revenue);
            const rpo = rpoPerOrder(row);
            const gpo = gpoPerOrder(row);
            const npo = npoPerOrder(row);
            return `
            <tr class="border-t border-slate-100 hover:bg-slate-50/50">
                <td class="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    ${fmtDateLabel(row.date)}${sourceBadge(row.ad_spend_source)}${qcShareBadge(row.ad_spend, row.fb_revenue)}
                </td>
                <td class="px-4 py-3 text-right tabular-nums">
                    <div class="font-semibold text-violet-600">${fmt(row.ad_spend)}</div>
                    <div class="text-[10px] text-emerald-600">${qcPct} DT</div>
                </td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">${fmtN(row.fb_orders)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">${fmt(row.fb_revenue)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">${fmt(row.fb_gross_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${netClass(row.net_profit)}">${fmt(row.net_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">${fmtPerOrder(rpo)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">${fmtPerOrder(gpo)}</td>
                <td class="px-4 py-3 text-right tabular-nums font-semibold ${netClass(npo)}">${fmtPerOrder(npo)}</td>
                <td class="ads-metrics-col px-4 py-3">${renderSecondaryMetrics(row)}</td>
                <td class="px-4 py-3 text-center">
                    <button type="button" class="edit-spend-btn rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" data-date="${row.date}" data-amount="${row.ad_spend}" title="Sửa chi QC" aria-label="Sửa chi QC">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        if (foot) {
            const rpo = rpoPerOrder(s);
            const gpo = gpoPerOrder(s);
            const npo = npoPerOrder(s);
            foot.innerHTML = `
            <tr>
                <td class="px-4 py-3">Tổng</td>
                <td class="px-4 py-3 text-right tabular-nums">
                    <div class="font-semibold text-violet-600">${fmt(s.ad_spend)}</div>
                    <div class="text-[10px] text-emerald-600">${fmtQcSharePct(s.ad_spend, s.fb_revenue)} DT</div>
                </td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtN(s.fb_orders)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmt(s.fb_revenue)}</td>
                <td class="px-4 py-3 text-right tabular-nums text-slate-900">${fmt(s.fb_gross_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums ${netClass(s.net_profit)}">${fmt(s.net_profit)}</td>
                <td class="px-4 py-3 text-right tabular-nums">${fmtPerOrder(rpo)}</td>
                <td class="px-4 py-3 text-right tabular-nums text-slate-900">${fmtPerOrder(gpo)}</td>
                <td class="px-4 py-3 text-right tabular-nums ${netClass(npo)}">${fmtPerOrder(npo)}</td>
                <td class="ads-metrics-col px-4 py-3">${renderSecondaryMetrics(s)}</td>
                <td></td>
            </tr>`;
        }

        body.querySelectorAll('.edit-spend-btn').forEach((btn) => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.date, Number(btn.dataset.amount)));
        });
    }

    async function load(period, opts = {}) {
        if (loading) return;
        loading = true;

        if (period === 'custom') {
            if (!opts.customDate) {
                loading = false;
                openAdsDayPick();
                return;
            }
            activePeriod = 'custom';
            activeCustomDate = opts.customDate;
        } else {
            activePeriod = period;
            activeCustomDate = null;
        }

        setPeriodTab(activePeriod);
        showLoading();

        try {
            const ts = Date.now();
            const [res, res10d] = await Promise.all([
                fetch(buildAdAnalyticsUrl(activePeriod, activeCustomDate, ts)),
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
            if (body) body.innerHTML = '<tr><td colspan="11" class="px-4 py-10 text-center text-red-500">Không tải được dữ liệu</td></tr>';
        } finally {
            loading = false;
        }
    }

    function openHeroEditSpend() {
        if (!lastAnalyticsData) return;
        const target = resolveHeroEditTarget(lastAnalyticsData);
        if (!target) {
            if (typeof showToast === 'function') showToast('Không xác định được ngày cần sửa', 'error');
            return;
        }
        openEditModal(target.date, target.amount);
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
            reloadAds();
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message || 'Lưu thất bại', 'error');
        }
    }

    document.querySelectorAll('#periodTabs [data-period]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.period === 'custom') {
                openAdsDayPick();
            } else {
                load(btn.dataset.period);
            }
        });
    });

    document.getElementById('adsDayPickClose')?.addEventListener('click', closeAdsDayPick);
    document.getElementById('adsDayPickToday')?.addEventListener('click', () => adsDayPickQuick('today'));
    document.getElementById('adsDayPickYesterday')?.addEventListener('click', () => adsDayPickQuick('yesterday'));
    document.getElementById('adsDayPickPrev')?.addEventListener('click', () => adsDayPickShiftMonth(-1));
    document.getElementById('adsDayPickNext')?.addEventListener('click', () => adsDayPickShiftMonth(1));
    document.getElementById('adsDayPickModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'adsDayPickModal') closeAdsDayPick();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAdsDayPick();
    });

    document.getElementById('heroEditSpendBtn')?.addEventListener('click', openHeroEditSpend);
    document.getElementById('editSpendCancel')?.addEventListener('click', closeEditModal);
    document.getElementById('editSpendSave')?.addEventListener('click', saveEditSpend);
    document.getElementById('editSpendModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'editSpendModal') closeEditModal();
    });

    document.addEventListener('DOMContentLoaded', () => load('today'));
})();
