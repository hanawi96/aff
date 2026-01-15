/**
 * Orders Chart
 * Extracted from orders.js
 * 
 * Dependencies:
 * - Chart.js library
 * - CONFIG.API_URL from config.js
 */

// ============================================
// ORDERS CHART FUNCTIONS
// ============================================

// Chart variables
let ordersChart = null;
const ordersChartCache = {
    today: { data: null, timestamp: 0 },
    week: { data: null, timestamp: 0 },
    month: { data: null, timestamp: 0 },
    year: { data: null, timestamp: 0 }
};
const CHART_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Load orders chart data
async function loadOrdersChart() {
    // Get current period from date filter
    const currentPeriod = document.getElementById('dateFilter')?.value || 'week';

    // Skip if period is 'all'
    if (currentPeriod === 'all') {
        hideOrdersChart();
        return;
    }

    try {
        showOrdersChart();

        // Check cache
        const now = Date.now();
        const cache = ordersChartCache[currentPeriod];

        if (cache.data && (now - cache.timestamp) < CHART_CACHE_TTL) {
            console.log('📦 Using cached orders chart data for', currentPeriod);
            renderOrdersChart(cache.data);
            return;
        }

        // Show loading
        const loadingEl = document.getElementById('ordersChartLoading');
        const containerEl = document.getElementById('ordersChartContainer');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (containerEl) containerEl.classList.add('hidden');

        // Fetch data
        const response = await fetch(`${CONFIG.API_URL}?action=getOrdersChart&period=${currentPeriod}&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            // Cache data
            ordersChartCache[currentPeriod] = {
                data: data,
                timestamp: now
            };

            renderOrdersChart(data);
        } else {
            throw new Error(data.error || 'Failed to load chart data');
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
                    <p class="text-gray-500">Không thể tải biểu đồ</p>
                    <button onclick="loadOrdersChart()" class="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium">Thử lại</button>
                </div>
            `;
        }
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
    }

    // Create chart
    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: periodLabel,
                    data: data.currentPeriod.total,
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
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
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
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y + ' đơn';

                            return label;
                        },
                        footer: function (tooltipItems) {
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
                        callback: function (value) {
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

// Update comparison cards
function updateOrdersComparisonCards(data) {
    // Total change
    const totalEl = document.getElementById('chartTotalChange');
    if (totalEl) {
        const totalChange = data.comparison.totalChange;
        totalEl.textContent = (totalChange >= 0 ? '+' : '') + totalChange.toFixed(1) + '%';
        totalEl.className = 'text-lg font-bold ' + (totalChange >= 0 ? 'text-green-600' : 'text-red-600');
    }

    // Delivery rate
    const deliveryEl = document.getElementById('chartDeliveryRate');
    if (deliveryEl) {
        deliveryEl.textContent = data.currentPeriod.deliveryRate.toFixed(1) + '%';
    }

    // Cancel rate
    const cancelEl = document.getElementById('chartCancelRate');
    if (cancelEl) {
        cancelEl.textContent = data.currentPeriod.cancelRate.toFixed(1) + '%';
    }
}

// Hide chart when period is 'all'
function hideOrdersChart() {
    const chartSection = document.querySelector('.bg-white.rounded-lg.border.border-gray-200.overflow-hidden.mb-6');
    if (chartSection && chartSection.querySelector('#ordersChart')) {
        chartSection.style.display = 'none';
    }
}

// Show chart
function showOrdersChart() {
    const chartSection = document.querySelector('.bg-white.rounded-lg.border.border-gray-200.overflow-hidden.mb-6');
    if (chartSection && chartSection.querySelector('#ordersChart')) {
        chartSection.style.display = 'block';
    }
}
