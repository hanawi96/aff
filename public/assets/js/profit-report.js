// Product Analytics Dashboard
let currentPeriod = 'week'; // Single source of truth
let currentLimit = 9999; // Show all products
let allProductsData = [];
let currentSort = { column: null, direction: null }; // null, 'asc', 'desc'
let customDateRange = null; // Store custom date range { startDate, endDate }

// Chart variables
let revenueChart = null;
let profitChart = null;
let ordersChart = null;
let currentChartTab = 'revenue'; // Track active chart tab

// Cache data by period for better performance with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const dataCache = {
    today: { data: null, timestamp: 0 },
    yesterday: { data: null, timestamp: 0 },
    week: { data: null, timestamp: 0 },
    month: { data: null, timestamp: 0 },
    quarter: { data: null, timestamp: 0 },
    'half-year': { data: null, timestamp: 0 },
    year: { data: null, timestamp: 0 }
};

const chartCache = {
    today: { data: null, timestamp: 0 },
    yesterday: { data: null, timestamp: 0 },
    week: { data: null, timestamp: 0 },
    month: { data: null, timestamp: 0 },
    quarter: { data: null, timestamp: 0 },
    'half-year': { data: null, timestamp: 0 },
    year: { data: null, timestamp: 0 }
};

const ordersChartCache = {
    today: { data: null, timestamp: 0 },
    yesterday: { data: null, timestamp: 0 },
    week: { data: null, timestamp: 0 },
    month: { data: null, timestamp: 0 },
    quarter: { data: null, timestamp: 0 },
    'half-year': { data: null, timestamp: 0 },
    year: { data: null, timestamp: 0 }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('📊 Product Analytics Dashboard initialized');
    loadAllData();
});

// Switch chart tab
function switchChartTab(tab) {
    currentChartTab = tab;
    
    // Update tab buttons
    const tabActive = 'chart-tab-btn group relative flex-1 px-4 py-3 text-center text-sm font-semibold transition-colors border-b-2 border-indigo-600 bg-white text-indigo-600 sm:px-6 sm:py-4';
    const tabInactive = 'chart-tab-btn group relative flex-1 px-4 py-3 text-center text-sm font-semibold transition-colors border-b-2 border-transparent text-slate-500 hover:bg-white/80 hover:text-slate-800 sm:px-6 sm:py-4';
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
        btn.className = btn.dataset.tab === tab ? tabActive : tabInactive;
    });
    
    // Update tab content
    document.querySelectorAll('.chart-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    if (tab === 'revenue') {
        document.getElementById('revenueTabContent').classList.remove('hidden');
    } else if (tab === 'profit') {
        document.getElementById('profitTabContent').classList.remove('hidden');
    } else if (tab === 'orders') {
        document.getElementById('ordersTabContent').classList.remove('hidden');
    }
}

/**
 * Get API period value (convert 'custom'/'yesterday' to 'all' for backend compatibility)
 */
function getAPIPeriod() {
    if (currentPeriod === 'custom' || currentPeriod === 'yesterday') return 'all';
    return currentPeriod;
}

/**
 * Get date range parameters for API call
 * Returns { startDateParam, endDateParam }
 */
function getDateRangeParams() {
    let startDateParam = '';
    let endDateParam = '';
    
    if (currentPeriod === 'custom' && customDateRange) {
        // Custom date range
        const startDate = new Date(customDateRange.startDate + 'T00:00:00+07:00');
        const endDate = new Date(customDateRange.endDate + 'T23:59:59.999+07:00');
        startDateParam = `&startDate=${startDate.toISOString()}`;
        endDateParam = `&endDate=${endDate.toISOString()}`;
    } else if (currentPeriod === 'yesterday') {
        // Yesterday: 00:00:00 → 23:59:59.999 VN timezone
        const now = new Date();
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        const vnYesterdayStart = new Date(vnToday.getTime() - 24 * 60 * 60 * 1000);
        const vnYesterdayEnd = new Date(vnToday.getTime() - 1); // 23:59:59.999 of yesterday
        startDateParam = `&startDate=${vnYesterdayStart.toISOString()}`;
        endDateParam = `&endDate=${vnYesterdayEnd.toISOString()}`;
    } else if (currentPeriod === 'today') {
        const vnStartOfToday = getVNStartOfToday();
        startDateParam = `&startDate=${vnStartOfToday.toISOString()}`;
    } else if (currentPeriod === 'week') {
        const vnStartOfWeek = getVNStartOfWeek();
        startDateParam = `&startDate=${vnStartOfWeek.toISOString()}`;
    } else if (currentPeriod === 'month') {
        const vnStartOfMonth = getVNStartOfMonth();
        startDateParam = `&startDate=${vnStartOfMonth.toISOString()}`;
    } else if (currentPeriod === 'quarter') {
        // 3 months ago from today (in VN timezone)
        const now = new Date();
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        const threeMonthsAgo = new Date(vnToday);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        startDateParam = `&startDate=${threeMonthsAgo.toISOString()}`;
    } else if (currentPeriod === 'half-year') {
        // 6 months ago from today (in VN timezone)
        const now = new Date();
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        const sixMonthsAgo = new Date(vnToday);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        startDateParam = `&startDate=${sixMonthsAgo.toISOString()}`;
    } else if (currentPeriod === 'year') {
        const vnStartOfYear = getVNStartOfYear();
        startDateParam = `&startDate=${vnStartOfYear.toISOString()}`;
    }
    
    return { startDateParam, endDateParam };
}

// Change period - Single source of truth
function changePeriod(period) {
    currentPeriod = period;
    
    // Clear custom date values when selecting preset
    if (period !== 'custom') {
        document.getElementById('customDateStartProfit').value = '';
        document.getElementById('customDateEndProfit').value = '';
        document.getElementById('customDateLabelProfit').textContent = 'Chọn ngày';
        customDateRange = null;
    }

    // Update active period - CSS handles all styling automatically
    document.querySelector('.period-filter-container').dataset.active = period;

    // Load all data with new period
    loadAllData();
}

// Load all data - Optimized parallel loading
async function loadAllData() {
    console.log(`📊 Loading all data for period: ${currentPeriod}`);
    
    // Show loading states
    showLoadingStates();
    
    // Load data in parallel for better performance
    const promises = [
        loadTopProducts(),
        loadRevenueChart(),
        loadProfitChart(),
        loadOrdersChart()
    ];
    
    try {
        await Promise.all(promises);
        console.log('✅ All data loaded successfully');
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showToast('Có lỗi khi tải dữ liệu', 'error');
    }
}

// Show loading states
function showLoadingStates() {
    // Charts loading - only show loading for active tab
    if (currentChartTab === 'revenue') {
        document.getElementById('chartLoading')?.classList.remove('hidden');
        document.getElementById('chartContainer')?.classList.add('hidden');
    } else if (currentChartTab === 'profit') {
        document.getElementById('profitChartLoading')?.classList.remove('hidden');
        document.getElementById('profitChartContainer')?.classList.add('hidden');
    } else if (currentChartTab === 'orders') {
        document.getElementById('ordersChartLoading')?.classList.remove('hidden');
        document.getElementById('ordersChartContainer')?.classList.add('hidden');
    }
}

// Show chart
function showChart() {
    const el = document.getElementById('profitMainChartsSection');
    if (el) el.style.display = 'block';
}

// Toggle sort column
function toggleSort(column) {
    // Reset other columns
    const allSortIcons = ['quantity', 'revenue', 'cost', 'profit', 'margin'];
    allSortIcons.forEach(col => {
        if (col !== column) {
            const icon = document.getElementById(`sort-${col}`);
            if (icon) {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
                icon.classList.remove('text-indigo-600');
            }
        }
    });

    // Toggle current column: null → asc → desc → null
    if (currentSort.column === column) {
        if (currentSort.direction === 'asc') {
            currentSort.direction = 'desc';
        } else if (currentSort.direction === 'desc') {
            currentSort = { column: null, direction: null };
        }
    } else {
        currentSort = { column, direction: 'asc' };
    }

    // Update icon
    const icon = document.getElementById(`sort-${column}`);
    if (icon) {
        if (currentSort.direction === 'asc') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
            icon.classList.add('text-indigo-600');
        } else if (currentSort.direction === 'desc') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
            icon.classList.add('text-indigo-600');
        } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
            icon.classList.remove('text-indigo-600');
        }
    }

    // Re-render table with sorted data
    renderTopProductsTable();
}

// Refresh data - Clear all caches
function refreshData() {
    // Clear cache for current period to force reload
    dataCache[currentPeriod] = { data: null, timestamp: 0 };
    chartCache[currentPeriod] = { data: null, timestamp: 0 };
    
    showToast('Đang làm mới dữ liệu...', 'info');
    loadAllData();
}

// Load top products
async function loadTopProducts() {
    try {
        // Skip cache for custom period (each custom date range is unique)
        if (currentPeriod !== 'custom') {
            // Check cache first for better performance (with TTL)
            const now = Date.now();
            const cache = dataCache[currentPeriod];
            
            if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
                console.log('📦 Using cached data for', currentPeriod, `(age: ${Math.round((now - cache.timestamp) / 1000)}s)`);
                const cachedData = cache.data;
                allProductsData = cachedData.top_products || [];
                updateSummaryStats(cachedData.overview, cachedData.cost_breakdown);
                renderCostBreakdownTable(cachedData.cost_breakdown, cachedData.overview);
                renderTopProductsTable();
                return;
            }
        }

        // Show skeleton loading
        showSkeletonLoading();

        // Get date range parameters (supports custom date)
        const { startDateParam, endDateParam } = getDateRangeParams();
        const apiPeriod = getAPIPeriod();

        // Load overview data (includes top products) - Single API call for better performance
        const overviewResponse = await fetch(
            `${CONFIG.API_URL}?action=getDetailedAnalytics&period=${apiPeriod}${startDateParam}${endDateParam}&timestamp=${Date.now()}`
        );

        const overviewData = await overviewResponse.json();

        if (overviewData.success) {
            // Cache the data for this period with timestamp (only for non-custom)
            if (currentPeriod !== 'custom') {
                dataCache[currentPeriod] = {
                    data: overviewData,
                    timestamp: Date.now()
                };
            }
            
            console.log('✅ Data loaded for', currentPeriod);
            
            // Use top_products from getDetailedAnalytics
            allProductsData = overviewData.top_products || [];
            
            // Always render data (tables will handle empty state themselves)
            updateSummaryStats(overviewData.overview, overviewData.cost_breakdown);
            renderCostBreakdownTable(overviewData.cost_breakdown, overviewData.overview);
            renderTopProductsTable();
        } else {
            throw new Error('Failed to load data');
        }
    } catch (error) {
        console.error('Error loading top products:', error);
        showToast('Không thể tải dữ liệu', 'error');
        hideSkeletonLoading();
    }
}

// Update summary stats
function updateSummaryStats(overview, costs) {
    if (!overview) return;

    // Remove skeleton classes
    const statElements = [
        'totalProductsSold', 'totalOrders', 'totalRevenue', 'avgOrderValue',
        'totalProfit', 'avgProfit', 'totalCost',
        'totalCommission', 'commissionPercent', 'totalAllCosts', 'costBreakdown',
        'uniqueCustomers', 'avgOrdersPerCustomer', 'profitRatio'
    ];

    statElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('skeleton', 'h-8', 'w-24', 'rounded');
        }
    });

    // Update stats - Use pre-calculated values from backend (no redundant calculations)
    document.getElementById('totalRevenue').textContent = formatCurrency(overview.total_revenue);
    document.getElementById('totalProfit').textContent = formatCurrency(overview.total_profit);
    document.getElementById('avgProfit').textContent = `TB: ${formatCurrency(overview.avg_profit_per_order)}/đơn`;

    document.getElementById('totalProductsSold').textContent = formatNumber(overview.total_products_sold);
    document.getElementById('totalOrders').textContent = formatNumber(overview.total_orders);
    document.getElementById('avgOrderValue').textContent = `TB: ${formatCurrency(overview.avg_revenue_per_order)}/đơn`;
    document.getElementById('totalCost').textContent = `Vốn: ${formatCurrency(overview.product_cost)}`;

    // Update commission stats
    const commission = costs ? (costs.commission || 0) : (overview.commission || 0);
    document.getElementById('totalCommission').textContent = formatCurrency(commission);
    const commissionPercent = (overview.total_revenue > 0 && commission > 0) ? (commission / overview.total_revenue * 100) : 0;
    document.getElementById('commissionPercent').textContent = `${commissionPercent.toFixed(1)}% doanh thu`;

    // Use total_cost from backend (already calculated)
    document.getElementById('totalAllCosts').textContent = formatCurrency(overview.total_cost);
    document.getElementById('costBreakdown').textContent = `TB: ${formatCurrency(overview.avg_cost_per_order)}/đơn`;

    // Update unique customers stats
    const uniqueCustomers = overview.unique_customers || 0;
    document.getElementById('uniqueCustomers').textContent = formatNumber(uniqueCustomers);
    const avgOrdersPerCustomer = uniqueCustomers > 0 ? (overview.total_orders / uniqueCustomers).toFixed(1) : 0;
    document.getElementById('avgOrdersPerCustomer').textContent = `${avgOrdersPerCustomer} đơn/KH`;

    // Update profit ratio
    document.getElementById('profitRatio').textContent = `${overview.profit_margin.toFixed(1)}%`;
}

// Chart instance
let pieChart = null;

// Render cost breakdown table + charts
function renderCostBreakdownTable(costs, overview) {
    const tbody = document.getElementById('costBreakdownTable');
    if (!costs || !overview) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Không có dữ liệu</td></tr>';
        return;
    }

    // Lưu overview vào window để dùng trong renderCostCharts
    window.currentOverview = overview;

    // Tính tổng chi phí từ costs object (không dựa vào overview.total_cost)
    const totalCost = (costs.product_cost || 0) +
        (costs.shipping_cost || 0) +
        (costs.commission || 0) +
        (costs.tax || 0) +
        (costs.bag_zip || 0) +
        (costs.bag_red || 0) +
        (costs.box_shipping || 0) +
        (costs.red_string || 0) +
        (costs.thank_card || 0) +
        (costs.paper_print || 0) +
        (costs.labor_cost || 0);

    const totalOrders = overview.total_orders || 1;

    // Cost items config - Always show main costs even if 0
    const items = [
        { key: 'product_cost', label: '💎 Giá vốn', color: '#3B82F6', group: 'main', alwaysShow: true },
        { key: 'shipping_cost', label: '🚚 Vận chuyển', color: '#F97316', group: 'main', alwaysShow: true },
        { key: 'commission', label: '💰 Hoa hồng CTV', color: '#EAB308', group: 'main', alwaysShow: true },
        { key: 'tax', label: '📊 Thuế', color: '#EF4444', group: 'main', alwaysShow: false },
        { key: 'bag_zip', label: '📦 Túi zip', color: '#8B5CF6', group: 'packaging', alwaysShow: false },
        { key: 'bag_red', label: '🎁 Túi đỏ', color: '#EC4899', group: 'packaging', alwaysShow: false },
        { key: 'box_shipping', label: '📦 Hộp', color: '#6366F1', group: 'packaging', alwaysShow: false },
        { key: 'red_string', label: '🧵 Dây đỏ', color: '#F43F5E', group: 'packaging', alwaysShow: false },
        { key: 'thank_card', label: '💌 Thiệp', color: '#14B8A6', group: 'packaging', alwaysShow: false },
        { key: 'paper_print', label: '📄 Giấy in', color: '#6B7280', group: 'packaging', alwaysShow: false },
        { key: 'labor_cost', label: '👷 Tiền công', color: '#F59E0B', group: 'packaging', alwaysShow: false }
    ];

    // Get total revenue for % calculation
    const totalRevenue = overview.total_revenue || 0;

    // Filter & sort items - calculate both percentages
    // Always show main costs (product_cost, shipping_cost, commission) even if 0
    const activeItems = items.filter(i => i.alwaysShow || (costs[i.key] || 0) > 0)
        .map(i => ({
            ...i,
            value: costs[i.key] || 0,
            percentOfCost: totalCost > 0 ? ((costs[i.key] || 0) / totalCost * 100) : 0,
            percentOfRevenue: totalRevenue > 0 ? ((costs[i.key] || 0) / totalRevenue * 100) : 0
        }))
        .sort((a, b) => b.value - a.value);

    // Render table with 2 percentage columns
    tbody.innerHTML = activeItems.map(item => `
        <tr class="hover:bg-gray-50 transition-colors ${item.percentOfCost > 50 ? 'bg-red-50' : ''}">
            <td class="px-3 py-3">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${item.label.split(' ')[0]}</span>
                    <span class="text-sm font-medium text-gray-700">${item.label.substring(3)}</span>
                    ${item.percentOfCost > 50 ? '<span class="ml-1 px-1.5 py-0.5 text-xs font-semibold text-red-600 bg-red-100 rounded">!</span>' : ''}
                </div>
            </td>
            <td class="px-3 py-3 text-right text-sm font-bold text-gray-900">${formatCurrency(item.value)}</td>
            <td class="px-3 py-3 text-right text-sm font-semibold text-gray-600">${item.percentOfCost.toFixed(1)}%</td>
            <td class="px-3 py-3 text-right text-sm font-medium text-blue-600">${item.percentOfRevenue.toFixed(1)}%</td>
            <td class="px-3 py-3 text-right text-sm text-gray-500">${formatCurrency(item.value / totalOrders)}</td>
        </tr>
    `).join('') + `
        <tr class="bg-gray-50 font-bold border-t-2 border-gray-300">
            <td class="px-3 py-3 text-sm text-gray-700">TỔNG CHI PHÍ</td>
            <td class="px-3 py-3 text-right text-base text-gray-900">${formatCurrency(totalCost)}</td>
            <td class="px-3 py-3 text-right text-sm text-gray-600">100%</td>
            <td class="px-3 py-3 text-right text-sm text-blue-600">${totalRevenue > 0 ? (totalCost / totalRevenue * 100).toFixed(1) : '0.0'}%</td>
            <td class="px-3 py-3 text-right text-sm text-gray-500">${formatCurrency(totalCost / totalOrders)}</td>
        </tr>
    `;

    // Render charts
    renderCostCharts(costs);
}

// Render pie chart - 6 loại chi phí + Lợi nhuận ròng
function renderCostCharts(costs) {
    // Tính tổng vật liệu đóng gói (KHÔNG bao gồm tiền công)
    const packagingMaterialsTotal = (costs.bag_zip || 0) + (costs.bag_red || 0) +
        (costs.box_shipping || 0) + (costs.red_string || 0) +
        (costs.thank_card || 0) + (costs.paper_print || 0);

    // Tiền công đóng gói (tách riêng)
    const laborCost = costs.labor_cost || 0;

    // Lấy tổng doanh thu từ overview
    const totalRevenue = window.currentOverview?.total_revenue || 0;

    // Tính tổng chi phí
    const totalCost = (costs.product_cost || 0) +
        (costs.shipping_cost || 0) +
        packagingMaterialsTotal +
        laborCost +
        (costs.commission || 0) +
        (costs.tax || 0);

    // Tính lợi nhuận ròng
    const netProfit = totalRevenue - totalCost;

    // 6 loại chi phí + Lợi nhuận
    const pieData = [
        { label: '💎 Giá vốn sản phẩm', value: costs.product_cost || 0, color: '#3B82F6' },
        { label: '🚚 Vận chuyển', value: costs.shipping_cost || 0, color: '#F97316' },
        { label: '📦 Vật liệu đóng gói', value: packagingMaterialsTotal, color: '#8B5CF6' },
        { label: '👷 Tiền công đóng gói', value: laborCost, color: '#F59E0B' },
        { label: '💰 Hoa hồng CTV', value: costs.commission || 0, color: '#EAB308' },
        { label: '📊 Thuế', value: costs.tax || 0, color: '#EF4444' },
        { label: '✨ Lợi nhuận ròng', value: netProfit > 0 ? netProfit : 0, color: '#10B981' }
    ].filter(d => d.value > 0);

    // Pie Chart
    const pieCtx = document.getElementById('costPieChart');
    if (!pieCtx) return;
    if (pieChart) pieChart.destroy();

    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: pieData.map(d => d.label),
            datasets: [{
                data: pieData.map(d => d.value),
                backgroundColor: pieData.map(d => d.color),
                borderWidth: 3,
                borderColor: '#fff',
                hoverBorderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: { size: 11, weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 14,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    bodySpacing: 6,
                    callbacks: {
                        title: ctx => ctx[0].label,
                        label: ctx => {
                            const percent = totalRevenue > 0 ? ((ctx.raw / totalRevenue) * 100).toFixed(1) : '0.0';
                            return `Số tiền: ${formatCurrency(ctx.raw)}`;
                        },
                        afterLabel: ctx => {
                            const percent = totalRevenue > 0 ? ((ctx.raw / totalRevenue) * 100).toFixed(1) : '0.0';
                            return `Tỷ lệ: ${percent}% doanh thu`;
                        },
                        footer: () => {
                            return `\nTổng doanh thu: ${formatCurrency(totalRevenue)}`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 800,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Render top products table
function renderTopProductsTable() {
    const tbody = document.getElementById('topProductsTable');

    if (allProductsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center">
                        <div class="text-6xl mb-4">📦</div>
                        <p class="text-gray-500 text-lg">Chưa có dữ liệu</p>
                        <p class="text-gray-400 text-sm mt-2">Thử chọn khoảng thời gian khác</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Sort data if needed
    let sortedData = [...allProductsData];
    if (currentSort.column && currentSort.direction) {
        sortedData.sort((a, b) => {
            let aVal, bVal;
            switch (currentSort.column) {
                case 'quantity':
                    aVal = a.total_quantity || 0;
                    bVal = b.total_quantity || 0;
                    break;
                case 'revenue':
                    aVal = a.total_revenue || 0;
                    bVal = b.total_revenue || 0;
                    break;
                case 'cost':
                    aVal = a.total_cost || 0;
                    bVal = b.total_cost || 0;
                    break;
                case 'profit':
                    aVal = a.total_profit || 0;
                    bVal = b.total_profit || 0;
                    break;
                case 'margin':
                    aVal = a.profit_margin || 0;
                    bVal = b.profit_margin || 0;
                    break;
                default:
                    return 0;
            }
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }

    tbody.innerHTML = sortedData.map((product, index) => {
        const rank = index + 1;
        const profitMargin = product.profit_margin || 0;
        const profitColor = profitMargin > 50 ? 'text-emerald-600' : profitMargin > 30 ? 'text-green-600' : 'text-yellow-600';
        const profitBadgeBg = profitMargin > 50 ? 'bg-emerald-100' : profitMargin > 30 ? 'bg-green-100' : 'bg-yellow-100';

        // Medal for top 3
        let rankDisplay = rank;
        if (rank === 1) rankDisplay = '🥇';
        else if (rank === 2) rankDisplay = '🥈';
        else if (rank === 3) rankDisplay = '🥉';

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-2xl font-bold text-gray-900">${rankDisplay}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                            ${product.product_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="text-sm font-medium text-gray-900">${escapeHtml(product.product_name)}</div>
                            <div class="text-xs text-gray-500">${product.order_count || 0} đơn hàng</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-bold text-gray-900">${formatNumber(product.total_sold || 0)}</div>
                    <div class="text-xs text-gray-500">sản phẩm</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-bold text-green-600">${formatCurrency(product.total_revenue || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="text-sm font-medium text-orange-600">${formatCurrency(product.total_cost || 0)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="text-sm font-bold ${profitColor}">${formatCurrency(product.total_profit || 0)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="flex justify-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${profitColor} bg-${profitColor.includes('emerald') ? 'emerald' : profitColor.includes('green') ? 'green' : 'yellow'}-100">
                            ${profitMargin.toFixed(1)}%
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="flex justify-center">
                        <button onclick="showProductDetail(${product.product_id})" class="text-indigo-600 hover:text-indigo-900 font-medium text-sm">
                            Chi tiết →
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Show product detail modal
async function showProductDetail(productId) {
    if (!productId) {
        showToast('Không tìm thấy thông tin sản phẩm', 'error');
        return;
    }

    try {
        // Get date range parameters (supports custom date)
        const { startDateParam, endDateParam } = getDateRangeParams();
        const apiPeriod = getAPIPeriod();

        const response = await fetch(`${CONFIG.API_URL}?action=getProductStats&productId=${productId}&period=${apiPeriod}${startDateParam}${endDateParam}&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            const stats = data.stats || {};
            const productInfo = data.productInfo || {};
            const recentOrders = data.recentOrders || [];

            // Update modal content
            document.getElementById('modalProductName').textContent = productInfo.name || stats.product_name || 'N/A';
            document.getElementById('modalTotalSold').textContent = formatNumber(stats.total_sold || 0);
            document.getElementById('modalRevenue').textContent = formatCurrency(stats.total_revenue || 0);
            document.getElementById('modalProfit').textContent = formatCurrency(stats.total_profit || 0);
            document.getElementById('modalMargin').textContent = `${(stats.profit_margin || 0).toFixed(1)}%`;
            document.getElementById('modalAvgPrice').textContent = formatCurrency(stats.avg_price || 0);
            document.getElementById('modalMinPrice').textContent = formatCurrency(stats.min_price || 0);
            document.getElementById('modalMaxPrice').textContent = formatCurrency(stats.max_price || 0);

            // Render recent orders
            const ordersHtml = recentOrders.length > 0 ? recentOrders.map(order => `
                <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(order.order_id)}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(order.customer_name || 'N/A')} • ${formatDate(order.created_at_unix)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-bold text-gray-900">${order.quantity}x</div>
                        <div class="text-xs text-green-600">${formatCurrency(order.subtotal || 0)}</div>
                    </div>
                </div>
            `).join('') : '<p class="text-gray-500 text-sm text-center py-4">Chưa có đơn hàng</p>';

            document.getElementById('modalRecentOrders').innerHTML = ordersHtml;

            // Show modal
            const modalEl = document.getElementById('productDetailModal');
            modalEl.classList.remove('hidden');
            modalEl.classList.add('flex');
        } else {
            throw new Error(data.error || 'Failed to load product stats');
        }
    } catch (error) {
        console.error('Error loading product detail:', error);
        showToast('Không thể tải chi tiết sản phẩm', 'error');
    }
}

// Close product modal
function closeProductModal() {
    const modalEl = document.getElementById('productDetailModal');
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
}

// Skeleton loading functions - Simplified for better performance
function showSkeletonLoading() {
    const tbody = document.getElementById('topProductsTable');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p class="text-gray-500">Đang tải dữ liệu...</p>
                </div>
            </td>
        </tr>
    `;
}

function hideSkeletonLoading() {
    // Skeleton will be replaced by actual data in renderTopProductsTable
}

// Show empty state when no data found
function showEmptyState() {
    const tbody = document.getElementById('topProductsTable');
    const costBreakdownBody = document.getElementById('costBreakdownBody');
    
    // Empty state for products table
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-16 text-center">
                <div class="flex flex-col items-center">
                    <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Không có dữ liệu</h3>
                    <p class="text-gray-500 mb-4">Không tìm thấy đơn hàng nào trong khoảng thời gian này</p>
                    <button onclick="changePeriod('week')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        Xem tuần này
                    </button>
                </div>
            </td>
        </tr>
    `;
    
    // Empty state for cost breakdown table
    if (costBreakdownBody) {
        costBreakdownBody.innerHTML = `
            <tr>
                <td colspan="3" class="px-6 py-8 text-center text-gray-500">
                    Không có dữ liệu chi phí
                </td>
            </tr>
        `;
    }
    
    // Show toast notification
    showToast('Không có dữ liệu trong khoảng thời gian này', 'info');
}

// Utility functions
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Use timezone-utils to convert UTC to VN timezone
        return toVNShortDate(dateString);
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// showToast is now provided by toast-manager.js


// ============================================
// REVENUE CHART FUNCTIONS
// ============================================

// Load revenue chart data
async function loadRevenueChart() {
    try {
        // Show chart section
        showChart();
        
        // Skip cache for custom period
        if (currentPeriod !== 'custom') {
            // Check cache
            const now = Date.now();
            const cache = chartCache[currentPeriod];
            
            if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
                console.log('📦 Using cached chart data for', currentPeriod);
                renderRevenueChart(cache.data);
                return;
            }
        }
        
        // Show loading
        const loadingEl = document.getElementById('chartLoading');
        const containerEl = document.getElementById('chartContainer');
        
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (containerEl) containerEl.classList.add('hidden');
        
        // Get date range parameters (supports custom date)
        const { startDateParam, endDateParam } = getDateRangeParams();
        const apiPeriod = getAPIPeriod();
        
        // Fetch data
        const response = await fetch(`${CONFIG.API_URL}?action=getRevenueChart&period=${apiPeriod}${startDateParam}${endDateParam}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            // Cache data (only for non-custom periods)
            if (currentPeriod !== 'custom') {
                chartCache[currentPeriod] = {
                    data: data,
                    timestamp: Date.now()
                };
            }
            
            renderRevenueChart(data);
        } else {
            throw new Error(data.error || 'Failed to load chart data');
        }
        
    } catch (error) {
        console.error('❌ Error loading chart:', error);
        const loadingEl = document.getElementById('chartLoading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-center py-20">
                    <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-gray-500">Không thể tải biểu đồ</p>
                    <button onclick="loadAllData()" class="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium">Thử lại</button>
                </div>
            `;
        }
    }
}

// Render revenue chart
function renderRevenueChart(data) {
    // Hide loading, show chart
    document.getElementById('chartLoading').classList.add('hidden');
    const container = document.getElementById('chartContainer');
    container.classList.remove('hidden');
    
    // Update comparison cards
    updateComparisonCards(data.comparison);
    
    // Destroy existing chart
    if (revenueChart) {
        revenueChart.destroy();
        revenueChart = null;
    }
    
    // Ensure canvas exists
    let canvas = document.getElementById('revenueChart');
    if (!canvas) {
        container.innerHTML = '<canvas id="revenueChart"></canvas>';
        canvas = document.getElementById('revenueChart');
    }
    
    // Get canvas context
    const ctx = canvas.getContext('2d');
    
    // Determine period labels
    let periodLabel = 'Kỳ này';
    let previousLabel = 'Kỳ trước';
    
    switch (data.period) {
        case 'today':
            periodLabel = 'Hôm nay';
            previousLabel = 'Hôm qua';
            break;
        case 'yesterday':
            periodLabel = 'Hôm qua';
            previousLabel = 'Hôm kia';
            break;
        case 'week':
            periodLabel = 'Tuần này';
            previousLabel = 'Tuần trước';
            break;
        case 'month':
            periodLabel = 'Tháng này';
            previousLabel = 'Tháng trước';
            break;
        case 'year':
            periodLabel = 'Năm nay';
            previousLabel = 'Năm trước';
            break;
        case 'all':
            if (currentPeriod === 'yesterday') {
                periodLabel = 'Hôm qua';
                previousLabel = 'Hôm kia';
            }
            break;
    }
    
    // Totals for subtitle (data.currentPeriod.total is a summary object from API)
    const revCurTotal = data.currentPeriod?.total?.revenue ?? data.currentPeriod.revenue.reduce((s, v) => s + v, 0);
    const revPrevTotal = data.previousPeriod?.total?.revenue ?? data.previousPeriod.revenue.reduce((s, v) => s + v, 0);

    // Create chart
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: periodLabel,
                    data: data.currentPeriod.revenue,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(99, 102, 241)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: previousLabel,
                    data: data.previousPeriod.revenue,
                    borderColor: 'rgb(156, 163, 175)',
                    backgroundColor: 'rgba(156, 163, 175, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgb(156, 163, 175)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                subtitle: {
                    display: true,
                    text: `Tổng ${periodLabel}: ${formatCurrency(revCurTotal)}   ·   Tổng ${previousLabel}: ${formatCurrency(revPrevTotal)}`,
                    color: '#6366f1',
                    font: { size: 12, weight: '500' },
                    padding: { bottom: 10 }
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    bodySpacing: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.parsed.y);
                            
                            // Add order count
                            const orderCount = context.datasetIndex === 0 
                                ? data.currentPeriod.orders[context.dataIndex]
                                : data.previousPeriod.orders[context.dataIndex];
                            label += ` (${orderCount} đơn)`;
                            
                            return label;
                        },
                        footer: function(tooltipItems) {
                            // Show profit in footer
                            const index = tooltipItems[0].dataIndex;
                            const currentProfit = data.currentPeriod.profit[index];
                            const previousProfit = data.previousPeriod.profit[index];
                            
                            return [
                                `Lợi nhuận ${periodLabel}: ${formatCurrency(currentProfit)}`,
                                `Lợi nhuận ${previousLabel}: ${formatCurrency(previousProfit)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        },
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update comparison cards
function updateComparisonCards(comparison) {
    // Revenue change
    const revenueEl = document.getElementById('chartRevenueChange');
    const revenueChange = comparison.revenueChange;
    revenueEl.textContent = (revenueChange >= 0 ? '+' : '') + revenueChange.toFixed(1) + '%';
    revenueEl.className = 'text-lg font-bold ' + (revenueChange >= 0 ? 'text-green-600' : 'text-red-600');
    
    // Profit change
    const profitEl = document.getElementById('chartProfitChange');
    const profitChange = comparison.profitChange;
    profitEl.textContent = (profitChange >= 0 ? '+' : '') + profitChange.toFixed(1) + '%';
    profitEl.className = 'text-lg font-bold ' + (profitChange >= 0 ? 'text-green-600' : 'text-red-600');
    
    // Orders change
    const ordersEl = document.getElementById('chartOrdersChange');
    const ordersChange = comparison.ordersChange;
    ordersEl.textContent = (ordersChange >= 0 ? '+' : '') + ordersChange.toFixed(1) + '%';
    ordersEl.className = 'text-lg font-bold ' + (ordersChange >= 0 ? 'text-green-600' : 'text-red-600');
}

// Format currency short (for chart axis)
function formatCurrencyShort(amount) {
    if (amount >= 1000000000) {
        return (amount / 1000000000).toFixed(1) + 'B';
    } else if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
        return (amount / 1000).toFixed(0) + 'K';
    }
    return amount.toString();
}


// ============================================
// ORDERS CHART FUNCTIONS
// ============================================

// Load orders chart data
async function loadOrdersChart() {
    try {
        console.log('📊 Loading orders chart for period:', currentPeriod);
        showOrdersChart();
        
        // Skip cache for custom period
        if (currentPeriod !== 'custom') {
            // Check cache
            const now = Date.now();
            const cache = ordersChartCache[currentPeriod];
            
            if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
                console.log('📦 Using cached orders chart data for', currentPeriod);
                renderOrdersChart(cache.data);
                return;
            }
        }
        
        // Show loading only if this is the active tab
        const loadingEl = document.getElementById('ordersChartLoading');
        const containerEl = document.getElementById('ordersChartContainer');
        
        if (currentChartTab === 'orders') {
            if (loadingEl) loadingEl.classList.remove('hidden');
            if (containerEl) containerEl.classList.add('hidden');
        }
        
        // Get date range parameters (supports custom date)
        const { startDateParam, endDateParam } = getDateRangeParams();
        const apiPeriod = getAPIPeriod();
        
        // Fetch data
        console.log('🌐 Fetching orders chart data from API...');
        const url = `${CONFIG.API_URL}?action=getOrdersChart&period=${apiPeriod}${startDateParam}${endDateParam}&timestamp=${Date.now()}`;
        console.log('URL:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Orders chart data:', data);
        
        if (data.success) {
            // Cache data (only for non-custom periods)
            if (currentPeriod !== 'custom') {
                ordersChartCache[currentPeriod] = {
                    data: data,
                    timestamp: Date.now()
                };
            }
            
            console.log('✅ Orders chart data loaded successfully');
            renderOrdersChart(data);
        } else {
            throw new Error(data.error || 'Failed to load orders chart data');
        }
        
    } catch (error) {
        console.error('❌ Error loading orders chart:', error);
        const loadingEl = document.getElementById('ordersChartLoading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-center py-20">
                    <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-gray-500">Không thể tải biểu đồ đơn hàng</p>
                    <p class="text-xs text-red-500 mt-2">${error.message}</p>
                    <button onclick="loadOrdersChart()" class="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium">Thử lại</button>
                </div>
            `;
        }
        showToast('Không thể tải biểu đồ đơn hàng: ' + error.message, 'error');
    }
}

// Render orders chart
function renderOrdersChart(data) {
    // Hide loading, show chart
    const loadingEl = document.getElementById('ordersChartLoading');
    const containerEl = document.getElementById('ordersChartContainer');
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (containerEl) containerEl.classList.remove('hidden');
    
    // Update comparison cards
    updateOrdersComparisonCards(data);
    
    // Destroy existing chart
    if (ordersChart) {
        ordersChart.destroy();
    }
    
    // Get canvas context
    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Determine period labels
    let periodLabel = 'Kỳ này';
    let previousLabel = 'Kỳ trước';
    
    switch (data.period) {
        case 'today':
            periodLabel = 'Hôm nay';
            previousLabel = 'Hôm qua';
            break;
        case 'yesterday':
            periodLabel = 'Hôm qua';
            previousLabel = 'Hôm kia';
            break;
        case 'week':
            periodLabel = 'Tuần này';
            previousLabel = 'Tuần trước';
            break;
        case 'month':
            periodLabel = 'Tháng này';
            previousLabel = 'Tháng trước';
            break;
        case 'year':
            periodLabel = 'Năm nay';
            previousLabel = 'Năm trước';
            break;
        case 'all':
            if (currentPeriod === 'yesterday') {
                periodLabel = 'Hôm qua';
                previousLabel = 'Hôm kia';
            }
            break;
    }
    
    // Totals for subtitle (currentPeriod.total is the orders-per-slot array here)
    const ordCurTotal = Array.isArray(data.currentPeriod.total)
        ? data.currentPeriod.total.reduce((s, v) => s + v, 0)
        : (data.currentPeriod.total || 0);
    const ordPrevTotal = Array.isArray(data.previousPeriod.total)
        ? data.previousPeriod.total.reduce((s, v) => s + v, 0)
        : (data.previousPeriod.total || 0);

    // Create chart
    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: periodLabel,
                    data: data.currentPeriod.total,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(16, 185, 129)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: previousLabel,
                    data: data.previousPeriod.total,
                    borderColor: 'rgb(156, 163, 175)',
                    backgroundColor: 'rgba(156, 163, 175, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgb(156, 163, 175)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                subtitle: {
                    display: true,
                    text: `Tổng ${periodLabel}: ${ordCurTotal} đơn   ·   Tổng ${previousLabel}: ${ordPrevTotal} đơn`,
                    color: '#10b981',
                    font: { size: 12, weight: '500' },
                    padding: { bottom: 10 }
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    bodySpacing: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y + ' đơn';
                            return label;
                        },
                        footer: function(tooltipItems) {
                            const index = tooltipItems[0].dataIndex;
                            const currentDelivered = data.currentPeriod.delivered[index];
                            const currentCancelled = data.currentPeriod.cancelled[index];
                            const previousDelivered = data.previousPeriod.delivered[index];
                            const previousCancelled = data.previousPeriod.cancelled[index];
                            
                            return [
                                `${periodLabel}: ${currentDelivered} giao, ${currentCancelled} hủy`,
                                `${previousLabel}: ${previousDelivered} giao, ${previousCancelled} hủy`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' đơn';
                        },
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update orders comparison cards
function updateOrdersComparisonCards(data) {
    // Total change
    const totalEl = document.getElementById('ordersChartTotalChange');
    if (totalEl) {
        const totalChange = data.comparison.totalChange;
        totalEl.textContent = (totalChange >= 0 ? '+' : '') + totalChange.toFixed(1) + '%';
        totalEl.className = 'text-lg font-bold ' + (totalChange >= 0 ? 'text-green-600' : 'text-red-600');
    }
    
    // Delivery rate
    const deliveryEl = document.getElementById('ordersChartDeliveryRate');
    if (deliveryEl) {
        deliveryEl.textContent = data.currentPeriod.deliveryRate.toFixed(1) + '%';
    }
    
    // Cancel rate
    const cancelEl = document.getElementById('ordersChartCancelRate');
    if (cancelEl) {
        cancelEl.textContent = data.currentPeriod.cancelRate.toFixed(1) + '%';
    }
}

// Show orders chart
function showOrdersChart() {
    // Orders chart is in the same section as revenue/profit charts
    // So we use the shared showChart() function
    showChart();
}


// ============================================
// PROFIT CHART FUNCTIONS
// ============================================

// Load profit chart data
async function loadProfitChart() {
    try {
        showProfitChart();
        
        // Skip cache for custom period
        if (currentPeriod !== 'custom') {
            // Check cache - reuse revenue chart cache since it has profit data
            const now = Date.now();
            const cache = chartCache[currentPeriod];
            
            if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
                console.log('📦 Using cached profit chart data for', currentPeriod);
                renderProfitChart(cache.data);
                return;
            }
        }
        
        // Show loading only if this is the active tab
        const loadingEl = document.getElementById('profitChartLoading');
        const containerEl = document.getElementById('profitChartContainer');
        
        if (currentChartTab === 'profit') {
            if (loadingEl) loadingEl.classList.remove('hidden');
            if (containerEl) containerEl.classList.add('hidden');
        }
        
        // Get date range parameters (supports custom date)
        const { startDateParam, endDateParam } = getDateRangeParams();
        const apiPeriod = getAPIPeriod();
        
        // Fetch data from revenue chart API (it includes profit data)
        const response = await fetch(`${CONFIG.API_URL}?action=getRevenueChart&period=${apiPeriod}${startDateParam}${endDateParam}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            // Cache data (only for non-custom periods)
            if (currentPeriod !== 'custom') {
                chartCache[currentPeriod] = {
                    data: data,
                    timestamp: Date.now()
                };
            }
            
            renderProfitChart(data);
        } else {
            throw new Error(data.error || 'Failed to load profit chart data');
        }
        
    } catch (error) {
        console.error('❌ Error loading profit chart:', error);
        const loadingEl = document.getElementById('profitChartLoading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-center py-20">
                    <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-gray-500">Không thể tải biểu đồ lợi nhuận</p>
                    <button onclick="loadAllData()" class="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium">Thử lại</button>
                </div>
            `;
        }
    }
}

// Render profit chart
function renderProfitChart(data) {
    // Hide loading, show chart
    document.getElementById('profitChartLoading').classList.add('hidden');
    document.getElementById('profitChartContainer').classList.remove('hidden');
    
    // Update comparison cards
    updateProfitComparisonCards(data);
    
    // Destroy existing chart
    if (profitChart) {
        profitChart.destroy();
    }
    
    // Get canvas context
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    // Determine period labels
    let periodLabel = 'Kỳ này';
    let previousLabel = 'Kỳ trước';
    
    switch (data.period) {
        case 'today':
            periodLabel = 'Hôm nay';
            previousLabel = 'Hôm qua';
            break;
        case 'yesterday':
            periodLabel = 'Hôm qua';
            previousLabel = 'Hôm kia';
            break;
        case 'week':
            periodLabel = 'Tuần này';
            previousLabel = 'Tuần trước';
            break;
        case 'month':
            periodLabel = 'Tháng này';
            previousLabel = 'Tháng trước';
            break;
        case 'year':
            periodLabel = 'Năm nay';
            previousLabel = 'Năm trước';
            break;
        case 'all':
            if (currentPeriod === 'yesterday') {
                periodLabel = 'Hôm qua';
                previousLabel = 'Hôm kia';
            }
            break;
    }
    
    // Totals for subtitle
    const profCurTotal = data.currentPeriod?.total?.profit ?? data.currentPeriod.profit.reduce((s, v) => s + v, 0);
    const profPrevTotal = data.previousPeriod?.total?.profit ?? data.previousPeriod.profit.reduce((s, v) => s + v, 0);

    // Create chart with profit data
    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: periodLabel,
                    data: data.currentPeriod.profit,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(16, 185, 129)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: previousLabel,
                    data: data.previousPeriod.profit,
                    borderColor: 'rgb(156, 163, 175)',
                    backgroundColor: 'rgba(156, 163, 175, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgb(156, 163, 175)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                subtitle: {
                    display: true,
                    text: `Tổng ${periodLabel}: ${formatCurrency(profCurTotal)}   ·   Tổng ${previousLabel}: ${formatCurrency(profPrevTotal)}`,
                    color: '#10b981',
                    font: { size: 12, weight: '500' },
                    padding: { bottom: 10 }
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    bodySpacing: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.parsed.y);
                            
                            // Add order count
                            const orderCount = context.datasetIndex === 0 
                                ? data.currentPeriod.orders[context.dataIndex]
                                : data.previousPeriod.orders[context.dataIndex];
                            label += ` (${orderCount} đơn)`;
                            
                            return label;
                        },
                        footer: function(tooltipItems) {
                            // Show revenue and profit margin in footer
                            const index = tooltipItems[0].dataIndex;
                            const currentRevenue = data.currentPeriod.revenue[index];
                            const currentProfit = data.currentPeriod.profit[index];
                            const previousRevenue = data.previousPeriod.revenue[index];
                            const previousProfit = data.previousPeriod.profit[index];
                            
                            const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue * 100).toFixed(1) : 0;
                            const previousMargin = previousRevenue > 0 ? (previousProfit / previousRevenue * 100).toFixed(1) : 0;
                            
                            return [
                                `Doanh thu ${periodLabel}: ${formatCurrency(currentRevenue)}`,
                                `Tỷ suất ${periodLabel}: ${currentMargin}%`,
                                `Doanh thu ${previousLabel}: ${formatCurrency(previousRevenue)}`,
                                `Tỷ suất ${previousLabel}: ${previousMargin}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        },
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Update profit comparison cards
function updateProfitComparisonCards(data) {
    // Profit change
    const profitChangeEl = document.getElementById('profitChartChange');
    const profitChange = data.comparison.profitChange;
    profitChangeEl.textContent = (profitChange >= 0 ? '+' : '') + profitChange.toFixed(1) + '%';
    profitChangeEl.className = 'text-lg font-bold ' + (profitChange >= 0 ? 'text-emerald-600' : 'text-red-600');
    
    // Calculate profit margin average
    const currentTotal = data.currentPeriod.total;
    const profitMargin = currentTotal.revenue > 0 ? (currentTotal.profit / currentTotal.revenue * 100) : 0;
    const profitMarginEl = document.getElementById('profitMarginAvg');
    profitMarginEl.textContent = profitMargin.toFixed(1) + '%';
    profitMarginEl.className = 'text-lg font-bold ' + (profitMargin >= 30 ? 'text-emerald-700' : profitMargin >= 15 ? 'text-green-600' : 'text-yellow-600');
    
    // Profit per order
    const profitPerOrderEl = document.getElementById('profitPerOrder');
    const profitPerOrder = currentTotal.orders > 0 ? currentTotal.profit / currentTotal.orders : 0;
    profitPerOrderEl.textContent = formatCurrency(profitPerOrder);
    profitPerOrderEl.className = 'text-lg font-bold ' + (profitPerOrder >= 0 ? 'text-emerald-700' : 'text-red-600');
}

// Show profit chart
function showProfitChart() {
    // Profit chart is in the same section as revenue/orders charts
    // So we use the shared showChart() function
    showChart();
}


// ============================================
// Custom Date Picker for Profit Report
// ============================================

let currentDateModeProfit = 'single'; // 'single' or 'range'
let customDatePickerModalProfit = null;

/**
 * Get today's date string in YYYY-MM-DD format (VN timezone)
 */
function getTodayDateStringProfit() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    return vnDateStr;
}

/**
 * Show custom date picker modal for profit report
 */
function showCustomDatePickerProfit(event) {
    event.stopPropagation();
    
    // Remove existing modal if any
    if (customDatePickerModalProfit) {
        customDatePickerModalProfit.remove();
    }
    
    // Get current values or default to today
    const today = getTodayDateStringProfit();
    const startDate = document.getElementById('customDateStartProfit').value || today;
    const endDate = document.getElementById('customDateEndProfit').value || today;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'date-picker-modal';
    modal.innerHTML = `
        <div class="date-picker-content profit-picker-content">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Chọn thời gian</h3>
                <button onclick="closeCustomDatePickerProfit()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="profit-quick-month-box">
                <div class="profit-quick-month-label">Chọn nhanh theo tháng</div>
                <select id="profitDpYear" class="profit-year-select" aria-label="Năm"></select>
                <div id="profitMonthGrid" class="profit-month-grid"></div>
            </div>
            
            <!-- Mode Tabs -->
            <div class="date-mode-tabs">
                <button type="button" data-mode="single" class="date-mode-tab ${currentDateModeProfit === 'single' ? 'active' : ''}" onclick="switchDateModeProfit('single', this)">
                    Một ngày
                </button>
                <button type="button" data-mode="range" class="date-mode-tab ${currentDateModeProfit === 'range' ? 'active' : ''}" onclick="switchDateModeProfit('range', this)">
                    Khoảng thời gian
                </button>
            </div>
            
            <!-- Single Date Mode -->
            <div id="singleDateModeProfit" class="${currentDateModeProfit === 'single' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Chọn ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="singleDateInputProfit" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Range Date Mode -->
            <div id="rangeDateModeProfit" class="${currentDateModeProfit === 'range' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Từ ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="startDateInputProfit" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="endDateInputProfit" value="${endDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mt-6">
                <button onclick="clearCustomDateProfit()" 
                    class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Xóa bộ lọc
                </button>
                <button onclick="applyCustomDateProfit()" 
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    customDatePickerModalProfit = modal;

    initProfitDpYearSelect(startDate);
    renderProfitMonthGrid();
    const ySel = modal.querySelector('#profitDpYear');
    if (ySel) {
        ySel.addEventListener('change', renderProfitMonthGrid);
    }
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCustomDatePickerProfit();
        }
    });
}

/**
 * Populate year dropdown (current year … current−5), same range as mobile stats.
 */
function initProfitDpYearSelect(referenceDateStr) {
    const modal = customDatePickerModalProfit;
    if (!modal) return;
    const ySel = modal.querySelector('#profitDpYear');
    if (!ySel) return;
    const today = getTodayDateStringProfit();
    const curY = parseInt(today.slice(0, 4), 10);
    const ref = referenceDateStr || today;
    const defaultY = parseInt(ref.slice(0, 4), 10);
    ySel.innerHTML = '';
    for (let y = curY; y >= curY - 5; y--) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = 'Năm ' + y;
        ySel.appendChild(opt);
    }
    const pickY = Math.min(Math.max(defaultY, curY - 5), curY);
    ySel.value = String(pickY);
}

/**
 * Render 12 month buttons; disable future months in selected year (VN date).
 */
function renderProfitMonthGrid() {
    const modal = customDatePickerModalProfit;
    if (!modal) return;
    const ySel = modal.querySelector('#profitDpYear');
    const grid = modal.querySelector('#profitMonthGrid');
    if (!ySel || !grid) return;
    const y = parseInt(ySel.value, 10);
    const today = getTodayDateStringProfit();
    const curY = parseInt(today.slice(0, 4), 10);
    const curM = parseInt(today.slice(5, 7), 10) - 1;
    grid.innerHTML = '';
    for (let m = 0; m < 12; m++) {
        const disabled = y === curY && m > curM;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'profit-month-btn';
        btn.textContent = 'Tháng ' + (m + 1);
        btn.dataset.m = String(m);
        if (disabled) {
            btn.disabled = true;
        } else {
            btn.addEventListener('click', function () {
                pickProfitMonth(y, m);
            });
        }
        grid.appendChild(btn);
    }
}

/**
 * Apply full month (clamped to today if current month), same idea as m.html pickMonth.
 */
function pickProfitMonth(y, m) {
    const today = getTodayDateStringProfit();
    const ty = parseInt(today.slice(0, 4), 10);
    const tm = parseInt(today.slice(5, 7), 10);
    const td = parseInt(today.slice(8, 10), 10);
    const monthNum = m + 1;
    const start = `${y}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    let endDay = lastDay;
    if (y === ty && monthNum === tm) {
        endDay = Math.min(lastDay, td);
    }
    const end = `${y}-${String(monthNum).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    document.getElementById('customDateStartProfit').value = start;
    document.getElementById('customDateEndProfit').value = end;
    updateCustomDateLabelProfit(start, end);
    const periodContainer = document.querySelector('.period-filter-container');
    if (periodContainer) periodContainer.dataset.active = 'custom';
    currentPeriod = 'custom';
    customDateRange = { startDate: start, endDate: end };
    loadAllData();
    closeCustomDatePickerProfit();
    showToast('Đã áp dụng bộ lọc thời gian', 'success');
}

/**
 * Close custom date picker modal
 */
function closeCustomDatePickerProfit() {
    if (customDatePickerModalProfit) {
        customDatePickerModalProfit.style.opacity = '0';
        setTimeout(() => {
            customDatePickerModalProfit.remove();
            customDatePickerModalProfit = null;
        }, 200);
    }
}

/**
 * Switch between single and range date mode
 */
function switchDateModeProfit(mode, el) {
    currentDateModeProfit = mode;
    const root = el && el.closest ? el.closest('.profit-picker-content') : null;
    const scope = root || customDatePickerModalProfit;
    if (scope) {
        scope.querySelectorAll('.date-mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
    }
    
    // Show/hide modes
    const singleMode = document.getElementById('singleDateModeProfit');
    const rangeMode = document.getElementById('rangeDateModeProfit');
    
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
function applyCustomDateProfit() {
    let startDate, endDate;
    
    if (currentDateModeProfit === 'single') {
        const singleDate = document.getElementById('singleDateInputProfit').value;
        if (!singleDate) {
            showToast('Vui lòng chọn ngày', 'warning');
            return;
        }
        startDate = singleDate;
        endDate = singleDate;
    } else {
        startDate = document.getElementById('startDateInputProfit').value;
        endDate = document.getElementById('endDateInputProfit').value;
        
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
    document.getElementById('customDateStartProfit').value = startDate;
    document.getElementById('customDateEndProfit').value = endDate;
    
    // Update button label
    updateCustomDateLabelProfit(startDate, endDate);
    
    // Update active period - CSS handles all styling automatically
    document.querySelector('.period-filter-container').dataset.active = 'custom';
    
    // Set custom period and reload data
    currentPeriod = 'custom';
    customDateRange = {
        startDate: startDate,
        endDate: endDate
    };
    
    // Reload data with custom date range
    loadAllData();
    
    // Close modal
    closeCustomDatePickerProfit();
    
    showToast('Đã áp dụng bộ lọc thời gian', 'success');
}

/**
 * Clear custom date filter
 */
function clearCustomDateProfit() {
    document.getElementById('customDateStartProfit').value = '';
    document.getElementById('customDateEndProfit').value = '';
    
    // Reset button label
    document.getElementById('customDateLabelProfit').textContent = 'Chọn ngày';
    
    // Apply default filter (week)
    changePeriod('week');
    
    // Close modal
    closeCustomDatePickerProfit();
    
    showToast('Đã xóa bộ lọc thời gian', 'info');
}

/**
 * Update custom date button label
 */
function updateCustomDateLabelProfit(startDate, endDate) {
    const label = document.getElementById('customDateLabelProfit');
    
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
