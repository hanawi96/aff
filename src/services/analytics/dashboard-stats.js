// Dashboard Statistics Service
import { jsonResponse } from '../../utils/response.js';

// Lấy thống kê dashboard
export async function getDashboardStats(env, corsHeaders) {
    try {
        // Total CTV
        const { total_ctv } = await env.DB.prepare(`
            SELECT COUNT(*) as total_ctv FROM ctv
        `).first();

        // Total orders - Calculate revenue from order_items + shipping_fee
        const { total_orders, total_commission, total_shipping_fee } = await env.DB.prepare(`
            SELECT 
                COUNT(DISTINCT orders.id) as total_orders,
                SUM(orders.commission) as total_commission,
                COALESCE(SUM(orders.shipping_fee), 0) as total_shipping_fee
            FROM orders
        `).first();
        
        const { product_revenue } = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(product_price * quantity), 0) as product_revenue
            FROM order_items
        `).first();
        
        // Total revenue = product revenue + shipping fee (consistent with orders.js)
        const total_revenue = (product_revenue || 0) + (total_shipping_fee || 0);

        // Top performers - use total_amount column
        const { results: topPerformers } = await env.DB.prepare(`
            SELECT 
                referral_code,
                COUNT(*) as orderCount,
                SUM(total_amount) as totalRevenue,
                SUM(commission) as commission
            FROM orders
            WHERE referral_code IS NOT NULL AND referral_code != ''
            GROUP BY referral_code
            ORDER BY totalRevenue DESC
            LIMIT 5
        `).all();

        return jsonResponse({
            success: true,
            stats: {
                totalCTV: total_ctv || 0,
                totalOrders: total_orders || 0,
                totalRevenue: total_revenue || 0,
                totalCommission: total_commission || 0,
                topPerformers: topPerformers
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
