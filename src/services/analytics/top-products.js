// Top Products Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get top selling products
 */
export async function getTopProducts(limit, period, env, corsHeaders, customStartDate = null) {
    try {
        // Calculate date range
        // If frontend provides custom startDate (in ISO format), use it
        // Otherwise calculate based on period
        let startDate;
        
        if (customStartDate) {
            // Frontend sends start date in ISO format (UTC)
            startDate = new Date(customStartDate);
        } else {
            // Fallback: calculate in UTC
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

        // Query top products - Simplified and optimized
        const startDateISO = startDate.getTime();
        console.log('🔍 getTopProducts - Filtering from:', startDateISO);
        
        const { results: topProducts } = await env.DB.prepare(`
            SELECT 
                oi.product_id,
                oi.product_name,
                SUM(oi.quantity) as total_sold,
                SUM(oi.product_price * oi.quantity) as total_revenue,
                SUM(oi.product_cost * oi.quantity) as total_cost,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as total_profit,
                AVG(oi.product_price) as avg_price,
                COUNT(DISTINCT oi.order_id) as order_count,
                ROUND(
                    (SUM((oi.product_price - oi.product_cost) * oi.quantity) * 100.0) / 
                    NULLIF(SUM(oi.product_price * oi.quantity), 0), 
                    2
                ) as profit_margin
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?
            GROUP BY oi.product_id, oi.product_name
            ORDER BY total_sold DESC
            LIMIT ?
        `).bind(startDateISO, limit).all();
        
        console.log('📊 getTopProducts - Found', topProducts.length, 'products');

        return jsonResponse({
            success: true,
            period: period,
            startDate: startDate.getTime(),
            products: topProducts
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting top products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
