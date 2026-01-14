// Orders Chart Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get orders chart data for visualization
 * Shows total, delivered, cancelled orders by period
 */
export async function getOrdersChart(data, env, corsHeaders) {
    try {
        const period = data.period || 'week';
        const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
        
        const getVNDate = (timestamp) => {
            const vnTime = new Date(timestamp + VN_OFFSET_MS);
            return {
                year: vnTime.getUTCFullYear(),
                month: vnTime.getUTCMonth() + 1,
                date: vnTime.getUTCDate(),
                day: vnTime.getUTCDay()
            };
        };
        
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
            
            const duration = currentEnd - currentStart;
            previousStart = currentStart - duration;
            previousEnd = currentStart - 1;
            
            const days = Math.ceil(duration / (24 * 60 * 60 * 1000));
            if (days <= 1) {
                groupBy = 'hour';
                labels = Array.from({length: 24}, (_, i) => `${i}h`);
            } else if (days <= 31) {
                groupBy = 'day';
                labels = Array.from({length: days}, (_, i) => `${i + 1}`);
            } else {
                groupBy = 'month';
                labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
            }
        } else if (period === 'today') {
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, vnNow.date);
            currentEnd = currentStart + 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'hour';
            labels = Array.from({length: 24}, (_, i) => `${i}h`);
        } else if (period === 'week') {
            const daysSinceMonday = vnNow.day === 0 ? 6 : vnNow.day - 1;
            const mondayDate = vnNow.date - daysSinceMonday;
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, mondayDate);
            currentEnd = currentStart + 7 * 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 7 * 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'day';
            labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        } else if (period === 'month') {
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
            currentStart = getVNStartOfDay(vnNow.year, 1, 1);
            currentEnd = getVNStartOfDay(vnNow.year + 1, 1, 1) - 1;
            previousStart = getVNStartOfDay(vnNow.year - 1, 1, 1);
            previousEnd = currentStart - 1;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        } else {
            // Default to 'all' - all time data
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
        
        const { results: allOrders } = await env.DB.prepare(`
            SELECT created_at_unix, status
            FROM orders
            WHERE created_at_unix >= ? AND created_at_unix <= ?
        `).bind(previousStart, currentEnd).all();
        
        const currentData = { total: [], delivered: [], cancelled: [] };
        const previousData = { total: [], delivered: [], cancelled: [] };
        
        for (let i = 0; i < labels.length; i++) {
            currentData.total[i] = 0;
            currentData.delivered[i] = 0;
            currentData.cancelled[i] = 0;
            previousData.total[i] = 0;
            previousData.delivered[i] = 0;
            previousData.cancelled[i] = 0;
        }
        
        allOrders.forEach(order => {
            const timestamp = order.created_at_unix;
            const isCurrent = timestamp >= currentStart && timestamp <= currentEnd;
            const data = isCurrent ? currentData : previousData;
            const baseTime = isCurrent ? currentStart : previousStart;
            
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
            
            data.total[index] += 1;
            if (order.status === 'delivered') data.delivered[index] += 1;
            else if (order.status === 'cancelled') data.cancelled[index] += 1;
        });
        
        const currentTotal = {
            total: currentData.total.reduce((a, b) => a + b, 0),
            delivered: currentData.delivered.reduce((a, b) => a + b, 0),
            cancelled: currentData.cancelled.reduce((a, b) => a + b, 0)
        };
        
        const previousTotal = {
            total: previousData.total.reduce((a, b) => a + b, 0),
            delivered: previousData.delivered.reduce((a, b) => a + b, 0),
            cancelled: previousData.cancelled.reduce((a, b) => a + b, 0)
        };
        
        const comparison = {
            totalChange: previousTotal.total > 0 ? ((currentTotal.total - previousTotal.total) / previousTotal.total * 100) : 0,
            deliveredChange: previousTotal.delivered > 0 ? ((currentTotal.delivered - previousTotal.delivered) / previousTotal.delivered * 100) : 0,
            cancelledChange: previousTotal.cancelled > 0 ? ((currentTotal.cancelled - previousTotal.cancelled) / previousTotal.cancelled * 100) : 0
        };
        
        const currentDeliveryRate = currentTotal.total > 0 ? (currentTotal.delivered / currentTotal.total * 100) : 0;
        const currentCancelRate = currentTotal.total > 0 ? (currentTotal.cancelled / currentTotal.total * 100) : 0;
        
        return jsonResponse({
            success: true,
            period: period,
            labels: labels,
            currentPeriod: {
                total: currentData.total,
                delivered: currentData.delivered,
                cancelled: currentData.cancelled,
                totals: currentTotal,
                deliveryRate: Math.round(currentDeliveryRate * 10) / 10,
                cancelRate: Math.round(currentCancelRate * 10) / 10
            },
            previousPeriod: {
                total: previousData.total,
                delivered: previousData.delivered,
                cancelled: previousData.cancelled,
                totals: previousTotal
            },
            comparison: {
                totalChange: Math.round(comparison.totalChange * 10) / 10,
                deliveredChange: Math.round(comparison.deliveredChange * 10) / 10,
                cancelledChange: Math.round(comparison.cancelledChange * 10) / 10
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting orders chart:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
