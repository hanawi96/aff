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
        showToast('Vui lòng nhập tên khách hàng', 'warning');
        document.getElementById('newOrderCustomerName')?.focus();
        return;
    }

    if (!customerPhone) {
        showToast('Vui lòng nhập số điện thoại', 'warning');
        document.getElementById('newOrderCustomerPhone')?.focus();
        return;
    }

    // Check if address is selected (not default text)
    if (!address || address === '' || addressPreview === 'Vui lòng chọn địa chỉ') {
        showToast('Vui lòng chọn địa chỉ giao hàng đầy đủ', 'warning');
        document.getElementById('newOrderProvince')?.focus();
        return;
    }

    if (currentOrderProducts.length === 0) {
        showToast('Vui lòng thêm ít nhất 1 sản phẩm', 'warning');
        return;
    }

    // Collect form data
    const paymentMethod = document.getElementById('newOrderPaymentMethod')?.value || 'cod';
    const status = document.getElementById('newOrderStatus')?.value || 'pending';
    const referralCode = document.getElementById('newOrderReferralCode')?.value.trim() || '';
    const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value) || 0;
    const shippingCost = parseFloat(document.getElementById('newOrderShippingCost')?.value) || 0;
    const orderNotes = document.getElementById('newOrderNotes')?.value.trim() || '';
    const priorityCheckbox = document.getElementById('newOrderPriority');
    const isPriority = priorityCheckbox?.checked ? 1 : 0;

    // Get address data (IDs are now strings in database - no conversion needed)
    const provinceSelect = document.getElementById('newOrderProvince');
    const districtSelect = document.getElementById('newOrderDistrict');
    const wardSelect = document.getElementById('newOrderWard');
    
    // Get string values directly (already in correct format)
    const provinceId = provinceSelect?.value?.trim() || null;
    const districtId = districtSelect?.value?.trim() || null;
    const wardId = wardSelect?.value?.trim() || null;
    const streetAddress = document.getElementById('newOrderStreetAddress')?.value.trim() || null;
    
    // Get names from selected options
    const provinceName = (provinceId && provinceSelect?.selectedOptions[0]?.text) || null;
    const districtName = (districtId && districtSelect?.selectedOptions[0]?.text) || null;
    const wardName = (wardId && wardSelect?.selectedOptions[0]?.text) || null;

    // Get discount data
    const discountId = document.getElementById('appliedDiscountId')?.value || null;
    const discountCode = document.getElementById('appliedDiscountCode')?.value || null;
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value) || 0;

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

    // Get current Vietnam time (browser timezone)
    const orderDate = Date.now(); // Milliseconds since epoch in user's timezone

    // Prepare order data
    const orderData = {
        orderId: 'DH' + Date.now(), // Generate order ID
        orderDate: orderDate, // Send Vietnam time from browser
        customer: {
            name: customerName,
            phone: customerPhone
        },
        address: address,
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
        is_priority: isPriority
    };

    // Show loading state
    const submitButton = event?.target;
    const originalText = submitButton?.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang tạo...';
    }

    try {
        // Measure order creation time
        const startTime = performance.now();
        
        const response = await fetch(`${CONFIG.API_URL}/api/order/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        
        // Log performance
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        console.log(`⏱️ Order created in ${duration}ms (${currentOrderProducts.length} products)`);
        
        // Show performance indicator
        if (duration < 150) {
            console.log('🚀 Performance: Excellent!');
        } else if (duration < 300) {
            console.log('✅ Performance: Good');
        } else {
            console.log('⚠️ Performance: Slow');
        }

        if (response.ok && result.success) {
            showToast('✅ Tạo đơn hàng thành công!', 'success');
            
            // Learn from this address (async, don't wait)
            console.log('🔍 Learning check:', {
                streetAddress,
                districtId,
                wardId,
                wardName,
                hasFunction: typeof learnFromAddress !== 'undefined'
            });
            
            if (streetAddress && districtId && wardId && wardName) {
                console.log('📚 Calling learnFromAddress...');
                learnFromAddress(streetAddress, parseInt(districtId), parseInt(wardId), wardName)
                    .then(result => {
                        console.log('📚 Learning result:', result);
                        if (result.success) {
                            console.log('✅ Address learned:', result.keywords_saved, 'keywords');
                        } else {
                            console.error('❌ Learning failed:', result);
                        }
                    })
                    .catch(err => console.error('❌ Learning error:', err));
            } else {
                console.warn('⚠️ Missing data for learning:', {
                    hasStreet: !!streetAddress,
                    hasDistrict: !!districtId,
                    hasWard: !!wardId,
                    hasWardName: !!wardName
                });
            }
            
            closeAddOrderModal();
            
            // Reload orders data
            loadOrdersData();
            
            // Show success animation or redirect
            console.log('✅ Order created:', result.order);
        } else {
            throw new Error(result.message || 'Không thể tạo đơn hàng');
        }

        // Verify timestamp for debugging
        console.log('✅ Order created successfully');
        console.log('🕐 Timestamp verification:', {
            saved_timestamp: orderData.orderDate,
            saved_as_date: new Date(orderData.orderDate).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            note: 'This timestamp should match Vietnam time when displayed'
        });
    } catch (error) {
        console.error('❌ Error creating order:', error);
        showToast(`Lỗi: ${error.message}`, 'error');
    } finally {
        // Restore button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
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

