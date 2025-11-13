// Admin Dashboard JavaScript
let allCTVData = [];
let filteredCTVData = [];
let currentPage = 1;
const itemsPerPage = 10;
let sortOrder = 'desc'; // 'desc' = mới nhất trước, 'asc' = cũ nhất trước, 'none' = không sắp xếp
let commissionSortOrder = 'none'; // 'desc' = cao nhất trước, 'asc' = thấp nhất trước, 'none' = không sắp xếp

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

    // Update main stats - Remove skeleton and add text
    updateStatElement('totalCTV', totalCTV, 'text-3xl font-bold text-gray-900');
    updateStatElement('activeCTV', activeCTV, 'text-3xl font-bold text-green-600');
    updateStatElement('newCTV', newCTV, 'text-3xl font-bold text-purple-600');
    updateStatElement('totalCommission', formatCurrency(totalCommission), 'text-3xl font-bold text-orange-600');

    // Update header stats
    const totalCTVHeader = document.getElementById('totalCTVHeader');
    const activeCTVHeader = document.getElementById('activeCTVHeader');
    
    // Remove skeleton and add text
    totalCTVHeader.classList.remove('skeleton', 'h-8', 'w-12', 'rounded', 'mx-auto', 'mb-1');
    totalCTVHeader.className = 'text-2xl font-bold text-admin-primary';
    totalCTVHeader.textContent = totalCTV;
    
    activeCTVHeader.classList.remove('skeleton', 'h-8', 'w-12', 'rounded', 'mx-auto', 'mb-1');
    activeCTVHeader.className = 'text-2xl font-bold text-admin-success';
    activeCTVHeader.textContent = activeCTV;
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

    // STT
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
    tdIndex.textContent = index;

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

    // Hoa hồng hôm nay
    const tdTodayCommission = document.createElement('td');
    tdTodayCommission.className = 'px-6 py-4 whitespace-nowrap';
    const todayCommission = ctv.todayCommission || 0;
    const hasCommissionToday = todayCommission > 0;
    tdTodayCommission.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-sm font-bold ${hasCommissionToday ? 'text-orange-600' : 'text-gray-400'}">
                ${formatCurrency(todayCommission)}
            </span>
            ${hasCommissionToday ? '<span class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>' : ''}
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
    tr.appendChild(tdTodayCommission);
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
                    
                    <!-- Kinh nghiệm -->
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Kinh nghiệm</label>
                        <select name="experience" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent">
                            <option value="">Chọn kinh nghiệm</option>
                            <option value="Mới bắt đầu" ${ctv.experience === 'Mới bắt đầu' ? 'selected' : ''}>Mới bắt đầu</option>
                            <option value="Dưới 1 năm" ${ctv.experience === 'Dưới 1 năm' ? 'selected' : ''}>Dưới 1 năm</option>
                            <option value="1-2 năm" ${ctv.experience === '1-2 năm' ? 'selected' : ''}>1-2 năm</option>
                            <option value="Trên 2 năm" ${ctv.experience === 'Trên 2 năm' ? 'selected' : ''}>Trên 2 năm</option>
                        </select>
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
    
    // Handle form submit
    document.getElementById('editCTVForm').addEventListener('submit', handleEditCTVSubmit);
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
        experience: formData.get('experience'),
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
    // Reset date sort
    sortOrder = 'none';
    updateSortIcon();
    
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

// Apply sorting
function applySorting() {
    // Ưu tiên sắp xếp theo commission nếu đang active
    if (commissionSortOrder !== 'none') {
        filteredCTVData.sort((a, b) => {
            const commA = a.todayCommission || 0;
            const commB = b.todayCommission || 0;
            
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
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
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

function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 fade-in ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
    }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}
