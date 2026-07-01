/**

 * Quick Stats Modal — orders/index.html

 * API: getProfitOverview (overview + customer_sources)

 * Cache 5 phút / period + prefetch idle khi load trang.

 */

(function () {

    const TTL = 5 * 60 * 1000;

    const cache = { today: null, yesterday: null };



    let activePeriod = 'today';

    let loading = false;

    let inflight = { today: null, yesterday: null };



    const SOURCE_BADGE = {

        facebook: { cls: 'qs-src-badge--fb', text: 'FB' },

        zalo: { cls: 'qs-src-badge--zalo', text: 'Z' },

        tiktok: { cls: 'qs-src-badge--tiktok', text: 'TT' },

        unknown: { cls: 'qs-src-badge--unknown', text: '?' }

    };



    function vnTodayStr() {

        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    }



    function buildUrl(period) {

        const base = `${CONFIG.API_URL}?action=getProfitOverview`;

        const ts = `&timestamp=${Date.now()}`;

        if (period === 'today') {

            const start = new Date(vnTodayStr() + 'T00:00:00+07:00').toISOString();

            return `${base}&period=today&startDate=${encodeURIComponent(start)}${ts}`;

        }

        const todayMs = new Date(vnTodayStr() + 'T00:00:00+07:00').getTime();

        const yStart = new Date(todayMs - 86400000).toISOString();

        const yEnd = new Date(todayMs - 1).toISOString();

        return `${base}&period=all&startDate=${encodeURIComponent(yStart)}&endDate=${encodeURIComponent(yEnd)}${ts}`;

    }



    function fmt(n) {

        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

    }

    function fmtN(n) {

        return new Intl.NumberFormat('vi-VN').format(n || 0);

    }

    function fmtPct(n) {

        return `${(n || 0).toFixed(1)}%`;

    }



    function getCached(period) {

        const hit = cache[period];

        if (hit && Date.now() - hit.ts < TTL) return hit.data;

        return null;

    }



    async function fetchDefaultAdSpend() {

        try {

            const res = await fetch(`${CONFIG.API_URL}?action=getDefaultAdSpend&timestamp=${Date.now()}`);

            const data = await res.json();

            return data.success ? (data.amount || 0) : 0;

        } catch (e) {

            console.warn('[QuickStats] getDefaultAdSpend failed', e);

            return 0;

        }

    }



    async function enrichAdSpendFields(data) {

        if (!data?.success || !data.overview) return data;

        const o = data.overview;

        if (o.ad_spend != null && o.net_profit != null) return data;



        const profit = o.total_profit || 0;

        const adSpend = await fetchDefaultAdSpend();

        o.ad_spend = adSpend;

        o.net_profit = profit - adSpend;

        o.net_profit_per_order = o.total_orders > 0 ? o.net_profit / o.total_orders : 0;

        return data;

    }



    async function fetchStats(period) {

        const cached = getCached(period);

        if (cached) return cached;



        if (inflight[period]) return inflight[period];



        inflight[period] = fetch(buildUrl(period))

            .then((res) => res.json())

            .then((data) => enrichAdSpendFields(data))

            .then((data) => {

                if (data.success) cache[period] = { data, ts: Date.now() };

                return data;

            })

            .finally(() => {

                inflight[period] = null;

            });



        return inflight[period];

    }



    const SKELETON_IDS = [

        'qsRevenue', 'qsNetProfit', 'qsAdSpend', 'qsAvgProfitPerOrder',

        'qsOrders', 'qsProducts', 'qsMargin', 'qsCost', 'qsProfit'

    ];



    function showSkeleton() {

        SKELETON_IDS.forEach((id) => {

            const el = document.getElementById(id);

            if (!el) return;

            el.textContent = '';

            el.className = 'qs-skel';

        });

        const srcEl = document.getElementById('qsCustomerSources');

        if (srcEl) srcEl.innerHTML = '<div class="qs-skel" style="width:100%;height:4.5rem;border-radius:0.625rem"></div>';

        const chEl = document.getElementById('qsRevenueChange');

        if (chEl) chEl.innerHTML = '<span class="qs-skel" style="width:3.5rem;height:1.75rem"></span>';

    }



    function hideSkeleton() {

        const restore = {

            qsRevenue: 'qs-val qs-hero-num',

            qsNetProfit: 'qs-val qs-hero-num qs-hero-num--accent',

            qsOrders: 'qs-val',

            qsProducts: 'qs-val',

            qsMargin: 'qs-val',

            qsCost: 'qs-val',

            qsProfit: 'qs-val'

        };

        Object.entries(restore).forEach(([id, cls]) => {

            const el = document.getElementById(id);

            if (el) el.className = cls;

        });

    }



    function renderCustomerSources(sources) {

        const container = document.getElementById('qsCustomerSources');

        if (!container) return;



        if (!Array.isArray(sources) || sources.length === 0) {

            container.innerHTML = '<p class="qs-src-empty">Chưa có đơn trong kỳ này</p>';

            return;

        }



        container.innerHTML = sources.map((s) => {

            const srcKey = s.source || 'unknown';

            const badge = SOURCE_BADGE[srcKey] || SOURCE_BADGE.unknown;

            const share = s.revenue_share || 0;

            const rowCls = ['facebook', 'zalo', 'tiktok'].includes(srcKey) ? srcKey : 'unknown';



            return `<div class="qs-src-row qs-src-row--${rowCls}">

                <div class="qs-src-badge ${badge.cls}">${badge.text}</div>

                <div class="qs-src-info">

                    <div class="qs-src-top">

                        <span class="qs-src-name">${s.label}</span>

                        <span class="qs-src-amt">${fmt(s.revenue)}</span>

                    </div>

                    <div class="qs-src-track" aria-hidden="true">

                        <div class="qs-src-fill" style="width:${Math.max(share, 4).toFixed(1)}%"></div>

                    </div>

                    <div class="qs-src-bottom">

                        <span class="qs-src-meta">${fmtN(s.order_count)} đơn</span>

                        <span class="qs-src-pct">${fmtPct(share)} doanh thu</span>

                    </div>

                </div>

            </div>`;

        }).join('');

    }



    function renderRevenueChange(o) {

        const el = document.getElementById('qsRevenueChange');

        if (!el) return;

        const pct = o.revenue_vs_prev_day_pct;

        const cmpLabel = activePeriod === 'yesterday' ? 'vs hôm kia' : 'vs hôm qua';

        if (pct == null) {

            el.innerHTML = `<span class="qs-change-pill qs-change-pill--flat">— vs ${cmpLabel.replace('vs ', '')}</span>`;

            return;

        }

        const abs = Math.abs(pct).toFixed(1);

        let cls = 'qs-change-pill--flat';

        let sign = '';

        if (pct > 0.05) { cls = 'qs-change-pill--up'; sign = '+'; }

        else if (pct < -0.05) { cls = 'qs-change-pill--down'; sign = '−'; }

        const lbl = cmpLabel.replace('vs ', '');

        el.innerHTML = `<span class="qs-change-pill ${cls}">${sign}${abs}% vs ${lbl}</span>`;

    }



    function renderStats(data) {

        hideSkeleton();

        const o = data?.overview;

        if (!o) return;



        const profit = o.total_profit || 0;

        const margin = o.profit_margin || 0;

        const adSpend = o.ad_spend || 0;

        const netProfit = o.net_profit != null ? o.net_profit : (profit - adSpend);

        const totalOrders = o.total_orders || 0;

        const avgNetPerOrder = o.net_profit_per_order != null

            ? o.net_profit_per_order

            : (totalOrders > 0 ? netProfit / totalOrders : null);



        setVal('qsRevenue', fmt(o.total_revenue));

        renderRevenueChange(o);

        setVal('qsOrders', fmtN(totalOrders));

        setVal('qsProducts', fmtN(o.total_products_sold));

        setVal('qsMargin', `${margin.toFixed(1)}%`, margin >= 30 ? 'is-pos' : '');

        setVal('qsCost', fmt(o.total_cost));

        setVal('qsProfit', fmt(profit), profit >= 0 ? 'is-pos' : 'is-neg');

        const netEl = document.getElementById('qsNetProfit');

        if (netEl) {

            netEl.textContent = fmt(netProfit);

            netEl.className = 'qs-val qs-hero-num qs-hero-num--accent' + (netProfit < 0 ? ' is-negative' : '');

        }

        const adEl = document.getElementById('qsAdSpend');

        if (adEl) {

            adEl.textContent = fmt(adSpend);

            adEl.removeAttribute('class');

        }

        const avgEl = document.getElementById('qsAvgProfitPerOrder');

        if (avgEl) {

            avgEl.textContent = avgNetPerOrder == null ? '—' : fmt(avgNetPerOrder);

            avgEl.removeAttribute('class');

        }



        renderCustomerSources(data.customer_sources);

    }



    function setVal(id, val, tone = '') {

        const el = document.getElementById(id);

        if (!el) return;

        el.textContent = val;

        if (id === 'qsRevenue') {

            el.className = 'qs-val qs-hero-num';

            return;

        }

        if (id === 'qsNetProfit') return;

        const base = 'qs-val';

        el.className = tone ? `${base} ${tone}` : base;

    }



    async function load(period) {

        const cached = getCached(period);

        if (cached?.success) {

            renderStats(cached);

            return;

        }



        if (loading) return;

        showSkeleton();

        loading = true;

        try {

            const data = await fetchStats(period);

            if (data.success && activePeriod === period) renderStats(data);

            else if (!data.success) hideSkeleton();

        } catch (e) {

            console.error('[QuickStats]', e);

            hideSkeleton();

        } finally {

            loading = false;

        }

    }



    function setTab(period) {

        ['today', 'yesterday'].forEach((p) => {

            const btn = document.getElementById(`qsTab_${p}`);

            if (!btn) return;

            const active = p === period;

            btn.className = active ? 'qs-tab qs-tab--active' : 'qs-tab';

        });

    }



    function prefetchPeriod(period) {

        if (getCached(period) || inflight[period]) return;

        void fetchStats(period);

    }



    function schedulePrefetch() {

        const run = () => {

            prefetchPeriod('today');

            setTimeout(() => prefetchPeriod('yesterday'), 800);

        };

        if (typeof requestIdleCallback === 'function') {

            requestIdleCallback(run, { timeout: 3500 });

        } else {

            setTimeout(run, 1500);

        }

    }



    window.showQuickStatsModal = function () {

        const modal = document.getElementById('quickStatsModal');

        if (!modal) return;

        activePeriod = 'today';

        setTab('today');

        modal.classList.remove('hidden');



        const cached = getCached('today');

        if (cached?.success) {

            renderStats(cached);

            return;

        }

        load('today');

    };



    window.closeQuickStatsModal = function () {

        const modal = document.getElementById('quickStatsModal');

        if (modal) modal.classList.add('hidden');

    };



    window.switchQuickPeriod = function (period) {

        if (period === activePeriod) return;

        activePeriod = period;

        setTab(period);



        const cached = getCached(period);

        if (cached?.success) {

            renderStats(cached);

            return;

        }

        load(period);

    };



    schedulePrefetch();



    const qsBtn = document.querySelector('[onclick="showQuickStatsModal()"]');

    if (qsBtn) {

        qsBtn.addEventListener('mouseenter', () => prefetchPeriod('today'), { passive: true });

    }

})();


