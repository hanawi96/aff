// CTV Detail Page JavaScript
let ctvData = null;
let ordersData = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 CTV Detail Page initialized');
    
    // Get referral code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('code');
    
    if (!referralCode) {
        showError();
        return;
    }
    
    loadCTVData(referralCode);
});

// Load CTV data
async function loadCTVData(referralCode) {
    try {
        showLoading();
        
        // Load CTV info
        const ctvResponse = await fetch(`${CONFIG.API_URL}?action=getAllCTV&timestamp=${Date.now()}`);
        if (!ctvResponse.ok) throw new Error('Failed to load CTV data');
        
        const ctvResult = await ctvResponse.json();
        if (!ctvResult.success) throw new Error(ctvResult.error || 'Failed to load CTV data');
        
        // Find the specific CTV
        ctvData = ctvResult.ctvList.find(ctv => ctv.referralCode === referralCode);
        if (!ctvData) {
            showError();
            return;
        }
        
        // Load orders for this CTV
        const ordersResponse = await fetch(`${CONFIG.API_URL}?action=getOrders&referralCode=${referralCode}&timestamp=${Date.now()}`);
        if (!ordersResponse.ok) throw new Error('Failed to load orders');
        
        const ordersResult = await ordersResponse.json();
        if (ordersResult.success) {
            ordersData = ordersResult.orders || [];
        }
        
        // Display data
        displayCTVInfo();
        displayOrders();
        
        hideLoading();
        showContent();
        
    } catch (error) {
        console.error('❌ Error loading CTV data:', error);
        hideLoading();
        showError();
    }
}

// Display CTV info
function displayCTVInfo() {
    // Header
    document.getElementById('ctvCode').textContent = ctvData.referralCode;
    
    // Avatar
    const initials = getInitials(ctvData.fullName);
    document.getElementById('ctvAvatar').textContent = initials;
    
    // Basic info
    document.getElementById('ctvName').textContent = ctvData.fullName || 'N/A';
    document.getElementById('ctvPhone').textContent = ctvData.phone || 'N/A';
    document.getElementById('ctvEmail').textContent = ctvData.email || 'Chưa cập nhật';
    
    // Status
    const statusElement = document.getElementById('ctvStatus');
    const statusInfo = getStatusInfo(ctvData);
    statusElement.textContent = statusInfo.text;
    statusElement.className = `px-4 py-2 inline-flex text-sm font-semibold rounded-full ${statusInfo.class}`;
    
    // Details
    document.getElementById('ctvReferralCode').textContent = ctvData.referralCode;
    const commissionRate = (ctvData.commissionRate || 0.1) * 100;
    document.getElementById('ctvCommissionRate').textContent = `${commissionRate.toFixed(0)}%`;
    document.getElementById('ctvCity').textContent = ctvData.city || 'Chưa cập nhật';
    document.getElementById('ctvCreatedAt').textContent = formatDate(ctvData.timestamp);
    
    // Stats
    const totalOrders = ordersData.length;
    const totalRevenue = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const totalCommission = ordersData.reduce((sum, order) => sum + (order.commission || 0), 0);
    
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);
}

// Display orders
function displayOrders() {
    const ordersTable = document.getElementById('ordersTable');
    const emptyOrders = document.getElementById('emptyOrders');
    
    if (ordersData.length === 0) {
        ordersTable.classList.add('hidden');
        emptyOrders.classList.remove('hidden');
        return;
    }
    
    ordersTable.classList.remove('hidden');
    emptyOrders.classList.add('hidden');
    
    let html = `
        <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">STT</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giá trị</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hoa hồng</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày đặt</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    ordersData.forEach((order, index) => {
        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</div>
                    <div class="text-sm text-gray-500">${escapeHtml(order.customer_phone || 'N/A')}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">${formatCurrency(order.total_amount || 0)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-600">${formatCurrency(order.commission || 0)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(order.created_at || order.order_date)}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    ordersTable.innerHTML = html;
}

// Get status info
function getStatusInfo(ctv) {
    if (ctv.hasOrders) {
        return {
            text: 'Đang hoạt động',
            class: 'bg-green-100 text-green-800'
        };
    }
    
    if (ctv.status === 'Mới') {
        return {
            text: 'Mới',
            class: 'bg-yellow-100 text-yellow-800'
        };
    }
    
    return {
        text: 'Chưa có đơn',
        class: 'bg-gray-100 text-gray-800'
    };
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
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// UI State functions
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('contentState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function showContent() {
    document.getElementById('contentState').classList.remove('hidden');
    document.getElementById('errorState').classList.add('hidden');
}

function showError() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('contentState').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
}
