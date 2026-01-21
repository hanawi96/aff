// Profit Report Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get profit report with detailed cost breakdown
 */
export async function getProfitReport(data, env, corsHeaders) {
    try {
        const period = data.period || 'month';
        
        // Calculate date range in UTC
        const now = new Date();
        let startDate;
        
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
            case 'all':
                startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
                break;
            default:
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        }

        // Get orders in period with calculated totals from order_items using subqueries
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                orders.id,
                orders.order_id,
                orders.created_at_unix,
                orders.customer_name,
                orders.customer_phone,
                orders.commission,
                orders.referral_code,
                orders.created_at_unix,
                orders.shipping_fee,
                orders.shipping_cost,
                orders.packaging_cost,
                orders.tax_amount,
                orders.discount_amount,
                COALESCE(
                    (SELECT SUM(product_price * quantity) 
                     FROM order_items 
                     WHERE order_items.order_id = orders.id), 
                    0
                ) as product_total,
                COALESCE(
                    (SELECT SUM(product_cost * quantity) 
                     FROM order_items 
                     WHERE order_items.order_id = orders.id), 
                    0
                ) as product_cost
            FROM orders
            WHERE orders.created_at_unix >= ?
            ORDER BY orders.created_at_unix DESC
        `).bind(startDate.getTime()).all();

        // Calculate totals
        let totalRevenue = 0;
        let totalProductCost = 0;
        let totalShippingFee = 0;
        let totalShippingCost = 0;
        let totalPackagingCost = 0;
        let totalCommission = 0;
        let totalTax = 0;
        let totalProfit = 0;

        orders.forEach(order => {
            const productTotal = order.product_total || 0;
            const shippingFee = order.shipping_fee || 0;
            const discountAmount = order.discount_amount || 0;
            const revenue = productTotal + shippingFee - discountAmount;
            
            const productCost = order.product_cost || 0;
            const shippingCost = order.shipping_cost || 0;
            const packagingCost = order.packaging_cost || 0;
            const commission = order.commission || 0;
            const taxAmount = order.tax_amount || 0;
            const profit = revenue - productCost - shippingCost - packagingCost - commission - taxAmount;

            totalRevenue += revenue;
            totalProductCost += productCost;
            totalShippingFee += shippingFee;
            totalShippingCost += shippingCost;
            totalPackagingCost += packagingCost;
            totalCommission += commission;
            totalTax += taxAmount;
            totalProfit += profit;

            order.total_amount = revenue;
            order.profit = profit;
        });

        const totalCost = totalProductCost + totalShippingCost + totalPackagingCost + totalCommission + totalTax;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return jsonResponse({
            success: true,
            period: period,
            summary: {
                totalRevenue,
                totalCost,
                totalProfit,
                profitMargin: Math.round(profitMargin * 10) / 10,
                orderCount: orders.length
            },
            costBreakdown: {
                productCost: totalProductCost,
                packagingCost: totalPackagingCost,
                shippingFee: totalShippingFee,
                shippingCost: totalShippingCost,
                shippingProfit: totalShippingFee - totalShippingCost,
                commission: totalCommission,
                tax: totalTax
            },
            orders: orders.map(order => ({
                id: order.id,
                order_id: order.order_id,
                created_at_unix: order.created_at_unix,
                customer_name: order.customer_name,
                total_amount: order.total_amount,
                product_cost: order.product_cost,
                packaging_cost: order.packaging_cost,
                shipping_fee: order.shipping_fee,
                shipping_cost: order.shipping_cost,
                commission: order.commission,
                profit: order.profit,
                created_at: order.created_at
            }))
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting profit report:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
