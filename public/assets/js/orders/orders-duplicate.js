// ============================================
// ORDER DUPLICATION
// ============================================

/**
 * Duplicate an existing order
 * Creates a new order with the same information but resets CTV code and status
 * @param {number} orderId - ID of the order to duplicate
 */
async function duplicateOrder(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let products = [];
    try {
        products = JSON.parse(order.products);
        
        // CRITICAL FIX: Ensure all prices are parsed correctly as numbers
        // AND lookup product_id from database if missing
        const productNames = products.map(p => p.name).filter(Boolean);
        
        // Batch lookup product_id from database
        let productIdMap = {};
        if (productNames.length > 0) {
            try {
                const response = await fetch(`${CONFIG.API_URL}?action=getProductsByNames&names=${encodeURIComponent(JSON.stringify(productNames))}`);
                const data = await response.json();
                if (data.success && data.products) {
                    data.products.forEach(p => {
                        productIdMap[p.name] = p.id;
                    });
                }
            } catch (e) {
                console.warn('⚠️ Could not lookup product IDs:', e);
            }
        }
        
        products = products.map(product => {
            const cleanProduct = { ...product };
            
            // Parse price to ensure it's a number
            if (cleanProduct.price !== undefined && cleanProduct.price !== null) {
                cleanProduct.price = parsePrice(cleanProduct.price);
            }
            
            // Parse cost_price to ensure it's a number
            if (cleanProduct.cost_price !== undefined && cleanProduct.cost_price !== null) {
                cleanProduct.cost_price = parsePrice(cleanProduct.cost_price);
            }
            
            // Add product_id if missing
            if (!cleanProduct.product_id && cleanProduct.name && productIdMap[cleanProduct.name]) {
                cleanProduct.product_id = productIdMap[cleanProduct.name];
            }
            
            return cleanProduct;
        });
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

    // Show modal with pre-filled data (không sao chép mã CTV, trạng thái, và ưu tiên)
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
        // is_priority: Không sao chép - đơn mới luôn là đơn thường
    });

    showToast('Đã sao chép thông tin đơn hàng', 'info');
}
