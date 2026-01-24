// ============================================
// SHIPPING SETTINGS SERVICE
// ============================================

import { jsonResponse } from '../../utils/response.js';

/**
 * Get current shipping fee from cost_config
 */
export async function getShippingFee(env, corsHeaders) {
    try {
        // Get shipping fee from cost_config (customer_shipping_fee)
        const shippingConfig = await env.DB.prepare(`
            SELECT item_cost as shipping_fee
            FROM cost_config
            WHERE item_name = 'customer_shipping_fee'
            LIMIT 1
        `).first();

        const shippingFee = shippingConfig?.shipping_fee || 21000; // Default 21,000đ

        return jsonResponse({
            success: true,
            shippingFee: shippingFee
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting shipping fee:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to get shipping fee',
            shippingFee: 21000 // Fallback to default
        }, 500, corsHeaders);
    }
}
