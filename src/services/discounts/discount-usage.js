import { jsonResponse } from '../../utils/response.js';

// Get discount usage history
export async function getDiscountUsageHistory(env, corsHeaders) {
    try {
        const { results: usageHistory } = await env.DB.prepare(`
            SELECT 
                du.id,
                du.discount_id,
                du.discount_code,
                du.order_id,
                du.customer_name,
                du.customer_phone,
                du.order_amount,
                du.discount_amount,
                du.gift_received,
                du.used_at,
                d.title as discount_title,
                d.type as discount_type,
                o.total_amount as order_total_amount
            FROM discount_usage du
            LEFT JOIN discounts d ON du.discount_id = d.id
            LEFT JOIN orders o ON du.order_id = o.order_id
            ORDER BY du.used_at DESC
            LIMIT 1000
        `).all();

        // Fix order_amount for old records: use total_amount from orders table if available
        const fixedUsageHistory = usageHistory.map(usage => {
            // If we have order_total_amount from orders table, use it (it's the correct value after discount)
            if (usage.order_total_amount !== null && usage.order_total_amount !== undefined) {
                usage.order_amount = usage.order_total_amount;
            }
            // Remove the temporary field
            delete usage.order_total_amount;
            return usage;
        });

        return jsonResponse({
            success: true,
            usageHistory: fixedUsageHistory
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting discount usage history:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Validate discount code
export async function validateDiscount(url, env, corsHeaders) {
    try {
        const code = url.searchParams.get('code');
        const customerPhone = url.searchParams.get('customerPhone');
        const orderAmount = parseFloat(url.searchParams.get('orderAmount')) || 0;

        if (!code) {
            return jsonResponse({
                success: false,
                error: 'Vui lòng nhập mã giảm giá'
            }, 400, corsHeaders);
        }

        // Get discount by code
        const discount = await env.DB.prepare(`
            SELECT * FROM discounts WHERE code = ? AND active = 1
        `).bind(code.toUpperCase()).first();

        if (!discount) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá không tồn tại hoặc đã hết hạn'
            }, 404, corsHeaders);
        }

        // Check expiry date
        const now = new Date();
        if (discount.expiry_date) {
            const expiryDate = new Date(discount.expiry_date);
            if (now > expiryDate) {
                return jsonResponse({
                    success: false,
                    error: 'Mã giảm giá đã hết hạn'
                }, 400, corsHeaders);
            }
        }

        // Check start date
        if (discount.start_date) {
            const startDate = new Date(discount.start_date);
            if (now < startDate) {
                return jsonResponse({
                    success: false,
                    error: 'Mã giảm giá chưa có hiệu lực'
                }, 400, corsHeaders);
            }
        }

        // Check minimum order amount
        if (discount.min_order_amount && orderAmount < discount.min_order_amount) {
            return jsonResponse({
                success: false,
                error: `Đơn hàng tối thiểu ${discount.min_order_amount.toLocaleString('vi-VN')}đ`
            }, 400, corsHeaders);
        }

        // Check max total uses
        if (discount.max_total_uses && discount.usage_count >= discount.max_total_uses) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá đã hết lượt sử dụng'
            }, 400, corsHeaders);
        }

        // Check max uses per customer
        if (customerPhone && discount.max_uses_per_customer) {
            const usageCount = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM discount_usage 
                WHERE discount_code = ? AND customer_phone = ?
            `).bind(code.toUpperCase(), customerPhone).first();

            if (usageCount && usageCount.count >= discount.max_uses_per_customer) {
                return jsonResponse({
                    success: false,
                    error: 'Bạn đã sử dụng hết lượt áp dụng mã này'
                }, 400, corsHeaders);
            }
        }

        // Check customer type restriction
        if (discount.customer_type && discount.customer_type !== 'all') {
            // For now, we'll skip this check as it requires order history
            // Can be implemented later if needed
        }

        // Check allowed customer phones
        if (discount.allowed_customer_phones && customerPhone) {
            try {
                const allowedPhones = JSON.parse(discount.allowed_customer_phones);
                if (Array.isArray(allowedPhones) && allowedPhones.length > 0) {
                    if (!allowedPhones.includes(customerPhone)) {
                        return jsonResponse({
                            success: false,
                            error: 'Mã giảm giá không áp dụng cho số điện thoại này'
                        }, 400, corsHeaders);
                    }
                }
            } catch (e) {
                console.warn('Error parsing allowed_customer_phones:', e);
            }
        }

        // All validations passed
        return jsonResponse({
            success: true,
            discount: discount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error validating discount:', error);
        return jsonResponse({
            success: false,
            error: 'Không thể kiểm tra mã giảm giá'
        }, 500, corsHeaders);
    }
}
