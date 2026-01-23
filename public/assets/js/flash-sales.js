// Flash Sales Management - Main Controller
// API Configuration
const API_BASE = typeof CONFIG !== 'undefined' ? CONFIG.API_URL : window.location.origin;

// Global State
let flashSales = [];
let allProducts = [];
let allCategories = [];
let currentFlashSale = null;
let currentFilter = 'all';

// Modal State
let currentStep = 1;
let selectedProducts = new Map(); // productId -> {product, flashPrice, stockLimit, maxPerCustomer}
let currentPriceProduct = null;
let currentEditingFlashSaleId = null; // null = create mode, number = edit mode
let isLoadingProducts = false; // Track if products are being loaded for edit mode

// Bulk Add Modal State
let bulkSelectedProducts = new Set(); // Set of product IDs
let bulkProductConfigs = new Map(); // productId -> {flashPrice, stockLimit, maxPerCustomer}
let bulkVisibleProducts = []; // Currently visible/filtered products

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadFlashSales();
    loadProducts();
    loadCategories();
    setupEventListeners();
});

// Logout - Already defined in auth-check.js
// window.logout is available globally

// Load Flash Sales
async function loadFlashSales() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/api?action=getAllFlashSales`);
        const data = await response.json();
        
        if (data.success) {
            flashSales = data.flashSales || [];
            renderFlashSales();
            updateStats();
        } else {
            showToast('Lỗi tải dữ liệu: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error loading flash sales:', error);
        showToast('Lỗi kết nối server', 'error');
    } finally {
        hideLoading();
    }
}

// Load Products
async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/api?action=getAllProducts`);
        const data = await response.json();
        
        if (data.success) {
            allProducts = data.products || [];
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Load Categories
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/api?action=getAllCategories`);
        const data = await response.json();
        
        if (data.success) {
            allCategories = data.categories || [];
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Render Flash Sales Table
function renderFlashSales() {
    const tbody = document.getElementById('flashSalesTableBody');
    const table = document.getElementById('flashSalesTable');
    const emptyState = document.getElementById('emptyState');
    
    // Filter
    let filtered = flashSales;
    if (currentFilter !== 'all') {
        filtered = flashSales.filter(fs => fs.status === currentFilter);
    }
    
    // Search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(fs => 
            fs.name.toLowerCase().includes(searchTerm) ||
            (fs.description && fs.description.toLowerCase().includes(searchTerm))
        );
    }
    
    if (filtered.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    table.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    tbody.innerHTML = filtered.map(fs => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-900">${fs.name}</p>
                        ${fs.description ? `<p class="text-sm text-gray-500">${fs.description}</p>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                ${formatTimeColumn(fs)}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                    ${fs.product_count || 0} SP
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                    ${fs.total_sold || 0}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                ${getStatusBadge(fs.status)}
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="viewFlashSale(${fs.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Xem chi tiết">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button onclick="editFlashSale(${fs.id})" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Sửa">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    ${fs.status === 'draft' || fs.status === 'scheduled' ? `
                        <button onclick="activateFlashSale(${fs.id})" class="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Kích hoạt">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </button>
                    ` : ''}
                    <button onclick="deleteFlashSale(${fs.id})" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Update Stats
function updateStats() {
    document.getElementById('totalFlashSales').textContent = flashSales.length;
    document.getElementById('activeFlashSales').textContent = flashSales.filter(fs => fs.status === 'active').length;
    
    const totalProducts = flashSales.reduce((sum, fs) => sum + (parseInt(fs.product_count) || 0), 0);
    document.getElementById('totalProducts').textContent = totalProducts;
    
    const totalSold = flashSales.reduce((sum, fs) => sum + (parseInt(fs.total_sold) || 0), 0);
    document.getElementById('totalSold').textContent = totalSold;
}

// Helper Functions
function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTimeRemaining(flashSale) {
    const now = Math.floor(Date.now() / 1000);
    
    if (flashSale.status === 'active') {
        const remaining = flashSale.end_time - now;
        if (remaining > 0) {
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            return `<p class="text-xs text-orange-600 font-semibold mt-1">⏰ Còn ${hours}h ${minutes}m</p>`;
        }
    }
    return '';
}

function getStatusBadge(status) {
    const badges = {
        draft: '<span class="status-badge status-draft">Nháp</span>',
        scheduled: '<span class="status-badge status-scheduled">Đã lên lịch</span>',
        active: '<span class="status-badge status-active">Đang chạy</span>',
        ended: '<span class="status-badge status-ended">Đã kết thúc</span>',
        cancelled: '<span class="status-badge status-cancelled">Đã hủy</span>'
    };
    return badges[status] || badges.draft;
}

// Format time column with beautiful layout
function formatTimeColumn(flashSale) {
    const now = Math.floor(Date.now() / 1000);
    const startDate = new Date(flashSale.start_time * 1000);
    const endDate = new Date(flashSale.end_time * 1000);
    
    // Format dates
    const startFormatted = startDate.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const endFormatted = endDate.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    // Calculate time remaining
    let timeRemainingHTML = '';
    if (flashSale.status === 'active') {
        const remaining = flashSale.end_time - now;
        if (remaining > 0) {
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            
            let timeText = '';
            if (days > 0) {
                timeText = `Còn ${days} ngày ${hours}h`;
            } else if (hours > 0) {
                timeText = `Còn ${hours}h ${minutes}m`;
            } else {
                timeText = `Còn ${minutes}m`;
            }
            
            timeRemainingHTML = `
                <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-lg">
                    <svg class="w-3.5 h-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-xs font-semibold text-orange-700">${timeText}</span>
                </div>
            `;
        }
    } else if (flashSale.status === 'scheduled') {
        const timeUntilStart = flashSale.start_time - now;
        if (timeUntilStart > 0) {
            const days = Math.floor(timeUntilStart / 86400);
            const hours = Math.floor((timeUntilStart % 86400) / 3600);
            
            let timeText = '';
            if (days > 0) {
                timeText = `Bắt đầu sau ${days} ngày`;
            } else if (hours > 0) {
                timeText = `Bắt đầu sau ${hours}h`;
            } else {
                timeText = `Sắp bắt đầu`;
            }
            
            timeRemainingHTML = `
                <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                    <svg class="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-xs font-semibold text-blue-700">${timeText}</span>
                </div>
            `;
        }
    }
    
    return `
        <div class="space-y-2">
            <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-500 mb-0.5">Bắt đầu</p>
                    <p class="text-sm font-semibold text-gray-900">${startFormatted}</p>
                </div>
            </div>
            <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-500 mb-0.5">Kết thúc</p>
                    <p class="text-sm font-medium text-gray-700">${endFormatted}</p>
                </div>
            </div>
            ${timeRemainingHTML}
        </div>
    `;
}

// Filter Functions
function filterByStatus(status) {
    currentFilter = status;
    
    // Update button states
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600');
        btn.classList.add('border-gray-300', 'text-gray-700');
    });
    
    const activeBtn = document.getElementById(`filter-${status}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600');
        activeBtn.classList.remove('border-gray-300', 'text-gray-700');
    }
    
    renderFlashSales();
}

// Setup Event Listeners
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', () => {
        renderFlashSales();
    });
    
    // Price input - calculate discount percentage
    document.getElementById('flashSalePriceInput').addEventListener('input', updateDiscountPercentage);
    
    // Stock limit checkbox
    document.getElementById('unlimitedStockCheckbox').addEventListener('change', (e) => {
        document.getElementById('stockLimitInput').disabled = e.target.checked;
        if (e.target.checked) {
            document.getElementById('stockLimitInput').value = '';
        }
    });
    
    // Max per customer checkbox
    document.getElementById('unlimitedPerCustomerCheckbox').addEventListener('change', (e) => {
        document.getElementById('maxPerCustomerInput').disabled = e.target.checked;
        if (e.target.checked) {
            document.getElementById('maxPerCustomerInput').value = '';
        }
    });
}

// Loading States
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('flashSalesTable').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

// Toast Notification
function showToast(message, type = 'success') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Modal Functions (to be implemented)
function showCreateFlashSaleModal() {
    // Reset state
    currentStep = 1;
    selectedProducts.clear();
    currentEditingFlashSaleId = null; // Reset edit mode
    
    // Reset form
    document.getElementById('flashSaleName').value = '';
    document.getElementById('flashSaleDescription').value = '';
    
    // Auto-fill start time with current time + 2 minutes (buffer time)
    const now = new Date();
    const startTime = new Date(now.getTime() + 2 * 60 * 1000); // +2 minutes
    document.getElementById('flashSaleStartTime').value = formatDateTimeLocal(startTime);
    
    // Auto-fill end time with +24 hours from start time (default 1 day)
    const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
    document.getElementById('flashSaleEndTime').value = formatDateTimeLocal(endTime);
    
    document.getElementById('flashSaleStatus').value = 'draft';
    
    // Reset modal title
    document.querySelector('#createFlashSaleModal h3').textContent = 'Tạo Flash Sale Mới';
    document.querySelector('#createFlashSaleModal p').textContent = 'Tạo chương trình giảm giá có thời hạn';
    
    // Show modal
    document.getElementById('createFlashSaleModal').classList.remove('hidden');
    
    // Show step 1
    showStep(1);
}

// Time preset function
function setTimePreset(hours) {
    const now = new Date();
    const startTime = new Date(now.getTime() + 2 * 60 * 1000); // +2 minutes buffer
    const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
    
    // Update both inputs
    document.getElementById('flashSaleStartTime').value = formatDateTimeLocal(startTime);
    document.getElementById('flashSaleEndTime').value = formatDateTimeLocal(endTime);
    
    // Visual feedback
    showToast(`✓ Đã đặt: Bắt đầu sau 2 phút, kết thúc sau ${hours} giờ`, 'success');
}

function closeCreateFlashSaleModal() {
    document.getElementById('createFlashSaleModal').classList.add('hidden');
}

// Step Navigation
function showStep(step) {
    currentStep = step;
    
    // Hide all steps
    document.getElementById('step1Content').classList.add('hidden');
    document.getElementById('step2Content').classList.add('hidden');
    
    // Show current step
    document.getElementById(`step${step}Content`).classList.remove('hidden');
    
    // Update progress indicators
    updateProgressIndicators();
    
    // Update buttons
    updateNavigationButtons();
    
    // Load data for step
    if (step === 2) {
        // Step 2: Hide main modal and open bulk add modal
        document.getElementById('createFlashSaleModal').classList.add('hidden');
        
        // In edit mode, wait for products to load first
        if (currentEditingFlashSaleId) {
            // Show loading state while products are being loaded
            showBulkAddModalWithExistingProducts();
        } else {
            showBulkAddModal();
        }
    }
}

function updateProgressIndicators() {
    // Reset all steps (only 2 steps now)
    for (let i = 1; i <= 2; i++) {
        const indicator = document.getElementById(`step${i}Indicator`);
        const circle = indicator.querySelector('div');
        const text = indicator.querySelector('span');
        
        if (i < currentStep) {
            // Completed step
            circle.className = 'w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm';
            circle.textContent = '✓';
            text.className = 'font-medium text-gray-700';
        } else if (i === currentStep) {
            // Current step
            circle.className = 'w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm';
            circle.textContent = i;
            text.className = 'font-semibold text-gray-900';
        } else {
            // Future step
            circle.className = 'w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold text-sm';
            circle.textContent = i;
            text.className = 'font-medium text-gray-500';
        }
    }
    
    // Update progress line
    document.getElementById('progress1to2').className = currentStep > 1 ? 'w-16 h-1 bg-green-500' : 'w-16 h-1 bg-gray-300';
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Show/hide prev button
    if (currentStep === 1) {
        prevBtn.classList.add('hidden');
    } else {
        prevBtn.classList.remove('hidden');
    }
    
    // Show/hide next/submit buttons
    if (currentStep === 2) {
        nextBtn.classList.add('hidden');
        submitBtn.classList.remove('hidden');
        // Update submit button text based on mode
        submitBtn.innerHTML = currentEditingFlashSaleId ? '✓ Cập nhật Flash Sale' : '✓ Tạo Flash Sale';
    } else {
        nextBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
    }
}

function nextStep() {
    // Validate current step
    if (currentStep === 1) {
        if (!validateStep1()) return;
        
        // In edit mode, check if products are still loading
        if (currentEditingFlashSaleId && isLoadingProducts) {
            showToast('Đang tải sản phẩm, vui lòng đợi...', 'error');
            return;
        }
    }
    
    // Move to next step (only 2 steps now)
    if (currentStep < 2) {
        showStep(currentStep + 1);
    }
}

function previousStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

// Validation Functions
function validateStep1() {
    const name = document.getElementById('flashSaleName').value.trim();
    const startTime = document.getElementById('flashSaleStartTime').value;
    const endTime = document.getElementById('flashSaleEndTime').value;
    const status = document.getElementById('flashSaleStatus').value;
    
    // Clear previous errors
    document.getElementById('flashSaleName').classList.remove('input-error');
    document.getElementById('flashSaleStartTime').classList.remove('input-error');
    document.getElementById('flashSaleEndTime').classList.remove('input-error');
    
    // Validate name
    if (!name || name.length < 3) {
        document.getElementById('flashSaleName').classList.add('input-error');
        showToast('Tên flash sale phải có ít nhất 3 ký tự', 'error');
        return false;
    }
    
    // Validate times
    if (!startTime || !endTime) {
        if (!startTime) document.getElementById('flashSaleStartTime').classList.add('input-error');
        if (!endTime) document.getElementById('flashSaleEndTime').classList.add('input-error');
        showToast('Vui lòng chọn thời gian bắt đầu và kết thúc', 'error');
        return false;
    }
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const now = Date.now();
    
    // ALWAYS validate: end time > start time
    if (end <= start) {
        document.getElementById('flashSaleEndTime').classList.add('input-error');
        showToast('Thời gian kết thúc phải sau thời gian bắt đầu', 'error');
        return false;
    }
    
    // SMART VALIDATION based on selected status
    if (status === 'scheduled') {
        // SCHEDULED: Start time MUST be in future
        if (start <= now) {
            document.getElementById('flashSaleStartTime').classList.add('input-error');
            showToast('Trạng thái "Đã lên lịch" yêu cầu thời gian bắt đầu phải ở tương lai', 'error');
            return false;
        }
    }
    
    if (status === 'active') {
        // ACTIVE: Must be within time range (start <= now < end)
        if (start > now) {
            document.getElementById('flashSaleStartTime').classList.add('input-error');
            showToast('Không thể "Kích hoạt ngay" khi thời gian bắt đầu ở tương lai. Chọn "Đã lên lịch" thay vì.', 'error');
            return false;
        }
        if (end <= now) {
            document.getElementById('flashSaleEndTime').classList.add('input-error');
            showToast('Không thể "Kích hoạt ngay" khi thời gian kết thúc đã qua. Flash sale sẽ kết thúc ngay lập tức.', 'error');
            return false;
        }
    }
    
    if (status === 'ended') {
        // ENDED: End time should be in past (logical)
        if (end > now) {
            if (!confirm('Bạn đang đặt trạng thái "Đã kết thúc" nhưng thời gian kết thúc vẫn ở tương lai. Có chắc chắn muốn kết thúc sớm?')) {
                return false;
            }
        }
    }
    
    // DRAFT: No time validation needed (it's just a draft)
    
    return true;
}

// Bulk Add Modal Functions
function showBulkAddModal() {
    bulkSelectedProducts.clear();
    bulkProductConfigs.clear();
    
    // Render categories
    const bulkCategoryFilter = document.getElementById('bulkCategoryFilter');
    bulkCategoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>';
    allCategories.forEach(cat => {
        bulkCategoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
    
    // Render products
    renderBulkProductsList();
    updateBulkConfigPanel();
    
    // Setup search and filter
    document.getElementById('bulkProductSearch').addEventListener('input', renderBulkProductsList);
    document.getElementById('bulkCategoryFilter').addEventListener('change', renderBulkProductsList);
    
    // Show modal
    document.getElementById('bulkAddProductsModal').classList.remove('hidden');
}

function closeBulkAddModal(returnToMainModal = true) {
    document.getElementById('bulkAddProductsModal').classList.add('hidden');
    
    // When closing bulk modal, optionally show main modal again at Step 1
    if (returnToMainModal) {
        document.getElementById('createFlashSaleModal').classList.remove('hidden');
        showStep(1);
    }
    
    // Don't clear products in edit mode - keep them
    if (!currentEditingFlashSaleId) {
        bulkSelectedProducts.clear();
        bulkProductConfigs.clear();
    }
}

// Show bulk add modal with existing products (for edit mode)
function showBulkAddModalWithExistingProducts() {
    // Don't clear - keep existing selectedProducts
    // Transfer selectedProducts to bulk state
    bulkSelectedProducts.clear();
    bulkProductConfigs.clear();
    
    selectedProducts.forEach((config, productId) => {
        bulkSelectedProducts.add(productId);
        bulkProductConfigs.set(productId, {
            flashPrice: config.flashPrice,
            stockLimit: config.stockLimit,
            maxPerCustomer: config.maxPerCustomer
        });
    });
    
    // Render categories
    const bulkCategoryFilter = document.getElementById('bulkCategoryFilter');
    bulkCategoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>';
    allCategories.forEach(cat => {
        bulkCategoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
    
    // Render products
    renderBulkProductsList();
    updateBulkConfigPanel();
    
    // Setup search and filter
    document.getElementById('bulkProductSearch').addEventListener('input', renderBulkProductsList);
    document.getElementById('bulkCategoryFilter').addEventListener('change', renderBulkProductsList);
    
    // Show modal
    document.getElementById('bulkAddProductsModal').classList.remove('hidden');
}

function renderBulkProductsList() {
    const searchTerm = document.getElementById('bulkProductSearch').value.toLowerCase();
    const categoryId = document.getElementById('bulkCategoryFilter').value;
    
    let filtered = allProducts.filter(p => {
        // In edit mode, don't skip already added products - we want to show them
        // In create mode, skip them
        if (!currentEditingFlashSaleId && selectedProducts.has(p.id)) return false;
        
        const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm);
        const matchCategory = !categoryId || p.category_id == categoryId;
        return matchSearch && matchCategory;
    });
    
    // Store visible products for "select all" function
    bulkVisibleProducts = filtered;
    
    const container = document.getElementById('bulkProductsList');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">Không tìm thấy sản phẩm</div>';
        document.getElementById('bulkTotalVisible').textContent = '0';
        return;
    }
    
    container.innerHTML = filtered.map(product => {
        const isSelected = bulkSelectedProducts.has(product.id);
        return `
            <div class="bulk-product-item ${isSelected ? 'selected' : ''}" onclick="toggleBulkProduct(${product.id})">
                <div class="flex items-center gap-3">
                    <div class="w-5 h-5 border-2 rounded ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'} flex items-center justify-center flex-shrink-0">
                        ${isSelected ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>' : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-gray-900 text-sm truncate">${product.name}</p>
                        <p class="text-orange-600 font-bold text-sm">${formatCurrency(product.price)}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update counts
    document.getElementById('bulkSelectedCount').textContent = bulkSelectedProducts.size;
    document.getElementById('bulkTotalVisible').textContent = filtered.length;
    document.getElementById('bulkTotalSelected').textContent = bulkSelectedProducts.size;
}

function selectAllVisibleProducts() {
    if (bulkVisibleProducts.length === 0) {
        showToast('Không có sản phẩm nào để chọn', 'error');
        return;
    }
    
    // Add all visible products
    bulkVisibleProducts.forEach(product => {
        if (!bulkSelectedProducts.has(product.id)) {
            bulkSelectedProducts.add(product.id);
            // Initialize config with null values (user will use bulk config to fill)
            bulkProductConfigs.set(product.id, {
                flashPrice: null,
                stockLimit: null,
                maxPerCustomer: null
            });
        }
    });
    
    renderBulkProductsList();
    updateBulkConfigPanel();
    
    showToast(`✓ Đã chọn ${bulkVisibleProducts.length} sản phẩm. Dùng "Áp dụng nhanh" để cấu hình.`, 'success');
}

function deselectAllProducts() {
    if (bulkSelectedProducts.size === 0) {
        showToast('Chưa có sản phẩm nào được chọn', 'error');
        return;
    }
    
    const count = bulkSelectedProducts.size;
    bulkSelectedProducts.clear();
    bulkProductConfigs.clear();
    
    renderBulkProductsList();
    updateBulkConfigPanel();
    
    showToast(`✓ Đã bỏ chọn ${count} sản phẩm`, 'success');
}

function toggleBulkProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    if (bulkSelectedProducts.has(productId)) {
        // Deselect
        bulkSelectedProducts.delete(productId);
        bulkProductConfigs.delete(productId);
    } else {
        // Select and initialize config with null values
        bulkSelectedProducts.add(productId);
        bulkProductConfigs.set(productId, {
            flashPrice: null,
            stockLimit: null,
            maxPerCustomer: null
        });
    }
    
    renderBulkProductsList();
    updateBulkConfigPanel();
}

function updateBulkConfigPanel() {
    const emptyState = document.getElementById('bulkConfigEmpty');
    const configItems = document.getElementById('bulkConfigItems');
    const addBtn = document.getElementById('bulkAddBtn');
    
    if (bulkSelectedProducts.size === 0) {
        emptyState.classList.remove('hidden');
        configItems.classList.add('hidden');
        addBtn.disabled = true;
        return;
    }
    
    emptyState.classList.add('hidden');
    configItems.classList.remove('hidden');
    
    // Update button text and color based on mode
    if (currentEditingFlashSaleId) {
        addBtn.innerHTML = '✓ Cập nhật Flash Sale';
        addBtn.className = 'px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed';
    } else {
        addBtn.innerHTML = '✓ Tạo Flash Sale';
        addBtn.className = 'px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed';
    }
    
    // Render config for each selected product
    configItems.innerHTML = Array.from(bulkSelectedProducts).map(productId => {
        const product = allProducts.find(p => p.id === productId);
        const config = bulkProductConfigs.get(productId) || {};
        
        return `
            <div class="bulk-config-item" id="bulk-config-${productId}">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <p class="font-bold text-gray-900 text-sm mb-1">${product.name}</p>
                        <p class="text-xs text-gray-500">Giá gốc: ${formatCurrency(product.price)}</p>
                    </div>
                    <button onclick="removeBulkProduct(${productId})" class="text-red-500 hover:bg-red-50 p-1 rounded">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div class="grid grid-cols-3 gap-3">
                    <div class="bulk-input-group">
                        <label>
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Giá Flash
                        </label>
                        <input type="number" 
                            id="bulk-price-${productId}" 
                            placeholder="${Math.floor(product.price * 0.7)}"
                            value="${config.flashPrice || ''}"
                            onchange="updateBulkConfig(${productId}, 'flashPrice', this.value)"
                            class="bulk-input">
                    </div>
                    
                    <div class="bulk-input-group">
                        <label>
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            Tổng SL
                        </label>
                        <input type="number" 
                            id="bulk-stock-${productId}" 
                            placeholder="∞"
                            value="${config.stockLimit || ''}"
                            onchange="updateBulkConfig(${productId}, 'stockLimit', this.value)"
                            class="bulk-input">
                    </div>
                    
                    <div class="bulk-input-group">
                        <label>
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Mỗi KH
                        </label>
                        <input type="number" 
                            id="bulk-max-${productId}" 
                            placeholder="∞"
                            value="${config.maxPerCustomer || ''}"
                            onchange="updateBulkConfig(${productId}, 'maxPerCustomer', this.value)"
                            class="bulk-input">
                    </div>
                </div>
                
                <div class="bulk-quick-actions">
                    <button onclick="applyQuickDiscount(${productId}, 0.8)" class="bulk-quick-btn">-20%</button>
                    <button onclick="applyQuickDiscount(${productId}, 0.7)" class="bulk-quick-btn">-30%</button>
                    <button onclick="applyQuickDiscount(${productId}, 0.6)" class="bulk-quick-btn">-40%</button>
                    <button onclick="applyQuickDiscount(${productId}, 0.5)" class="bulk-quick-btn">-50%</button>
                    <button onclick="applyQuickLimits(${productId}, null, null)" class="bulk-quick-btn">∞</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Check if all products have valid config
    validateBulkConfig();
}

function removeBulkProduct(productId) {
    bulkSelectedProducts.delete(productId);
    bulkProductConfigs.delete(productId);
    renderBulkProductsList();
    updateBulkConfigPanel();
}

function updateBulkConfig(productId, field, value) {
    const config = bulkProductConfigs.get(productId) || {};
    const numValue = value ? parseFloat(value) : null;
    config[field] = numValue;
    bulkProductConfigs.set(productId, config);
    validateBulkConfig();
}

function applyQuickDiscount(productId, multiplier) {
    const product = allProducts.find(p => p.id === productId);
    const rawPrice = product.price * multiplier;
    const flashPrice = smartRoundPrice(rawPrice); // Use smart rounding
    
    // Update flash price
    document.getElementById(`bulk-price-${productId}`).value = flashPrice;
    updateBulkConfig(productId, 'flashPrice', flashPrice);
    
    // Also set stock limit and max per customer to 30/2
    document.getElementById(`bulk-stock-${productId}`).value = 30;
    updateBulkConfig(productId, 'stockLimit', 30);
    
    document.getElementById(`bulk-max-${productId}`).value = 2;
    updateBulkConfig(productId, 'maxPerCustomer', 2);
}

function applyQuickLimits(productId, stock, maxPer) {
    if (stock !== null) {
        document.getElementById(`bulk-stock-${productId}`).value = stock;
        updateBulkConfig(productId, 'stockLimit', stock);
    } else {
        document.getElementById(`bulk-stock-${productId}`).value = '';
        updateBulkConfig(productId, 'stockLimit', null);
    }
    
    if (maxPer !== null) {
        document.getElementById(`bulk-max-${productId}`).value = maxPer;
        updateBulkConfig(productId, 'maxPerCustomer', maxPer);
    } else {
        document.getElementById(`bulk-max-${productId}`).value = '';
        updateBulkConfig(productId, 'maxPerCustomer', null);
    }
}

function applyToAll(type, ...args) {
    if (bulkSelectedProducts.size === 0) {
        showToast('Chưa có sản phẩm nào được chọn', 'error');
        return;
    }
    
    for (const productId of bulkSelectedProducts) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) continue;
        
        if (type === 'discount') {
            const multiplier = args[0];
            const flashPrice = Math.floor(product.price * multiplier);
            const input = document.getElementById(`bulk-price-${productId}`);
            if (input) {
                input.value = flashPrice;
                updateBulkConfig(productId, 'flashPrice', flashPrice);
            }
        } else if (type === 'limits') {
            const stock = args[0];
            const maxPer = args[1];
            
            const stockInput = document.getElementById(`bulk-stock-${productId}`);
            const maxInput = document.getElementById(`bulk-max-${productId}`);
            
            if (stockInput) {
                stockInput.value = stock;
                updateBulkConfig(productId, 'stockLimit', stock);
            }
            if (maxInput) {
                maxInput.value = maxPer;
                updateBulkConfig(productId, 'maxPerCustomer', maxPer);
            }
        } else if (type === 'unlimited') {
            const stockInput = document.getElementById(`bulk-stock-${productId}`);
            const maxInput = document.getElementById(`bulk-max-${productId}`);
            
            if (stockInput) {
                stockInput.value = '';
                updateBulkConfig(productId, 'stockLimit', null);
            }
            if (maxInput) {
                maxInput.value = '';
                updateBulkConfig(productId, 'maxPerCustomer', null);
            }
        }
    }
    
    const actionText = type === 'discount' 
        ? `giảm ${Math.round((1 - args[0]) * 100)}%` 
        : type === 'limits' 
            ? `${args[0]}/${args[1]}` 
            : 'không giới hạn';
    
    showToast(`✓ Đã áp dụng ${actionText} cho ${bulkSelectedProducts.size} sản phẩm`, 'success');
}

// NEW: Fill bulk input fields (for quick buttons)
function fillBulkInputs(discountPercent, stockLimit, maxPerCustomer) {
    // Fill discount percent
    document.getElementById('bulkDiscountPercent').value = discountPercent || '';
    
    // Fill stock limit
    document.getElementById('bulkStockLimit').value = stockLimit || '';
    
    // Fill max per customer
    document.getElementById('bulkMaxPerCustomer').value = maxPerCustomer || '';
}

// NEW: Apply bulk configuration to all selected products
function applyBulkConfig() {
    if (bulkSelectedProducts.size === 0) {
        showToast('Chưa có sản phẩm nào được chọn', 'error');
        return;
    }
    
    // Get values from inputs
    const discountPercent = parseFloat(document.getElementById('bulkDiscountPercent').value);
    const stockLimit = document.getElementById('bulkStockLimit').value;
    const maxPerCustomer = document.getElementById('bulkMaxPerCustomer').value;
    
    // Validate discount percent
    if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) {
        showToast('Vui lòng nhập % giảm giá hợp lệ (1-99)', 'error');
        document.getElementById('bulkDiscountPercent').focus();
        return;
    }
    
    // Parse limits (empty = null = unlimited)
    const parsedStockLimit = stockLimit ? parseInt(stockLimit) : null;
    const parsedMaxPerCustomer = maxPerCustomer ? parseInt(maxPerCustomer) : null;
    
    // Validate limits
    if (parsedStockLimit !== null && parsedStockLimit <= 0) {
        showToast('Tổng số lượng phải lớn hơn 0', 'error');
        document.getElementById('bulkStockLimit').focus();
        return;
    }
    
    if (parsedMaxPerCustomer !== null && parsedMaxPerCustomer <= 0) {
        showToast('Giới hạn mỗi khách hàng phải lớn hơn 0', 'error');
        document.getElementById('bulkMaxPerCustomer').focus();
        return;
    }
    
    // Validate: max per customer should not exceed stock limit
    if (parsedStockLimit !== null && parsedMaxPerCustomer !== null && parsedMaxPerCustomer > parsedStockLimit) {
        showToast('Giới hạn mỗi khách hàng không được vượt quá tổng số lượng', 'error');
        return;
    }
    
    // Calculate multiplier from discount percent
    const multiplier = (100 - discountPercent) / 100;
    
    // Apply to all selected products
    let appliedCount = 0;
    for (const productId of bulkSelectedProducts) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) continue;
        
        // Calculate flash price with smart rounding
        const rawPrice = product.price * multiplier;
        const flashPrice = smartRoundPrice(rawPrice);
        
        // Update inputs
        const priceInput = document.getElementById(`bulk-price-${productId}`);
        const stockInput = document.getElementById(`bulk-stock-${productId}`);
        const maxInput = document.getElementById(`bulk-max-${productId}`);
        
        if (priceInput) {
            priceInput.value = flashPrice;
            updateBulkConfig(productId, 'flashPrice', flashPrice);
        }
        
        if (stockInput) {
            stockInput.value = parsedStockLimit || '';
            updateBulkConfig(productId, 'stockLimit', parsedStockLimit);
        }
        
        if (maxInput) {
            maxInput.value = parsedMaxPerCustomer || '';
            updateBulkConfig(productId, 'maxPerCustomer', parsedMaxPerCustomer);
        }
        
        appliedCount++;
    }
    
    // Show success message
    const stockText = parsedStockLimit !== null ? `${parsedStockLimit} SP` : '∞';
    const maxText = parsedMaxPerCustomer !== null ? `${parsedMaxPerCustomer}/KH` : '∞';
    showToast(`✓ Đã áp dụng -${discountPercent}%, ${stockText}, ${maxText} cho ${appliedCount} sản phẩm`, 'success');
}

function validateBulkConfig() {
    let allValid = true;
    
    for (const productId of bulkSelectedProducts) {
        const product = allProducts.find(p => p.id === productId);
        const config = bulkProductConfigs.get(productId);
        const configItem = document.getElementById(`bulk-config-${productId}`);
        
        if (!configItem) continue;
        
        // Reset classes
        configItem.classList.remove('has-error', 'is-valid');
        
        // Validate flash price
        if (!config.flashPrice || config.flashPrice <= 0 || config.flashPrice >= product.price) {
            configItem.classList.add('has-error');
            allValid = false;
            continue;
        }
        
        // Validate limits
        if (config.stockLimit !== null && config.maxPerCustomer !== null) {
            if (config.maxPerCustomer > config.stockLimit) {
                configItem.classList.add('has-error');
                allValid = false;
                continue;
            }
        }
        
        configItem.classList.add('is-valid');
    }
    
    document.getElementById('bulkAddBtn').disabled = !allValid || bulkSelectedProducts.size === 0;
}

function confirmBulkAdd() {
    // Show loading state on button immediately
    const bulkAddBtn = document.getElementById('bulkAddBtn');
    const originalText = bulkAddBtn.innerHTML;
    bulkAddBtn.disabled = true;
    bulkAddBtn.innerHTML = `
        <span class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Đang cập nhật...
        </span>
    `;
    
    // Submit flash sale
    submitFlashSaleFromBulkModal().catch(() => {
        // Restore button on error
        bulkAddBtn.disabled = false;
        bulkAddBtn.innerHTML = originalText;
    });
}

// Submit flash sale directly from bulk modal
async function submitFlashSaleFromBulkModal() {
    try {
        // Add all configured products to selectedProducts first
        for (const productId of bulkSelectedProducts) {
            const product = allProducts.find(p => p.id === productId);
            const config = bulkProductConfigs.get(productId);
            
            selectedProducts.set(productId, {
                product: product,
                flashPrice: config.flashPrice,
                stockLimit: config.stockLimit,
                maxPerCustomer: config.maxPerCustomer
            });
        }
        
        // Submit the flash sale
        await submitFlashSale();
        
        // After successful submit, close bulk modal WITHOUT reopening main modal
        document.getElementById('bulkAddProductsModal').classList.add('hidden');
        bulkSelectedProducts.clear();
        bulkProductConfigs.clear();
        
    } catch (error) {
        console.error('Error submitting from bulk modal:', error);
        showToast('Lỗi: ' + error.message, 'error');
        throw error; // Re-throw to trigger button restore in confirmBulkAdd
    }
}

function renderSelectedProducts() {
    const container = document.getElementById('selectedProductsList');
    document.getElementById('selectedProductCount').textContent = selectedProducts.size;
    
    if (selectedProducts.size === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <svg class="w-16 h-16 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p class="text-sm">Chưa có sản phẩm nào được chọn</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = Array.from(selectedProducts.entries()).map(([productId, data]) => {
        const product = data.product;
        const flashPrice = data.flashPrice || 0;
        const discount = flashPrice > 0 ? Math.round((1 - flashPrice / product.price) * 100) : 0;
        const stockLimit = data.stockLimit;
        const maxPerCustomer = data.maxPerCustomer;
        
        return `
            <div class="selected-product-item">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1">
                        <p class="font-semibold text-gray-900 text-sm mb-1">${product.name}</p>
                        <div class="flex items-center gap-2 text-xs mb-1">
                            <span class="text-gray-500 line-through">${formatCurrency(product.price)}</span>
                            ${flashPrice > 0 ? `
                                <span class="text-orange-600 font-bold">${formatCurrency(flashPrice)}</span>
                                <span class="discount-badge">-${discount}%</span>
                            ` : '<span class="text-red-500 font-semibold">Chưa có giá</span>'}
                        </div>
                        <div class="flex items-center gap-3 text-xs text-gray-600">
                            <span title="Tổng số lượng" class="flex items-center gap-1">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                ${stockLimit !== null ? stockLimit : '∞'}
                            </span>
                            <span title="Giới hạn mỗi khách" class="flex items-center gap-1">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                ${maxPerCustomer !== null ? maxPerCustomer : '∞'}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="editProductPrice(${productId})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Sửa">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="removeProduct(${productId})" class="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function removeProduct(productId) {
    selectedProducts.delete(productId);
    renderSelectedProducts();
}

function editProductPrice(productId) {
    const data = selectedProducts.get(productId);
    if (!data) return;
    
    currentPriceProduct = data.product;
    showPriceModal(data.product, data);
}

// Price Modal Functions
function showPriceModal(product, currentData = null) {
    document.getElementById('priceModalProductName').textContent = product.name;
    document.getElementById('priceModalOriginalPrice').textContent = formatCurrency(product.price);
    
    // Set price - handle both object and legacy number format
    const flashPrice = typeof currentData === 'object' ? currentData?.flashPrice : currentData;
    document.getElementById('flashSalePriceInput').value = flashPrice || '';
    
    // Set stock limit
    const stockLimit = currentData?.stockLimit;
    const unlimitedStock = stockLimit === null || stockLimit === undefined;
    document.getElementById('stockLimitInput').value = unlimitedStock ? '' : stockLimit;
    document.getElementById('unlimitedStockCheckbox').checked = unlimitedStock;
    document.getElementById('stockLimitInput').disabled = unlimitedStock;
    
    // Set max per customer
    const maxPerCustomer = currentData?.maxPerCustomer;
    const unlimitedPerCustomer = maxPerCustomer === null || maxPerCustomer === undefined;
    document.getElementById('maxPerCustomerInput').value = unlimitedPerCustomer ? '' : maxPerCustomer;
    document.getElementById('unlimitedPerCustomerCheckbox').checked = unlimitedPerCustomer;
    document.getElementById('maxPerCustomerInput').disabled = unlimitedPerCustomer;
    
    document.getElementById('priceError').classList.add('hidden');
    document.getElementById('discountPercentage').textContent = '';
    
    document.getElementById('priceInputModal').classList.remove('hidden');
    
    // Focus input
    const input = document.getElementById('flashSalePriceInput');
    setTimeout(() => input.focus(), 100);
}

function closePriceModal() {
    document.getElementById('priceInputModal').classList.add('hidden');
    
    // If product was not added (no price confirmed), uncheck it
    if (currentPriceProduct && !selectedProducts.has(currentPriceProduct.id)) {
        renderAllProducts(); // Re-render to uncheck the checkbox
    }
    
    currentPriceProduct = null;
}

function updateDiscountPercentage() {
    const flashPrice = parseFloat(document.getElementById('flashSalePriceInput').value) || 0;
    const originalPrice = currentPriceProduct.price;
    
    if (flashPrice > 0 && flashPrice < originalPrice) {
        const discount = Math.round((1 - flashPrice / originalPrice) * 100);
        document.getElementById('discountPercentage').textContent = `Giảm ${discount}%`;
        document.getElementById('discountPercentage').className = 'text-sm text-green-600 font-semibold mt-2';
        document.getElementById('priceError').classList.add('hidden');
    } else if (flashPrice >= originalPrice) {
        document.getElementById('discountPercentage').textContent = '';
        document.getElementById('priceError').textContent = 'Giá flash sale phải nhỏ hơn giá gốc';
        document.getElementById('priceError').classList.remove('hidden');
    } else {
        document.getElementById('discountPercentage').textContent = '';
    }
}

function confirmPrice() {
    const flashPrice = parseFloat(document.getElementById('flashSalePriceInput').value);
    const originalPrice = currentPriceProduct.price;
    
    // Validate flash price
    if (!flashPrice || flashPrice <= 0) {
        document.getElementById('priceError').textContent = 'Vui lòng nhập giá flash sale';
        document.getElementById('priceError').classList.remove('hidden');
        return;
    }
    
    if (flashPrice >= originalPrice) {
        document.getElementById('priceError').textContent = 'Giá flash sale phải nhỏ hơn giá gốc';
        document.getElementById('priceError').classList.remove('hidden');
        return;
    }
    
    // Get stock limit
    const unlimitedStock = document.getElementById('unlimitedStockCheckbox').checked;
    const stockLimit = unlimitedStock ? null : parseInt(document.getElementById('stockLimitInput').value) || null;
    
    // Validate stock limit
    if (!unlimitedStock && (stockLimit === null || stockLimit <= 0)) {
        document.getElementById('priceError').textContent = 'Vui lòng nhập số lượng hợp lệ hoặc chọn không giới hạn';
        document.getElementById('priceError').classList.remove('hidden');
        return;
    }
    
    // Get max per customer
    const unlimitedPerCustomer = document.getElementById('unlimitedPerCustomerCheckbox').checked;
    const maxPerCustomer = unlimitedPerCustomer ? null : parseInt(document.getElementById('maxPerCustomerInput').value) || null;
    
    // Validate max per customer
    if (!unlimitedPerCustomer && (maxPerCustomer === null || maxPerCustomer <= 0)) {
        document.getElementById('priceError').textContent = 'Vui lòng nhập giới hạn mỗi khách hàng hợp lệ hoặc chọn không giới hạn';
        document.getElementById('priceError').classList.remove('hidden');
        return;
    }
    
    // Validate: max per customer should not exceed stock limit
    if (stockLimit !== null && maxPerCustomer !== null && maxPerCustomer > stockLimit) {
        document.getElementById('priceError').textContent = 'Giới hạn mỗi khách hàng không được vượt quá tổng số lượng';
        document.getElementById('priceError').classList.remove('hidden');
        return;
    }
    
    // Save all data
    selectedProducts.set(currentPriceProduct.id, {
        product: currentPriceProduct,
        flashPrice: flashPrice,
        stockLimit: stockLimit,
        maxPerCustomer: maxPerCustomer
    });
    
    // Close modal and update UI
    closePriceModal();
    renderAllProducts();
    renderSelectedProducts();
}

// Confirmation Step
function renderConfirmation() {
    const name = document.getElementById('flashSaleName').value;
    const description = document.getElementById('flashSaleDescription').value;
    const startTime = document.getElementById('flashSaleStartTime').value;
    const endTime = document.getElementById('flashSaleEndTime').value;
    const status = document.getElementById('flashSaleStatus').value;
    
    // Update summary
    document.getElementById('confirmName').textContent = name;
    document.getElementById('confirmTime').textContent = `${formatDateTime2(startTime)} → ${formatDateTime2(endTime)}`;
    
    const statusLabels = {
        draft: '<span class="status-badge status-draft">Nháp</span>',
        scheduled: '<span class="status-badge status-scheduled">Đã lên lịch</span>',
        active: '<span class="status-badge status-active">Kích hoạt ngay</span>'
    };
    document.getElementById('confirmStatus').innerHTML = statusLabels[status];
    document.getElementById('confirmProductCount').textContent = `${selectedProducts.size} sản phẩm`;
    
    // Render products list
    const container = document.getElementById('confirmProductsList');
    container.innerHTML = Array.from(selectedProducts.entries()).map(([productId, data], index) => {
        const product = data.product;
        const flashPrice = data.flashPrice;
        const discount = Math.round((1 - flashPrice / product.price) * 100);
        const stockLimit = data.stockLimit;
        const maxPerCustomer = data.maxPerCustomer;
        
        return `
            <div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="font-bold text-orange-600">${index + 1}</span>
                </div>
                <div class="flex-1">
                    <p class="font-semibold text-gray-900 mb-1">${product.name}</p>
                    <div class="flex items-center gap-3 text-sm mb-1">
                        <span class="text-gray-500">Giá gốc: <span class="line-through">${formatCurrency(product.price)}</span></span>
                        <span class="text-orange-600 font-bold">Flash: ${formatCurrency(flashPrice)}</span>
                        <span class="discount-badge">-${discount}%</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-600">
                        <span title="Tổng số lượng" class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            ${stockLimit !== null ? stockLimit + ' sản phẩm' : 'Không giới hạn'}
                        </span>
                        <span title="Giới hạn mỗi khách" class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            ${maxPerCustomer !== null ? 'Tối đa ' + maxPerCustomer + '/người' : 'Không giới hạn'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Submit Flash Sale
async function submitFlashSale() {
    // Validate step 2 before submitting
    if (selectedProducts.size === 0) {
        showToast('Vui lòng chọn ít nhất 1 sản phẩm', 'error');
        return;
    }
    
    // Check all products have flash prices
    for (const [productId, data] of selectedProducts) {
        if (!data.flashPrice || data.flashPrice <= 0) {
            showToast('Vui lòng nhập giá flash sale cho tất cả sản phẩm', 'error');
            return;
        }
    }
    
    try {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-pulse">Đang xử lý...</span>';
        
        // Prepare data
        const name = document.getElementById('flashSaleName').value.trim();
        const description = document.getElementById('flashSaleDescription').value.trim();
        const startTime = Math.floor(new Date(document.getElementById('flashSaleStartTime').value).getTime() / 1000);
        const endTime = Math.floor(new Date(document.getElementById('flashSaleEndTime').value).getTime() / 1000);
        const status = document.getElementById('flashSaleStatus').value;
        
        let flashSaleId;
        
        if (currentEditingFlashSaleId) {
            // UPDATE MODE
            console.log('UPDATE MODE: Editing flash sale ID:', currentEditingFlashSaleId);
            
            const updateResponse = await fetch(`${API_BASE}/api?action=updateFlashSale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: currentEditingFlashSaleId,
                    name,
                    description,
                    start_time: startTime,
                    end_time: endTime,
                    status
                })
            });
            
            const updateData = await updateResponse.json();
            
            if (!updateData.success) {
                throw new Error(updateData.error || 'Không thể cập nhật flash sale');
            }
            
            flashSaleId = currentEditingFlashSaleId;
            
        } else {
            // CREATE MODE
            const flashSaleResponse = await fetch(`${API_BASE}/api?action=createFlashSale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    start_time: startTime,
                    end_time: endTime,
                    status
                })
            });
            
            const flashSaleData = await flashSaleResponse.json();
            
            if (!flashSaleData.success) {
                throw new Error(flashSaleData.error || 'Không thể tạo flash sale');
            }
            
            flashSaleId = flashSaleData.flashSaleId;
        }
        
        // Add products
        const products = Array.from(selectedProducts.entries()).map(([productId, data]) => ({
            product_id: productId,
            flash_price: data.flashPrice,
            original_price: data.product.price,
            stock_limit: data.stockLimit,
            max_per_customer: data.maxPerCustomer
        }));
        
        console.log('Preparing to add products:', products.length, 'products');
        
        let productsData;
        
        if (currentEditingFlashSaleId) {
            // UPDATE MODE: Use transaction-based API (delete + add in one transaction)
            console.log('Using transaction-based update for Turso');
            
            const updateProductsResponse = await fetch(`${API_BASE}/api?action=updateFlashSaleProducts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flashSaleId: flashSaleId,
                    products: products
                })
            });
            
            productsData = await updateProductsResponse.json();
            
            console.log('Transaction response:', productsData);
            
            if (!productsData.success) {
                throw new Error(productsData.error || 'Không thể cập nhật sản phẩm');
            }
            
            console.log(`Transaction complete: deleted ${productsData.deletedCount}, added ${productsData.addedCount}`);
            
        } else {
            // CREATE MODE: Use normal add API
            console.log('Using normal add API for create mode');
            
            const productsResponse = await fetch(`${API_BASE}/api?action=addMultipleProductsToFlashSale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flashSaleId: flashSaleId,
                    products: products
                })
            });
            
            productsData = await productsResponse.json();
            
            console.log('Add products response:', productsData);
            
            if (!productsData.success) {
                throw new Error(productsData.error || 'Không thể thêm sản phẩm');
            }
            
            console.log('Successfully added:', productsData.added, 'products');
            if (productsData.failed > 0) {
                console.warn('Failed:', productsData.failed, 'products');
                console.error('Errors:', productsData.errors);
            }
        }
        
        // Success
        const action = currentEditingFlashSaleId ? 'Cập nhật' : 'Tạo';
        const successCount = currentEditingFlashSaleId ? productsData.addedCount : productsData.added;
        showToast(`✅ ${action} Flash Sale "${name}" thành công với ${successCount} sản phẩm!`, 'success');
        closeCreateFlashSaleModal();
        loadFlashSales();
        
    } catch (error) {
        console.error('Error submitting flash sale:', error);
        showToast('Lỗi: ' + error.message, 'error');
    } finally {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = currentEditingFlashSaleId ? '✓ Cập nhật' : '✓ Tạo Flash Sale';
    }
}

// Helper function for datetime formatting
function formatDateTime2(datetimeLocal) {
    const date = new Date(datetimeLocal);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper function for currency formatting
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Smart price rounding function
function smartRoundPrice(price) {
    // Round to nearest appropriate value for easy payment
    if (price >= 1000000) {
        // >= 1 million: round to nearest 10,000
        return Math.floor(price / 10000) * 10000;
    } else if (price >= 100000) {
        // >= 100k: round to nearest 5,000
        return Math.floor(price / 5000) * 5000;
    } else if (price >= 10000) {
        // >= 10k: round to nearest 1,000
        return Math.floor(price / 1000) * 1000;
    } else if (price >= 1000) {
        // >= 1k: round to nearest 100
        return Math.floor(price / 100) * 100;
    } else {
        // < 1k: round to nearest 50
        return Math.floor(price / 50) * 50;
    }
}

function viewFlashSale(id) {
    const flashSale = flashSales.find(fs => fs.id === id);
    if (!flashSale) return;
    
    // Populate modal
    document.getElementById('viewName').textContent = flashSale.name;
    document.getElementById('viewStatus').innerHTML = getStatusBadge(flashSale.status);
    document.getElementById('viewStartTime').textContent = formatDateTime(flashSale.start_time);
    document.getElementById('viewEndTime').textContent = formatDateTime(flashSale.end_time);
    document.getElementById('viewDescription').textContent = flashSale.description || 'Không có mô tả';
    document.getElementById('viewProductCount').textContent = flashSale.product_count || 0;
    document.getElementById('viewSoldCount').textContent = flashSale.total_sold || 0;
    
    // Load products
    loadFlashSaleProducts(id);
    
    // Show modal
    document.getElementById('viewFlashSaleModal').classList.remove('hidden');
}

async function loadFlashSaleProducts(flashSaleId) {
    try {
        const response = await fetch(`${API_BASE}/api?action=getFlashSaleProducts&flashSaleId=${flashSaleId}`);
        const data = await response.json();
        
        if (data.success && data.products) {
            const products = data.products;
            
            // Calculate average discount
            if (products.length > 0) {
                const avgDiscount = products.reduce((sum, p) => {
                    const discount = Math.round((1 - p.flash_price / p.original_price) * 100);
                    return sum + discount;
                }, 0) / products.length;
                document.getElementById('viewAvgDiscount').textContent = Math.round(avgDiscount) + '%';
            } else {
                document.getElementById('viewAvgDiscount').textContent = '0%';
            }
            
            // Render products
            const container = document.getElementById('viewProductsList');
            if (products.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 py-4">Chưa có sản phẩm nào</p>';
                return;
            }
            
            container.innerHTML = products.map((product, index) => {
                const discount = Math.round((1 - product.flash_price / product.original_price) * 100);
                return `
                    <div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="font-bold text-blue-600 text-sm">${index + 1}</span>
                        </div>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-900 mb-1">${product.product_name}</p>
                            <div class="flex items-center gap-3 text-sm">
                                <span class="text-gray-500">Giá gốc: <span class="line-through">${formatCurrency(product.original_price)}</span></span>
                                <span class="text-orange-600 font-bold">Flash: ${formatCurrency(product.flash_price)}</span>
                                <span class="discount-badge">-${discount}%</span>
                            </div>
                            ${product.quantity_sold > 0 ? `
                                <p class="text-xs text-green-600 font-semibold mt-1">✓ Đã bán: ${product.quantity_sold}</p>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading flash sale products:', error);
        document.getElementById('viewProductsList').innerHTML = '<p class="text-center text-red-500 py-4">Lỗi tải sản phẩm</p>';
    }
}

function closeViewModal() {
    document.getElementById('viewFlashSaleModal').classList.add('hidden');
}

function editFlashSale(id) {
    const flashSale = flashSales.find(fs => fs.id === id);
    if (!flashSale) return;
    
    // Set edit mode
    currentEditingFlashSaleId = id;
    
    // Clear previous products
    selectedProducts.clear();
    
    // Populate form data
    document.getElementById('flashSaleName').value = flashSale.name;
    document.getElementById('flashSaleDescription').value = flashSale.description || '';
    
    // Convert unix timestamp to datetime-local format
    const startDate = new Date(flashSale.start_time * 1000);
    const endDate = new Date(flashSale.end_time * 1000);
    document.getElementById('flashSaleStartTime').value = formatDateTimeLocal(startDate);
    document.getElementById('flashSaleEndTime').value = formatDateTimeLocal(endDate);
    document.getElementById('flashSaleStatus').value = flashSale.status;
    
    // Change modal title
    document.querySelector('#createFlashSaleModal h3').textContent = 'Sửa Flash Sale';
    document.querySelector('#createFlashSaleModal p').textContent = 'Chỉnh sửa thông tin chương trình';
    
    // Show Step 1 modal
    document.getElementById('createFlashSaleModal').classList.remove('hidden');
    showStep(1);
    
    // Load products in background
    loadFlashSaleProductsForEdit(id);
}

async function loadFlashSaleProductsForEdit(flashSaleId) {
    isLoadingProducts = true;
    try {
        const response = await fetch(`${API_BASE}/api?action=getFlashSaleProducts&flashSaleId=${flashSaleId}`);
        const data = await response.json();
        
        if (data.success && data.products) {
            selectedProducts.clear();
            
            data.products.forEach(product => {
                // Find full product data
                const fullProduct = allProducts.find(p => p.id === product.product_id);
                if (fullProduct) {
                    selectedProducts.set(product.product_id, {
                        product: fullProduct,
                        flashPrice: product.flash_price,
                        stockLimit: product.stock_limit,
                        maxPerCustomer: product.max_per_customer
                    });
                }
            });
            
            showToast(`✓ Đã tải ${selectedProducts.size} sản phẩm`, 'success');
        }
    } catch (error) {
        console.error('Error loading flash sale products for edit:', error);
        showToast('Lỗi tải sản phẩm', 'error');
    } finally {
        isLoadingProducts = false;
    }
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function activateFlashSale(id) {
    const flashSale = flashSales.find(fs => fs.id === id);
    if (!flashSale) return;
    
    if (!confirm(`Bạn có chắc muốn kích hoạt Flash Sale "${flashSale.name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api?action=updateFlashSaleStatus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                status: 'active'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Kích hoạt Flash Sale thành công!', 'success');
            loadFlashSales();
        } else {
            showToast('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error activating flash sale:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}

let deleteFlashSaleId = null;

function deleteFlashSale(id) {
    const flashSale = flashSales.find(fs => fs.id === id);
    if (!flashSale) return;
    
    deleteFlashSaleId = id;
    document.getElementById('deleteFlashSaleName').textContent = flashSale.name;
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteConfirmModal').classList.add('hidden');
    deleteFlashSaleId = null;
}

async function confirmDelete() {
    if (!deleteFlashSaleId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api?action=deleteFlashSale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: deleteFlashSaleId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Xóa Flash Sale thành công!', 'success');
            closeDeleteModal();
            loadFlashSales();
        } else {
            showToast('Lỗi: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting flash sale:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}


