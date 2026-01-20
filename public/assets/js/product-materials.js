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
            console.log('📦 Loaded materials for product:', allMaterialsForProduct.length);
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
            console.log('📝 Loaded formula:', selectedMaterials.length, 'materials');
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
    const formatNumber = getFormatNumber();
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

    container.innerHTML = selectedMaterials.map((material, index) => {
        const materialInfo = allMaterialsForProduct.find(m => m.item_name === material.material_name);
        const unitPrice = materialInfo?.item_cost || 0;
        const subtotal = (material.quantity || 0) * unitPrice;
        const displayName = materialInfo?.display_name || formatMaterialName(material.material_name);

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-sm transition-all">
                <!-- Header: Name + Delete -->
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            ${index + 1}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-sm text-gray-900 truncate">${escapeHtml(displayName)}</h4>
                            <code class="text-[10px] text-gray-400 font-mono">${escapeHtml(material.material_name)}</code>
                        </div>
                    </div>
                    <button type="button" onclick="removeMaterial(${index})" 
                        class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0" title="Xóa">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
                
                <!-- Controls: Quantity + Total -->
                <div class="grid grid-cols-2 gap-2">
                    <!-- Quantity Controls -->
                    <div>
                        <label class="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Số lượng</label>
                        <div class="flex items-center gap-1">
                            <button type="button" 
                                onclick="decrementMaterialQuantity(${index})"
                                class="w-8 h-8 bg-white border border-gray-300 rounded-lg hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center justify-center group flex-shrink-0">
                                <svg class="w-4 h-4 text-gray-600 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                                </svg>
                            </button>
                            
                            <input type="number" 
                                id="material-qty-${index}"
                                value="${material.quantity || 0}" 
                                min="0" 
                                step="0.1"
                                onchange="updateMaterialQuantity(${index}, this.value)"
                                class="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-center font-semibold">
                            
                            <button type="button" 
                                onclick="incrementMaterialQuantity(${index})"
                                class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center group flex-shrink-0">
                                <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            
                            <input type="text" 
                                value="${escapeHtml(material.unit || 'viên')}" 
                                onchange="updateMaterialUnit(${index}, this.value)"
                                placeholder="viên"
                                class="w-12 px-1.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-[10px] text-center flex-shrink-0">
                        </div>
                    </div>
                    
                    <!-- Total -->
                    <div>
                        <label class="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Thành tiền</label>
                        <div class="bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 h-8 flex items-center justify-between">
                            <span class="text-xs text-gray-600">${formatCurrency(unitPrice)} × ${material.quantity || 0}</span>
                            <span class="font-bold text-sm text-indigo-600">${formatCurrency(subtotal)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Temporary selection in modal (before saving)
let tempSelectedMaterials = [];

// Show add material modal
function showAddMaterialModal() {
    const modal = document.createElement('div');
    modal.id = 'addMaterialModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4';

    const formatCurrency = getFormatCurrency();
    const escapeHtml = getEscapeHtml();

    // Initialize temp selection with current materials
    tempSelectedMaterials = JSON.parse(JSON.stringify(selectedMaterials));

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
        } else {
            // Update icon if current material has one and group doesn't
            if (material.category_icon && !groupedMaterials[categoryName].icon) {
                groupedMaterials[categoryName].icon = material.category_icon;
            }
        }
        groupedMaterials[categoryName].materials.push(material);
    });

    console.log('🔍 Grouped materials:', groupedMaterials);

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
                            const subtotal = quantity * material.item_cost;
                            
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
                                                value="${quantity}" 
                                                min="0.1" 
                                                step="0.1"
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

// Toggle material selection in modal
function toggleMaterialInModal(materialName) {
    const index = tempSelectedMaterials.findIndex(m => m.material_name === materialName);
    
    if (index >= 0) {
        // Deselect
        tempSelectedMaterials.splice(index, 1);
    } else {
        // Select with default quantity
        tempSelectedMaterials.push({
            material_name: materialName,
            quantity: 1,
            unit: 'viên',
            notes: ''
        });
    }
    
    // Update UI
    updateModalSelectionUI(materialName);
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
                    const subtotal = material.quantity * materialInfo.item_cost;
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
        material.quantity = parseFloat(quantity) || 0.1;
        updateTempSubtotal(materialName);
    }
}

// Increment temp quantity
function incrementTempQuantity(materialName) {
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    if (material) {
        material.quantity = (parseFloat(material.quantity) || 0) + 1;
        const input = document.getElementById(`temp-qty-${materialName}`);
        if (input) input.value = material.quantity;
        updateTempSubtotal(materialName);
    }
}

// Decrement temp quantity
function decrementTempQuantity(materialName) {
    const material = tempSelectedMaterials.find(m => m.material_name === materialName);
    if (material) {
        material.quantity = Math.max(0.1, (parseFloat(material.quantity) || 1) - 1);
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
        const subtotal = material.quantity * materialInfo.item_cost;
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

// Save temp materials to actual selection
function saveTempMaterials() {
    const showToast = getShowToast();
    
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

// Update material quantity (optimized - no full re-render)
function updateMaterialQuantity(index, quantity) {
    const formatCurrency = getFormatCurrency();
    selectedMaterials[index].quantity = parseFloat(quantity) || 0;
    
    // Only update the subtotal for this specific material (no full re-render)
    const materialInfo = allMaterialsForProduct.find(m => m.item_name === selectedMaterials[index].material_name);
    if (materialInfo) {
        const subtotal = selectedMaterials[index].quantity * materialInfo.item_cost;
        
        // Update only the subtotal display for this material
        const container = document.getElementById('materialsFormulaContainer');
        if (container) {
            const materialCard = container.children[index];
            if (materialCard) {
                const subtotalElement = materialCard.querySelector('.font-bold.text-purple-600');
                const formulaElement = materialCard.querySelector('.text-xs.text-gray-600');
                if (subtotalElement) {
                    subtotalElement.textContent = formatCurrency(subtotal);
                }
                if (formulaElement) {
                    formulaElement.textContent = `${formatCurrency(materialInfo.item_cost)} × ${selectedMaterials[index].quantity}`;
                }
            }
        }
    }
    
    // Update total cost
    calculateTotalCost();
}

// Increment material quantity
function incrementMaterialQuantity(index) {
    const currentQty = parseFloat(selectedMaterials[index].quantity) || 0;
    const newQty = currentQty + 1;
    selectedMaterials[index].quantity = newQty;
    
    // Update input field
    const input = document.getElementById(`material-qty-${index}`);
    if (input) {
        input.value = newQty;
    }
    
    // Update display and total
    updateMaterialQuantity(index, newQty);
}

// Decrement material quantity
function decrementMaterialQuantity(index) {
    const currentQty = parseFloat(selectedMaterials[index].quantity) || 0;
    const newQty = Math.max(0, currentQty - 1); // Don't go below 0
    selectedMaterials[index].quantity = newQty;
    
    // Update input field
    const input = document.getElementById(`material-qty-${index}`);
    if (input) {
        input.value = newQty;
    }
    
    // Update display and total
    updateMaterialQuantity(index, newQty);
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
            total += (material.quantity || 0) * materialInfo.item_cost;
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
    
    // Validate productId
    if (!productId || productId === 'undefined' || productId === 'null') {
        console.error('Invalid productId:', productId);
        showToast('Lỗi: ID sản phẩm không hợp lệ', 'error');
        return false;
    }
    
    if (selectedMaterials.length === 0) {
        return true; // No formula to save
    }

    try {
        console.log('💾 Saving materials for product:', productId, 'Materials:', selectedMaterials.length);
        console.log('📋 Materials data:', JSON.stringify(selectedMaterials, null, 2));
        
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
            console.log('✅ Formula saved, cost_price:', data.cost_price);
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
