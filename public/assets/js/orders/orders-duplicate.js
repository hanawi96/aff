// ============================================
// ORDER DUPLICATION
// ============================================

/**
 * Duplicate an existing order
 * Creates a new order with the same information but resets CTV code and status
 * @param {number} orderId - ID of the order to duplicate
 */
function duplicateOrder(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Show modal with pre-filled data (không sao chép mã CTV và trạng thái)
    showAddOrderModal({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.address,
        // Address 4 levels
        province_id: order.province_id,
        district_id: order.district_id,
        ward_id: order.ward_id,
        street_address: order.street_address,
        referral_code: '', // Không sao chép mã CTV
        payment_method: order.payment_method,
        // status: Không sao chép - luôn để "pending" cho đơn mới
        shipping_fee: order.shipping_fee || 0,
        shipping_cost: order.shipping_cost || 0,
        products: products
    });

    showToast('Đã sao chép thông tin đơn hàng', 'info');
}
