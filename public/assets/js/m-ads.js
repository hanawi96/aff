/**
 * Quảng cáo mobile — getAdAnalytics, updateDailyAdSpend
 */
(function () {
    let activePeriod = 'today';
    let loading = false;
    let editDate = null;

    const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
    const fmtN = (n) => new Intl.NumberFormat('vi-VN').format(n || 0);
    const fmtShort = (n) => {
        const v = n || 0;
        const abs = Math.abs(v);
        if (abs >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}tr`;
        if (abs >= 1000) return `${Math.round(v / 1000)}k`;
        return String(Math.round(v));
    };

    function fmtDateLabel(iso) {
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    function fmtDateShort(iso) {
        if (!iso) return '—';
        const [, m, d] = iso.split('-');
        return `${d}/${m}`;
    }

    function fmtPct(v) {
        if (v == null || !Number.isFinite(v)) return '—';
        return `${v.toFixed(1)}%`;
    }

    function fmtRoas(v) {
        if (v == null || !Number.isFinite(v)) return '—';
        return `${v.toFixed(1)}×`;
    }

    function roasClass(v, breakEven) {
        if (v == null || !Number.isFinite(v)) return '';
        const be = breakEven != null && Number.isFinite(breakEven) ? breakEven : 3;
        if (v >= Math.max(3, be)) return 'mads-roas-good';
        if (v >= be) return 'mads-roas-warn';
        return 'mads-roas-bad';
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
        if (!up && !down) return '≈ kỳ trước';
        const good = invert ? down : up;
        const sign = up ? '+' : '−';
        const color = good ? 'text-emerald-600' : 'text-red-500';
        return `<span class="${color}">${sign}${abs}%</span>`;
    }

    const PERIOD_LABELS = {
        yesterday: 'Hôm qua',
        today: 'Hôm nay',
        '7d': '7 ngày',
        month: 'Tháng này'
    };

    function heroTone(netProfit) {
        if (netProfit == null || !Number.isFinite(netProfit)) return 'flat';
        if (netProfit > 0) return 'profit';
        if (netProfit < 0) return 'loss';
        return 'flat';
    }

    function setPeriodTab(period) {
        document.querySelectorAll('#madsPeriodTabs [data-period]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.period === period);
        });
    }

    function showLoading() {
        const hero = document.getElementById('madsHero');
        if (hero) hero.className = 'mads-hero mads-hero--flat fade-up';
        document.getElementById('madsHeroValue').innerHTML = '<span class="skeleton inline-block h-8 w-36 rounded-lg"></span>';
        document.getElementById('madsHeroCmp').textContent = '';
        document.getElementById('madsHeroFormula').innerHTML = '<span class="skeleton inline-block h-4 w-24 rounded"></span>';
        document.getElementById('madsHeroBadge').textContent = '—';
        document.getElementById('madsDayList').innerHTML = `
            <div class="mads-day-card p-4 space-y-2">
                <div class="skeleton h-4 w-24 rounded"></div>
                <div class="skeleton h-3 w-full rounded"></div>
            </div>`;
        const trend = document.getElementById('madsTrendSection');
        if (trend) trend.classList.add('hidden');
    }

    function renderHero(data) {
        const s = data.summary || {};
        const c = data.compare || {};
        const tone = heroTone(s.net_profit);

        const hero = document.getElementById('madsHero');
        hero.className = `mads-hero mads-hero--${tone} fade-up`;

        const badge = document.getElementById('madsHeroBadge');
        const badgeMap = { profit: ['Đang lãi', 'bg-emerald-100 text-emerald-700'], loss: ['Đang lỗ', 'bg-red-100 text-red-700'], flat: ['Hòa vốn', 'bg-slate-100 text-slate-500'] };
        const [lbl, cls] = badgeMap[tone];
        badge.textContent = lbl;
        badge.className = `rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${cls}`;

        const valEl = document.getElementById('madsHeroValue');
        valEl.textContent = fmt(s.net_profit);
        valEl.className = `mads-hero-val mt-1.5 ${netClass(s.net_profit)}`;

        document.getElementById('madsHeroCmp').innerHTML = fmtCmp(c.net_profit_pct, false) || PERIOD_LABELS[data.period] || '';

        const grossMargin = s.gross_margin_pct != null
            ? s.gross_margin_pct
            : (s.fb_revenue > 0 ? (s.fb_gross_profit / s.fb_revenue) * 100 : null);
        const netMargin = s.net_margin_pct != null
            ? s.net_margin_pct
            : (s.fb_revenue > 0 ? (s.net_profit / s.fb_revenue) * 100 : null);

        document.getElementById('madsHeroFormula').innerHTML = `
            LN gộp <strong class="text-slate-700">${fmtShort(s.fb_gross_profit)}</strong>
            − QC <strong class="text-slate-700">${fmtShort(s.ad_spend)}</strong><br>
            <span class="text-slate-400">TS ${fmtPct(netMargin)} · ${fmtN(s.fb_orders)} đơn</span>`;
    }

    function renderSummary(data) {
        const s = data.summary || {};
        const c = data.compare || {};

        document.getElementById('madsPeriodRange').textContent =
            `${PERIOD_LABELS[data.period] || ''} · ${fmtDateLabel(data.start_date)} – ${fmtDateLabel(data.end_date)}`;

        document.getElementById('madsKpiSpend').textContent = fmt(s.ad_spend);
        document.getElementById('madsKpiSpendHint').textContent =
            `Mặc định ${fmt(data.default_ad_spend)}/ngày`;

        document.getElementById('madsKpiOrders').textContent = fmtN(s.fb_orders);
        const shareEl = document.getElementById('madsKpiOrdersShare');
        if (s.fb_order_share_pct != null && s.total_orders > 0) {
            shareEl.textContent = `${fmtPct(s.fb_order_share_pct)} tổng đơn`;
        } else {
            shareEl.innerHTML = fmtCmp(c.fb_orders_pct, false);
        }

        document.getElementById('madsKpiRevenue').textContent = fmt(s.fb_revenue);
        const rpo = s.revenue_per_order != null
            ? s.revenue_per_order
            : (s.fb_orders > 0 ? s.fb_revenue / s.fb_orders : null);
        const revCmp = fmtCmp(c.fb_revenue_pct, false);
        const revPerEl = document.getElementById('madsKpiRevenuePer');
        if (rpo != null && revCmp) {
            revPerEl.innerHTML = `${fmt(rpo)}/đơn · ${revCmp}`;
        } else if (rpo != null) {
            revPerEl.textContent = `${fmt(rpo)}/đơn`;
        } else {
            revPerEl.innerHTML = revCmp || '—';
        }

        const roasEl = document.getElementById('madsKpiRoas');
        roasEl.textContent = fmtRoas(s.roas);
        roasEl.className = `mads-kpi-val mt-1 text-base font-bold ${roasClass(s.roas, s.break_even_roas)}`;
        const roasHint = document.getElementById('madsKpiRoasHint');
        if (s.break_even_roas != null) {
            roasHint.textContent = `Hòa vốn ≥ ${s.break_even_roas.toFixed(1)}× · mục tiêu 3×`;
        } else {
            roasHint.textContent = 'Mục tiêu ≥ 3×';
        }

        document.getElementById('madsKpiCpa').textContent = s.cpa != null ? fmt(s.cpa) : '—';
        document.getElementById('madsKpiCpaCmp').innerHTML = s.cpa != null ? fmtCmp(c.cpa_pct, true) : '';

        const ppo = s.net_profit_per_order != null
            ? s.net_profit_per_order
            : (s.fb_orders > 0 ? s.net_profit / s.fb_orders : null);
        const ppoEl = document.getElementById('madsKpiPpo');
        ppoEl.textContent = ppo != null ? fmt(ppo) : '—';
        ppoEl.className = `mads-kpi-val mt-1 text-base font-bold ${netClass(ppo)}`;

        const grossMargin = s.gross_margin_pct != null
            ? s.gross_margin_pct
            : (s.fb_revenue > 0 ? (s.fb_gross_profit / s.fb_revenue) * 100 : null);
        const netMargin = s.net_margin_pct != null
            ? s.net_margin_pct
            : (s.fb_revenue > 0 ? (s.net_profit / s.fb_revenue) * 100 : null);
        document.getElementById('madsKpiMargin').textContent =
            `TS gộp ${fmtPct(grossMargin)} · TS thực ${fmtPct(netMargin)}`;

        renderHero(data);
    }

    function renderTrend(data) {
        const section = document.getElementById('madsTrendSection');
        const chart = document.getElementById('madsTrendChart');
        const insightsEl = document.getElementById('madsTrendInsights');
        if (!section || !chart) return;

        const show = (data.period === '7d' || data.period === 'month') && (data.days || []).length > 1;
        if (!show) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        const days = [...(data.days || [])].reverse();
        const ins = data.period_insights || {};
        if (insightsEl && ins.total_days > 1) {
            insightsEl.textContent = `${ins.profitable_days}/${ins.total_days} ngày lãi`;
        }

        const maxAbs = Math.max(...days.map((d) => Math.abs(d.net_profit || 0)), 1);
        chart.innerHTML = days.map((d) => {
            const np = d.net_profit || 0;
            const h = Math.max(6, (Math.abs(np) / maxAbs) * 100);
            const barCls = np >= 0 ? 'mads-trend-profit' : 'mads-trend-loss';
            return `
            <div class="flex flex-1 flex-col items-center justify-end gap-0.5 min-w-0">
                <span class="text-[9px] font-semibold tabular-nums ${netClass(np)}">${np >= 0 ? '+' : ''}${fmtShort(np)}</span>
                <div class="mads-trend-bar ${barCls} w-full max-w-[1.75rem]" style="height:${h}%"></div>
                <span class="text-[9px] text-slate-400">${fmtDateShort(d.date)}</span>
            </div>`;
        }).join('');
    }

    function spendBadge(source) {
        if (source === 'snapshot') {
            return '<span class="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">Đã lưu</span>';
        }
        if (source === 'live') {
            return '<span class="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">Hôm nay</span>';
        }
        return '';
    }

    function renderDayList(data) {
        const list = document.getElementById('madsDayList');
        const countEl = document.getElementById('madsDayCount');
        const days = (data.days || []).slice(0, 10);
        const s = data.summary || {};
        const beRoas = s.break_even_roas;

        if (countEl) {
            countEl.textContent = days.length ? `${days.length} ngày` : '';
        }

        if (!days.length) {
            list.innerHTML = `<div class="mads-day-card px-4 py-8 text-center text-sm text-slate-400">Không có dữ liệu</div>`;
            return;
        }

        list.innerHTML = days.map((row) => {
            const ppo = row.net_profit_per_order != null
                ? row.net_profit_per_order
                : (row.fb_orders > 0 ? row.net_profit / row.fb_orders : null);
            const editBtn = `
                <button type="button" class="edit-spend-btn flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 active:bg-indigo-50 active:text-indigo-600"
                    data-date="${row.date}" data-amount="${row.ad_spend}" aria-label="Sửa chi QC">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>`;

            return `
            <article class="mads-day-card">
                <div class="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-sm font-bold text-slate-800">${fmtDateLabel(row.date)}</span>
                        ${spendBadge(row.ad_spend_source)}
                    </div>
                    ${editBtn}
                </div>
                <div class="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p class="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">Chi QC</p>
                        <p class="text-xs font-bold text-violet-700 tabular-nums mt-0.5">${fmt(row.ad_spend)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">Đơn</p>
                        <p class="text-xs font-bold text-slate-800 tabular-nums mt-0.5">${fmtN(row.fb_orders)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">LN thực</p>
                        <p class="text-xs font-bold tabular-nums mt-0.5 ${netClass(row.net_profit)}">${fmt(row.net_profit)}</p>
                    </div>
                </div>
                <div class="px-4 pb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-slate-50 pt-2.5 mx-4">
                    <span>DT <strong class="text-slate-700">${fmt(row.fb_revenue)}</strong></span>
                    <span>ROAS <strong class="${roasClass(row.roas, beRoas)}">${fmtRoas(row.roas)}</strong></span>
                    <span>CPA <strong class="text-slate-700">${row.cpa != null ? fmt(row.cpa) : '—'}</strong></span>
                    ${ppo != null ? `<span>LN/đơn <strong class="${netClass(ppo)}">${fmt(ppo)}</strong></span>` : ''}
                </div>
            </article>`;
        }).join('');

        list.querySelectorAll('.edit-spend-btn').forEach((btn) => {
            btn.addEventListener('click', () => openEditSheet(btn.dataset.date, Number(btn.dataset.amount)));
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
            const [mainRes, recentRes] = await Promise.all([
                fetch(`${CONFIG.API_URL}?action=getAdAnalytics&period=${encodeURIComponent(period)}&timestamp=${ts}`),
                fetch(`${CONFIG.API_URL}?action=getAdAnalytics&period=10d&timestamp=${ts}`)
            ]);
            const data = await mainRes.json();
            const recentData = await recentRes.json();
            if (!data.success) throw new Error(data.error || 'Không tải được dữ liệu');
            renderSummary(data);
            renderTrend(data);
            renderDayList(recentData.success ? recentData : data);
        } catch (e) {
            console.error('[m-ads]', e);
            if (typeof showToast === 'function') showToast(e.message || 'Lỗi tải dữ liệu', 'error');
            document.getElementById('madsDayList').innerHTML =
                `<div class="mads-day-card px-4 py-8 text-center text-sm text-red-500">Không tải được dữ liệu</div>`;
        } finally {
            loading = false;
        }
    }

    function openEditSheet(date, amount) {
        editDate = date;
        document.getElementById('madsEditDate').textContent = fmtDateLabel(date);
        document.getElementById('madsEditAmount').value = amount || 0;
        const sheet = document.getElementById('madsEditSheet');
        sheet.classList.remove('hidden');
        sheet.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('madsEditAmount').focus(), 100);
    }

    function closeEditSheet() {
        editDate = null;
        const sheet = document.getElementById('madsEditSheet');
        sheet.classList.add('hidden');
        sheet.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    async function saveEditSpend() {
        const amount = Number(document.getElementById('madsEditAmount').value);
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
            closeEditSheet();
            load(activePeriod);
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message || 'Lưu thất bại', 'error');
        }
    }

    document.querySelectorAll('#madsPeriodTabs [data-period]').forEach((btn) => {
        btn.addEventListener('click', () => load(btn.dataset.period));
    });

    document.getElementById('madsEditCancel')?.addEventListener('click', closeEditSheet);
    document.getElementById('madsEditBackdrop')?.addEventListener('click', closeEditSheet);
    document.getElementById('madsEditSave')?.addEventListener('click', saveEditSpend);

    document.addEventListener('DOMContentLoaded', () => load('today'));
})();
