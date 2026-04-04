// ============================================
// CONFIGURATION
// ============================================
const LOCAL_API_URL = 'http://127.0.0.1:8787';
const PROD_API_URL = 'https://ctv-api.yendev96.workers.dev';
const API_URL = (window.CONFIG && window.CONFIG.API_URL) || PROD_API_URL;

/**
 * API fetch helper with smart fallback:
 * - If preferred URL is local and connection fails, retry once via Workers.
 */
async function apiFetch(url, options = {}) {
    try {
        return await fetch(url, options);
    } catch (error) {
        const isUsingLocal = url.startsWith(LOCAL_API_URL);
        if (!isUsingLocal) throw error;

        const fallbackUrl = url.replace(LOCAL_API_URL, PROD_API_URL);
        console.warn('⚠️ Local API unavailable, fallback to Workers:', fallbackUrl);
        return fetch(fallbackUrl, options);
    }
}

/** Backdrop modals: Tailwind `hidden` vs `flex` for centering */
function openModalOverlay(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
}
function closeModalOverlay(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
}

// State
let allCategories = [];
let filteredCategories = [];
let currentCategory = null;
let currentStatusFilter = '';

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    setupEventListeners();
});

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterCategories, 300));
    }

    const presetButtons = document.querySelectorAll('.status-preset-btn');
    if (presetButtons.length > 0) {
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                currentStatusFilter = button.dataset.status || '';
                updateStatusPresetUI();
                filterCategories();
            });
        });
    }

    // NOTE:
    // category form already uses inline onsubmit="handleFormSubmit(event)" in categories.html.
    // Avoid attaching another submit listener here to prevent duplicate requests.
}

// ============================================
// API CALLS
// ============================================

async function loadCategories() {
    try {
        showLoading();
        
        const response = await apiFetch(`${API_URL}?action=getAllCategoriesAdmin`);
        const data = await response.json();
        
        if (data.success) {
            allCategories = data.categories || [];
            filteredCategories = [...allCategories];
            const activeOrders = allCategories
                .filter(c => c.is_active)
                .map(c => ({ id: c.id, name: c.name, display_order: c.display_order }))
                .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
            console.log('📋 [categories] active display_order list:', activeOrders);
            updateStats();
            renderCategories();
        } else {
            showError('Không thể tải danh sách danh mục');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showError('Lỗi kết nối đến server');
    }
}

async function saveCategory(categoryData) {
    try {
        const isEdit = !!categoryData.id;
        const action = isEdit ? 'updateCategory' : 'createCategory';
        
        // Add action to the data payload
        const payload = {
            action: action,
            ...categoryData
        };
        console.log('📤 [categories] save payload:', payload);
        
        const response = await apiFetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log('📥 [categories] save response:', data);
        
        if (data.success) {
            showSuccess(isEdit ? 'Cập nhật danh mục thành công!' : 'Tạo danh mục mới thành công!');
            closeCategoryModal();
            loadCategories();
        } else {
            showError(data.error || 'Không thể lưu danh mục');
        }
    } catch (error) {
        console.error('Error saving category:', error);
        showError('Lỗi khi lưu danh mục');
    }
}

async function deleteCategory(id, name) {
    if (!confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) return;
    
    try {
        const response = await apiFetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'deleteCategory',
                id: id 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Xóa danh mục thành công!');
            loadCategories();
        } else {
            showError(data.error || 'Không thể xóa danh mục');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showError('Lỗi khi xóa danh mục');
    }
}

// ============================================
// UI RENDERING
// ============================================

function renderCategories() {
    const tbody = document.getElementById('categoriesTableBody');
    const loadingState = document.getElementById('loadingState');
    const categoriesTable = document.getElementById('categoriesTable');
    const emptyState = document.getElementById('emptyState');
    
    loadingState.classList.add('hidden');
    
    if (filteredCategories.length === 0) {
        categoriesTable.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    categoriesTable.classList.remove('hidden');
    
    const activeOrderedIds = filteredCategories
        .filter(c => c.is_active)
        .map(c => c.id);

    tbody.innerHTML = filteredCategories.map((category) => {
        const isActive = category.is_active;
        const productCount = category.product_count || 0;
        const activeIndex = activeOrderedIds.indexOf(category.id);
        const canMoveUp = isActive && activeIndex > 0;
        const canMoveDown = isActive && activeIndex !== -1 && activeIndex < activeOrderedIds.length - 1;
        
        return `
            <tr class="transition-colors hover:bg-slate-50/80">
                <td class="px-6 py-4">
                    <span class="font-medium text-slate-900">${category.name}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-slate-600">${category.description || '-'}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    ${productCount > 0 ? `
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            ${productCount}
                        </span>
                    ` : `
                        <span class="text-sm text-gray-400">0</span>
                    `}
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        ${category.display_order || 0}
                    </span>
                </td>
                <td class="px-6 py-4 text-center">
                    ${category.is_featured ? `
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Phổ biến
                        </span>
                    ` : `
                        <span class="text-xs text-gray-400">-</span>
                    `}
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">
                        <div class="font-medium text-gray-900">${formatDateTime(category.created_at_unix)}</div>
                        <div class="text-xs text-gray-500">${formatTimeAgo(category.created_at_unix)}</div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    ${getStatusBadge(isActive)}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <div class="flex flex-col items-center gap-1">
                            <!-- Move Up Button -->
                            <button 
                                onclick="moveCategoryUp(${category.id})" 
                                ${!canMoveUp ? 'disabled' : ''} 
                                class="p-1.5 rounded-lg transition-all ${canMoveUp ? 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700' : 'text-gray-300 cursor-not-allowed'}" 
                                title="Di chuyển lên">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                                </svg>
                            </button>
                            
                            <!-- Move Down Button -->
                            <button 
                                onclick="moveCategoryDown(${category.id})" 
                                ${!canMoveDown ? 'disabled' : ''} 
                                class="p-1.5 rounded-lg transition-all ${canMoveDown ? 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700' : 'text-gray-300 cursor-not-allowed'}" 
                                title="Di chuyển xuống">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                                </svg>
                            </button>
                        </div>
                        
                        <!-- Divider -->
                        <div class="w-px h-6 bg-gray-200 mx-1"></div>

                        <!-- Toggle Featured -->
                        <button onclick="toggleFeaturedCategory(${category.id}, ${category.is_featured ? 1 : 0}, '${category.name.replace(/'/g, "\\'")}')" 
                            class="text-amber-600 hover:text-amber-700 transition-colors p-2 hover:bg-amber-50 rounded-lg" 
                            title="${category.is_featured ? 'Tắt nổi bật' : 'Bật nổi bật'}">
                            <svg class="w-5 h-5" fill="${category.is_featured ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </button>
                        
                        <!-- Edit Button -->
                        <button onclick="editCategory(${category.id})" 
                            class="text-indigo-600 hover:text-indigo-700 transition-colors p-2 hover:bg-indigo-50 rounded-lg" 
                            title="Chỉnh sửa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        
                        <!-- Delete Button -->
                        <button onclick="deleteCategory(${category.id}, '${category.name}')" 
                            class="text-red-600 hover:text-red-700 transition-colors p-2 hover:bg-red-50 rounded-lg" 
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
    const activeCount = allCategories.filter(c => c.is_active).length;
    const inactiveCount = allCategories.length - activeCount;
    
    document.getElementById('totalCategories').textContent = allCategories.length;
    document.getElementById('activeCategories').textContent = activeCount;
    document.getElementById('inactiveCategories').textContent = inactiveCount;
}

function getStatusBadge(isActive) {
    if (isActive) {
        return '<span class="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">Hoạt động</span>';
    }
    return '<span class="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80">Tạm dừng</span>';
}

// ============================================
// FILTERING
// ============================================

function filterCategories() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = currentStatusFilter;
    
    filteredCategories = allCategories.filter(category => {
        const matchesSearch = category.name.toLowerCase().includes(searchTerm) ||
                            (category.description && category.description.toLowerCase().includes(searchTerm));
        
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = category.is_active;
        } else if (statusFilter === 'inactive') {
            matchesStatus = !category.is_active;
        }
        
        return matchesSearch && matchesStatus;
    });
    
    renderCategories();
}

function updateStatusPresetUI() {
    const activeCls = ['bg-indigo-600', 'text-white', 'font-semibold', 'shadow-sm', 'shadow-indigo-500/25', 'ring-1', 'ring-indigo-500/30'];
    const inactiveCls = ['border', 'border-slate-100', 'bg-white', 'text-slate-600', 'font-medium', 'hover:bg-slate-50'];
    document.querySelectorAll('.status-preset-btn').forEach(button => {
        const isActive = (button.dataset.status || '') === currentStatusFilter;
        activeCls.forEach(c => button.classList.toggle(c, isActive));
        inactiveCls.forEach(c => button.classList.toggle(c, !isActive));
    });
}

// ============================================
// MODAL MANAGEMENT
// ============================================

function showAddCategoryModal() {
    currentCategory = null;
    document.getElementById('modalTitle').textContent = 'Thêm danh mục mới';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryActive').checked = true;
    document.getElementById('categoryFeatured').checked = false;
    openModalOverlay('categoryModal');
}

function editCategory(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;
    
    currentCategory = category;
    document.getElementById('modalTitle').textContent = 'Chỉnh sửa danh mục';
    
    document.getElementById('categoryId').value = category.id;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryDescription').value = category.description || '';
    document.getElementById('categoryActive').checked = category.is_active;
    document.getElementById('categoryFeatured').checked = !!category.is_featured;
    
    openModalOverlay('categoryModal');
}

function closeCategoryModal() {
    closeModalOverlay('categoryModal');
    currentCategory = null;
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    const categoryData = {
        id: document.getElementById('categoryId').value || undefined,
        name: document.getElementById('categoryName').value,
        description: document.getElementById('categoryDescription').value || null,
        is_active: document.getElementById('categoryActive').checked ? 1 : 0,
        is_featured: document.getElementById('categoryFeatured').checked ? 1 : 0
    };
    
    saveCategory(categoryData);
}

async function toggleFeaturedCategory(id, currentFeatured, name) {
    const nextFeatured = currentFeatured ? 0 : 1;
    const actionText = nextFeatured ? 'bật nổi bật' : 'tắt nổi bật';

    try {
        const response = await apiFetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateCategory',
                id,
                is_featured: nextFeatured
            })
        });

        const data = await response.json();
        if (data.success) {
            showSuccess(`Đã ${actionText} cho danh mục "${name}"`);
            loadCategories();
        } else {
            showError(data.error || `Không thể ${actionText}`);
        }
    } catch (error) {
        console.error('Error toggling featured category:', error);
        showError(`Lỗi khi ${actionText}`);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDateTime(unixTimestamp) {
    if (!unixTimestamp) return '-';
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(unixTimestamp) {
    if (!unixTimestamp) return '-';
    
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixTimestamp;
    
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
    
    return `${Math.floor(diff / 604800)} tuần trước`;
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

function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
}

function showSuccess(message) {
    showToast(message, 'success');
}

function logout() {
    localStorage.removeItem('session_token');
    window.location.href = '../login.html';
}

// ============================================
// CATEGORY REORDERING
// ============================================

async function moveCategoryUp(categoryId) {
    await reorderCategory(categoryId, 'up');
}

async function moveCategoryDown(categoryId) {
    await reorderCategory(categoryId, 'down');
}

async function reorderCategory(categoryId, direction) {
    const category = allCategories.find(c => c.id === categoryId);
    if (!category || !category.is_active) {
        showError('Chỉ có thể di chuyển danh mục đang hoạt động');
        return;
    }
    
    try {
        const payload = {
            action: 'reorderCategories',
            category_id: parseInt(categoryId),
            direction: direction
        };

        // Send request to server (in background)
        const response = await apiFetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const rawResponse = await response.text();
        let data = null;
        try {
            data = JSON.parse(rawResponse);
        } catch (parseError) {
            throw parseError;
        }
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể sắp xếp lại');
        }

        // Always reload from server source of truth (no optimistic reordering)
        await loadCategories();
    } catch (error) {
        console.error('❌ Error reordering category:', error);
        showError(error.message || 'Không thể thay đổi vị trí.');
    }
}
