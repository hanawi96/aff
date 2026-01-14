// ============================================
// CONFIGURATION
// ============================================
const API_URL = 'https://ctv-api.yendev96.workers.dev';

// State
let allDiscounts = [];
let filteredDiscounts = [];
let currentDiscount = null;
let allUsageHistory = [];
let filteredUsageHistory = [];
let currentTab = 'discounts';
let selectedDiscountIds = new Set(); // Track selected discounts for bulk actions
let currentPage = 1;
const itemsPerPage = 10;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadDiscounts();
    loadUsageHistory();
    setupEventListeners();
});

function setupEventListeners() {
    // Search - Discounts
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterDiscounts, 300));
    }

    // Filters - Discounts
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');
    if (filterType) filterType.addEventListener('change', filterDiscounts);
    if (filterStatus) filterStatus.addEventListener('change', filterDiscounts);

    // Search - Usage
    const searchUsage = document.getElementById('searchUsage');
    if (searchUsage) {
        searchUsage.addEventListener('input', debounce(filterUsageHistory, 300));
    }

    // Filters - Usage
    const filterUsageType = document.getElementById('filterUsageType');
    const filterUsageDate = document.getElementById('filterUsageDate');
    if (filterUsageType) filterUsageType.addEventListener('change', filterUsageHistory);
    if (filterUsageDate) filterUsageDate.addEventListener('change', filterUsageHistory);

    // Form submit
    const discountForm = document.getElementById('discountForm');
    if (discountForm) {
        discountForm.addEventListener('submit', handleFormSubmit);
    }
}

// ============================================
// API CALLS
// ============================================

async function loadDiscounts() {
    try {
        showLoading();
        
        const response = await fetch(`${API_URL}?action=getAllDiscounts`);
        const data = await response.json();
        
        if (data.success) {
            allDiscounts = data.discounts || [];
            filteredDiscounts = [...allDiscounts];
            
            // Clear selections that no longer exist
            const existingIds = new Set(allDiscounts.map(d => d.id));
            selectedDiscountIds.forEach(id => {
                if (!existingIds.has(id)) {
                    selectedDiscountIds.delete(id);
                }
            });
            
            updateStats();
            renderDiscounts();
            updateBulkActionsUI();
        } else {
            showError('Không thể tải danh sách mã giảm giá');
        }
    } catch (error) {
        console.error('Error loading discounts:', error);
        showError('Lỗi kết nối đến server');
    }
}

async function saveDiscount(discountData) {
    try {
        const isEdit = !!discountData.id;
        const action = isEdit ? 'updateDiscount' : 'createDiscount';
        
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discountData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(isEdit ? 'Cập nhật mã thành công!' : 'Tạo mã mới thành công!');
            closeDiscountModal();
            loadDiscounts();
        } else {
            showError(data.error || 'Không thể lưu mã giảm giá');
        }
    } catch (error) {
        console.error('Error saving discount:', error);
        showError('Lỗi khi lưu mã giảm giá');
    }
}

async function deleteDiscount(id, code) {
    if (!confirm(`Bạn có chắc muốn xóa mã "${code}"?`)) return;
    
    try {
        const response = await fetch(`${API_URL}?action=deleteDiscount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Xóa mã thành công!');
            loadDiscounts();
        } else {
            showError(data.error || 'Không thể xóa mã giảm giá');
        }
    } catch (error) {
        console.error('Error deleting discount:', error);
        showError('Lỗi khi xóa mã giảm giá');
    }
}

async function toggleDiscountStatus(id, currentStatus) {
    try {
        // Toggle: if currently 1 (active), set to 0 (inactive), and vice versa
        const newStatus = currentStatus === 1 ? 0 : 1;
        
        const response = await fetch(`${API_URL}?action=toggleDiscountStatus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Cập nhật trạng thái thành công!');
            loadDiscounts();
        } else {
            showError(data.error || 'Không thể cập nhật trạng thái');
        }
    } catch (error) {
        console.error('Error toggling status:', error);
        showError('Lỗi khi cập nhật trạng thái');
    }
}

// ============================================
// UI RENDERING
// ============================================

function renderDiscounts() {
    const tbody = document.getElementById('discountsTableBody');
    const loadingState = document.getElementById('loadingState');
    const discountsTable = document.getElementById('discountsTable');
    const emptyState = document.getElementById('emptyState');
    
    loadingState.classList.add('hidden');
    
    if (filteredDiscounts.length === 0) {
        discountsTable.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    discountsTable.classList.remove('hidden');
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredDiscounts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredDiscounts.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageData.map(discount => {
        const isExpired = new Date(discount.expiry_date) < new Date();
        const isActive = discount.active && !isExpired;
        const isChecked = selectedDiscountIds.has(discount.id);
        
        return `
            <tr class="hover:bg-gray-50 transition-colors fade-in">
                <td class="px-4 py-4 text-center">
                    <input type="checkbox" 
                           class="discount-checkbox w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                           data-discount-id="${discount.id}"
                           ${isChecked ? 'checked' : ''}
                           onchange="handleDiscountCheckbox(${discount.id}, this.checked)">
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <code class="px-2 py-1 bg-gray-100 text-gray-800 rounded font-mono text-sm font-bold">
                            ${discount.code}
                        </code>
                        ${discount.visible ? 
                            '<span class="text-xs text-green-600">👁️</span>' : 
                            '<span class="text-xs text-gray-400">🔒</span>'
                        }
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="max-w-xs">
                        <p class="font-medium text-gray-900">${discount.title}</p>
                        ${discount.description ? 
                            `<p class="text-xs text-gray-500 mt-1 truncate">${discount.description}</p>` : 
                            ''
                        }
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${getTypeBadge(discount.type)}
                </td>
                <td class="px-6 py-4">
                    ${getValueDisplay(discount)}
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-600">
                        ${discount.min_order_amount > 0 ? 
                            `<div>Đơn tối thiểu: <span class="font-semibold">${formatMoney(discount.min_order_amount)}</span></div>` : 
                            ''
                        }
                        ${discount.min_items > 0 ? 
                            `<div>Số SP: <span class="font-semibold">${discount.min_items}</span></div>` : 
                            ''
                        }
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">
                        <div class="font-semibold text-gray-900">${discount.usage_count || 0}</div>
                        ${discount.max_total_uses ? 
                            `<div class="text-xs text-gray-500">/ ${discount.max_total_uses}</div>` : 
                            '<div class="text-xs text-gray-500">Không giới hạn</div>'
                        }
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-600">
                        ${formatDate(discount.expiry_date)}
                        ${isExpired ? 
                            '<div class="text-xs text-red-600 font-semibold">Đã hết hạn</div>' : 
                            ''
                        }
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${getStatusBadge(isActive, isExpired)}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-3">
                        <button onclick="viewDiscountDetails(${discount.id})" 
                            class="text-blue-600 hover:text-blue-700 transition-colors" 
                            title="Xem chi tiết">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <button onclick="duplicateDiscount(${discount.id})" 
                            class="text-purple-600 hover:text-purple-700 transition-colors" 
                            title="Sao chép">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button onclick="editDiscount(${discount.id})" 
                            class="text-indigo-600 hover:text-indigo-700 transition-colors" 
                            title="Chỉnh sửa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="toggleDiscountStatus(${discount.id}, ${discount.active ? 1 : 0})" 
                            class="${isActive ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'} transition-colors" 
                            title="${isActive ? 'Tạm dừng' : 'Kích hoạt'}">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                ${isActive ? 
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />' :
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
                                }
                            </svg>
                        </button>
                        <button onclick="deleteDiscount(${discount.id}, '${discount.code}')" 
                            class="text-red-600 hover:text-red-700 transition-colors" 
                            title="Xóa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Render pagination
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = '<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">';
    
    // Info text
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredDiscounts.length);
    
    html += `<div class="text-sm text-gray-700">
        Hiển thị <span class="font-medium">${startItem}</span> đến <span class="font-medium">${endItem}</span> trong tổng số <span class="font-medium">${filteredDiscounts.length}</span> mã
    </div>`;
    
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
    
    // Adjust start if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page + ellipsis
    if (startPage > 1) {
        html += `<button onclick="goToPage(1)" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">1</button>`;
        if (startPage > 2) {
            html += `<span class="px-2 text-gray-500">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium">${i}</button>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${i}</button>`;
        }
    }
    
    // Ellipsis + last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="px-2 text-gray-500">...</span>`;
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

function goToPage(page) {
    const totalPages = Math.ceil(filteredDiscounts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderDiscounts();
    
    // Scroll to top of table
    document.getElementById('discountsTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateStats() {
    const now = new Date();
    const activeDiscounts = allDiscounts.filter(d => d.active && new Date(d.expiry_date) >= now);
    const totalUsage = allDiscounts.reduce((sum, d) => sum + (d.usage_count || 0), 0);
    const totalAmount = allDiscounts.reduce((sum, d) => sum + (d.total_discount_amount || 0), 0);
    
    document.getElementById('totalDiscounts').textContent = allDiscounts.length;
    document.getElementById('activeDiscounts').textContent = activeDiscounts.length;
    document.getElementById('totalUsage').textContent = totalUsage.toLocaleString('vi-VN');
    document.getElementById('totalDiscountAmount').textContent = formatMoney(totalAmount);
    document.getElementById('discountCount').textContent = allDiscounts.length;
}

function updateUsageStats() {
    const totalUsageCount = allUsageHistory.length;
    const totalSaved = allUsageHistory.reduce((sum, u) => sum + (u.discount_amount || 0), 0);
    const totalOrders = allUsageHistory.reduce((sum, u) => sum + (u.order_amount || 0), 0);
    const uniquePhones = new Set(allUsageHistory.map(u => u.customer_phone)).size;
    
    document.getElementById('totalUsageCount').textContent = totalUsageCount.toLocaleString('vi-VN');
    document.getElementById('totalSavedAmount').textContent = formatMoney(totalSaved);
    document.getElementById('totalOrderAmount').textContent = formatMoney(totalOrders);
    document.getElementById('uniqueCustomers').textContent = uniquePhones.toLocaleString('vi-VN');
    document.getElementById('usageCount').textContent = totalUsageCount;
}

// ============================================
// HELPER FUNCTIONS - DISPLAY
// ============================================

function getTypeBadge(type) {
    const badges = {
        'fixed': '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Giảm cố định</span>',
        'percentage': '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">Giảm %</span>',
        'gift': '<span class="px-2 py-1 bg-pink-100 text-pink-800 rounded-full text-xs font-semibold">Tặng quà</span>',
        'freeship': '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Freeship</span>'
    };
    return badges[type] || type;
}

function getValueDisplay(discount) {
    switch(discount.type) {
        case 'fixed':
            return `<span class="font-semibold text-blue-600">${formatMoney(discount.discount_value)}</span>`;
        case 'percentage':
            return `<span class="font-semibold text-purple-600">${discount.discount_value}%</span>
                    ${discount.max_discount_amount ? `<div class="text-xs text-gray-500">Tối đa: ${formatMoney(discount.max_discount_amount)}</div>` : ''}`;
        case 'gift':
            return `<div class="text-sm">
                        <div class="font-semibold text-pink-600">${discount.gift_product_name || 'Quà tặng'}</div>
                        ${discount.gift_product_id ? `<div class="text-xs text-gray-500">${discount.gift_product_id}</div>` : ''}
                    </div>`;
        case 'freeship':
            return '<span class="font-semibold text-green-600">Miễn phí ship</span>';
        default:
            return '-';
    }
}

function getStatusBadge(isActive, isExpired) {
    if (isExpired) {
        return '<span class="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">Hết hạn</span>';
    }
    if (isActive) {
        return '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Hoạt động</span>';
    }
    return '<span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Tạm dừng</span>';
}

function formatMoney(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND' 
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}


// ============================================
// MODAL MANAGEMENT
// ============================================

function showAddDiscountModal() {
    currentDiscount = null;
    document.getElementById('modalTitle').textContent = 'Tạo mã giảm giá mới';
    
    // Hide subtitle
    const subtitle = document.getElementById('modalSubtitle');
    if (subtitle) {
        subtitle.classList.add('hidden');
    }
    
    document.getElementById('discountForm').reset();
    document.getElementById('discountId').value = '';
    
    // Set default values
    document.getElementById('active').checked = true;
    document.getElementById('visible').checked = true;
    document.getElementById('maxUsesPerCustomer').value = 1;
    document.getElementById('minOrderAmount').value = 0;
    document.getElementById('minItems').value = 0;
    
    // Set default expiry date (1 year from now)
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById('expiryDate').value = nextYear.toISOString().split('T')[0];
    
    handleTypeChange();
    document.getElementById('discountModal').classList.remove('hidden');
}

function editDiscount(id) {
    const discount = allDiscounts.find(d => d.id === id);
    if (!discount) return;
    
    currentDiscount = discount;
    document.getElementById('modalTitle').textContent = 'Chỉnh sửa mã giảm giá';
    
    // Hide subtitle
    const subtitle = document.getElementById('modalSubtitle');
    if (subtitle) {
        subtitle.classList.add('hidden');
    }
    
    // Fill form
    document.getElementById('discountId').value = discount.id;
    document.getElementById('code').value = discount.code;
    document.getElementById('type').value = discount.type;
    document.getElementById('title').value = discount.title;
    document.getElementById('description').value = discount.description || '';
    document.getElementById('discountValue').value = discount.discount_value || 0;
    document.getElementById('maxDiscountAmount').value = discount.max_discount_amount || '';
    document.getElementById('giftProductId').value = discount.gift_product_id || '';
    document.getElementById('giftProductName').value = discount.gift_product_name || '';
    document.getElementById('minOrderAmount').value = discount.min_order_amount || 0;
    document.getElementById('minItems').value = discount.min_items || 0;
    document.getElementById('maxTotalUses').value = discount.max_total_uses || '';
    document.getElementById('maxUsesPerCustomer').value = discount.max_uses_per_customer || 1;
    
    // Dates
    if (discount.start_date) {
        document.getElementById('startDate').value = discount.start_date.split('T')[0];
    }
    if (discount.expiry_date) {
        document.getElementById('expiryDate').value = discount.expiry_date.split('T')[0];
    }
    
    // Status
    document.getElementById('active').checked = discount.active;
    document.getElementById('visible').checked = discount.visible;
    
    handleTypeChange();
    document.getElementById('discountModal').classList.remove('hidden');
}

function duplicateDiscount(id) {
    const discount = allDiscounts.find(d => d.id === id);
    if (!discount) return;
    
    currentDiscount = null; // Important: null means creating new
    document.getElementById('modalTitle').textContent = '📋 Sao chép mã giảm giá';
    
    // Show subtitle with original code
    const subtitle = document.getElementById('modalSubtitle');
    if (subtitle) {
        subtitle.textContent = `Sao chép từ: ${discount.code}`;
        subtitle.classList.remove('hidden');
    }
    
    // Generate new code
    let newCode = generateUniqueCode(discount.code);
    
    // Fill form with duplicated data
    document.getElementById('discountId').value = ''; // Empty = new discount
    document.getElementById('code').value = newCode;
    document.getElementById('type').value = discount.type;
    document.getElementById('title').value = `${discount.title} (Copy)`;
    document.getElementById('description').value = discount.description || '';
    document.getElementById('discountValue').value = discount.discount_value || 0;
    document.getElementById('maxDiscountAmount').value = discount.max_discount_amount || '';
    document.getElementById('giftProductId').value = discount.gift_product_id || '';
    document.getElementById('giftProductName').value = discount.gift_product_name || '';
    document.getElementById('minOrderAmount').value = discount.min_order_amount || 0;
    document.getElementById('minItems').value = discount.min_items || 0;
    document.getElementById('maxTotalUses').value = discount.max_total_uses || '';
    document.getElementById('maxUsesPerCustomer').value = discount.max_uses_per_customer || 1;
    
    // Smart date handling: Set new expiry date to 30 days from now
    const today = new Date();
    const newExpiryDate = new Date(today);
    newExpiryDate.setDate(newExpiryDate.getDate() + 30);
    
    document.getElementById('startDate').value = today.toISOString().split('T')[0];
    document.getElementById('expiryDate').value = newExpiryDate.toISOString().split('T')[0];
    
    // Status - Keep active and visible
    document.getElementById('active').checked = true;
    document.getElementById('visible').checked = discount.visible;
    
    handleTypeChange();
    document.getElementById('discountModal').classList.remove('hidden');
    
    // Highlight auto-adjusted fields
    setTimeout(() => {
        highlightField('code');
        highlightField('title');
        highlightField('startDate');
        highlightField('expiryDate');
    }, 100);
    
    // Show helpful toast
    showToast('Đã sao chép mã. Các trường được tô sáng đã được tự động điều chỉnh', 'info', 5000);
}

// Highlight a field temporarily
function highlightField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Add highlight class
    field.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50');
    
    // Remove after 3 seconds
    setTimeout(() => {
        field.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50');
    }, 3000);
}

// Generate unique code for duplicated discount
function generateUniqueCode(originalCode) {
    // Remove existing suffixes like _COPY, _2, _COPY2, etc.
    let baseCode = originalCode.replace(/_COPY\d*$|_\d+$/, '');
    
    // Try _COPY first
    let newCode = `${baseCode}_COPY`;
    if (!allDiscounts.some(d => d.code === newCode)) {
        return newCode;
    }
    
    // Try _COPY2, _COPY3, etc.
    let counter = 2;
    while (counter < 100) { // Safety limit
        newCode = `${baseCode}_COPY${counter}`;
        if (!allDiscounts.some(d => d.code === newCode)) {
            return newCode;
        }
        counter++;
    }
    
    // Fallback: Use timestamp
    return `${baseCode}_${Date.now().toString().slice(-6)}`;
}

function closeDiscountModal() {
    document.getElementById('discountModal').classList.add('hidden');
    currentDiscount = null;
}

function handleTypeChange() {
    const type = document.getElementById('type').value;
    const discountValueField = document.getElementById('discountValueField');
    const maxDiscountField = document.getElementById('maxDiscountField');
    const giftSection = document.getElementById('giftSection');
    const discountValueInput = document.getElementById('discountValue');
    
    // Always show discount value field (it's in the 3-column row)
    // Just update placeholder and required state
    maxDiscountField.classList.add('hidden');
    giftSection.classList.add('hidden');
    
    // Show relevant fields based on type
    switch(type) {
        case 'fixed':
            discountValueInput.placeholder = 'VD: 50000';
            discountValueInput.required = true;
            discountValueField.classList.remove('hidden');
            break;
        case 'percentage':
            discountValueInput.placeholder = 'VD: 10 (cho 10%)';
            discountValueInput.required = true;
            discountValueField.classList.remove('hidden');
            maxDiscountField.classList.remove('hidden');
            break;
        case 'gift':
            discountValueInput.required = false;
            discountValueField.classList.add('hidden');
            giftSection.classList.remove('hidden');
            break;
        case 'freeship':
            discountValueInput.required = false;
            discountValueField.classList.add('hidden');
            break;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        id: document.getElementById('discountId').value || null,
        code: document.getElementById('code').value.toUpperCase().trim(),
        type: document.getElementById('type').value,
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        discount_value: parseInt(document.getElementById('discountValue').value) || 0,
        max_discount_amount: parseInt(document.getElementById('maxDiscountAmount').value) || null,
        gift_product_id: document.getElementById('giftProductId').value.trim() || null,
        gift_product_name: document.getElementById('giftProductName').value.trim() || null,
        gift_quantity: 1,
        min_order_amount: parseInt(document.getElementById('minOrderAmount').value) || 0,
        min_items: parseInt(document.getElementById('minItems').value) || 0,
        max_total_uses: parseInt(document.getElementById('maxTotalUses').value) || null,
        max_uses_per_customer: parseInt(document.getElementById('maxUsesPerCustomer').value) || 1,
        start_date: document.getElementById('startDate').value || null,
        expiry_date: document.getElementById('expiryDate').value,
        active: document.getElementById('active').checked ? 1 : 0,
        visible: document.getElementById('visible').checked ? 1 : 0,
        customer_type: 'all',
        combinable_with_other_discounts: 0
    };
    
    // Validation
    if (!formData.code || formData.code.length < 3) {
        showError('Mã giảm giá phải có ít nhất 3 ký tự');
        return;
    }
    
    if (!formData.expiry_date) {
        showError('Vui lòng chọn ngày hết hạn');
        return;
    }
    
    // Type-specific validation
    if (formData.type === 'fixed' && formData.discount_value <= 0) {
        showError('Giá trị giảm phải lớn hơn 0');
        return;
    }
    
    if (formData.type === 'percentage') {
        if (formData.discount_value <= 0 || formData.discount_value > 100) {
            showError('Phần trăm giảm phải từ 1-100');
            return;
        }
    }
    
    if (formData.type === 'gift' && !formData.gift_product_name) {
        showError('Vui lòng nhập tên sản phẩm quà tặng');
        return;
    }
    
    await saveDiscount(formData);
}

// ============================================
// FILTER & SEARCH
// ============================================

function filterDiscounts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('filterType').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const now = new Date();
    
    filteredDiscounts = allDiscounts.filter(discount => {
        // Search filter
        const matchesSearch = !searchTerm || 
            discount.code.toLowerCase().includes(searchTerm) ||
            discount.title.toLowerCase().includes(searchTerm) ||
            (discount.description && discount.description.toLowerCase().includes(searchTerm));
        
        // Type filter
        const matchesType = !typeFilter || discount.type === typeFilter;
        
        // Status filter
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = discount.active && new Date(discount.expiry_date) >= now;
        } else if (statusFilter === 'inactive') {
            matchesStatus = !discount.active;
        } else if (statusFilter === 'expired') {
            matchesStatus = new Date(discount.expiry_date) < now;
        }
        
        return matchesSearch && matchesType && matchesStatus;
    });
    
    currentPage = 1; // Reset to first page when filtering
    renderDiscounts();
    
    // Update select all checkbox state
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
        const visibleCheckboxes = document.querySelectorAll('.discount-checkbox');
        const allChecked = visibleCheckboxes.length > 0 && 
                          Array.from(visibleCheckboxes).every(cb => cb.checked);
        selectAllCb.checked = allChecked;
    }
}

// ============================================
// VIEW DETAILS
// ============================================

function viewDiscountDetails(id) {
    const discount = allDiscounts.find(d => d.id === id);
    if (!discount) return;
    
    const isExpired = new Date(discount.expiry_date) < new Date();
    const isActive = discount.active && !isExpired;
    
    const detailsHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="sticky top-0 bg-gradient-to-r from-admin-primary to-admin-secondary text-white px-6 py-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold">Chi tiết mã giảm giá</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-gray-200">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div class="p-6 space-y-6">
                    <!-- Status Banner -->
                    <div class="p-4 rounded-lg ${isActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                ${isActive ? 
                                    '<svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' :
                                    '<svg class="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
                                }
                                <div>
                                    <div class="font-bold ${isActive ? 'text-green-900' : 'text-gray-900'}">${isActive ? 'Đang hoạt động' : isExpired ? 'Đã hết hạn' : 'Tạm dừng'}</div>
                                    <div class="text-sm ${isActive ? 'text-green-700' : 'text-gray-600'}">
                                        ${discount.visible ? 'Hiển thị công khai' : 'Ẩn khỏi danh sách'}
                                    </div>
                                </div>
                            </div>
                            <code class="px-4 py-2 bg-white border-2 ${isActive ? 'border-green-300' : 'border-gray-300'} rounded-lg font-mono text-lg font-bold">
                                ${discount.code}
                            </code>
                        </div>
                    </div>
                    
                    <!-- Basic Info -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Thông tin cơ bản</h4>
                        <div class="space-y-3">
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Tiêu đề:</span>
                                <span class="font-semibold text-gray-900">${discount.title}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Loại:</span>
                                ${getTypeBadge(discount.type)}
                            </div>
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Giá trị:</span>
                                ${getValueDisplay(discount)}
                            </div>
                            ${discount.description ? `
                                <div class="py-2">
                                    <span class="text-gray-600 block mb-1">Mô tả:</span>
                                    <p class="text-gray-900">${discount.description}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Conditions -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Điều kiện áp dụng</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-3 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-600">Đơn tối thiểu</div>
                                <div class="text-lg font-bold text-gray-900">${formatMoney(discount.min_order_amount)}</div>
                            </div>
                            <div class="p-3 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-600">Số SP tối thiểu</div>
                                <div class="text-lg font-bold text-gray-900">${discount.min_items || 0}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Usage Stats -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Thống kê sử dụng</h4>
                        <div class="grid grid-cols-3 gap-4">
                            <div class="p-3 bg-blue-50 rounded-lg">
                                <div class="text-sm text-blue-600">Đã dùng</div>
                                <div class="text-2xl font-bold text-blue-900">${discount.usage_count || 0}</div>
                            </div>
                            <div class="p-3 bg-purple-50 rounded-lg">
                                <div class="text-sm text-purple-600">Giới hạn</div>
                                <div class="text-2xl font-bold text-purple-900">${discount.max_total_uses || '∞'}</div>
                            </div>
                            <div class="p-3 bg-orange-50 rounded-lg">
                                <div class="text-sm text-orange-600">Tổng giảm</div>
                                <div class="text-lg font-bold text-orange-900">${formatMoney(discount.total_discount_amount || 0)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dates -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Thời gian</h4>
                        <div class="space-y-2">
                            ${discount.start_date ? `
                                <div class="flex justify-between py-2 border-b border-gray-100">
                                    <span class="text-gray-600">Bắt đầu:</span>
                                    <span class="font-semibold text-gray-900">${formatDate(discount.start_date)}</span>
                                </div>
                            ` : ''}
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Hết hạn:</span>
                                <span class="font-semibold ${isExpired ? 'text-red-600' : 'text-gray-900'}">${formatDate(discount.expiry_date)}</span>
                            </div>
                            <div class="flex justify-between py-2">
                                <span class="text-gray-600">Tạo lúc:</span>
                                <span class="text-gray-900">${formatDate(discount.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex gap-3 pt-4 border-t border-gray-200">
                        <button onclick="editDiscount(${discount.id}); this.closest('.fixed').remove();" 
                            class="flex-1 px-4 py-2.5 bg-admin-primary text-white rounded-lg hover:bg-admin-secondary transition-colors font-medium">
                            Chỉnh sửa
                        </button>
                        <button onclick="this.closest('.fixed').remove()" 
                            class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', detailsHTML);
}

// ============================================
// BULK ACTIONS - SELECTION MANAGEMENT
// ============================================

// Handle individual discount checkbox
function handleDiscountCheckbox(discountId, isChecked) {
    if (isChecked) {
        selectedDiscountIds.add(discountId);
    } else {
        selectedDiscountIds.delete(discountId);
    }
    updateBulkActionsUI();
}

// Select/deselect all discounts on current page
function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.discount-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        const discountId = parseInt(cb.dataset.discountId);
        if (checked) {
            selectedDiscountIds.add(discountId);
        } else {
            selectedDiscountIds.delete(discountId);
        }
    });
    updateBulkActionsUI();
}

// Update bulk actions UI based on selection
function updateBulkActionsUI() {
    const count = selectedDiscountIds.size;
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');

    if (count > 0) {
        if (selectedCount) selectedCount.textContent = count;
        if (bulkActionsBar) {
            // Show with smooth animation
            bulkActionsBar.classList.remove('hidden');
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';

            requestAnimationFrame(() => {
                bulkActionsBar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                bulkActionsBar.style.opacity = '1';
                bulkActionsBar.style.transform = 'translateX(-50%) translateY(0)';
            });
        }
    } else {
        if (bulkActionsBar) {
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => {
                bulkActionsBar.classList.add('hidden');
            }, 300);
        }
    }
}

// Clear all selections
function clearSelection() {
    selectedDiscountIds.clear();
    document.querySelectorAll('.discount-checkbox').forEach(cb => cb.checked = false);
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) selectAllCb.checked = false;
    updateBulkActionsUI();
}

// ============================================
// BULK ACTIONS - OPERATIONS
// ============================================

// Bulk Activate - Activate selected discounts
async function bulkActivate() {
    if (selectedDiscountIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 mã', 'warning');
        return;
    }
    
    const count = selectedDiscountIds.size;
    if (!confirm(`Bạn có chắc muốn kích hoạt ${count} mã đã chọn?`)) return;
    
    try {
        // Show loading toast with ID
        showToast(`Đang kích hoạt ${count} mã...`, 'info', 0, 'bulk-activate');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const id of selectedDiscountIds) {
            try {
                const response = await fetch(`${API_URL}?action=toggleDiscountStatus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, active: 1 })
                });
                
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        // Reload data
        await loadDiscounts();
        clearSelection();
        
        // Update toast with result (same ID will replace the loading toast)
        if (errorCount === 0) {
            showToast(`Đã kích hoạt thành công ${successCount} mã`, 'success', null, 'bulk-activate');
        } else {
            showToast(`Đã kích hoạt ${successCount} mã, thất bại ${errorCount} mã`, 'warning', null, 'bulk-activate');
        }
    } catch (error) {
        console.error('Error bulk activating:', error);
        showToast('Lỗi khi kích hoạt hàng loạt: ' + error.message, 'error', null, 'bulk-activate');
    }
}

// Bulk Deactivate - Deactivate selected discounts
async function bulkDeactivate() {
    if (selectedDiscountIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 mã', 'warning');
        return;
    }
    
    const count = selectedDiscountIds.size;
    if (!confirm(`Bạn có chắc muốn tạm dừng ${count} mã đã chọn?`)) return;
    
    try {
        // Show loading toast with ID
        showToast(`Đang tạm dừng ${count} mã...`, 'info', 0, 'bulk-deactivate');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const id of selectedDiscountIds) {
            try {
                const response = await fetch(`${API_URL}?action=toggleDiscountStatus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, active: 0 })
                });
                
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        // Reload data
        await loadDiscounts();
        clearSelection();
        
        // Update toast with result (same ID will replace the loading toast)
        if (errorCount === 0) {
            showToast(`Đã tạm dừng thành công ${successCount} mã`, 'success', null, 'bulk-deactivate');
        } else {
            showToast(`Đã tạm dừng ${successCount} mã, thất bại ${errorCount} mã`, 'warning', null, 'bulk-deactivate');
        }
    } catch (error) {
        console.error('Error bulk deactivating:', error);
        showToast('Lỗi khi tạm dừng hàng loạt: ' + error.message, 'error', null, 'bulk-deactivate');
    }
}

// Bulk Delete - Delete selected discounts
async function bulkDelete() {
    if (selectedDiscountIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 mã', 'warning');
        return;
    }
    
    const count = selectedDiscountIds.size;
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc muốn xóa ${count} mã đã chọn?\n\nHành động này không thể hoàn tác!`)) return;
    
    try {
        // Show loading toast with ID
        showToast(`Đang xóa ${count} mã...`, 'info', 0, 'bulk-delete');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const id of selectedDiscountIds) {
            try {
                const response = await fetch(`${API_URL}?action=deleteDiscount`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        // Reload data
        await loadDiscounts();
        clearSelection();
        
        // Update toast with result (same ID will replace the loading toast)
        if (errorCount === 0) {
            showToast(`Đã xóa thành công ${successCount} mã`, 'success', null, 'bulk-delete');
        } else if (successCount === 0) {
            showToast(`Không thể xóa ${errorCount} mã (có thể đã được sử dụng)`, 'error', null, 'bulk-delete');
        } else {
            showToast(`Đã xóa ${successCount} mã, thất bại ${errorCount} mã (có thể đã được sử dụng)`, 'warning', null, 'bulk-delete');
        }
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast('Lỗi khi xóa hàng loạt: ' + error.message, 'error', null, 'bulk-delete');
    }
}

// Bulk Export - Export selected discounts to CSV
async function bulkExport() {
    if (selectedDiscountIds.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 mã để export', 'warning');
        return;
    }

    try {
        const selectedDiscounts = allDiscounts.filter(d => selectedDiscountIds.has(d.id));

        // Create CSV content
        let csv = 'Mã,Tiêu đề,Loại,Giá trị,Giá trị tối thiểu,Số lần dùng,Đã dùng,Trạng thái,Ngày hết hạn\n';

        selectedDiscounts.forEach(discount => {
            const type = {
                'fixed': 'Giảm cố định',
                'percentage': 'Giảm %',
                'gift': 'Tặng quà',
                'freeship': 'Freeship'
            }[discount.type] || discount.type;
            
            const value = discount.type === 'fixed' ? discount.discount_value :
                         discount.type === 'percentage' ? `${discount.discount_value}%` :
                         discount.gift_product_name || '-';
            
            const status = discount.active ? 'Hoạt động' : 'Tạm dừng';
            
            csv += `"${discount.code}","${discount.title}","${type}","${value}",`;
            csv += `"${discount.min_order_amount || 0}","${discount.max_total_uses || 'Không giới hạn'}",`;
            csv += `"${discount.usage_count || 0}","${status}","${discount.expiry_date}"\n`;
        });

        // Create and download file
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `discounts_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Đã export ${selectedDiscountIds.size} mã thành công`, 'success');
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Lỗi khi export dữ liệu: ' + error.message, 'error');
    }
}

// ============================================
// TAB MANAGEMENT
// ============================================

function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    const tabs = ['discounts', 'usage'];
    tabs.forEach(tab => {
        const button = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        const content = document.getElementById(`content${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        
        if (tab === tabName) {
            button.classList.add('active', 'text-indigo-600', 'border-indigo-600', 'bg-gray-50');
            button.classList.remove('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            content.classList.remove('hidden');
        } else {
            button.classList.remove('active', 'text-indigo-600', 'border-indigo-600', 'bg-gray-50');
            button.classList.add('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            content.classList.add('hidden');
        }
    });
    
    // Load data if needed
    if (tabName === 'usage' && allUsageHistory.length === 0) {
        loadUsageHistory();
    }
}

// ============================================
// USAGE HISTORY API CALLS
// ============================================

async function loadUsageHistory() {
    try {
        showUsageLoading();
        
        const response = await fetch(`${API_URL}?action=getDiscountUsageHistory`);
        const data = await response.json();
        
        if (data.success) {
            allUsageHistory = data.usageHistory || [];
            filteredUsageHistory = [...allUsageHistory];
            updateUsageStats();
            renderUsageHistory();
        } else {
            showError('Không thể tải lịch sử sử dụng');
        }
    } catch (error) {
        console.error('Error loading usage history:', error);
        showError('Lỗi kết nối đến server');
    }
}

// ============================================
// USAGE HISTORY RENDERING
// ============================================

function renderUsageHistory() {
    const tbody = document.getElementById('usageTableBody');
    const loadingState = document.getElementById('loadingUsageState');
    const usageTable = document.getElementById('usageTable');
    const emptyState = document.getElementById('emptyUsageState');
    
    loadingState.classList.add('hidden');
    
    if (filteredUsageHistory.length === 0) {
        usageTable.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    usageTable.classList.remove('hidden');
    
    tbody.innerHTML = filteredUsageHistory.map(usage => {
        return `
            <tr class="hover:bg-gray-50 transition-colors fade-in">
                <td class="px-6 py-4">
                    <div class="text-sm">
                        <div class="font-medium text-gray-900">${formatDateTime(usage.used_at)}</div>
                        <div class="text-xs text-gray-500">${formatTimeAgo(usage.used_at)}</div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div>
                        <code class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-mono text-sm font-bold">
                            ${usage.discount_code}
                        </code>
                        ${usage.discount_title ? 
                            `<div class="text-xs text-gray-500 mt-1">${usage.discount_title}</div>` : 
                            ''
                        }
                        ${usage.discount_type ? getTypeBadge(usage.discount_type) : ''}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <a href="orders.html?search=${usage.order_id}" 
                        class="text-blue-600 hover:text-blue-800 font-mono text-sm hover:underline">
                        ${usage.order_id}
                    </a>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">
                        ${usage.customer_name ? 
                            `<div class="font-medium text-gray-900">${usage.customer_name}</div>` : 
                            ''
                        }
                        <div class="text-gray-600">${usage.customer_phone}</div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="font-semibold text-gray-900">${formatMoney(usage.order_amount)}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="font-semibold text-green-600">-${formatMoney(usage.discount_amount)}</span>
                </td>
                <td class="px-6 py-4">
                    ${usage.gift_received ? 
                        `<div class="text-sm">
                            <span class="px-2 py-1 bg-pink-100 text-pink-800 rounded-full text-xs font-semibold">
                                🎁 ${usage.gift_received}
                            </span>
                        </div>` : 
                        '<span class="text-gray-400">-</span>'
                    }
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="viewUsageDetail(${usage.id})" 
                        class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="Xem chi tiết">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterUsageHistory() {
    const searchTerm = document.getElementById('searchUsage').value.toLowerCase();
    const typeFilter = document.getElementById('filterUsageType').value;
    const dateFilter = document.getElementById('filterUsageDate').value;
    
    filteredUsageHistory = allUsageHistory.filter(usage => {
        // Search filter
        const matchesSearch = !searchTerm || 
            usage.discount_code.toLowerCase().includes(searchTerm) ||
            usage.order_id.toLowerCase().includes(searchTerm) ||
            usage.customer_phone.includes(searchTerm) ||
            (usage.customer_name && usage.customer_name.toLowerCase().includes(searchTerm));
        
        // Type filter
        const matchesType = !typeFilter || usage.discount_type === typeFilter;
        
        // Date filter
        let matchesDate = true;
        if (dateFilter) {
            const usageDate = new Date(usage.used_at).toISOString().split('T')[0];
            matchesDate = usageDate === dateFilter;
        }
        
        return matchesSearch && matchesType && matchesDate;
    });
    
    renderUsageHistory();
}

function viewUsageDetail(id) {
    const usage = allUsageHistory.find(u => u.id === id);
    if (!usage) return;
    
    const detailsHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold">Chi tiết sử dụng mã</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-gray-200">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div class="p-6 space-y-6">
                    <!-- Discount Info -->
                    <div class="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="text-lg font-bold text-indigo-900">Mã giảm giá</h4>
                            <code class="px-3 py-1.5 bg-white border-2 border-indigo-300 rounded-lg font-mono text-lg font-bold text-indigo-700">
                                ${usage.discount_code}
                            </code>
                        </div>
                        ${usage.discount_title ? 
                            `<p class="text-indigo-800 font-medium">${usage.discount_title}</p>` : 
                            ''
                        }
                        ${usage.discount_type ? 
                            `<div class="mt-2">${getTypeBadge(usage.discount_type)}</div>` : 
                            ''
                        }
                    </div>
                    
                    <!-- Order Info -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Thông tin đơn hàng</h4>
                        <div class="space-y-3">
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Mã đơn hàng:</span>
                                <a href="orders.html?search=${usage.order_id}" 
                                    class="font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                                    ${usage.order_id}
                                </a>
                            </div>
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Giá trị đơn hàng:</span>
                                <span class="font-bold text-gray-900 text-lg">${formatMoney(usage.order_amount)}</span>
                            </div>
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Giảm giá:</span>
                                <span class="font-bold text-green-600 text-lg">-${formatMoney(usage.discount_amount)}</span>
                            </div>
                            ${usage.gift_received ? `
                                <div class="flex justify-between py-2 border-b border-gray-100">
                                    <span class="text-gray-600">Quà tặng:</span>
                                    <span class="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-semibold">
                                        🎁 ${usage.gift_received}
                                    </span>
                                </div>
                            ` : ''}
                            <div class="flex justify-between py-2 bg-blue-50 px-3 rounded-lg">
                                <span class="text-blue-900 font-semibold">Thành tiền:</span>
                                <span class="font-bold text-blue-900 text-xl">
                                    ${formatMoney((usage.order_amount || 0) - (usage.discount_amount || 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Customer Info -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Thông tin khách hàng</h4>
                        <div class="space-y-3">
                            ${usage.customer_name ? `
                                <div class="flex justify-between py-2 border-b border-gray-100">
                                    <span class="text-gray-600">Tên khách hàng:</span>
                                    <span class="font-semibold text-gray-900">${usage.customer_name}</span>
                                </div>
                            ` : ''}
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Số điện thoại:</span>
                                <span class="font-semibold text-gray-900">${usage.customer_phone}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Time Info -->
                    <div>
                        <h4 class="text-lg font-bold text-gray-900 mb-3">Thời gian</h4>
                        <div class="space-y-3">
                            <div class="flex justify-between py-2 border-b border-gray-100">
                                <span class="text-gray-600">Sử dụng lúc:</span>
                                <span class="font-semibold text-gray-900">${formatDateTime(usage.used_at)}</span>
                            </div>
                            <div class="flex justify-between py-2">
                                <span class="text-gray-600">Cách đây:</span>
                                <span class="text-gray-900">${formatTimeAgo(usage.used_at)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex gap-3 pt-4 border-t border-gray-200">
                        <a href="orders.html?search=${usage.order_id}" 
                            class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center">
                            Xem đơn hàng
                        </a>
                        <button onclick="this.closest('.fixed').remove()" 
                            class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', detailsHTML);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('discountsTable').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function showUsageLoading() {
    document.getElementById('loadingUsageState').classList.remove('hidden');
    document.getElementById('usageTable').classList.add('hidden');
    document.getElementById('emptyUsageState').classList.add('hidden');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return formatDate(dateString);
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

// showToast is now provided by toast-manager.js

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

// ============================================
// QUICK DISCOUNT FUNCTIONS
// ============================================

function showQuickDiscountModal() {
    const modal = document.getElementById('quickDiscountModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('quickPhone').focus();
        
        // Setup form submit
        const form = document.getElementById('quickDiscountForm');
        form.onsubmit = handleQuickDiscountSubmit;
    }
}

function selectQuickType(type) {
    // Update radio input
    const radios = document.querySelectorAll('input[name="quickType"]');
    radios.forEach(radio => {
        radio.checked = (radio.value === type);
    });
    
    // Update visual state
    const options = document.querySelectorAll('.quick-radio-option');
    options.forEach(option => {
        if (option.dataset.value === type) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Update value unit
    updateQuickValueUnit();
}

function updateRadioVisuals() {
    // This function is no longer needed with the new design
    // Keeping it for compatibility
}

function closeQuickDiscountModal() {
    const modal = document.getElementById('quickDiscountModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('quickDiscountForm').reset();
    }
}

function updateQuickValueUnit() {
    const type = document.querySelector('input[name="quickType"]:checked').value;
    const unit = document.getElementById('quickValueUnit');
    if (unit) {
        unit.textContent = type === 'percentage' ? '%' : 'đ';
    }
}

async function handleQuickDiscountSubmit(e) {
    e.preventDefault();
    
    const phone = document.getElementById('quickPhone').value.trim();
    const type = document.querySelector('input[name="quickType"]:checked').value;
    const value = parseInt(document.getElementById('quickValue').value);
    const minOrder = parseInt(document.getElementById('quickMinOrder').value) || 0;
    const expiryDays = parseInt(document.getElementById('quickExpiry').value);
    const notes = document.getElementById('quickNotes').value.trim();
    
    // Validate phone
    if (!/^0\d{9}$/.test(phone)) {
        showError('Số điện thoại không hợp lệ (phải có 10 số, bắt đầu bằng 0)');
        return;
    }
    
    // Validate value
    if (!value || value <= 0) {
        showError('Giá trị giảm phải lớn hơn 0');
        return;
    }
    
    if (type === 'percentage' && value > 100) {
        showError('Giảm % không được vượt quá 100%');
        return;
    }
    
    // Show loading on button
    const submitBtn = document.getElementById('quickSubmitBtn');
    const loadingIcon = document.getElementById('quickLoadingIcon');
    const submitText = document.getElementById('quickSubmitText');
    
    submitBtn.disabled = true;
    loadingIcon.classList.remove('hidden');
    submitText.textContent = 'Đang tạo...';
    
    try {
        const response = await fetch(`${API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createQuickDiscount',
                customerPhone: phone,
                type: type,
                discountValue: value,
                minOrderAmount: minOrder,
                expiryDays: expiryDays,
                notes: notes || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeQuickDiscountModal();
            showSuccess(`Tạo mã thành công! Mã: ${data.discount.code}`);
            
            // Show code in a nice popup
            showDiscountCodePopup(data.discount);
            
            // Reload list
            await loadDiscounts();
        } else {
            showError(data.error || 'Không thể tạo mã giảm giá');
        }
    } catch (error) {
        console.error('Error creating quick discount:', error);
        showError('Lỗi kết nối đến server');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        loadingIcon.classList.add('hidden');
        submitText.textContent = 'Tạo Mã Ngay';
    }
}

function showDiscountCodePopup(discount) {
    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4';
    popup.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div class="text-center">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-gray-900 mb-2">Tạo Mã Thành Công!</h3>
                <p class="text-gray-600 mb-6">Mã giảm giá đã được tạo cho khách hàng</p>
                
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-6">
                    <p class="text-sm text-gray-600 mb-2">Mã giảm giá:</p>
                    <div class="flex items-center justify-center gap-3">
                        <p class="text-3xl font-bold text-green-600 tracking-wider">${discount.code}</p>
                        <button onclick="copyDiscountCode('${discount.code}')" 
                            class="p-2 hover:bg-green-100 rounded-lg transition-colors" title="Copy mã">
                            <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Khách hàng:</span>
                        <span class="font-semibold text-gray-900">${discount.customerPhone}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Giảm:</span>
                        <span class="font-semibold text-gray-900">${formatDiscountValue(discount.type, discount.discountValue)}</span>
                    </div>
                    ${discount.minOrderAmount > 0 ? `
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Đơn tối thiểu:</span>
                        <span class="font-semibold text-gray-900">${formatCurrency(discount.minOrderAmount)}</span>
                    </div>
                    ` : ''}
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">Hết hạn:</span>
                        <span class="font-semibold text-gray-900">${formatDate(discount.expiryDate)} (${discount.expiryDays} ngày)</span>
                    </div>
                </div>
                
                <button onclick="this.closest('.fixed').remove()" 
                    class="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
}

function copyDiscountCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showSuccess('Đã copy mã: ' + code);
    }).catch(err => {
        console.error('Copy failed:', err);
        showError('Không thể copy mã');
    });
}

function formatCurrency(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDiscountValue(type, value) {
    if (type === 'percentage') {
        return `${value}%`;
    } else {
        return formatCurrency(value);
    }
}
