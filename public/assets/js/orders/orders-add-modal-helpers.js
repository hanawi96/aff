// ============================================
// ADD ORDER MODAL HELPER FUNCTIONS
// ============================================
// Helper functions for the add order modal
// Handles order summary calculations, profit preview, and product rendering

/**
 * Update packaging items display dynamically
 * Renders all packaging items from category_id = 5
 */
function updatePackagingItemsDisplay() {
    const container = document.getElementById('packagingItemsContainer');
    if (!container || !window.packagingItems) return;
    
    // Clear and rebuild
    container.innerHTML = window.packagingItems.map(item => `
        <div class="flex justify-between items-center text-xs py-0.5">
            <span class="text-gray-400">- ${escapeHtml(item.display_name || item.item_name)}</span>
            <span class="text-gray-400">${formatCurrency(item.item_cost || 0)}</span>
        </div>
    `).join('');
}

/** Panel cọc đang mở (user đã bấm "Cọc trước"). */
function isNewOrderDepositPanelOpen() {
    const wrap = document.getElementById('newOrderDepositWrap');
    return !!(wrap && !wrap.classList.contains('hidden'));
}

/** Tiền cọc thực tế khi tạo/sửa đơn — chỉ tính khi chọn "Cọc trước". */
function getNewOrderDepositAmount() {
    if (!isNewOrderDepositPanelOpen()) return 0;
    return parsePrice(document.getElementById('newOrderDepositAmount')?.value) || 0;
}

/**
 * Update order summary and profit preview
 * Calculates totals, discounts, costs, and profit
 */
function updateOrderSummary() {
    if (typeof recalcDesktopManualDiscount === 'function') recalcDesktopManualDiscount();
    if (typeof maybeRefreshDesktopDiscountSheet === 'function') maybeRefreshDesktopDiscountSheet();

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
        // Parse price and cost using helper function
        const price = parsePrice(product.price);
        const cost = parsePrice(product.cost_price);
        const quantity = parseInt(product.quantity) || 1;
        
        productTotal += price * quantity;
        productCost += cost * quantity;
        productCount += quantity;
    });

    // Get discount amount
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value) || 0;

    // Calculate revenue - same formula for both COD and Bank transfer
    // Revenue = product total + shipping fee - discount
    const totalRevenue = productTotal + shippingFee - discountAmount;

    // Calculate packaging costs dynamically from category_id = 5 only
    const packagingPerOrderCost = packagingConfig
        .filter(item => item.category_id === 5)
        .reduce((sum, item) => sum + (item.item_cost || 0), 0);
    const totalPackaging = packagingPerOrderCost;

    // Build display names map
    const packagingDisplayNames = {};
    packagingConfig.forEach(item => {
        packagingDisplayNames[item.item_name] = item.display_name || item.item_name;
    });
    
    // Store globally for use in modal rendering (only packaging items, not shipping fees)
    window.packagingDisplayNames = packagingDisplayNames;
    window.packagingItems = packagingConfig.filter(item => item.category_id === 5); // Only packaging items

    // Calculate commission (only if referral code exists)
    let commission = 0;
    let commissionRate = 0;
    if (referralCode) {
        // Get commission rate from hidden input (set by CTV verification)
        const commissionRateInput = document.getElementById('ctvCommissionRate');
        if (commissionRateInput && commissionRateInput.value) {
            commissionRate = parseFloat(commissionRateInput.value) || 0;
        } else {
            // Default commission rate if not verified yet
            commissionRate = 0.1; // 10%
        }
        // Commission calculated on product total only (not including shipping, not including discount)
        commission = productTotal * commissionRate;
    }

    // Calculate tax on total revenue (same as calculateOrderProfit)
    const taxRate = COST_CONSTANTS.TAX_RATE || 0;
    const tax = Math.round(totalRevenue * taxRate);

    // Calculate total costs
    const totalCosts = productCost + totalPackaging + shippingCost + commission + tax;

    // Calculate profit
    const profit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0;

    // Update main summary section
    document.getElementById('orderTotalAmount').textContent = formatCurrency(totalRevenue);
    document.getElementById('orderProductTotal').textContent = formatCurrency(productTotal);
    document.getElementById('orderShippingFee').textContent = formatCurrency(shippingFee);
    
    // Update COD amount based on payment method & deposit
    const paymentMethod = document.getElementById('newOrderPaymentMethod')?.value || 'cod';
    const codAmountEl = document.getElementById('orderCODAmount');
    const codNoteEl = document.getElementById('orderCODNote');
    const deposit = getNewOrderDepositAmount();
    const codCollect = Math.max(0, totalRevenue - deposit);

    const depositRow = document.getElementById('orderDepositRow');
    if (deposit > 0 && depositRow) {
        depositRow.classList.remove('hidden');
        document.getElementById('orderDepositAmountDisplay').textContent = formatCurrency(deposit);
    } else if (depositRow) {
        depositRow.classList.add('hidden');
    }

    if (isOrderBankPayment(paymentMethod)) {
        codAmountEl.textContent = '0đ';
        codAmountEl.className = 'text-xl font-bold text-green-600';
        codNoteEl.classList.remove('hidden');
    } else {
        codAmountEl.textContent = formatCurrency(codCollect);
        codAmountEl.className = 'text-xl font-bold text-orange-600';
        codNoteEl.classList.add('hidden');
    }

    if (isNewOrderDepositPanelOpen() && totalRevenue > 0) {
        updateDepositPresetButtons({ total: totalRevenue, onChange: updateOrderSummary });
    } else {
        const presetWrap = document.getElementById('newOrderDepositPresets');
        if (presetWrap) {
            presetWrap.innerHTML = '';
            presetWrap.classList.add('hidden');
        }
    }

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
    
    // Update total costs (packaging + shipping + tax) - displayed in collapsed view
    const totalCostsWithoutCommission = totalPackaging + shippingCost + tax;
    document.getElementById('profitTotalCosts').textContent = formatCurrency(totalCostsWithoutCommission);
    
    // Update individual cost items (shown when expanded)
    document.getElementById('profitPackaging').textContent = formatCurrency(totalPackaging);
    
    // Dynamically update packaging items
    updatePackagingItemsDisplay();
    
    document.getElementById('profitShipping').textContent = formatCurrency(shippingCost);
    
    // Update commission display
    const commissionRow = document.getElementById('profitCommissionRow');
    const commissionLabel = document.getElementById('profitCommissionLabel');
    const commissionValue = document.getElementById('profitCommission');
    
    if (referralCode && commission > 0) {
        // Show commission row
        if (commissionRow) commissionRow.classList.remove('hidden');
        commissionLabel.textContent = `- Hoa hồng (${(commissionRate * 100).toFixed(1)}%)`;
        commissionValue.textContent = formatCurrency(commission);
    } else {
        // Hide commission row when no referral code
        if (commissionRow) commissionRow.classList.add('hidden');
        commissionLabel.textContent = '- Hoa hồng';
        commissionValue.textContent = '0đ';
    }

    // Update tax display (in expanded view)
    const taxLabel = document.getElementById('profitTaxLabel');
    const taxValue = document.getElementById('profitTax');
    if (tax > 0) {
        taxLabel.textContent = `• Thuế (${(taxRate * 100).toFixed(1)}%)`;
        taxValue.textContent = formatCurrency(tax);
    } else {
        taxLabel.textContent = '• Thuế';
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

/** Index dòng đang sửa giá nhanh (null = không có). field: 'unit' | 'total' */
let _quickEditOrderPriceIndex = null;
let _quickEditOrderPriceField = 'unit';

/** Index dòng đang sửa tên nhanh (null = không có). Chỉ đổi tên trên đơn, không sửa DB sản phẩm. */
let _quickEditOrderNameIndex = null;

/** Index dòng đang sửa cân nặng/size nhanh (null = không có). Chỉ trên đơn hiện tại. */
let _quickEditOrderWeightIndex = null;

/** Index dòng đang sửa lưu ý nhanh (null = không có). Chỉ trên đơn hiện tại. */
let _quickEditOrderNotesIndex = null;

/** Commit các quick-edit khác trước khi mở field mới. */
function commitOtherOrderQuickEdits(skipField, skipIndex) {
    if (_quickEditOrderPriceIndex !== null
        && (skipField !== 'price' || _quickEditOrderPriceIndex !== skipIndex)) {
        commitQuickEditOrderPrice(_quickEditOrderPriceIndex);
    }
    if (_quickEditOrderNameIndex !== null
        && (skipField !== 'name' || _quickEditOrderNameIndex !== skipIndex)) {
        commitQuickEditOrderName(_quickEditOrderNameIndex);
    }
    if (_quickEditOrderWeightIndex !== null
        && (skipField !== 'weight' || _quickEditOrderWeightIndex !== skipIndex)) {
        commitQuickEditOrderWeight(_quickEditOrderWeightIndex);
    }
    if (_quickEditOrderNotesIndex !== null
        && (skipField !== 'notes' || _quickEditOrderNotesIndex !== skipIndex)) {
        commitQuickEditOrderNotes(_quickEditOrderNotesIndex);
    }
}

/** Giá trị cân/size gốc trên dòng đơn (ưu tiên size, fallback weight). */
function getOrderProductSizeRaw(product) {
    return normalizeOrderItemSizeClient(product.size ?? null)
        || normalizeOrderItemSizeClient(product.weight ?? null)
        || '';
}

/** HTML dòng cân nặng/size có thể click để sửa nhanh. */
function buildOrderProductWeightLine(index, product) {
    if (typeof orderLineItemSkipsWeight === 'function' && orderLineItemSkipsWeight(product)) {
        return '';
    }
    const rawValue = getOrderProductSizeRaw(product);
    const weightBtnClass = 'order-weight-quick-edit inline text-gray-700 font-medium underline decoration-dotted underline-offset-2 hover:text-amber-700 hover:bg-amber-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer';
    const missingBtnClass = 'order-weight-quick-edit inline text-amber-600 font-medium underline decoration-dotted underline-offset-2 hover:text-amber-800 hover:bg-amber-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer';
    const sizeIcon = `<span class="inline-flex items-center align-text-bottom mr-1.5 text-blue-600">${ORDER_PRODUCT_META_DOT}</span>`;

    const makeBtn = (displayText, btnClass) =>
        `<button type="button" id="orderProductWeightBtn_${index}" class="${btnClass}" onclick="startQuickEditOrderWeight(${index})" title="Click để sửa cân nặng/size (chỉ trên đơn này)">${escapeHtml(displayText)}</button>`;

    if (!rawValue) {
        return `${sizeIcon}${makeBtn('Chưa có', missingBtnClass)}`;
    }

    const rawStr = String(rawValue).toLowerCase();
    if (rawStr.includes('cm') || rawStr.includes('tay')) {
        return `${sizeIcon}Size tay: ${makeBtn(rawValue, weightBtnClass)}`;
    }
    if (rawStr.includes('kg') || rawStr.includes('g')) {
        return `${sizeIcon}${makeBtn(rawValue, weightBtnClass)}`;
    }
    if (!isNaN(parseFloat(rawStr))) {
        return `${sizeIcon}${makeBtn(`${rawValue}kg`, weightBtnClass)}`;
    }
    return `${sizeIcon}${makeBtn(rawValue, weightBtnClass)}`;
}

/** HTML dòng lưu ý có thể click để sửa nhanh. */
function buildOrderProductNotesHtml(index, product) {
    const notes = (product.notes || '').trim();
    const noteBtnClass = 'order-notes-quick-edit flex-1 min-w-0 text-xs text-gray-600 italic text-left underline decoration-dotted underline-offset-2 hover:text-amber-700 hover:bg-amber-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer';
    const missingBtnClass = 'order-notes-quick-edit text-xs text-gray-400 italic underline decoration-dotted underline-offset-2 hover:text-amber-600 hover:bg-amber-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer';
    const displayText = notes || 'Thêm lưu ý';
    const btnClass = notes ? noteBtnClass : missingBtnClass;

    return `
        <div class="mt-1 flex items-start gap-1">
            <svg class="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <button type="button" id="orderProductNotesBtn_${index}" class="${btnClass}" onclick="startQuickEditOrderNotes(${index})" title="Click để sửa lưu ý (chỉ trên đơn này)">${escapeHtml(displayText)}</button>
        </div>
    `;
}

/**
 * Bắt đầu sửa nhanh đơn giá hoặc tổng tiền — thay nút bằng input tại chỗ.
 * @param {number} index
 * @param {'unit'|'total'} [field]
 */
function startQuickEditOrderPrice(index, field = 'unit') {
    const editField = field === 'total' ? 'total' : 'unit';
    const product = currentOrderProducts[index];
    if (!product) return;

    const inputId = editField === 'total'
        ? `orderProductSubtotalInput_${index}`
        : `orderProductPriceInput_${index}`;
    const existingInput = document.getElementById(inputId);
    if (existingInput) {
        existingInput.focus();
        existingInput.select();
        return;
    }

    commitOtherOrderQuickEdits('price', index);
    if (_quickEditOrderPriceIndex === index && _quickEditOrderPriceField !== editField) {
        commitQuickEditOrderPrice(index);
    }

    const btnId = editField === 'total'
        ? `orderProductSubtotal_${index}`
        : `orderProductPriceBtn_${index}`;
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const quantity = Math.max(1, parseInt(product.quantity, 10) || 1);
    const unitPrice = parsePrice(product.price);
    const displayValue = editField === 'total' ? unitPrice * quantity : unitPrice;

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.id = inputId;
    input.dataset.priceField = editField;
    input.className = 'order-price-quick-input w-[5.5rem] px-1.5 py-0.5 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none';
    input.value = formatVnIntegerString(displayValue);
    input.setAttribute('aria-label', editField === 'total' ? 'Tổng tiền' : 'Đơn giá');
    input.autocomplete = 'off';

    btn.replaceWith(input);
    _quickEditOrderPriceIndex = index;
    _quickEditOrderPriceField = editField;

    input.addEventListener('input', () => {
        if (typeof formatVnMoneyInput === 'function') formatVnMoneyInput(input);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelQuickEditOrderPrice(index);
        }
    });
    input.addEventListener('blur', () => {
        if (_quickEditOrderPriceIndex === index) {
            commitQuickEditOrderPrice(index);
        }
    });

    input.focus();
    input.select();
}

/**
 * Lưu đơn giá / tổng tiền sau sửa nhanh.
 * @param {number} index
 */
function commitQuickEditOrderPrice(index) {
    if (_quickEditOrderPriceIndex !== index) return;

    const input = document.getElementById(`orderProductPriceInput_${index}`)
        || document.getElementById(`orderProductSubtotalInput_${index}`);
    const product = currentOrderProducts[index];
    const editField = input?.dataset?.priceField || _quickEditOrderPriceField || 'unit';
    _quickEditOrderPriceIndex = null;
    _quickEditOrderPriceField = 'unit';

    if (!input || !product) {
        renderOrderProducts();
        return;
    }

    const quantity = Math.max(1, parseInt(product.quantity, 10) || 1);
    const parsed = parsePrice(input.value);
    const oldUnitPrice = parsePrice(product.price);

    if (parsed <= 0) {
        showToast(editField === 'total' ? 'Tổng tiền phải lớn hơn 0' : 'Đơn giá phải lớn hơn 0', 'warning');
        renderOrderProducts();
        return;
    }

    const newUnitPrice = editField === 'total'
        ? Math.round(parsed / quantity)
        : parsed;

    if (newUnitPrice <= 0) {
        showToast('Đơn giá sau chia phải lớn hơn 0', 'warning');
        renderOrderProducts();
        return;
    }

    if (newUnitPrice !== oldUnitPrice) {
        product.price = newUnitPrice;
    }

    renderOrderProducts();
}

/** Hủy sửa nhanh đơn giá / tổng tiền (Esc). */
function cancelQuickEditOrderPrice(index) {
    if (_quickEditOrderPriceIndex !== index) return;
    _quickEditOrderPriceIndex = null;
    _quickEditOrderPriceField = 'unit';
    renderOrderProducts();
}

/**
 * Bắt đầu sửa nhanh tên sản phẩm trên đơn — thay text bằng input tại chỗ.
 * @param {number} index
 */
function startQuickEditOrderName(index) {
    const product = currentOrderProducts[index];
    if (!product) return;

    const inputId = `orderProductNameInput_${index}`;
    const existingInput = document.getElementById(inputId);
    if (existingInput) {
        existingInput.focus();
        existingInput.select();
        return;
    }

    commitOtherOrderQuickEdits('name', index);

    const btn = document.getElementById(`orderProductNameBtn_${index}`);
    if (!btn) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'order-name-quick-input flex-1 min-w-0 px-1.5 py-0.5 text-sm font-medium text-gray-900 bg-white border border-purple-300 rounded focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none';
    input.value = product.name || '';
    input.setAttribute('aria-label', 'Tên sản phẩm trên đơn');
    input.autocomplete = 'off';

    btn.replaceWith(input);
    _quickEditOrderNameIndex = index;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelQuickEditOrderName(index);
        }
    });
    input.addEventListener('blur', () => {
        if (_quickEditOrderNameIndex === index) {
            commitQuickEditOrderName(index);
        }
    });

    input.focus();
    input.select();
}

/**
 * Lưu tên sản phẩm sau sửa nhanh (chỉ trên dòng đơn hiện tại).
 * @param {number} index
 */
function commitQuickEditOrderName(index) {
    if (_quickEditOrderNameIndex !== index) return;

    const input = document.getElementById(`orderProductNameInput_${index}`);
    const product = currentOrderProducts[index];
    _quickEditOrderNameIndex = null;

    if (!input || !product) {
        renderOrderProducts();
        return;
    }

    const newName = input.value.trim();
    if (!newName) {
        showToast('Tên sản phẩm không được để trống', 'warning');
        renderOrderProducts();
        return;
    }

    if (newName !== product.name) {
        product.name = newName;
    }

    renderOrderProducts();
}

/** Hủy sửa nhanh tên sản phẩm (Esc). */
function cancelQuickEditOrderName(index) {
    if (_quickEditOrderNameIndex !== index) return;
    _quickEditOrderNameIndex = null;
    renderOrderProducts();
}

/**
 * Bắt đầu sửa nhanh cân nặng/size trên đơn — thay text bằng input tại chỗ.
 * @param {number} index
 */
function startQuickEditOrderWeight(index) {
    const product = currentOrderProducts[index];
    if (!product) return;

    const inputId = `orderProductWeightInput_${index}`;
    const existingInput = document.getElementById(inputId);
    if (existingInput) {
        existingInput.focus();
        existingInput.select();
        return;
    }

    commitOtherOrderQuickEdits('weight', index);

    const btn = document.getElementById(`orderProductWeightBtn_${index}`);
    if (!btn) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'order-weight-quick-input w-24 px-1.5 py-0.5 text-xs font-medium text-gray-900 bg-white border border-amber-300 rounded focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none';
    input.value = getOrderProductSizeRaw(product);
    input.placeholder = 'VD: 5kg';
    input.setAttribute('aria-label', 'Cân nặng/size trên đơn');
    input.autocomplete = 'off';

    btn.replaceWith(input);
    _quickEditOrderWeightIndex = index;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelQuickEditOrderWeight(index);
        }
    });
    input.addEventListener('blur', () => {
        if (_quickEditOrderWeightIndex === index) {
            commitQuickEditOrderWeight(index);
        }
    });

    input.focus();
    input.select();
}

/**
 * Lưu cân nặng/size sau sửa nhanh (chỉ trên dòng đơn hiện tại).
 * @param {number} index
 */
function commitQuickEditOrderWeight(index) {
    if (_quickEditOrderWeightIndex !== index) return;

    const input = document.getElementById(`orderProductWeightInput_${index}`);
    const product = currentOrderProducts[index];
    _quickEditOrderWeightIndex = null;

    if (!input || !product) {
        renderOrderProducts();
        return;
    }

    const normalized = normalizeOrderItemSizeClient(input.value.trim() || null);
    const oldRaw = getOrderProductSizeRaw(product);

    if (normalized !== oldRaw) {
        if (normalized) {
            product.size = normalized;
        } else {
            delete product.size;
        }
        delete product.weight;
    }

    renderOrderProducts();
}

/** Hủy sửa nhanh cân nặng/size (Esc). */
function cancelQuickEditOrderWeight(index) {
    if (_quickEditOrderWeightIndex !== index) return;
    _quickEditOrderWeightIndex = null;
    renderOrderProducts();
}

/**
 * Bắt đầu sửa nhanh lưu ý trên đơn — thay text bằng input tại chỗ.
 * @param {number} index
 */
function startQuickEditOrderNotes(index) {
    const product = currentOrderProducts[index];
    if (!product) return;

    const inputId = `orderProductNotesInput_${index}`;
    const existingInput = document.getElementById(inputId);
    if (existingInput) {
        existingInput.focus();
        existingInput.select();
        return;
    }

    commitOtherOrderQuickEdits('notes', index);

    const btn = document.getElementById(`orderProductNotesBtn_${index}`);
    if (!btn) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'order-notes-quick-input flex-1 min-w-0 px-1.5 py-0.5 text-xs text-gray-700 italic bg-white border border-amber-300 rounded focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none';
    input.value = (product.notes || '').trim();
    input.placeholder = 'Nhập lưu ý...';
    input.setAttribute('aria-label', 'Lưu ý sản phẩm trên đơn');
    input.autocomplete = 'off';

    btn.replaceWith(input);
    _quickEditOrderNotesIndex = index;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelQuickEditOrderNotes(index);
        }
    });
    input.addEventListener('blur', () => {
        if (_quickEditOrderNotesIndex === index) {
            commitQuickEditOrderNotes(index);
        }
    });

    input.focus();
    input.select();
}

/**
 * Lưu lưu ý sau sửa nhanh (chỉ trên dòng đơn hiện tại).
 * @param {number} index
 */
function commitQuickEditOrderNotes(index) {
    if (_quickEditOrderNotesIndex !== index) return;

    const input = document.getElementById(`orderProductNotesInput_${index}`);
    const product = currentOrderProducts[index];
    _quickEditOrderNotesIndex = null;

    if (!input || !product) {
        renderOrderProducts();
        return;
    }

    const newNotes = input.value.trim();
    const oldNotes = (product.notes || '').trim();

    if (newNotes !== oldNotes) {
        if (newNotes) {
            product.notes = newNotes;
        } else {
            delete product.notes;
        }
    }

    renderOrderProducts();
}

/** Hủy sửa nhanh lưu ý (Esc). */
function cancelQuickEditOrderNotes(index) {
    if (_quickEditOrderNotesIndex !== index) return;
    _quickEditOrderNotesIndex = null;
    renderOrderProducts();
}

/** Nút thao tác trên card SP trong modal thêm đơn: Sửa | Đổi (nếu có product_id) | Xóa */
function buildOrderProductActionButtons(index, product) {
    const btnBase = 'w-7 h-7 rounded-lg transition-colors flex items-center justify-center';
    const editBtn = `<button type="button" onclick="editProductInOrder(${index})" class="${btnBase} bg-blue-50 hover:bg-blue-100 text-blue-600" title="Sửa thông tin sản phẩm trên đơn">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        </button>`;
    const replaceBtn = product.product_id
        ? `<button type="button" onclick="replaceProductInOrder(${index})" class="${btnBase} bg-amber-50 hover:bg-amber-100 text-amber-600" title="Đổi sang sản phẩm khác">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
        </button>`
        : '';
    const deleteBtn = `<button type="button" onclick="removeProductFromOrder(${index})" class="${btnBase} bg-red-50 hover:bg-red-100 text-red-600" title="Xóa">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>`;
    return `${editBtn}${replaceBtn}${deleteBtn}`;
}

/**
 * Render order products list in add order modal
 * Displays all products with edit/remove buttons
 */
function renderOrderProducts() {
    _quickEditOrderPriceIndex = null;
    _quickEditOrderPriceField = 'unit';
    _quickEditOrderNameIndex = null;
    _quickEditOrderWeightIndex = null;
    _quickEditOrderNotesIndex = null;

    const container = document.getElementById('newOrderProductsList');
    if (!container) {
        console.warn('⚠️ Products list container not found');
        return;
    }

    if (currentOrderProducts.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4 text-sm italic">Chưa có sản phẩm nào</p>';
        autoUpdateFreeshipCheckbox();
        return;
    }

    container.innerHTML = currentOrderProducts.map((product, index) => {
        // Parse price correctly using helper function
        const price = parsePrice(product.price);
        const quantity = parseInt(product.quantity) || 1;
        const subtotal = price * quantity;
        
        // Build product info with quantity badge
        const quantityBadge = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-sm">×${quantity}</span>`;
        
        // Product details on same line with proper labels
        let detailsLine = [];

        const weightLine = buildOrderProductWeightLine(index, product);
        if (weightLine) detailsLine.push(weightLine);
        const priceBtn = `<button type="button" id="orderProductPriceBtn_${index}"
            class="order-price-quick-edit inline text-blue-600 font-semibold underline decoration-dotted underline-offset-2 hover:text-blue-800 hover:bg-blue-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer"
            onclick="startQuickEditOrderPrice(${index}, 'unit')" title="Click để sửa đơn giá">${formatCurrency(price)}</button>`;
        detailsLine.push(`🏷️ Đơn giá: ${priceBtn}`);

        const nameBtn = `<button type="button" id="orderProductNameBtn_${index}"
            class="order-name-quick-edit flex-1 min-w-0 text-sm font-medium text-gray-900 truncate text-left hover:text-purple-700 hover:bg-purple-50 rounded px-0.5 -mx-0.5 transition-colors cursor-pointer underline decoration-dotted underline-offset-2 decoration-transparent hover:decoration-purple-300"
            onclick="startQuickEditOrderName(${index})" title="Click để sửa tên sản phẩm (chỉ trên đơn này)">${escapeHtml(product.name)}</button>`;

        const notesHtml = buildOrderProductNotesHtml(index, product);

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                <!-- Top row: Badge + Name | Edit + Delete buttons -->
                <div class="flex items-start justify-between gap-3 mb-2">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        ${quantityBadge}
                        ${nameBtn}
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        ${buildOrderProductActionButtons(index, product)}
                    </div>
                </div>
                
                <!-- Bottom row: Details (left) | Total price (right) -->
                <div class="flex items-end justify-between gap-3">
                    <div class="flex-1 min-w-0 ml-9">
                        <p class="text-xs text-gray-500">${detailsLine.join(' • ')}</p>
                        ${notesHtml}
                    </div>
                    <div class="flex-shrink-0 text-right">
                        <button type="button" id="orderProductSubtotal_${index}"
                            class="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline decoration-dotted underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0"
                            onclick="startQuickEditOrderPrice(${index}, 'total')" title="Click để sửa tổng tiền">${formatCurrency(subtotal)}</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Sau khi render xong → kiểm tra và auto-check freeship nếu đủ điều kiện
    autoUpdateFreeshipCheckbox();
    updateOrderSummary();
}

function autoUpdateFreeshipCheckbox() {
    const checkbox = document.getElementById('freeShippingCheckbox');
    if (!checkbox) return;

    const should = _shouldFreeship(currentOrderProducts);
    if (checkbox.checked !== should) {
        checkbox.checked = should;
        toggleFreeShipping();
    }
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
