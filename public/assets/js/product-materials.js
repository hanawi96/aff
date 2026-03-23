// Product Materials Formula Management
// Handles material selection and real-time cost calculation

let allMaterialsForProduct = [];
let selectedMaterials = []; // Current formula

// Utility functions (use from window if available, otherwise define fallback)
function getFormatCurrency() {
    return window.formatCurrency || function(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount).replace('₫', 'đ');
    };
}

function getFormatNumber() {
    return window.formatNumber || function(num) {
        if (!num) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };
}

function getEscapeHtml() {
    return window.escapeHtml || function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

function getShowToast() {
    return window.showToast || function(message, type) {
        console.log(`[${type}] ${message}`);
        alert(message);
    };
}

// Load all available materials
async function loadMaterialsForProduct() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAllMaterials&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            allMaterialsForProduct = data.materials || [];
        }
    } catch (error) {
        console.error('Error loading materials:', error);
    }
}

// Load existing formula for product
async function loadProductFormula(productId) {
    if (!productId) {
        selectedMaterials = [];
        renderMaterialsFormula();
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getProductMaterials&product_id=${productId}&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            selectedMaterials = data.materials || [];
            renderMaterialsFormula();
            calculateTotalCost();
        }
    } catch (error) {
        console.error('Error loading product formula:', error);
        selectedMaterials = [];
        renderMaterialsFormula();
    }
}

// Render materials formula UI
function renderMaterialsFormula() {
    const container = document.getElementById('materialsFormulaContainer');
    if (!container) return;

    const formatCurrency = getFormatCurrency();
    const escapeHtml = getEscapeHtml();

    if (selectedMaterials.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <svg class="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p class="text-sm font-medium">Chưa có nguyên liệu nào</p>
                <p class="text-xs mt-1">Nhấn "Thêm nguyên liệu" để bắt đầu</p>
            </div>
        `;
        return;
    }

    // Render in 2 columns grid
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${selectedMaterials.map((material, index) => {
        const materialInfo = allMaterialsForProduct.find(m => m.item_name === material.material_name);
        const unitPrice = materialInfo?.item_cost || 0;
        const subtotal = Math.round(material.quantity || 0) * unitPrice;
        const displayName = materialInfo?.display_name || formatMaterialName(material.material_name);

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-sm transition-all">
                <!-- Header: Number + Name + Delete -->
                <div class="flex items-start gap-2.5 mb-3">
                    <div class="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                        ${index + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-sm text-gray-900 truncate leading-tight">${escapeHtml(displayName)}</h4>
                        <code class="text-[10px] text-gray-400 font-mono leading-tight">${escapeHtml(material.material_name)}</code>
                    </div>
                    <div class="flex items-center gap-0.5 flex-shrink-0">
                        <button type="button" onclick="showReplaceMaterialModal(${index})" 
                            class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Đổi nguyên liệu">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button type="button" onclick="removeMaterial(${index})" 
                            class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Quantity Controls -->
                <div class="mb-2.5">
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Số lượng</label>
                    <div class="flex items-center gap-1.5">
                        <button type="button" 
                            onclick="decrementMaterialQuantity(${index})"
                            class="w-9 h-9 bg-white border border-gray-300 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center group flex-shrink-0">
                            <svg class="w-4 h-4 text-gray-600 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                            </svg>
                        </button>
                        
                        <input type="number" 
                            id="material-qty-${index}"
                            value="${Math.round(material.quantity) || 0}" 
                            min="1" 
                            step="1"
                            onchange="updateMaterialQuantity(${index}, this.value)"
                            class="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-center font-bold">
                        
                        <button type="button" 
                            onclick="incrementMaterialQuantity(${index})"
                            class="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg hover:from-indigo-600 hover:to-purple-700 shadow-sm hover:shadow transition-all flex items-center justify-center flex-shrink-0">
                            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        
                        <input type="text" 
                            value="${escapeHtml(material.unit || 'viên')}" 
                            onchange="updateMaterialUnit(${index}, this.value)"
                            placeholder="viên"
                            class="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-center font-medium">
                    </div>
                </div>
                
                <!-- Total Price -->
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Thành tiền</label>
                            <span class="text-xs text-gray-600">${formatCurrency(unitPrice)} × ${Math.round(material.quantity) || 0}</span>
                        </div>
                        <span class="font-bold text-base text-indigo-600">${formatCurrency(subtotal)}</span>
                    </div>
                </div>
            </div>
        `;
            }).join('')}
        </div>
    `;
}

// Temporary selection in modal (before saving)
let tempSelectedMaterials = [];

// Show add material modal
async function showAddMaterialModal() {
    // Ensure materials are loaded before showing modal
    if (!allMaterialsForProduct || allMaterialsForProduct.length === 0) {
        await loadMaterialsForProduct();
    }
    
    const modal = document.createElement('div');
    modal.id = 'addMaterialModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    const formatCurrency = getFormatCurrency();
    const escapeHtml = getEscapeHtml();

    // Initialize temp selection with current materials
    tempSelectedMaterials = JSON.parse(JSON.stringify(selectedMaterials));
    
    // Auto-select required materials (category_id = 8) ONLY if this is a new product (no existing materials)
    if (selectedMaterials.length === 0) {
        const requiredMaterials = allMaterialsForProduct.filter(m => m.category_id === 8);
        requiredMaterials.forEach(material => {
            tempSelectedMaterials.push({
                material_name: material.item_name,
                quantity: 1,
                unit: 'viên',
                notes: ''
            });
        });

        // Nguyên liệu bắt buộc thêm: Dây đỏ (mã day_do, danh mục dây xỏ / dây)
        const findDefaultRedString = () => {
            const list = allMaterialsForProduct;
            const bySlug = list.find(m => m.item_name === 'day_do');
            if (bySlug) return bySlug;
            return list.find(m => {
                const dn = (m.display_name || '').trim().toLowerCase();
                const cat = ((m.category_display_name || '') + ' ' + (m.category_name || '')).toLowerCase();
                const isDayXo = cat.includes('dây xỏ') || cat.includes('day_xo');
                return dn === 'dây đỏ' || (isDayXo && dn.includes('đỏ'));
            });
        };
        const redString = findDefaultRedString();
        if (redString && !tempSelectedMaterials.some(m => m.material_name === redString.item_name)) {
            tempSelectedMaterials.push({
                material_name: redString.item_name,
                quantity: 1,
                unit: 'sợi',
                notes: ''
            });
        }
    }

    // Filter out already selected materials AND packaging costs (category "Khác")
    // Note: Packaging costs (túi zip, hộp carton, etc.) are managed in Materials page
    // but should NOT appear in product formula selection
    const availableMaterials = allMaterialsForProduct.filter(m => 
        m.category_name !== 'khac' // Lọc bỏ chi phí đóng gói
    );

    // Group by category
    const groupedMaterials = {};
    availableMaterials.forEach(material => {
        const categoryName = material.category_display_name || 'Khác';
        if (!groupedMaterials[categoryName]) {
            groupedMaterials[categoryName] = {
                icon: material.category_icon || '📦',
                materials: []
            };
        }
        groupedMaterials[categoryName].materials.push(material);
    });

    // Generate HTML for grouped materials
    let materialsHTML = '';
    if (Object.keys(groupedMaterials).length === 0) {
        materialsHTML = `
            <div class="text-center py-8 text-gray-400">
                <p class="text-sm font-medium">Không có nguyên liệu nào</p>
            </div>
        `;
    } else {
        Object.keys(groupedMaterials).forEach(categoryName => {
            const group = groupedMaterials[categoryName];
            
            materialsHTML += `
                <div class="mb-4">
                    <div class="flex items-center gap-2 mb-3 px-2">
                        <span class="text-xl">${group.icon}</span>
                        <span class="text-sm font-bold text-gray-700">${escapeHtml(categoryName)}</span>
                        <span class="text-xs text-gray-500">(${group.materials.length})</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        ${group.materials.map(material => {
                            const displayName = material.display_name || formatMaterialName(material.item_name);
                            const isSelected = tempSelectedMaterials.some(m => m.material_name === material.item_name);
                            const selectedMaterial = tempSelectedMaterials.find(m => m.material_name === material.item_name);
                            const quantity = selectedMaterial?.quantity || 1;
                            const subtotal = Math.round(quantity) * material.item_cost;
                            
                            return `
                                <div class="border border-gray-200 rounded-xl overflow-hidden transition-all ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:border-indigo-300'}">
                                    <!-- Material Header -->
                                    <button type="button" 
                                        onclick="toggleMaterialInModal('${escapeHtml(material.item_name)}')" 
                                        class="w-full text-left p-3 transition-all group">
                                        <div class="flex items-center gap-2">
                                            <!-- Checkbox -->
                                            <div class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}">
                                                ${isSelected ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>' : ''}
                                            </div>
                                            
                                            <div class="flex-1 min-w-0">
                                                <h4 class="font-semibold text-sm text-gray-900 truncate ${isSelected ? 'text-indigo-700' : ''}">${escapeHtml(displayName)}</h4>
                                                <div class="flex items-center justify-between gap-2 mt-0.5">
                                                    <p class="text-xs text-gray-500">${formatCurrency(material.item_cost)}</p>
                                                    ${isSelected ? `<p class="text-xs font-bold text-indigo-600" id="subtotal-${escapeHtml(material.item_name)}">${formatCurrency(subtotal)}</p>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    
                                    <!-- Quantity Controls (show only if selected) -->
                                    <div id="qty-controls-${escapeHtml(material.item_name)}" class="${isSelected ? '' : 'hidden'} border-t border-gray-200 p-2 bg-white">
                                        <div class="flex items-center gap-1.5">
                                            <button type="button" 
                                                onclick="decrementTempQuantity('${escapeHtml(material.item_name)}')"
                                                class="flex-1 h-8 bg-white border border-gray-300 rounded-lg hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center justify-center">
                                                <svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                                                </svg>
                                            </button>
                                            
                                            <input type="number" 
                                                id="temp-qty-${escapeHtml(material.item_name)}"
                                                value="${Math.round(quantity)}" 
                                                min="1" 
                                                step="1"
                                                onchange="updateTempQuantity('${escapeHtml(material.item_name)}', this.value)"
                                                class="w-16 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-center font-semibold">
                                            
                                            <button type="button" 
                                                onclick="incrementTempQuantity('${escapeHtml(material.item_name)}')"
                                                class="flex-1 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center">
                                                <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                                </svg>
                                            </button>
                                            
                                            <input type="text" 
                                                id="temp-unit-${escapeHtml(material.item_name)}"
                                                value="${escapeHtml(selectedMaterial?.unit || 'viên')}" 
                                                onchange="updateTempUnit('${escapeHtml(material.item_name)}', this.value)"
                                                placeholder="viên"
                                                class="w-14 px-1.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-[10px] text-center">
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
    }

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[70vh] overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-white">Chọn nguyên liệu</h3>
                        <p class="text-xs text-white/80" id="selectedCountText">Đã chọn: ${tempSelectedMaterials.length} nguyên liệu</p>
                    </div>
                </div>
                <button onclick="closeAddMaterialModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1">
                ${materialsHTML}
            </div>
            
            <!-- Footer with Save button -->
            <div class="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                <div class="text-sm text-gray-600">
                    <span id="selectedCountFooter" class="font-semibold text-indigo-600">${tempSelectedMaterials.length}</span> nguyên liệu đã chọn
                </div>
                <div class="flex gap-3">
                    <button type="button" onclick="closeAddMaterialModal()"
                        class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Hủy
                    </button>
                    <button type="button" onclick="saveTempMaterials()"
                        class="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Lưu nguyên liệu
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close add material modal
function closeAddMaterialModal() {
    const modal = document.getElementById('addMaterialModal');
    if (modal) modal.remove();
    tempSelectedMaterials = [];
}

/** Index của dòng đang đổi nguyên liệu (modal thay thế) */
let replaceMaterialTargetIndex = null;

function closeReplaceMaterialModal() {
    const modal = document.getElementById('replaceMaterialModal');
    if (modal) modal.remove();
    replaceMaterialTargetIndex = null;
}

/**
 * Mở modal chọn nguyên liệu thay thế (giữ số lượng & đơn vị hiện tại).
 */
async function showReplaceMaterialModal(index) {
    if (!allMaterialsForProduct || allMaterialsForProduct.length === 0) {
        await loadMaterialsForProduct();
    }

    const current = selectedMaterials[index];
    if (!current) return;

    const addModal = document.getElementById('addMaterialModal');
    if (addModal) addModal.remove();

    replaceMaterialTargetIndex = index;

    const formatCurrency = getFormatCurrency();
    const escapeHtml = getEscapeHtml();
    const currentInfo = allMaterialsForProduct.find(m => m.item_name === current.material_name);
    const currentLabel = currentInfo?.display_name || formatMaterialName(current.material_name);

    const otherNames = new Set(
        selectedMaterials.map((m, i) => (i !== index ? m.material_name : null)).filter(Boolean)
    );

    const availableMaterials = allMaterialsForProduct.filter(m => m.category_name !== 'khac');

    const groupedMaterials = {};
    availableMaterials.forEach(material => {
        const categoryName = material.category_display_name || 'Khác';
        if (!groupedMaterials[categoryName]) {
            groupedMaterials[categoryName] = {
                icon: material.category_icon || '📦',
                materials: []
            };
        }
        groupedMaterials[categoryName].materials.push(material);
    });

    let materialsHTML = '';
    if (Object.keys(groupedMaterials).length === 0) {
        materialsHTML = `
            <div class="text-center py-8 text-gray-400">
                <p class="text-sm font-medium">Không có nguyên liệu nào</p>
            </div>
        `;
    } else {
        Object.keys(groupedMaterials).forEach(categoryName => {
            const group = groupedMaterials[categoryName];

            materialsHTML += `
                <div class="mb-4">
                    <div class="flex items-center gap-2 mb-3 px-2">
                        <span class="text-xl">${group.icon}</span>
                        <span class="text-sm font-bold text-gray-700">${escapeHtml(categoryName)}</span>
                        <span class="text-xs text-gray-500">(${group.materials.length})</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        ${group.materials.map(material => {
                            const displayName = material.display_name || formatMaterialName(material.item_name);
                            const isCurrent = material.item_name === current.material_name;
                            const isBlocked = otherNames.has(material.item_name);
                            const dataItemName = encodeURIComponent(material.item_name);

                            if (isBlocked) {
                                return `
                                    <div class="border border-gray-200 rounded-xl p-3 opacity-50 cursor-not-allowed bg-gray-50" title="Đã dùng ở dòng khác trong công thức">
                                        <div class="flex items-start gap-2">
                                            <div class="w-5 h-5 rounded border-2 border-gray-200 flex-shrink-0 mt-0.5"></div>
                                            <div class="min-w-0 flex-1">
                                                <h4 class="font-semibold text-sm text-gray-500 truncate">${escapeHtml(displayName)}</h4>
                                                <p class="text-xs text-gray-400 mt-0.5">${formatCurrency(material.item_cost)}</p>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }

                            return `
                                <button type="button"
                                    data-replace-material="${dataItemName}"
                                    class="border border-gray-200 rounded-xl overflow-hidden text-left p-3 transition-all hover:border-indigo-400 hover:shadow-sm ${isCurrent ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:bg-indigo-50/50'}">
                                    <div class="flex items-start gap-2">
                                        <div class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isCurrent ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}">
                                            ${isCurrent ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>' : ''}
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <h4 class="font-semibold text-sm text-gray-900 truncate ${isCurrent ? 'text-indigo-800' : ''}">${escapeHtml(displayName)}</h4>
                                            <p class="text-xs text-gray-500 mt-0.5">${formatCurrency(material.item_cost)}</p>
                                            ${isCurrent ? '<p class="text-[10px] text-indigo-600 font-medium mt-1">Đang dùng</p>' : ''}
                                        </div>
                                    </div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
    }

    const modal = document.createElement('div');
    modal.id = 'replaceMaterialModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[75vh] overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-white">Đổi nguyên liệu</h3>
                        <p class="text-xs text-white/90 mt-0.5">Đang thay: <span class="font-semibold">${escapeHtml(currentLabel)}</span> — giữ nguyên số lượng &amp; đơn vị</p>
                    </div>
                </div>
                <button type="button" onclick="closeReplaceMaterialModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
                ${materialsHTML}
            </div>
            <div class="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
                <button type="button" onclick="closeReplaceMaterialModal()"
                    class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-replace-material]');
        if (!btn || !modal.contains(btn)) return;
        e.preventDefault();
        const enc = btn.getAttribute('data-replace-material');
        if (enc == null || enc === '') return;
        try {
            applyReplaceMaterial(decodeURIComponent(enc));
        } catch (err) {
            console.error('replace material click:', err);
            getShowToast()('Không thể áp dụng nguyên liệu đã chọn', 'error');
        }
    });
}

function applyReplaceMaterial(newItemName) {
    const showToast = getShowToast();
    const idx = replaceMaterialTargetIndex;
    if (idx === null || idx === undefined) return;

    const current = selectedMaterials[idx];
    if (!current) {
        closeReplaceMaterialModal();
        return;
    }

    if (newItemName === current.material_name) {
        closeReplaceMaterialModal();
        return;
    }

    const otherNames = new Set(
        selectedMaterials.map((m, i) => (i !== idx ? m.material_name : null)).filter(Boolean)
    );
    if (otherNames.has(newItemName)) {
        showToast('Nguyên liệu này đã có trong công thức (dòng khác). Chọn nguyên liệu khác.', 'warning');
        return;
    }

    const newInfo = allMaterialsForProduct.find(m => m.item_name === newItemName);
    if (!newInfo) {
        showToast('Không tìm thấy nguyên liệu', 'error');
        return;
    }

    selectedMaterials[idx] = {
        material_name: newItemName,
        quantity: current.quantity,
        unit: current.unit,
        notes: current.notes || ''
    };

    if (isDayXoCategoryMaterial(newInfo)) {
        const dayXoSet = new Set(getDayXoMaterialItemNames());
        selectedMaterials = selectedMaterials.filter(m => {
            if (!dayXoSet.has(m.material_name)) return true;
            return m.material_name === newItemName;
        });
    }

    closeReplaceMaterialModal();
    renderMaterialsFormula();
    calculateTotalCost();

    const displayName = newInfo.display_name || formatMaterialName(newItemName);
    showToast(`Đã đổi thành ${displayName}`, 'success');
}

/** Danh mục "dây xỏ": chỉ được chọn tối đa 1 nguyên liệu (radio-style). */
function isDayXoCategoryMaterial(material) {
    if (!material) return false;
    const slug = (material.category_name || '').toLowerCase();
    const label = (material.category_display_name || '').toLowerCase();
    return slug === 'day_xo' || label.includes('dây xỏ') || label.includes('day xo');
}

function getDayXoMaterialItemNames() {
    return allMaterialsForProduct
        .filter(m => isDayXoCategoryMaterial(m))
        .map(m => m.item_name);
}

// Toggle material selection in modal
function toggleMaterialInModal(materialName) {
    const index = tempSelectedMaterials.findIndex(m => m.material_name === materialName);
    const materialInfo = allMaterialsForProduct.find(m => m.item_name === materialName);
    const isDayXo = materialInfo && isDayXoCategoryMaterial(materialInfo);
    const dayXoNames = isDayXo ? getDayXoMaterialItemNames() : [];

    if (index >= 0) {
        tempSelectedMaterials.splice(index, 1);
        updateModalSelectionUI(materialName);
    } else {
        if (isDayXo && dayXoNames.length > 0) {
            const dayXoSet = new Set(dayXoNames);
            tempSelectedMaterials = tempSelectedMaterials.filter(m => !dayXoSet.has(m.material_name));
        }
        tempSelectedMaterials.push({
            material_name: materialName,
            quantity: 1,
            unit: 'viên',
            notes: ''
        });
        if (isDayXo && dayXoNames.length > 0) {
            dayXoNames.forEach(name => updateModalSelectionUI(name));
        } else {
            updateModalSelectionUI(materialName);
        }
    }

    updateSelectedCount();
}

// Update modal UI when selection changes
function updateModalSelectionUI(materialName) {
    const formatCurrency = getFormatCurrency();
    const isSelected = tempSelectedMaterials.some(m => m.material_name === materialName);
    const qtyControls = document.getElementById(`qty-controls-${materialName}`);
    const card = qtyControls?.closest('.border');
    
    if (card) {
        const checkbox = card.querySelector('.w-5.h-5.rounded');
        const title = card.querySelector('h4');
        const priceContainer = card.querySelector('.flex.items-center.justify-between.gap-2');
        
        if (isSelected) {
            // Update card styling
            card.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50');
            card.classList.remove('hover:border-indigo-300');
            
            // Update checkbox
            if (checkbox) {
                checkbox.classList.add('bg-indigo-600', 'border-indigo-600');
                checkbox.classList.remove('border-gray-300');
                checkbox.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
            }
            
            // Update title color
            if (title) {
                title.classList.add('text-indigo-700');
            }
            
            // Add subtotal display
            if (priceContainer) {
                const material = tempSelectedMaterials.find(m => m.material_name === materialName);
                const materialInfo = allMaterialsForProduct.find(m => m.item_name === materialName);
                if (material && materialInfo) {
                    const subtotal = Math.round(material.quantity) * materialInfo.item_cost;
                    const subtotalHTML = `<p class="text-xs font-bold text-indigo-600" id="subtotal-${materialName}">${formatCurrency(subtotal)}</p>`;
                    if (!priceContainer.querySelector(`#subtotal-${materialName}`)) {
                        priceContainer.insertAdjacentHTML('beforeend', subtotalHTML);
                    }
                }
            }
            
            // Show quantity controls
            if (qtyControls) qtyControls.classList.remove('hidden');
        } else {
            // Update card styling
            card.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50');
            card.classList.add('hover:border-indigo-300');
            
            // Update checkbox
            if (checkbox) {
                checkbox.classList.remove('bg-indigo-600', 'border-indigo-600');
                checkbox.classList.add('border-gray-300');
                checkbox.innerHTML = '';
            }
            
            // Update title color
            if (title) {
                title.classList.remove('text-indigo-700');
            }
            
            // Remove subtotal display
            if (priceContainer) {
                const subtotalElement = priceContainer.querySelector(`#subtotal-${materialName}`);
                if (subtotalElement) {
                    subtotalElement.remove();
                }
            }
            
            // Hide quantity controls
            if (qtyControls) qtyControls.classList.add('hidden');
        }
    }
}

// Update selected count display
function updateSelectedCount() {
    const countText = document.getElementById('selectedCountText');
    const countFooter = document.getElementById('selectedCountFooter');
    
    if (countText) {
        countText.textContent = `Đã chọn: ${tempSelectedMaterials.length} nguyên liệu`;
    }
    if (countFooter) {
        countFooter.textContent = tempSelectedMaterials.length;
    }
}

// Update temp quantity
function updateTempQuantity(materialName, quantity) {
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    if (material) {
        material.quantity = Math.max(1, Math.round(parseFloat(quantity))) || 1;
        updateTempSubtotal(materialName);
    }
}

// Increment temp quantity
function incrementTempQuantity(materialName) {
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    if (material) {
        material.quantity = Math.round(parseFloat(material.quantity) || 0) + 1;
        const input = document.getElementById(`temp-qty-${materialName}`);
        if (input) input.value = material.quantity;
        updateTempSubtotal(materialName);
    }
}

// Decrement temp quantity
function decrementTempQuantity(materialName) {
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    if (material) {
        material.quantity = Math.max(1, Math.round(parseFloat(material.quantity) || 1) - 1);
        const input = document.getElementById(`temp-qty-${materialName}`);
        if (input) input.value = material.quantity;
        updateTempSubtotal(materialName);
    }
}

// Update subtotal display in modal
function updateTempSubtotal(materialName) {
    const formatCurrency = getFormatCurrency();
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    const materialInfo = allMaterialsForProduct.find(m => m.item_name === materialName);
    
    if (material && materialInfo) {
        const subtotal = Math.round(material.quantity) * materialInfo.item_cost;
        const subtotalElement = document.getElementById(`subtotal-${materialName}`);
        if (subtotalElement) {
            subtotalElement.textContent = formatCurrency(subtotal);
        }
    }
}

// Update temp unit
function updateTempUnit(materialName, unit) {
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    if (material) {
        material.unit = unit;
    }
}

/** Giữ tối đa 1 dòng thuộc danh mục dây xỏ (bản ghi cuối trong danh sách được giữ). */
function dedupeDayXoInMaterialList(list) {
    const dayXoNames = getDayXoMaterialItemNames();
    if (dayXoNames.length === 0) return list;
    const set = new Set(dayXoNames);
    let lastIdx = -1;
    for (let i = list.length - 1; i >= 0; i--) {
        if (set.has(list[i].material_name)) {
            lastIdx = i;
            break;
        }
    }
    if (lastIdx < 0) return list;
    const keepName = list[lastIdx].material_name;
    return list.filter(m => !set.has(m.material_name) || m.material_name === keepName);
}

// Save temp materials to actual selection
function saveTempMaterials() {
    const showToast = getShowToast();

    tempSelectedMaterials = dedupeDayXoInMaterialList(tempSelectedMaterials);
    selectedMaterials = JSON.parse(JSON.stringify(tempSelectedMaterials));
    
    closeAddMaterialModal();
    renderMaterialsFormula();
    calculateTotalCost();
    
    showToast(`✅ Đã thêm ${selectedMaterials.length} nguyên liệu`, 'success');
}

// Remove material from formula
function removeMaterial(index) {
    const material = selectedMaterials[index];
    const showToast = getShowToast();
    
    const materialInfo = allMaterialsForProduct.find(m => m.item_name === material.material_name);
    const displayName = materialInfo?.display_name || formatMaterialName(material.material_name);
    
    selectedMaterials.splice(index, 1);
    renderMaterialsFormula();
    calculateTotalCost();
    showToast(`Đã xóa ${displayName}`, 'info');
}

// Update material quantity
function updateMaterialQuantity(index, quantity) {
    selectedMaterials[index].quantity = Math.max(1, Math.round(parseFloat(quantity))) || 1;
    renderMaterialsFormula();
    calculateTotalCost();
}

// Increment material quantity
function incrementMaterialQuantity(index) {
    selectedMaterials[index].quantity = Math.round(parseFloat(selectedMaterials[index].quantity) || 0) + 1;
    renderMaterialsFormula();
    calculateTotalCost();
}

// Decrement material quantity
function decrementMaterialQuantity(index) {
    selectedMaterials[index].quantity = Math.max(1, Math.round(parseFloat(selectedMaterials[index].quantity) || 1) - 1);
    renderMaterialsFormula();
    calculateTotalCost();
}

// Update material unit
function updateMaterialUnit(index, unit) {
    selectedMaterials[index].unit = unit;
}

// Calculate total cost and update cost_price field
function calculateTotalCost() {
    const formatCurrency = getFormatCurrency();
    const formatNumber = getFormatNumber();
    let total = 0;
    
    for (const material of selectedMaterials) {
        const materialInfo = allMaterialsForProduct.find(m => m.item_name === material.material_name);
        if (materialInfo) {
            total += Math.round(material.quantity || 0) * materialInfo.item_cost;
        }
    }

    // Update the display
    const totalDisplay = document.getElementById('materialsTotalCost');
    if (totalDisplay) {
        totalDisplay.textContent = formatCurrency(total);
    }

    // Auto-sync to cost_price field
    const costPriceInput = document.getElementById('productCostPrice');
    if (costPriceInput && selectedMaterials.length > 0) {
        costPriceInput.value = formatNumber(total);
        costPriceInput.readOnly = true;
        costPriceInput.classList.add('bg-purple-50', 'border-purple-300');
        
        // Trigger selling price update based on markup (if auto-pricing is enabled)
        if (typeof updateSellingPriceFromMarkup === 'function') {
            updateSellingPriceFromMarkup();
        }
        
        // Trigger profit calculation
        if (typeof calculateExpectedProfit === 'function') {
            calculateExpectedProfit();
        }
    } else if (costPriceInput) {
        costPriceInput.readOnly = false;
        costPriceInput.classList.remove('bg-purple-50', 'border-purple-300');
    }

    return total;
}

// Save product materials formula
async function saveProductMaterialsFormula(productId) {
    const showToast = getShowToast();
    
    if (!productId || productId === 'undefined' || productId === 'null') {
        console.error('Invalid productId:', productId);
        showToast('Lỗi: ID sản phẩm không hợp lệ', 'error');
        return false;
    }
    
    if (selectedMaterials.length === 0) {
        return true;
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveProductMaterials',
                product_id: parseInt(productId),
                materials: selectedMaterials
            })
        });

        const data = await response.json();
        
        if (data.success) {
            return true;
        } else {
            throw new Error(data.error || 'Failed to save formula');
        }
    } catch (error) {
        console.error('Error saving formula:', error);
        showToast('Lỗi khi lưu công thức: ' + error.message, 'error');
        return false;
    }
}

// Format material name for display
function formatMaterialName(itemName) {
    // Shared material names mapping
    const MATERIAL_NAMES = {
        'bi_bac_s999': 'Bi bạc S999',
        'ho_phach_vang': 'Hổ phách vàng',
        'ho_phach_nau': 'Hổ phách nâu',
        'da_do': 'Đá đỏ',
        'da_xanh': 'Đá xanh',
        'day_tron': 'Dây trơn',
        'day_ngu_sac': 'Dây ngũ sắc',
        'day_vang': 'Dây vàng',
        'day_do': 'Dây đỏ',
        'day_cuoc': 'Dây cước',
        'charm_ran': 'Charm rắn',
        'charm_rong': 'Charm rồng',
        'charm_hoa_sen': 'Charm hoa sen',
        'charm_co_4_la': 'Charm cỏ 4 lá',
        'chuong': 'Chuông',
        'the_ten_tron': 'Thẻ tên tròn',
        'the_hinh_ran': 'Thẻ hình rắn',
        'thanh_gia': 'Thanh giá'
    };
    
    // Use mapping or auto-format
    return MATERIAL_NAMES[itemName] || 
           itemName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Export to window for use in products.js
window.loadProductFormula = loadProductFormula;
window.showAddMaterialModal = showAddMaterialModal;
window.closeAddMaterialModal = closeAddMaterialModal;
window.showReplaceMaterialModal = showReplaceMaterialModal;
window.closeReplaceMaterialModal = closeReplaceMaterialModal;
window.applyReplaceMaterial = applyReplaceMaterial;
window.toggleMaterialInModal = toggleMaterialInModal;
window.updateTempQuantity = updateTempQuantity;
window.incrementTempQuantity = incrementTempQuantity;
window.decrementTempQuantity = decrementTempQuantity;
window.updateTempUnit = updateTempUnit;
window.updateTempSubtotal = updateTempSubtotal;
window.saveTempMaterials = saveTempMaterials;
window.removeMaterial = removeMaterial;
window.updateMaterialQuantity = updateMaterialQuantity;
window.incrementMaterialQuantity = incrementMaterialQuantity;
window.decrementMaterialQuantity = decrementMaterialQuantity;
window.updateMaterialUnit = updateMaterialUnit;
window.calculateTotalCost = calculateTotalCost;
window.saveProductMaterialsFormula = saveProductMaterialsFormula;
window.formatMaterialName = formatMaterialName;

// Export selectedMaterials getter
window.getSelectedMaterials = function() {
    return selectedMaterials;
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadMaterialsForProduct();
});
