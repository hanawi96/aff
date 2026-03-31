import { jsonResponse } from '../../utils/response.js';

// Get CTV orders - Optimized with single query
export async function getCTVOrdersOptimized(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({ success: false, error: 'Mã CTV không được để trống' }, 400, corsHeaders);
        }

        // Normalize referral code: trim và uppercase
        const normalizedCode = referralCode.trim().toUpperCase();

        // First, check if CTV exists
        const ctv = await env.DB.prepare(`
            SELECT 
                full_name,
                phone,
                city,
                referral_code,
                custom_slug,
                created_at_unix
            FROM ctv
            WHERE UPPER(TRIM(referral_code)) = ?
        `).bind(normalizedCode).first();

        if (!ctv) {
            return jsonResponse({ success: false, error: 'Mã CTV không tồn tại' }, 404, corsHeaders);
        }

        // Get orders for this CTV
        const { results: orders } = await env.DB.prepare(`
            SELECT o.*
            FROM orders o
            WHERE UPPER(TRIM(o.referral_code)) = ?
            ORDER BY o.created_at_unix DESC
        `).bind(normalizedCode).all();

        // CTV info from database
        const ctvInfo = {
            name: ctv.full_name || 'CTV ' + referralCode,
            phone: ctv.phone || '****',
            address: ctv.city || 'Chưa cập nhật',
            created_at_unix: ctv.created_at_unix ?? null
        };

        return jsonResponse({ 
            success: true, 
            orders: orders || [], 
            ctvInfo,
            referralCode: ctv.referral_code,
            customSlug: ctv.custom_slug || null
        }, 200, corsHeaders);
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

        // First, check if CTV exists with this phone
        const ctv = await env.DB.prepare(`
            SELECT 
                full_name,
                phone,
                city,
                referral_code,
                custom_slug,
                created_at_unix
            FROM ctv
            WHERE TRIM(phone) = ? OR TRIM(phone) = ? OR TRIM(phone) = ?
        `).bind(normalizedPhone, phoneWithout0, cleanPhone).first();

        if (!ctv) {
            return jsonResponse({ success: false, error: 'Số điện thoại chưa đăng ký CTV' }, 404, corsHeaders);
        }

        // Get orders for this CTV
        const { results: orders } = await env.DB.prepare(`
            SELECT o.*
            FROM orders o
            WHERE UPPER(TRIM(o.referral_code)) = UPPER(TRIM(?))
            ORDER BY o.created_at_unix DESC
        `).bind(ctv.referral_code).all();

        const ctvInfo = {
            name: ctv.full_name || 'Cộng tác viên',
            phone: ctv.phone || phone,
            address: ctv.city || 'Chưa cập nhật',
            created_at_unix: ctv.created_at_unix ?? null
        };

        return jsonResponse({
            success: true,
            orders: orders || [],
            referralCode: ctv.referral_code,
            customSlug: ctv.custom_slug || null,
            ctvInfo
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/**
 * Tra cứu theo mã đơn hàng (order_id hoặc id): trả về CTV sở hữu đơn + đúng một đơn.
 * Dùng cho trang CTV công khai — không cần nhập mã CTV/SĐT.
 */
export async function getCTVOrdersByOrderIdOptimized(orderIdRaw, env, corsHeaders) {
    try {
        if (!orderIdRaw || !String(orderIdRaw).trim()) {
            return jsonResponse({ success: false, error: 'Mã đơn hàng không được để trống' }, 400, corsHeaders);
        }

        const cleaned = String(orderIdRaw)
            .trim()
            .replace(/^#+/, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (!cleaned) {
            return jsonResponse({ success: false, error: 'Mã đơn hàng không hợp lệ' }, 400, corsHeaders);
        }

        const norm = cleaned.toUpperCase();
        const numericId = /^\d+$/.test(cleaned) ? parseInt(cleaned, 10) : null;

        const { results: orderRows } = await env.DB.prepare(`
            SELECT o.*
            FROM orders o
            WHERE UPPER(TRIM(COALESCE(o.order_id, ''))) = ?
               OR (? IS NOT NULL AND o.id = ?)
            LIMIT 1
        `).bind(norm, numericId, numericId).all();

        if (!orderRows || orderRows.length === 0) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng với mã này' }, 404, corsHeaders);
        }

        const order = orderRows[0];
        const refRaw = order.referral_code != null ? String(order.referral_code).trim() : '';
        const ref = refRaw ? refRaw.toUpperCase() : '';

        // Đơn không gắn CTV: vẫn trả về đơn để tra cứu được (trước đây trả 404 → UI báo "không tìm thấy")
        if (!ref) {
            return jsonResponse({
                success: true,
                orders: [order],
                referralCode: null,
                customSlug: null,
                ctvInfo: {
                    name: 'Đơn không gắn mã CTV',
                    phone: '—',
                    address: 'Khách đặt không qua link giới thiệu',
                    created_at_unix: null,
                    noReferral: true
                },
                lookupByOrderId: true,
                noReferral: true
            }, 200, corsHeaders);
        }

        // Khớp cả mã giới thiệu chính thức và custom_slug (link ?ref= có thể map về một trong hai)
        const ctv = await env.DB.prepare(`
            SELECT 
                full_name,
                phone,
                city,
                referral_code,
                custom_slug,
                created_at_unix
            FROM ctv
            WHERE UPPER(TRIM(COALESCE(referral_code, ''))) = ?
               OR UPPER(TRIM(COALESCE(custom_slug, ''))) = ?
            LIMIT 1
        `).bind(ref, ref).first();

        if (!ctv) {
            return jsonResponse({
                success: true,
                orders: [order],
                referralCode: refRaw,
                customSlug: null,
                ctvInfo: {
                    name: 'CTV không còn trong hệ thống',
                    phone: '—',
                    address: `Đơn gắn mã ${refRaw} nhưng không tìm thấy hồ sơ CTV`,
                    created_at_unix: null,
                    ctvMissing: true
                },
                lookupByOrderId: true,
                ctvMissing: true
            }, 200, corsHeaders);
        }

        const ctvInfo = {
            name: ctv.full_name || 'CTV ' + ref,
            phone: ctv.phone || '****',
            address: ctv.city || 'Chưa cập nhật',
            created_at_unix: ctv.created_at_unix ?? null
        };

        return jsonResponse({
            success: true,
            orders: [order],
            referralCode: ctv.referral_code,
            customSlug: ctv.custom_slug || null,
            ctvInfo,
            lookupByOrderId: true
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
