// ============================================
// ADD ORDER MODAL HELPER FUNCTIONS
// ============================================
// Helper functions for the add order modal
// Handles order summary calculations, profit preview, and product rendering

console.log('📊 Loading orders-add-modal-helpers.js');

/**
 * Update order summary and profit preview
 * Calculates totals, discounts, costs, and profit
 */
function updateOrderSummary() {
    console.log('💰 updateOrderSummary called');
    // Get values from inputs
    const shippingFeeInput = document.getElementById('newOrderShippingFee');
    const shippingCostInput = document.getElementById('newOrderShippingCost');
    const referralCodeInput = document.getElementById('newOrderReferralCode');
    
    if (!shippingFeeInput || !shippingCostInput) {
        console.warn('⚠️ Order summary inputs not found');
        return;
    }

    const shippingFee = parseFloat(shippingFeeInput.value) || 0;
    const shippingCost = parseFloat(shippingCostInput.value) || 0;
    const referralCode = referralCodeInput?.value?.trim() || '';

    // Calculate product totals
    let productTotal = 0;
    let productCost = 0;
    let productCount = 0;

    currentOrderProducts.forEach(product => {
        const price = parseFloat(product.price) || 0;
        const cost = parseFloat(product.cost) || 0;
        const quantity = parseInt(product.quantity) || 1;
        
        productTotal += price * quantity;
        productCost += cost * quantity;
        productCount += quantity;
    });

    // Get discount amount
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value) || 0;

    // Calculate revenue (product total + shipping fee - discount)
    const totalRevenue = productTotal + shippingFee - discountAmount;

    // Calculate packaging costs
    const packagingPerProduct = packagingConfig.find(item => item.item_name === 'packaging_per_product')?.item_cost || 2000;
    const packagingPerOrder = packagingConfig.find(item => item.item_name === 'packaging_per_order')?.item_cost || 5000;
    const totalPackaging = (packagingPerProduct * productCount) + packagingPerOrder;

    // Calculate commission (only if referral code exists)
    let commission = 0;
    let commissionRate = 0;
    if (referralCode) {
        // Get commission rate from CTV data if available
        const ctvData = window.currentCTVData;
        if (ctvData && ctvData.commission_rate !== undefined) {
            commissionRate = parseFloat(ctvData.commission_rate) || 0;
        } else {
            // Default commission rate
            commissionRate = 0.05; // 5%
        }
        commission = productTotal * commissionRate;
    }

    // Calculate tax
    const taxRate = window.currentTaxRate || 0;
    const taxableAmount = totalRevenue - shippingFee; // Tax on products only, not shipping
    const tax = taxableAmount * taxRate;

    // Calculate total costs
    const totalCosts = productCost + totalPackaging + shippingCost + commission + tax;

    // Calculate profit
    const profit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0;

    // Update main summary section
    document.getElementById('orderTotalAmount').textContent = formatCurrency(totalRevenue);
    document.getElementById('orderProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('orderShippingFee').textContent = formatCurrency(shippingFee);

    // Show/hide discount row
    const discountRow = document.getElementById('orderDiscountRow');
    if (discountAmount > 0 && discountRow) {
        discountRow.classList.remove('hidden');
        document.getElementById('orderDiscountAmount').textContent = `-${formatCurrency(discountAmount)}`;
    } else if (discountRow) {
        discountRow.classList.add('hidden');
    }

    // Update profit preview section
    document.getElementById('profitRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('profitProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('profitShippingFee').textContent = formatCurrency(shippingFee);
    
    // Show/hide discount in revenue breakdown
    const discountRowInRevenue = document.getElementById('profitDiscountRowInRevenue');
    if (discountAmount > 0 && discountRowInRevenue) {
        discountRowInRevenue.classList.remove('hidden');
        document.getElementById('profitDiscountInRevenue').textContent = `-${formatCurrency(discountAmount)}`;
    } else if (discountRowInRevenue) {
        discountRowInRevenue.classList.add('hidden');
    }

    document.getElementById('profitCost').textContent = formatCurrency(productCost);
    document.getElementById('profitPackaging').textContent = formatCurrency(totalPackaging);
    document.getElementById('profitPackagingPerProduct').textContent = formatCurrency(packagingPerProduct * productCount);
    document.getElementById('profitPackagingPerOrder').textContent = formatCurrency(packagingPerOrder);
    document.getElementById('profitShipping').textContent = formatCurrency(shippingCost);
    
    // Update commission display
    const commissionLabel = document.getElementById('profitCommissionLabel');
    const commissionValue = document.getElementById('profitCommission');
    if (commission > 0) {
        commissionLabel.textContent = `- Hoa hồng (${(commissionRate * 100).toFixed(1)}%)`;
        commissionValue.textContent = formatCurrency(commission);
    } else {
        commissionLabel.textContent = '- Hoa hồng';
        commissionValue.textContent = '0đ';
    }

    // Update tax display
    const taxLabel = document.getElementById('profitTaxLabel');
    const taxValue = document.getElementById('profitTax');
    if (tax > 0) {
        taxLabel.textContent = `- Thuế (${(taxRate * 100).toFixed(1)}%)`;
        taxValue.textContent = formatCurrency(tax);
    } else {
        taxLabel.textContent = '- Thuế';
        taxValue.textContent = '0đ';
    }

    // Update final profit with color coding
    const profitAmountEl = document.getElementById('profitAmount');
    const profitMarginEl = document.getElementById('profitMargin');
    const profitWarningEl = document.getElementById('profitWarning');

    profitAmountEl.textContent = formatCurrency(profit);
    profitMarginEl.textContent = `(${profitMargin.toFixed(1)}%)`;

    // Color coding based on profit
    if (profit < 0) {
        profitAmountEl.className = 'text-2xl font-bold text-red-600';
        profitMarginEl.className = 'text-xs text-red-600 font-medium';
        profitWarningEl.classList.remove('hidden');
        profitWarningEl.querySelector('p').textContent = '⚠️ Đơn hàng này đang lỗ! Kiểm tra lại giá bán và chi phí.';
    } else if (profit < 10000) {
        profitAmountEl.className = 'text-2xl font-bold text-yellow-600';
        profitMarginEl.className = 'text-xs text-yellow-600 font-medium';
        profitWarningEl.classList.remove('hidden');
        profitWarningEl.querySelector('p').textContent = '⚠️ Lãi thấp! Cân nhắc tăng giá hoặc giảm chi phí.';
    } else {
        profitAmountEl.className = 'text-2xl font-bold text-emerald-600';
        profitMarginEl.className = 'text-xs text-emerald-600 font-medium';
        profitWarningEl.classList.add('hidden');
    }
}

/**
 * Render order products list in add order modal
 * Displays all products with edit/remove buttons
 */
function renderOrderProducts() {
    const container = document.getElementById('newOrderProductsList');
    if (!container) {
        console.warn('⚠️ Products list container not found');
        return;
    }

    if (currentOrderProducts.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4 text-sm italic">Chưa có sản phẩm nào</p>';
        return;
    }

    container.innerHTML = currentOrderProducts.map((product, index) => {
        const price = parseFloat(product.price) || 0;
        const quantity = parseInt(product.quantity) || 1;
        const subtotal = price * quantity;
        
        // Build product info line
        let productInfo = `${quantity}x ${escapeHtml(product.name)}`;
        
        // Add weight/size if available
        if (product.weight) {
            productInfo += ` - ${product.weight}g`;
        }
        if (product.size) {
            productInfo += ` - ${product.size}`;
        }
        
        // Add notes if available
        let notesHtml = '';
        if (product.notes) {
            notesHtml = `
                <div class="mt-1 flex items-start gap-1">
                    <svg class="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <span class="text-xs text-gray-600 italic">${escapeHtml(product.notes)}</span>
                </div>
            `;
        }

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">${productInfo}</p>
                        ${notesHtml}
                        <div class="flex items-center gap-3 mt-1">
                            <span class="text-xs text-gray-500">Đơn giá: ${formatCurrency(price)}</span>
                            <span class="text-xs font-semibold text-blue-600">Tổng: ${formatCurrency(subtotal)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button onclick="editProductInOrder(${index})" class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex items-center justify-center" title="Sửa">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="removeProductFromOrder(${index})" class="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center justify-center" title="Xóa">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update order notes display
 * Shows/hides the notes section based on currentOrderNotes
 */
function updateOrderNotesDisplay() {
    const notesDisplay = document.getElementById('orderNotesDisplay');
    const notesText = document.getElementById('orderNotesText');
    
    if (!notesDisplay || !notesText) {
        return;
    }

    if (currentOrderNotes && currentOrderNotes.trim()) {
        notesDisplay.classList.remove('hidden');
        notesText.textContent = currentOrderNotes;
    } else {
        notesDisplay.classList.add('hidden');
    }
}

/**
 * Clear order notes
 * Removes notes from the order
 */
function clearOrderNotes() {
    currentOrderNotes = '';
    updateOrderNotesDisplay();
    showToast('Đã xóa lưu ý đơn hàng', 'info');
}
