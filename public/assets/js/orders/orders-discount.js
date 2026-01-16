/**
 * Orders Discount Code
 * Extracted from orders.js
 * 
 * Dependencies:
 * - currentOrderProducts (global)
 * - updateOrderSummary() from orders-add-modal.js
 * - formatCurrency() from orders-utils.js
 * - showToast() from toast-manager.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// DISCOUNT CODE FUNCTIONS
// ============================================

// Apply discount code
async function applyDiscountCode() {
    const discountCodeInput = document.getElementById('newOrderDiscountCode');
    const discountCode = discountCodeInput?.value.trim().toUpperCase();

    if (!discountCode) {
        showDiscountError('Vui lòng nhập mã giảm giá');
        return;
    }

    // Show loading state
    showDiscountLoading();

    try {
        // Get customer phone for validation
        const customerPhone = document.getElementById('newOrderCustomerPhone')?.value.trim();

        // Calculate current order amount (before discount)
        const productTotal = currentOrderProducts.reduce((sum, p) => {
            const price = p.price || 0;
            const qty = p.quantity || 1;
            return sum + (price * qty);
        }, 0);
        const shippingFee = parseFloat(document.getElementById('newOrderShippingFee')?.value || 0);
        const orderAmount = productTotal + shippingFee;

        // Validate discount code via API
        const response = await fetch(`${CONFIG.API_URL}?action=validateDiscount&code=${encodeURIComponent(discountCode)}&customerPhone=${encodeURIComponent(customerPhone)}&orderAmount=${orderAmount}&timestamp=${Date.now()}`);

        console.log('🔍 Discount validation response:', response.status, response.statusText);

        // Parse JSON response (even for errors)
        const data = await response.json();
        console.log('📦 Discount data:', data);

        // Check if validation failed
        if (!response.ok || !data.success) {
            const errorMessage = data.error || 'Mã giảm giá không hợp lệ';
            console.error('❌ Validation failed:', errorMessage);
            showDiscountError(errorMessage);
            return; // Stop here, don't throw
        }

        if (data.success && data.discount) {
            const discount = data.discount;

            // Calculate discount amount based on type
            let discountAmount = 0;

            if (discount.type === 'fixed') {
                discountAmount = discount.discount_value || 0;
            } else if (discount.type === 'percentage') {
                discountAmount = Math.round(orderAmount * (discount.discount_value / 100));
                // Apply max discount limit if set
                if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
                    discountAmount = discount.max_discount_amount;
                }
            } else if (discount.type === 'freeship') {
                discountAmount = shippingFee; // Free shipping = discount shipping fee
            }

            // Store discount data
            document.getElementById('appliedDiscountId').value = discount.id;
            document.getElementById('appliedDiscountCode').value = discount.code;
            document.getElementById('appliedDiscountAmount').value = discountAmount;
            document.getElementById('appliedDiscountType').value = discount.type;

            // Show success state
            showDiscountSuccess(discount, discountAmount);

            // Update order summary with discount
            updateOrderSummary();

            showToast(`Áp dụng mã ${discount.code} thành công`, 'success');
        }
    } catch (error) {
        console.error('❌ Error applying discount:', error);
        showDiscountError('Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.');
    }
}

// Remove discount code
function removeDiscountCode() {
    // Clear discount data
    document.getElementById('appliedDiscountId').value = '';
    document.getElementById('appliedDiscountCode').value = '';
    document.getElementById('appliedDiscountAmount').value = '0';
    document.getElementById('appliedDiscountType').value = '';
    document.getElementById('newOrderDiscountCode').value = '';

    // Hide discount status
    document.getElementById('discountStatus').classList.add('hidden');
    document.getElementById('discountSuccess').classList.add('hidden');

    // Update order summary
    updateOrderSummary();

    showToast('Đã xóa mã giảm giá', 'info');
}

// Show discount loading state
function showDiscountLoading() {
    const statusDiv = document.getElementById('discountStatus');
    const loadingDiv = document.getElementById('discountLoading');
    const successDiv = document.getElementById('discountSuccess');
    const errorDiv = document.getElementById('discountError');

    statusDiv.classList.remove('hidden');
    loadingDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
}

// Show discount success state
function showDiscountSuccess(discount, discountAmount) {
    const statusDiv = document.getElementById('discountStatus');
    const successDiv = document.getElementById('discountSuccess');
    const loadingDiv = document.getElementById('discountLoading');
    const errorDiv = document.getElementById('discountError');

    // Update success content - Compact version
    document.getElementById('discountTitle').textContent = discount.code;

    let description = '';
    if (discount.type === 'custom') {
        description = discount.title || 'Giảm giá tùy chỉnh';
    } else if (discount.type === 'fixed') {
        description = `Giảm ${formatCurrency(discount.discount_value)}`;
    } else if (discount.type === 'percentage') {
        description = `Giảm ${discount.discount_value}%`;
        if (discount.max_discount_amount) {
            description += ` (max ${formatCurrency(discount.max_discount_amount)})`;
        }
    } else if (discount.type === 'freeship') {
        description = 'Freeship';
    } else if (discount.type === 'gift') {
        description = `Tặng quà`;
    }
    document.getElementById('discountDescription').textContent = description;
    document.getElementById('discountAmountDisplay').textContent = `-${formatCurrency(discountAmount)}`;

    // Show success, hide others
    statusDiv.classList.remove('hidden');
    successDiv.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
}

// Show discount error state
function showDiscountError(message) {
    const statusDiv = document.getElementById('discountStatus');
    const errorDiv = document.getElementById('discountError');
    const loadingDiv = document.getElementById('discountLoading');
    const successDiv = document.getElementById('discountSuccess');

    document.getElementById('discountErrorMessage').textContent = message;

    statusDiv.classList.remove('hidden');
    errorDiv.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    // Show toast for better visibility
    showToast(message, 'error');

    // Auto hide error after 10 seconds (longer for user to read)
    setTimeout(() => {
        errorDiv.classList.add('hidden');
        if (successDiv.classList.contains('hidden')) {
            statusDiv.classList.add('hidden');
        }
    }, 10000);
}
