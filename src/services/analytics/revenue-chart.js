// Revenue Chart Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get revenue chart data for visualization
 * Supports: today, week, month, year, all, custom date range
 */
export async function getRevenueChart(data, env, corsHeaders) {
    try {
        const period = data.period || 'week';
        const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
        
        // Helper: Get VN date components
        const getVNDate = (timestamp) => {
            const vnTime = new Date(timestamp + VN_OFFSET_MS);
            return {
                year: vnTime.getUTCFullYear(),
                month: vnTime.getUTCMonth() + 1,
                date: vnTime.getUTCDate(),
                day: vnTime.getUTCDay()
            };
        };
        
        // Helper: Get start of day in VN timezone
        const getVNStartOfDay = (year, month, date) => {
            return Date.UTC(year, month - 1, date, 0, 0, 0) - VN_OFFSET_MS;
        };
        
        const now = Date.now();
        const vnNow = getVNDate(now);
        
        let currentStart, currentEnd, previousStart, previousEnd, groupBy, labels;
        
        // Handle custom date range (when period='all' with startDate/endDate)
        if (period === 'all' && data.startDate && data.endDate) {
            currentStart = new Date(data.startDate).getTime();
            currentEnd = new Date(data.endDate).getTime();
            
            // Calculate duration for comparison period
            const duration = currentEnd - currentStart;
            previousStart = currentStart - duration;
            previousEnd = currentStart - 1;
            
            // Determine groupBy based on duration
            const days = Math.ceil(duration / (24 * 60 * 60 * 1000));
            if (days <= 1) {
                groupBy = 'hour';
                labels = Array.from({length: 24}, (_, i) => `${i}h`);
            } else if (days <= 31) {
                groupBy = 'day';
                labels = Array.from({length: days}, (_, i) => `${i + 1}`);
            } else if (days <= 365) {
                groupBy = 'day';
                const daysCount = Math.min(days, 31);
                labels = Array.from({length: daysCount}, (_, i) => `${i + 1}`);
            } else {
                groupBy = 'month';
                labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
            }
        } else if (period === 'today') {
            // Today vs Yesterday
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, vnNow.date);
            currentEnd = currentStart + 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'hour';
            labels = Array.from({length: 24}, (_, i) => `${i}h`);
            
        } else if (period === 'week') {
            // This week vs Last week (Monday to Sunday)
            const daysSinceMonday = vnNow.day === 0 ? 6 : vnNow.day - 1;
            const mondayDate = vnNow.date - daysSinceMonday;
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, mondayDate);
            currentEnd = currentStart + 7 * 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 7 * 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'day';
            labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
            
        } else if (period === 'month') {
            // This month vs Last month
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, 1);
            const nextMonth = vnNow.month === 12 ? 1 : vnNow.month + 1;
            const nextYear = vnNow.month === 12 ? vnNow.year + 1 : vnNow.year;
            currentEnd = getVNStartOfDay(nextYear, nextMonth, 1) - 1;
            
            const prevMonth = vnNow.month === 1 ? 12 : vnNow.month - 1;
            const prevYear = vnNow.month === 1 ? vnNow.year - 1 : vnNow.year;
            previousStart = getVNStartOfDay(prevYear, prevMonth, 1);
            previousEnd = currentStart - 1;
            groupBy = 'day';
            
            const daysInMonth = Math.ceil((currentEnd - currentStart + 1) / (24 * 60 * 60 * 1000));
            labels = Array.from({length: daysInMonth}, (_, i) => `${i + 1}`);
            
        } else if (period === 'year') {
            // This year vs Last year
            currentStart = getVNStartOfDay(vnNow.year, 1, 1);
            currentEnd = getVNStartOfDay(vnNow.year + 1, 1, 1) - 1;
            previousStart = getVNStartOfDay(vnNow.year - 1, 1, 1);
            previousEnd = currentStart - 1;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        } else {
            // Default to 'all' - all time data
            // Get first order date as start
            const { results: firstOrder } = await env.DB.prepare(`
                SELECT MIN(created_at_unix) as first_date FROM orders WHERE created_at_unix IS NOT NULL
            `).all();
            
            currentStart = firstOrder[0]?.first_date || (now - 365 * 24 * 60 * 60 * 1000);
            currentEnd = now;
            previousStart = currentStart;
            previousEnd = currentStart;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        }
        
        // Fetch orders for both periods with optimized JOIN
        // Use total_amount (actual revenue) and calculate profit in SQL for better performance
        const { results: allOrders } = await env.DB.prepare(`
            SELECT 
                o.created_at_unix,
                o.total_amount as revenue,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost,
                o.shipping_cost,
                o.packaging_cost,
                o.commission,
                o.tax_amount,
                (o.total_amount 
                    - COALESCE(SUM(oi.product_cost * oi.quantity), 0) 
                    - COALESCE(o.shipping_cost, 0) 
                    - COALESCE(o.packaging_cost, 0) 
                    - COALESCE(o.commission, 0) 
                    - COALESCE(o.tax_amount, 0)
                ) as profit
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.created_at_unix >= ? AND o.created_at_unix <= ?
            GROUP BY o.id
        `).bind(previousStart, currentEnd).all();
        
        // Initialize data arrays
        const currentData = { revenue: [], profit: [], orders: [] };
        const previousData = { revenue: [], profit: [], orders: [] };
        
        // Initialize with zeros
        for (let i = 0; i < labels.length; i++) {
            currentData.revenue[i] = 0;
            currentData.profit[i] = 0;
            currentData.orders[i] = 0;
            previousData.revenue[i] = 0;
            previousData.profit[i] = 0;
            previousData.orders[i] = 0;
        }
        
        // Process orders
        allOrders.forEach(order => {
            const timestamp = order.created_at_unix;
            const isCurrent = timestamp >= currentStart && timestamp <= currentEnd;
            const data = isCurrent ? currentData : previousData;
            const baseTime = isCurrent ? currentStart : previousStart;
            
            // Calculate index based on groupBy
            let index = 0;
            if (groupBy === 'hour') {
                const hours = Math.floor((timestamp - baseTime) / (60 * 60 * 1000));
                index = Math.min(hours, 23);
            } else if (groupBy === 'day') {
                const days = Math.floor((timestamp - baseTime) / (24 * 60 * 60 * 1000));
                index = Math.min(days, labels.length - 1);
            } else if (groupBy === 'month') {
                const vnDate = getVNDate(timestamp);
                const baseDate = getVNDate(baseTime);
                index = vnDate.month - baseDate.month;
                if (index < 0) index += 12;
                index = Math.min(index, 11);
            }
            
            // Use pre-calculated values from SQL (much faster than calculating in JS)
            const revenue = order.revenue || 0;
            const profit = order.profit || 0;
            
            data.revenue[index] += revenue;
            data.profit[index] += profit;
            data.orders[index] += 1;
        });
        
        // Calculate totals and comparison
        const currentTotal = {
            revenue: currentData.revenue.reduce((a, b) => a + b, 0),
            profit: currentData.profit.reduce((a, b) => a + b, 0),
            orders: currentData.orders.reduce((a, b) => a + b, 0)
        };
        
        const previousTotal = {
            revenue: previousData.revenue.reduce((a, b) => a + b, 0),
            profit: previousData.profit.reduce((a, b) => a + b, 0),
            orders: previousData.orders.reduce((a, b) => a + b, 0)
        };
        
        const comparison = {
            revenueChange: previousTotal.revenue > 0 ? ((currentTotal.revenue - previousTotal.revenue) / previousTotal.revenue * 100) : 0,
            profitChange: previousTotal.profit > 0 ? ((currentTotal.profit - previousTotal.profit) / previousTotal.profit * 100) : 0,
            ordersChange: previousTotal.orders > 0 ? ((currentTotal.orders - previousTotal.orders) / previousTotal.orders * 100) : 0
        };
        
        return jsonResponse({
            success: true,
            period: period,
            labels: labels,
            currentPeriod: {
                revenue: currentData.revenue,
                profit: currentData.profit,
                orders: currentData.orders,
                total: currentTotal
            },
            previousPeriod: {
                revenue: previousData.revenue,
                profit: previousData.profit,
                orders: previousData.orders,
                total: previousTotal
            },
            comparison: {
                revenueChange: Math.round(comparison.revenueChange * 10) / 10,
                profitChange: Math.round(comparison.profitChange * 10) / 10,
                ordersChange: Math.round(comparison.ordersChange * 10) / 10
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting revenue chart:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
