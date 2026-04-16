/**
 * Quick Stats Modal — orders/index.html
 * Dữ liệu: getDetailedAnalytics (hôm nay / hôm qua)
 * Cache 5 phút / period
 */
(function () {
    const TTL = 5 * 60 * 1000;
    const cache = { today: null, yesterday: null }; // { data, ts }

    let activePeriod = 'today';
    let loading = false;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function vnTodayStr() {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    }

    function buildUrl(period) {
        const base = `${CONFIG.API_URL}?action=getDetailedAnalytics`;
        const ts   = `&timestamp=${Date.now()}`;
        if (period === 'today') {
            const start = new Date(vnTodayStr() + 'T00:00:00+07:00').toISOString();
            return `${base}&period=today&startDate=${start}${ts}`;
        }
        // yesterday
        const todayMs   = new Date(vnTodayStr() + 'T00:00:00+07:00').getTime();
        const yStart    = new Date(todayMs - 86400000).toISOString();
        const yEnd      = new Date(todayMs - 1).toISOString();
        return `${base}&period=all&startDate=${yStart}&endDate=${yEnd}${ts}`;
    }

    function fmt(n) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
    }
    function fmtN(n) {
        return new Intl.NumberFormat('vi-VN').format(n || 0);
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────
    async function fetchStats(period) {
        const now = Date.now();
        const hit = cache[period];
        if (hit && now - hit.ts < TTL) return hit.data;

        const res  = await fetch(buildUrl(period));
        const data = await res.json();
        if (data.success) cache[period] = { data, ts: Date.now() };
        return data;
    }

    // ── Skeleton ──────────────────────────────────────────────────────────────
    // id → [width, height] cho skeleton placeholder
    const SKELETON_SIZES = {
        qsRevenue:  ['w-28', 'h-7'],
        qsCost:     ['w-20', 'h-5'],
        qsProfit:   ['w-20', 'h-5'],
        qsMargin:   ['w-12', 'h-5'],
        qsOrders:   ['w-10', 'h-5'],
        qsProducts: ['w-16', 'h-5'],
    };

    function showSkeleton() {
        Object.entries(SKELETON_SIZES).forEach(([id, [w, h]]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = '';
            el.className = `skeleton ${w} ${h} rounded-md mt-0.5`;
        });
        loading = true;
    }

    function hideSkeleton() {
        Object.keys(SKELETON_SIZES).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.className = 'qs-val';
        });
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function renderStats(o) {
        hideSkeleton();
        if (!o) return;
        const profit = o.total_profit || 0;
        const margin = o.profit_margin || 0;

        // Giá trị trung tính — slate
        setText('qsRevenue',  fmt(o.total_revenue),           'text-xl font-bold text-slate-800');
        setText('qsCost',     fmt(o.total_cost),              'text-base font-bold text-slate-700');
        setText('qsOrders',   fmtN(o.total_orders),          'text-base font-bold text-slate-800');
        setText('qsProducts', fmtN(o.total_products_sold),   'text-base font-bold text-slate-800');

        // Lợi nhuận — màu ngữ nghĩa (xanh / đỏ)
        setText('qsProfit', fmt(profit),
            `text-base font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`);

        // Tỷ suất — màu ngữ nghĩa theo ngưỡng
        setText('qsMargin', `${margin.toFixed(1)}%`,
            `text-base font-bold ${margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-500' : 'text-red-500'}`);
    }

    function setText(id, val, cls = '') {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = val;
        if (cls) el.className = cls;
    }

    async function load(period) {
        if (loading) return;
        showSkeleton();
        try {
            const data = await fetchStats(period);
            if (data.success) renderStats(data.overview);
            else hideSkeleton();
        } catch (e) {
            console.error('[QuickStats]', e);
            hideSkeleton();
        } finally {
            loading = false;
        }
    }

    // ── Tab switch ────────────────────────────────────────────────────────────
    function setTab(period) {
        ['today', 'yesterday'].forEach(p => {
            const btn = document.getElementById(`qsTab_${p}`);
            if (!btn) return;
            const active = p === period;
            btn.className = active
                ? 'flex-1 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-sm transition-all'
                : 'flex-1 py-1.5 text-sm font-medium rounded-lg text-slate-500 hover:bg-slate-200 transition-all';
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    window.showQuickStatsModal = function () {
        const modal = document.getElementById('quickStatsModal');
        if (!modal) return;
        activePeriod = 'today';
        setTab('today');
        modal.classList.remove('hidden');
        load('today');
    };

    window.closeQuickStatsModal = function () {
        const modal = document.getElementById('quickStatsModal');
        if (modal) modal.classList.add('hidden');
    };

    window.switchQuickPeriod = function (period) {
        if (period === activePeriod || loading) return;
        activePeriod = period;
        setTab(period);
        load(period);
    };
})();
