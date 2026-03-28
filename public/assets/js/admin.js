// Admin Dashboard JavaScript
let allCTVData = [];
let filteredCTVData = [];
let currentPage = 1;
const itemsPerPage = 10;
let sortOrder = 'none'; // Default off (date sort)
let commissionSortOrder = 'desc'; // Default: tổng hoa hồng cao nhất trước
let rateSortOrder = 'none'; // 'desc' = cao nhất trước, 'asc' = thấp nhất trước, 'none' = không sắp xếp
let currentTimeFilter = 'all'; // Time filter state

// Bulk selection state
let selectedCTVIds = new Set();

// Chart instances
let topCTVChart = null;
let registrationTrendChart = null;
let topCTVMode = 'revenue'; // 'revenue' or 'orders'

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Dashboard initialized');
    
    // Initialize charts first (before data loads)
    initCharts();
    
    // Then load data and setup listeners
    setupEventListeners();
    loadCTVData();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterCTVData, 300));
    }

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterCTVData);
    }
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

// Load CTV data from Google Sheets
async function loadCTVData() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getAllCTV&timestamp=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('📊 Received CTV data:', {
            total: data.ctvList?.length || 0,
            stats: data.stats
        });

        if (data.success) {
            allCTVData = data.ctvList || [];
            filteredCTVData = [...allCTVData];
            
            // Apply default sorting (highest total commission first)
            applySorting();
            updateSortIcon();
            updateCommissionSortIcon();
            updateRateSortIcon();
            
            updateStats(data.stats || {});
            renderCTVTable();
            updateCharts();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load data');
        }

    } catch (error) {
        console.error('❌ Error loading CTV data:', error);
        hideLoading();
        showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    }
}

// Update statistics - Now syncs with filtered data
function updateStats(stats) {
    // Use filteredCTVData instead of allCTVData to sync with current filter
    const dataToUse = filteredCTVData.length > 0 ? filteredCTVData : allCTVData;
    
    const totalCTV = dataToUse.length;
    const activeCTV = dataToUse.filter(ctv => ctv.hasOrders).length;
    
    // Calculate new CTV (this month) from filtered data
    const now = new Date();
    const startOfMonth = getVNStartOfMonth();
    const newCTV = dataToUse.filter(ctv => {
        if (!ctv.timestamp) return false;
        const ctvDate = new Date(ctv.timestamp);
        return ctvDate >= startOfMonth;
    }).length;
    
    // Calculate total commission from filtered data
    const totalCommission = dataToUse.reduce((sum, ctv) => sum + (ctv.totalCommission || 0), 0);
    
    // Calculate total orders from filtered CTVs
    const totalOrders = dataToUse.reduce((sum, ctv) => sum + (ctv.orderCount || 0), 0);

    // Update main stats - Remove skeleton and add text
    updateStatElement('totalCTV', totalCTV, 'text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-3');
    updateStatElement('activeCTV', activeCTV, 'text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums mt-3');
    updateStatElement('newCTV', newCTV, 'text-2xl sm:text-3xl font-bold text-violet-700 tabular-nums mt-3');
    updateStatElement('totalCommission', formatCurrency(totalCommission), 'text-lg sm:text-2xl font-bold text-amber-700 tabular-nums mt-3 break-all leading-tight');
    updateStatElement('totalOrders', totalOrders, 'text-2xl sm:text-3xl font-bold text-sky-800 tabular-nums mt-3');

}

// Helper function to update stat element
function updateStatElement(elementId, value, className) {
    const element = document.getElementById(elementId);
    if (element) {
        // Remove skeleton classes
        element.classList.remove('skeleton', 'h-9', 'h-10', 'w-16', 'w-20', 'w-24', 'w-28', 'rounded', 'rounded-lg', 'mt-2', 'mt-3');
        // Add text classes
        element.className = className;
        // Set value
        element.textContent = value;
    }
}

// Render CTV table
function renderCTVTable() {
    const tbody = document.getElementById('ctvTableBody');
    
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    if (filteredCTVData.length === 0) {
        showEmptyState();
        return;
    }

    tbody.innerHTML = '';

    // Calculate pagination
    const totalPages = Math.ceil(filteredCTVData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredCTVData.slice(startIndex, endIndex);

    // Render rows for current page
    pageData.forEach((ctv, index) => {
        const globalIndex = startIndex + index + 1;
        const row = createCTVRow(ctv, globalIndex);
        tbody.appendChild(row);
    });

    // Render pagination
    renderPagination(totalPages);

    showTable();
}

// Create CTV row
function createCTVRow(ctv, index) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/90 transition-colors fade-in group';

    // STT with checkbox
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-5 py-4 whitespace-nowrap text-sm text-slate-400 font-medium tabular-nums';
    tdIndex.innerHTML = `
        <div class="flex items-center gap-3">
            <input type="checkbox" 
                class="ctv-checkbox w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer" 
                data-ctv-id="${escapeHtml(ctv.referralCode)}"
                ${selectedCTVIds.has(ctv.referralCode) ? 'checked' : ''}
                onchange="handleCTVCheckbox('${escapeHtml(ctv.referralCode)}', this.checked)">
            <span>${index}</span>
        </div>
    `;

    // Thông tin CTV
    const tdInfo = document.createElement('td');
    tdInfo.className = 'px-5 py-4 whitespace-nowrap';
    tdInfo.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-indigo-500/20 ring-2 ring-white shrink-0">
                ${getInitials(ctv.fullName)}
            </div>
            <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-xs">${escapeHtml(ctv.fullName)}</div>
                <div class="text-xs text-slate-500 truncate max-w-[180px] sm:max-w-xs">${escapeHtml(ctv.city || 'Chưa cập nhật')}</div>
            </div>
        </div>
    `;

    // Liên hệ
    const tdContact = document.createElement('td');
    tdContact.className = 'px-5 py-4 whitespace-nowrap';
    tdContact.innerHTML = `
        <div class="text-sm text-slate-800 font-medium">${escapeHtml(ctv.phone)}</div>
        <div class="text-xs text-slate-500 truncate max-w-[200px]">${escapeHtml(ctv.email || 'Chưa có email')}</div>
    `;

    // Mã CTV
    const tdCode = document.createElement('td');
    tdCode.className = 'px-5 py-4 whitespace-nowrap';
    tdCode.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 inline-flex text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-800 font-mono ring-1 ring-indigo-100">
                ${escapeHtml(ctv.referralCode)}
            </span>
            <button type="button" onclick="copyToClipboard('${escapeHtml(ctv.referralCode)}')" class="text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-colors" title="Sao chép">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>
        </div>
    `;

    // Tỷ lệ hoa hồng
    const tdCommissionRate = document.createElement('td');
    tdCommissionRate.className = 'px-5 py-4 whitespace-nowrap';
    const commissionRate = ctv.commissionRate || 0.1;
    const commissionPercent = (commissionRate * 100).toFixed(0);
    tdCommissionRate.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-emerald-700 tabular-nums">${commissionPercent}%</span>
            <button type="button" onclick="editCommission('${escapeHtml(ctv.referralCode)}', ${commissionRate})" 
                class="text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-slate-100 transition-colors" title="Chỉnh sửa">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
        </div>
    `;

    // Số đơn hàng
    const tdOrderCount = document.createElement('td');
    tdOrderCount.className = 'px-5 py-4 whitespace-nowrap text-center';
    const orderCount = ctv.orderCount || 0;
    const hasOrders = orderCount > 0;
    tdOrderCount.innerHTML = `
        <span class="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 text-sm font-bold rounded-lg tabular-nums ${hasOrders ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-100' : 'bg-slate-100 text-slate-400'}">
            ${orderCount}
        </span>
    `;

    // Tổng hoa hồng
    const tdTotalCommission = document.createElement('td');
    tdTotalCommission.className = 'px-5 py-4 whitespace-nowrap';
    const totalCommission = ctv.totalCommission || 0;
    const hasCommission = totalCommission > 0;
    tdTotalCommission.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-sm font-bold tabular-nums ${hasCommission ? 'text-amber-700' : 'text-slate-400'}">
                ${formatCurrency(totalCommission)}
            </span>
        </div>
    `;

    // Trạng thái
    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-5 py-4 whitespace-nowrap';
    const statusInfo = getStatusInfo(ctv);
    tdStatus.innerHTML = `
        <span class="px-2.5 py-1 inline-flex text-xs font-semibold rounded-lg ring-1 ring-black/5 ${statusInfo.class}">
            ${statusInfo.text}
        </span>
    `;

    // Ngày đăng ký
    const tdDate = document.createElement('td');
    tdDate.className = 'px-5 py-4 whitespace-nowrap text-sm text-slate-500 tabular-nums';
    tdDate.textContent = formatDate(ctv.timestamp);

    // Thao tác
    const tdActions = document.createElement('td');
    tdActions.className = 'px-5 py-4 whitespace-nowrap text-center text-sm font-medium';
    tdActions.innerHTML = `
        <div class="flex items-center justify-center gap-1">
            <button type="button" onclick="viewCTVDetail('${escapeHtml(ctv.referralCode)}')" 
                class="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Xem chi tiết">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
            <button type="button" onclick="editCTV('${escapeHtml(ctv.referralCode)}')" 
                class="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors" title="Chỉnh sửa">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
            </button>
            <button type="button" onclick="sendMessage('${escapeHtml(ctv.phone)}')" 
                class="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Nhắn tin">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
            </button>
            <button type="button" onclick="showDeleteCTVModal('${escapeHtml(ctv.referralCode)}')"
                class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xóa CTV">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
            </button>
        </div>
    `;

    tr.appendChild(tdIndex);
    tr.appendChild(tdInfo);
    tr.appendChild(tdContact);
    tr.appendChild(tdCode);
    tr.appendChild(tdCommissionRate);
    tr.appendChild(tdOrderCount);
    tr.appendChild(tdTotalCommission);
    tr.appendChild(tdStatus);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);

    return tr;
}

// Get status info
function getStatusInfo(ctv) {
    const status = ctv.status || 'Mới';
    
    if (ctv.hasOrders) {
        return {
            text: 'Đang hoạt động',
            class: 'bg-emerald-50 text-emerald-800 ring-emerald-100'
        };
    }
    
    if (status === 'Mới') {
        return {
            text: 'Mới',
            class: 'bg-sky-50 text-sky-800 ring-sky-100'
        };
    }
    
    return {
        text: 'Chưa có đơn',
        class: 'bg-slate-100 text-slate-600 ring-slate-200'
    };
}

// Filter CTV data
function filterCTVData() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    filteredCTVData = allCTVData.filter(ctv => {
        // Search filter
        const matchesSearch = !searchTerm || 
            ctv.fullName.toLowerCase().includes(searchTerm) ||
            ctv.phone.includes(searchTerm) ||
            ctv.referralCode.toLowerCase().includes(searchTerm) ||
            (ctv.email && ctv.email.toLowerCase().includes(searchTerm));

        // Status filter
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = ctv.hasOrders;
        } else if (statusFilter === 'new') {
            matchesStatus = ctv.status === 'Mới' && !ctv.hasOrders;
        } else if (statusFilter === 'inactive') {
            matchesStatus = !ctv.hasOrders;
        }

        // Time filter
        const matchesTime = applyTimeFilter(ctv);

        return matchesSearch && matchesStatus && matchesTime;
    });

    // Apply sorting
    applySorting();

    currentPage = 1; // Reset to first page when filtering
    
    // ⚡ Update stats to sync with filtered data
    updateStats({});
    
    renderCTVTable();
    updateCharts();
}

// Apply time filter to CTV
function applyTimeFilter(ctv) {
    if (currentTimeFilter === 'all') return true;
    
    // CTV data has 'timestamp' field from backend
    if (!ctv.timestamp) {
        console.warn('⚠️ CTV missing timestamp:', ctv);
        return false;
    }
    
    const ctvDate = new Date(ctv.timestamp);
    let startDate = null;

    if (currentTimeFilter === 'today') {
        // Today: from 00:00:00 VN time
        startDate = getVNStartOfToday();
    } else if (currentTimeFilter === 'week') {
        // This week: from Monday 00:00:00 VN time
        startDate = getVNStartOfWeek();
    } else if (currentTimeFilter === 'month') {
        // This month: from 1st day VN time
        startDate = getVNStartOfMonth();
    } else if (currentTimeFilter === '3months') {
        // Last 3 months from start of month 3 months ago
        const now = new Date();
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const [year, month] = vnDateStr.split('-');
        const targetMonth = parseInt(month) - 3;
        const targetYear = targetMonth <= 0 ? parseInt(year) - 1 : parseInt(year);
        const adjustedMonth = targetMonth <= 0 ? targetMonth + 12 : targetMonth;
        startDate = new Date(`${targetYear}-${String(adjustedMonth).padStart(2, '0')}-01T00:00:00+07:00`);
    } else if (currentTimeFilter === '6months') {
        // Last 6 months from start of month 6 months ago
        const now = new Date();
        const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const [year, month] = vnDateStr.split('-');
        const targetMonth = parseInt(month) - 6;
        const targetYear = targetMonth <= 0 ? parseInt(year) - 1 : parseInt(year);
        const adjustedMonth = targetMonth <= 0 ? targetMonth + 12 : targetMonth;
        startDate = new Date(`${targetYear}-${String(adjustedMonth).padStart(2, '0')}-01T00:00:00+07:00`);
    }

    const result = startDate ? ctvDate >= startDate : true;
    
    return result;
}

// Filter by registration time
window.filterByRegistrationTime = function(timeFilter) {
    currentTimeFilter = timeFilter;
    
    console.log('🔍 Time filter changed to:', timeFilter);
    
    // Update button states (desktop)
    const buttons = ['timeFilterAll', 'timeFilterToday', 'timeFilterWeek', 'timeFilterMonth', 'timeFilter3Months', 'timeFilter6Months'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    const activeBtn = document.getElementById(`timeFilter${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Update mobile select
    const mobileSelect = document.getElementById('mobileTimeFilter');
    if (mobileSelect) {
        mobileSelect.value = timeFilter;
    }
    
    // Apply filter
    filterCTVData();
};

// View CTV detail
function viewCTVDetail(referralCode) {
    window.location.href = `ctv-detail.html?code=${encodeURIComponent(referralCode)}`;
}

// Send message (Zalo)
function sendMessage(phone) {
    // Clean phone number (remove non-digits)
    let cleanPhone = phone.toString().replace(/\D/g, '');
    
    // Add leading 0 if not present
    if (cleanPhone && !cleanPhone.startsWith('0')) {
        cleanPhone = '0' + cleanPhone;
    }
    
    window.open(`https://zalo.me/${cleanPhone}`, '_blank');
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy: ' + text);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Edit commission rate
function editCommission(referralCode, currentRate) {
    const currentPercent = (currentRate * 100).toFixed(0);
    const newPercent = prompt(`Nhập tỷ lệ hoa hồng mới cho ${referralCode} (%):\n\nHiện tại: ${currentPercent}%`, currentPercent);
    
    if (newPercent === null) return; // User cancelled
    
    const percent = parseFloat(newPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
        showToast('Tỷ lệ hoa hồng không hợp lệ! Phải từ 0-100%', 'error');
        return;
    }
    
    const rate = percent / 100;
    
    // Update via API
    fetch(`${CONFIG.API_URL}/api/ctv/update-commission`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            referralCode: referralCode,
            commissionRate: rate
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(`Đã cập nhật hoa hồng thành ${percent}%`, 'success');
            loadCTVData(); // Reload data
        } else {
            throw new Error(data.error || 'Failed to update');
        }
    })
    .catch(error => {
        console.error('Error updating commission:', error);
        showToast('Không thể cập nhật hoa hồng', 'error');
    });
}

// Edit CTV info
function editCTV(referralCode) {
    const ctv = allCTVData.find(c => c.referralCode === referralCode);
    if (!ctv) {
        showToast('Không tìm thấy CTV', 'error');
        return;
    }
    
    showEditModal(ctv);
}

// Show edit modal
// Generate bank options HTML
function generateBankOptions(selectedBank) {
    const banks = [
        { value: '', name: 'Chọn ngân hàng', desc: '' },
        { value: 'ABBank', name: 'ABBank', desc: 'NHTMCP An Binh' },
        { value: 'ACB', name: 'ACB', desc: 'NH TMCP A Chau' },
        { value: 'Agribank', name: 'Agribank', desc: 'NH NN & PTNT Viet Nam' },
        { value: 'ANZ Bank', name: 'ANZ Bank', desc: '' },
        { value: 'Bac A Bank', name: 'Bac A Bank', desc: 'NHTMCP Bac A' },
        { value: 'BaoViet Bank', name: 'BaoViet Bank', desc: 'NH TMCP Bao Viet' },
        { value: 'BIDV', name: 'BIDV', desc: 'NH Dau tu & Phat trien Viet Nam' },
        { value: 'Citibank', name: 'Citibank', desc: '' },
        { value: 'Dong A Bank', name: 'Dong A Bank', desc: 'NHTMCP Dong A' },
        { value: 'Eximbank', name: 'Eximbank', desc: 'NHTMCP Xuat Nhap Khau' },
        { value: 'GPBank', name: 'GPBank', desc: 'NHTMCP Dau khi Toan cau' },
        { value: 'HDBank', name: 'HDBank', desc: 'NHTMCP phat trien Tp HCM' },
        { value: 'HSBC', name: 'HSBC', desc: 'Hong Kong and Shanghai Bank' },
        { value: 'Hong Leong Bank', name: 'Hong Leong Bank', desc: 'Vietnam' },
        { value: 'IBK', name: 'IBK', desc: 'Industrial Bank of Korea' },
        { value: 'IVB', name: 'IVB', desc: 'NH TNHH Indovina' },
        { value: 'Kien Long Bank', name: 'Kien Long Bank', desc: 'NHTMCP Kien Long' },
        { value: 'Kookmin Bank', name: 'Kookmin Bank', desc: '' },
        { value: 'LienVietPostBank', name: 'LienVietPostBank', desc: 'NH TMCP Buu Dien Lien Viet' },
        { value: 'MB', name: 'MB', desc: 'NHTMCP Quan Doi' },
        { value: 'Maritime Bank', name: 'Maritime Bank', desc: 'NHTMCP Hang Hai' },
        { value: 'May Bank', name: 'May Bank', desc: '' },
        { value: 'Nam A Bank', name: 'Nam A Bank', desc: 'NHTMCP Nam A' },
        { value: 'NCB', name: 'NCB', desc: 'NHTMCP Quoc Dan' },
        { value: 'OCB', name: 'OCB', desc: 'NHTMCP Phuong Dong' },
        { value: 'Oceanbank', name: 'Oceanbank', desc: 'NHTMCP Dai Duong' },
        { value: 'PGBank', name: 'PGBank', desc: 'NHTMCP Xang dau Petrolimex' },
        { value: 'PVcomBank', name: 'PVcomBank', desc: 'NH TMCP Dai Chung Viet Nam' },
        { value: 'Sacombank', name: 'Sacombank', desc: 'NHTMCP Sai gon Thuong Tin' },
        { value: 'SaigonBank', name: 'SaigonBank', desc: 'NHTMCP Sai Gon Cong Thuong' },
        { value: 'SCB', name: 'SCB', desc: 'NHTMCP Sai Gon' },
        { value: 'SeABank', name: 'SeABank', desc: 'NHTMCP Dong Nam A' },
        { value: 'SHB', name: 'SHB', desc: 'NHTMCP Sai gon - Ha Noi' },
        { value: 'Shinhan Bank', name: 'Shinhan Bank', desc: 'Vietnam' },
        { value: 'Standard Chartered', name: 'Standard Chartered', desc: 'Bank' },
        { value: 'Techcombank', name: 'Techcombank', desc: 'NHTMCP Ky thuong VN' },
        { value: 'TPBank', name: 'TPBank', desc: 'NH TMCP Tien Phong' },
        { value: 'VBSP', name: 'VBSP', desc: 'NH Chinh sach xa hoi' },
        { value: 'VCB', name: 'VCB', desc: 'NH TMCP Ngoai Thuong Viet Nam (Vietcombank)' },
        { value: 'VDB', name: 'VDB', desc: 'NH Phat trien Viet Nam' },
        { value: 'VIB', name: 'VIB', desc: 'NHTMCP Quoc Te' },
        { value: 'VID Public Bank', name: 'VID Public Bank', desc: '' },
        { value: 'Viet Capital Bank', name: 'Viet Capital Bank', desc: 'NHTMCP Ban Viet' },
        { value: 'VietABank', name: 'VietABank', desc: 'NHTMCP Viet A' },
        { value: 'VietBank', name: 'VietBank', desc: 'NHTMCP Viet Nam Thuong Tin' },
        { value: 'VietinBank', name: 'VietinBank', desc: 'NH Cong Thuong Viet Nam' },
        { value: 'Vinasiam Bank', name: 'Vinasiam Bank', desc: 'NH Lien doanh Viet Thai' },
        { value: 'VNCB', name: 'VNCB', desc: 'NHTMCP Xay dung VN' },
        { value: 'VPBank', name: 'VPBank', desc: 'NHTMCP VN Thinh Vuong' },
        { value: 'VRB', name: 'VRB', desc: 'NH Lien doanh Viet Nga' },
        { value: 'Woori Bank', name: 'Woori Bank', desc: '' }
    ];
    
    return banks.map(bank => {
        const displayText = bank.value === '' 
            ? `<span class="text-gray-500 italic">${bank.name}</span>`
            : bank.desc 
                ? `<span class="font-medium text-gray-900">${bank.name}</span> - <span class="text-gray-600">${bank.desc}</span>`
                : `<span class="font-medium text-gray-900">${bank.name}</span>`;
        
        return `<div class="edit-bank-option px-4 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors ${bank.value === '' ? 'border-b border-gray-100' : ''}" data-value="${bank.value}">
            ${displayText}
        </div>`;
    }).join('');
}

function showEditModal(ctv) {
    const modal = document.createElement('div');
    modal.id = 'editCTVModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-admin-primary to-admin-secondary px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Chỉnh sửa thông tin CTV</h2>
                        <p class="text-sm text-white/80">${escapeHtml(ctv.referralCode)}</p>
                    </div>
                </div>
                <button onclick="closeEditModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Form -->
            <form id="editCTVForm" class="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Họ tên -->
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Họ và Tên *</label>
                        <input type="text" name="fullName" value="${escapeHtml(ctv.fullName)}" required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                    </div>
                    
                    <!-- Số điện thoại -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Số điện thoại *</label>
                        <input type="tel" name="phone" value="${escapeHtml(ctv.phone)}" required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                    </div>
                    
                    <!-- Email -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input type="email" name="email" value="${escapeHtml(ctv.email || '')}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                    </div>
                    
                    <!-- Tỉnh/Thành -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tỉnh/Thành phố</label>
                        <input type="text" name="city" value="${escapeHtml(ctv.city || '')}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                    </div>
                    
                    <!-- Tuổi -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Độ tuổi</label>
                        <select name="age" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                            <option value="">Chọn độ tuổi</option>
                            <option value="18-25" ${ctv.age === '18-25' ? 'selected' : ''}>18-25 tuổi</option>
                            <option value="26-30" ${ctv.age === '26-30' ? 'selected' : ''}>26-30 tuổi</option>
                            <option value="31-35" ${ctv.age === '31-35' ? 'selected' : ''}>31-35 tuổi</option>
                            <option value="36-40" ${ctv.age === '36-40' ? 'selected' : ''}>36-40 tuổi</option>
                            <option value="40+" ${ctv.age === '40+' ? 'selected' : ''}>Trên 40 tuổi</option>
                        </select>
                    </div>
                    
                    <!-- Số tài khoản -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Số tài khoản</label>
                        <input type="text" name="bankAccountNumber" value="${escapeHtml(ctv.bankAccountNumber || '')}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                            placeholder="1234567890">
                    </div>
                    
                    <!-- Tên ngân hàng -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tên ngân hàng</label>
                        <div class="relative">
                            <button type="button" id="editBankSelectButton"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors">
                                <span id="editBankSelectedText" class="${ctv.bankName ? 'text-gray-900' : 'text-gray-500'}">${ctv.bankName || 'Chọn ngân hàng'}</span>
                                <svg class="w-5 h-5 text-gray-400 transition-transform" id="editBankDropdownIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <input type="hidden" name="bankName" id="editBankNameValue" value="${escapeHtml(ctv.bankName || '')}">
                            
                            <div id="editBankDropdown" class="hidden fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden" style="width: 0; max-width: 600px;">
                                <div class="p-3 border-b border-gray-200 bg-gray-50">
                                    <div class="relative">
                                        <input type="text" id="editBankSearchInput" placeholder="Tìm kiếm..."
                                            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent text-sm"
                                            autocomplete="off">
                                        <svg class="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                                
                                <div class="max-h-60 overflow-y-auto">
                                    ${generateBankOptions(ctv.bankName)}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Trạng thái -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
                        <select name="status" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                            <option value="Mới" ${ctv.status === 'Mới' ? 'selected' : ''}>Mới</option>
                            <option value="Đang hoạt động" ${ctv.status === 'Đang hoạt động' ? 'selected' : ''}>Đang hoạt động</option>
                            <option value="Tạm ngưng" ${ctv.status === 'Tạm ngưng' ? 'selected' : ''}>Tạm ngưng</option>
                        </select>
                    </div>
                    
                    <!-- Hoa hồng -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hoa hồng (%)</label>
                        <input type="number" name="commissionRate" value="${((ctv.commissionRate || 0.1) * 100).toFixed(0)}" min="0" max="100" step="1"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                    </div>
                </div>
                
                <input type="hidden" name="referralCode" value="${escapeHtml(ctv.referralCode)}">
            </form>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button type="button" onclick="closeEditModal()" 
                    class="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button type="submit" form="editCTVForm"
                    class="px-6 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize searchable bank select
    initEditBankSelect();
    
    // Handle form submit
    document.getElementById('editCTVForm').addEventListener('submit', handleEditCTVSubmit);
}

// Initialize edit bank select functionality
function initEditBankSelect() {
    const bankSelectButton = document.getElementById('editBankSelectButton');
    const bankSearchInput = document.getElementById('editBankSearchInput');
    const bankDropdown = document.getElementById('editBankDropdown');
    const bankNameValue = document.getElementById('editBankNameValue');
    const bankSelectedText = document.getElementById('editBankSelectedText');
    const bankDropdownIcon = document.getElementById('editBankDropdownIcon');
    const bankOptions = document.querySelectorAll('.edit-bank-option');

    if (!bankSelectButton || !bankSearchInput || !bankDropdown) return;

    // Toggle dropdown
    bankSelectButton.addEventListener('click', function(e) {
        e.stopPropagation();
        const isHidden = bankDropdown.classList.contains('hidden');
        
        if (isHidden) {
            // Position dropdown using fixed positioning
            const buttonRect = bankSelectButton.getBoundingClientRect();
            const dropdownMaxHeight = 300;
            const spaceBelow = window.innerHeight - buttonRect.bottom;
            const spaceAbove = buttonRect.top;
            
            // Set width to match button
            bankDropdown.style.width = buttonRect.width + 'px';
            bankDropdown.style.left = buttonRect.left + 'px';
            
            // Check if dropdown should open upward
            if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
                // Open upward
                bankDropdown.style.bottom = (window.innerHeight - buttonRect.top + 4) + 'px';
                bankDropdown.style.top = 'auto';
            } else {
                // Open downward (default)
                bankDropdown.style.top = (buttonRect.bottom + 4) + 'px';
                bankDropdown.style.bottom = 'auto';
            }
            
            bankDropdown.classList.remove('hidden');
            bankDropdownIcon.style.transform = 'rotate(180deg)';
            setTimeout(() => bankSearchInput.focus(), 100);
            filterEditBankOptions('');
        } else {
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
        }
    });

    // Filter banks
    bankSearchInput.addEventListener('input', function() {
        filterEditBankOptions(this.value.toLowerCase());
    });

    // Prevent dropdown close on search input click
    bankSearchInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // Filter function
    function filterEditBankOptions(searchTerm) {
        let hasVisibleOptions = false;
        bankOptions.forEach(option => {
            const text = option.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                option.style.display = 'block';
                hasVisibleOptions = true;
            } else {
                option.style.display = 'none';
            }
        });

        const optionsList = bankDropdown.querySelector('.max-h-60');
        let noResultsDiv = document.getElementById('editNoResultsMessage');
        
        if (!hasVisibleOptions && searchTerm) {
            if (!noResultsDiv) {
                noResultsDiv = document.createElement('div');
                noResultsDiv.id = 'editNoResultsMessage';
                noResultsDiv.className = 'px-4 py-3 text-gray-500 text-center text-sm';
                noResultsDiv.textContent = 'Không tìm thấy ngân hàng';
                optionsList.appendChild(noResultsDiv);
            }
            noResultsDiv.style.display = 'block';
        } else {
            if (noResultsDiv) {
                noResultsDiv.style.display = 'none';
            }
        }
    }

    // Handle option selection
    bankOptions.forEach(option => {
        option.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            const bankName = this.querySelector('.font-medium')?.textContent || this.textContent.trim();
            
            bankNameValue.value = value;
            
            if (value) {
                bankSelectedText.textContent = bankName;
                bankSelectedText.classList.remove('text-gray-500');
                bankSelectedText.classList.add('text-gray-900');
            } else {
                bankSelectedText.textContent = 'Chọn ngân hàng';
                bankSelectedText.classList.add('text-gray-500');
                bankSelectedText.classList.remove('text-gray-900');
            }
            
            bankSearchInput.value = '';
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!bankSelectButton.contains(event.target) && !bankDropdown.contains(event.target)) {
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
            bankSearchInput.value = '';
        }
    });

    // Keyboard navigation
    let currentFocus = -1;
    bankSearchInput.addEventListener('keydown', function(e) {
        const visibleOptions = Array.from(bankOptions).filter(opt => opt.style.display !== 'none');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            if (currentFocus >= visibleOptions.length) currentFocus = 0;
            setActive(visibleOptions);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            if (currentFocus < 0) currentFocus = visibleOptions.length - 1;
            setActive(visibleOptions);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && visibleOptions[currentFocus]) {
                visibleOptions[currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            bankDropdown.classList.add('hidden');
            bankDropdownIcon.style.transform = 'rotate(0deg)';
            bankSearchInput.value = '';
        }
    });

    function setActive(options) {
        removeActive(options);
        if (currentFocus >= options.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = options.length - 1;
        options[currentFocus].classList.add('bg-indigo-100');
        options[currentFocus].scrollIntoView({ block: 'nearest' });
    }

    function removeActive(options) {
        options.forEach(option => {
            option.classList.remove('bg-indigo-100');
        });
    }
}

// Handle edit form submit
async function handleEditCTVSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        referralCode: formData.get('referralCode'),
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        city: formData.get('city'),
        age: formData.get('age'),
        bankAccountNumber: formData.get('bankAccountNumber'),
        bankName: formData.get('bankName'),
        status: formData.get('status'),
        commissionRate: parseFloat(formData.get('commissionRate')) / 100
    };
    
    const submitBtn = document.querySelector('#editCTVModal button[type="submit"]');
    if (!submitBtn) {
        console.error('Submit button not found');
        return;
    }
    
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/ctv/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Đã cập nhật thông tin CTV', 'success');
            closeEditModal();
            loadCTVData();
        } else {
            throw new Error(result.error || 'Failed to update');
        }
    } catch (error) {
        console.error('Error updating CTV:', error);
        showToast('Không thể cập nhật thông tin', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Close edit modal
function closeEditModal() {
    const modal = document.getElementById('editCTVModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Render pagination
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">';
    
    // Info text
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredCTVData.length);
    html += `<div class="text-sm text-slate-600">
        Hiển thị <span class="font-semibold text-slate-900 tabular-nums">${startItem}</span>–<span class="font-semibold text-slate-900 tabular-nums">${endItem}</span> / <span class="font-semibold text-slate-900 tabular-nums">${filteredCTVData.length}</span> CTV
    </div>`;
    
    // Pagination buttons
    html += '<div class="flex items-center gap-2">';
    
    // Previous button
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
    </button>`;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        html += `<button onclick="goToPage(1)" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">1</button>`;
        if (startPage > 2) {
            html += '<span class="px-2 text-slate-400">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button type="button" class="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-sm">${i}</button>`;
        } else {
            html += `<button type="button" onclick="goToPage(${i})" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="px-2 text-slate-400">...</span>';
        }
        html += `<button type="button" onclick="goToPage(${totalPages})" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
        class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
    </button>`;
    
    html += '</div></div>';
    
    paginationContainer.innerHTML = html;
}

// Go to page
function goToPage(page) {
    const totalPages = Math.ceil(filteredCTVData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderCTVTable();
    
    // Scroll to top of table
    document.getElementById('tableContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Toggle date sort
function toggleDateSort() {
    // Reset commission sort
    commissionSortOrder = 'none';
    updateCommissionSortIcon();
    
    // Cycle through: desc -> asc -> none -> desc
    if (sortOrder === 'desc') {
        sortOrder = 'asc';
    } else if (sortOrder === 'asc') {
        sortOrder = 'none';
    } else {
        sortOrder = 'desc';
    }
    
    // Update icon
    updateSortIcon();
    
    // Apply sort
    applySorting();
    
    // Reset to first page
    currentPage = 1;
    renderCTVTable();
}

// Toggle commission sort
function toggleCommissionSort() {
    // Reset other sorts
    sortOrder = 'none';
    rateSortOrder = 'none';
    updateSortIcon();
    updateRateSortIcon();
    
    // Cycle through: desc -> asc -> none -> desc
    if (commissionSortOrder === 'desc') {
        commissionSortOrder = 'asc';
    } else if (commissionSortOrder === 'asc') {
        commissionSortOrder = 'none';
    } else {
        commissionSortOrder = 'desc';
    }
    
    // Update icon
    updateCommissionSortIcon();
    
    // Apply sort
    applySorting();
    
    // Reset to first page
    currentPage = 1;
    renderCTVTable();
}

function toggleRateSort() {
    // Reset other sorts
    sortOrder = 'none';
    commissionSortOrder = 'none';
    updateSortIcon();
    updateCommissionSortIcon();
    
    // Cycle through: desc -> asc -> none -> desc
    if (rateSortOrder === 'desc') {
        rateSortOrder = 'asc';
    } else if (rateSortOrder === 'asc') {
        rateSortOrder = 'none';
    } else {
        rateSortOrder = 'desc';
    }
    
    // Update icon
    updateRateSortIcon();
    
    // Apply sort
    applySorting();
    
    // Reset to first page
    currentPage = 1;
    renderCTVTable();
}

// Update sort icon
function updateSortIcon() {
    const icon = document.getElementById('sortIcon');
    if (!icon) return;
    
    if (sortOrder === 'desc') {
        // Mới nhất trước - Arrow down
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-admin-primary');
    } else if (sortOrder === 'asc') {
        // Cũ nhất trước - Arrow up
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-admin-primary');
    } else {
        // Không sắp xếp - Both arrows
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-admin-primary');
        icon.classList.add('text-gray-400');
    }
}

// Update commission sort icon
function updateCommissionSortIcon() {
    const icon = document.getElementById('commissionSortIcon');
    if (!icon) return;
    
    if (commissionSortOrder === 'desc') {
        // Cao nhất trước - Arrow down
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-orange-500');
    } else if (commissionSortOrder === 'asc') {
        // Thấp nhất trước - Arrow up
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-orange-500');
    } else {
        // Không sắp xếp - Both arrows
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-orange-500');
        icon.classList.add('text-gray-400');
    }
}

function updateRateSortIcon() {
    const icon = document.getElementById('rateSortIcon');
    if (!icon) return;
    
    if (rateSortOrder === 'desc') {
        // Cao nhất trước - Arrow down
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-green-600');
    } else if (rateSortOrder === 'asc') {
        // Thấp nhất trước - Arrow up
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-green-600');
    } else {
        // Không sắp xếp - Both arrows
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-green-600');
        icon.classList.add('text-gray-400');
    }
}

// Apply sorting
function applySorting() {
    // Ưu tiên sắp xếp theo rate nếu đang active
    if (rateSortOrder !== 'none') {
        filteredCTVData.sort((a, b) => {
            const rateA = a.commissionRate || 0;
            const rateB = b.commissionRate || 0;
            
            if (rateSortOrder === 'desc') {
                return rateB - rateA; // Cao nhất trước
            } else {
                return rateA - rateB; // Thấp nhất trước
            }
        });
    } else if (commissionSortOrder !== 'none') {
        filteredCTVData.sort((a, b) => {
            const commA = a.totalCommission || 0;
            const commB = b.totalCommission || 0;
            
            if (commissionSortOrder === 'desc') {
                return commB - commA; // Cao nhất trước
            } else {
                return commA - commB; // Thấp nhất trước
            }
        });
    } else if (sortOrder !== 'none') {
        filteredCTVData.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            
            if (sortOrder === 'desc') {
                return dateB - dateA; // Mới nhất trước
            } else {
                return dateA - dateB; // Cũ nhất trước
            }
        });
    }
}

// Refresh data
function refreshData() {
    showToast('Đang tải lại dữ liệu...', 'info');
    loadCTVData();
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

// UI State functions
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function showTable() {
    document.getElementById('tableContent').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function showEmptyState() {
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}

// showToast is now provided by toast-manager.js

// ============================================
// BULK ACTIONS
// ============================================

// Handle individual checkbox change
function handleCTVCheckbox(referralCode, isChecked) {
    if (isChecked) {
        selectedCTVIds.add(referralCode);
    } else {
        selectedCTVIds.delete(referralCode);
    }
    
    updateBulkActionsBar();
    updateSelectAllCheckbox();
}

// Toggle select all
function toggleSelectAll(isChecked) {
    selectedCTVIds.clear();
    
    if (isChecked) {
        // Select all CTVs on current page
        const tbody = document.getElementById('ctvTableBody');
        const checkboxes = tbody.querySelectorAll('.ctv-checkbox');
        checkboxes.forEach(checkbox => {
            const ctvId = checkbox.getAttribute('data-ctv-id');
            selectedCTVIds.add(ctvId);
            checkbox.checked = true;
        });
    } else {
        // Deselect all
        const checkboxes = document.querySelectorAll('.ctv-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    updateBulkActionsBar();
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const tbody = document.getElementById('ctvTableBody');
    const checkboxes = tbody.querySelectorAll('.ctv-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// Update bulk actions bar visibility and count
function updateBulkActionsBar() {
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');
    
    if (!bulkActionsBar || !selectedCount) return;
    
    if (selectedCTVIds.size > 0) {
        bulkActionsBar.classList.remove('hidden');
        selectedCount.textContent = selectedCTVIds.size;
    } else {
        bulkActionsBar.classList.add('hidden');
    }
}

// Clear selection
function clearSelection() {
    selectedCTVIds.clear();
    
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('.ctv-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
    
    updateBulkActionsBar();
}

// Bulk export CTV
function bulkExportCTV() {
    if (selectedCTVIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 CTV', 'warning');
        return;
    }
    
    // Get selected CTVs data
    const selectedCTVs = allCTVData.filter(ctv => selectedCTVIds.has(ctv.referralCode));
    
    // Create CSV content
    const headers = ['Mã CTV', 'Họ tên', 'Số điện thoại', 'Email', 'Tỉnh/Thành', 'Tỷ lệ HH', 'Số đơn', 'Tổng HH', 'Trạng thái', 'Ngày đăng ký'];
    const rows = selectedCTVs.map(ctv => [
        ctv.referralCode,
        ctv.fullName,
        ctv.phone,
        ctv.email || '',
        ctv.city || '',
        `${((ctv.commissionRate || 0.1) * 100).toFixed(0)}%`,
        ctv.orderCount || 0,
        ctv.totalCommission || 0,
        getStatusInfo(ctv).text,
        formatDate(ctv.timestamp)
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Add BOM for UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Download
    const link = document.createElement('a');
    link.href = url;
    link.download = `CTV_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showToast(`Đã export ${selectedCTVIds.size} CTV`, 'success');
}

// Bulk update commission (OPTIMIZED - Single API Call)
async function bulkUpdateCommission() {
    if (selectedCTVIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 CTV', 'warning');
        return;
    }
    
    const newPercent = prompt(`Nhập tỷ lệ hoa hồng mới cho ${selectedCTVIds.size} CTV (%):\n\nVí dụ: 10 (cho 10%)`, '10');
    
    if (newPercent === null) return; // User cancelled
    
    const percent = parseFloat(newPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
        showToast('Tỷ lệ hoa hồng không hợp lệ! Phải từ 0-100%', 'error');
        return;
    }
    
    const rate = percent / 100;
    
    // Show confirmation
    if (!confirm(`Xác nhận cập nhật hoa hồng thành ${percent}% cho ${selectedCTVIds.size} CTV đã chọn?`)) {
        return;
    }
    
    const selectedCodes = Array.from(selectedCTVIds);
    
    showToast('Đang cập nhật...', 'info');
    
    try {
        // ⚡ OPTIMIZED: Single API call instead of multiple calls
        const response = await fetch(`${CONFIG.API_URL}/api/ctv/bulk-update-commission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                referralCodes: selectedCodes,
                commissionRate: rate
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const updatedCount = result.updatedCount || selectedCodes.length;
            showToast(`✅ Đã cập nhật hoa hồng thành ${percent}% cho ${updatedCount} CTV`, 'success');
            clearSelection();
            loadCTVData();
        } else {
            throw new Error(result.error || 'Failed to update commission');
        }
        
    } catch (error) {
        console.error('Error in bulk update commission:', error);
        showToast('❌ Có lỗi xảy ra khi cập nhật hoa hồng', 'error');
    }
}

// Bulk send message
function bulkSendMessage() {
    if (selectedCTVIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 CTV', 'warning');
        return;
    }
    
    // Get selected CTVs data
    const selectedCTVs = allCTVData.filter(ctv => selectedCTVIds.has(ctv.referralCode));
    
    // Show modal with message template
    const modal = document.createElement('div');
    modal.id = 'bulkMessageModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Gửi tin nhắn hàng loạt</h2>
                        <p class="text-sm text-white/80">Đã chọn ${selectedCTVIds.size} CTV</p>
                    </div>
                </div>
                <button onclick="closeBulkMessageModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Content -->
            <div class="p-6">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Nội dung tin nhắn</label>
                    <textarea id="bulkMessageContent" rows="6" 
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Nhập nội dung tin nhắn...&#10;&#10;Ví dụ:&#10;Chào bạn! Cảm ơn bạn đã tham gia chương trình CTV của chúng tôi. Hãy tiếp tục chia sẻ để nhận thêm nhiều hoa hồng nhé! 💪"></textarea>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div class="flex items-start gap-3">
                        <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div class="text-sm text-blue-800">
                            <p class="font-medium mb-1">Lưu ý:</p>
                            <ul class="list-disc list-inside space-y-1 text-blue-700">
                                <li>Tin nhắn sẽ được gửi qua Zalo</li>
                                <li>Mỗi CTV sẽ nhận được tin nhắn riêng</li>
                                <li>Bạn cần có Zalo đã đăng nhập trên trình duyệt</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm font-medium text-gray-700 mb-2">Danh sách CTV nhận tin:</p>
                    <div class="max-h-32 overflow-y-auto space-y-1">
                        ${selectedCTVs.map(ctv => `
                            <div class="flex items-center gap-2 text-sm text-gray-600">
                                <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                                <span class="font-medium">${escapeHtml(ctv.fullName)}</span>
                                <span class="text-gray-400">•</span>
                                <span>${escapeHtml(ctv.phone)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button type="button" onclick="closeBulkMessageModal()" 
                    class="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button type="button" onclick="sendBulkMessages()"
                    class="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Gửi tin nhắn
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Close bulk message modal
function closeBulkMessageModal() {
    const modal = document.getElementById('bulkMessageModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Send bulk messages
function sendBulkMessages() {
    const messageContent = document.getElementById('bulkMessageContent').value.trim();
    
    if (!messageContent) {
        showToast('Vui lòng nhập nội dung tin nhắn', 'warning');
        return;
    }
    
    // Get selected CTVs
    const selectedCTVs = allCTVData.filter(ctv => selectedCTVIds.has(ctv.referralCode));
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(messageContent);
    
    // Open Zalo for each CTV with delay
    let delay = 0;
    selectedCTVs.forEach((ctv, index) => {
        setTimeout(() => {
            let cleanPhone = ctv.phone.toString().replace(/\D/g, '');
            if (cleanPhone && !cleanPhone.startsWith('0')) {
                cleanPhone = '0' + cleanPhone;
            }
            
            // Open Zalo with pre-filled message
            window.open(`https://zalo.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
            
            // Show progress
            if (index === selectedCTVs.length - 1) {
                showToast(`Đã mở ${selectedCTVs.length} cửa sổ Zalo`, 'success');
                closeBulkMessageModal();
            }
        }, delay);
        
        delay += 500; // 500ms delay between each window
    });
}

// ============================================
// DELETE CTV (SINGLE)
// ============================================

let _deleteTarget = null;

function showDeleteCTVModal(referralCode) {
    const ctv = allCTVData.find(c => c.referralCode === referralCode);
    if (!ctv) return;

    _deleteTarget = referralCode;

    const modal = document.createElement('div');
    modal.id = 'deleteCTVModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style="animation: slideUp 0.25s cubic-bezier(0.16,1,0.3,1)">
            <div class="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-white">Xóa Cộng Tác Viên</h2>
                        <p class="text-sm text-white/80">Hành động không thể hoàn tác</p>
                    </div>
                </div>
                <button onclick="closeDeleteModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="p-6">
                <div class="flex items-start gap-4 mb-5">
                    <div class="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0">
                        ${getInitials(ctv.fullName)}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-slate-900 truncate">${escapeHtml(ctv.fullName)}</p>
                        <p class="text-sm text-slate-500 font-mono">${escapeHtml(ctv.referralCode)}</p>
                        <p class="text-sm text-slate-500">${escapeHtml(ctv.phone)}</p>
                    </div>
                </div>

                ${ctv.orderCount > 0 ? `
                <div class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                    <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <p class="text-sm text-amber-800">CTV này có <strong>${ctv.orderCount} đơn hàng</strong> và <strong>${formatCurrency(ctv.totalCommission || 0)}</strong> hoa hồng. Dữ liệu đơn hàng sẽ được giữ lại.</p>
                </div>` : `
                <div class="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <p class="text-sm text-red-800">CTV chưa có đơn hàng nào. Có thể xóa an toàn.</p>
                </div>`}
            </div>
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button type="button" onclick="closeDeleteModal()"
                    class="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors font-medium text-sm">
                    Hủy
                </button>
                <button type="button" id="confirmDeleteBtn" onclick="confirmDeleteCTV()"
                    class="px-5 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Xóa CTV
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeDeleteModal() {
    _deleteTarget = null;
    const modal = document.getElementById('deleteCTVModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.2s';
        setTimeout(() => modal.remove(), 200);
    }
}

async function confirmDeleteCTV() {
    if (!_deleteTarget) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    try {
        const res = await fetch(`${CONFIG.API_URL}?action=bulkDeleteCTV`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCodes: [_deleteTarget] })
        });
        const result = await res.json();

        if (result.success) {
            closeDeleteModal();

            // Optimistic update — remove from both data arrays without reload
            allCTVData = allCTVData.filter(c => c.referralCode !== _deleteTarget);
            filteredCTVData = filteredCTVData.filter(c => c.referralCode !== _deleteTarget);
            selectedCTVIds.delete(_deleteTarget);

            renderCTVTable();
            updateStats();
            updateCharts();

            showToast('Đã xóa CTV thành công', 'success');
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (err) {
        console.error('Delete CTV error:', err);
        showToast('Không thể xóa CTV. Vui lòng thử lại.', 'error');
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Xóa CTV`;
    }
}

// ============================================
// BULK DELETE CTV
// ============================================

// Bulk delete CTV
function bulkDeleteCTV() {
    if (selectedCTVIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 CTV', 'warning');
        return;
    }
    
    // Get selected CTVs data
    const selectedCTVs = allCTVData.filter(ctv => selectedCTVIds.has(ctv.referralCode));
    
    // Show confirmation modal
    const modal = document.createElement('div');
    modal.id = 'bulkDeleteModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Xác nhận xóa CTV</h2>
                        <p class="text-sm text-white/80">Hành động này không thể hoàn tác</p>
                    </div>
                </div>
                <button onclick="closeBulkDeleteModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Content -->
            <div class="p-6">
                <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                    <div class="flex items-start gap-3">
                        <svg class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div class="flex-1">
                            <p class="font-bold text-red-900 mb-2">Cảnh báo!</p>
                            <p class="text-sm text-red-800">
                                Bạn đang chuẩn bị xóa <strong>${selectedCTVIds.size} CTV</strong>. 
                                Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn và không thể khôi phục.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <p class="text-sm font-medium text-gray-700 mb-2">Danh sách CTV sẽ bị xóa:</p>
                    <div class="space-y-1">
                        ${selectedCTVs.map(ctv => `
                            <div class="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-2 rounded">
                                <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                                <span class="font-medium">${escapeHtml(ctv.fullName)}</span>
                                <span class="text-gray-400">•</span>
                                <span class="font-mono text-xs">${escapeHtml(ctv.referralCode)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p class="text-xs text-yellow-800">
                        <strong>Lưu ý:</strong> Các đơn hàng và hoa hồng liên quan đến CTV này sẽ vẫn được giữ lại trong hệ thống.
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button type="button" onclick="closeBulkDeleteModal()" 
                    class="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button type="button" onclick="confirmBulkDelete()"
                    class="px-6 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Xác nhận xóa
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Close bulk delete modal
function closeBulkDeleteModal() {
    const modal = document.getElementById('bulkDeleteModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Confirm bulk delete
async function confirmBulkDelete() {
    const selectedCodes = Array.from(selectedCTVIds);
    
    const confirmBtn = document.querySelector('#bulkDeleteModal button[onclick="confirmBulkDelete()"]');
    if (!confirmBtn) return;
    
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    confirmBtn.disabled = true;
    
    try {
        // Call API to delete CTVs
        const response = await fetch(`${CONFIG.API_URL}?action=bulkDeleteCTV`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                referralCodes: selectedCodes
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Đã xóa ${selectedCodes.length} CTV thành công`, 'success');
            closeBulkDeleteModal();
            clearSelection();
            loadCTVData(); // Reload data
        } else {
            throw new Error(result.error || 'Failed to delete CTVs');
        }
    } catch (error) {
        console.error('Error deleting CTVs:', error);
        showToast('Không thể xóa CTV. Vui lòng thử lại sau.', 'error');
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
}

// ============================================
// ADD CTV MODAL
// ============================================

// Show add CTV modal
function showAddCTVModal() {
    const modal = document.getElementById('addCTVModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset form
        document.getElementById('addCTVForm').reset();
        
        // Fill demo data for quick testing
        const form = document.getElementById('addCTVForm');
        form.querySelector('input[name="fullName"]').value = 'Nguyễn Văn Test';
        form.querySelector('input[name="phone"]').value = '0912345678';
        form.querySelector('input[name="email"]').value = 'test@example.com';
        form.querySelector('input[name="city"]').value = 'Hà Nội';
        form.querySelector('select[name="age"]').value = '26-30';
        form.querySelector('input[name="bankAccountNumber"]').value = '1234567890123';
        form.querySelector('input[name="commissionRate"]').value = '10';
        form.querySelector('select[name="status"]').value = 'Mới';
        
        // Set demo bank
        const bankSelectedText = document.getElementById('bankSelectedText');
        const bankNameValue = document.getElementById('bankNameValue');
        if (bankSelectedText && bankNameValue) {
            bankNameValue.value = 'Techcombank';
            bankSelectedText.textContent = 'Techcombank';
            bankSelectedText.classList.remove('text-gray-500');
            bankSelectedText.classList.add('text-gray-900');
        }
    }
}

// Close add CTV modal
function closeAddCTVModal() {
    const modal = document.getElementById('addCTVModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.opacity = '1';
        }, 200);
    }
}

// Handle add CTV form submit
document.addEventListener('DOMContentLoaded', function() {
    const addCTVForm = document.getElementById('addCTVForm');
    if (addCTVForm) {
        addCTVForm.addEventListener('submit', handleAddCTVSubmit);
    }
});

async function handleAddCTVSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
        email: formData.get('email') || null,
        city: formData.get('city') || null,
        age: formData.get('age') || null,
        bankAccountNumber: formData.get('bankAccountNumber') || null,
        bankName: formData.get('bankName') || null,
        commissionRate: parseFloat(formData.get('commissionRate')) / 100,
        status: formData.get('status') || 'Mới'
    };
    
    // Debug: Log data being sent
    console.log('📤 Sending CTV data:', data);
    console.log('🏦 Bank Name from form:', formData.get('bankName'));
    console.log('💳 Bank Account Number from form:', formData.get('bankAccountNumber'));
    
    // Validate
    if (!data.fullName || !data.phone) {
        showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
        return;
    }
    
    // Validate phone number
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(data.phone)) {
        showToast('Số điện thoại không hợp lệ (10-11 chữ số)', 'error');
        return;
    }
    
    // Validate commission rate
    if (isNaN(data.commissionRate) || data.commissionRate < 0 || data.commissionRate > 1) {
        showToast('Tỷ lệ hoa hồng không hợp lệ', 'error');
        return;
    }
    
    const submitBtn = document.querySelector('#addCTVModal button[type="submit"]');
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/ctv/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ Đã thêm CTV thành công! Mã CTV: ${result.referralCode}`, 'success');
            closeAddCTVModal();
            loadCTVData(); // Reload danh sách
        } else {
            throw new Error(result.error || 'Failed to add CTV');
        }
    } catch (error) {
        console.error('Error adding CTV:', error);
        showToast('❌ Không thể thêm CTV: ' + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}


// ============================================
// CUSTOM DROPDOWN FILTERS
// ============================================

// Toggle CTV status filter dropdown
function toggleCTVStatusFilter(event) {
    event.stopPropagation();

    // Close if already open
    const existingMenu = document.getElementById('statusFilterMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'all', label: 'Tất cả trạng thái', dotClass: 'bg-slate-400' },
        { value: 'active', label: 'Đang hoạt động', dotClass: 'bg-emerald-500' },
        { value: 'new', label: 'Mới', dotClass: 'bg-sky-500' },
        { value: 'inactive', label: 'Không hoạt động', dotClass: 'bg-red-500' }
    ];

    const currentValue = document.getElementById('statusFilter').value;
    const button = event.currentTarget;
    // Append menu beside the button (inside .relative wrapper), not inside <button> — browsers clip overflow on buttons.
    const container = button.parentElement;

    const menu = document.createElement('div');
    menu.id = 'statusFilterMenu';
    menu.className = 'absolute left-0 top-full bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-200 py-1 z-[200] min-w-[240px] mt-1.5 overflow-hidden';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = statuses.map(s => `
        <button 
            type="button"
            onclick="selectCTVStatusFilter('${s.value}', '${s.label.replace(/'/g, "\\'")}')"
            class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left text-sm ${s.value === currentValue ? 'bg-indigo-50/80' : ''}"
        >
            <div class="w-2.5 h-2.5 rounded-full ${s.dotClass} flex-shrink-0 ring-2 ring-white shadow-sm"></div>
            <span class="text-slate-700 flex-1 font-medium">${s.label}</span>
            ${s.value === currentValue ? `
                <svg class="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    container.appendChild(menu);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!container.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Select CTV status filter
function selectCTVStatusFilter(value, label) {
    document.getElementById('statusFilter').value = value;
    
    // Update desktop label
    const desktopLabel = document.getElementById('statusFilterLabel');
    if (desktopLabel) desktopLabel.textContent = label;
    
    // Update mobile label
    const mobileLabel = document.getElementById('statusFilterLabelMobile');
    if (mobileLabel) mobileLabel.textContent = label;
    
    document.getElementById('statusFilterMenu')?.remove();
    filterCTVData();
}

// ============================================
// CHARTS
// ============================================

// Initialize charts
function initCharts() {
    initTopCTVChart();
    initRegistrationTrendChart();
}

// Initialize Top CTV Chart
function initTopCTVChart() {
    const ctx = document.getElementById('topCTVChart');
    if (!ctx) {
        console.warn('⚠️ Top CTV Chart canvas not found');
        return;
    }

    try {
        topCTVChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Doanh thu',
                    data: [],
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 0,
                        right: 10,
                        top: 5,
                        bottom: 5
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const value = context.parsed.x;
                                if (topCTVMode === 'revenue') {
                                    return 'Doanh thu: ' + formatCurrency(value);
                                } else {
                                    return 'Đơn hàng: ' + value.toLocaleString('vi-VN');
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            font: { size: 11 },
                            padding: 8,
                            callback: function(value) {
                                if (topCTVMode === 'revenue') {
                                    // Format currency for axis
                                    if (value >= 1000000) {
                                        return (value / 1000000).toFixed(1) + 'M';
                                    } else if (value >= 1000) {
                                        return (value / 1000).toFixed(0) + 'K';
                                    }
                                    return value;
                                }
                                // For orders, just show the number
                                return value;
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            font: { size: 11, weight: '500' },
                            color: '#374151',
                            padding: 10
                        }
                    }
                }
            }
        });
        console.log('✅ Top CTV Chart initialized');
    } catch (error) {
        console.error('❌ Error initializing Top CTV Chart:', error);
    }
}

// Initialize Registration Trend Chart
function initRegistrationTrendChart() {
    const ctx = document.getElementById('registrationTrendChart');
    if (!ctx) {
        console.warn('⚠️ Registration Trend Chart canvas not found');
        return;
    }

    try {
        registrationTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CTV mới',
                    data: [],
                    borderColor: 'rgba(139, 92, 246, 1)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                const count = context.parsed.y;
                                return 'Số CTV: ' + count + (count === 1 ? ' người' : ' người');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: { size: 11 },
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: { size: 11 },
                            stepSize: 1,
                            callback: function(value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        }
                    }
                }
            }
        });
        console.log('✅ Registration Trend Chart initialized');
    } catch (error) {
        console.error('❌ Error initializing Registration Trend Chart:', error);
    }
}

// Update Top CTV Chart
function updateTopCTVChart() {
    if (!topCTVChart) return;

    // Get data based on current filter (sync with table)
    const dataToUse = filteredCTVData.length > 0 ? filteredCTVData : allCTVData;
    
    // Early return if no data
    if (dataToUse.length === 0) {
        topCTVChart.data.labels = [];
        topCTVChart.data.datasets[0].data = [];
        topCTVChart.update('none');
        return;
    }
    
    // Sort and get top 10 (optimize: only sort what we need)
    const sortKey = topCTVMode === 'revenue' ? 'totalCommission' : 'orderCount';
    const top10 = dataToUse
        .map(ctv => ({ ...ctv, sortValue: ctv[sortKey] || 0 }))
        .sort((a, b) => b.sortValue - a.sortValue)
        .slice(0, 10);
    
    // Prepare chart data
    const labels = top10.map(ctv => {
        const name = ctv.fullName || 'N/A';
        return name.length > 15 ? name.substring(0, 15) + '...' : name;
    });
    
    const values = top10.map(ctv => ctv.sortValue);
    
    // Update chart configuration
    const isRevenue = topCTVMode === 'revenue';
    topCTVChart.data.labels = labels;
    topCTVChart.data.datasets[0].data = values;
    topCTVChart.data.datasets[0].label = isRevenue ? 'Doanh thu' : 'Đơn hàng';
    topCTVChart.data.datasets[0].backgroundColor = isRevenue ? 'rgba(99, 102, 241, 0.8)' : 'rgba(16, 185, 129, 0.8)';
    topCTVChart.data.datasets[0].borderColor = isRevenue ? 'rgba(99, 102, 241, 1)' : 'rgba(16, 185, 129, 1)';
    
    // Update without animation for smooth performance
    topCTVChart.update('none');
}

// Switch Top CTV mode
window.switchTopCTVMode = function(mode) {
    topCTVMode = mode;
    
    // Update button states
    const revenueBtn = document.getElementById('topCTVRevenueBtn');
    const ordersBtn = document.getElementById('topCTVOrdersBtn');
    
    const activeRev = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 transition-colors';
    const inactive = 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 bg-slate-100/80 hover:bg-slate-200/80 transition-colors';
    const activeOrd = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 transition-colors';
    if (mode === 'revenue') {
        revenueBtn.className = activeRev;
        ordersBtn.className = inactive;
    } else {
        revenueBtn.className = inactive;
        ordersBtn.className = activeOrd;
    }
    
    updateTopCTVChart();
};

// Update Registration Trend Chart
window.updateRegistrationTrend = function() {
    if (!registrationTrendChart) return;

    const periodSelect = document.getElementById('trendPeriodSelect');
    if (!periodSelect) return;
    
    const period = periodSelect.value;
    const dataToUse = allCTVData; // Always use all data for trend
    
    // Calculate date range in VN timezone
    let daysBack = 30;
    if (period === '7days') daysBack = 7;
    else if (period === '90days') daysBack = 90;
    
    // Group registrations by date (VN timezone)
    // Key format: YYYY-MM-DD for consistent sorting and lookup
    const registrationsByDate = {};
    
    dataToUse.forEach(ctv => {
        if (!ctv.timestamp) return;
        
        // Convert UTC timestamp to VN date
        const ctvDate = new Date(ctv.timestamp);
        const vnDateStr = ctvDate.toLocaleDateString('en-CA', { 
            timeZone: 'Asia/Ho_Chi_Minh' 
        }); // Returns YYYY-MM-DD
        
        if (!registrationsByDate[vnDateStr]) {
            registrationsByDate[vnDateStr] = 0;
        }
        registrationsByDate[vnDateStr]++;
    });
    
    // Create labels and data arrays for the last N days
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Get VN date string for lookup (YYYY-MM-DD)
        const vnDateStr = date.toLocaleDateString('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        
        // Format label for display (d/M)
        const vnDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const displayLabel = `${vnDate.getDate()}/${vnDate.getMonth() + 1}`;
        
        labels.push(displayLabel);
        data.push(registrationsByDate[vnDateStr] || 0);
    }
    
    // Update chart with smooth animation disabled for performance
    registrationTrendChart.data.labels = labels;
    registrationTrendChart.data.datasets[0].data = data;
    registrationTrendChart.update('none');
};

// Update charts when data changes
function updateCharts() {
    // Only update if charts are initialized
    if (topCTVChart) {
        updateTopCTVChart();
    }
    if (registrationTrendChart) {
        updateRegistrationTrend();
    }
}
