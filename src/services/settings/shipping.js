// ============================================
// SHIPPING SETTINGS SERVICE
// ============================================

import { jsonResponse } from '../../utils/response.js';

/**
 * Get current shipping fee from cost_config
 */
export async function getShippingFee(env, corsHeaders) {
    try {
        // Get both shipping fees from cost_config
        const configs = await env.DB.prepare(`
            SELECT item_name, item_cost
            FROM cost_config
            WHERE item_name IN ('customer_shipping_fee', 'default_shipping_cost')
        `).all();

        const configMap = {};
        configs.results?.forEach(row => {
            configMap[row.item_name] = row.item_cost;
        });

        const customerShippingFee = configMap['customer_shipping_fee'] || 21000; // Default 21,000đ
        const actualShippingCost = configMap['default_shipping_cost'] || 0; // Default 0đ

        return jsonResponse({
            success: true,
            customerShippingFee: customerShippingFee,
            actualShippingCost: actualShippingCost,
            // Keep old field for backward compatibility
            shippingFee: customerShippingFee
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting shipping fee:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to get shipping fee',
            customerShippingFee: 21000,
            actualShippingCost: 0,
            shippingFee: 21000 // Fallback to default
        }, 500, corsHeaders);
    }
}
