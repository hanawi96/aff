// Location Analytics Dashboard - Smart & Optimized
let currentPeriod = 'all';
let currentLevel = 'province'; // province, district, ward
let currentProvinceId = null;
let currentProvinceName = null;
let currentDistrictId = null;
let currentDistrictName = null;
let allLocationData = [];
let currentSort = { column: 'revenue', direction: 'desc' };
let topChart = null;
let pieChart = null;

// Cache for better performance
const dataCache = {
    today: { province: null, district: {}, ward: {} },
    week: { province: null, district: {}, ward: {} },
    month: { province: null, district: {}, ward: {} },
    year: { province: null, district: {}, ward: {} },
    all: { province: null, district: {}, ward: {} }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('🗺️ Location Analytics Dashboard initialized');
    loadLocationData();
});

// Change period
function changePeriod(period) {
    currentPeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.dataset.period === period) {
            btn.className = 'period-btn px-4 py-2 rounded-lg font-medium transition-all bg-indigo-600 text-white';
        } else {
            btn.className = 'period-btn px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
        }
    });
    loadLocationData();
}

// Refresh data
function refreshData() {
    // Clear cache for current period
    if (currentLevel === 'province') {
        dataCache[currentPeriod].province = null;
    } else if (currentLevel === 'district') {
        dataCache[currentPeriod].district[currentProvinceId] = null;
    } else if (currentLevel === 'ward') {
        dataCache[currentPeriod].ward[`${currentProvinceId}_${currentDistrictId}`] = null;
    }
    showToast('Đang làm mới dữ liệu...', 'info');
    loadLocationData();
}

// Load location data based on current level
async function loadLocationData() {
    try {
        showSkeletonLoading();

        // Check cache first
        const cacheKey = currentLevel === 'province' ? 'province' :
                        currentLevel === 'district' ? currentProvinceId :
                        `${currentProvinceId}_${currentDistrictId}`;
        
        const cachedData = currentLevel === 'province' ? dataCache[currentPeriod].province :
                          currentLevel === 'district' ? dataCache[currentPeriod].district[cacheKey] :
                          dataCache[currentPeriod].ward[cacheKey];

        if (cachedData) {
            console.log('📦 Using cached data');
            allLocationData = cachedData;
            renderLocationData();
            return;
        }

        // Calculate startDate for filtering
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

        // Build API URL based on level
        let apiUrl = `${CONFIG.API_URL}?action=getLocationStats&level=${currentLevel}&period=${currentPeriod}${startDateParam}&timestamp=${Date.now()}`;
        
        if (currentLevel === 'district' && currentProvinceId) {
            apiUrl += `&provinceId=${currentProvinceId}`;
        } else if (currentLevel === 'ward' && currentProvinceId && currentDistrictId) {
            apiUrl += `&provinceId=${currentProvinceId}&districtId=${currentDistrictId}`;
        }

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.success) {
            allLocationData = data.locations || [];
            
            // Cache the data
            if (currentLevel === 'province') {
                dataCache[currentPeriod].province = allLocationData;
            } else if (currentLevel === 'district') {
                dataCache[currentPeriod].district[cacheKey] = allLocationData;
            } else {
                dataCache[currentPeriod].ward[cacheKey] = allLocationData;
            }

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

// Render location data (table + charts + stats)
function renderLocationData() {
    updateSummaryStats();
    renderLocationTable();
    renderCharts();
    hideSkeletonLoading();
}

// Update summary stats
function updateSummaryStats() {
    const totalOrders = allLocationData.reduce((sum, loc) => sum + (loc.orders || 0), 0);
    const totalRevenue = allLocationData.reduce((sum, loc) => sum + (loc.revenue || 0), 0);
    const totalCustomers = allLocationData.reduce((sum, loc) => sum + (loc.customers || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('totalOrders').textContent = formatNumber(totalOrders);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalCustomers').textContent = formatNumber(totalCustomers);
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrderValue);
}

// Render location table
function renderLocationTable() {
    const tbody = document.getElementById('locationTableBody');
    
    if (allLocationData.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                    <div class="text-6xl mb-4">📍</div>
                    <p class="text-gray-500 text-lg">Chưa có dữ liệu</p>
                    <p class="text-gray-400 text-sm mt-2">Thử chọn khoảng thời gian khác</p>
                </div>
            </td></tr>
        `;
        return;
    }

    // Sort data
    let sortedData = [...allLocationData];
    if (currentSort.column && currentSort.direction) {
        sortedData.sort((a, b) => {
            let aVal, bVal;
            switch (currentSort.column) {
                case 'name': aVal = a.name || ''; bVal = b.name || ''; break;
                case 'orders': aVal = a.orders || 0; bVal = b.orders || 0; break;
                case 'revenue': aVal = a.revenue || 0; bVal = b.revenue || 0; break;
                case 'customers': aVal = a.customers || 0; bVal = b.customers || 0; break;
                case 'avgValue': aVal = a.avgValue || 0; bVal = b.avgValue || 0; break;
                default: return 0;
            }
            if (currentSort.column === 'name') {
                return currentSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }

    const totalRevenue = allLocationData.reduce((sum, loc) => sum + (loc.revenue || 0), 0);

    tbody.innerHTML = sortedData.map((location, index) => {
        const rank = index + 1;
        const rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const revenuePercent = totalRevenue > 0 ? (location.revenue / totalRevenue * 100) : 0;
        
        // Determine if can drill down
        const canDrillDown = (currentLevel === 'province') || (currentLevel === 'district');
        const drillDownAction = canDrillDown ? 
            (currentLevel === 'province' ? `onclick="drillDownToDistrict('${location.id}', '${escapeHtml(location.name)}')"` : 
             `onclick="drillDownToWard('${location.id}', '${escapeHtml(location.name)}')"`) : '';

        return `
            <tr class="hover:bg-gray-50 transition-colors ${canDrillDown ? 'cursor-pointer' : ''}" ${drillDownAction}>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-2xl font-bold text-gray-900">${rankDisplay}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                            ${location.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="text-sm font-medium text-gray-900">${escapeHtml(location.name)}</div>
                            <div class="text-xs text-gray-500">${location.orders || 0} đơn hàng</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-bold text-gray-900">${formatNumber(location.orders || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-bold text-green-600">${formatCurrency(location.revenue || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-medium text-purple-600">${formatNumber(location.customers || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-medium text-orange-600">${formatCurrency(location.avgValue || 0)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="flex justify-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${revenuePercent > 10 ? 'bg-green-100 text-green-800' : revenuePercent > 5 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
                            ${revenuePercent.toFixed(1)}%
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${canDrillDown ? `
                        <button class="text-indigo-600 hover:text-indigo-900 font-medium text-sm flex items-center gap-1 mx-auto">
                            Xem chi tiết
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    ` : '<span class="text-gray-400 text-xs">-</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Render charts
function renderCharts() {
    // Top 10 locations bar chart
    const top10 = [...allLocationData]
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 10);

    const topCtx = document.getElementById('topLocationsChart');
    if (topChart) topChart.destroy();
    
    topChart = new Chart(topCtx, {
        type: 'bar',
        data: {
            labels: top10.map(loc => loc.name),
            datasets: [{
                label: 'Doanh thu',
                data: top10.map(loc => loc.revenue || 0),
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Doanh thu: ${formatCurrency(ctx.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });

    // Revenue distribution pie chart
    const pieCtx = document.getElementById('revenueDistributionChart');
    if (pieChart) pieChart.destroy();

    const colors = [
        '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
        '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#6B7280'
    ];

    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: top10.map(loc => loc.name),
            datasets: [{
                data: top10.map(loc => loc.revenue || 0),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = ((ctx.raw / total) * 100).toFixed(1);
                            return `${ctx.label}: ${formatCurrency(ctx.raw)} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Drill down to district level
function drillDownToDistrict(provinceId, provinceName) {
    currentLevel = 'district';
    currentProvinceId = provinceId;
    currentProvinceName = provinceName;
    
    // Update breadcrumb
    document.getElementById('breadcrumbArrow1').classList.remove('hidden');
    document.getElementById('breadcrumbDistrict').classList.remove('hidden');
    document.getElementById('breadcrumbDistrict').textContent = provinceName;
    
    // Update table title
    document.getElementById('tableTitle').textContent = `Danh sách Quận/Huyện - ${provinceName}`;
    document.getElementById('tableSubtitle').textContent = 'Click vào quận để xem chi tiết phường/xã';
    document.getElementById('locationColumnName').textContent = 'Quận/Huyện';
    
    loadLocationData();
}

// Drill down to ward level
function drillDownToWard(districtId, districtName) {
    currentLevel = 'ward';
    currentDistrictId = districtId;
    currentDistrictName = districtName;
    
    // Update breadcrumb
    document.getElementById('breadcrumbArrow2').classList.remove('hidden');
    document.getElementById('breadcrumbWard').classList.remove('hidden');
    document.getElementById('breadcrumbWard').textContent = districtName;
    
    // Update table title
    document.getElementById('tableTitle').textContent = `Danh sách Phường/Xã - ${districtName}`;
    document.getElementById('tableSubtitle').textContent = 'Chi tiết theo phường/xã';
    document.getElementById('locationColumnName').textContent = 'Phường/Xã';
    
    loadLocationData();
}

// Go back to specific level
function goToLevel(level) {
    if (level === 'province') {
        currentLevel = 'province';
        currentProvinceId = null;
        currentProvinceName = null;
        currentDistrictId = null;
        currentDistrictName = null;
        
        // Reset breadcrumb
        document.getElementById('breadcrumbArrow1').classList.add('hidden');
        document.getElementById('breadcrumbDistrict').classList.add('hidden');
        document.getElementById('breadcrumbArrow2').classList.add('hidden');
        document.getElementById('breadcrumbWard').classList.add('hidden');
        
        // Reset table title
        document.getElementById('tableTitle').textContent = 'Danh sách Tỉnh/Thành phố';
        document.getElementById('tableSubtitle').textContent = 'Click vào tỉnh để xem chi tiết quận/huyện';
        document.getElementById('locationColumnName').textContent = 'Tỉnh/Thành phố';
        
        loadLocationData();
    } else if (level === 'district' && currentProvinceId) {
        currentLevel = 'district';
        currentDistrictId = null;
        currentDistrictName = null;
        
        // Update breadcrumb
        document.getElementById('breadcrumbArrow2').classList.add('hidden');
        document.getElementById('breadcrumbWard').classList.add('hidden');
        
        // Update table title
        document.getElementById('tableTitle').textContent = `Danh sách Quận/Huyện - ${currentProvinceName}`;
        document.getElementById('tableSubtitle').textContent = 'Click vào quận để xem chi tiết phường/xã';
        document.getElementById('locationColumnName').textContent = 'Quận/Huyện';
        
        loadLocationData();
    }
}

// Toggle sort
function toggleSort(column) {
    const allSortIcons = ['name', 'orders', 'revenue', 'customers', 'avgValue'];
    allSortIcons.forEach(col => {
        if (col !== column) {
            const icon = document.getElementById(`sort-${col}`);
            if (icon) {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
                icon.classList.remove('text-indigo-600');
            }
        }
    });

    if (currentSort.column === column) {
        if (currentSort.direction === 'asc') {
            currentSort.direction = 'desc';
        } else if (currentSort.direction === 'desc') {
            currentSort = { column: null, direction: null };
        }
    } else {
        currentSort = { column, direction: 'asc' };
    }

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

    renderLocationTable();
}

// Filter table by search
function filterTable() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#locationTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Utility functions
function showSkeletonLoading() {
    const tbody = document.getElementById('locationTableBody');
    tbody.innerHTML = `
        <tr><td colspan="8" class="px-6 py-12 text-center">
            <div class="flex flex-col items-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-500">Đang tải dữ liệu...</p>
            </div>
        </td></tr>
    `;
}

function hideSkeletonLoading() {
    // Data will replace skeleton
}

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

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
