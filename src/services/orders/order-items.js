import { jsonResponse } from '../../utils/response.js';
import { normalizeOrderItemSize } from '../../utils/order-item-size.js';

// Update order products
export async function updateOrderProducts(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.products) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc products'
            }, 400, corsHeaders);
        }

        // Parse products JSON
        let productsArray;
        try {
            productsArray = typeof data.products === 'string' ? JSON.parse(data.products) : data.products;
        } catch (e) {
            return jsonResponse({
                success: false,
                error: 'Invalid products JSON'
            }, 400, corsHeaders);
        }

        // Get order info for commission calculation
        const order = await env.DB.prepare(`
            SELECT referral_code, shipping_fee, shipping_cost
            FROM orders 
            WHERE id = ?
        `).bind(data.orderId).first();

        if (!order) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        // Delete existing order_items
        await env.DB.prepare(`
            DELETE FROM order_items 
            WHERE order_id = ?
        `).bind(data.orderId).run();

        // Insert new order_items
        const currentTimestamp = Date.now(); // Unix timestamp in milliseconds
        
        for (const product of productsArray) {
            await env.DB.prepare(`
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name, 
                    product_price, 
                    product_cost,
                    quantity,
                    size,
                    notes,
                    created_at_unix
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                data.orderId,
                product.product_id || null,
                product.name || product.product_name || 'Unknown',
                product.price || product.product_price || 0,
                product.cost_price || product.cost || product.product_cost || 0,
                product.quantity || 1,
                normalizeOrderItemSize(product.size ?? product.weight), // Cân/size: NULL nếu chưa có (không lưu "chưa có")
                product.notes || null,
                currentTimestamp
            ).run();
        }

        // Calculate new total_amount from order_items
        const productTotalResult = await env.DB.prepare(`
            SELECT COALESCE(SUM(product_price * quantity), 0) as product_total
            FROM order_items
            WHERE order_id = ?
        `).bind(data.orderId).first();

        const productTotal = productTotalResult?.product_total || 0;

        // Ưu tiên dùng shipping_fee được gửi từ client (đã tính lại freeship)
        // Nếu client không gửi, giữ nguyên giá trị trong DB
        const shippingFee = data.shipping_fee !== undefined
            ? data.shipping_fee
            : (order.shipping_fee || 0);

        // Get discount amount from order
        const orderDiscount = await env.DB.prepare(`
            SELECT discount_amount
            FROM orders
            WHERE id = ?
        `).bind(data.orderId).first();
        
        const discountAmount = orderDiscount?.discount_amount || 0;
        
        // Calculate total_amount: productTotal + shippingFee - discountAmount
        const newTotalAmount = productTotal + shippingFee - discountAmount;
        
        // Update total_amount AND shipping_fee in orders table
        await env.DB.prepare(`
            UPDATE orders
            SET total_amount = ?, shipping_fee = ?
            WHERE id = ?
        `).bind(newTotalAmount, shippingFee, data.orderId).run();
        
        const updatedOrder = { total_amount: newTotalAmount, shipping_fee: shippingFee };

        // Calculate product_cost from order_items
        const productCostResult = await env.DB.prepare(`
            SELECT COALESCE(SUM(product_cost * quantity), 0) as product_cost
            FROM order_items
            WHERE order_id = ?
        `).bind(data.orderId).first();

        const calculatedProductCost = productCostResult?.product_cost || 0;

        let calculatedCommission = null;

        // Calculate commission if order has referral_code
        if (order.referral_code) {
            // Get CTV's commission rate from database
            const ctv = await env.DB.prepare(`
                SELECT commission_rate 
                FROM ctv 
                WHERE referral_code = ?
            `).bind(order.referral_code).first();

            if (ctv && ctv.commission_rate !== null) {
                // Calculate commission based on productTotal ONLY (not including shipping, not including discount)
                calculatedCommission = Math.round(productTotal * ctv.commission_rate);
                console.log(`💰 Calculated commission for ${order.referral_code}: ${calculatedCommission} (rate: ${ctv.commission_rate}, productTotal: ${productTotal})`);
                
                // Update commission
                await env.DB.prepare(`
                    UPDATE orders 
                    SET commission = ?
                    WHERE id = ?
                `).bind(calculatedCommission, data.orderId).run();
            }
        }

        // Also update products text field for backward compatibility
        await env.DB.prepare(`
            UPDATE orders 
            SET products = ?
            WHERE id = ?
        `).bind(data.products, data.orderId).run();

        console.log('✅ Updated order_items and total_amount for order:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật sản phẩm',
            total_amount: updatedOrder.total_amount,
            shipping_fee: updatedOrder.shipping_fee,
            product_cost: calculatedProductCost,
            commission: calculatedCommission
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order products:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Lỗi khi cập nhật sản phẩm'
        }, 500, corsHeaders);
    }
}
