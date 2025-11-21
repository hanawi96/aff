// ============================================
// CONFIGURATION
// ============================================
const API_URL = 'https://ctv-api.yendev96.workers.dev';

// State
let allDiscounts = [];
let filteredDiscounts = [];
let currentDiscount = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadDiscounts();
    setupEventListeners();
});

function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterDiscounts, 300));
    }

    // Filters
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');
    if (filterType) filterType.addEventListener('change', filterDiscounts);
    if (filterStatus) filterStatus.addEventListener('change', filterDiscounts);

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
            updateStats();
            renderDiscounts();
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
    
    tbody.innerHTML = filteredDiscounts.map(discount => {
        const isExpired = new Date(discount.expiry_date) < new Date();
        const isActive = discount.active && !isExpired;
        
        return `
            <tr class="hover:bg-gray-50 transition-colors fade-in">
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
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="viewDiscountDetails(${discount.id})" 
                            class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                            title="Xem chi tiết">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <button onclick="editDiscount(${discount.id})" 
                            class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                            title="Chỉnh sửa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="toggleDiscountStatus(${discount.id}, ${discount.active ? 1 : 0})" 
                            class="p-2 ${isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'} rounded-lg transition-colors" 
                            title="${isActive ? 'Tạm dừng' : 'Kích hoạt'}">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                ${isActive ? 
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />' :
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
                                }
                            </svg>
                        </button>
                        <button onclick="deleteDiscount(${discount.id}, '${discount.code}')" 
                            class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
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
    
    // Reset visibility
    discountValueField.classList.add('hidden');
    maxDiscountField.classList.add('hidden');
    giftSection.classList.add('hidden');
    
    // Show relevant fields based on type
    switch(type) {
        case 'fixed':
            discountValueField.classList.remove('hidden');
            discountValueInput.placeholder = 'VD: 50000';
            discountValueInput.required = true;
            break;
        case 'percentage':
            discountValueField.classList.remove('hidden');
            maxDiscountField.classList.remove('hidden');
            discountValueInput.placeholder = 'VD: 10 (cho 10%)';
            discountValueInput.required = true;
            break;
        case 'gift':
            giftSection.classList.remove('hidden');
            discountValueInput.required = false;
            break;
        case 'freeship':
            discountValueInput.required = false;
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
    
    renderDiscounts();
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
// UTILITY FUNCTIONS
// ============================================

function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('discountsTable').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

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
