import { jsonResponse } from '../../utils/response.js';
import { normalizePhone } from '../../utils/validators.js';

// Lấy đơn hàng theo mã CTV
export async function getOrdersByReferralCode(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'Mã referral không được để trống'
            }, 400, corsHeaders);
        }

        // is_excluded: đồng bộ tab Thanh toán CTV (đơn bị loại HH vẫn hiện trong bảng, có cờ)
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.*,
                COALESCE(
                    (SELECT MAX(cpd.is_excluded) FROM commission_payment_details cpd WHERE cpd.order_id = o.id),
                    0
                ) AS is_excluded
            FROM orders o
            WHERE o.referral_code = ?
            ORDER BY o.created_at_unix DESC
        `).bind(referralCode).all();

        // Get CTV info
        const ctvInfo = await env.DB.prepare(`
            SELECT full_name as name, phone, city as address
            FROM ctv
            WHERE referral_code = ?
        `).bind(referralCode).first();

        return jsonResponse({
            success: true,
            orders: orders,
            referralCode: referralCode,
            ctvInfo: ctvInfo || { name: 'Chưa cập nhật', phone: 'Chưa cập nhật', address: 'Chưa cập nhật' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng theo SĐT CTV
export async function getOrdersByPhone(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không được để trống'
            }, 400, corsHeaders);
        }

        const normalizedPhone = normalizePhone(phone);

        // Get orders
        const { results: orders } = await env.DB.prepare(`
            SELECT * FROM orders
            WHERE ctv_phone = ? OR ctv_phone = ?
            ORDER BY created_at_unix DESC
        `).bind(normalizedPhone, '0' + normalizedPhone).all();

        // Get CTV info
        const ctvInfo = await env.DB.prepare(`
            SELECT full_name as name, phone, city as address
            FROM ctv
            WHERE phone = ? OR phone = ?
        `).bind(normalizedPhone, '0' + normalizedPhone).first();

        const referralCode = orders.length > 0 ? orders[0].referral_code : '';

        return jsonResponse({
            success: true,
            orders: orders,
            referralCode: referralCode,
            phone: phone,
            ctvInfo: ctvInfo || { name: 'Không tìm thấy', phone: phone, address: 'Không tìm thấy' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting orders by phone:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng mới nhất
export async function getRecentOrders(limit, env, corsHeaders, lite = false) {
    try {
        // product_cost = tổng giá vốn từ order_items.
        // Trước đây dùng subquery tương quan → chạy 1 lần / đơn (N+1, rất chậm trên D1).
        // Đổi sang LEFT JOIN + GROUP BY: chỉ quét order_items một lần, tận dụng index
        // idx_order_items_order_id (migration 079). orders.id là PK nên các cột orders.*
        // và ctv.commission_rate phụ thuộc hàm vào GROUP BY orders.id — hợp lệ trên SQLite/D1.
        //
        // lite=true (dùng cho danh sách mobile): BỎ JOIN order_items + SUM(product_cost)
        // — phần nặng nhất (GROUP BY) mà danh sách mobile KHÔNG dùng đến. Vẫn giữ JOIN ctv
        // (rẻ, có index) để có ctv_commission_rate. → query nhẹ & nhanh hơn nhiều.
        //
        // Ngoài ra chỉ SELECT đúng các cột mà DANH SÁCH/CHI TIẾT/TÌM KIẾM/ĐẾM mobile dùng tới,
        // BỎ các cột chỉ cần khi SỬA đơn (địa chỉ tách phần, đóng gói, thuế, giá vốn ship, mã/giá
        // giảm) → giảm payload đáng kể. Khi mở SỬA đơn, mobile gọi getOrderById để lấy full.
        // (Lưu ý: vẫn GIỮ address gộp, commission, commission_rate, referral_code, shipping_fee
        //  vì chi tiết + tìm kiếm + tính lại hoa hồng ở chi tiết có dùng.)
        const sql = lite
            ? `SELECT
                   orders.id, orders.order_id, orders.customer_name, orders.customer_phone,
                   orders.address, orders.products, orders.notes, orders.status,
                   orders.total_amount, orders.deposit_amount, orders.payment_method,
                   orders.shipping_fee, orders.commission, orders.commission_rate,
                   orders.referral_code, orders.is_priority,
                   orders.created_at_unix, orders.shipped_at_unix, orders.planned_send_at_unix,
                   ctv.commission_rate as ctv_commission_rate
               FROM orders
               LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
               ORDER BY orders.created_at_unix DESC
               LIMIT ?`
            : `SELECT 
                   orders.*,
                   ctv.commission_rate as ctv_commission_rate,
                   COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost
               FROM orders
               LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
               LEFT JOIN order_items oi ON oi.order_id = orders.id
               GROUP BY orders.id
               ORDER BY orders.created_at_unix DESC
               LIMIT ?`;

        const { results: orders } = await env.DB.prepare(sql).bind(limit).all();

        return jsonResponse({
            success: true,
            orders: orders,
            total: orders.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting recent orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Lấy 1 đơn hàng theo db id với FULL shape (đầy đủ mọi cột + ctv_commission_rate + product_cost),
 * dùng cho mobile khi mở SỬA đơn (vì danh sách lite đã bỏ bớt cột địa chỉ tách phần/đóng gói/thuế...).
 * Cùng shape với getRecentOrders (đầy đủ) để gắn thẳng vào allOrders.
 */
export async function getOrderById(id, env, corsHeaders) {
    try {
        const orderId = parseInt(id);
        if (!orderId) {
            return jsonResponse({ success: false, error: 'Thiếu id đơn hàng' }, 400, corsHeaders);
        }
        const order = await env.DB.prepare(`
            SELECT
                orders.*,
                ctv.commission_rate AS ctv_commission_rate,
                COALESCE(
                    (SELECT SUM(product_cost * quantity)
                     FROM order_items
                     WHERE order_items.order_id = orders.id),
                    0
                ) AS product_cost
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            WHERE orders.id = ?
        `).bind(orderId).first();

        if (!order) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }
        return jsonResponse({ success: true, order }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting order by id:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
