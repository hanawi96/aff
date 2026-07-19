// Settings Page JavaScript
let packagingConfig = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Settings page initialized');
    loadPackagingConfig();
    loadShippingConfig(); // Load shipping fees
    loadCurrentTaxRate();
    loadDefaultAdSpend();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Shipping form
    const shippingForm = document.getElementById('shippingForm');
    if (shippingForm) {
        shippingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveShippingConfig(e);
        });
    }

    const adSpendForm = document.getElementById('adSpendForm');
    if (adSpendForm) {
        adSpendForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveDefaultAdSpend();
        });
    }

    // Old settings form (if exists)
    const form = document.getElementById('settingsForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            savePackagingConfig();
        });
    }

    // Update preview on input change
    const inputs = ['red_string', 'labor_cost', 'bag_zip', 'bag_red', 'thank_card', 'box_shipping', 'paper_print', 'customer_shipping_fee'];
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
    const redStringEl = document.getElementById('red_string');
    const laborCostEl = document.getElementById('labor_cost');
    const bagZipEl = document.getElementById('bag_zip');
    const bagRedEl = document.getElementById('bag_red');
    const thankCardEl = document.getElementById('thank_card');
    const paperPrintEl = document.getElementById('paper_print');
    const boxEl = document.getElementById('box_shipping');
    
    // Check if elements exist
    if (!redStringEl || !laborCostEl || !bagZipEl || !bagRedEl || !thankCardEl || !paperPrintEl || !boxEl) {
        return;
    }
    
    const redString = parseFloat(redStringEl.value) || 0;
    const laborCost = parseFloat(laborCostEl.value) || 0;
    const bagZip = parseFloat(bagZipEl.value) || 0;
    const bagRed = parseFloat(bagRedEl.value) || 0;
    const thankCard = parseFloat(thankCardEl.value) || 0;
    const paperPrint = parseFloat(paperPrintEl.value) || 0;
    const box = parseFloat(boxEl.value) || 0;

    const perOrder = bagZip + bagRed + box + thankCard + paperPrint;
    
    // Calculate for 1 product
    const perProduct1 = redString + laborCost;
    const total1 = perProduct1 * 1 + perOrder;
    
    // Calculate for 3 products
    const perProduct3 = redString + laborCost;
    const total3 = perProduct3 * 3 + perOrder;

    const preview1El = document.getElementById('preview1');
    const preview3El = document.getElementById('preview3');
    
    if (preview1El) {
        preview1El.innerHTML = 
            `<span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span><span>Đơn 1 sản phẩm: ${formatCurrency(perProduct1)} + ${formatCurrency(perOrder)} = ${formatCurrency(total1)}</span>`;
    }
    
    if (preview3El) {
        preview3El.innerHTML = 
            `<span class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span><span>Đơn 3 sản phẩm: ${formatCurrency(perProduct3 * 3)} + ${formatCurrency(perOrder)} = ${formatCurrency(total3)}</span>`;
    }
    
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

// Load shipping config (separate function for shipping form)
async function loadShippingConfig() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getPackagingConfig&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.config) {
            data.config.forEach(item => {
                if (item.item_name === 'customer_shipping_fee' || item.item_name === 'default_shipping_cost') {
                    const input = document.getElementById(item.item_name);
                    if (input) {
                        input.value = item.item_cost;
                        console.log(`✅ Loaded ${item.item_name}: ${item.item_cost}`);
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ Error loading shipping config:', error);
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
                is_default: 1
            },
            {
                item_name: 'customer_shipping_fee',
                item_cost: parseFloat(document.getElementById('customer_shipping_fee').value) || 0,
                is_default: 1
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

// Save shipping config (for shippingForm)
async function saveShippingConfig(submitEvent) {
    try {
        const formEl = submitEvent && submitEvent.target ? submitEvent.target : document.getElementById('shippingForm');
        const submitBtn = formEl && formEl.querySelector ? formEl.querySelector('button[type="submit"]') : null;
        const originalHTML = submitBtn.innerHTML;
        
        if (!submitBtn) throw new Error('Không tìm thấy nút gửi form');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Đang lưu...</span>';

        // Get values from shipping form
        const customerShippingFee = parseFloat(document.getElementById('customer_shipping_fee').value) || 0;
        const defaultShippingCost = parseFloat(document.getElementById('default_shipping_cost').value) || 0;

        // Validate
        if (customerShippingFee < 0 || defaultShippingCost < 0) {
            showToast('❌ Giá không được âm', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
            return;
        }

        // Prepare config array
        const config = [
            {
                item_name: 'customer_shipping_fee',
                item_cost: customerShippingFee,
                is_default: 1
            },
            {
                item_name: 'default_shipping_cost',
                item_cost: defaultShippingCost,
                is_default: 1
            }
        ];

        console.log('💾 Saving shipping config:', config);

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
            showToast('✅ Đã lưu cài đặt phí ship thành công', 'success');
            console.log('✅ Shipping config saved successfully');
        } else {
            throw new Error(data.error || 'Failed to save shipping config');
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;

    } catch (error) {
        console.error('❌ Error saving shipping config:', error);
        showToast('❌ Không thể lưu cài đặt: ' + error.message, 'error');
        
        const formEl = submitEvent && submitEvent.target ? submitEvent.target : document.getElementById('shippingForm');
        const submitBtn = formEl && formEl.querySelector ? formEl.querySelector('button[type="submit"]') : null;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span>Lưu cài đặt</span>';
        }
    }
}

// Show loading state
function showLoading() {
    const inputs = document.querySelectorAll('#settingsForm input[type="number"]');
    inputs.forEach(input => {
        input.disabled = true;
        input.value = ''; // Clear value to prevent showing old data
        input.placeholder = 'Đang tải...';
        input.classList.add('bg-gray-50', 'animate-pulse');
    });
}

// Hide loading state
function hideLoading() {
    const inputs = document.querySelectorAll('#settingsForm input[type="number"]');
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
            'default_shipping_cost': '25000',
            'customer_shipping_fee': '25000'
        };
        if (placeholders[input.id]) {
            input.placeholder = placeholders[input.id];
        }
    });
}

// Show toast notification (chuẩn hóa theo orders.js)
// showToast is now provided by toast-manager.js


// ============================================
// TAX MANAGEMENT
// ============================================

// Load current tax rate
async function loadCurrentTaxRate() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getCurrentTaxRate&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            // Fix: If taxRate > 1, it's already in percentage format (e.g., 5 means 5%)
            // If taxRate <= 1, it's in decimal format (e.g., 0.05 means 5%)
            let taxPercent;
            if (data.taxRate > 1) {
                // Already in percentage format
                taxPercent = data.taxRate.toFixed(1);
            } else {
                // Convert from decimal to percentage
                taxPercent = (data.taxRate * 100).toFixed(1);
            }
            
            // Hide skeleton and show real content
            const skeleton = document.getElementById('currentTaxRateSkeleton');
            const currentTaxRateEl = document.getElementById('currentTaxRate');
            if (skeleton) skeleton.classList.add('hidden');
            if (currentTaxRateEl) {
                currentTaxRateEl.textContent = `${taxPercent}%`;
                currentTaxRateEl.classList.remove('hidden');
            }
            
            // Update summary in sidebar
            const summarySkeleton = document.getElementById('currentTaxRateSummarySkeleton');
            const summaryEl = document.getElementById('currentTaxRateSummary');
            if (summaryEl) {
                if (summarySkeleton) summarySkeleton.classList.add('hidden');
                summaryEl.textContent = `${taxPercent}%`;
                summaryEl.classList.remove('hidden');
            }
            
            // Convert back to decimal for calculation if needed
            const taxRateDecimal = data.taxRate > 1 ? data.taxRate / 100 : data.taxRate;
            updateTaxExample(taxRateDecimal);
        }
    } catch (error) {
        console.error('Error loading tax rate:', error);
    }
}

// Update tax example
function updateTaxExample(taxRate) {
    const revenue = 130000; // Example: 100k product + 30k ship
    const tax = Math.round(revenue * taxRate);
    
    // Fix: If taxRate > 1, it's already in percentage format
    let taxPercent;
    if (taxRate > 1) {
        taxPercent = taxRate.toFixed(1);
    } else {
        taxPercent = (taxRate * 100).toFixed(1);
    }
    
    // Hide skeleton and show real content
    const skeleton = document.getElementById('taxExampleSkeleton');
    const taxExampleEl = document.getElementById('taxExample');
    if (skeleton) skeleton.classList.add('hidden');
    if (taxExampleEl) {
        taxExampleEl.innerHTML = 
            `<span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span><span>Thuế ${taxPercent}%: ${formatCurrency(revenue)} × ${taxPercent}% = ${formatCurrency(tax)}</span>`;
        taxExampleEl.classList.remove('hidden');
    }
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
        const today = new Date();
        const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateTaxRate',
                taxRate: newTaxRate,
                description: `Thuế ${newTaxRatePercent}% từ ${dateStr}`
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


// ============================================
// AD SPEND (QUẢNG CÁO)
// ============================================

async function loadDefaultAdSpend() {
    const input = document.getElementById('default_ad_spend');
    const display = document.getElementById('defaultAdSpendDisplay');
    const skeleton = document.getElementById('defaultAdSpendSkeleton');
    if (!input) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getDefaultAdSpend&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            const amount = data.amount || 0;
            input.value = amount;
            if (display) {
                display.textContent = formatCurrency(amount);
                display.classList.remove('hidden');
            }
            if (skeleton) skeleton.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading default ad spend:', error);
        if (skeleton) skeleton.classList.add('hidden');
    }
}

async function saveDefaultAdSpend() {
    const input = document.getElementById('default_ad_spend');
    const applyTodayEl = document.getElementById('applyAdSpendToday');
    if (!input) return;

    const amount = parseFloat(input.value);
    if (!Number.isFinite(amount) || amount < 0) {
        showToast('⚠️ Vui lòng nhập ngân sách QC hợp lệ', 'warning');
        return;
    }

    const applyToday = applyTodayEl ? applyTodayEl.checked : true;
    const applyNote = applyToday ? '\n\nChi QC hôm nay cũng được cập nhật.' : '\n\nChỉ đổi mặc định cho các ngày mới.';

    if (!confirm(`Xác nhận đặt ngân sách QC mặc định ${formatCurrency(amount)}/ngày?${applyNote}`)) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateDefaultAdSpend',
                amount,
                applyToday
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Đã lưu ngân sách QC ${formatCurrency(amount)}/ngày`, 'success');
            loadDefaultAdSpend();
        } else {
            throw new Error(data.error || 'Failed to update ad spend');
        }
    } catch (error) {
        console.error('Error updating default ad spend:', error);
        showToast('❌ Không thể cập nhật ngân sách QC', 'error');
    }
}


// ============================================
// CHANGE PASSWORD
// ============================================

// Setup change password form
document.addEventListener('DOMContentLoaded', function() {
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }
});

async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn = document.getElementById('changePasswordBtn');
    if (!btn) {
        console.error('changePasswordBtn not found');
        return;
    }
    
    // Validate
    if (newPassword !== confirmPassword) {
        showToast('❌ Mật khẩu mới không khớp', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('❌ Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
        return;
    }
    
    // Disable button
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Đang xử lý...</span>';
    
    try {
        const sessionToken = localStorage.getItem('session_token');
        
        const response = await fetch(`${CONFIG.API_URL}?action=changePassword`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Đổi mật khẩu thành công', 'success');
            
            // Clear form
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            throw new Error(data.error || 'Đổi mật khẩu thất bại');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('❌ ' + error.message, 'error');
    } finally {
        // Re-enable button
        btn.disabled = false;
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span>Đổi mật khẩu</span>';
    }
}


// ============================================
// BACKUP & RESTORE
// ============================================

// Load backup metadata and history on page load
document.addEventListener('DOMContentLoaded', function() {
    loadBackupMetadata();
    loadBackupHistory();
});

// Load backup metadata (table count, row count, estimated size)
async function loadBackupMetadata() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getBackupMetadata&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success && data.metadata) {
            document.getElementById('totalTables').textContent = data.metadata.tables;
            document.getElementById('totalRows').textContent = data.metadata.totalRows.toLocaleString('vi-VN');
            document.getElementById('estimatedSize').textContent = data.metadata.estimatedSize;
        }
    } catch (error) {
        console.error('Error loading backup metadata:', error);
    }
}

// ============================================
// BACKUP HISTORY
// ============================================

/**
 * Load backup history from database
 * Displays list of backups stored in R2
 */
async function loadBackupHistory() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getBackupHistory&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            renderBackupHistory(data.backups);
        } else {
            throw new Error(data.error || 'Failed to load backup history');
        }
    } catch (error) {
        console.error('Error loading backup history:', error);
        showBackupHistoryError();
    }
}

/**
 * Render backup history table
 * @param {Array} backups - Array of backup records
 */
function renderBackupHistory(backups) {
    const tbody = document.getElementById('backupHistoryTable');
    const emptyState = document.getElementById('backupHistoryEmpty');
    
    if (!tbody) return;
    
    // Show empty state if no backups
    if (!backups || backups.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
        }
        return;
    }
    
    // Hide empty state
    if (emptyState) {
        emptyState.classList.add('hidden');
    }
    
    // Render table rows
    tbody.innerHTML = backups.map(backup => {
        const date = formatBackupDateTime(backup.created_at);
        const size = formatBackupFileSize(backup.file_size);
        const isDownloaded = backup.downloaded_at ? true : false;
        
        return `
            <tr class="transition-colors hover:bg-slate-50/50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-slate-900">${date.date}</span>
                        <span class="text-xs text-slate-500">${date.time}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <svg class="h-4 w-4 shrink-0 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                        </svg>
                        <span class="text-sm text-slate-700 font-mono truncate max-w-xs" title="${backup.file_name}">
                            ${backup.file_name}
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <span class="text-sm font-semibold text-slate-900">${size}</span>
                </td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <div class="flex flex-col items-center gap-0.5">
                        <span class="text-sm font-medium text-slate-900">${backup.tables_count || 0}</span>
                        <span class="text-xs text-slate-500">${formatNumber(backup.rows_count || 0)} rows</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center gap-1.5 rounded-full ${
                        backup.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-slate-100 text-slate-600'
                    } px-2.5 py-1 text-xs font-semibold">
                        ${backup.status === 'completed' ? '✅' : '⏳'}
                        ${backup.status}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center justify-center gap-2">
                        <button 
                            onclick="downloadBackupFromCloud(event, ${backup.id}, '${backup.file_name}')"
                            class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tải về từ cloud"
                        >
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            <span>${isDownloaded ? 'Tải lại' : 'Tải xuống'}</span>
                        </button>
                        <button 
                            onclick="deleteBackupFromCloud(event, ${backup.id}, '${backup.file_name}')"
                            class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Xóa backup"
                        >
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            <span>Xóa</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Format backup datetime for display
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {Object} Formatted date and time
 */
function formatBackupDateTime(timestamp) {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const timeStr = date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    return { date: dateStr, time: timeStr };
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatBackupFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    
    return `${size} ${sizes[i]}`;
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}

/**
 * Download backup file from R2 cloud storage
 * @param {Event} event - Click event from button
 * @param {number} backupId - Backup record ID
 * @param {string} filename - Original filename
 */
async function downloadBackupFromCloud(event, backupId, filename) {
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    
    try {
        // Update button to loading state
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Đang tải...</span>
        `;
        
        const response = await fetch(`${CONFIG.API_URL}?action=downloadBackup&id=${backupId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Không thể tải backup');
        }
        
        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reload history to update download status
        setTimeout(() => {
            loadBackupHistory();
        }, 1000);
        
    } catch (error) {
        console.error('Download from cloud error:', error);
        showToast('❌ Lỗi khi tải backup: ' + error.message, 'error');
    } finally {
        // Restore button state
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

/**
 * Delete backup from R2 cloud storage
 * @param {Event} event - Click event from button
 * @param {number} backupId - Backup record ID
 * @param {string} filename - Filename for confirmation
 */
async function deleteBackupFromCloud(event, backupId, filename) {
    // Confirm deletion
    const confirmed = confirm(
        `⚠️ XÓA BACKUP\n\n` +
        `Bạn có chắc chắn muốn xóa backup này?\n\n` +
        `File: ${filename}\n\n` +
        `⚠️ Hành động này không thể hoàn tác!`
    );
    
    if (!confirmed) return;
    
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    
    try {
        // Update button to loading state
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Đang xóa...</span>
        `;
        
        const response = await fetch(`${CONFIG.API_URL}?action=deleteBackup&id=${backupId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể xóa backup');
        }
        
        showToast('✅ Đã xóa backup thành công!', 'success');
        
        // Reload history to remove deleted item
        setTimeout(() => {
            loadBackupHistory();
        }, 500);
        
    } catch (error) {
        console.error('Delete backup error:', error);
        showToast('❌ Lỗi khi xóa backup: ' + error.message, 'error');
        
        // Restore button if error
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

/**
 * Show error state in backup history table
 */
function showBackupHistoryError() {
    const tbody = document.getElementById('backupHistoryTable');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-8 text-center">
                <div class="flex flex-col items-center gap-3">
                    <svg class="h-12 w-12 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                        <p class="text-sm font-semibold text-slate-900">Không thể tải lịch sử backup</p>
                        <button onclick="loadBackupHistory()" class="mt-2 text-sm text-cyan-600 hover:text-cyan-800 font-medium">
                            Thử lại
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Create and download backup
let selectedFile = null;

async function createBackup() {
    const btn = document.getElementById('backupBtn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Đang tạo backup...</span>';
        
        // Call API to create backup
        const response = await fetch(`${CONFIG.API_URL}?action=createBackup&timestamp=${Date.now()}`);
        
        if (!response.ok) {
            let detail = 'Không thể tạo backup';
            try {
                const errBody = await response.json();
                if (errBody?.error) detail = errBody.error;
            } catch (_) { /* body có thể là file/empty */ }
            throw new Error(detail);
        }
        
        // Get filename from response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `backup_${Date.now()}.sql`;
        
        // Get backup stats from headers
        const tables = response.headers.get('X-Backup-Tables');
        const rows = response.headers.get('X-Backup-Rows');
        
        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Backup error:', error);
        showToast('❌ Lỗi khi tạo backup: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedFile = file;
    
    // Show selected file name
    const fileNameEl = document.getElementById('selectedFileName');
    fileNameEl.textContent = `📄 ${file.name} (${formatFileSize(file.size)})`;
    fileNameEl.classList.remove('hidden');
    
    // Enable restore button
    document.getElementById('restoreBtn').disabled = false;
    
    // Validate file
    validateBackupFileClient(file);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Validate backup file on client side
async function validateBackupFileClient(file) {
    try {
        const formData = new FormData();
        formData.append('backup_file', file);
        
        const response = await fetch(`${CONFIG.API_URL}?action=validateBackup`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success && data.valid) {
            showToast(`✅ File hợp lệ: ${data.info.tables} bảng, ~${data.info.inserts} dòng`, 'success');
        } else {
            showToast('⚠️ ' + (data.error || 'File không hợp lệ'), 'warning');
        }
    } catch (error) {
        console.error('Validation error:', error);
    }
}

// Restore database from backup
async function restoreBackup() {
    if (!selectedFile) {
        showToast('⚠️ Vui lòng chọn file backup', 'warning');
        return;
    }
    
    // Confirm action
    const confirmed = confirm(
        '⚠️ CẢNH BÁO QUAN TRỌNG\n\n' +
        'Thao tác này sẽ:\n' +
        '• GHI ĐÈ toàn bộ dữ liệu hiện tại\n' +
        '• KHÔNG THỂ HOÀN TÁC\n' +
        '• Tạo backup an toàn trước khi restore\n\n' +
        'Bạn có chắc chắn muốn tiếp tục?'
    );
    
    if (!confirmed) return;
    
    // Double confirmation
    const doubleConfirm = confirm(
        '🔴 XÁC NHẬN LẦN CUỐI\n\n' +
        'Dữ liệu hiện tại sẽ mất vĩnh viễn!\n\n' +
        'Tiếp tục restore?'
    );
    
    if (!doubleConfirm) return;
    
    const btn = document.getElementById('restoreBtn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Đang restore...</span>';
        
        showToast('⏳ Đang khôi phục database... Vui lòng đợi', 'info');
        
        const formData = new FormData();
        formData.append('backup_file', selectedFile);
        
        const response = await fetch(`${CONFIG.API_URL}?action=restoreBackup`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(
                `✅ Khôi phục thành công!\n` +
                `• ${data.details.successCount} câu lệnh thực thi\n` +
                `• ${data.details.tablesRestored} bảng được restore`,
                'success'
            );
            
            // Clear selected file
            selectedFile = null;
            document.getElementById('backupFileInput').value = '';
            document.getElementById('selectedFileName').classList.add('hidden');
            document.getElementById('restoreBtn').disabled = true;
            
            // Reload metadata
            setTimeout(() => {
                loadBackupMetadata();
            }, 1000);
            
        } else {
            throw new Error(data.error || 'Restore thất bại');
        }
        
    } catch (error) {
        console.error('Restore error:', error);
        showToast('❌ Lỗi khi restore: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// Drag and drop support
document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropZone.classList.add('border-rose-500', 'bg-rose-100');
    }
    
    function unhighlight() {
        dropZone.classList.remove('border-rose-500', 'bg-rose-100');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            
            // Check file extension
            if (!file.name.endsWith('.sql') && !file.name.endsWith('.sql.gz')) {
                showToast('⚠️ Chỉ chấp nhận file .sql hoặc .sql.gz', 'warning');
                return;
            }
            
            // Set to input
            const input = document.getElementById('backupFileInput');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            
            // Trigger change event
            handleFileSelect({ target: input });
        }
    }
});
