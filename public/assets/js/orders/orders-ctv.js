/**
 * Orders CTV Verification
 * Extracted from orders.js
 * 
 * Dependencies:
 * - updateOrderSummary() from orders-add-modal.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// CTV Auto-Verify - Simple Version
// ============================================

let ctvCheckTimeout = null;
let ctvVerified = false; // Track verification status

// Listen to CTV input changes
document.addEventListener('input', function (e) {
    if (e.target.id === 'newOrderReferralCode') {
        const code = e.target.value.trim();
        const statusDiv = document.getElementById('ctvVerifyStatus');

        if (!statusDiv) return;

        // Clear previous timeout
        clearTimeout(ctvCheckTimeout);

        // Reset verification status
        ctvVerified = false;

        // Clear if empty (empty is allowed)
        if (!code) {
            statusDiv.innerHTML = '';
            ctvVerified = true; // Empty is valid

            // Remove commission_rate
            const commissionRateInput = document.getElementById('ctvCommissionRate');
            if (commissionRateInput) commissionRateInput.remove();

            // Update order summary to recalculate commission
            updateOrderSummary();
            return;
        }

        // Show loading
        statusDiv.innerHTML = '<div class="text-xs text-gray-500 mt-1">Đang kiểm tra...</div>';

        // Check after 600ms
        ctvCheckTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${CONFIG.API_URL}?action=verifyCTV&code=${encodeURIComponent(code)}`);
                const data = await response.json();

                if (data.success && data.verified) {
                    const rate = (data.data.rate * 100).toFixed(0);
                    statusDiv.innerHTML = `
                        <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                            <div class="text-green-800 font-semibold">✓ ${data.data.name}</div>
                            <div class="text-green-600">Hoa hồng: ${rate}% • ${data.data.phone}</div>
                        </div>
                    `;

                    // Store commission_rate in hidden input for calculation
                    let commissionRateInput = document.getElementById('ctvCommissionRate');
                    if (!commissionRateInput) {
                        commissionRateInput = document.createElement('input');
                        commissionRateInput.type = 'hidden';
                        commissionRateInput.id = 'ctvCommissionRate';
                        statusDiv.appendChild(commissionRateInput);
                    }
                    commissionRateInput.value = data.data.rate;

                    ctvVerified = true; // Valid CTV

                    // Update order summary to recalculate commission
                    updateOrderSummary();
                } else {
                    statusDiv.innerHTML = `
                        <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-semibold">
                            ✗ Không tìm thấy CTV với mã này
                        </div>
                    `;

                    // Remove commission_rate
                    const commissionRateInput = document.getElementById('ctvCommissionRate');
                    if (commissionRateInput) commissionRateInput.remove();

                    ctvVerified = false; // Invalid CTV

                    // Update order summary to recalculate commission
                    updateOrderSummary();
                }
            } catch (error) {
                console.error('Error verifying CTV:', error);
                statusDiv.innerHTML = '<div class="text-xs text-red-500 mt-1">Lỗi kết nối</div>';
                ctvVerified = false;
            }
        }, 600);
    }
});

// Validation function for CTV code
function validateCTVCode() {
    const ctvInput = document.getElementById('newOrderReferralCode');
    if (!ctvInput) return true; // If input doesn't exist, allow

    const code = ctvInput.value.trim();

    // If empty, allow (optional field)
    if (!code) return true;

    // If has value but not verified, block
    if (!ctvVerified) {
        alert('⚠️ Mã CTV không hợp lệ!\n\nVui lòng kiểm tra lại mã CTV hoặc để trống nếu không có.');
        ctvInput.focus();
        return false;
    }

    return true;
}
