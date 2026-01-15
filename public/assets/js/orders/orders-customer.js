/**
 * Orders Customer Check
 * Extracted from orders.js
 * 
 * Dependencies:
 * - window.addressSelector from address-selector.js
 * - showToast() from toast-manager.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// CUSTOMER CHECK FEATURE
// ============================================

let customerCheckTimeout = null;

// Setup customer check on phone input
function setupCustomerCheck() {
    const phoneInput = document.getElementById('newOrderCustomerPhone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', function () {
        const phone = this.value.trim();

        // Clear previous timeout
        if (customerCheckTimeout) {
            clearTimeout(customerCheckTimeout);
        }

        // Hide hint if phone is empty or too short
        const hintEl = document.getElementById('customerStatusHint');
        if (!hintEl) return;

        if (phone.length < 10) {
            hintEl.classList.add('hidden');
            return;
        }

        // Show loading state
        hintEl.className = 'mt-1.5 text-xs text-gray-500';
        hintEl.textContent = '🔍 Đang kiểm tra...';
        hintEl.classList.remove('hidden');

        // Debounce: wait 500ms after user stops typing
        customerCheckTimeout = setTimeout(() => {
            checkCustomerStatus(phone);
        }, 500);
    });
}

// Check customer status via API
async function checkCustomerStatus(phone) {
    const hintEl = document.getElementById('customerStatusHint');
    if (!hintEl) return;

    // Validate phone format (Vietnamese phone: 10 digits starting with 0)
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        hintEl.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=checkCustomer&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`);

        if (!response.ok) {
            console.error('API returned error:', response.status);
            hintEl.classList.add('hidden');
            return;
        }

        const data = await response.json();

        if (data.success) {
            if (data.isNew) {
                // New customer
                hintEl.className = 'mt-1.5 text-xs text-blue-600 font-medium';
                hintEl.innerHTML = '✨ Khách hàng mua lần đầu';
            } else {
                // Returning customer with auto-fill button
                hintEl.className = 'mt-1.5 flex items-center gap-2';
                hintEl.innerHTML = `
                    <span class="text-xs text-green-600 font-semibold">🎉 Khách hàng đã mua ${data.orderCount} đơn hàng</span>
                    <button onclick="autoFillLastOrder('${phone}')" 
                        class="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-md font-medium transition-colors flex items-center gap-1"
                        title="Tự động điền thông tin đơn gần nhất">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Tự động điền
                    </button>
                `;
            }
            hintEl.classList.remove('hidden');
        } else {
            console.error('API returned error:', data.error);
            hintEl.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error checking customer:', error);
        hintEl.classList.add('hidden');
    }
}

// Auto-fill form with last order info
async function autoFillLastOrder(phone) {
    try {
        // Show loading toast
        const loadingId = showToast('Đang tải thông tin...', 'info');

        // Get customer detail with last order
        const response = await fetch(`${CONFIG.API_URL}?action=getCustomerDetail&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`);

        if (!response.ok) {
            showToast('Không thể tải thông tin khách hàng', 'error', null, loadingId);
            return;
        }

        const data = await response.json();

        if (data.success && data.customer && data.customer.orders && data.customer.orders.length > 0) {
            const lastOrder = data.customer.orders[0]; // First order is the most recent

            // Fill customer name
            const nameInput = document.getElementById('newOrderCustomerName');
            if (nameInput && data.customer.name) {
                nameInput.value = data.customer.name;
            }

            // Fill address 4 levels using address selector
            if (window.addressSelector && lastOrder.province_id) {
                // Use address selector to set values
                window.addressSelector.setAddress({
                    province_id: lastOrder.province_id,
                    district_id: lastOrder.district_id,
                    ward_id: lastOrder.ward_id
                });

                // Fill street address
                if (lastOrder.street_address) {
                    const streetInput = document.getElementById('newOrderStreetAddress');
                    if (streetInput) {
                        streetInput.value = lastOrder.street_address;
                    }
                }

                // Update address preview after a delay (wait for dropdowns to populate)
                setTimeout(() => {
                    const fullAddress = window.addressSelector.generateFullAddress(
                        lastOrder.street_address || '',
                        lastOrder.province_id,
                        lastOrder.district_id,
                        lastOrder.ward_id
                    );

                    // Update preview text
                    const addressPreview = document.getElementById('newOrderAddressPreview');
                    if (addressPreview && fullAddress) {
                        addressPreview.textContent = fullAddress;
                    }

                    // Update hidden input
                    const hiddenAddress = document.getElementById('newOrderAddress');
                    if (hiddenAddress && fullAddress) {
                        hiddenAddress.value = fullAddress;
                    }
                }, 300);
            } else {
                // Fallback: Fill address text field if available
                const addressInput = document.getElementById('newOrderAddress');
                if (addressInput && lastOrder.address) {
                    addressInput.value = lastOrder.address;
                }
            }

            // Fill CTV code if available
            if (lastOrder.referral_code) {
                const ctvInput = document.getElementById('newOrderReferralCode');
                if (ctvInput) {
                    ctvInput.value = lastOrder.referral_code;
                    // Trigger verification
                    ctvInput.dispatchEvent(new Event('blur'));
                }
            }

            showToast('✅ Đã điền thông tin từ đơn gần nhất', 'success', null, loadingId);
        } else {
            showToast('Không tìm thấy đơn hàng trước đó', 'warning', null, loadingId);
        }
    } catch (error) {
        console.error('Error auto-filling order:', error);
        showToast('Có lỗi khi tải thông tin', 'error');
    }
}
