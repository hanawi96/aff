// ============================================
// SHOP ORDER HANDLER - Public order creation
// ============================================

import { jsonResponse } from '../../../../src/utils/response.js';
import { ShopOrderService } from '../services/order.service.js';

/**
 * Create order from shop (public - no auth)
 */
export async function createShopOrder(request, env, corsHeaders) {
    try {
        const data = await request.json();

        // Validate required fields
        if (!data.customer || !data.customer.name || !data.customer.phone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin khách hàng'
            }, 400, corsHeaders);
        }

        if (!data.cart || data.cart.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Giỏ hàng trống'
            }, 400, corsHeaders);
        }

        if (!data.address) {
            return jsonResponse({
                success: false,
                error: 'Thiếu địa chỉ giao hàng'
            }, 400, corsHeaders);
        }

        // Create order using shop service
        const result = await ShopOrderService.createOrder(data, env);

        return jsonResponse({
            success: true,
            message: 'Đặt hàng thành công',
            order: result
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error creating shop order:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Không thể tạo đơn hàng'
        }, 500, corsHeaders);
    }
}

/**
 * Get shop products (public)
 */
export async function getShopProducts(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const category = url.searchParams.get('category');

        const products = await ShopOrderService.getProducts(env, category);

        return jsonResponse({
            success: true,
            products: products
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting shop products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
