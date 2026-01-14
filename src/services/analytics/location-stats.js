// Location Statistics Analytics
import { jsonResponse } from '../../utils/response.js';

/**
 * Get location statistics with drill-down support
 * Supports 3 levels: province → district → ward
 */
export async function getLocationStats(params, env, corsHeaders) {
    try {
        const { level, provinceId, districtId, period, startDate, previousStartDate, previousEndDate } = params;
        
        // Calculate date range
        let startTimestamp = 0;
        if (startDate) {
            startTimestamp = new Date(startDate).getTime();
        } else if (period && period !== 'all') {
            const now = new Date();
            switch (period) {
                case 'today':
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).getTime();
                    break;
                case 'week':
                    const dayOfWeek = now.getUTCDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday, 0, 0, 0)).getTime();
                    break;
                case 'month':
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).getTime();
                    break;
                case 'year':
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0)).getTime();
                    break;
            }
        }

        let query, previousQuery;

        // Build query based on level
        if (level === 'province') {
            // Province level - group by province_id
            query = `
                SELECT 
                    province_id as id,
                    province_name as name,
                    COUNT(*) as orders,
                    SUM(total_amount) as revenue,
                    COUNT(DISTINCT customer_phone) as customers,
                    AVG(total_amount) as avgValue
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id IS NOT NULL 
                    AND province_id != ''
                    AND created_at_unix >= ?
                GROUP BY province_id, province_name
                ORDER BY revenue DESC
            `;
            
            if (previousStartDate && previousEndDate) {
                const prevStart = new Date(previousStartDate).getTime();
                const prevEnd = new Date(previousEndDate).getTime();
                previousQuery = `
                    SELECT 
                        province_id as id,
                        COUNT(*) as orders,
                        SUM(total_amount) as revenue
                    FROM orders
                    WHERE customer_phone IS NOT NULL 
                        AND customer_phone != ''
                        AND province_id IS NOT NULL 
                        AND province_id != ''
                        AND created_at_unix >= ?
                        AND created_at_unix <= ?
                    GROUP BY province_id
                `;
            }
        } else if (level === 'district' && provinceId) {
            // District level - filter by province, group by district
            query = `
                SELECT 
                    district_id as id,
                    district_name as name,
                    COUNT(*) as orders,
                    SUM(total_amount) as revenue,
                    COUNT(DISTINCT customer_phone) as customers,
                    AVG(total_amount) as avgValue
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND district_id IS NOT NULL 
                    AND district_id != ''
                    AND created_at_unix >= ?
                GROUP BY district_id, district_name
                ORDER BY revenue DESC
            `;
            
            if (previousStartDate && previousEndDate) {
                const prevStart = new Date(previousStartDate).getTime();
                const prevEnd = new Date(previousEndDate).getTime();
                previousQuery = `
                    SELECT 
                        district_id as id,
                        COUNT(*) as orders,
                        SUM(total_amount) as revenue
                    FROM orders
                    WHERE customer_phone IS NOT NULL 
                        AND customer_phone != ''
                        AND province_id = ?
                        AND district_id IS NOT NULL 
                        AND district_id != ''
                        AND created_at_unix >= ?
                        AND created_at_unix <= ?
                    GROUP BY district_id
                `;
            }
        } else if (level === 'ward' && provinceId && districtId) {
            // Ward level - filter by province and district, group by ward
            query = `
                SELECT 
                    ward_id as id,
                    ward_name as name,
                    COUNT(*) as orders,
                    SUM(total_amount) as revenue,
                    COUNT(DISTINCT customer_phone) as customers,
                    AVG(total_amount) as avgValue
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND district_id = ?
                    AND ward_id IS NOT NULL 
                    AND ward_id != ''
                    AND created_at_unix >= ?
                GROUP BY ward_id, ward_name
                ORDER BY revenue DESC
            `;
            
            if (previousStartDate && previousEndDate) {
                const prevStart = new Date(previousStartDate).getTime();
                const prevEnd = new Date(previousEndDate).getTime();
                previousQuery = `
                    SELECT 
                        ward_id as id,
                        COUNT(*) as orders,
                        SUM(total_amount) as revenue
                    FROM orders
                    WHERE customer_phone IS NOT NULL 
                        AND customer_phone != ''
                        AND province_id = ?
                        AND district_id = ?
                        AND ward_id IS NOT NULL 
                        AND ward_id != ''
                        AND created_at_unix >= ?
                        AND created_at_unix <= ?
                    GROUP BY ward_id
                `;
            }
        } else {
            return jsonResponse({
                success: false,
                error: 'Invalid level or missing required parameters'
            }, 400, corsHeaders);
        }

        // Execute current period query
        let results;
        if (level === 'province') {
            results = await env.DB.prepare(query).bind(startTimestamp).all();
        } else if (level === 'district') {
            results = await env.DB.prepare(query).bind(provinceId, startTimestamp).all();
        } else if (level === 'ward') {
            results = await env.DB.prepare(query).bind(provinceId, districtId, startTimestamp).all();
        }

        const locations = results.results || [];

        // Execute previous period query if requested
        let previousLocations = [];
        if (previousQuery && previousStartDate && previousEndDate) {
            const prevStart = new Date(previousStartDate).getTime();
            const prevEnd = new Date(previousEndDate).getTime();
            
            let prevResults;
            if (level === 'province') {
                prevResults = await env.DB.prepare(previousQuery).bind(prevStart, prevEnd).all();
            } else if (level === 'district') {
                prevResults = await env.DB.prepare(previousQuery).bind(provinceId, prevStart, prevEnd).all();
            } else if (level === 'ward') {
                prevResults = await env.DB.prepare(previousQuery).bind(provinceId, districtId, prevStart, prevEnd).all();
            }
            
            previousLocations = prevResults.results || [];
        }

        // Format data
        const formattedLocations = locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            orders: loc.orders || 0,
            revenue: loc.revenue || 0,
            customers: loc.customers || 0,
            avgValue: loc.avgValue || 0
        }));

        const formattedPreviousLocations = previousLocations.map(loc => ({
            id: loc.id,
            orders: loc.orders || 0,
            revenue: loc.revenue || 0
        }));

        // Calculate unique customers across all locations (to avoid double counting)
        // Count all customers with phone, not just those with address
        let uniqueCustomersQuery;
        if (level === 'province') {
            uniqueCustomersQuery = await env.DB.prepare(`
                SELECT COUNT(DISTINCT customer_phone) as unique_customers
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND created_at_unix >= ?
            `).bind(startTimestamp).first();
        } else if (level === 'district') {
            uniqueCustomersQuery = await env.DB.prepare(`
                SELECT COUNT(DISTINCT customer_phone) as unique_customers
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND created_at_unix >= ?
            `).bind(provinceId, startTimestamp).first();
        } else if (level === 'ward') {
            uniqueCustomersQuery = await env.DB.prepare(`
                SELECT COUNT(DISTINCT customer_phone) as unique_customers
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND district_id = ?
                    AND created_at_unix >= ?
            `).bind(provinceId, districtId, startTimestamp).first();
        }

        const uniqueCustomers = uniqueCustomersQuery?.unique_customers || 0;

        return jsonResponse({
            success: true,
            level: level,
            period: period || 'all',
            locations: formattedLocations,
            previousLocations: formattedPreviousLocations,
            uniqueCustomers: uniqueCustomers,
            total: formattedLocations.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting location stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
