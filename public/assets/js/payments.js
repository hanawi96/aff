// Payments V2 - Pay by Individual Orders
let allCommissions = [];
let filteredCommissions = [];
let currentMonth = '';
let selectedOrders = new Set();

// Filter state
let currentFilters = {
    period: 'thisMonth',
    status: 'all',
    search: '',
    dateRange: null
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Payments V2 initialized');
    
    // Set default month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    currentMonth = `${year}-${month}`;
    
    // Initialize filters with default period (thisMonth)
    filterByPeriod('thisMonth');
    
    // Load both tabs data immediately
    loadUnpaidOrders();
    loadPaymentHistory();
});

// Load unpaid orders
async function loadUnpaidOrders() {
    try {
        showLoading();
        selectedOrders.clear();
        
        // Use currentMonth from filter state
        if (!currentMonth) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            currentMonth = `${year}-${month}`;
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
    document.getElementById('unpaidCount').textContent = summary.total_ctv || 0;
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
    const date = toVNShortDate(order.created_at);
    
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
    // Debug: Log CTV data
    console.log('💳 CTV Data:', JSON.stringify(ctv, null, 2));
    console.log('🏦 Bank Name:', ctv.bank_name);
    console.log('💰 Bank Account:', ctv.bank_account_number);
    console.log('🔍 All CTV keys:', Object.keys(ctv));
    
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
                    
                    ${ctv.bank_account_number || ctv.bank_name ? `
                        <div class="mt-3 pt-3 border-t border-green-200">
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span class="text-sm font-semibold text-gray-700">Thông tin ngân hàng</span>
                            </div>
                            <div class="bg-white rounded-lg p-3 space-y-2">
                                ${ctv.bank_name ? `
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">Ngân hàng:</span>
                                        <span class="text-sm font-semibold text-gray-900">${escapeHtml(ctv.bank_name)}</span>
                                    </div>
                                ` : ''}
                                ${ctv.bank_account_number ? `
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">Số tài khoản:</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-mono font-bold text-blue-600">${escapeHtml(ctv.bank_account_number)}</span>
                                            <button type="button" onclick="copyToClipboard('${escapeHtml(ctv.bank_account_number)}')" 
                                                class="p-1 hover:bg-gray-100 rounded transition-colors" title="Sao chép">
                                                <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
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
                                    <p class="text-xs text-gray-500">${toVNShortDate(order.created_at)}</p>
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
    
    // Get submit button
    const submitBtn = event.target;
    const originalBtnContent = submitBtn.innerHTML;
    
    try {
        // Show loading state on button
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5 inline mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Đang xử lý...
        `;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        
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
        
        // Restore button state on error
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.remove();
    }
}

// Smart Search with Debounce
let searchDebounceTimer;
function filterCTV() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        performSearch();
    }, 300); // Wait 300ms after user stops typing
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // Show/hide clear button
    updateSearchUI(searchTerm);
    
    if (!searchTerm) {
        filteredCommissions = [...allCommissions];
        renderCTVList();
        return;
    }
    
    // Smart search: tìm theo nhiều trường
    filteredCommissions = allCommissions.filter(ctv => {
        const searchFields = [
            ctv.ctv_name?.toLowerCase() || '',
            ctv.referral_code?.toLowerCase() || '',
            ctv.phone || '',
            ctv.bank_name?.toLowerCase() || '',
            ctv.bank_account_number || ''
        ];
        
        return searchFields.some(field => field.includes(searchTerm));
    });
    
    renderCTVList();
    
    // Show search result count
    if (searchTerm) {
        const resultText = filteredCommissions.length === 0 
            ? 'Không tìm thấy kết quả' 
            : `Tìm thấy ${filteredCommissions.length} CTV`;
        showToast(resultText, filteredCommissions.length === 0 ? 'warning' : 'info');
    }
}

function updateSearchUI(searchTerm) {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    
    if (clearBtn) {
        clearBtn.style.display = searchTerm ? 'block' : 'none';
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    performSearch();
    searchInput.focus();
}

// Load previous month (DEPRECATED - Use filterByPeriod('lastMonth') instead)
function loadPreviousMonth() {
    // Redirect to new filter system
    filterByPeriod('lastMonth');
    
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

// showToast is now provided by toast-manager.js


// Copy to clipboard helper
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Đã sao chép: ' + text, 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('❌ Không thể sao chép', 'error');
    });
}


// Tab Management
let currentTab = 'unpaid';
let paymentHistory = [];

function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    const tabUnpaid = document.getElementById('tabUnpaid');
    const tabHistory = document.getElementById('tabHistory');
    const unpaidContent = document.getElementById('unpaidContent');
    const historyContent = document.getElementById('historyContent');
    
    if (tab === 'unpaid') {
        tabUnpaid.classList.add('active', 'border-green-600', 'text-green-600', 'bg-green-50');
        tabUnpaid.classList.remove('border-transparent', 'text-gray-500');
        tabHistory.classList.remove('active', 'border-green-600', 'text-green-600', 'bg-green-50');
        tabHistory.classList.add('border-transparent', 'text-gray-500');
        
        unpaidContent.classList.remove('hidden');
        historyContent.classList.add('hidden');
    } else {
        tabHistory.classList.add('active', 'border-green-600', 'text-green-600', 'bg-green-50');
        tabHistory.classList.remove('border-transparent', 'text-gray-500');
        tabUnpaid.classList.remove('active', 'border-green-600', 'text-green-600', 'bg-green-50');
        tabUnpaid.classList.add('border-transparent', 'text-gray-500');
        
        historyContent.classList.remove('hidden');
        unpaidContent.classList.add('hidden');
    }
}

// Load Payment History
async function loadPaymentHistory() {
    // Use currentMonth from global state
    const month = currentMonth || new Date().toISOString().slice(0, 7);
    
    if (!month) {
        showToast('Vui lòng chọn tháng', 'warning');
        return;
    }
    
    try {
        // Get all payment records for this month
        const response = await fetch(`${CONFIG.API_URL}?action=getPaidOrdersByMonth&month=${month}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            paymentHistory = data.payments || [];
            
            // Calculate stats from actual paid orders
            const totalAmount = paymentHistory.reduce((sum, p) => sum + (p.commission_amount || 0), 0);
            const totalOrders = paymentHistory.reduce((sum, p) => sum + (p.order_count || 0), 0);
            
            document.getElementById('historyTotalAmount').textContent = formatCurrency(totalAmount);
            document.getElementById('historyTotalCTV').textContent = paymentHistory.length;
            document.getElementById('historyTotalOrders').textContent = totalOrders;
            document.getElementById('historyCount').textContent = paymentHistory.length;
            
            renderPaymentHistory(paymentHistory);
        }
    } catch (error) {
        console.error('Error loading payment history:', error);
        showToast('Không thể tải lịch sử thanh toán', 'error');
    }
}

// Render Payment History
function renderPaymentHistory(history) {
    const container = document.getElementById('historyListContainer');
    const loadingState = document.getElementById('historyLoadingState');
    const emptyState = document.getElementById('historyEmptyState');
    
    loadingState.classList.add('hidden');
    
    if (history.length === 0) {
        emptyState.classList.remove('hidden');
        // Remove existing cards
        const existingCards = container.querySelectorAll('.history-card');
        existingCards.forEach(card => card.remove());
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Remove existing cards
    const existingCards = container.querySelectorAll('.history-card');
    existingCards.forEach(card => card.remove());
    
    // Render history cards
    history.forEach(payment => {
        const card = createHistoryCard(payment);
        container.appendChild(card);
    });
}

// Create History Card
function createHistoryCard(payment) {
    const card = document.createElement('div');
    card.className = 'history-card bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow';
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                    <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900">${escapeHtml(payment.ctv_name)}</h3>
                    <p class="text-sm text-gray-500">Mã: ${escapeHtml(payment.referral_code)} • ${escapeHtml(payment.phone)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-2xl font-bold text-green-600">${formatCurrency(payment.commission_amount)}</p>
                <p class="text-xs text-gray-500 mt-1">${payment.order_count} đơn hàng</p>
            </div>
        </div>
        
        ${payment.bank_account_number || payment.bank_name ? `
            <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span class="text-xs font-semibold text-gray-600">Thông tin ngân hàng</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    ${payment.bank_name ? `
                        <div>
                            <span class="text-gray-500">Ngân hàng:</span>
                            <span class="font-semibold text-gray-900 ml-1">${escapeHtml(payment.bank_name)}</span>
                        </div>
                    ` : ''}
                    ${payment.bank_account_number ? `
                        <div>
                            <span class="text-gray-500">STK:</span>
                            <span class="font-mono font-semibold text-blue-600 ml-1">${escapeHtml(payment.bank_account_number)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
        
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
                <p class="text-xs text-gray-500 mb-1">Ngày thanh toán</p>
                <p class="text-sm font-semibold text-gray-900">${payment.payment_date ? toVNShortDate(payment.payment_date) : 'N/A'}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 mb-1">Phương thức</p>
                <p class="text-sm font-semibold text-gray-900">${getPaymentMethodLabel(payment.payment_method)}</p>
            </div>
        </div>
        
        ${payment.note ? `
            <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p class="text-xs text-gray-600 mb-1">Ghi chú:</p>
                <p class="text-sm text-gray-900">${escapeHtml(payment.note)}</p>
            </div>
        ` : ''}
    `;
    
    return card;
}

// Get Payment Method Label
function getPaymentMethodLabel(method) {
    const labels = {
        'bank_transfer': 'Chuyển khoản',
        'cash': 'Tiền mặt',
        'momo': 'Ví MoMo',
        'zalopay': 'ZaloPay'
    };
    return labels[method] || method || 'N/A';
}


// Search in History Tab
let historySearchDebounceTimer;
function filterHistory() {
    clearTimeout(historySearchDebounceTimer);
    historySearchDebounceTimer = setTimeout(() => {
        performHistorySearch();
    }, 300);
}

function performHistorySearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderPaymentHistory(paymentHistory);
        return;
    }
    
    const filtered = paymentHistory.filter(payment => {
        const searchFields = [
            payment.ctv_name?.toLowerCase() || '',
            payment.referral_code?.toLowerCase() || '',
            payment.phone || '',
            payment.bank_name?.toLowerCase() || '',
            payment.bank_account_number || '',
            payment.payment_method?.toLowerCase() || '',
            payment.note?.toLowerCase() || ''
        ];
        
        return searchFields.some(field => field.includes(searchTerm));
    });
    
    renderPaymentHistory(filtered);
    
    if (searchTerm) {
        const resultText = filtered.length === 0 
            ? 'Không tìm thấy kết quả' 
            : `Tìm thấy ${filtered.length} thanh toán`;
        showToast(resultText, filtered.length === 0 ? 'warning' : 'info');
    }
}

// Update search function based on active tab
const originalFilterCTV = filterCTV;
filterCTV = function() {
    if (currentTab === 'history') {
        filterHistory();
    } else {
        originalFilterCTV();
    }
};


// ============================================
// ENHANCED FILTER FUNCTIONS
// ============================================

// Filter by period
function filterByPeriod(period) {
    currentFilters.period = period;
    
    // Update button states
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.classList.remove('border-indigo-600', 'bg-indigo-50', 'text-indigo-700', 'border-2');
        btn.classList.add('border', 'border-gray-300', 'text-gray-700');
    });
    
    const activeBtn = document.getElementById(`filter-${period}`);
    if (activeBtn) {
        activeBtn.classList.remove('border', 'border-gray-300', 'text-gray-700');
        activeBtn.classList.add('border-2', 'border-indigo-600', 'bg-indigo-50', 'text-indigo-700');
    }
    
    // Calculate date range based on period using VN timezone
    let startDate, endDate;
    
    switch(period) {
        case 'today':
            startDate = getVNStartOfToday();
            endDate = getVNEndOfToday();
            break;
        case 'thisWeek':
            startDate = getVNStartOfWeek();
            endDate = getVNEndOfToday();
            break;
        case 'thisMonth':
            startDate = getVNStartOfMonth();
            endDate = getVNEndOfMonth();
            break;
        case 'lastMonth':
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthYear = lastMonth.getFullYear();
            const lastMonthNum = lastMonth.getMonth();
            startDate = new Date(lastMonthYear, lastMonthNum, 1);
            endDate = new Date(lastMonthYear, lastMonthNum + 1, 0, 23, 59, 59, 999);
            break;
        case '3months':
            const now3 = new Date();
            startDate = new Date(now3.getFullYear(), now3.getMonth() - 2, 1);
            endDate = getVNEndOfMonth();
            break;
        case '6months':
            const now6 = new Date();
            startDate = new Date(now6.getFullYear(), now6.getMonth() - 5, 1);
            endDate = getVNEndOfMonth();
            break;
        case 'thisYear':
            startDate = getVNStartOfYear();
            endDate = getVNEndOfYear();
            break;
        case 'all':
            startDate = null;
            endDate = null;
            break;
    }
    
    currentFilters.dateRange = startDate && endDate ? { startDate, endDate } : null;
    
    console.log('📅 Filter period:', period, {
        startDate: startDate ? startDate.toISOString() : 'null',
        endDate: endDate ? endDate.toISOString() : 'null'
    });
    
    applyFilters();
}

// Apply all filters
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    currentFilters.status = statusFilter;
    currentFilters.search = searchTerm;
    
    // Show/hide clear button
    const clearBtn = document.getElementById('searchClearBtn');
    if (searchTerm) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
    
    // Filter data - Create deep copy to avoid modifying original
    let filtered = allCommissions.map(ctv => ({
        ...ctv,
        orders: ctv.orders ? [...ctv.orders] : []
    }));
    
    // Filter by date range
    if (currentFilters.dateRange) {
        const { startDate, endDate } = currentFilters.dateRange;
        filtered = filtered.map(ctv => {
            // Filter orders within each CTV
            if (ctv.orders && Array.isArray(ctv.orders)) {
                const filteredOrders = ctv.orders.filter(order => {
                    const orderDate = new Date(order.created_at || order.payment_date);
                    return orderDate >= startDate && orderDate <= endDate;
                });
                
                return {
                    ...ctv,
                    orders: filteredOrders,
                    commission_amount: filteredOrders.reduce((sum, o) => sum + (o.commission || 0), 0),
                    order_count: filteredOrders.length
                };
            }
            return ctv;
        }).filter(ctv => ctv.order_count > 0);
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
        filtered = filtered.map(ctv => {
            if (ctv.orders && Array.isArray(ctv.orders)) {
                const filteredOrders = ctv.orders.filter(order => {
                    // Map status values
                    const orderStatus = order.payment_status || order.status || 'pending';
                    return orderStatus === statusFilter;
                });
                
                return {
                    ...ctv,
                    orders: filteredOrders,
                    commission_amount: filteredOrders.reduce((sum, o) => sum + (o.commission || 0), 0),
                    order_count: filteredOrders.length
                };
            }
            return ctv;
        }).filter(ctv => ctv.order_count > 0);
    }
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(ctv => {
            return (
                (ctv.referral_code && ctv.referral_code.toLowerCase().includes(searchTerm)) ||
                (ctv.full_name && ctv.full_name.toLowerCase().includes(searchTerm)) ||
                (ctv.phone && ctv.phone.includes(searchTerm)) ||
                (ctv.bank_account_number && ctv.bank_account_number.includes(searchTerm)) ||
                (ctv.bank_name && ctv.bank_name.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    filteredCommissions = filtered;
    
    console.log('✅ Filtered:', {
        original: allCommissions.length,
        filtered: filteredCommissions.length,
        filters: currentFilters
    });
    
    updateActiveFiltersDisplay();
    renderCTVList();
    updateFilteredSummary();
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const container = document.getElementById('activeFilters');
    const tagsContainer = document.getElementById('activeFilterTags');
    
    const hasFilters = currentFilters.period !== 'thisMonth' || 
                      currentFilters.status !== 'all' || 
                      currentFilters.search;
    
    if (!hasFilters) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    let tags = [];
    
    // Period tag
    const periodLabels = {
        'today': 'Hôm nay',
        'thisWeek': 'Tuần này',
        'thisMonth': 'Tháng này',
        'lastMonth': 'Tháng trước',
        '3months': '3 tháng gần đây',
        '6months': '6 tháng gần đây',
        'thisYear': 'Năm nay',
        'all': 'Tất cả'
    };
    
    if (currentFilters.period !== 'thisMonth') {
        tags.push(`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                ${periodLabels[currentFilters.period]}
                <button onclick="filterByPeriod('thisMonth')" class="hover:text-indigo-900 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `);
    }
    
    // Status tag
    if (currentFilters.status !== 'all') {
        const statusLabel = currentFilters.status === 'pending' ? 'Chưa thanh toán' : 'Đã thanh toán';
        tags.push(`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                ${statusLabel}
                <button onclick="document.getElementById('statusFilter').value='all'; applyFilters();" class="hover:text-blue-900 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `);
    }
    
    // Search tag
    if (currentFilters.search) {
        tags.push(`
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Tìm: "${currentFilters.search}"
                <button onclick="clearSearch()" class="hover:text-green-900 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `);
    }
    
    tagsContainer.innerHTML = tags.join('');
}

// Update summary with filtered data
function updateFilteredSummary() {
    const totalCTV = filteredCommissions.length;
    const totalOrders = filteredCommissions.reduce((sum, ctv) => sum + (ctv.order_count || 0), 0);
    const totalCommission = filteredCommissions.reduce((sum, ctv) => sum + (ctv.commission_amount || 0), 0);
    
    document.getElementById('totalCTV').textContent = totalCTV;
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);
    document.getElementById('unpaidCount').textContent = totalCTV;
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {
        period: 'thisMonth',
        status: 'all',
        search: '',
        dateRange: null
    };
    
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').classList.add('hidden');
    
    filterByPeriod('thisMonth');
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').classList.add('hidden');
    currentFilters.search = '';
    applyFilters();
}

// Override old filterCTV function to use new applyFilters
function filterCTV() {
    applyFilters();
}
