// ============================================
// CONFIGURATION
// ============================================
const API_URL = 'https://ctv-api.yendev96.workers.dev';

// State
let allCategories = [];
let filteredCategories = [];
let currentCategory = null;

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

    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', filterCategories);
    }

    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) {
        categoryForm.addEventListener('submit', handleFormSubmit);
    }
}

// ============================================
// API CALLS
// ============================================

async function loadCategories() {
    try {
        showLoading();
        
        const response = await fetch(`${API_URL}?action=getAllCategories`);
        const data = await response.json();
        
        if (data.success) {
            allCategories = data.categories || [];
            filteredCategories = [...allCategories];
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
        
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData)
        });
        
        const data = await response.json();
        
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
        const response = await fetch(`${API_URL}?action=deleteCategory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
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
    
    tbody.innerHTML = filteredCategories.map(category => {
        const isActive = category.is_active;
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${category.icon || '📁'}</span>
                        <span class="font-medium text-gray-900">${category.name}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-gray-600">${category.description || '-'}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-2xl">${category.icon || '-'}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded border border-gray-300" style="background-color: ${category.color || '#ccc'}"></div>
                        <span class="text-sm text-gray-600">${category.color || '-'}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-gray-600">${category.display_order || 0}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">
                        <div class="font-medium text-gray-900">${formatDateTime(category.created_at_unix)}</div>
                        <div class="text-xs text-gray-500">${formatTimeAgo(category.created_at_unix)}</div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${getStatusBadge(isActive)}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-3">
                        <button onclick="editCategory(${category.id})" 
                            class="text-indigo-600 hover:text-indigo-700 transition-colors" 
                            title="Chỉnh sửa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="deleteCategory(${category.id}, '${category.name}')" 
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
        return '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Hoạt động</span>';
    }
    return '<span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Tạm dừng</span>';
}

// ============================================
// FILTERING
// ============================================

function filterCategories() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    
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

// ============================================
// MODAL MANAGEMENT
// ============================================

function showAddCategoryModal() {
    currentCategory = null;
    document.getElementById('modalTitle').textContent = 'Thêm danh mục mới';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryActive').checked = true;
    document.getElementById('categoryOrder').value = 0;
    document.getElementById('categoryColor').value = '#3b82f6';
    document.getElementById('categoryIcon').value = '📁';
    document.getElementById('categoryModal').classList.remove('hidden');
}

function editCategory(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;
    
    currentCategory = category;
    document.getElementById('modalTitle').textContent = 'Chỉnh sửa danh mục';
    
    document.getElementById('categoryId').value = category.id;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryDescription').value = category.description || '';
    document.getElementById('categoryIcon').value = category.icon || '📁';
    document.getElementById('categoryColor').value = category.color || '#3b82f6';
    document.getElementById('categoryOrder').value = category.display_order || 0;
    document.getElementById('categoryActive').checked = category.is_active;
    
    document.getElementById('categoryModal').classList.remove('hidden');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.add('hidden');
    currentCategory = null;
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    const categoryData = {
        id: document.getElementById('categoryId').value || undefined,
        name: document.getElementById('categoryName').value,
        description: document.getElementById('categoryDescription').value || null,
        icon: document.getElementById('categoryIcon').value || null,
        color: document.getElementById('categoryColor').value || null,
        display_order: parseInt(document.getElementById('categoryOrder').value) || 0,
        is_active: document.getElementById('categoryActive').checked ? 1 : 0
    };
    
    saveCategory(categoryData);
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
    localStorage.removeItem('sessionId');
    window.location.href = '../login.html';
}
