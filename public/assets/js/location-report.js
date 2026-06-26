// Location Analytics Dashboard - Smart & Optimized with AI Insights
let currentPeriod = 'all';
/** @type {{ startDate: string, endDate: string } | null} */
let customDateRange = null;
let allLocationData = [];
let previousPeriodData = [];
let currentSort = { column: 'revenue', direction: 'desc' };
const LOCATION_TABLE_PAGE_SIZE = 20;
let locationTablePage = 1;
let locationTableTotalPages = 1;
let locationTableFilterTimer = null;
let topChart = null;
let pieChart = null;

const dataCache = {
    today: { province: null, previous: null },
    week: { province: null, previous: null },
    month: { province: null, previous: null },
    quarter: { province: null, previous: null },
    'half-year': { province: null, previous: null },
    year: { province: null, previous: null },
    all: { province: null, previous: null },
    custom: { rangeKey: '', province: null, previous: null }
};

function getCustomRangeKey() {
    if (currentPeriod !== 'custom' || !customDateRange) return '';
    return customDateRange.startDate + '_' + customDateRange.endDate;
}

function syncCustomCacheKey() {
    if (currentPeriod !== 'custom' || !customDateRange) return;
    const k = getCustomRangeKey();
    if (dataCache.custom.rangeKey !== k) {
        dataCache.custom.rangeKey = k;
        dataCache.custom.province = null;
        dataCache.custom.previous = null;
    }
}

function getCacheBucket() {
    if (currentPeriod === 'custom' && customDateRange) {
        syncCustomCacheKey();
        return dataCache.custom;
    }
    return dataCache[currentPeriod] || dataCache.all;
}

function clearLocationCustomDateInputs() {
    const hS = document.getElementById('customDateStartLocation');
    const hE = document.getElementById('customDateEndLocation');
    const label = document.getElementById('customDateLabelLocation');
    if (hS) hS.value = '';
    if (hE) hE.value = '';
    if (label) label.textContent = 'Chọn ngày';
}

// Analytics engine
const AnalyticsEngine = {
    calculateGrowth(current, previous) {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    },

    detectAnomalies(data, metric = 'revenue') {
        if (data.length < 3) return [];
        const values = data.map(d => d[metric] || 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);
        return data.filter(d => {
            const value = d[metric] || 0;
            return Math.abs(value - avg) > stdDev * 2;
        }).map(d => ({ ...d, deviation: ((d[metric] - avg) / avg * 100).toFixed(1) }));
    },

    findConcentration(data, metric = 'revenue') {
        const sorted = [...data].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
        const total = data.reduce((sum, d) => sum + (d[metric] || 0), 0);
        let cumulative = 0;
        let count = 0;
        for (const item of sorted) {
            cumulative += item[metric] || 0;
            count++;
            if (cumulative / total >= 0.8) break;
        }
        return { count, percentage: (cumulative / total * 100).toFixed(1) };
    },

    generateInsights(currentData, previousData) {
        const insights = [];
        if (currentData.length === 0) return insights;

        const currentTotal = {
            revenue: currentData.reduce((s, d) => s + (d.revenue || 0), 0),
            orders: currentData.reduce((s, d) => s + (d.orders || 0), 0),
            customers: currentData.reduce((s, d) => s + (d.customers || 0), 0)
        };

        if (previousData && previousData.length > 0) {
            const previousTotal = {
                revenue: previousData.reduce((s, d) => s + (d.revenue || 0), 0),
                orders: previousData.reduce((s, d) => s + (d.orders || 0), 0)
            };
            const revenueGrowth = this.calculateGrowth(currentTotal.revenue, previousTotal.revenue);
            if (Math.abs(revenueGrowth) > 5) {
                const trend = revenueGrowth > 0 ? 'tăng' : 'giảm';
                const icon = revenueGrowth > 0 ? '📈' : '📉';
                insights.push(`${icon} Doanh thu ${trend} <strong>${Math.abs(revenueGrowth).toFixed(1)}%</strong> so với kỳ trước`);
            }
            const ordersGrowth = this.calculateGrowth(currentTotal.orders, previousTotal.orders);
            if (Math.abs(ordersGrowth) > 10) {
                const trend = ordersGrowth > 0 ? 'tăng' : 'giảm';
                insights.push(`📦 Số đơn hàng ${trend} <strong>${Math.abs(ordersGrowth).toFixed(1)}%</strong>`);
            }
        }

        const concentration = this.findConcentration(currentData, 'revenue');
        if (concentration.count <= 5 && currentData.length > 10) {
            insights.push(`🎯 TOP ${concentration.count} khu vực chiếm <strong>${concentration.percentage}%</strong> tổng doanh thu`);
        }

        const topLocation = [...currentData].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
        if (topLocation) {
            const topPercent = (topLocation.revenue / currentTotal.revenue * 100).toFixed(1);
            if (topPercent > 20) {
                insights.push(`👑 <strong>${topLocation.name}</strong> dẫn đầu với ${topPercent}% tổng doanh thu`);
            }
        }

        const avgOrderValue = currentTotal.orders > 0 ? currentTotal.revenue / currentTotal.orders : 0;
        const highValueLocations = currentData.filter(d => (d.avgValue || 0) > avgOrderValue * 1.5);
        if (highValueLocations.length > 0 && highValueLocations.length < currentData.length * 0.3) {
            insights.push(`💎 ${highValueLocations.length} khu vực có giá trị đơn hàng cao gấp 1.5x trung bình`);
        }

        const anomalies = this.detectAnomalies(currentData, 'revenue');
        if (anomalies.length > 0 && anomalies.length < 5) {
            const topAnomaly = anomalies[0];
            insights.push(`⚡ <strong>${topAnomaly.name}</strong> có doanh thu ${topAnomaly.deviation > 0 ? 'cao' : 'thấp'} bất thường (${Math.abs(topAnomaly.deviation)}% so với TB)`);
        }

        const totalLocations = currentData.length;
        const activeLocations = currentData.filter(d => (d.orders || 0) > 0).length;
        const coverage = (activeLocations / totalLocations * 100).toFixed(1);
        if (coverage < 50) {
            insights.push(`📍 Chỉ ${coverage}% khu vực có đơn hàng - cơ hội mở rộng thị trường`);
        }

        return insights.slice(0, 5);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    loadFromURL();
    window.addEventListener('popstate', function(event) {
        if (event.state) {
            restoreState(event.state);
        } else {
            loadFromURL();
            loadLocationData();
        }
    });
    loadLocationData();
});

function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const period = params.get('period');
    const urlCustomStart = params.get('startDate');
    const urlCustomEnd = params.get('endDate');

    if (!period) {
        currentPeriod = 'all';
        customDateRange = null;
        clearLocationCustomDateInputs();
    } else if (period === 'custom') {
        if (urlCustomStart && urlCustomEnd) {
            currentPeriod = 'custom';
            customDateRange = { startDate: urlCustomStart, endDate: urlCustomEnd };
            const hS = document.getElementById('customDateStartLocation');
            const hE = document.getElementById('customDateEndLocation');
            if (hS) hS.value = urlCustomStart;
            if (hE) hE.value = urlCustomEnd;
            updateCustomDateLabelLocation(urlCustomStart, urlCustomEnd);
        } else {
            currentPeriod = 'all';
            customDateRange = null;
            clearLocationCustomDateInputs();
        }
    } else {
        currentPeriod = period;
        customDateRange = null;
        clearLocationCustomDateInputs();
    }

    updatePeriodButtons();

    // Hide breadcrumb if it exists
    const breadcrumbRoot = document.getElementById('breadcrumb');
    if (breadcrumbRoot) breadcrumbRoot.classList.add('hidden');
}

function updatePeriodButtons() {
    const container = document.querySelector('.period-filter-container');
    if (container) container.dataset.active = currentPeriod;
}

function updateURL() {
    const params = new URLSearchParams();
    params.set('period', currentPeriod);
    if (currentPeriod === 'custom' && customDateRange) {
        params.set('startDate', customDateRange.startDate);
        params.set('endDate', customDateRange.endDate);
    }
    const newURL = `${window.location.pathname}?${params.toString()}`;
    const state = {
        period: currentPeriod,
        customStart: currentPeriod === 'custom' && customDateRange ? customDateRange.startDate : null,
        customEnd: currentPeriod === 'custom' && customDateRange ? customDateRange.endDate : null
    };
    window.history.pushState(state, '', newURL);
}

function restoreState(state) {
    currentPeriod = state.period || 'all';
    if (currentPeriod === 'custom' && state.customStart && state.customEnd) {
        customDateRange = { startDate: state.customStart, endDate: state.customEnd };
        const hS = document.getElementById('customDateStartLocation');
        const hE = document.getElementById('customDateEndLocation');
        if (hS) hS.value = state.customStart;
        if (hE) hE.value = state.customEnd;
        updateCustomDateLabelLocation(state.customStart, state.customEnd);
    } else {
        customDateRange = null;
        clearLocationCustomDateInputs();
    }

    const bucket = getCacheBucket();
    bucket.province = null;
    bucket.previous = null;

    updatePeriodButtons();
    loadLocationData();
}

function changePeriod(period) {
    currentPeriod = period;
    if (period !== 'custom') customDateRange = null;
    updatePeriodButtons();
    updateURL();
    loadLocationData();
}

function refreshData() {
    const bucket = getCacheBucket();
    bucket.province = null;
    bucket.previous = null;
    showToast('Đang làm mới dữ liệu...', 'info');
    loadLocationData();
}

async function loadLocationData() {
    try {
        showSkeletonLoading();

        const cacheBucket = getCacheBucket();
        if (cacheBucket.province && cacheBucket.previous) {
            allLocationData = cacheBucket.province;
            previousPeriodData = cacheBucket.previous;
            renderLocationData();
            return;
        }

        const { startDate, rangeEndDate, previousStartDate, previousEndDate } = calculateDateRanges(currentPeriod);

        let startDateParam = startDate ? `&startDate=${startDate.toISOString()}` : '';
        let endDateParam = rangeEndDate ? `&endDate=${rangeEndDate.toISOString()}` : '';
        let previousParams = '';
        if (previousStartDate && previousEndDate) {
            previousParams = `&previousStartDate=${previousStartDate.toISOString()}&previousEndDate=${previousEndDate.toISOString()}`;
        }

        let apiUrl = `${CONFIG.API_URL}?action=getLocationStats&level=province&period=${currentPeriod}${startDateParam}${endDateParam}${previousParams}&timestamp=${Date.now()}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.success) {
            allLocationData = data.locations || [];
            previousPeriodData = data.previousLocations || [];
            window.uniqueCustomersCount = data.uniqueCustomers || 0;

            allLocationData = allLocationData.map(loc => {
                const prevLoc = previousPeriodData.find(p => p.id === loc.id);
                const growth = prevLoc ? AnalyticsEngine.calculateGrowth(loc.revenue, prevLoc.revenue) : 0;
                return { ...loc, growth };
            });

            const storeBucket = getCacheBucket();
            storeBucket.province = allLocationData;
            storeBucket.previous = previousPeriodData;

            renderLocationData();
        } else {
            throw new Error(data.error || 'Failed to load location data');
        }
    } catch (error) {
        console.error('Error loading location data:', error);
        showToast('Không thể tải dữ liệu', 'error');
        hideSkeletonLoading();
    }
}

function inclusiveCalendarDaysVN(startYmd, endYmd) {
    const s = new Date(startYmd + 'T00:00:00+07:00').getTime();
    const e = new Date(endYmd + 'T00:00:00+07:00').getTime();
    return Math.round((e - s) / 86400000) + 1;
}

function calculateDateRanges(period) {
    const now = new Date();
    let startDate = null;
    let rangeEndDate = null;
    let previousStartDate = null;
    let previousEndDate = null;

    if (period === 'custom' && customDateRange) {
        const s = customDateRange.startDate;
        const e = customDateRange.endDate;
        startDate = new Date(s + 'T00:00:00+07:00');
        rangeEndDate = new Date(e + 'T23:59:59.999+07:00');
        const nDays = Math.max(1, inclusiveCalendarDaysVN(s, e));
        previousEndDate = new Date(startDate.getTime());
        previousEndDate.setMilliseconds(previousEndDate.getMilliseconds() - 1);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - nDays);
    } else if (period === 'today') {
        startDate = getVNStartOfToday();
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    } else if (period === 'week') {
        startDate = getVNStartOfWeek();
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    } else if (period === 'month') {
        startDate = getVNStartOfMonth();
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 1);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    } else if (period === 'quarter') {
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        startDate = new Date(vnToday);
        startDate.setMonth(startDate.getMonth() - 3);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 3);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    } else if (period === 'half-year') {
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        startDate = new Date(vnToday);
        startDate.setMonth(startDate.getMonth() - 6);
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 6);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    } else if (period === 'year') {
        startDate = getVNStartOfYear();
        previousStartDate = new Date(startDate);
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    }

    return { startDate, rangeEndDate, previousStartDate, previousEndDate };
}

function renderLocationData() {
    locationTablePage = 1;
    updateSummaryStats();
    renderInsights();
    renderLocationTable();
    renderCharts();
    hideSkeletonLoading();
}

function renderInsights() {
    const insights = AnalyticsEngine.generateInsights(allLocationData, previousPeriodData);
    const banner = document.getElementById('insightsBanner');
    const content = document.getElementById('insightsContent');
    if (insights.length > 0) {
        content.innerHTML = insights.map(insight =>
            `<div class="flex items-start gap-2">
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70"></span>
                <span>${insight}</span>
            </div>`
        ).join('');
        banner.classList.remove('hidden');
        banner.style.opacity = '0';
        setTimeout(() => { banner.style.transition = 'opacity 0.5s ease-in'; banner.style.opacity = '1'; }, 100);
    } else {
        banner.classList.add('hidden');
    }
}

function updateSummaryStats() {
    const totalOrders = allLocationData.reduce((sum, loc) => sum + (loc.orders || 0), 0);
    const totalRevenue = allLocationData.reduce((sum, loc) => sum + (loc.revenue || 0), 0);
    const totalCustomers = window.uniqueCustomersCount || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('totalOrders').textContent = formatNumber(totalOrders);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalCustomers').textContent = formatNumber(totalCustomers);
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrderValue);

    if (previousPeriodData && previousPeriodData.length > 0) {
        const prevOrders = previousPeriodData.reduce((sum, loc) => sum + (loc.orders || 0), 0);
        const prevRevenue = previousPeriodData.reduce((sum, loc) => sum + (loc.revenue || 0), 0);
        const prevCustomers = previousPeriodData.reduce((sum, loc) => sum + (loc.customers || 0), 0);
        const prevAvg = prevOrders > 0 ? prevRevenue / prevOrders : 0;
        showChange('ordersChange', totalOrders, prevOrders);
        showChange('revenueChange', totalRevenue, prevRevenue);
        showChange('customersChange', totalCustomers, prevCustomers);
        showChange('avgChange', avgOrderValue, prevAvg);
    } else {
        ['ordersChange', 'revenueChange', 'customersChange', 'avgChange'].forEach(id => {
            document.getElementById(id).innerHTML = '';
        });
    }
}

function showChange(elementId, current, previous) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const growth = AnalyticsEngine.calculateGrowth(current, previous);
    if (Math.abs(growth) < 0.1) { element.innerHTML = '<span class="text-slate-400">~</span>'; return; }
    const isPositive = growth > 0;
    const isNegative = growth < 0;
    const color = isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400';
    const arrow = isPositive ? '↑' : isNegative ? '↓' : '';
    element.innerHTML = `<span class="${color}">${arrow}${Math.abs(growth).toFixed(1)}%</span>`;
}

function updateLocationTablePaginationUI(totalItems, page, pageSize, totalPages) {
    const wrap = document.getElementById('locationTablePagination');
    const info = document.getElementById('locationTablePaginationInfo');
    const badge = document.getElementById('locationTablePageBadge');
    const prevBtn = document.getElementById('locationTablePrevBtn');
    const nextBtn = document.getElementById('locationTableNextBtn');
    if (!wrap || !info || !badge || !prevBtn || !nextBtn) return;
    if (totalItems <= pageSize) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalItems);
    info.textContent = `Hiển thị ${from}–${to} trong ${totalItems} khu vực`;
    badge.textContent = `${page} / ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
}

function locationTablePrevPage() { if (locationTablePage <= 1) return; locationTablePage--; renderLocationTable(); }
function locationTableNextPage() { if (locationTablePage >= locationTableTotalPages) return; locationTablePage++; renderLocationTable(); }

function getSortedLocationTableRows() {
    const sortedData = [...allLocationData];
    if (currentSort.column && currentSort.direction) {
        sortedData.sort((a, b) => {
            let aVal, bVal;
            switch (currentSort.column) {
                case 'name': aVal = a.name || ''; bVal = b.name || ''; break;
                case 'orders': aVal = a.orders || 0; bVal = b.orders || 0; break;
                case 'revenue': aVal = a.revenue || 0; bVal = b.revenue || 0; break;
                case 'customers': aVal = a.customers || 0; bVal = b.customers || 0; break;
                case 'avgValue': aVal = a.avgValue || 0; bVal = b.avgValue || 0; break;
                case 'growth': aVal = a.growth || 0; bVal = b.growth || 0; break;
                default: return 0;
            }
            if (currentSort.column === 'name') return currentSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }
    return sortedData;
}

function renderLocationTable() {
    const tbody = document.getElementById('locationTableBody');
    const pag = document.getElementById('locationTablePagination');

    // Update table header
    const tableTitle = document.getElementById('tableTitle');
    const tableSubtitle = document.getElementById('tableSubtitle');
    const locationColumnName = document.getElementById('locationColumnName');
    if (tableTitle) tableTitle.textContent = 'Danh sách Tỉnh/Thành phố';
    if (tableSubtitle) tableSubtitle.textContent = 'Thống kê đơn hàng theo khu vực';
    if (locationColumnName) locationColumnName.textContent = 'Tỉnh/Thành phố';

    if (allLocationData.length === 0) {
        if (pag) pag.classList.add('hidden');
        tbody.innerHTML = `
            <tr><td colspan="8" class="px-6 py-16 text-center">
                <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
                    <svg class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.25"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.125-9 12.75-9 12.75S1.5 17.625 1.5 10.5a9 9 0 1118 0z" /></svg>
                </div>
                <p class="text-base font-semibold text-slate-800">Chưa có dữ liệu</p>
                <p class="mt-2 text-sm text-slate-500">Thử chọn khoảng thời gian khác</p>
            </td></tr>
        `;
        return;
    }

    const sortedData = getSortedLocationTableRows();
    const rankById = new Map(sortedData.map((loc, i) => [String(loc.id), i + 1]));
    const totalRevenue = sortedData.reduce((sum, loc) => sum + (loc.revenue || 0), 0);

    const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const filtered = q
        ? sortedData.filter((loc) => {
              const blob = [loc.name, loc.orders, loc.revenue, loc.customers, loc.avgValue, loc.growth].join(' ').toLowerCase();
              return blob.includes(q);
          })
        : sortedData;

    if (filtered.length === 0) {
        if (pag) pag.classList.add('hidden');
        tbody.innerHTML = `
            <tr><td colspan="8" class="px-6 py-12 text-center text-sm text-slate-600">
                Không có khu vực khớp "<span class="font-semibold text-slate-800">${escapeHtml(q)}</span>". Thử từ khóa khác.
            </td></tr>
        `;
        return;
    }

    locationTableTotalPages = Math.max(1, Math.ceil(filtered.length / LOCATION_TABLE_PAGE_SIZE));
    if (locationTablePage > locationTableTotalPages) locationTablePage = locationTableTotalPages;
    if (locationTablePage < 1) locationTablePage = 1;

    const start = (locationTablePage - 1) * LOCATION_TABLE_PAGE_SIZE;
    const pageRows = filtered.slice(start, start + LOCATION_TABLE_PAGE_SIZE);

    tbody.innerHTML = pageRows.map((location, i) => {
        const rank = rankById.get(String(location.id)) ?? start + i + 1;
        const rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const revenuePercent = totalRevenue > 0 ? (location.revenue / totalRevenue * 100) : 0;
        const growth = location.growth || 0;

        const hasPrevious = previousPeriodData && previousPeriodData.length > 0;
        let growthBadge;
        if (!hasPrevious) {
            growthBadge = '<span class="inline-flex items-center rounded-lg bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200/80" title="Chọn bộ lọc thời gian cụ thể để xem tăng trưởng">N/A</span>';
        } else if (Math.abs(growth) < 0.1) {
            growthBadge = '<span class="inline-flex items-center rounded-lg bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200/80" title="Không thay đổi so với kỳ trước">~ 0%</span>';
        } else {
            const isPositive = growth > 0;
            const color = isPositive ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-800 ring-1 ring-rose-100';
            const arrow = isPositive ? '↑' : '↓';
            growthBadge = `<span class="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${color}" title="So với kỳ trước">${arrow}${Math.abs(growth).toFixed(1)}%</span>`;
        }

        return `
            <tr class="group transition-colors hover:bg-slate-50/90">
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    <div class="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">${rankDisplay}</div>
                </td>
                <td class="px-5 py-4">
                    <div class="flex items-center">
                        <div class="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
                            ${location.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0">
                            <div class="text-sm font-semibold text-slate-900">${escapeHtml(location.name)}</div>
                            <div class="text-xs text-slate-500">${location.orders || 0} đơn hàng</div>
                        </div>
                    </div>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    <div class="text-sm font-bold tabular-nums text-slate-900">${formatNumber(location.orders || 0)}</div>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    <div class="text-sm font-bold tabular-nums text-emerald-700">${formatCurrency(location.revenue || 0)}</div>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    <div class="text-sm font-semibold tabular-nums text-violet-700">${formatNumber(location.customers || 0)}</div>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    <div class="text-sm font-semibold tabular-nums text-amber-700">${formatCurrency(location.avgValue || 0)}</div>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    <div class="flex justify-center">
                        <span class="inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ${revenuePercent > 10 ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' : revenuePercent > 5 ? 'bg-sky-50 text-sky-800 ring-sky-100' : 'bg-slate-100 text-slate-700 ring-slate-200/80'}">
                            ${revenuePercent.toFixed(1)}%
                        </span>
                    </div>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    ${growthBadge}
                </td>
            </tr>
        `;
    }).join('');

    updateLocationTablePaginationUI(filtered.length, locationTablePage, LOCATION_TABLE_PAGE_SIZE, locationTableTotalPages);
}

function renderCharts() {
    const top10 = [...allLocationData].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 10);

    const topCtx = document.getElementById('topLocationsChart');
    if (topChart) topChart.destroy();
    topChart = new Chart(topCtx, {
        type: 'bar',
        data: {
            labels: top10.map(loc => loc.name),
            datasets: [{ label: 'Doanh thu', data: top10.map(loc => loc.revenue || 0), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderColor: 'rgba(99, 102, 241, 1)', borderWidth: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `Doanh thu: ${formatCurrency(ctx.raw)}` } } },
            scales: { y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } } }
        }
    });

    const pieCtx = document.getElementById('revenueDistributionChart');
    if (pieChart) pieChart.destroy();
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#6B7280'];
    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: { labels: top10.map(loc => loc.name), datasets: [{ data: top10.map(loc => loc.revenue || 0), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
                tooltip: { callbacks: { label: ctx => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const percent = ((ctx.raw / total) * 100).toFixed(1); return `${ctx.label}: ${formatCurrency(ctx.raw)} (${percent}%)`; } } }
            }
        }
    });
}

function toggleSort(column) {
    const allSortIcons = ['name', 'orders', 'revenue', 'customers', 'avgValue', 'growth'];
    allSortIcons.forEach(col => {
        if (col !== column) {
            const icon = document.getElementById(`sort-${col}`);
            if (icon) { icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />'; icon.classList.remove('text-indigo-600'); }
        }
    });
    if (currentSort.column === column) {
        if (currentSort.direction === 'asc') currentSort.direction = 'desc';
        else if (currentSort.direction === 'desc') currentSort = { column: null, direction: null };
    } else {
        currentSort = { column, direction: 'asc' };
    }
    const icon = document.getElementById(`sort-${column}`);
    if (icon) {
        if (currentSort.direction === 'asc') { icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />'; icon.classList.add('text-indigo-600'); }
        else if (currentSort.direction === 'desc') { icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />'; icon.classList.add('text-indigo-600'); }
        else { icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />'; icon.classList.remove('text-indigo-600'); }
    }
    locationTablePage = 1;
    renderLocationTable();
}

function filterTable() {
    clearTimeout(locationTableFilterTimer);
    locationTableFilterTimer = setTimeout(() => { locationTableFilterTimer = null; locationTablePage = 1; renderLocationTable(); }, 100);
}

// ============================================
// Custom date picker
// ============================================

let currentDateModeLocation = 'single';
let customDatePickerModalLocation = null;

function getTodayDateStringLocation() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); }

function updateCustomDateLabelLocation(startDate, endDate) {
    const label = document.getElementById('customDateLabelLocation');
    if (!label) return;
    if (startDate === endDate) {
        const date = new Date(startDate + 'T00:00:00');
        label.textContent = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } else {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const sd = String(start.getDate()).padStart(2, '0'), sm = String(start.getMonth() + 1).padStart(2, '0');
        const ed = String(end.getDate()).padStart(2, '0'), em = String(end.getMonth() + 1).padStart(2, '0'), ey = end.getFullYear();
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) label.textContent = `${sd}-${ed}/${em}/${ey}`;
        else label.textContent = `${sd}/${sm}-${ed}/${em}/${ey}`;
    }
}

function showCustomDatePickerLocation(event) {
    event.stopPropagation();
    if (customDatePickerModalLocation) { customDatePickerModalLocation.remove(); customDatePickerModalLocation = null; }
    const today = getTodayDateStringLocation();
    const startEl = document.getElementById('customDateStartLocation');
    const endEl = document.getElementById('customDateEndLocation');
    const startDate = (startEl && startEl.value) || today;
    const endDate = (endEl && endEl.value) || today;
    const modal = document.createElement('div');
    modal.className = 'date-picker-modal';
    modal.innerHTML = `
        <div class="date-picker-content loc-picker-content">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Chọn thời gian</h3>
                <button type="button" onclick="closeCustomDatePickerLocation()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div class="profit-quick-month-box">
                <div class="profit-quick-month-label">Chọn nhanh theo tháng</div>
                <select id="locDpYear" class="profit-year-select" aria-label="Năm"></select>
                <div id="locMonthGrid" class="profit-month-grid"></div>
            </div>
            <div class="date-mode-tabs">
                <button type="button" data-mode="single" class="date-mode-tab ${currentDateModeLocation === 'single' ? 'active' : ''}" onclick="switchDateModeLocation('single', this)">Một ngày</button>
                <button type="button" data-mode="range" class="date-mode-tab ${currentDateModeLocation === 'range' ? 'active' : ''}" onclick="switchDateModeLocation('range', this)">Khoảng thời gian</button>
            </div>
            <div id="singleDateModeLocation" class="${currentDateModeLocation === 'single' ? '' : 'hidden'}">
                <div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-2">Chọn ngày</label><div class="date-input-wrapper"><input type="date" id="singleDateInputLocation" value="${startDate}" class="w-full" max="${today}"></div></div>
            </div>
            <div id="rangeDateModeLocation" class="${currentDateModeLocation === 'range' ? '' : 'hidden'}">
                <div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-2">Từ ngày</label><div class="date-input-wrapper"><input type="date" id="startDateInputLocation" value="${startDate}" class="w-full" max="${today}"></div></div>
                <div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label><div class="date-input-wrapper"><input type="date" id="endDateInputLocation" value="${endDate}" class="w-full" max="${today}"></div></div>
            </div>
            <div class="flex gap-3 mt-6">
                <button type="button" onclick="clearCustomDateLocation()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Xóa bộ lọc</button>
                <button type="button" onclick="applyCustomDateLocation()" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">Áp dụng</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    customDatePickerModalLocation = modal;
    initLocDpYearSelect(startDate);
    renderLocMonthGrid();
    const ySel = modal.querySelector('#locDpYear');
    if (ySel) ySel.addEventListener('change', renderLocMonthGrid);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeCustomDatePickerLocation(); });
}

function initLocDpYearSelect(referenceDateStr) {
    const modal = customDatePickerModalLocation; if (!modal) return;
    const ySel = modal.querySelector('#locDpYear'); if (!ySel) return;
    const today = getTodayDateStringLocation();
    const curY = parseInt(today.slice(0, 4), 10);
    const ref = referenceDateStr || today;
    const defaultY = parseInt(ref.slice(0, 4), 10);
    ySel.innerHTML = '';
    for (let y = curY; y >= curY - 5; y--) { const opt = document.createElement('option'); opt.value = String(y); opt.textContent = 'Năm ' + y; ySel.appendChild(opt); }
    ySel.value = String(Math.min(Math.max(defaultY, curY - 5), curY));
}

function renderLocMonthGrid() {
    const modal = customDatePickerModalLocation; if (!modal) return;
    const ySel = modal.querySelector('#locDpYear'); const grid = modal.querySelector('#locMonthGrid'); if (!ySel || !grid) return;
    const y = parseInt(ySel.value, 10);
    const today = getTodayDateStringLocation();
    const curY = parseInt(today.slice(0, 4), 10);
    const curM = parseInt(today.slice(5, 7), 10) - 1;
    grid.replaceChildren();
    for (let m = 0; m < 12; m++) {
        const disabled = y === curY && m > curM;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'profit-month-btn'; btn.textContent = 'Tháng ' + (m + 1);
        if (!disabled) { const monthIndex = m; btn.addEventListener('click', function () { pickLocationMonth(y, monthIndex); }); }
        else btn.disabled = true;
        grid.appendChild(btn);
    }
}

function pickLocationMonth(y, m) {
    const today = getTodayDateStringLocation();
    const ty = parseInt(today.slice(0, 4), 10), tm = parseInt(today.slice(5, 7), 10), td = parseInt(today.slice(8, 10), 10);
    const monthNum = m + 1;
    const start = `${y}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    let endDay = lastDay;
    if (y === ty && monthNum === tm) endDay = Math.min(lastDay, td);
    const end = `${y}-${String(monthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    const hS = document.getElementById('customDateStartLocation'); const hE = document.getElementById('customDateEndLocation');
    if (hS) hS.value = start; if (hE) hE.value = end;
    updateCustomDateLabelLocation(start, end);
    currentPeriod = 'custom'; customDateRange = { startDate: start, endDate: end };
    updatePeriodButtons(); updateURL(); loadLocationData();
    closeCustomDatePickerLocation();
    showToast('Đã áp dụng bộ lọc thời gian', 'success');
}

function closeCustomDatePickerLocation() {
    if (!customDatePickerModalLocation) return;
    customDatePickerModalLocation.style.opacity = '0';
    const modalEl = customDatePickerModalLocation;
    setTimeout(function () { modalEl.remove(); if (customDatePickerModalLocation === modalEl) customDatePickerModalLocation = null; }, 200);
}

function switchDateModeLocation(mode, el) {
    currentDateModeLocation = mode;
    const root = el && el.closest ? el.closest('.loc-picker-content') : null;
    const scope = root || customDatePickerModalLocation;
    if (scope) scope.querySelectorAll('.date-mode-tab').forEach(function (tab) { tab.classList.toggle('active', tab.dataset.mode === mode); });
    const singleMode = document.getElementById('singleDateModeLocation');
    const rangeMode = document.getElementById('rangeDateModeLocation');
    if (!singleMode || !rangeMode) return;
    if (mode === 'single') { singleMode.classList.remove('hidden'); rangeMode.classList.add('hidden'); }
    else { singleMode.classList.add('hidden'); rangeMode.classList.remove('hidden'); }
}

function applyCustomDateLocation() {
    let startDate, endDate;
    if (currentDateModeLocation === 'single') {
        const singleDate = document.getElementById('singleDateInputLocation').value;
        if (!singleDate) { showToast('Vui lòng chọn ngày', 'warning'); return; }
        startDate = singleDate; endDate = singleDate;
    } else {
        startDate = document.getElementById('startDateInputLocation').value;
        endDate = document.getElementById('endDateInputLocation').value;
        if (!startDate || !endDate) { showToast('Vui lòng chọn đầy đủ khoảng thời gian', 'warning'); return; }
        if (new Date(startDate) > new Date(endDate)) { showToast('Ngày bắt đầu phải trước ngày kết thúc', 'warning'); return; }
    }
    const hS = document.getElementById('customDateStartLocation'); const hE = document.getElementById('customDateEndLocation');
    if (hS) hS.value = startDate; if (hE) hE.value = endDate;
    updateCustomDateLabelLocation(startDate, endDate);
    currentPeriod = 'custom'; customDateRange = { startDate, endDate };
    updatePeriodButtons(); updateURL(); loadLocationData();
    closeCustomDatePickerLocation();
    showToast('Đã áp dụng bộ lọc thời gian', 'success');
}

function clearCustomDateLocation() {
    const hS = document.getElementById('customDateStartLocation'); const hE = document.getElementById('customDateEndLocation');
    if (hS) hS.value = ''; if (hE) hE.value = '';
    const label = document.getElementById('customDateLabelLocation');
    if (label) label.textContent = 'Chọn ngày';
    closeCustomDatePickerLocation();
    changePeriod('all');
    showToast('Đã xóa bộ lọc thời gian', 'info');
}

// Utility functions
function showSkeletonLoading() {
    document.getElementById('locationTablePagination')?.classList.add('hidden');
    const tbody = document.getElementById('locationTableBody');
    tbody.innerHTML = `
        <tr><td colspan="8" class="px-6 py-14 text-center">
            <div class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
            <p class="text-sm text-slate-500">Đang tải dữ liệu...</p>
        </td></tr>
    `;
}

function hideSkeletonLoading() {}

function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function exportToExcel() {
    showToast('Tính năng Export đang được phát triển', 'info');
}
