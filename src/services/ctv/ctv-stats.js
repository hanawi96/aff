import { jsonResponse } from '../../utils/response.js';

// Get CTV orders - Optimized with single query
export async function getCTVOrdersOptimized(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({ success: false, error: 'Mã CTV không được để trống' }, 400, corsHeaders);
        }

        // Normalize referral code: trim và uppercase
        const normalizedCode = referralCode.trim().toUpperCase();

        // Single optimized query with JOIN - Case insensitive search
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.*,
                c.full_name as ctv_name,
                c.phone as ctv_phone,
                c.city as ctv_address
            FROM orders o
            LEFT JOIN ctv c ON UPPER(TRIM(o.referral_code)) = UPPER(TRIM(c.referral_code))
            WHERE UPPER(TRIM(o.referral_code)) = ?
            ORDER BY o.created_at DESC
        `).bind(normalizedCode).all();

        if (!orders.length) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }

        // Extract CTV info from first order
        const ctvInfo = {
            name: orders[0].ctv_name || 'CTV ' + referralCode,
            phone: orders[0].ctv_phone || '****',
            address: orders[0].ctv_address || 'Xem trong đơn hàng'
        };

        return jsonResponse({ success: true, orders, ctvInfo }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// Get CTV orders by phone - Optimized
export async function getCTVOrdersByPhoneOptimized(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({ success: false, error: 'Số điện thoại không được để trống' }, 400, corsHeaders);
        }

        // Normalize phone: trim và thử cả có/không có số 0 đầu
        const cleanPhone = phone.trim();
        const normalizedPhone = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
        const phoneWithout0 = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;

        // Single optimized query - Case insensitive và trim
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.*,
                c.full_name as ctv_name,
                c.phone as ctv_phone,
                c.city as ctv_address,
                c.referral_code
            FROM orders o
            LEFT JOIN ctv c ON UPPER(TRIM(o.referral_code)) = UPPER(TRIM(c.referral_code))
            WHERE TRIM(c.phone) = ? OR TRIM(c.phone) = ? OR TRIM(c.phone) = ?
            ORDER BY o.created_at DESC
        `).bind(normalizedPhone, phoneWithout0, cleanPhone).all();

        if (!orders.length) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }

        const ctvInfo = {
            name: orders[0].ctv_name || 'Cộng tác viên',
            phone: orders[0].ctv_phone || phone,
            address: orders[0].ctv_address || 'Xem trong đơn hàng'
        };

        return jsonResponse({
            success: true,
            orders,
            referralCode: orders[0].referral_code,
            ctvInfo
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// Get CTV dashboard - Optimized with aggregated queries
export async function getCTVDashboardOptimized(env, corsHeaders) {
    try {
        // Single query for all stats
        const stats = await env.DB.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM ctv WHERE is_active = 1) as totalCTV,
                (SELECT COUNT(*) FROM orders) as totalOrders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders) as totalRevenue,
                (SELECT COALESCE(SUM(commission), 0) FROM orders WHERE commission IS NOT NULL) as totalCommission
        `).first();

        // Top 5 performers - Optimized
        const { results: topPerformers } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                COUNT(*) as orderCount,
                SUM(o.total_amount) as totalRevenue,
                SUM(o.commission) as commission
            FROM orders o
            WHERE o.referral_code IS NOT NULL AND o.referral_code != ''
            GROUP BY o.referral_code
            ORDER BY totalRevenue DESC
            LIMIT 5
        `).all();

        return jsonResponse({
            success: true,
            stats: {
                totalCTV: stats.totalCTV || 0,
                totalOrders: stats.totalOrders || 0,
                totalRevenue: stats.totalRevenue || 0,
                totalCommission: stats.totalCommission || 0,
                topPerformers: topPerformers || []
            }
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
