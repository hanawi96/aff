// CTV Detail Page JavaScript
let ctvData = null;
let ordersData = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
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

    // Bank Info - Show button if bank info exists
    const hasBankInfo = ctvData.bankName || ctvData.bankAccountNumber;
    if (hasBankInfo) {
        document.getElementById('bankInfoButton').classList.remove('hidden');
    }

    // Stats - Calculate from product_total + shipping_fee for accurate revenue
    const totalOrders = ordersData.length;
    const totalRevenue = ordersData.reduce((sum, order) => {
        const productTotal = order.product_total || 0;
        const shippingFee = order.shipping_fee || 0;
        return sum + productTotal + shippingFee;
    }, 0);
    const totalCommission = ordersData.reduce((sum, order) => {
        // Recalculate commission based on current CTV commission_rate if available
        if (order.ctv_commission_rate !== undefined && order.ctv_commission_rate !== null) {
            const productTotal = order.product_total || 0;
            return sum + Math.round(productTotal * order.ctv_commission_rate);
        }
        return sum + (order.commission || 0);
    }, 0);

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
        // Use timezone-utils to convert UTC to VN timezone
        return toVNShortDate(dateString);
    } catch (e) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Use timezone-utils to convert UTC to VN timezone
        return toVNDateString(dateString);
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


// Show bank info modal
function showBankInfoModal() {
    if (!ctvData) return;
    
    const modal = document.createElement('div');
    modal.id = 'bankInfoModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    const bankName = ctvData.bankName || 'Chưa cập nhật';
    const bankAccount = ctvData.bankAccountNumber || 'Chưa cập nhật';
    const accountHolder = ctvData.fullName || 'Chưa cập nhật';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style="animation: fadeIn 0.3s ease-out;">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">Thông tin Ngân hàng</h3>
                            <p class="text-sm text-white/80">Thanh toán hoa hồng</p>
                        </div>
                    </div>
                    <button onclick="closeBankInfoModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Content -->
            <div class="p-6 space-y-4">
                <!-- Bank Name -->
                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ngân hàng</p>
                    </div>
                    <p class="text-lg font-bold text-gray-900">${escapeHtml(bankName)}</p>
                </div>
                
                <!-- Account Number -->
                <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Số tài khoản</p>
                    </div>
                    <div class="flex items-center justify-between">
                        <p class="text-lg font-mono font-bold text-gray-900">${escapeHtml(bankAccount)}</p>
                        ${bankAccount !== 'Chưa cập nhật' ? `
                        <button onclick="copyToClipboard('${escapeHtml(bankAccount)}')" class="p-2 hover:bg-purple-100 rounded-lg transition-colors" title="Sao chép">
                            <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Account Holder -->
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Chủ tài khoản</p>
                    </div>
                    <p class="text-lg font-bold text-gray-900">${escapeHtml(accountHolder)}</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button onclick="closeBankInfoModal()" class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Close bank info modal
function closeBankInfoModal() {
    const modal = document.getElementById('bankInfoModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Đã sao chép: ' + text, 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('❌ Không thể sao chép', 'error');
    });
}

// Show toast notification
// showToast is now provided by toast-manager.js
