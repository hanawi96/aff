// Product Analytics Dashboard
let currentPeriod = 'all';
let currentLimit = 9999; // Show all products
let allProductsData = [];
let currentSort = { column: null, direction: null }; // null, 'asc', 'desc'

// Cache data by period for better performance with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const dataCache = {
    today: { data: null, timestamp: 0 },
    week: { data: null, timestamp: 0 },
    month: { data: null, timestamp: 0 },
    year: { data: null, timestamp: 0 },
    all: { data: null, timestamp: 0 }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('📊 Product Analytics Dashboard initialized');
    loadTopProducts();
});

// Change period
function changePeriod(period) {
    currentPeriod = period;

    // Update button styles
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.dataset.period === period) {
            btn.className = 'period-btn px-4 py-2 rounded-lg font-medium transition-all bg-indigo-600 text-white';
        } else {
            btn.className = 'period-btn px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
        }
    });

    loadTopProducts();
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

// Refresh data
function refreshData() {
    // Clear cache for current period to force reload
    dataCache[currentPeriod] = { data: null, timestamp: 0 };
    showToast('Đang làm mới dữ liệu...', 'info');
    loadTopProducts();
}

// Load top products
async function loadTopProducts() {
    try {
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

        // Show skeleton loading
        showSkeletonLoading();

        // Calculate startDate based on VN timezone for accurate filtering
        let startDateParam = '';
        if (currentPeriod === 'today') {
            const vnStartOfToday = getVNStartOfToday();
            startDateParam = `&startDate=${vnStartOfToday.toISOString()}`;
        } else if (currentPeriod === 'week') {
            const vnStartOfWeek = getVNStartOfWeek();
            startDateParam = `&startDate=${vnStartOfWeek.toISOString()}`;
        } else if (currentPeriod === 'month') {
            const vnStartOfMonth = getVNStartOfMonth();
            startDateParam = `&startDate=${vnStartOfMonth.toISOString()}`;
        } else if (currentPeriod === 'year') {
            const vnStartOfYear = getVNStartOfYear();
            startDateParam = `&startDate=${vnStartOfYear.toISOString()}`;
        }

        // Load overview data (includes top products) - Single API call for better performance
        const overviewResponse = await fetch(
            `${CONFIG.API_URL}?action=getDetailedAnalytics&period=${currentPeriod}${startDateParam}&timestamp=${Date.now()}`
        );

        const overviewData = await overviewResponse.json();

        if (overviewData.success) {
            // Cache the data for this period with timestamp
            dataCache[currentPeriod] = {
                data: overviewData,
                timestamp: Date.now()
            };
            
            console.log('✅ Data loaded and cached for', currentPeriod);
            
            // Use top_products from getDetailedAnalytics (no need for separate API call)
            allProductsData = overviewData.top_products || [];
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
        'totalProfit', 'avgProfit', 'profitMargin', 'totalCost',
        'totalCommission', 'commissionPercent', 'totalAllCosts', 'costBreakdown'
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
    document.getElementById('profitMargin').textContent = `${overview.profit_margin.toFixed(1)}%`;

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
}

// Chart instance
let pieChart = null;

// Render cost breakdown table + charts
function renderCostBreakdownTable(costs, overview) {
    const tbody = document.getElementById('costBreakdownTable');
    if (!costs || !overview) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">Không có dữ liệu</td></tr>';
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
        // Calculate startDate based on VN timezone for accurate filtering
        let startDateParam = '';
        if (currentPeriod === 'today') {
            const vnStartOfToday = getVNStartOfToday();
            startDateParam = `&startDate=${vnStartOfToday.toISOString()}`;
        } else if (currentPeriod === 'week') {
            const vnStartOfWeek = getVNStartOfWeek();
            startDateParam = `&startDate=${vnStartOfWeek.toISOString()}`;
        } else if (currentPeriod === 'month') {
            const vnStartOfMonth = getVNStartOfMonth();
            startDateParam = `&startDate=${vnStartOfMonth.toISOString()}`;
        } else if (currentPeriod === 'year') {
            const vnStartOfYear = getVNStartOfYear();
            startDateParam = `&startDate=${vnStartOfYear.toISOString()}`;
        }

        const response = await fetch(`${CONFIG.API_URL}?action=getProductStats&productId=${productId}&period=${currentPeriod}${startDateParam}&timestamp=${Date.now()}`);
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
                        <div class="text-xs text-gray-500">${escapeHtml(order.customer_name || 'N/A')} • ${formatDate(order.order_date)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-bold text-gray-900">${order.quantity}x</div>
                        <div class="text-xs text-green-600">${formatCurrency(order.subtotal || 0)}</div>
                    </div>
                </div>
            `).join('') : '<p class="text-gray-500 text-sm text-center py-4">Chưa có đơn hàng</p>';

            document.getElementById('modalRecentOrders').innerHTML = ordersHtml;

            // Show modal
            document.getElementById('productDetailModal').classList.remove('hidden');
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
    document.getElementById('productDetailModal').classList.add('hidden');
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

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
