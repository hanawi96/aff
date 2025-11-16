// Settings Page JavaScript
let packagingConfig = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Settings page initialized');
    loadPackagingConfig();
    loadCurrentTaxRate();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('settingsForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            savePackagingConfig();
        });
    }

    // Update preview on input change
    const inputs = ['red_string', 'labor_cost', 'bag_zip', 'bag_red', 'thank_card', 'box_shipping', 'paper_print'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', updatePreview);
        }
    });
}

// Update preview calculation
function updatePreview() {
    // Per-product costs (multiply by quantity)
    const redString = parseFloat(document.getElementById('red_string').value) || 0;
    const laborCost = parseFloat(document.getElementById('labor_cost').value) || 0;
    
    // Per-order costs (fixed)
    const bagZip = parseFloat(document.getElementById('bag_zip').value) || 0;
    const bagRed = parseFloat(document.getElementById('bag_red').value) || 0;
    const thankCard = parseFloat(document.getElementById('thank_card').value) || 0;
    const paperPrint = parseFloat(document.getElementById('paper_print').value) || 0;
    const box = parseFloat(document.getElementById('box_shipping').value) || 0;

    const perOrder = bagZip + bagRed + box + thankCard + paperPrint;
    
    // Calculate for 1 product
    const perProduct1 = redString + laborCost;
    const total1 = perProduct1 * 1 + perOrder;
    
    // Calculate for 3 products
    const perProduct3 = redString + laborCost;
    const total3 = perProduct3 * 3 + perOrder;

    document.getElementById('preview1').innerHTML = 
        `<span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span><span>Đơn 1 sản phẩm: ${formatCurrency(perProduct1)} + ${formatCurrency(perOrder)} = ${formatCurrency(total1)}</span>`;
    document.getElementById('preview3').innerHTML = 
        `<span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span><span>Đơn 3 sản phẩm: ${formatCurrency(perProduct3 * 3)} + ${formatCurrency(perOrder)} = ${formatCurrency(total3)}</span>`;
    
    // Update quick stats (show for 1 product as example)
    const totalPackagingEl = document.getElementById('totalPackagingCost');
    if (totalPackagingEl) {
        totalPackagingEl.textContent = formatCurrency(total1);
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount).replace('₫', 'đ');
}

// Load packaging config from API
async function loadPackagingConfig() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getPackagingConfig&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.config) {
            packagingConfig = {};
            data.config.forEach(item => {
                packagingConfig[item.item_name] = item;
                
                // Fill form
                const input = document.getElementById(item.item_name);
                if (input) {
                    input.value = item.item_cost;
                }
            });

            console.log('✅ Loaded packaging config:', packagingConfig);
            
            // Update preview after loading data
            updatePreview();
        } else {
            throw new Error(data.error || 'Failed to load config');
        }

        hideLoading();

    } catch (error) {
        console.error('❌ Error loading config:', error);
        hideLoading();
        showToast('❌ Không thể tải cấu hình', 'error');
    }
}

// Save packaging config
async function savePackagingConfig() {
    try {
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Đang lưu...</span>';

        // Get values from form
        const config = [
            // Per-product costs
            {
                item_name: 'red_string',
                item_cost: parseFloat(document.getElementById('red_string').value) || 0,
                is_default: 1
            },
            {
                item_name: 'labor_cost',
                item_cost: parseFloat(document.getElementById('labor_cost').value) || 0,
                is_default: 1
            },
            // Per-order costs
            {
                item_name: 'bag_zip',
                item_cost: parseFloat(document.getElementById('bag_zip').value) || 0,
                is_default: 1
            },
            {
                item_name: 'bag_red',
                item_cost: parseFloat(document.getElementById('bag_red').value) || 0,
                is_default: 1
            },
            {
                item_name: 'thank_card',
                item_cost: parseFloat(document.getElementById('thank_card').value) || 0,
                is_default: 1
            },
            {
                item_name: 'paper_print',
                item_cost: parseFloat(document.getElementById('paper_print').value) || 0,
                is_default: 1
            },
            {
                item_name: 'box_shipping',
                item_cost: parseFloat(document.getElementById('box_shipping').value) || 0,
                is_default: 1
            },
            {
                item_name: 'default_shipping_cost',
                item_cost: parseFloat(document.getElementById('default_shipping_cost').value) || 0,
                is_default: 0
            }
        ];

        // Validate
        for (const item of config) {
            if (item.item_cost < 0) {
                showToast('❌ Giá không được âm', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg><span>Lưu cài đặt</span>';
                return;
            }
        }

        // Send to API
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updatePackagingConfig',
                config: config
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('✅ Đã lưu cấu hình thành công', 'success');
            await loadPackagingConfig(); // Reload
        } else {
            throw new Error(data.error || 'Failed to save config');
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg><span>Lưu cài đặt</span>';

    } catch (error) {
        console.error('❌ Error saving config:', error);
        showToast('❌ Không thể lưu cài đặt', 'error');
        
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg><span>Lưu cài đặt</span>';
    }
}

// Show loading state
function showLoading() {
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.disabled = true;
        input.value = ''; // Clear value to prevent showing old data
        input.placeholder = 'Đang tải...';
        input.classList.add('bg-gray-50', 'animate-pulse');
    });
}

// Hide loading state
function hideLoading() {
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.disabled = false;
        input.classList.remove('bg-gray-50', 'animate-pulse');
        // Restore original placeholders
        const placeholders = {
            'red_string': '100',
            'labor_cost': '5000',
            'bag_zip': '500',
            'bag_red': '1000',
            'box_shipping': '3000',
            'thank_card': '300',
            'paper_print': '200',
            'default_shipping_cost': '25000'
        };
        if (placeholders[input.id]) {
            input.placeholder = placeholders[input.id];
        }
    });
}

// Show toast notification (chuẩn hóa theo orders.js)
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-[9999] fade-in flex items-center gap-3 ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
    }`;
    
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
    
    return toast;
}


// ============================================
// TAX MANAGEMENT
// ============================================

// Load current tax rate
async function loadCurrentTaxRate() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getCurrentTaxRate&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            const taxPercent = (data.taxRate * 100).toFixed(1);
            
            // Hide skeleton and show real content
            const skeleton = document.getElementById('currentTaxRateSkeleton');
            const currentTaxRateEl = document.getElementById('currentTaxRate');
            if (skeleton) skeleton.classList.add('hidden');
            currentTaxRateEl.textContent = `${taxPercent}%`;
            currentTaxRateEl.classList.remove('hidden');
            
            // Update summary in sidebar
            const summarySkeleton = document.getElementById('currentTaxRateSummarySkeleton');
            const summaryEl = document.getElementById('currentTaxRateSummary');
            if (summaryEl) {
                if (summarySkeleton) summarySkeleton.classList.add('hidden');
                summaryEl.textContent = `${taxPercent}%`;
                summaryEl.classList.remove('hidden');
            }
            
            updateTaxExample(data.taxRate);
        }
    } catch (error) {
        console.error('Error loading tax rate:', error);
        showToast('❌ Không thể tải tỷ lệ thuế', 'error');
    }
}

// Update tax example
function updateTaxExample(taxRate) {
    const revenue = 130000; // Example: 100k product + 30k ship
    const tax = Math.round(revenue * taxRate);
    const taxPercent = (taxRate * 100).toFixed(1);
    
    // Hide skeleton and show real content
    const skeleton = document.getElementById('taxExampleSkeleton');
    const taxExampleEl = document.getElementById('taxExample');
    if (skeleton) skeleton.classList.add('hidden');
    taxExampleEl.innerHTML = 
        `<span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span><span>Thuế ${taxPercent}%: ${formatCurrency(revenue)} × ${taxPercent}% = ${formatCurrency(tax)}</span>`;
    taxExampleEl.classList.remove('hidden');
}

// Update tax rate
async function updateTaxRate() {
    const newTaxRateInput = document.getElementById('newTaxRate');
    const newTaxRatePercent = parseFloat(newTaxRateInput.value);
    
    if (!newTaxRatePercent || newTaxRatePercent < 0 || newTaxRatePercent > 100) {
        showToast('⚠️ Vui lòng nhập tỷ lệ thuế hợp lệ (0-100%)', 'warning');
        return;
    }
    
    const newTaxRate = newTaxRatePercent / 100; // Convert to decimal
    
    // Confirm with user
    if (!confirm(`Xác nhận thay đổi tỷ lệ thuế thành ${newTaxRatePercent}%?\n\nLưu ý: Chỉ ảnh hưởng đến đơn hàng mới, đơn cũ giữ nguyên thuế đã tính.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateTaxRate',
                taxRate: newTaxRate,
                description: `Thuế ${newTaxRatePercent}% từ ${toVNShortDate(new Date())}`
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Đã cập nhật tỷ lệ thuế thành ${newTaxRatePercent}%`, 'success');
            loadCurrentTaxRate(); // Reload to show new rate
            newTaxRateInput.value = ''; // Clear input
        } else {
            throw new Error(data.error || 'Failed to update tax rate');
        }
    } catch (error) {
        console.error('Error updating tax rate:', error);
        showToast('❌ Không thể cập nhật tỷ lệ thuế', 'error');
    }
}
