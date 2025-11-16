// Payments V2 - Pay by Individual Orders
let allCommissions = [];
let filteredCommissions = [];
let currentMonth = '';
let selectedOrders = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Payments V2 initialized');
    
    // Set default month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    currentMonth = `${year}-${month}`;
    document.getElementById('monthSelector').value = currentMonth;
    
    // Load data
    loadUnpaidOrders();
});

// Load unpaid orders
async function loadUnpaidOrders() {
    try {
        showLoading();
        selectedOrders.clear();
        
        const monthSelector = document.getElementById('monthSelector');
        currentMonth = monthSelector.value;
        
        if (!currentMonth) {
            showToast('Vui lòng chọn tháng', 'warning');
            hideLoading();
            return;
        }
        
        const response = await fetch(`${CONFIG.API_URL}?action=getUnpaidOrdersByMonth&month=${currentMonth}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        console.log('📊 API Response:', data);
        
        if (data.success) {
            allCommissions = data.commissions || [];
            filteredCommissions = [...allCommissions];
            
            console.log('✅ Loaded commissions:', allCommissions.length);
            
            updateSummary(data.summary);
            renderCTVList();
        } else {
            throw new Error(data.error || 'Failed to load data');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Không thể tải dữ liệu: ' + error.message, 'error');
        showEmptyState();
    } finally {
        hideLoading();
    }
}

// Update summary
function updateSummary(summary) {
    document.getElementById('totalCTV').textContent = summary.total_ctv || 0;
    document.getElementById('totalOrders').textContent = summary.total_orders || 0;
    document.getElementById('totalCommission').textContent = formatCurrency(summary.total_commission || 0);
    updateSelectedAmount();
}

// Update selected amount
function updateSelectedAmount() {
    let total = 0;
    selectedOrders.forEach(orderId => {
        // Find order in all commissions
        for (const ctv of allCommissions) {
            const order = ctv.orders.find(o => o.order_id === orderId);
            if (order) {
                total += order.commission || 0;
                break;
            }
        }
    });
    document.getElementById('selectedAmount').textContent = formatCurrency(total);
}

// Render CTV list
function renderCTVList() {
    const container = document.getElementById('ctvListContainer');
    
    // Hide loading and empty states
    hideLoading();
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.classList.add('hidden');
    
    if (filteredCommissions.length === 0) {
        showEmptyState();
        return;
    }
    
    // Remove old CTV cards but keep loading and empty states
    Array.from(container.children).forEach(child => {
        if (child.id !== 'loadingState' && child.id !== 'emptyState') {
            child.remove();
        }
    });
    
    filteredCommissions.forEach((ctv, index) => {
        const allSelected = ctv.orders.every(o => selectedOrders.has(o.order_id));
        const someSelected = ctv.orders.some(o => selectedOrders.has(o.order_id));
        
        const html = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <!-- CTV Header -->
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                ${ctv.ctv_name.charAt(0)}
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-gray-900">${escapeHtml(ctv.ctv_name)}</h3>
                                <div class="flex items-center gap-3 mt-1">
                                    <span class="text-sm text-gray-600">
                                        <span class="font-mono font-semibold text-indigo-600">${escapeHtml(ctv.referral_code)}</span>
                                    </span>
                                    <span class="text-sm text-gray-400">•</span>
                                    <span class="text-sm text-gray-600">${escapeHtml(ctv.phone)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-600">Chưa thanh toán</p>
                            <p class="text-2xl font-bold text-orange-600">${formatCurrency(ctv.commission_amount)}</p>
                            <p class="text-sm text-gray-500 mt-1">${ctv.order_count} đơn hàng</p>
                        </div>
                    </div>
                </div>
                
                <!-- Orders List -->
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" 
                                   ${allSelected ? 'checked' : ''}
                                   onchange="toggleAllOrders('${ctv.referral_code}')"
                                   class="w-5 h-5 text-indigo-600 border-gray-300 rounded">
                            <span class="text-sm font-medium text-gray-700">Chọn tất cả</span>
                        </label>
                        <button onclick="paySelectedCTV('${ctv.referral_code}')" 
                                class="px-4 py-2 bg-green-600 text-white text-sm rounded-lg ${someSelected ? '' : 'opacity-50 cursor-not-allowed'}"
                                ${someSelected ? '' : 'disabled'}>
                            <svg class="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Thanh toán đã chọn
                        </button>
                    </div>
                    
                    <div class="space-y-2">
                        ${ctv.orders.map(order => createOrderRow(order, ctv.referral_code)).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Append to container
        container.insertAdjacentHTML('beforeend', html);
    });
}

// Create order row
function createOrderRow(order, referralCode) {
    const isSelected = selectedOrders.has(order.order_id);
    const date = new Date(order.created_at).toLocaleDateString('vi-VN');
    
    return `
        <label class="flex items-center gap-4 p-4 border border-gray-200 rounded-lg cursor-pointer ${isSelected ? 'bg-indigo-50 border-indigo-300' : ''}">
            <input type="checkbox" 
                   ${isSelected ? 'checked' : ''}
                   onchange="toggleOrder(${order.order_id})"
                   class="w-5 h-5 text-indigo-600 border-gray-300 rounded">
            <div class="flex-1 grid grid-cols-4 gap-4">
                <div>
                    <p class="text-xs text-gray-500">Mã đơn</p>
                    <p class="text-sm font-mono font-semibold text-blue-600">${escapeHtml(order.order_code)}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Ngày đặt</p>
                    <p class="text-sm font-medium text-gray-900">${date}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Khách hàng</p>
                    <p class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">Hoa hồng</p>
                    <p class="text-sm font-bold text-orange-600">${formatCurrency(order.commission)}</p>
                </div>
            </div>
        </label>
    `;
}

// Toggle single order
function toggleOrder(orderId) {
    if (selectedOrders.has(orderId)) {
        selectedOrders.delete(orderId);
    } else {
        selectedOrders.add(orderId);
    }
    updateSelectedAmount();
    renderCTVList();
}

// Toggle all orders for a CTV
function toggleAllOrders(referralCode) {
    const ctv = filteredCommissions.find(c => c.referral_code === referralCode);
    if (!ctv) return;
    
    const allSelected = ctv.orders.every(o => selectedOrders.has(o.order_id));
    
    if (allSelected) {
        // Unselect all
        ctv.orders.forEach(o => selectedOrders.delete(o.order_id));
    } else {
        // Select all
        ctv.orders.forEach(o => selectedOrders.add(o.order_id));
    }
    
    updateSelectedAmount();
    renderCTVList();
}

// Pay selected orders for a CTV
async function paySelectedCTV(referralCode) {
    const ctv = filteredCommissions.find(c => c.referral_code === referralCode);
    if (!ctv) return;
    
    const selectedCTVOrders = ctv.orders.filter(o => selectedOrders.has(o.order_id));
    
    if (selectedCTVOrders.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 đơn hàng', 'warning');
        return;
    }
    
    const totalCommission = selectedCTVOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
    
    // Show payment modal
    showPaymentModal(ctv, selectedCTVOrders, totalCommission);
}

// Show payment modal
function showPaymentModal(ctv, orders, totalCommission) {
    const modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div class="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Xác nhận thanh toán</h2>
                        <p class="text-sm text-white/80">${orders.length} đơn hàng</p>
                    </div>
                </div>
                <button onclick="closePaymentModal()" class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div class="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <p class="text-sm text-gray-600">Thanh toán cho</p>
                    <p class="text-lg font-bold text-gray-900">${escapeHtml(ctv.ctv_name)}</p>
                    <p class="text-sm text-gray-600 mt-1">Mã: ${escapeHtml(ctv.referral_code)} • ${escapeHtml(ctv.phone)}</p>
                    <div class="mt-3 pt-3 border-t border-green-200">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">${orders.length} đơn hàng</span>
                            <span class="text-2xl font-bold text-green-600">${formatCurrency(totalCommission)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-3">Danh sách đơn hàng:</h3>
                    <div class="space-y-2 max-h-48 overflow-y-auto">
                        ${orders.map(order => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p class="text-sm font-mono font-semibold text-blue-600">${escapeHtml(order.order_code)}</p>
                                    <p class="text-xs text-gray-500">${new Date(order.created_at).toLocaleDateString('vi-VN')}</p>
                                </div>
                                <p class="text-sm font-bold text-orange-600">${formatCurrency(order.commission)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <form id="paymentForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Ngày thanh toán</label>
                        <input type="date" id="paymentDate" value="${new Date().toISOString().split('T')[0]}" required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Phương thức thanh toán</label>
                        <select id="paymentMethod" required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                            <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                            <option value="cash">Tiền mặt</option>
                            <option value="momo">Ví MoMo</option>
                            <option value="zalopay">ZaloPay</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Ghi chú (Mã GD, ...)</label>
                        <textarea id="paymentNote" rows="2" placeholder="VD: Mã GD: 123456789, Chuyển khoản MB Bank"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg resize-none"></textarea>
                    </div>
                    
                    <input type="hidden" id="paymentReferralCode" value="${escapeHtml(ctv.referral_code)}">
                    <input type="hidden" id="paymentOrderIds" value="${orders.map(o => o.order_id).join(',')}">
                </form>
            </div>
            
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button type="button" onclick="closePaymentModal()" 
                    class="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium">
                    Hủy
                </button>
                <button type="submit" form="paymentForm" onclick="submitPayment(event)"
                    class="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium">
                    <svg class="w-5 h-5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Xác nhận thanh toán
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Submit payment
async function submitPayment(event) {
    event.preventDefault();
    
    const referralCode = document.getElementById('paymentReferralCode').value;
    const orderIdsStr = document.getElementById('paymentOrderIds').value;
    const orderIds = orderIdsStr.split(',').map(id => parseInt(id));
    const paymentDate = document.getElementById('paymentDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const note = document.getElementById('paymentNote').value;
    
    try {
        showToast('Đang xử lý thanh toán...', 'info');
        
        const response = await fetch(`${CONFIG.API_URL}?action=paySelectedOrders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                referralCode,
                orderIds,
                paymentDate,
                paymentMethod,
                note
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ ${data.message}`, 'success');
            closePaymentModal();
            
            // Remove paid orders from selected
            orderIds.forEach(id => selectedOrders.delete(id));
            
            // Reload data
            setTimeout(() => loadUnpaidOrders(), 1000);
        } else {
            throw new Error(data.error || 'Failed to process payment');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Không thể thanh toán: ' + error.message, 'error');
    }
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.remove();
    }
}

// Filter CTV
function filterCTV() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredCommissions = allCommissions.filter(ctv => {
        return !searchTerm || 
            ctv.ctv_name.toLowerCase().includes(searchTerm) ||
            ctv.referral_code.toLowerCase().includes(searchTerm) ||
            ctv.phone.includes(searchTerm);
    });
    
    renderCTVList();
}

// Load previous month
function loadPreviousMonth() {
    const monthSelector = document.getElementById('monthSelector');
    const [year, month] = monthSelector.value.split('-');
    
    let newYear = parseInt(year);
    let newMonth = parseInt(month) - 1;
    
    if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
    }
    
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    monthSelector.value = newMonthStr;
    currentMonth = newMonthStr;
    
    loadUnpaidOrders();
}

// Refresh data
function refreshData() {
    showToast('Đang tải lại dữ liệu...', 'info');
    loadUnpaidOrders();
}

// UI State functions
function showLoading() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    if (loadingState) loadingState.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    const container = document.getElementById('ctvListContainer');
    Array.from(container.children).forEach(child => {
        if (child.id !== 'loadingState' && child.id !== 'emptyState') {
            child.remove();
        }
    });
}

function hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.classList.add('hidden');
}

function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const loadingState = document.getElementById('loadingState');
    
    if (emptyState) emptyState.classList.remove('hidden');
    if (loadingState) loadingState.classList.add('hidden');
}

// Utility functions
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

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
