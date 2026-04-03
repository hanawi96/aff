// Detailed Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get detailed analytics for analytics page
 * Includes overview, cost breakdown, top products, daily data
 */
export async function getDetailedAnalytics(data, env, corsHeaders) {
    try {
        const period = data.period || 'month';
        
        // Calculate date range
        const now = new Date();
        let startDate;
        let endDate = null;

        if (data.startDate) {
            startDate = new Date(data.startDate);
            if (data.endDate) endDate = new Date(data.endDate);
        } else {
            switch (period) {
                case 'today':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                    break;
                case 'week':
                    const dayOfWeek = now.getUTCDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday, 0, 0, 0));
                    break;
                case 'year':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                    break;
                case 'all':
                    startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
                    break;
                case 'month':
                default:
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
            }
        }

        const startMs = startDate.getTime();
        const endMs = endDate ? endDate.getTime() : null;
        const endClause = endMs ? ' AND created_at_unix <= ?' : '';
        const endClauseO = endMs ? ' AND o.created_at_unix <= ?' : '';
        const bindStart = endMs ? [startMs, endMs] : [startMs];
        const bindStartO = endMs ? [startMs, endMs] : [startMs];

        // Get overview data from orders table (simple & fast)
        const overview = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(shipping_cost), 0) as total_shipping_cost,
                COALESCE(SUM(packaging_cost), 0) as total_packaging_cost,
                COALESCE(SUM(commission), 0) as total_commission,
                COALESCE(SUM(tax_amount), 0) as total_tax
            FROM orders
            WHERE created_at_unix >= ?${endClause}
        `).bind(...bindStart).first();

        // Get product data from order_items (separate query to avoid JOIN issues)
        const productData = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(oi.quantity), 0) as total_products_sold,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?${endClauseO}
        `).bind(...bindStartO).first();

        // Get unique customers count (by phone number)
        const startTimeMs = startMs;
        const startTimeSec = Math.floor(startTimeMs / 1000);
        const endTimeMs = endMs;
        const endTimeSec = endMs ? Math.floor(endMs / 1000) : null;
        let custSql = `SELECT COUNT(DISTINCT customer_phone) as unique_customers FROM orders WHERE (
                (LENGTH(CAST(created_at_unix AS TEXT)) = 13 AND created_at_unix >= ?) OR
                (LENGTH(CAST(created_at_unix AS TEXT)) = 10 AND created_at_unix >= ?)
            ) AND customer_phone IS NOT NULL AND customer_phone != ''`;
        let custBinds = [startTimeMs, startTimeSec];
        if (endMs) {
            custSql += ` AND ((LENGTH(CAST(created_at_unix AS TEXT)) = 13 AND created_at_unix <= ?) OR (LENGTH(CAST(created_at_unix AS TEXT)) = 10 AND created_at_unix <= ?))`;
            custBinds.push(endTimeMs, endTimeSec);
        }
        const customerData = await env.DB.prepare(custSql).bind(...custBinds).first();

        // Merge results
        overview.total_products_sold = productData.total_products_sold || 0;
        overview.product_cost = productData.product_cost || 0;
        overview.unique_customers = customerData?.unique_customers || 0;

        const totalRevenue = overview.total_revenue || 0;
        const totalCost = (overview.product_cost || 0) + (overview.total_shipping_cost || 0) + 
                         (overview.total_packaging_cost || 0) + (overview.total_commission || 0) + (overview.total_tax || 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

        // Get detailed cost breakdown from packaging_details using SQLite JSON functions
        // This is MUCH faster than parsing JSON in JavaScript loop
        const packagingBreakdown = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(
                    CAST(json_extract(packaging_details, '$.per_product.red_string') AS REAL) * 
                    CAST(json_extract(packaging_details, '$.total_products') AS INTEGER)
                ), 0) as red_string,
                COALESCE(SUM(
                    CAST(json_extract(packaging_details, '$.per_product.labor_cost') AS REAL) * 
                    CAST(json_extract(packaging_details, '$.total_products') AS INTEGER)
                ), 0) as labor_cost,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.bag_zip') AS REAL)), 0) as bag_zip,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.bag_red') AS REAL)), 0) as bag_red,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.box_shipping') AS REAL)), 0) as box_shipping,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.thank_card') AS REAL)), 0) as thank_card,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.paper_print') AS REAL)), 0) as paper_print
            FROM orders
            WHERE created_at_unix >= ?${endClause} AND packaging_details IS NOT NULL
        `).bind(...bindStart).first();

        const costBreakdown = {
            product_cost: overview.product_cost || 0,
            shipping_cost: overview.total_shipping_cost || 0,
            commission: overview.total_commission || 0,
            tax: overview.total_tax || 0,
            red_string: packagingBreakdown?.red_string || 0,
            labor_cost: packagingBreakdown?.labor_cost || 0,
            bag_zip: packagingBreakdown?.bag_zip || 0,
            bag_red: packagingBreakdown?.bag_red || 0,
            box_shipping: packagingBreakdown?.box_shipping || 0,
            thank_card: packagingBreakdown?.thank_card || 0,
            paper_print: packagingBreakdown?.paper_print || 0
        };

        // Debug: Check if any orders have commission
        const ordersWithCommission = await env.DB.prepare(`
            SELECT order_id, commission, referral_code, created_at_unix 
            FROM orders 
            WHERE commission > 0 AND created_at_unix >= ?${endClause}
            LIMIT 5
        `).bind(...bindStart).all();
        
        console.log('📊 Analytics Debug:', {
            period: period,
            startDate: startDate.getTime(),
            total_orders: overview.total_orders,
            total_commission: overview.total_commission,
            orders_with_commission: ordersWithCommission.results.length,
            sample_orders: ordersWithCommission.results
        });

        // Get top products - Simplified and optimized with full details
        const topProducts = await env.DB.prepare(`
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
            WHERE o.created_at_unix >= ?${endClauseO}
            GROUP BY oi.product_id, oi.product_name
            ORDER BY total_sold DESC
            LIMIT 10
        `).bind(...bindStartO).all();

        // Chart data — respects selected date range, hourly for single day
        const isSingleDay = endMs && (endMs - startMs < 86400000);
        let dailyDataFormatted;

        if (isSingleDay) {
            const hourlyData = await env.DB.prepare(`
                SELECT 
                    CAST(((orders.created_at_unix/1000 + 25200) % 86400) / 3600 AS INTEGER) as hour,
                    COUNT(DISTINCT orders.id) as order_count,
                    COALESCE(SUM(orders.total_amount), 0) as revenue,
                    COALESCE(SUM(order_items.product_cost * order_items.quantity), 0) +
                    COALESCE(SUM(orders.shipping_cost), 0) +
                    COALESCE(SUM(orders.packaging_cost), 0) +
                    COALESCE(SUM(orders.commission), 0) +
                    COALESCE(SUM(orders.tax_amount), 0) as cost
                FROM orders
                LEFT JOIN order_items ON orders.id = order_items.order_id
                WHERE orders.created_at_unix >= ? AND orders.created_at_unix <= ?
                GROUP BY hour
                ORDER BY hour ASC
            `).bind(startMs, endMs).all();

            const hourMap = {};
            for (let h = 0; h < 24; h++) hourMap[h] = { hour: h, revenue: 0, cost: 0, profit: 0, orders: 0 };
            (hourlyData.results || []).forEach(d => {
                hourMap[d.hour] = { hour: d.hour, revenue: d.revenue || 0, cost: d.cost || 0, profit: (d.revenue || 0) - (d.cost || 0), orders: d.order_count || 0 };
            });
            dailyDataFormatted = Object.values(hourMap);
        } else {
            const dailyBinds = endMs ? [startMs, endMs] : [startMs];
            const dailyEndClause = endMs ? ' AND orders.created_at_unix <= ?' : '';
            const dailyData = await env.DB.prepare(`
                SELECT 
                    DATE((orders.created_at_unix/1000 + 25200), 'unixepoch') as date,
                    COUNT(DISTINCT orders.id) as order_count,
                    COALESCE(SUM(orders.total_amount), 0) as revenue,
                    COALESCE(SUM(order_items.product_cost * order_items.quantity), 0) +
                    COALESCE(SUM(orders.shipping_cost), 0) +
                    COALESCE(SUM(orders.packaging_cost), 0) +
                    COALESCE(SUM(orders.commission), 0) +
                    COALESCE(SUM(orders.tax_amount), 0) as cost
                FROM orders
                LEFT JOIN order_items ON orders.id = order_items.order_id
                WHERE orders.created_at_unix >= ?${dailyEndClause}
                GROUP BY date
                ORDER BY date ASC
            `).bind(...dailyBinds).all();

            dailyDataFormatted = (dailyData.results || []).map(d => ({
                date: d.date,
                revenue: d.revenue || 0,
                cost: d.cost || 0,
                profit: (d.revenue || 0) - (d.cost || 0),
                orders: d.order_count || 0
            }));
        }

        // Order list for the period
        const orderList = await env.DB.prepare(`
            SELECT o.id, o.order_id, o.customer_name, o.customer_phone,
                   o.total_amount, o.created_at_unix, o.status,
                   COALESCE(SUM(oi.product_cost * oi.quantity), 0) +
                   COALESCE(o.shipping_cost, 0) + COALESCE(o.packaging_cost, 0) +
                   COALESCE(o.commission, 0) + COALESCE(o.tax_amount, 0) as total_cost
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at_unix >= ?${endClauseO}
            GROUP BY o.id
            ORDER BY o.created_at_unix DESC
        `).bind(...bindStartO).all();

        const ordersFormatted = (orderList.results || []).map(o => ({
            order_id: o.order_id,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            total_amount: o.total_amount || 0,
            profit: (o.total_amount || 0) - (o.total_cost || 0),
            created_at_unix: o.created_at_unix,
            status: o.status
        }));

        return jsonResponse({
            success: true,
            period: period,
            overview: {
                total_orders: overview.total_orders || 0,
                total_products_sold: overview.total_products_sold || 0,
                unique_customers: overview.unique_customers || 0,
                total_revenue: totalRevenue,
                total_cost: totalCost,
                total_profit: totalProfit,
                profit_margin: profitMargin,
                avg_revenue_per_order: overview.total_orders > 0 ? totalRevenue / overview.total_orders : 0,
                avg_cost_per_order: overview.total_orders > 0 ? totalCost / overview.total_orders : 0,
                avg_profit_per_order: overview.total_orders > 0 ? totalProfit / overview.total_orders : 0,
                cost_ratio: totalRevenue > 0 ? totalCost / totalRevenue : 0,
                // Add individual cost components
                product_cost: overview.product_cost || 0,
                shipping_cost: overview.total_shipping_cost || 0,
                commission: overview.total_commission || 0,
                packaging_cost: overview.total_packaging_cost || 0,
                tax: overview.total_tax || 0
            },
            cost_breakdown: costBreakdown,
            top_products: topProducts.results || [],
            daily_data: dailyDataFormatted,
            orders: ordersFormatted,
            comparison: {
                revenue_change: 0,
                profit_change: 0,
                cost_change: 0
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting detailed analytics:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
