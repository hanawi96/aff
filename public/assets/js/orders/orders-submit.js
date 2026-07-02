// ============================================
// ORDER SUBMISSION
// ============================================
// Handles submitting new orders and updating existing orders

console.log('📤 Loading orders-submit.js');

/**
 * Submit new order
 * Collects form data and sends to API to create new order
 */
async function submitNewOrder() {
    console.log('📝 submitNewOrder called');

    // Validate required fields
    const customerName = document.getElementById('newOrderCustomerName')?.value.trim();
    const customerPhone = document.getElementById('newOrderCustomerPhone')?.value.trim();
    const addressPreview = document.getElementById('newOrderAddressPreview')?.textContent.trim();
    const address = document.getElementById('newOrderAddress')?.value.trim();

    if (!customerName) {
        showOrderFormValidationWarning('Vui lòng nhập tên khách hàng', document.getElementById('newOrderCustomerName'));
        return;
    }

    if (!customerPhone) {
        showOrderFormValidationWarning('Vui lòng nhập số điện thoại', document.getElementById('newOrderCustomerPhone'));
        return;
    }

    const editDbIdRawEarly = document.getElementById('orderFormEditDbId')?.value?.trim();
    const preserveLegacyAddress = !!editDbIdRawEarly &&
        typeof deskAddressMode !== 'undefined' &&
        deskAddressMode === 'legacy' &&
        !!deskLegacyOrderRef;

    // Check if address is selected (not default text) — bỏ qua khi giữ địa chỉ 3 cấp cũ
    if (!preserveLegacyAddress && (!address || address === '' || (typeof isOrderAddressPreviewEmpty === 'function'
        ? isOrderAddressPreviewEmpty(addressPreview)
        : addressPreview === 'Vui lòng chọn địa chỉ' || addressPreview === 'Địa chỉ đầy đủ: Vui lòng chọn địa chỉ'))) {
        showOrderFormValidationWarning(
            'Vui lòng chọn địa chỉ giao hàng đầy đủ',
            document.querySelector('#deskAddrChips [data-desk-open]') || document.getElementById('newOrderProvince')
        );
        return;
    }

    if (currentOrderProducts.length === 0) {
        showOrderFormValidationWarning('Vui lòng thêm ít nhất 1 sản phẩm');
        return;
    }

    if (typeof getCustomerSourceSelection === 'function' && !getCustomerSourceSelection()) {
        if (typeof warnCustomerSourceRequired === 'function') {
            warnCustomerSourceRequired();
        } else {
            showOrderFormValidationWarning('Vui lòng chọn nguồn khách');
        }
        return;
    }

    // Collect form data
    const paymentMethod = orderPaymentApiKey(document.getElementById('newOrderPaymentMethod')?.value || 'cod');
    const sendLaterCb = document.getElementById('newOrderSendLater');
    let status = document.getElementById('newOrderStatus')?.value || 'pending';
    let planned_send_at_unix = null;
    if (sendLaterCb?.checked) {
        const dt = document.getElementById('newOrderPlannedSendAt')?.value?.trim();
        if (!dt) {
            showOrderFormValidationWarning('Vui lòng chọn ngày giờ dự kiến gửi', document.getElementById('newOrderPlannedSendAt'));
            return;
        }
        const t = new Date(dt).getTime();
        if (!Number.isFinite(t)) {
            showOrderFormValidationWarning('Ngày giờ dự kiến gửi không hợp lệ', document.getElementById('newOrderPlannedSendAt'));
            return;
        }
        planned_send_at_unix = t;
        status = 'send_later';
    } else {
        planned_send_at_unix = null;
    }
    const referralCode = document.getElementById('newOrderReferralCode')?.value.trim() || '';
    const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value) || 0;
    const shippingCost = parseFloat(document.getElementById('newOrderShippingCost')?.value) || 0;
    const orderNotes = document.getElementById('newOrderNotes')?.value.trim() || '';
    const priorityCheckbox = document.getElementById('newOrderPriority');
    const isPriority = priorityCheckbox?.checked ? 1 : 0;

    // Get address data (2 cấp: Tỉnh/TP → Phường/Xã) — hoặc bảo toàn 3 cấp cũ
    let provinceId;
    let wardId;
    let streetAddress;
    let provinceName;
    let wardName;
    let districtId;
    let districtName;
    let finalAddress;

    if (preserveLegacyAddress) {
        const o = deskLegacyOrderRef;
        provinceId = o.province_id || null;
        wardId = o.ward_id || null;
        streetAddress = o.street_address || null;
        provinceName = o.province_name || null;
        wardName = o.ward_name || null;
        districtId = o.district_id || null;
        districtName = o.district_name || null;
        finalAddress = o.address || formatLegacyOrderAddressDisplay(o);
    } else {
        const provinceSelect = document.getElementById('newOrderProvince');
        const wardSelect = document.getElementById('newOrderWard');

        provinceId = provinceSelect?.value?.trim() || null;
        wardId = wardSelect?.value?.trim() || null;
        streetAddress = document.getElementById('newOrderStreetAddress')?.value.trim() || null;

        provinceName = (provinceId && (
            window.addressSelector?.loaded
                ? window.addressSelector.getProvinceName(provinceId)
                : null
        ) || provinceSelect?.selectedOptions[0]?.text) || null;
        wardName = (wardId && (
            window.addressSelector?.loaded
                ? window.addressSelector.getWardName(provinceId, wardId)
                : null
        ) || wardSelect?.selectedOptions[0]?.text) || null;
        districtId = null;
        districtName = null;
        finalAddress = address;
    }

    // Get discount data (giảm thủ công: không gửi discount_id — đồng bộ mobile)
    let discountId = document.getElementById('appliedDiscountId')?.value?.trim() || null;
    if (!discountId) discountId = null;
    let discountCode = document.getElementById('appliedDiscountCode')?.value?.trim() || null;
    if (!discountCode) discountCode = null;
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value) || 0;
    const discSource = document.getElementById('appliedDiscountSource')?.value || '';
    if (
        discSource === 'manual' ||
        (typeof isDeskManualStoredCode === 'function' && discountCode && isDeskManualStoredCode(discountCode))
    ) {
        discountId = null;
        if (discountAmount > 0) {
            discountCode =
                typeof DESK_MANUAL_DISCOUNT_CODE !== 'undefined' ? DESK_MANUAL_DISCOUNT_CODE : discountCode;
        } else {
            discountCode = null;
        }
    }

    if (discountAmount <= 0) {
        discountId = null;
        discountCode = null;
    }

    // CRITICAL: Sanitize products to ensure prices are numbers before saving
    const sanitizedProducts = currentOrderProducts.map(product => {
        const cleanProduct = { ...product };
        
        // Ensure price is a number
        if (cleanProduct.price !== undefined && cleanProduct.price !== null) {
            cleanProduct.price = parsePrice(cleanProduct.price);
        }
        
        // Ensure cost_price is a number
        if (cleanProduct.cost_price !== undefined && cleanProduct.cost_price !== null) {
            cleanProduct.cost_price = parsePrice(cleanProduct.cost_price);
        }

        // Cân/size: không lưu chuỗi "chưa có" — gửi null (backend cũng chuẩn hóa)
        cleanProduct.size = normalizeOrderItemSizeClient(cleanProduct.size);
        cleanProduct.weight = normalizeOrderItemSizeClient(cleanProduct.weight);
        if (cleanProduct.size == null) delete cleanProduct.size;
        if (cleanProduct.weight == null) delete cleanProduct.weight;
        
        return cleanProduct;
    });

    // Calculate totals using sanitized products
    const productTotal = sanitizedProducts.reduce((sum, p) => {
        const price = p.price || 0; // Already parsed as number
        const qty = parseInt(p.quantity) || 1;
        return sum + (price * qty);
    }, 0);

    const totalAmount = productTotal + shippingFee - discountAmount;

    let depositAmount = getNewOrderDepositAmount();
    if (depositAmount > 0 && depositAmount >= totalAmount) {
        showOrderFormValidationWarning('Tiền cọc phải nhỏ hơn giá trị đơn hàng', document.getElementById('newOrderDepositAmount'));
        return;
    }

    const editDbIdRaw = editDbIdRawEarly;
    const isUpdate = !!editDbIdRaw;

    // Prepare order data (tạo mới: có orderId + orderDate; sửa: backend giữ mã đơn & mốc thời gian)
    const orderData = {
        customer: {
            name: customerName,
            phone: customerPhone
        },
        address: finalAddress,
        province_id: provinceId,
        province_name: provinceName,
        district_id: districtId,
        district_name: districtName,
        ward_id: wardId,
        ward_name: wardName,
        street_address: streetAddress,
        paymentMethod: paymentMethod,
        payment_method: paymentMethod,
        status: status,
        planned_send_at_unix: planned_send_at_unix,
        referralCode: referralCode || null,
        shippingFee: shippingFee,
        shipping_fee: shippingFee,
        shippingCost: shippingCost,
        shipping_cost: shippingCost,
        total: totalAmount,
        totalAmount: totalAmount,
        cart: sanitizedProducts, // Use sanitized products with numeric prices
        notes: orderNotes || null,
        discount_id: discountId,
        discountCode: discountCode,
        discount_code: discountCode,
        discountAmount: discountAmount,
        discount_amount: discountAmount,
        deposit_amount: depositAmount,
        depositAmount: depositAmount,
        is_priority: isPriority,
        isPriority: isPriority,
        customer_source: typeof getCustomerSourceSelection === 'function' ? getCustomerSourceSelection() : null,
        customerSource: typeof getCustomerSourceSelection === 'function' ? getCustomerSourceSelection() : null
    };

    if (!isUpdate) {
        orderData.orderId = 'DH' + Date.now();
        orderData.orderDate = Date.now();
    }

    const submitButton = document.getElementById('orderFormSubmitBtn');
    const originalHTML = submitButton?.innerHTML;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = `<svg class="animate-spin h-5 w-5 inline-block mr-2" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${isUpdate ? 'Đang lưu...' : 'Đang tạo...'}`;
    }

    try {
        const startTime = performance.now();

        const apiUrl = isUpdate
            ? `${CONFIG.API_URL}/api/order/update`
            : `${CONFIG.API_URL}/api/order/create`;
        const requestBody = isUpdate
            ? { ...orderData, orderDbId: Number(editDbIdRaw) }
            : orderData;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        
        // Log performance
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        console.log(`⏱️ Order ${isUpdate ? 'update' : 'create'} in ${duration}ms (${currentOrderProducts.length} products)`);

        if (response.ok && result.success) {
            showToast(isUpdate ? 'Đã cập nhật đơn hàng!' : 'Tạo đơn hàng thành công!', 'success');
            
            // Learn from this address (async, don't wait)
            if (!isUpdate && streetAddress && wardId && wardName) {
                learnFromAddress(streetAddress, null, parseInt(wardId, 10), wardName)
                    .then(r => { if (r.success) console.log('📚 Address learned:', r.keywords_saved, 'keywords'); })
                    .catch(err => console.error('❌ Learning error:', err));
            }
            
            closeAddOrderModal(true);
            if (typeof clearOrderDraft === 'function') clearOrderDraft();

            // Đơn "Gửi sau": đặt bộ lọc trước render (tránh filterOrdersData lần 2)
            if (status === 'send_later') {
                const statusEl = document.getElementById('statusFilter');
                const labelEl = document.getElementById('statusFilterLabel');
                if (statusEl) statusEl.value = 'send_later';
                if (labelEl) labelEl.textContent = 'Gửi sau';
                amountSortOrder = 'none';
                if (typeof updateAmountSortIcon === 'function') updateAmountSortIcon();
            }

            if (typeof refreshOrdersListAfterMutation === 'function') {
                await refreshOrdersListAfterMutation(result);
            } else {
                await loadOrdersData({ skipCache: true });
            }

            console.log('✅ Order saved:', result.order || result.orderId);
        } else {
            throw new Error(result.message || result.error || (isUpdate ? 'Không thể cập nhật đơn hàng' : 'Không thể tạo đơn hàng'));
        }
    } catch (error) {
        console.error('❌ Error submitting order:', error);
        showToast(`Lỗi: ${error.message}`, 'error');
    } finally {
        // Restore button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalHTML;
        }
    }
}

// Note: setupCustomerCheck() is defined in orders-customer.js

/**
 * Setup shipping cost sync with shipping fee
 * Auto-sync shipping cost when shipping fee changes
 */
function setupShippingCostSync() {
    const shippingFeeInput = document.getElementById('newOrderShippingFee');
    const shippingCostInput = document.getElementById('newOrderShippingCost');

    if (!shippingFeeInput || !shippingCostInput) return;

    // Auto-sync shipping cost with shipping fee (with 5k difference)
    shippingFeeInput.addEventListener('input', function () {
        const fee = parseFloat(this.value) || 0;
        // Auto-calculate cost as fee - 5000 (but minimum 0)
        const cost = Math.max(0, fee - 5000);
        shippingCostInput.value = cost;
        
        // Update order summary
        updateOrderSummary();
    });
}

