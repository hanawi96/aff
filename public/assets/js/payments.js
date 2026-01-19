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
    const existingCards = container.querySelectorAll('.ctv-card');
    existingCards.forEach(card => card.remove());
    
    filteredCommissions.forEach((ctv, index) => {
        const allSelected = ctv.orders.every(o => selectedOrders.has(o.order_id));
        const someSelected = ctv.orders.some(o => selectedOrders.has(o.order_id));
        
        const html = `
            <div class="ctv-card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
    // created_at_unix is already in milliseconds, no need to multiply by 1000
    const timestamp = order.created_at_unix 
        ? new Date(typeof order.created_at_unix === 'string' ? parseInt(order.created_at_unix) : order.created_at_unix)
        : new Date(order.created_at);
    const date = toVNShortDate(timestamp);
    
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
                                    <p class="text-xs text-gray-500">${toVNShortDate(order.created_at_unix || order.created_at)}</p>
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
            
            // Reload both tabs data
            setTimeout(() => {
                loadUnpaidOrders();
                loadPaymentHistory(); // Also reload payment history to update count
            }, 1000);
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
    const existingCards = container.querySelectorAll('.ctv-card');
    existingCards.forEach(card => card.remove());
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
        
        // Update summary cards for unpaid tab
        // Re-calculate from current allCommissions data
        const summary = {
            total_ctv: allCommissions.length,
            total_orders: allCommissions.reduce((sum, ctv) => sum + ctv.order_count, 0),
            total_commission: allCommissions.reduce((sum, ctv) => sum + ctv.commission_amount, 0)
        };
        updateSummary(summary);
    } else {
        tabHistory.classList.add('active', 'border-green-600', 'text-green-600', 'bg-green-50');
        tabHistory.classList.remove('border-transparent', 'text-gray-500');
        tabUnpaid.classList.remove('active', 'border-green-600', 'text-green-600', 'bg-green-50');
        tabUnpaid.classList.add('border-transparent', 'text-gray-500');
        
        historyContent.classList.remove('hidden');
        unpaidContent.classList.add('hidden');
        
        // Update summary cards for history tab
        updateSummaryForHistory();
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
            
            // Update history count badge
            document.getElementById('historyCount').textContent = paymentHistory.length;
            
            // Update summary cards if currently on history tab
            if (currentTab === 'history') {
                updateSummaryForHistory();
            }
            
            renderPaymentHistory(paymentHistory);
        }
    } catch (error) {
        console.error('Error loading payment history:', error);
        showToast('Không thể tải lịch sử thanh toán', 'error');
    }
}

// Update summary cards for history tab
function updateSummaryForHistory() {
    // Calculate stats from payment history
    const totalAmount = paymentHistory.reduce((sum, p) => sum + (p.commission_amount || 0), 0);
    const totalOrders = paymentHistory.reduce((sum, p) => sum + (p.order_count || 0), 0);
    const totalCTV = paymentHistory.length;
    
    // Update the 4 summary cards
    document.getElementById('totalCTV').textContent = totalCTV;
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalCommission').textContent = formatCurrency(totalAmount);
    document.getElementById('selectedAmount').textContent = '0đ'; // No selection in history tab
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
    
    // Debug: Log payment data
    console.log('💳 Payment data:', {
        payment_date_unix: payment.payment_date_unix,
        type: typeof payment.payment_date_unix,
        date: payment.payment_date_unix ? new Date(payment.payment_date_unix) : null,
        formatted: payment.payment_date_unix ? toVNShortDate(new Date(payment.payment_date_unix)) : 'N/A'
    });
    
    // Format payment date - handle both number and string
    let paymentDateDisplay = 'N/A';
    if (payment.payment_date_unix) {
        const timestamp = typeof payment.payment_date_unix === 'string' 
            ? parseInt(payment.payment_date_unix) 
            : payment.payment_date_unix;
        
        if (timestamp && timestamp > 0) {
            // payment_date_unix is already in milliseconds, no need to multiply by 1000
            paymentDateDisplay = toVNShortDate(new Date(timestamp));
        }
    }
    
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
                <p class="text-sm font-semibold text-gray-900">${paymentDateDisplay}</p>
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
    
    // Clear custom date values when selecting preset
    if (period !== 'custom') {
        document.getElementById('customDateStartPayments').value = '';
        document.getElementById('customDateEndPayments').value = '';
        document.getElementById('customDateLabelPayments').textContent = 'Chọn ngày';
    }
    
    // Update button states - use new class names
    document.querySelectorAll('.period-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`filter-${period}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Update mobile select
    const mobileSelect = document.getElementById('mobileTimeFilter');
    if (mobileSelect) {
        mobileSelect.value = period;
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
        
        console.log('📅 Date Range Filter:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startDateLocal: startDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            endDateLocal: endDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        });
        
        let totalOrdersChecked = 0;
        let totalOrdersMatched = 0;
        
        filtered = filtered.map(ctv => {
            // Filter orders within each CTV
            if (ctv.orders && Array.isArray(ctv.orders)) {
                const filteredOrders = ctv.orders.filter(order => {
                    totalOrdersChecked++;
                    
                    // IMPORTANT: Use created_at_unix (milliseconds timestamp) if available
                    // Otherwise fallback to created_at (ISO string)
                    let orderDate;
                    if (order.created_at_unix) {
                        // created_at_unix is already in milliseconds, no need to multiply by 1000
                        const timestamp = typeof order.created_at_unix === 'string' 
                            ? parseInt(order.created_at_unix) 
                            : order.created_at_unix;
                        orderDate = new Date(timestamp);
                    } else {
                        // Fallback to ISO string
                        orderDate = new Date(order.created_at || order.payment_date);
                    }
                    
                    const matches = orderDate >= startDate && orderDate <= endDate;
                    
                    if (matches) totalOrdersMatched++;
                    
                    // Debug log for first 5 orders
                    if (totalOrdersChecked <= 5) {
                        console.log(`  📦 Order ${order.order_id || order.order_code}:`, {
                            created_at_unix: order.created_at_unix,
                            created_at: order.created_at,
                            orderDate_ISO: orderDate.toISOString(),
                            orderDate_VN: orderDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                            startDate_VN: startDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                            endDate_VN: endDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                            matches,
                            'orderDate >= startDate': orderDate >= startDate,
                            'orderDate <= endDate': orderDate <= endDate
                        });
                    }
                    
                    return matches;
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
        
        console.log(`✅ Date filter result: ${totalOrdersMatched}/${totalOrdersChecked} orders matched`);
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
    
    // Check if elements exist (they were removed in compact layout)
    if (!container || !tagsContainer) {
        return;
    }
    
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


// ============================================
// Custom Date Picker for Payments Filter
// ============================================

let currentDateModePayments = 'single'; // 'single' or 'range'
let customDatePickerModalPayments = null;

/**
 * Show custom date picker modal for payments
 */
function showCustomDatePickerPayments(event) {
    event.stopPropagation();
    
    // Remove existing modal if any
    if (customDatePickerModalPayments) {
        customDatePickerModalPayments.remove();
    }
    
    // Get current values or default to today
    const today = getTodayDateString();
    const startDate = document.getElementById('customDateStartPayments').value || today;
    const endDate = document.getElementById('customDateEndPayments').value || today;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'date-picker-modal';
    modal.innerHTML = `
        <div class="date-picker-content">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Chọn thời gian</h3>
                <button onclick="closeCustomDatePickerPayments()" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Mode Tabs -->
            <div class="date-mode-tabs">
                <button class="date-mode-tab ${currentDateModePayments === 'single' ? 'active' : ''}" onclick="switchDateModePayments('single')">
                    Một ngày
                </button>
                <button class="date-mode-tab ${currentDateModePayments === 'range' ? 'active' : ''}" onclick="switchDateModePayments('range')">
                    Khoảng thời gian
                </button>
            </div>
            
            <!-- Single Date Mode -->
            <div id="singleDateModePayments" class="${currentDateModePayments === 'single' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Chọn ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="singleDateInputPayments" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Range Date Mode -->
            <div id="rangeDateModePayments" class="${currentDateModePayments === 'range' ? '' : 'hidden'}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Từ ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="startDateInputPayments" value="${startDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Đến ngày</label>
                    <div class="date-input-wrapper">
                        <input type="date" id="endDateInputPayments" value="${endDate}" 
                            class="w-full" max="${today}">
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mt-6">
                <button onclick="clearCustomDatePayments()" 
                    class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Xóa bộ lọc
                </button>
                <button onclick="applyCustomDatePayments()" 
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Áp dụng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    customDatePickerModalPayments = modal;
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCustomDatePickerPayments();
        }
    });
}

/**
 * Close custom date picker modal
 */
function closeCustomDatePickerPayments() {
    if (customDatePickerModalPayments) {
        customDatePickerModalPayments.remove();
        customDatePickerModalPayments = null;
    }
}

/**
 * Switch between single and range date mode
 */
function switchDateModePayments(mode) {
    currentDateModePayments = mode;
    
    // Update tabs
    document.querySelectorAll('.date-mode-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide modes
    const singleMode = document.getElementById('singleDateModePayments');
    const rangeMode = document.getElementById('rangeDateModePayments');
    
    if (mode === 'single') {
        singleMode.classList.remove('hidden');
        rangeMode.classList.add('hidden');
    } else {
        singleMode.classList.add('hidden');
        rangeMode.classList.remove('hidden');
    }
}

/**
 * Apply custom date filter
 */
function applyCustomDatePayments() {
    let startDate, endDate;
    
    if (currentDateModePayments === 'single') {
        const singleDate = document.getElementById('singleDateInputPayments').value;
        if (!singleDate) {
            showToast('Vui lòng chọn ngày', 'warning');
            return;
        }
        startDate = singleDate;
        endDate = singleDate;
    } else {
        startDate = document.getElementById('startDateInputPayments').value;
        endDate = document.getElementById('endDateInputPayments').value;
        
        if (!startDate || !endDate) {
            showToast('Vui lòng chọn đầy đủ khoảng thời gian', 'warning');
            return;
        }
        
        // Validate date range
        if (new Date(startDate) > new Date(endDate)) {
            showToast('Ngày bắt đầu phải trước ngày kết thúc', 'warning');
            return;
        }
    }
    
    // Store values
    document.getElementById('customDateStartPayments').value = startDate;
    document.getElementById('customDateEndPayments').value = endDate;
    
    // Update button label
    updateCustomDateLabelPayments(startDate, endDate);
    
    // Update button states
    document.querySelectorAll('.period-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('customDateBtnPayments').classList.add('active');
    
    // Set custom date range in filters
    const customStart = getVNStartOfDate(startDate);
    const customEnd = getVNEndOfDate(endDate);
    currentFilters.period = 'custom';
    currentFilters.dateRange = { startDate: customStart, endDate: customEnd };
    
    // Load data for the month of startDate
    // This ensures we have data for the selected date range
    const startDateObj = new Date(startDate);
    const year = startDateObj.getFullYear();
    const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const targetMonth = `${year}-${month}`;
    
    // Only reload if different month
    if (currentMonth !== targetMonth) {
        currentMonth = targetMonth;
        showToast('Đang tải dữ liệu...', 'info');
        
        loadUnpaidOrders().then(() => {
            applyFilters();
            showToast('Đã áp dụng bộ lọc thời gian', 'success');
        }).catch(() => {
            showToast('Không thể tải dữ liệu', 'error');
        });
    } else {
        // Same month, just apply filter
        applyFilters();
        showToast('Đã áp dụng bộ lọc thời gian', 'success');
    }
    
    // Close modal
    closeCustomDatePickerPayments();
}

/**
 * Clear custom date filter
 */
function clearCustomDatePayments() {
    document.getElementById('customDateStartPayments').value = '';
    document.getElementById('customDateEndPayments').value = '';
    
    // Reset button label
    document.getElementById('customDateLabelPayments').textContent = 'Chọn ngày';
    
    // Apply default filter (thisMonth)
    filterByPeriod('thisMonth');
    
    // Close modal
    closeCustomDatePickerPayments();
    
    showToast('Đã xóa bộ lọc thời gian', 'info');
}

/**
 * Update custom date button label
 */
function updateCustomDateLabelPayments(startDate, endDate) {
    const label = document.getElementById('customDateLabelPayments');
    
    if (startDate === endDate) {
        // Single date - format as DD/MM/YYYY
        const date = new Date(startDate + 'T00:00:00');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        label.textContent = `${day}/${month}/${year}`;
    } else {
        // Date range - format as DD/MM - DD/MM/YYYY
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        
        const startDay = String(start.getDate()).padStart(2, '0');
        const startMonth = String(start.getMonth() + 1).padStart(2, '0');
        const endDay = String(end.getDate()).padStart(2, '0');
        const endMonth = String(end.getMonth() + 1).padStart(2, '0');
        const endYear = end.getFullYear();
        
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
            // Same month
            label.textContent = `${startDay}-${endDay}/${endMonth}/${endYear}`;
        } else {
            // Different months
            label.textContent = `${startDay}/${startMonth}-${endDay}/${endMonth}/${endYear}`;
        }
    }
}

/**
 * Get today's date string in YYYY-MM-DD format (VN timezone)
 */
function getTodayDateString() {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    return vnDateStr;
}

/**
 * Get start of a specific date in VN timezone
 */
function getVNStartOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T00:00:00+07:00');
    return vnDateTime;
}

/**
 * Get end of a specific date in VN timezone
 */
function getVNEndOfDate(dateStr) {
    const vnDateTime = new Date(dateStr + 'T23:59:59.999+07:00');
    return vnDateTime;
}


// ============================================
// CUSTOM STATUS FILTER DROPDOWN
// ============================================

// Toggle status filter dropdown
function toggleStatusFilter(event) {
    event.stopPropagation();

    // Close if already open
    const existingMenu = document.getElementById('statusFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'all', label: 'Tất cả trạng thái', color: 'gray', icon: '●' },
        { value: 'pending', label: 'Chưa thanh toán', color: 'yellow', icon: '●' },
        { value: 'paid', label: 'Đã thanh toán', color: 'green', icon: '●' }
    ];

    const currentValue = document.getElementById('statusFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'statusFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 w-full mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = statuses.map(s => {
        const colorClasses = {
            'gray': 'text-gray-500',
            'yellow': 'text-yellow-500',
            'green': 'text-emerald-500'
        };
        
        const bgClasses = {
            'gray': 'bg-gray-50',
            'yellow': 'bg-yellow-50',
            'green': 'bg-emerald-50'
        };

        return `
        <button 
            onclick="selectStatusFilter('${s.value}', '${s.label}')"
            class="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left ${s.value === currentValue ? bgClasses[s.color] : ''}"
        >
            <span class="text-lg ${colorClasses[s.color]}">${s.icon}</span>
            <span class="text-sm text-gray-700 flex-1">${s.label}</span>
            ${s.value === currentValue ? `
                <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `}).join('');

    button.style.position = 'relative';
    button.parentElement.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.parentElement.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select status filter
function selectStatusFilter(value, label) {
    document.getElementById('statusFilter').value = value;
    document.getElementById('statusFilterLabel').textContent = label;
    document.getElementById('statusFilterMenu')?.remove();
    applyFilters();
}
