// Product Statistics Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get detailed stats for a specific product
 */
export async function getProductStats(productId, period, env, corsHeaders, customStartDate = null) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Calculate date range
        let startDate;
        
        if (customStartDate) {
            // Frontend sends start date in ISO format (already adjusted for VN timezone)
            startDate = new Date(customStartDate);
        } else {
            // Fallback: calculate in UTC (may not match VN timezone exactly)
            const now = new Date();
            startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0)); // Default: all time

            switch (period) {
                case 'today':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
                    break;
                case 'year':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                    break;
            }
        }

        // Get product info
        const productInfo = await env.DB.prepare(`
            SELECT * FROM products WHERE id = ?
        `).bind(productId).first();

        // Get aggregated stats - Simplified and optimized
        const stats = await env.DB.prepare(`
            SELECT 
                oi.product_id,
                oi.product_name,
                SUM(oi.quantity) as total_sold,
                SUM(oi.product_price * oi.quantity) as total_revenue,
                SUM(oi.product_cost * oi.quantity) as total_cost,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as total_profit,
                AVG(oi.product_price) as avg_price,
                MIN(oi.product_price) as min_price,
                MAX(oi.product_price) as max_price,
                COUNT(DISTINCT oi.order_id) as order_count,
                ROUND(
                    (SUM((oi.product_price - oi.product_cost) * oi.quantity) * 100.0) / 
                    NULLIF(SUM(oi.product_price * oi.quantity), 0), 
                    2
                ) as profit_margin
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND o.created_at_unix >= ?
            GROUP BY oi.product_id, oi.product_name
        `).bind(productId, startDate.getTime()).first();

        // Get daily trend (last 30 days) - Simplified and optimized
        const now = new Date();
        const { results: dailyTrend } = await env.DB.prepare(`
            SELECT 
                DATE(o.created_at_unix/1000, 'unixepoch') as date,
                SUM(oi.quantity) as daily_sold,
                SUM(oi.product_price * oi.quantity) as daily_revenue,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as daily_profit
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND o.created_at_unix >= ?
            GROUP BY DATE(o.created_at_unix/1000, 'unixepoch')
            ORDER BY date DESC
            LIMIT 30
        `).bind(productId, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime()).all();

        // Get recent orders
        const { results: recentOrders } = await env.DB.prepare(`
            SELECT 
                oi.*,
                o.order_id,
                o.customer_name,
                o.created_at_unix as order_date
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND oi.created_at_unix >= ?
            ORDER BY oi.created_at_unix DESC
            LIMIT 10
        `).bind(productId, startDate.getTime()).all();

        return jsonResponse({
            success: true,
            period: period,
            productInfo: productInfo,
            stats: stats || {
                total_sold: 0,
                total_revenue: 0,
                total_cost: 0,
                total_profit: 0,
                order_count: 0,
                profit_margin: 0
            },
            dailyTrend: dailyTrend,
            recentOrders: recentOrders
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting product stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
