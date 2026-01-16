/**
 * Orders Discount Selector
 * Dropdown to select discount codes
 */

// ============================================
// LOAD DISCOUNTS
// ============================================

/**
 * Load active discounts from API
 */
async function loadActiveDiscounts() {
    // Return if already loaded
    if (allDiscountsList.length > 0) {
        console.log('✅ Discounts already loaded:', allDiscountsList.length);
        return;
    }

    try {
        console.log('📥 Loading discounts...');
        const response = await fetch(`${CONFIG.API_URL}?action=getAllDiscounts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.discounts) {
            // Filter only active and not expired discounts
            const now = new Date();
            allDiscountsList = data.discounts.filter(d => {
                if (!d.active) return false;
                if (d.expiry_date && new Date(d.expiry_date) < now) return false;
                if (d.start_date && new Date(d.start_date) > now) return false;
                return true;
            });
            console.log('✅ Loaded active discounts:', allDiscountsList.length);
        }
    } catch (error) {
        console.error('❌ Error loading discounts:', error);
    }
}

// ============================================
// DISCOUNT DROPDOWN
// ============================================

/**
 * Toggle discount dropdown
 */
function toggleDiscountDropdown(event) {
    event.stopPropagation();
    
    const dropdown = document.getElementById('discountDropdown');
    const isHidden = dropdown.classList.contains('hidden');
    
    // Close all other dropdowns first
    document.querySelectorAll('[id$="Dropdown"]').forEach(d => {
        if (d.id !== 'discountDropdown') d.classList.add('hidden');
    });
    
    if (isHidden) {
        // Load discounts if not loaded
        if (allDiscountsList.length === 0) {
            loadActiveDiscounts().then(() => {
                renderDiscountDropdown();
                dropdown.classList.remove('hidden');
            });
        } else {
            renderDiscountDropdown();
            dropdown.classList.remove('hidden');
        }
    } else {
        dropdown.classList.add('hidden');
    }
}

/**
 * Render discount dropdown content
 */
function renderDiscountDropdown() {
    const container = document.getElementById('discountDropdownContent');
    
    // Custom discount form at top (simple, clean design)
    let html = `
        <div class="sticky top-0 bg-white border-b border-gray-200 p-3 z-10">
            <div class="text-xs font-semibold text-gray-600 mb-2">Giảm giá tùy chỉnh</div>
            <div class="flex gap-2">
                <input 
                    type="number" 
                    id="customDiscountAmountInput" 
                    min="0" 
                    step="1000"
                    placeholder="Nhập số tiền giảm (VD: 50000)"
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <button 
                    type="button"
                    onclick="applyCustomDiscountFromDropdown()"
                    class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors whitespace-nowrap">
                    Áp dụng
                </button>
            </div>
        </div>
    `;
    
    if (allDiscountsList.length === 0) {
        html += `
            <div class="px-3 py-4 text-sm text-gray-500 text-center">
                Không có mã giảm giá
            </div>
        `;
        container.innerHTML = html;
        return;
    }
    
    // Discount list header
    html += `
        <div class="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <div class="text-xs font-semibold text-gray-500">Mã có sẵn</div>
        </div>
    `;
    
    html += allDiscountsList.map(discount => {
        let valueText = '';
        let badgeColor = 'bg-gray-100 text-gray-700';
        
        if (discount.type === 'fixed') {
            valueText = formatCurrency(discount.discount_value);
            badgeColor = 'bg-blue-50 text-blue-700';
        } else if (discount.type === 'percentage') {
            valueText = `${discount.discount_value}%`;
            badgeColor = 'bg-green-50 text-green-700';
            if (discount.max_discount_amount) {
                valueText += ` (max ${formatCurrency(discount.max_discount_amount)})`;
            }
        } else if (discount.type === 'freeship') {
            valueText = 'Freeship';
            badgeColor = 'bg-orange-50 text-orange-700';
        } else if (discount.type === 'gift') {
            valueText = 'Quà tặng';
            badgeColor = 'bg-pink-50 text-pink-700';
        }
        
        let conditionText = '';
        if (discount.min_order_amount > 0) {
            conditionText = `Tối thiểu ${formatCurrency(discount.min_order_amount)}`;
        }
        
        return `
            <button type="button" 
                onclick="selectDiscountCode('${discount.code}')" 
                class="w-full px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-semibold text-gray-900 text-sm">${discount.code}</span>
                            <span class="text-xs px-2 py-0.5 rounded ${badgeColor} font-medium">${valueText}</span>
                        </div>
                        <div class="text-xs text-gray-600">${discount.title}</div>
                        ${conditionText ? `<div class="text-xs text-gray-500 mt-0.5">${conditionText}</div>` : ''}
                    </div>
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>
        `;
    }).join('');
    
    container.innerHTML = html;
}

/**
 * Select discount code from dropdown
 */
function selectDiscountCode(code) {
    // Fill input
    const input = document.getElementById('newOrderDiscountCode');
    if (input) {
        input.value = code;
    }
    
    // Close dropdown
    document.getElementById('discountDropdown').classList.add('hidden');
    
    // Auto apply
    applyDiscountCode();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('discountDropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        const button = e.target.closest('[onclick*="toggleDiscountDropdown"]');
        if (!button && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    }
});


// ============================================
// CUSTOM DISCOUNT
// ============================================

/**
 * Apply custom discount from dropdown
 */
function applyCustomDiscountFromDropdown() {
    const amount = parseFloat(document.getElementById('customDiscountAmountInput').value) || 0;
    
    if (amount <= 0) {
        showToast('Vui lòng nhập số tiền giảm giá', 'warning');
        return;
    }
    
    // Store custom discount data
    document.getElementById('appliedDiscountId').value = '';
    document.getElementById('appliedDiscountCode').value = 'CUSTOM';
    document.getElementById('appliedDiscountAmount').value = amount;
    document.getElementById('appliedDiscountType').value = 'custom';
    
    // Show success state
    const discount = {
        code: 'CUSTOM',
        title: 'Giảm giá tùy chỉnh',
        type: 'custom'
    };
    showDiscountSuccess(discount, amount);
    
    // Update order summary
    updateOrderSummary();
    
    // Close dropdown
    document.getElementById('discountDropdown').classList.add('hidden');
    
    // Clear input
    document.getElementById('customDiscountAmountInput').value = '';
    
    showToast(`Đã áp dụng giảm giá ${formatCurrency(amount)}`, 'success');
}
