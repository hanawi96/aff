// Admin Dashboard JavaScript
let allCTVData = [];
let filteredCTVData = [];
let currentPage = 1;
const itemsPerPage = 10;
let sortOrder = 'desc'; // 'desc' = mới nhất trước, 'asc' = cũ nhất trước, 'none' = không sắp xếp
let commissionSortOrder = 'none'; // 'desc' = cao nhất trước, 'asc' = thấp nhất trước, 'none' = không sắp xếp
let rateSortOrder = 'none'; // 'desc' = cao nhất trước, 'asc' = thấp nhất trước, 'none' = không sắp xếp

// Bulk selection state
let selectedCTVIds = new Set();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Dashboard initialized');
    loadCTVData();
    setupEventListeners();
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
        console.log('📊 Received data:', data);

        if (data.success) {
            allCTVData = data.ctvList || [];
            filteredCTVData = [...allCTVData];
            
            // Apply default sorting (newest first)
            applySorting();
            updateSortIcon();
            updateCommissionSortIcon();
            updateRateSortIcon();
            
            updateStats(data.stats || {});
            renderCTVTable();
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

// Update statistics
function updateStats(stats) {
    const totalCTV = stats.totalCTV || allCTVData.length;
    const activeCTV = stats.activeCTV || allCTVData.filter(ctv => ctv.hasOrders).length;
    const newCTV = stats.newCTV || 0;
    const totalCommission = stats.totalCommission || 0;
    
    // Calculate total orders from all CTVs
    const totalOrders = allCTVData.reduce((sum, ctv) => sum + (ctv.orderCount || 0), 0);

    // Update main stats - Remove skeleton and add text
    updateStatElement('totalCTV', totalCTV, 'text-3xl font-bold text-gray-900');
    updateStatElement('activeCTV', activeCTV, 'text-3xl font-bold text-green-600');
    updateStatElement('newCTV', newCTV, 'text-3xl font-bold text-purple-600');
    updateStatElement('totalCommission', formatCurrency(totalCommission), 'text-3xl font-bold text-orange-600');
    updateStatElement('totalOrders', totalOrders, 'text-3xl font-bold text-indigo-600');

}

// Helper function to update stat element
function updateStatElement(elementId, value, className) {
    const element = document.getElementById(elementId);
    if (element) {
        // Remove skeleton classes
        element.classList.remove('skeleton', 'h-10', 'w-16', 'w-24', 'rounded');
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
    tr.className = 'hover:bg-gray-50 transition-colors fade-in';

    // STT with checkbox
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
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
    tdInfo.className = 'px-6 py-4 whitespace-nowrap';
    tdInfo.innerHTML = `
        <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10">
                <div class="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                    ${getInitials(ctv.fullName)}
                </div>
            </div>
            <div class="ml-4">
                <div class="text-sm font-medium text-gray-900">${escapeHtml(ctv.fullName)}</div>
                <div class="text-sm text-gray-500">${escapeHtml(ctv.city || 'Chưa cập nhật')}</div>
            </div>
        </div>
    `;

    // Liên hệ
    const tdContact = document.createElement('td');
    tdContact.className = 'px-6 py-4 whitespace-nowrap';
    tdContact.innerHTML = `
        <div class="text-sm text-gray-900">${escapeHtml(ctv.phone)}</div>
        <div class="text-sm text-gray-500">${escapeHtml(ctv.email || 'Chưa có email')}</div>
    `;

    // Mã CTV
    const tdCode = document.createElement('td');
    tdCode.className = 'px-6 py-4 whitespace-nowrap';
    tdCode.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 font-mono">
                ${escapeHtml(ctv.referralCode)}
            </span>
            <button onclick="copyToClipboard('${escapeHtml(ctv.referralCode)}')" class="text-gray-400 hover:text-gray-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>
        </div>
    `;

    // Tỷ lệ hoa hồng
    const tdCommissionRate = document.createElement('td');
    tdCommissionRate.className = 'px-6 py-4 whitespace-nowrap';
    const commissionRate = ctv.commissionRate || 0.1;
    const commissionPercent = (commissionRate * 100).toFixed(0);
    tdCommissionRate.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-green-600">${commissionPercent}%</span>
            <button onclick="editCommission('${escapeHtml(ctv.referralCode)}', ${commissionRate})" 
                class="text-gray-400 hover:text-blue-600 transition-colors" title="Chỉnh sửa">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
        </div>
    `;

    // Số đơn hàng
    const tdOrderCount = document.createElement('td');
    tdOrderCount.className = 'px-6 py-4 whitespace-nowrap text-center';
    const orderCount = ctv.orderCount || 0;
    const hasOrders = orderCount > 0;
    tdOrderCount.innerHTML = `
        <span class="inline-flex items-center justify-center px-3 py-1 text-sm font-bold rounded-full ${hasOrders ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'}">
            ${orderCount}
        </span>
    `;

    // Tổng hoa hồng
    const tdTotalCommission = document.createElement('td');
    tdTotalCommission.className = 'px-6 py-4 whitespace-nowrap';
    const totalCommission = ctv.totalCommission || 0;
    const hasCommission = totalCommission > 0;
    tdTotalCommission.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-sm font-bold ${hasCommission ? 'text-orange-600' : 'text-gray-400'}">
                ${formatCurrency(totalCommission)}
            </span>
        </div>
    `;

    // Trạng thái
    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-6 py-4 whitespace-nowrap';
    const statusInfo = getStatusInfo(ctv);
    tdStatus.innerHTML = `
        <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.class}">
            ${statusInfo.text}
        </span>
    `;

    // Ngày đăng ký
    const tdDate = document.createElement('td');
    tdDate.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
    tdDate.textContent = formatDate(ctv.timestamp);

    // Thao tác
    const tdActions = document.createElement('td');
    tdActions.className = 'px-6 py-4 whitespace-nowrap text-center text-sm font-medium';
    tdActions.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <button onclick="viewCTVDetail('${escapeHtml(ctv.referralCode)}')" 
                class="text-admin-primary hover:text-admin-secondary transition-colors" title="Xem chi tiết">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            </button>
            <button onclick="editCTV('${escapeHtml(ctv.referralCode)}')" 
                class="text-orange-600 hover:text-orange-700 transition-colors" title="Chỉnh sửa">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
            <button onclick="sendMessage('${escapeHtml(ctv.phone)}')" 
                class="text-green-600 hover:text-green-700 transition-colors" title="Nhắn tin">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
            class: 'bg-green-100 text-green-800'
        };
    }
    
    if (status === 'Mới') {
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

        return matchesSearch && matchesStatus;
    });

    // Apply sorting
    applySorting();

    currentPage = 1; // Reset to first page when filtering
    renderCTVTable();
}

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

    let html = '<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200">';
    
    // Info text
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredCTVData.length);
    html += `<div class="text-sm text-gray-700">
        Hiển thị <span class="font-medium">${startItem}</span> đến <span class="font-medium">${endItem}</span> trong tổng số <span class="font-medium">${filteredCTVData.length}</span> CTV
    </div>`;
    
    // Pagination buttons
    html += '<div class="flex items-center gap-2">';
    
    // Previous button
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
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
        html += `<button onclick="goToPage(1)" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">1</button>`;
        if (startPage > 2) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-2 rounded-lg bg-admin-primary text-white text-sm font-medium">${i}</button>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
        html += `<button onclick="goToPage(${totalPages})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
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
        { value: 'all', label: 'Tất cả trạng thái', color: 'gray' },
        { value: 'active', label: 'Đang hoạt động', color: 'green' },
        { value: 'new', label: 'Mới', color: 'blue' },
        { value: 'inactive', label: 'Không hoạt động', color: 'red' }
    ];

    const currentValue = document.getElementById('statusFilter').value;
    const button = event.currentTarget;

    const menu = document.createElement('div');
    menu.id = 'statusFilterMenu';
    menu.className = 'absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[220px] mt-1';
    menu.style.left = '0';
    menu.style.top = '100%';

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="selectCTVStatusFilter('${s.value}', '${s.label}')"
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

// Select CTV status filter
function selectCTVStatusFilter(value, label) {
    document.getElementById('statusFilter').value = value;
    document.getElementById('statusFilterLabel').textContent = label;
    document.getElementById('statusFilterMenu')?.remove();
    filterCTVData();
}
