// Materials Management JavaScript
let allMaterials = [];
let filteredMaterials = [];
let allCategories = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 Materials Management initialized');
    
    // Load data first
    await Promise.all([
        loadCategories(),
        loadMaterials()
    ]);
    
    // Check for outdated products
    await checkOutdatedProducts();
    
    // Then initialize tab from URL
    initializeTabFromURL();
    
    // Listen for hash changes (back/forward browser buttons)
    window.addEventListener('hashchange', handleHashChange);
});

// Initialize tab based on URL hash
function initializeTabFromURL() {
    const hash = window.location.hash.slice(1); // Remove #
    if (hash === 'categories') {
        switchTab('categories');
    } else {
        switchTab('materials');
    }
}

// Handle browser back/forward buttons
function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash === 'categories') {
        switchTab('categories', false); // false = don't update URL again
    } else {
        switchTab('materials', false);
    }
}

// Load all categories
async function loadCategories() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAllMaterialCategories&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            allCategories = data.categories || [];
            console.log('📂 Loaded categories:', allCategories.length);
        }
    } catch (error) {
        console.error('❌ Error loading categories:', error);
    }
}

// Load all materials
async function loadMaterials() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getAllMaterials&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            allMaterials = data.materials || [];
            filteredMaterials = [...allMaterials];

            console.log('📦 Loaded materials:', allMaterials.length);

            renderMaterials();
            updateStats();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load materials');
        }
    } catch (error) {
        console.error('❌ Error loading materials:', error);
        hideLoading();
        showToast('Không thể tải danh sách nguyên liệu', 'error');
    }
}

// Render materials table
function renderMaterials() {
    const tbody = document.getElementById('materialsTableBody');
    const table = document.getElementById('materialsTable');
    const emptyState = document.getElementById('emptyState');

    if (!tbody) return;

    if (filteredMaterials.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    table.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Group materials by category
    const groupedMaterials = {};
    filteredMaterials.forEach(material => {
        const categoryName = material.category_display_name || 'Chưa phân loại';
        if (!groupedMaterials[categoryName]) {
            groupedMaterials[categoryName] = {
                icon: material.category_icon || '📦',
                materials: []
            };
        }
        groupedMaterials[categoryName].materials.push(material);
    });

    // Render grouped materials
    let html = '';
    Object.keys(groupedMaterials).forEach(categoryName => {
        const group = groupedMaterials[categoryName];
        
        // Category header row
        html += `
            <tr class="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-2 border-indigo-200">
                <td colspan="6" class="px-6 py-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                            </svg>
                        </div>
                        <span class="text-lg font-bold text-indigo-900">${categoryName}</span>
                        <span class="text-sm text-indigo-600">(${group.materials.length} nguyên liệu)</span>
                    </div>
                </td>
            </tr>
        `;

        // Materials in this category
        group.materials.forEach(material => {
            html += createMaterialRow(material);
        });
    });

    tbody.innerHTML = html;
}

// Create material row HTML
function createMaterialRow(material) {
    const price = formatCurrency(material.item_cost || 0);
    const productCount = material.product_count || 0;
    const updatedAt = material.updated_at ? new Date(material.updated_at).toLocaleDateString('vi-VN') : '-';
    const displayName = material.display_name || formatMaterialName(material.item_name);

    return `
        <tr class="hover:bg-gray-50 transition-colors group">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mr-3">
                        <svg class="w-5 h-5" viewBox="-10 -66 148 148">
                            <path d="M64-56c35 0 64 29 64 64S99 72 64 72 0 43 0 8s29-64 64-64z" fill="#9333ea"/>
                        </svg>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(displayName)}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(material.item_name)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <code class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono">${escapeHtml(material.item_name)}</code>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-2">
                    <span id="price-${escapeHtml(material.item_name)}" class="text-lg font-bold text-green-600">${price}</span>
                    <button onclick="quickEditPrice('${escapeHtml(material.item_name)}')" 
                        class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                        title="Sửa giá nhanh">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                ${productCount > 0 ? `
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        ${productCount} sản phẩm
                    </span>
                ` : `
                    <span class="text-sm text-gray-400">Chưa dùng</span>
                `}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                ${updatedAt}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editMaterial('${escapeHtml(material.item_name)}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    ${productCount === 0 ? `
                        <button onclick="confirmDeleteMaterial('${escapeHtml(material.item_name)}', '${escapeHtml(displayName)}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    ` : `
                        <button disabled class="p-2 text-gray-300 cursor-not-allowed rounded-lg" title="Không thể xóa (đang được sử dụng)">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `;
}

// Format material name for display
function formatMaterialName(itemName) {
    // Shared material names mapping
    const names = {
        'bi_bac_s999': 'Bi bạc S999',
        'ho_phach_vang': 'Hổ phách vàng',
        'ho_phach_nau': 'Hổ phách nâu',
        'da_do': 'Đá đỏ',
        'da_xanh': 'Đá xanh',
        'day_tron': 'Dây trơn',
        'day_ngu_sac': 'Dây ngũ sắc',
        'day_vang': 'Dây vàng',
        'charm_ran': 'Charm rắn',
        'charm_rong': 'Charm rồng',
        'charm_hoa_sen': 'Charm hoa sen',
        'charm_co_4_la': 'Charm cỏ 4 lá',
        'chuong': 'Chuông',
        'the_ten_tron': 'Thẻ tên tròn',
        'the_hinh_ran': 'Thẻ hình rắn',
        'thanh_gia': 'Thanh giá'
    };
    return names[itemName] || itemName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Update statistics
function updateStats() {
    document.getElementById('totalMaterials').textContent = allMaterials.length;

    if (allMaterials.length > 0) {
        const prices = allMaterials.map(m => m.item_cost || 0);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);

        document.getElementById('avgPrice').textContent = formatCurrency(avgPrice);
        document.getElementById('maxPrice').textContent = formatCurrency(maxPrice);
        document.getElementById('minPrice').textContent = formatCurrency(minPrice);
    } else {
        document.getElementById('avgPrice').textContent = '0đ';
        document.getElementById('maxPrice').textContent = '0đ';
        document.getElementById('minPrice').textContent = '0đ';
    }
}

// Search materials
function searchMaterials() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';

    if (!searchTerm) {
        filteredMaterials = [...allMaterials];
    } else {
        filteredMaterials = allMaterials.filter(material => {
            const displayName = (material.display_name || formatMaterialName(material.item_name)).toLowerCase();
            const itemName = material.item_name.toLowerCase();
            return displayName.includes(searchTerm) || itemName.includes(searchTerm);
        });
    }

    renderMaterials();
}

// Show add material modal
function showAddMaterialModal() {
    const modal = document.createElement('div');
    modal.id = 'materialModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    // Generate category options
    const categoryOptions = allCategories.map(cat => 
        `<option value="${cat.id}">${cat.icon} ${cat.display_name}</option>`
    ).join('');

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-white">Thêm nguyên liệu mới</h3>
                </div>
                <button onclick="closeMaterialModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <form id="materialForm" class="p-6 space-y-4" onsubmit="event.preventDefault(); saveMaterial();">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Loại nguyên liệu <span class="text-red-500">*</span></label>
                    <select id="materialCategory" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">-- Chọn loại --</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị <span class="text-red-500">*</span></label>
                    <input type="text" id="materialDisplayName" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="VD: Bi bạc S999" oninput="document.getElementById('materialItemName').value = vietnameseToSlug(this.value)">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã nguyên liệu <span class="text-red-500">*</span></label>
                    <input type="text" id="materialItemName" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono bg-gray-50" placeholder="VD: bi_bac_s999" pattern="[a-z0-9_]+" title="Chỉ dùng chữ thường, số và dấu gạch dưới" readonly>
                    <p class="text-xs text-gray-500 mt-1">Tự động tạo từ tên hiển thị</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Giá <span class="text-red-500">*</span></label>
                    <div class="relative">
                        <input type="text" id="materialCost" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="15.000" oninput="autoFormatNumberInput(this)" onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                        <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                    </div>
                </div>
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="closeMaterialModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button type="submit" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Lưu</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close material modal
function closeMaterialModal() {
    const modal = document.getElementById('materialModal');
    if (modal) modal.remove();
}

// Save material (create or update)
async function saveMaterial(oldItemName = null) {
    const displayName = document.getElementById('materialDisplayName')?.value.trim();
    const itemName = document.getElementById('materialItemName')?.value.trim().toLowerCase();
    const cost = parseFormattedNumber(document.getElementById('materialCost')?.value);
    const categoryId = document.getElementById('materialCategory')?.value;

    if (!displayName || !itemName || !cost) {
        showToast('Vui lòng điền đầy đủ thông tin', 'warning');
        return;
    }

    if (!oldItemName && !categoryId) {
        showToast('Vui lòng chọn loại nguyên liệu', 'warning');
        return;
    }

    if (cost <= 0) {
        showToast('Giá phải lớn hơn 0', 'warning');
        return;
    }

    if (!/^[a-z0-9_]+$/.test(itemName)) {
        showToast('Mã nguyên liệu chỉ được dùng chữ thường, số và dấu gạch dưới', 'warning');
        return;
    }

    try {
        const action = oldItemName ? 'updateMaterial' : 'createMaterial';
        const payload = { 
            action, 
            item_name: itemName,
            display_name: displayName,
            item_cost: cost,
            category_id: categoryId ? parseInt(categoryId) : null
        };
        if (oldItemName) payload.old_item_name = oldItemName;

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showToast(oldItemName ? 'Đã cập nhật nguyên liệu' : 'Đã thêm nguyên liệu mới', 'success');
            closeMaterialModal();
            await loadMaterials();
            
            if (oldItemName && data.affected_products > 0) {
                showToast(`Đã cập nhật giá vốn cho ${data.affected_products} sản phẩm`, 'info');
            }
            
            if (data.item_name_changed && data.affected_products > 0) {
                showToast(`Đã cập nhật mã nguyên liệu trong ${data.affected_products} công thức sản phẩm`, 'info');
            }
        } else {
            throw new Error(data.error || 'Không thể lưu nguyên liệu');
        }
    } catch (error) {
        console.error('Error saving material:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Edit material
async function editMaterial(itemName) {
    const material = allMaterials.find(m => m.item_name === itemName);
    if (!material) return;

    const modal = document.createElement('div');
    modal.id = 'materialModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    const displayName = material.display_name || formatMaterialName(material.item_name);

    // Generate category options
    const categoryOptions = allCategories.map(cat => 
        `<option value="${cat.id}" ${cat.id === material.category_id ? 'selected' : ''}>${cat.icon} ${cat.display_name}</option>`
    ).join('');

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-white">Chỉnh sửa nguyên liệu</h3>
                </div>
                <button onclick="closeMaterialModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <form id="materialForm" class="p-6 space-y-4" onsubmit="event.preventDefault(); saveMaterial('${escapeHtml(itemName)}');">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Loại nguyên liệu</label>
                    <select id="materialCategory" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">-- Chọn loại --</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị <span class="text-red-500">*</span></label>
                    <input type="text" id="materialDisplayName" value="${escapeHtml(displayName)}" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="VD: Bi bạc S999" oninput="document.getElementById('materialItemName').value = vietnameseToSlug(this.value)">
                    <p class="text-xs text-gray-500 mt-1">Tên này sẽ hiển thị trong danh sách</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã nguyên liệu <span class="text-red-500">*</span></label>
                    <input type="text" id="materialItemName" value="${escapeHtml(material.item_name)}" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono bg-gray-50" pattern="[a-z0-9_]+" title="Chỉ dùng chữ thường, số và dấu gạch dưới" readonly>
                    <p class="text-xs text-gray-500 mt-1">Tự động tạo từ tên hiển thị</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Giá mới <span class="text-red-500">*</span></label>
                    <div class="relative">
                        <input type="text" id="materialCost" required value="${formatNumber(material.item_cost)}" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" oninput="autoFormatNumberInput(this)" onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
                        <span class="absolute right-3 top-2.5 text-gray-500 text-sm">đ</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Giá cũ: ${formatCurrency(material.item_cost)}</p>
                </div>
                ${material.product_count > 0 ? `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div class="flex items-start gap-2">
                            <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <div class="flex-1">
                                <p class="text-sm font-medium text-yellow-800">Cảnh báo</p>
                                <p class="text-xs text-yellow-700 mt-1">
                                    • Thay đổi giá sẽ tự động cập nhật giá vốn cho <strong>${material.product_count} sản phẩm</strong><br>
                                    • Thay đổi mã nguyên liệu sẽ cập nhật tất cả tham chiếu trong công thức sản phẩm
                                </p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="closeMaterialModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button type="submit" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Cập nhật</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
}

// Confirm delete material
function confirmDeleteMaterial(itemName, displayName) {
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="p-6">
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 text-center mb-2">Xóa nguyên liệu?</h3>
                <p class="text-sm text-gray-600 text-center mb-6">Bạn có chắc muốn xóa nguyên liệu <strong>${escapeHtml(displayName)}</strong>? Hành động này không thể hoàn tác.</p>
                <div class="flex gap-3">
                    <button onclick="closeConfirmModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button onclick="deleteMaterial('${escapeHtml(itemName)}')" class="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Xóa</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close confirm modal
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.remove();
}

// Delete material
async function deleteMaterial(itemName) {
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteMaterial', item_name: itemName })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Đã xóa nguyên liệu', 'success');
            closeConfirmModal();
            await loadMaterials();
        } else {
            throw new Error(data.error || 'Không thể xóa nguyên liệu');
        }
    } catch (error) {
        console.error('Error deleting material:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingState')?.classList.remove('hidden');
    document.getElementById('materialsTable')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState')?.classList.add('hidden');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount).replace('₫', 'đ');
}

function formatNumber(num) {
    if (!num) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseFormattedNumber(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/\./g, ''));
}

function autoFormatNumberInput(inputElement) {
    const cursorPosition = inputElement.selectionStart;
    const oldValue = inputElement.value;
    const oldLength = oldValue.length;
    const numericValue = parseFormattedNumber(oldValue);
    const formattedValue = formatNumber(numericValue);
    inputElement.value = formattedValue;
    const newLength = formattedValue.length;
    const lengthDiff = newLength - oldLength;
    const newCursorPosition = cursorPosition + lengthDiff;
    inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Convert Vietnamese text to slug (snake_case without diacritics)
function vietnameseToSlug(str) {
    if (!str) return '';
    
    // Convert to lowercase
    str = str.toLowerCase();
    
    // Remove Vietnamese diacritics
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Replace đ with d
    str = str.replace(/đ/g, 'd');
    
    // Remove special characters, keep only letters, numbers, and spaces
    str = str.replace(/[^a-z0-9\s]/g, '');
    
    // Replace multiple spaces with single space
    str = str.replace(/\s+/g, ' ');
    
    // Trim spaces
    str = str.trim();
    
    // Replace spaces with underscores
    str = str.replace(/\s/g, '_');
    
    return str;
}

// Quick edit price with optimistic UI
async function quickEditPrice(itemName) {
    // Get current price from allMaterials (always up-to-date)
    const material = allMaterials.find(m => m.item_name === itemName);
    if (!material) return;
    
    const currentPrice = material.item_cost;
    const priceElement = document.getElementById(`price-${itemName}`);
    if (!priceElement) return;
    
    // Create inline input with action buttons
    const inputValue = formatNumber(currentPrice);
    
    const escapedItemName = escapeHtml(itemName);
    
    priceElement.parentElement.innerHTML = `
        <div class="flex items-center justify-end gap-2">
            <input type="text" 
                id="quick-edit-${itemName}" 
                value="${inputValue}"
                class="w-32 px-2 py-1 text-right border-2 border-blue-500 rounded text-lg font-bold text-green-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                onkeydown="handleQuickEditKeydown(event, '${escapedItemName}')"
                oninput="autoFormatNumberInput(this)"
                onpaste="setTimeout(() => autoFormatNumberInput(this), 0)">
            <button onclick="saveQuickEdit('${escapedItemName}')" 
                class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                title="Lưu (Enter)">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </button>
            <button onclick="cancelQuickEdit('${escapedItemName}')" 
                class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                title="Hủy (Esc)">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `;
    
    // Focus and select
    const input = document.getElementById(`quick-edit-${itemName}`);
    if (input) {
        input.focus();
        input.select();
    }
}

// Handle keyboard events for quick edit
function handleQuickEditKeydown(event, itemName) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveQuickEdit(itemName);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelQuickEdit(itemName);
    }
}

// Save quick edit with optimistic UI
async function saveQuickEdit(itemName) {
    const input = document.getElementById(`quick-edit-${itemName}`);
    if (!input) return;
    
    const material = allMaterials.find(m => m.item_name === itemName);
    if (!material) return;
    
    const oldPrice = material.item_cost;
    const newPrice = parseFormattedNumber(input.value);
    
    if (!newPrice || newPrice <= 0) {
        showToast('Giá phải lớn hơn 0', 'warning');
        input.focus();
        return;
    }
    
    if (newPrice === oldPrice) {
        cancelQuickEdit(itemName);
        return;
    }
    
    // Optimistic UI: Update immediately with spinner
    const cell = input.closest('td');
    if (cell) {
        cell.innerHTML = `
            <div class="flex items-center justify-end gap-2">
                <span class="text-lg font-bold text-green-600">${formatCurrency(newPrice)}</span>
                <svg class="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        `;
    }
    
    // Update local data immediately (optimistic)
    material.item_cost = newPrice;
    
    try {
        // Send to server
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateMaterial',
                old_item_name: itemName,
                item_name: itemName,
                display_name: material.display_name || formatMaterialName(itemName),
                item_cost: newPrice,
                category_id: material.category_id || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Success: Restore normal view
            if (cell) {
                cell.innerHTML = `
                    <div class="flex items-center justify-end gap-2">
                        <span id="price-${itemName}" class="text-lg font-bold text-green-600">${formatCurrency(newPrice)}</span>
                        <button onclick="quickEditPrice('${escapeHtml(itemName)}')" 
                            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                            title="Sửa giá nhanh">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                `;
            }
            
            // Show success with affected products count
            if (data.affected_products > 0) {
                showToast(`✅ Đã cập nhật giá. ${data.affected_products} sản phẩm bị ảnh hưởng`, 'success');
            } else {
                showToast('✅ Đã cập nhật giá', 'success');
            }
            
            // Update stats
            updateStats();
        } else {
            throw new Error(data.error || 'Không thể cập nhật giá');
        }
    } catch (error) {
        console.error('Error updating price:', error);
        
        // Rollback on error
        material.item_cost = oldPrice;
        if (cell) {
            cell.innerHTML = `
                <div class="flex items-center justify-end gap-2">
                    <span id="price-${itemName}" class="text-lg font-bold text-green-600">${formatCurrency(oldPrice)}</span>
                    <button onclick="quickEditPrice('${escapeHtml(itemName)}')" 
                        class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                        title="Sửa giá nhanh">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
            `;
        }
        
        showToast('❌ Lỗi: ' + error.message, 'error');
    }
}

// Cancel quick edit
function cancelQuickEdit(itemName) {
    const material = allMaterials.find(m => m.item_name === itemName);
    if (!material) {
        console.error('Material not found:', itemName);
        return;
    }
    
    // Find the input element and get its parent cell
    const input = document.getElementById(`quick-edit-${itemName}`);
    if (!input) {
        console.error('Input not found:', itemName);
        return;
    }
    
    const cell = input.closest('td');
    if (!cell) {
        console.error('Cell not found for input:', itemName);
        return;
    }
    
    // Restore original content
    cell.innerHTML = `
        <div class="flex items-center justify-end gap-2">
            <span id="price-${itemName}" class="text-lg font-bold text-green-600">${formatCurrency(material.item_cost)}</span>
            <button onclick="quickEditPrice('${escapeHtml(itemName)}')" 
                class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                title="Sửa giá nhanh">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
            </button>
        </div>
    `;
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '../login.html';
}

// ============================================
// PRICE RECALCULATION
// ============================================

async function recalculateAllPrices() {
    // Show confirmation dialog
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="p-6">
                <div class="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 text-center mb-2">Cập nhật giá sản phẩm?</h3>
                <p class="text-sm text-gray-600 text-center mb-4">
                    Hệ thống sẽ tính lại giá bán cho tất cả sản phẩm dựa trên:
                </p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                    <ul class="text-sm text-blue-800 space-y-2">
                        <li class="flex items-start gap-2">
                            <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span><strong>Giá nguyên liệu hiện tại</strong> (đã cập nhật)</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span><strong>Hệ số markup</strong> đã lưu của từng sản phẩm</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span><strong>Công thức nguyên liệu</strong> của từng sản phẩm</span>
                        </li>
                    </ul>
                </div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <div class="flex items-start gap-2">
                        <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <div class="flex-1">
                            <p class="text-sm font-medium text-yellow-800">Lưu ý</p>
                            <p class="text-xs text-yellow-700 mt-1">
                                • Chỉ cập nhật sản phẩm có <strong>hệ số markup</strong> đã lưu<br>
                                • Sản phẩm không có công thức nguyên liệu sẽ bị bỏ qua<br>
                                • Giá bán sẽ được làm tròn thông minh
                            </p>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3">
                    <button onclick="closeConfirmModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button onclick="executeRecalculateAllPrices()" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all font-medium">Cập nhật ngay</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function executeRecalculateAllPrices() {
    closeConfirmModal();
    
    // Show loading toast with unique ID
    const loadingId = 'recalculate-loading-' + Date.now();
    showToast('Đang tính toán và cập nhật giá...', 'info', 0, loadingId); // 0 = no auto-hide
    
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'recalculateAllPrices' })
        });

        const data = await response.json();

        // Hide loading toast using toastManager
        const loadingToast = toastManager.toasts.find(t => t.id === loadingId);
        if (loadingToast) {
            toastManager.remove(loadingToast);
        }

        if (data.success) {
            const { updated, skipped, total } = data;
            
            // Hide badge after successful update
            const badge = document.getElementById('outdatedProductsBadge');
            if (badge) {
                badge.classList.add('hidden');
            }
            
            // Show detailed success message
            const successModal = document.createElement('div');
            successModal.id = 'resultModal';
            successModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

            successModal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                    <div class="p-6">
                        <div class="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 text-center mb-2">Cập nhật thành công!</h3>
                        <div class="space-y-3 mb-6">
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-green-800">Đã cập nhật</span>
                                    <span class="text-2xl font-bold text-green-600">${updated}</span>
                                </div>
                                <p class="text-xs text-green-700 mt-1">sản phẩm có giá bán mới</p>
                            </div>
                            ${skipped > 0 ? `
                                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm font-medium text-gray-800">Bỏ qua</span>
                                        <span class="text-2xl font-bold text-gray-600">${skipped}</span>
                                    </div>
                                    <p class="text-xs text-gray-700 mt-1">sản phẩm không có markup hoặc công thức</p>
                                </div>
                            ` : ''}
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-blue-800">Tổng số</span>
                                    <span class="text-2xl font-bold text-blue-600">${total}</span>
                                </div>
                                <p class="text-xs text-blue-700 mt-1">sản phẩm trong hệ thống</p>
                            </div>
                        </div>
                        <button onclick="closeResultModal()" class="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Đóng</button>
                    </div>
                </div>
            `;

            document.body.appendChild(successModal);
            
            // Also show a toast
            showToast(`✅ Đã cập nhật giá cho ${updated} sản phẩm`, 'success');
            
        } else {
            throw new Error(data.error || 'Không thể cập nhật giá');
        }
    } catch (error) {
        // Hide loading toast using toastManager
        const loadingToast = toastManager.toasts.find(t => t.id === loadingId);
        if (loadingToast) {
            toastManager.remove(loadingToast);
        }
        
        console.error('❌ Error recalculating prices:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

function closeResultModal() {
    const modal = document.getElementById('resultModal');
    if (modal) modal.remove();
}


// ============================================
// TAB MANAGEMENT
// ============================================

let currentTab = 'materials';

function switchTab(tabName, updateURL = true) {
    currentTab = tabName;
    
    // Update URL hash if needed
    if (updateURL) {
        if (tabName === 'categories') {
            window.history.pushState(null, '', '#categories');
        } else {
            window.history.pushState(null, '', '#materials');
        }
    }
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'border-indigo-600', 'text-indigo-600');
        activeBtn.classList.remove('border-transparent', 'text-gray-500');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeContent = document.getElementById(`content-${tabName}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
    
    // Load data when switching to categories tab
    if (tabName === 'categories') {
        renderCategoriesTab();
    }
}

// ============================================
// CATEGORIES TAB
// ============================================

function renderCategoriesTab() {
    const loadingState = document.getElementById('categoriesLoadingState');
    const categoriesList = document.getElementById('categoriesList');
    const emptyState = document.getElementById('categoriesEmptyState');
    
    console.log('🎨 Rendering categories tab, count:', allCategories.length);
    console.log('Categories data:', allCategories);
    
    if (allCategories.length === 0) {
        loadingState.classList.add('hidden');
        categoriesList.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    categoriesList.classList.remove('hidden');
    
    try {
        categoriesList.innerHTML = allCategories.map((category, index) => createCategoryCard(category, index)).join('');
        console.log('✅ Categories rendered successfully');
    } catch (error) {
        console.error('❌ Error rendering categories:', error);
        categoriesList.innerHTML = `
            <div class="p-12 text-center text-red-600">
                <p class="font-bold">Lỗi khi hiển thị danh mục</p>
                <p class="text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}

function createCategoryCard(category) {
    const canMoveUp = category.sort_order > 1;
    const canMoveDown = category.sort_order < allCategories.length;
    
    return `
        <div class="group relative bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-indigo-300 transition-all duration-300 overflow-hidden">
            <!-- Decorative gradient background -->
            <div class="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-pink-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <!-- Content -->
            <div class="relative flex items-center gap-6">
                <!-- Icon -->
                <div class="flex-shrink-0">
                    <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:shadow-xl group-hover:shadow-indigo-300 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                        </svg>
                    </div>
                </div>
                
                <!-- Column 1: Tên danh mục -->
                <div class="flex-1 min-w-0">
                    <h4 class="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                        ${escapeHtml(category.display_name)}
                    </h4>
                    <p class="text-sm text-gray-600 line-clamp-1 group-hover:text-gray-700 transition-colors">
                        ${escapeHtml(category.description || 'Không có mô tả')}
                    </p>
                </div>
                
                <!-- Column 2: Mã danh mục -->
                <div class="flex-shrink-0 w-32">
                    <div class="text-xs text-gray-500 mb-1 font-medium">Mã danh mục</div>
                    <code class="block px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono border border-gray-200 group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200 transition-colors truncate">
                        ${escapeHtml(category.name)}
                    </code>
                </div>
                
                <!-- Column 3: Số nguyên liệu -->
                <div class="flex-shrink-0 w-28 text-center">
                    <div class="text-xs text-gray-500 mb-1 font-medium">Nguyên liệu</div>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
                        </svg>
                        <span>${category.material_count || 0}</span>
                    </div>
                </div>
                
                <!-- Column 4: Thứ tự -->
                <div class="flex-shrink-0 w-24 text-center">
                    <div class="text-xs text-gray-500 mb-1 font-medium">Thứ tự</div>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-lg text-sm font-semibold border border-purple-200">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clip-rule="evenodd"></path>
                        </svg>
                        <span>${category.sort_order}</span>
                    </div>
                </div>
                
                <!-- Column 5: Actions -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <!-- Move Up -->
                    <button 
                        onclick="moveCategoryUp(${category.id})" 
                        ${!canMoveUp ? 'disabled' : ''} 
                        class="group/btn relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${canMoveUp ? 'bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 hover:shadow-md border border-gray-200 hover:border-indigo-300' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'}" 
                        title="Di chuyển lên"
                    >
                        <svg class="w-5 h-5 transition-transform ${canMoveUp ? 'group-hover/btn:-translate-y-0.5' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    
                    <!-- Move Down -->
                    <button 
                        onclick="moveCategoryDown(${category.id})" 
                        ${!canMoveDown ? 'disabled' : ''} 
                        class="group/btn relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${canMoveDown ? 'bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 hover:shadow-md border border-gray-200 hover:border-indigo-300' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'}" 
                        title="Di chuyển xuống"
                    >
                        <svg class="w-5 h-5 transition-transform ${canMoveDown ? 'group-hover/btn:translate-y-0.5' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    
                    <!-- Divider -->
                    <div class="w-px h-8 bg-gray-200 mx-1"></div>
                    
                    <!-- Edit -->
                    <button 
                        onclick="editCategory(${category.id})" 
                        class="group/btn relative w-10 h-10 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 flex items-center justify-center transition-all duration-200 hover:shadow-md border border-gray-200 hover:border-blue-300" 
                        title="Chỉnh sửa"
                    >
                        <svg class="w-5 h-5 transition-transform group-hover/btn:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    
                    <!-- Delete -->
                    <button 
                        onclick="confirmDeleteCategory(${category.id}, \`${category.display_name.replace(/`/g, '\\`')}\`, ${category.material_count || 0})" 
                        class="group/btn relative w-10 h-10 rounded-xl bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 flex items-center justify-center transition-all duration-200 hover:shadow-md border border-gray-200 hover:border-red-300" 
                        title="Xóa"
                    >
                        <svg class="w-5 h-5 transition-transform group-hover/btn:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// CATEGORY CRUD OPERATIONS
// ============================================

function showAddCategoryModal() {
    const modal = document.createElement('div');
    modal.id = 'categoryModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <h3 class="text-xl font-bold text-white">Thêm danh mục mới</h3>
                <button onclick="closeCategoryModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <form id="categoryForm" class="p-6 space-y-4" onsubmit="event.preventDefault(); saveCategory();">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị <span class="text-red-500">*</span></label>
                    <input type="text" id="categoryDisplayName" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="VD: Đá quý" autofocus oninput="document.getElementById('categoryName').value = vietnameseToSlug(this.value)">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã danh mục <span class="text-red-500">*</span></label>
                    <input type="text" id="categoryName" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono bg-gray-50" placeholder="VD: da_quy" pattern="[a-z0-9_]+" title="Chỉ dùng chữ thường, số và dấu gạch dưới" readonly>
                    <p class="text-xs text-gray-500 mt-1">Tự động tạo từ tên hiển thị</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                    <textarea id="categoryDescription" rows="2" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="VD: Bi bạc, hổ phách, đá đỏ..."></textarea>
                </div>
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="closeCategoryModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button type="submit" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Lưu</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (modal) modal.remove();
}

async function saveCategory(categoryId = null) {
    const displayName = document.getElementById('categoryDisplayName')?.value.trim();
    const name = document.getElementById('categoryName')?.value.trim().toLowerCase();
    const description = document.getElementById('categoryDescription')?.value.trim();

    if (!displayName || !name) {
        showToast('Vui lòng điền đầy đủ thông tin', 'warning');
        return;
    }

    if (!/^[a-z0-9_]+$/.test(name)) {
        showToast('Mã danh mục chỉ được dùng chữ thường, số và dấu gạch dưới', 'warning');
        return;
    }

    try {
        const action = categoryId ? 'updateMaterialCategory' : 'createMaterialCategory';
        const payload = { action, name, display_name: displayName, icon: '📦', description };
        
        if (categoryId) {
            payload.id = categoryId;
            // Lấy old_name từ category hiện tại
            const category = allCategories.find(c => c.id === categoryId);
            if (category) {
                payload.old_name = category.name;
            }
        }

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showToast(categoryId ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục mới', 'success');
            closeCategoryModal();
            await loadCategories();
            renderCategoriesTab();
            // Reload materials to update category display
            await loadMaterials();
        } else {
            throw new Error(data.error || 'Không thể lưu danh mục');
        }
    } catch (error) {
        console.error('Error saving category:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

async function editCategory(categoryId) {
    const category = allCategories.find(c => c.id === categoryId);
    if (!category) return;

    const modal = document.createElement('div');
    modal.id = 'categoryModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <h3 class="text-xl font-bold text-white">Chỉnh sửa danh mục</h3>
                <button onclick="closeCategoryModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <form id="categoryForm" class="p-6 space-y-4" onsubmit="event.preventDefault(); saveCategory(${categoryId});">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị <span class="text-red-500">*</span></label>
                    <input type="text" id="categoryDisplayName" value="${escapeHtml(category.display_name)}" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" autofocus oninput="document.getElementById('categoryName').value = vietnameseToSlug(this.value)">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mã danh mục <span class="text-red-500">*</span></label>
                    <input type="text" id="categoryName" value="${escapeHtml(category.name)}" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono" pattern="[a-z0-9_]+" title="Chỉ dùng chữ thường, số và dấu gạch dưới">
                    <p class="text-xs text-gray-500 mt-1">Có thể chỉnh sửa thủ công (chỉ dùng chữ thường, số và dấu gạch dưới)</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                    <textarea id="categoryDescription" rows="2" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">${escapeHtml(category.description || '')}</textarea>
                </div>
                ${category.material_count > 0 ? `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div class="flex items-start gap-2">
                            <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <div class="flex-1">
                                <p class="text-sm font-medium text-yellow-800">Cảnh báo</p>
                                <p class="text-xs text-yellow-700 mt-1">Danh mục này đang có <strong>${category.material_count} nguyên liệu</strong>. Thay đổi mã danh mục sẽ cập nhật tất cả nguyên liệu trong danh mục này.</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="closeCategoryModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button type="submit" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">Cập nhật</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
}

function confirmDeleteCategory(categoryId, displayName, materialCount) {
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div class="p-6">
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 text-center mb-2">Xóa danh mục?</h3>
                <p class="text-sm text-gray-600 text-center mb-4">Bạn có chắc muốn xóa danh mục <strong>${escapeHtml(displayName)}</strong>?</p>
                ${materialCount > 0 ? `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <div class="flex items-start gap-2">
                            <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <div class="flex-1">
                                <p class="text-sm font-medium text-yellow-800">Lưu ý</p>
                                <p class="text-xs text-yellow-700 mt-1"><strong>${materialCount} nguyên liệu</strong> trong danh mục này sẽ được chuyển về <strong>"Chưa phân loại"</strong>.</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="flex gap-3">
                    <button onclick="closeConfirmModal()" class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                    <button onclick="deleteCategory(${categoryId})" class="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Xóa</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function deleteCategory(categoryId) {
    try {
        console.log('Deleting category with ID:', categoryId, 'Type:', typeof categoryId);
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteMaterialCategory', id: parseInt(categoryId) })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Đã xóa danh mục', 'success');
            
            if (data.moved_materials > 0) {
                showToast(`Đã chuyển ${data.moved_materials} nguyên liệu về "Chưa phân loại"`, 'info');
            }
            
            closeConfirmModal();
            await loadCategories();
            renderCategoriesTab();
            await loadMaterials();
        } else {
            throw new Error(data.error || 'Không thể xóa danh mục');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

async function moveCategoryUp(categoryId) {
    await reorderCategory(categoryId, 'up');
}

async function moveCategoryDown(categoryId) {
    await reorderCategory(categoryId, 'down');
}

async function reorderCategory(categoryId, direction) {
    // Find current category index
    const currentIndex = allCategories.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;
    
    // Calculate target index
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Check bounds
    if (targetIndex < 0 || targetIndex >= allCategories.length) {
        return;
    }
    
    // OPTIMISTIC UPDATE: Swap categories in local array immediately
    const backup = [...allCategories];
    const temp = allCategories[currentIndex];
    allCategories[currentIndex] = allCategories[targetIndex];
    allCategories[targetIndex] = temp;
    
    // Update sort_order values
    allCategories[currentIndex].sort_order = currentIndex + 1;
    allCategories[targetIndex].sort_order = targetIndex + 1;
    
    // Re-render UI immediately (optimistic) with animation
    renderCategoriesTab();
    
    // Add subtle animation feedback
    const movedCard = document.querySelectorAll('.bg-gradient-to-r.from-gray-50')[targetIndex];
    if (movedCard) {
        movedCard.style.transition = 'transform 0.2s ease-out';
        movedCard.style.transform = 'scale(1.02)';
        setTimeout(() => {
            movedCard.style.transform = 'scale(1)';
        }, 200);
    }
    
    try {
        console.log('🔄 Reordering category:', categoryId, 'Direction:', direction);
        
        // Send request to server (in background)
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'reorderMaterialCategories', 
                category_id: parseInt(categoryId),
                direction: direction
            })
        });

        const data = await response.json();

        if (data.success) {
            // Success - silently sync with server (no re-render needed, already updated)
            await loadCategories();
            await loadMaterials();
            console.log('✅ Category reordered and synced with server');
        } else {
            throw new Error(data.error || 'Không thể sắp xếp lại');
        }
    } catch (error) {
        console.error('❌ Error reordering category:', error);
        
        // ROLLBACK: Restore backup on error
        allCategories = backup;
        renderCategoriesTab();
        
        showToast('Không thể thay đổi vị trí. Đã hoàn tác.', 'error');
    }
}


// ============================================
// CHECK OUTDATED PRODUCTS
// ============================================

async function checkOutdatedProducts() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=checkOutdatedProducts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.outdated_count > 0) {
            const badge = document.getElementById('outdatedProductsBadge');
            if (badge) {
                badge.textContent = data.outdated_count;
                badge.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error checking outdated products:', error);
    }
}
