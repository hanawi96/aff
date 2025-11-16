// Customers Management JavaScript
let allCustomers = [];
let filteredCustomers = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Customers Management initialized');
    loadCustomers();
    setupEventListeners();
    setupKeyboardShortcuts();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchCustomers, 300));
    }

    const segmentFilter = document.getElementById('segmentFilter');
    if (segmentFilter) {
        segmentFilter.addEventListener('change', filterBySegment);
    }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape') {
            closeCustomerModal();
        }
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load all customers
async function loadCustomers() {
    try {
        showLoading();
        
        const response = await fetch(`${CONFIG.API_URL}?action=getAllCustomers&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            allCustomers = data.customers || [];
            filteredCustomers = [...allCustomers];
            updateStats();
            renderCustomers();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load customers');
        }
    } catch (error) {
        console.error('❌ Error loading customers:', error);
        hideLoading();
        showError('Không thể tải danh sách khách hàng');
    }
}

// Search customers
async function searchCustomers() {
    const searchTerm = document.getElementById('searchInput')?.value || '';
    
    if (!searchTerm.trim()) {
        filteredCustomers = [...allCustomers];
        filterBySegment(); // Apply segment filter
        return;
    }
    
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=searchCustomers&q=${encodeURIComponent(searchTerm)}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            filteredCustomers = data.customers || [];
            filterBySegment(); // Apply segment filter
        }
    } catch (error) {
        console.error('Error searching customers:', error);
    }
}

// Filter by segment
function filterBySegment() {
    const segment = document.getElementById('segmentFilter')?.value || 'all';
    
    if (segment === 'all') {
        renderCustomers();
        return;
    }
    
    const filtered = filteredCustomers.filter(customer => customer.segment === segment);
    renderCustomersFiltered(filtered);
}

// Update statistics
function updateStats() {
    // Total customers
    document.getElementById('totalCustomers').textContent = allCustomers.length;
    
    // New customers (first order within 30 days)
    const newCustomers = allCustomers.filter(c => c.days_since_first_order <= 30);
    document.getElementById('newCustomers').textContent = newCustomers.length;
    
    // Total revenue
    const totalRevenue = allCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    
    // Average order value
    const totalOrders = allCustomers.reduce((sum, c) => sum + (c.total_orders || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrderValue);
}

// Render customers table
function renderCustomers() {
    renderCustomersFiltered(filteredCustomers);
}

function renderCustomersFiltered(customers) {
    const tbody = document.getElementById('customersTableBody');
    
    if (!tbody) return;
    
    if (customers.length === 0) {
        showEmptyState();
        return;
    }
    
    tbody.innerHTML = customers.map((customer, index) => createCustomerRow(customer, index + 1)).join('');
    showTable();
}

// Create customer row HTML
function createCustomerRow(customer, index) {
    const segmentBadges = {
        'VIP': '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">🌟 VIP</span>',
        'Regular': '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">💚 Regular</span>',
        'New': '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">🆕 New</span>',
        'At Risk': '<span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">⚠️ At Risk</span>',
        'Churned': '<span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">💤 Churned</span>'
    };

    const lastOrderText = customer.days_since_last_order !== null
        ? formatDaysAgo(customer.days_since_last_order)
        : 'Chưa có đơn';

    return `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${index}</td>
            <td class="px-4 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span class="text-white font-semibold text-sm">${getInitials(customer.name)}</span>
                    </div>
                    <div class="ml-3">
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(customer.name)}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(customer.address || 'Chưa có địa chỉ')}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 font-mono">${escapeHtml(customer.phone)}</div>
            </td>
            <td class="px-4 py-4 whitespace-nowrap">
                ${segmentBadges[customer.segment] || segmentBadges['New']}
            </td>
            <td class="px-4 py-4 whitespace-nowrap">
                <div class="text-sm font-semibold text-gray-900">${customer.total_orders}</div>
            </td>
            <td class="px-4 py-4 whitespace-nowrap">
                <div class="text-sm font-bold text-green-600">${formatCurrency(customer.total_spent)}</div>
                <div class="text-xs text-gray-500">TB: ${formatCurrency(customer.avg_order_value)}</div>
            </td>
            <td class="px-4 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${lastOrderText}</div>
            </td>
            <td class="px-4 py-4 whitespace-nowrap text-center">
                <button onclick="viewCustomerDetail('${escapeHtml(customer.phone)}')"
                    class="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                    <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Chi tiết
                </button>
            </td>
        </tr>
    `;
}

// View customer detail
async function viewCustomerDetail(phone) {
    try {
        showToast('Đang tải...', 'info');
        
        const response = await fetch(`${CONFIG.API_URL}?action=getCustomerDetail&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            showCustomerModal(data.customer);
        } else {
            throw new Error(data.error || 'Không thể tải thông tin khách hàng');
        }
    } catch (error) {
        console.error('Error loading customer detail:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Show customer detail modal
function showCustomerModal(customer) {
    const modal = document.createElement('div');
    modal.id = 'customerModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    const segmentBadges = {
        'VIP': '<span class="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">🌟 VIP</span>',
        'Regular': '<span class="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">💚 Regular</span>',
        'New': '<span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">🆕 New</span>',
        'At Risk': '<span class="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">⚠️ At Risk</span>',
        'Churned': '<span class="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">💤 Churned</span>'
    };

    const lastOrderText = customer.days_since_last_order !== null
        ? formatDaysAgo(customer.days_since_last_order)
        : 'Chưa có đơn';

    const firstOrderText = customer.days_since_first_order !== null
        ? formatDaysAgo(customer.days_since_first_order)
        : 'Chưa rõ';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <span class="text-white font-bold text-2xl">${getInitials(customer.name)}</span>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold text-white">${escapeHtml(customer.name)}</h2>
                            <p class="text-white/80 text-sm font-mono">${escapeHtml(customer.phone)}</p>
                        </div>
                    </div>
                    <button onclick="closeCustomerModal()" class="text-white/80 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Content -->
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <!-- Stats Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-blue-50 rounded-lg p-4">
                        <p class="text-xs text-blue-600 font-medium mb-1">Phân khúc</p>
                        ${segmentBadges[customer.segment] || segmentBadges['New']}
                    </div>
                    <div class="bg-green-50 rounded-lg p-4">
                        <p class="text-xs text-green-600 font-medium mb-1">Tổng đơn</p>
                        <p class="text-2xl font-bold text-green-900">${customer.total_orders}</p>
                    </div>
                    <div class="bg-purple-50 rounded-lg p-4">
                        <p class="text-xs text-purple-600 font-medium mb-1">Tổng chi tiêu</p>
                        <p class="text-lg font-bold text-purple-900">${formatCurrency(customer.total_spent)}</p>
                    </div>
                    <div class="bg-orange-50 rounded-lg p-4">
                        <p class="text-xs text-orange-600 font-medium mb-1">TB/đơn</p>
                        <p class="text-lg font-bold text-orange-900">${formatCurrency(customer.avg_order_value)}</p>
                    </div>
                </div>

                <!-- Info -->
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">Thông tin</h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Địa chỉ:</span>
                            <span class="text-gray-900 font-medium">${escapeHtml(customer.address || 'Chưa có')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Đơn gần nhất:</span>
                            <span class="text-gray-900 font-medium">${lastOrderText}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Khách hàng từ:</span>
                            <span class="text-gray-900 font-medium">${firstOrderText}</span>
                        </div>
                        ${customer.ctv_codes ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">CTV giới thiệu:</span>
                            <span class="text-gray-900 font-medium">${escapeHtml(customer.ctv_codes)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Order History -->
                <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Lịch sử đơn hàng (${customer.orders.length})</h3>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        ${customer.orders.map(order => `
                            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <span class="text-sm font-mono font-semibold text-blue-600">${escapeHtml(order.order_id)}</span>
                                        ${getStatusBadge(order.status)}
                                    </div>
                                    <span class="text-lg font-bold text-green-600">${formatCurrency(order.total_amount)}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs text-gray-500">
                                    <span>${formatDate(order.order_date)}</span>
                                    ${order.referral_code ? `<span class="text-purple-600">CTV: ${escapeHtml(order.referral_code)}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                <button type="button" onclick="closeCustomerModal()"
                    class="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Close customer modal
function closeCustomerModal() {
    const modal = document.getElementById('customerModal');
    if (modal) {
        modal.remove();
    }
}

// Get status badge
function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">⏳ Chờ xử lý</span>',
        'processing': '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">🔄 Đang xử lý</span>',
        'shipped': '<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">📦 Đã gửi</span>',
        'delivered': '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">✅ Đã giao</span>',
        'cancelled': '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">❌ Đã hủy</span>'
    };
    return badges[status] || badges['pending'];
}

// Utility functions
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        // Use timezone-utils to convert UTC to VN timezone
        return toVNDateString(dateString);
    } catch (e) {
        return dateString;
    }
}

function formatDaysAgo(days) {
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;
    if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
}

function showLoading() {
    document.getElementById('loadingState')?.classList.remove('hidden');
    document.getElementById('tableContent')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState')?.classList.add('hidden');
}

function showTable() {
    hideLoading();
    document.getElementById('tableContent')?.classList.remove('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function showEmptyState() {
    hideLoading();
    document.getElementById('tableContent')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}

function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const icons = {
        success: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
        error: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
        warning: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
        info: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
    };
    
    toast.className = `toast-notification fixed bottom-4 right-4 px-5 py-3 rounded-lg shadow-xl text-white z-50 flex items-center gap-3 ${colors[type] || colors.success}`;
    toast.innerHTML = `
        ${icons[type] || icons.success}
        <span class="font-medium">${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
