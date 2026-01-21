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
            console.log('📊 Total customers loaded:', allCustomers.length);
            console.log('📊 Customers data:', allCustomers);
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
        'VIP': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 text-yellow-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>VIP</span>',
        'Regular': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Regular</span>',
        'New': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>New</span>',
        'At Risk': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-orange-800 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>At Risk</span>',
        'Churned': '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-full"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>Churned</span>'
    };

    // Show actual date of last order instead of "days ago"
    const lastOrderText = customer.last_order_date
        ? formatDate(customer.last_order_date)
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
                <div class="flex items-center justify-center gap-2">
                    <button onclick="viewCustomerDetail('${escapeHtml(customer.phone)}')"
                        class="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                        <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Chi tiết
                    </button>
                    <button onclick="confirmDeleteCustomer('${escapeHtml(customer.phone)}', '${escapeHtml(customer.name)}')"
                        class="inline-flex items-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        title="Xóa khách hàng">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
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
        'VIP': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 text-yellow-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-yellow-500 rounded-full"></span>VIP</span>',
        'Regular': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-green-500 rounded-full"></span>Regular</span>',
        'New': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-blue-500 rounded-full"></span>New</span>',
        'At Risk': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 text-orange-800 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-orange-500 rounded-full"></span>At Risk</span>',
        'Churned': '<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-full"><span class="w-2 h-2 bg-gray-400 rounded-full"></span>Churned</span>'
    };

    // Show actual date instead of "days ago"
    const lastOrderText = customer.last_order_date
        ? formatDate(customer.last_order_date)
        : 'Chưa có đơn';

    const firstOrderText = customer.first_order_date
        ? formatDate(customer.first_order_date)
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
                                    <span>${formatDate(order.created_at_unix)}</span>
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
        'pending': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-100 border border-yellow-200 text-yellow-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>Chờ xử lý</span>',
        'processing': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 border border-blue-200 text-blue-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Đang xử lý</span>',
        'shipped': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-100 border border-purple-200 text-purple-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>Đã gửi</span>',
        'delivered': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 border border-green-200 text-green-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Đã giao</span>',
        'cancelled': '<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-red-100 border border-red-200 text-red-800 text-xs font-medium rounded"><span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>Đã hủy</span>'
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
        let date;
        
        // Check if it's a timestamp (number)
        if (typeof dateString === 'number' || !isNaN(Number(dateString))) {
            // It's a Unix timestamp in milliseconds
            date = new Date(Number(dateString));
        } else {
            // It's a date string
            date = new Date(dateString);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateString);
            return dateString;
        }
        
        // Format as DD/MM/YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('Error formatting date:', e, dateString);
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

// showToast is now provided by toast-manager.js


// ============================================
// CUSTOM DROPDOWN FILTERS
// ============================================

// Toggle segment filter dropdown
function toggleSegmentFilter(event) {
    event.stopPropagation();

    // Close if already open
    const existingMenu = document.getElementById('segmentFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const segments = [
        { value: 'all', label: 'Tất cả phân khúc', color: 'gray' },
        { value: 'VIP', label: 'VIP (≥5 đơn)', color: 'yellow' },
        { value: 'Regular', label: 'Regular (2-4 đơn)', color: 'green' },
        { value: 'New', label: 'New (1 đơn)', color: 'blue' },
        { value: 'At Risk', label: 'At Risk (>60 ngày)', color: 'orange' },
        { value: 'Churned', label: 'Churned (>90 ngày)', color: 'gray' }
    ];

    const currentValue = document.getElementById('segmentFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'segmentFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[240px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = segments.map(s => `
        <button 
            onclick="selectSegmentFilter('${s.value}', '${s.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${s.value === currentValue ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-base text-gray-700 flex-1">${s.label}</span>
            ${s.value === currentValue ? `
                <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    button.style.position = 'relative';
    button.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select segment filter
function selectSegmentFilter(value, label) {
    document.getElementById('segmentFilter').value = value;
    document.getElementById('segmentFilterLabel').textContent = label;
    document.getElementById('segmentFilterMenu')?.remove();
    filterBySegment();
}

// Confirm delete customer
function confirmDeleteCustomer(phone, name) {
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 rounded-t-xl">
                <h3 class="text-lg font-bold text-white">Xác nhận xóa khách hàng</h3>
            </div>
            <div class="p-6">
                <div class="flex items-start gap-4 mb-4">
                    <div class="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div class="flex-1">
                        <p class="text-gray-700 mb-2">Bạn có chắc chắn muốn xóa khách hàng:</p>
                        <p class="font-bold text-gray-900 mb-1">${escapeHtml(name)}</p>
                        <p class="text-sm text-gray-600 font-mono">${escapeHtml(phone)}</p>
                    </div>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p class="text-sm text-amber-800">
                        <strong>⚠️ Lưu ý:</strong> Hành động này sẽ xóa vĩnh viễn thông tin khách hàng và không thể hoàn tác!
                    </p>
                </div>
            </div>
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button onclick="closeConfirmDeleteModal()"
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button onclick="deleteCustomer('${escapeHtml(phone)}')"
                    class="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Xóa khách hàng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close confirm delete modal
function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) modal.remove();
}

// Delete customer
async function deleteCustomer(phone) {
    closeConfirmDeleteModal();

    try {
        showToast('Đang xóa khách hàng...', 'info');

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteCustomer',
                phone: phone
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Đã xóa khách hàng thành công', 'success');
            // Reload customers list
            await loadCustomers();
        } else {
            throw new Error(data.error || 'Không thể xóa khách hàng');
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}
