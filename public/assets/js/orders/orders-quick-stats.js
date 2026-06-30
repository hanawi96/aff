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



    const SOURCE_DOT = {

        facebook: 'bg-blue-500',

        zalo: 'bg-green-500',

        tiktok: 'bg-slate-800',

        unknown: 'bg-gray-400'

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



    async function fetchStats(period) {

        const cached = getCached(period);

        if (cached) return cached;



        if (inflight[period]) return inflight[period];



        inflight[period] = fetch(buildUrl(period))

            .then((res) => res.json())

            .then((data) => {

                if (data.success) cache[period] = { data, ts: Date.now() };

                return data;

            })

            .finally(() => {

                inflight[period] = null;

            });



        return inflight[period];

    }



    const SKELETON_SIZES = {

        qsRevenue: ['w-40', 'h-8'],

        qsCost: ['w-20', 'h-5'],

        qsProfit: ['w-20', 'h-5'],

        qsMargin: ['w-12', 'h-5'],

        qsOrders: ['w-10', 'h-5'],

        qsProducts: ['w-16', 'h-5']

    };



    function showSkeleton() {

        Object.entries(SKELETON_SIZES).forEach(([id, [w, h]]) => {

            const el = document.getElementById(id);

            if (!el) return;

            el.textContent = '';

            el.className = `skeleton ${w} ${h} rounded-md mt-0.5`;

        });

        const srcEl = document.getElementById('qsCustomerSources');

        if (srcEl) {

            srcEl.innerHTML = '<div class="skeleton w-full h-16 rounded-lg"></div><div class="skeleton w-full h-16 rounded-lg"></div>';

        }

        const chEl = document.getElementById('qsRevenueChange');

        if (chEl) chEl.innerHTML = '<div class="skeleton w-14 h-10 rounded-lg ml-auto"></div>';

    }



    function hideSkeleton() {

        Object.keys(SKELETON_SIZES).forEach((id) => {

            const el = document.getElementById(id);

            if (!el) return;

            el.className = 'qs-val';

        });

    }



    function renderCustomerSources(sources) {

        const container = document.getElementById('qsCustomerSources');

        if (!container) return;



        if (!Array.isArray(sources) || sources.length === 0) {

            container.innerHTML = '<p class="text-xs text-slate-400 italic py-2 text-center">Chưa có đơn trong kỳ này</p>';

            return;

        }



        container.innerHTML = sources.map((s) => {

            const dot = SOURCE_DOT[s.source] || SOURCE_DOT.unknown;

            const profit = s.profit || 0;

            const profitCls = profit >= 0 ? 'text-emerald-600' : 'text-red-500';

            const barW = Math.max(4, Math.min(100, s.revenue_share || 0));



            return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">

                <div class="flex items-center justify-between gap-2 mb-1.5">

                    <div class="flex items-center gap-1.5 min-w-0">

                        <span class="w-2 h-2 rounded-full shrink-0 ${dot}"></span>

                        <span class="text-xs font-semibold text-slate-800 truncate">${s.label}</span>

                    </div>

                    <span class="text-[10px] font-medium text-slate-500 shrink-0">${fmtN(s.order_count)} đơn · ${fmtPct(s.revenue_share)}</span>

                </div>

                <div class="h-1 rounded-full bg-slate-200 overflow-hidden mb-1.5" title="Tỷ trọng doanh thu">

                    <div class="h-full rounded-full ${dot}" style="width:${barW}%"></div>

                </div>

                <div class="flex items-center justify-between gap-2 text-[11px]">

                    <span class="font-bold text-slate-800">${fmt(s.revenue)}</span>

                    <span class="font-semibold ${profitCls}">LN ${fmt(profit)}</span>

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

            el.innerHTML = `<span class="text-[10px] font-medium text-slate-400 leading-none">${cmpLabel}</span><span class="text-xs font-semibold text-slate-400 mt-1">—</span>`;

            return;

        }

        const abs = Math.abs(pct).toFixed(1);

        const sub = `<span class="text-[10px] font-medium text-slate-400 leading-none">${cmpLabel}</span>`;

        if (pct > 0.05) {

            el.innerHTML = `${sub}<span class="inline-flex items-center gap-0.5 mt-1 text-sm font-bold text-emerald-600 leading-none"><svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>+${abs}%</span>`;

        } else if (pct < -0.05) {

            el.innerHTML = `${sub}<span class="inline-flex items-center gap-0.5 mt-1 text-sm font-bold text-red-500 leading-none"><svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>-${abs}%</span>`;

        } else {

            el.innerHTML = `${sub}<span class="inline-flex items-center gap-0.5 mt-1 text-sm font-bold text-slate-500 leading-none">0%</span>`;

        }

    }



    function renderStats(data) {

        hideSkeleton();

        const o = data?.overview;

        if (!o) return;



        const profit = o.total_profit || 0;

        const margin = o.profit_margin || 0;



        setText('qsRevenue', fmt(o.total_revenue), 'text-xl sm:text-2xl font-extrabold text-indigo-800 tracking-tight leading-tight');

        renderRevenueChange(o);

        setText('qsCost', fmt(o.total_cost), 'text-sm sm:text-base font-bold text-slate-700');

        setText('qsOrders', fmtN(o.total_orders), 'text-sm sm:text-base font-bold text-slate-800');

        setText('qsProducts', fmtN(o.total_products_sold), 'text-sm sm:text-base font-bold text-slate-800');

        setText('qsProfit', fmt(profit),

            `text-sm sm:text-base font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`);

        setText('qsMargin', `${margin.toFixed(1)}%`,

            `text-sm sm:text-base font-bold ${margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-500' : 'text-red-500'}`);



        renderCustomerSources(data.customer_sources);

    }



    function setText(id, val, cls = '') {

        const el = document.getElementById(id);

        if (!el) return;

        el.textContent = val;

        el.className = cls ? `qs-val ${cls}` : 'qs-val';

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

            btn.className = active

                ? 'flex-1 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-sm transition-all'

                : 'flex-1 py-1.5 text-sm font-medium rounded-lg text-slate-500 hover:bg-slate-200 transition-all';

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


