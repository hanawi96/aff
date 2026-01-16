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

    if (!address) {
        showToast('Vui lòng nhập địa chỉ giao hàng', 'warning');
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

    // Get discount data
    const discountId = document.getElementById('appliedDiscountId')?.value || null;
    const discountCode = document.getElementById('appliedDiscountCode')?.value || null;
    const discountAmount = parseFloat(document.getElementById('appliedDiscountAmount')?.value) || 0;

    // Calculate totals
    const productTotal = currentOrderProducts.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        const qty = parseInt(p.quantity) || 1;
        return sum + (price * qty);
    }, 0);

    const totalAmount = productTotal + shippingFee - discountAmount;

    // Prepare order data
    const orderData = {
        orderId: 'DH' + Date.now(), // Generate order ID
        customer: {
            name: customerName,
            phone: customerPhone
        },
        address: address,
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
        cart: currentOrderProducts, // Products array
        notes: orderNotes || null,
        discount_id: discountId,
        discountCode: discountCode,
        discount_code: discountCode,
        discountAmount: discountAmount,
        discount_amount: discountAmount
    };

    console.log('📦 Order data:', orderData);

    // Show loading state
    const submitButton = event?.target;
    const originalText = submitButton?.textContent;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang tạo...';
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/order/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('✅ Tạo đơn hàng thành công!', 'success');
            closeAddOrderModal();
            
            // Reload orders data
            loadOrdersData();
            
            // Show success animation or redirect
            console.log('✅ Order created:', result.order);
        } else {
            throw new Error(result.message || 'Không thể tạo đơn hàng');
        }
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

/**
 * Setup customer check on phone input
 * Checks if customer exists when phone number is entered
 */
function setupCustomerCheck() {
    const phoneInput = document.getElementById('newOrderCustomerPhone');
    const nameInput = document.getElementById('newOrderCustomerName');
    const statusHint = document.getElementById('customerStatusHint');

    if (!phoneInput || !nameInput || !statusHint) return;

    let debounceTimer;

    phoneInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        const phone = this.value.trim();

        if (phone.length < 10) {
            statusHint.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${CONFIG.API_URL}/customers/check-phone?phone=${encodeURIComponent(phone)}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                const result = await response.json();

                if (result.exists) {
                    // Customer exists - show info and auto-fill
                    statusHint.innerHTML = `
                        <div class="flex items-center gap-1 text-green-600">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>
                            <span>Khách hàng cũ: ${result.customer.name}</span>
                        </div>
                    `;
                    statusHint.classList.remove('hidden');

                    // Auto-fill name if empty
                    if (!nameInput.value.trim()) {
                        nameInput.value = result.customer.name;
                    }
                } else {
                    // New customer
                    statusHint.innerHTML = `
                        <div class="flex items-center gap-1 text-blue-600">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                            </svg>
                            <span>Khách hàng mới</span>
                        </div>
                    `;
                    statusHint.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error checking customer:', error);
                statusHint.classList.add('hidden');
            }
        }, 500);
    });
}

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

console.log('✅ orders-submit.js loaded');
