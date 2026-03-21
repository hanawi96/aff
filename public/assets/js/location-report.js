// Location Analytics Dashboard - Smart & Optimized with AI Insights
let currentPeriod = 'all';
let currentLevel = 'province'; // province, district, ward
let currentProvinceId = null;
let currentProvinceName = null;
let currentDistrictId = null;
let currentDistrictName = null;
let allLocationData = [];
let previousPeriodData = [];
let currentSort = { column: 'revenue', direction: 'desc' };
let topChart = null;
let pieChart = null;

// Cache for better performance
const dataCache = {
    today: { province: null, district: {}, ward: {}, previous: null },
    week: { province: null, district: {}, ward: {}, previous: null },
    month: { province: null, district: {}, ward: {}, previous: null },
    quarter: { province: null, district: {}, ward: {}, previous: null },
    'half-year': { province: null, district: {}, ward: {}, previous: null },
    year: { province: null, district: {}, ward: {}, previous: null },
    all: { province: null, district: {}, ward: {}, previous: null }
};

// Analytics engine
const AnalyticsEngine = {
    // Calculate growth rate
    calculateGrowth(current, previous) {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    },

    // Detect anomalies (values significantly different from average)
    detectAnomalies(data, metric = 'revenue') {
        if (data.length < 3) return [];
        const values = data.map(d => d[metric] || 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);
        
        return data.filter(d => {
            const value = d[metric] || 0;
            return Math.abs(value - avg) > stdDev * 2; // 2 standard deviations
        }).map(d => ({
            ...d,
            deviation: ((d[metric] - avg) / avg * 100).toFixed(1)
        }));
    },

    // Find concentration (top N locations contributing X% of total)
    findConcentration(data, metric = 'revenue') {
        const sorted = [...data].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
        const total = data.reduce((sum, d) => sum + (d[metric] || 0), 0);
        
        let cumulative = 0;
        let count = 0;
        for (const item of sorted) {
            cumulative += item[metric] || 0;
            count++;
            if (cumulative / total >= 0.8) break; // 80% rule
        }
        
        return { count, percentage: (cumulative / total * 100).toFixed(1) };
    },

    // Generate smart insights
    generateInsights(currentData, previousData) {
        const insights = [];
        
        if (currentData.length === 0) return insights;

        // 1. Total metrics comparison
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

        // 2. Concentration analysis
        const concentration = this.findConcentration(currentData, 'revenue');
        if (concentration.count <= 5 && currentData.length > 10) {
            insights.push(`🎯 TOP ${concentration.count} khu vực chiếm <strong>${concentration.percentage}%</strong> tổng doanh thu`);
        }

        // 3. Top performer
        const topLocation = [...currentData].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];
        if (topLocation) {
            const topPercent = (topLocation.revenue / currentTotal.revenue * 100).toFixed(1);
            if (topPercent > 20) {
                insights.push(`👑 <strong>${topLocation.name}</strong> dẫn đầu với ${topPercent}% tổng doanh thu`);
            }
        }

        // 4. High-value customers
        const avgOrderValue = currentTotal.orders > 0 ? currentTotal.revenue / currentTotal.orders : 0;
        const highValueLocations = currentData.filter(d => (d.avgValue || 0) > avgOrderValue * 1.5);
        if (highValueLocations.length > 0 && highValueLocations.length < currentData.length * 0.3) {
            insights.push(`💎 ${highValueLocations.length} khu vực có giá trị đơn hàng cao gấp 1.5x trung bình`);
        }

        // 5. Anomalies
        const anomalies = this.detectAnomalies(currentData, 'revenue');
        if (anomalies.length > 0 && anomalies.length < 5) {
            const topAnomaly = anomalies[0];
            insights.push(`⚡ <strong>${topAnomaly.name}</strong> có doanh thu ${topAnomaly.deviation > 0 ? 'cao' : 'thấp'} bất thường (${Math.abs(topAnomaly.deviation)}% so với TB)`);
        }

        // 6. Coverage
        const totalLocations = currentData.length;
        const activeLocations = currentData.filter(d => (d.orders || 0) > 0).length;
        const coverage = (activeLocations / totalLocations * 100).toFixed(1);
        if (coverage < 50) {
            insights.push(`📍 Chỉ ${coverage}% khu vực có đơn hàng - cơ hội mở rộng thị trường`);
        }

        return insights.slice(0, 5); // Max 5 insights
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('🗺️ Location Analytics Dashboard initialized');
    console.log('📍 Initial URL:', window.location.href);
    
    // Load from URL parameters first
    const hasURLParams = loadFromURL();
    console.log('📋 Has URL params:', hasURLParams);
    console.log('📊 Initial state:', {
        level: currentLevel,
        provinceId: currentProvinceId,
        provinceName: currentProvinceName,
        districtId: currentDistrictId,
        districtName: currentDistrictName,
        period: currentPeriod
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', function(event) {
        console.log('🔙 ========== POPSTATE EVENT ==========');
        console.log('🔙 Event state:', event.state);
        console.log('🔙 Current URL:', window.location.href);
        console.log('🔙 Before restore - Current state:', {
            level: currentLevel,
            provinceId: currentProvinceId,
            provinceName: currentProvinceName,
            districtId: currentDistrictId,
            districtName: currentDistrictName,
            period: currentPeriod
        });
        
        if (event.state) {
            console.log('🔙 Restoring from event.state');
            restoreState(event.state);
        } else {
            console.log('🔙 No event.state, loading from URL');
            loadFromURL();
            loadLocationData();
        }
    });
    
    // Load data
    console.log('📥 Loading initial data...');
    loadLocationData();
});

// Load state from URL parameters
function loadFromURL() {
    console.log('📖 loadFromURL() called');
    const params = new URLSearchParams(window.location.search);
    console.log('📖 URL params:', {
        level: params.get('level'),
        provinceId: params.get('provinceId'),
        provinceName: params.get('provinceName'),
        districtId: params.get('districtId'),
        districtName: params.get('districtName'),
        period: params.get('period')
    });
    
    const level = params.get('level');
    const provinceId = params.get('provinceId');
    const provinceName = params.get('provinceName');
    const districtId = params.get('districtId');
    const districtName = params.get('districtName');
    const period = params.get('period');
    
    let hasParams = false;
    
    // Reset to defaults first
    if (!period) {
        console.log('📖 No period param, using default: all');
        currentPeriod = 'all';
    } else {
        console.log('📖 Setting period:', period);
        currentPeriod = period;
        hasParams = true;
    }
    
    if (!level) {
        console.log('📖 No level param, resetting to province');
        currentLevel = 'province';
        currentProvinceId = null;
        currentProvinceName = null;
        currentDistrictId = null;
        currentDistrictName = null;
    } else {
        console.log('📖 Setting level:', level);
        currentLevel = level;
        hasParams = true;
        
        // Only set province/district if level requires it
        if (level === 'district' || level === 'ward') {
            if (provinceId) {
                console.log('📖 Setting province:', provinceId, provinceName);
                currentProvinceId = provinceId;
                currentProvinceName = provinceName ? decodeURIComponent(provinceName) : null;
            } else {
                console.log('⚠️ Level requires province but no provinceId, resetting to province level');
                currentLevel = 'province';
                currentProvinceId = null;
                currentProvinceName = null;
            }
        } else {
            // Province level - clear province/district
            currentProvinceId = null;
            currentProvinceName = null;
            currentDistrictId = null;
            currentDistrictName = null;
        }
        
        if (level === 'ward') {
            if (districtId) {
                console.log('📖 Setting district:', districtId, districtName);
                currentDistrictId = districtId;
                currentDistrictName = districtName ? decodeURIComponent(districtName) : null;
            } else {
                console.log('⚠️ Level requires district but no districtId, falling back to district level');
                currentLevel = 'district';
                currentDistrictId = null;
                currentDistrictName = null;
            }
        } else {
            // Not ward level - clear district
            currentDistrictId = null;
            currentDistrictName = null;
        }
    }
    
    console.log('📖 After loadFromURL - State:', {
        level: currentLevel,
        provinceId: currentProvinceId,
        provinceName: currentProvinceName,
        districtId: currentDistrictId,
        districtName: currentDistrictName,
        period: currentPeriod
    });
    
    // Update UI
    updatePeriodButtons();
    updateBreadcrumb();
    
    return hasParams;
}

// Update period buttons UI - CSS-driven approach
function updatePeriodButtons() {
    const container = document.querySelector('.period-filter-container');
    if (container) {
        container.dataset.active = currentPeriod;
    }
}

// Update URL without reload
function updateURL() {
    console.log('🔗 updateURL() called');
    const params = new URLSearchParams();
    
    // Always include period
    params.set('period', currentPeriod);
    
    // Add level-specific params
    params.set('level', currentLevel);
    
    if (currentLevel === 'district' || currentLevel === 'ward') {
        params.set('provinceId', currentProvinceId);
        params.set('provinceName', encodeURIComponent(currentProvinceName));
    }
    
    if (currentLevel === 'ward') {
        params.set('districtId', currentDistrictId);
        params.set('districtName', encodeURIComponent(currentDistrictName));
    }
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    
    // Save state for back/forward navigation
    const state = {
        level: currentLevel,
        provinceId: currentProvinceId,
        provinceName: currentProvinceName,
        districtId: currentDistrictId,
        districtName: currentDistrictName,
        period: currentPeriod
    };
    
    console.log('🔗 Pushing state:', state);
    console.log('🔗 New URL:', newURL);
    window.history.pushState(state, '', newURL);
}

// Restore state from history
function restoreState(state) {
    console.log('🔄 restoreState() called with:', state);
    
    currentLevel = state.level || 'province';
    currentProvinceId = state.provinceId || null;
    currentProvinceName = state.provinceName || null;
    currentDistrictId = state.districtId || null;
    currentDistrictName = state.districtName || null;
    currentPeriod = state.period || 'all';
    
    console.log('🔄 After restore - State:', {
        level: currentLevel,
        provinceId: currentProvinceId,
        provinceName: currentProvinceName,
        districtId: currentDistrictId,
        districtName: currentDistrictName,
        period: currentPeriod
    });
    
    // Clear cache to force reload
    const cacheKey = currentLevel === 'province' ? 'province' :
                    currentLevel === 'district' ? currentProvinceId :
                    `${currentProvinceId}_${currentDistrictId}`;
    
    console.log('🔄 Clearing cache for:', cacheKey);
    
    if (currentLevel === 'province') {
        dataCache[currentPeriod].province = null;
    } else if (currentLevel === 'district') {
        dataCache[currentPeriod].district[cacheKey] = null;
    } else {
        dataCache[currentPeriod].ward[cacheKey] = null;
    }
    
    console.log('🔄 Updating UI...');
    updatePeriodButtons();
    updateBreadcrumb();
    
    console.log('🔄 Loading location data...');
    loadLocationData();
}

// Update breadcrumb UI
function updateBreadcrumb() {
    const breadcrumbRoot = document.getElementById('breadcrumb');
    if (currentLevel === 'province') {
        if (breadcrumbRoot) {
            breadcrumbRoot.classList.add('hidden');
            breadcrumbRoot.classList.remove('flex');
        }
        document.getElementById('breadcrumbArrow1').classList.add('hidden');
        document.getElementById('breadcrumbDistrict').classList.add('hidden');
        document.getElementById('breadcrumbArrow2').classList.add('hidden');
        document.getElementById('breadcrumbWard').classList.add('hidden');
        
        document.getElementById('tableTitle').textContent = 'Danh sách Tỉnh/Thành phố';
        document.getElementById('tableSubtitle').textContent = 'Click vào tỉnh để xem chi tiết quận/huyện';
        document.getElementById('locationColumnName').textContent = 'Tỉnh/Thành phố';
    } else if (currentLevel === 'district') {
        if (breadcrumbRoot) {
            breadcrumbRoot.classList.remove('hidden');
            breadcrumbRoot.classList.add('flex');
        }
        document.getElementById('breadcrumbArrow1').classList.remove('hidden');
        document.getElementById('breadcrumbDistrict').classList.remove('hidden');
        document.getElementById('breadcrumbDistrict').textContent = currentProvinceName;
        document.getElementById('breadcrumbArrow2').classList.add('hidden');
        document.getElementById('breadcrumbWard').classList.add('hidden');
        
        document.getElementById('tableTitle').textContent = `Danh sách Quận/Huyện - ${currentProvinceName}`;
        document.getElementById('tableSubtitle').textContent = 'Click vào quận để xem chi tiết phường/xã';
        document.getElementById('locationColumnName').textContent = 'Quận/Huyện';
    } else if (currentLevel === 'ward') {
        if (breadcrumbRoot) {
            breadcrumbRoot.classList.remove('hidden');
            breadcrumbRoot.classList.add('flex');
        }
        document.getElementById('breadcrumbArrow1').classList.remove('hidden');
        document.getElementById('breadcrumbDistrict').classList.remove('hidden');
        document.getElementById('breadcrumbDistrict').textContent = currentProvinceName;
        document.getElementById('breadcrumbArrow2').classList.remove('hidden');
        document.getElementById('breadcrumbWard').classList.remove('hidden');
        document.getElementById('breadcrumbWard').textContent = currentDistrictName;
        
        document.getElementById('tableTitle').textContent = `Danh sách Phường/Xã - ${currentDistrictName}`;
        document.getElementById('tableSubtitle').textContent = 'Chi tiết theo phường/xã';
        document.getElementById('locationColumnName').textContent = 'Phường/Xã';
    }
}

/** Breadcrumb: tên tỉnh — ở cấp phường thì về danh sách quận; ở cấp quận thì về danh sách tỉnh */
function handleBreadcrumbProvinceClick() {
    if (currentLevel === 'ward') {
        goToLevel('district');
    } else {
        goToLevel('province');
    }
}

// Change period
function changePeriod(period) {
    currentPeriod = period;
    updatePeriodButtons();
    updateURL();
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
    
    // Also clear previous data cache
    dataCache[currentPeriod].previous = null;
    
    showToast('Đang làm mới dữ liệu...', 'info');
    loadLocationData();
}

// Load location data based on current level
async function loadLocationData() {
    console.log('📥 ========== loadLocationData() START ==========');
    console.log('📥 Current state:', {
        level: currentLevel,
        provinceId: currentProvinceId,
        provinceName: currentProvinceName,
        districtId: currentDistrictId,
        districtName: currentDistrictName,
        period: currentPeriod
    });
    
    try {
        showSkeletonLoading();

        // Check cache first
        const cacheKey = currentLevel === 'province' ? 'province' :
                        currentLevel === 'district' ? currentProvinceId :
                        `${currentProvinceId}_${currentDistrictId}`;
        
        const cachedData = currentLevel === 'province' ? dataCache[currentPeriod].province :
                          currentLevel === 'district' ? dataCache[currentPeriod].district[cacheKey] :
                          dataCache[currentPeriod].ward[cacheKey];

        const cachedPrevious = dataCache[currentPeriod].previous;

        if (cachedData && cachedPrevious) {
            console.log('📦 Using cached data for:', cacheKey);
            console.log('📦 Cached data length:', cachedData.length);
            allLocationData = cachedData;
            previousPeriodData = cachedPrevious;
            renderLocationData();
            console.log('📥 ========== loadLocationData() END (cached) ==========');
            return;
        }
        
        console.log('🌐 No cache, fetching from API...');

        // Calculate date ranges for current and previous period
        const { startDate, previousStartDate, previousEndDate } = calculateDateRanges(currentPeriod);
        
        let startDateParam = startDate ? `&startDate=${startDate.toISOString()}` : '';
        let previousParams = '';
        if (previousStartDate && previousEndDate) {
            previousParams = `&previousStartDate=${previousStartDate.toISOString()}&previousEndDate=${previousEndDate.toISOString()}`;
        }

        // Build API URL based on level
        let apiUrl = `${CONFIG.API_URL}?action=getLocationStats&level=${currentLevel}&period=${currentPeriod}${startDateParam}${previousParams}&timestamp=${Date.now()}`;
        
        if (currentLevel === 'district' && currentProvinceId) {
            apiUrl += `&provinceId=${currentProvinceId}`;
        } else if (currentLevel === 'ward' && currentProvinceId && currentDistrictId) {
            apiUrl += `&provinceId=${currentProvinceId}&districtId=${currentDistrictId}`;
        }

        console.log('🌐 API URL:', apiUrl);
        const response = await fetch(apiUrl);
        const data = await response.json();
        console.log('🌐 API Response:', data);

        if (data.success) {
            console.log('✅ API Success - Locations:', data.locations?.length);
            console.log('✅ Unique customers:', data.uniqueCustomers);
            allLocationData = data.locations || [];
            previousPeriodData = data.previousLocations || [];
            
            // Store unique customers count from API
            window.uniqueCustomersCount = data.uniqueCustomers || 0;
            
            // Calculate growth for each location
            allLocationData = allLocationData.map(loc => {
                const prevLoc = previousPeriodData.find(p => p.id === loc.id);
                const growth = prevLoc ? AnalyticsEngine.calculateGrowth(loc.revenue, prevLoc.revenue) : 0;
                return { ...loc, growth };
            });
            
            // Cache the data
            if (currentLevel === 'province') {
                dataCache[currentPeriod].province = allLocationData;
            } else if (currentLevel === 'district') {
                dataCache[currentPeriod].district[cacheKey] = allLocationData;
            } else {
                dataCache[currentPeriod].ward[cacheKey] = allLocationData;
            }
            dataCache[currentPeriod].previous = previousPeriodData;

            console.log('📥 Rendering location data...');
            renderLocationData();
            console.log('📥 ========== loadLocationData() END (API) ==========');
        } else {
            throw new Error(data.error || 'Failed to load location data');
        }
    } catch (error) {
        console.error('❌ Error loading location data:', error);
        showToast('Không thể tải dữ liệu', 'error');
        hideSkeletonLoading();
    }
}

// Calculate date ranges for comparison
function calculateDateRanges(period) {
    const now = new Date();
    let startDate = null;
    let previousStartDate = null;
    let previousEndDate = null;

    if (period === 'today') {
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
        // 3 months ago from today (in VN timezone)
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        startDate = new Date(vnToday);
        startDate.setMonth(startDate.getMonth() - 3);
        // Previous period: 6 months ago to 3 months ago
        previousStartDate = new Date(startDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 3);
        previousEndDate = new Date(startDate);
        previousEndDate.setMilliseconds(-1);
    } else if (period === 'half-year') {
        // 6 months ago from today (in VN timezone)
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnToday = new Date(vnDateStr + 'T00:00:00+07:00');
        startDate = new Date(vnToday);
        startDate.setMonth(startDate.getMonth() - 6);
        // Previous period: 12 months ago to 6 months ago
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

    return { startDate, previousStartDate, previousEndDate };
}

// Render location data (table + charts + stats)
function renderLocationData() {
    updateSummaryStats();
    renderInsights();
    renderLocationTable();
    renderCharts();
    hideSkeletonLoading();
}

// Render AI insights
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
        
        // Add fade-in animation
        banner.style.opacity = '0';
        setTimeout(() => {
            banner.style.transition = 'opacity 0.5s ease-in';
            banner.style.opacity = '1';
        }, 100);
    } else {
        banner.classList.add('hidden');
    }
}

// Update summary stats with comparison
function updateSummaryStats() {
    const totalOrders = allLocationData.reduce((sum, loc) => sum + (loc.orders || 0), 0);
    const totalRevenue = allLocationData.reduce((sum, loc) => sum + (loc.revenue || 0), 0);
    // Use unique customers count from API instead of summing (to avoid double counting)
    const totalCustomers = window.uniqueCustomersCount || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('totalOrders').textContent = formatNumber(totalOrders);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalCustomers').textContent = formatNumber(totalCustomers);
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrderValue);

    // Calculate and show changes
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

// Show change indicator
function showChange(elementId, current, previous) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const growth = AnalyticsEngine.calculateGrowth(current, previous);
    const isPositive = growth > 0;
    const isNegative = growth < 0;
    
    if (Math.abs(growth) < 0.1) {
        element.innerHTML = '<span class="text-slate-400">~</span>';
        return;
    }
    
    const color = isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400';
    const arrow = isPositive ? '↑' : isNegative ? '↓' : '';
    element.innerHTML = `<span class="${color}">${arrow}${Math.abs(growth).toFixed(1)}%</span>`;
}

// Render location table
function renderLocationTable() {
    const tbody = document.getElementById('locationTableBody');
    
    if (allLocationData.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="px-6 py-16 text-center">
                <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
                    <svg class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.25"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.125-9 12.75-9 12.75S1.5 17.625 1.5 10.5a9 9 0 1118 0z" /></svg>
                </div>
                <p class="text-base font-semibold text-slate-800">Chưa có dữ liệu</p>
                <p class="mt-2 text-sm text-slate-500">Thử chọn khoảng thời gian khác</p>
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
                case 'growth': aVal = a.growth || 0; bVal = b.growth || 0; break;
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
        const growth = location.growth || 0;
        
        // Determine if can drill down
        const canDrillDown = (currentLevel === 'province') || (currentLevel === 'district');
        const drillDownAction = canDrillDown ? 
            (currentLevel === 'province' ? `onclick="drillDownToDistrict('${location.id}', '${escapeHtml(location.name)}')"` : 
             `onclick="drillDownToWard('${location.id}', '${escapeHtml(location.name)}')"`) : '';

        // Growth badge
        let growthBadge = '<span class="text-xs text-slate-400">-</span>';
        if (Math.abs(growth) > 0.1) {
            const isPositive = growth > 0;
            const color = isPositive ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-800 ring-1 ring-rose-100';
            const arrow = isPositive ? '↑' : '↓';
            growthBadge = `<span class="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${color}">${arrow}${Math.abs(growth).toFixed(1)}%</span>`;
        }

        return `
            <tr class="group transition-colors hover:bg-slate-50/90 ${canDrillDown ? 'cursor-pointer' : ''}" ${drillDownAction}>
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
                <td class="whitespace-nowrap px-5 py-4 text-center">
                    ${canDrillDown ? `
                        <span class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:text-violet-700">
                            Xem chi tiết
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        </span>
                    ` : '<span class="text-xs text-slate-400">-</span>'}
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
    
    updateBreadcrumb();
    updateURL();
    loadLocationData();
}

// Drill down to ward level
function drillDownToWard(districtId, districtName) {
    currentLevel = 'ward';
    currentDistrictId = districtId;
    currentDistrictName = districtName;
    
    updateBreadcrumb();
    updateURL();
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
        
        updateBreadcrumb();
        updateURL();
        loadLocationData();
    } else if (level === 'district' && currentProvinceId) {
        currentLevel = 'district';
        currentDistrictId = null;
        currentDistrictName = null;
        
        updateBreadcrumb();
        updateURL();
        loadLocationData();
    }
}



// Toggle sort
function toggleSort(column) {
    const allSortIcons = ['name', 'orders', 'revenue', 'customers', 'avgValue', 'growth'];
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
        <tr><td colspan="9" class="px-6 py-14 text-center">
            <div class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
            <p class="text-sm text-slate-500">Đang tải dữ liệu...</p>
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

// showToast is now provided by toast-manager.js

// Export to Excel (placeholder for future implementation)
function exportToExcel() {
    showToast('Tính năng Export đang được phát triển', 'info');
    // TODO: Implement Excel export using SheetJS or similar library
    // Include: Summary stats, insights, full table data, charts as images
}

// Performance monitoring
const PerformanceMonitor = {
    startTime: null,
    
    start() {
        this.startTime = performance.now();
    },
    
    end(label) {
        if (this.startTime) {
            const duration = (performance.now() - this.startTime).toFixed(2);
            console.log(`⚡ ${label}: ${duration}ms`);
            this.startTime = null;
        }
    }
};

// Add performance monitoring to loadLocationData
const originalLoadLocationData = loadLocationData;
loadLocationData = async function() {
    PerformanceMonitor.start();
    await originalLoadLocationData();
    PerformanceMonitor.end('Load Location Data');
};
