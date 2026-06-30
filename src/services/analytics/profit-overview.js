// Profit Overview Analytics
import { jsonResponse } from '../../utils/response.js';
import { queryCustomerSourceBreakdown, buildCustomerSources } from './customer-source-breakdown.js';

/**
 * Get profit overview with all costs
 */
export async function getProfitOverview(period, env, corsHeaders, customStartDate = null, customEndDate = null) {
    try {
        // Calculate date range
        // If frontend provides custom startDate (in ISO format), use it for accurate VN timezone filtering
        // Otherwise calculate based on period in UTC (may not match VN timezone exactly)
        let startDate;

        if (customStartDate) {
            startDate = new Date(customStartDate);
        } else {
            const now = new Date();

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
                default:
                    startDate = new Date(0);
            }
        }

        const startMs = startDate.getTime();
        const endMs = customEndDate ? new Date(customEndDate).getTime() : null;
        const endClause = endMs != null ? ' AND created_at_unix <= ?' : '';
        const endClauseO = endMs != null ? ' AND o.created_at_unix <= ?' : '';
        const binds = endMs != null ? [startMs, endMs] : [startMs];

        const isQuickDayScope = !!customStartDate
            && (endMs == null || (endMs - startMs) < 86400000 * 1.5);
        const prevDayStart = startMs - 86400000;
        const prevDayEnd = startMs - 1;

        const [overview, productData, sourceBreakdown, prevDayRow] = await Promise.all([
            env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(shipping_cost), 0) as total_shipping_cost,
                COALESCE(SUM(commission), 0) as total_commission,
                COALESCE(SUM(packaging_cost), 0) as total_packaging_cost,
                COALESCE(SUM(tax_amount), 0) as total_tax
            FROM orders
            WHERE created_at_unix >= ?${endClause}
        `).bind(...binds).first(),
            env.DB.prepare(`
            SELECT 
                COALESCE(SUM(oi.quantity), 0) as total_products_sold,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?${endClauseO}
        `).bind(...binds).first(),
            queryCustomerSourceBreakdown(env, startMs, endMs),
            isQuickDayScope
                ? env.DB.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) AS rev
            FROM orders
            WHERE created_at_unix >= ? AND created_at_unix <= ?
        `).bind(prevDayStart, prevDayEnd).first()
                : Promise.resolve(null)
        ]);

        // Merge results
        overview.total_products_sold = productData.total_products_sold || 0;
        overview.product_cost = productData.product_cost || 0;

        // Calculate totals using total_amount
        const totalRevenue = overview.total_revenue || 0;
        const totalTax = overview.total_tax || 0; // Use saved tax amount
        const totalCost = (overview.product_cost || 0) + (overview.total_shipping_cost || 0) + 
                         (overview.total_packaging_cost || 0) + (overview.total_commission || 0) + totalTax;
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

        let revenueVsPrevDayPct = null;
        let previousDayRevenue = null;
        if (isQuickDayScope && prevDayRow) {
            previousDayRevenue = prevDayRow.rev || 0;
            if (previousDayRevenue > 0) {
                revenueVsPrevDayPct = ((totalRevenue - previousDayRevenue) / previousDayRevenue) * 100;
            } else if (totalRevenue > 0) {
                revenueVsPrevDayPct = 100;
            } else {
                revenueVsPrevDayPct = 0;
            }
        }

        const customerSources = buildCustomerSources(
            sourceBreakdown.ordersRows,
            sourceBreakdown.productRows,
            totalRevenue
        );

        return jsonResponse({
            success: true,
            period: period,
            startDate: startDate.getTime(),
            overview: {
                total_orders: overview.total_orders || 0,
                total_products_sold: overview.total_products_sold || 0,
                total_revenue: totalRevenue,
                product_revenue: overview.product_revenue || 0,
                shipping_fee: overview.total_shipping_fee || 0,
                total_cost: totalCost,
                product_cost: overview.product_cost || 0,
                shipping_cost: overview.total_shipping_cost || 0,
                packaging_cost: overview.total_packaging_cost || 0,
                commission: overview.total_commission || 0,
                tax: totalTax,
                total_profit: totalProfit,
                profit_margin: profitMargin,
                avg_order_value: overview.total_orders > 0 ? (totalRevenue / overview.total_orders) : 0,
                avg_profit_per_product: overview.total_products_sold > 0 ? (totalProfit / overview.total_products_sold) : 0,
                revenue_vs_prev_day_pct: revenueVsPrevDayPct,
                previous_day_revenue: previousDayRevenue
            },
            customer_sources: customerSources
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting profit overview:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
