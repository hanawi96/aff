import { jsonResponse } from '../../utils/response.js';

// Get all discounts
export async function getAllDiscounts(env, corsHeaders) {
    try {
        const { results: discounts } = await env.DB.prepare(`
            SELECT 
                id, code, title, description, type,
                discount_value, max_discount_amount,
                gift_product_id, gift_product_name, gift_quantity,
                min_order_amount, min_items,
                max_total_uses, max_uses_per_customer,
                customer_type, combinable_with_other_discounts,
                active, visible,
                start_date, expiry_date,
                created_at, updated_at,
                usage_count, total_discount_amount
            FROM discounts
            ORDER BY created_at DESC
        `).all();

        return jsonResponse({
            success: true,
            discounts: discounts
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting all discounts:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get single discount by ID
export async function getDiscount(id, env, corsHeaders) {
    try {
        const discount = await env.DB.prepare(`
            SELECT * FROM discounts WHERE id = ?
        `).bind(id).first();

        if (!discount) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy mã giảm giá'
            }, 404, corsHeaders);
        }

        return jsonResponse({
            success: true,
            discount: discount
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create new discount
export async function createDiscount(data, env, corsHeaders) {
    try {
        // Check if code already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM discounts WHERE code = ?
        `).bind(data.code).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá đã tồn tại'
            }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            INSERT INTO discounts (
                code, title, description, type,
                discount_value, max_discount_amount,
                gift_product_id, gift_product_name, gift_quantity,
                min_order_amount, min_items,
                max_total_uses, max_uses_per_customer,
                customer_type, combinable_with_other_discounts,
                active, visible,
                start_date, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.code,
            data.title,
            data.description || null,
            data.type,
            data.discount_value || 0,
            data.max_discount_amount || null,
            data.gift_product_id || null,
            data.gift_product_name || null,
            data.gift_quantity || 1,
            data.min_order_amount || 0,
            data.min_items || 0,
            data.max_total_uses || null,
            data.max_uses_per_customer || 1,
            data.customer_type || 'all',
            data.combinable_with_other_discounts || 0,
            data.active || 1,
            data.visible || 1,
            data.start_date || null,
            data.expiry_date
        ).run();

        if (!result.success) {
            throw new Error('Failed to create discount');
        }

        return jsonResponse({
            success: true,
            message: 'Tạo mã giảm giá thành công',
            id: result.meta.last_row_id
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error creating discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update discount
export async function updateDiscount(data, env, corsHeaders) {
    try {
        // Check if discount exists
        const existing = await env.DB.prepare(`
            SELECT id FROM discounts WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy mã giảm giá'
            }, 404, corsHeaders);
        }

        // Check if code is taken by another discount
        const codeCheck = await env.DB.prepare(`
            SELECT id FROM discounts WHERE code = ? AND id != ?
        `).bind(data.code, data.id).first();

        if (codeCheck) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá đã được sử dụng'
            }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            UPDATE discounts SET
                code = ?,
                title = ?,
                description = ?,
                type = ?,
                discount_value = ?,
                max_discount_amount = ?,
                gift_product_id = ?,
                gift_product_name = ?,
                gift_quantity = ?,
                min_order_amount = ?,
                min_items = ?,
                max_total_uses = ?,
                max_uses_per_customer = ?,
                customer_type = ?,
                combinable_with_other_discounts = ?,
                active = ?,
                visible = ?,
                start_date = ?,
                expiry_date = ?
            WHERE id = ?
        `).bind(
            data.code,
            data.title,
            data.description || null,
            data.type,
            data.discount_value || 0,
            data.max_discount_amount || null,
            data.gift_product_id || null,
            data.gift_product_name || null,
            data.gift_quantity || 1,
            data.min_order_amount || 0,
            data.min_items || 0,
            data.max_total_uses || null,
            data.max_uses_per_customer || 1,
            data.customer_type || 'all',
            data.combinable_with_other_discounts || 0,
            data.active || 1,
            data.visible || 1,
            data.start_date || null,
            data.expiry_date,
            data.id
        ).run();

        if (!result.success) {
            throw new Error('Failed to update discount');
        }

        return jsonResponse({
            success: true,
            message: 'Cập nhật mã giảm giá thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete discount
export async function deleteDiscount(data, env, corsHeaders) {
    try {
        // Check if discount has been used
        const usageCheck = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM discount_usage WHERE discount_id = ?
        `).bind(data.id).first();

        if (usageCheck && usageCheck.count > 0) {
            return jsonResponse({
                success: false,
                error: 'Không thể xóa mã đã được sử dụng. Bạn có thể tạm dừng mã này thay vì xóa.'
            }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            DELETE FROM discounts WHERE id = ?
        `).bind(data.id).run();

        if (!result.success) {
            throw new Error('Failed to delete discount');
        }

        return jsonResponse({
            success: true,
            message: 'Xóa mã giảm giá thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error deleting discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Toggle discount status (active/inactive)
export async function toggleDiscountStatus(data, env, corsHeaders) {
    try {
        const result = await env.DB.prepare(`
            UPDATE discounts SET active = ? WHERE id = ?
        `).bind(data.active ? 1 : 0, data.id).run();

        if (!result.success) {
            throw new Error('Failed to toggle discount status');
        }

        return jsonResponse({
            success: true,
            message: 'Cập nhật trạng thái thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error toggling discount status:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create quick personal discount for specific customer
export async function createQuickDiscount(data, env, corsHeaders) {
    try {
        // Validate required fields
        if (!data.customerPhone || !data.type || !data.discountValue) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin: số điện thoại, loại giảm giá, hoặc giá trị giảm'
            }, 400, corsHeaders);
        }

        // Validate phone format
        const phoneRegex = /^0\d{9}$/;
        if (!phoneRegex.test(data.customerPhone)) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không hợp lệ (phải có 10 số, bắt đầu bằng 0)'
            }, 400, corsHeaders);
        }

        // Generate unique code with better format
        // Format: VIP{LAST4}{RANDOM2DIGITS} 
        // Example: VIP4567-89, VIP1234-56
        const last4 = data.customerPhone.slice(-4);
        const random2 = Math.floor(Math.random() * 90 + 10); // 10-99
        const code = `VIP${last4}-${random2}`;

        // Alternative: If you want even shorter
        // const code = `VIP${last4}${random2}`; // VIP456789

        // Calculate expiry date (default 7 days)
        const expiryDays = data.expiryDays || 7;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        const expiryDateStr = expiryDate.toISOString().split('T')[0];

        // Create title
        const title = `Mã cá nhân - ${data.customerPhone}`;

        // Insert discount
        const result = await env.DB.prepare(`
            INSERT INTO discounts (
                code, title, description, type,
                discount_value, max_discount_amount,
                min_order_amount,
                max_total_uses, max_uses_per_customer,
                customer_type, allowed_customer_phones,
                active, visible,
                expiry_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            code,
            title,
            `Mã giảm giá cá nhân cho khách hàng ${data.customerPhone}`,
            data.type,
            data.discountValue,
            data.maxDiscountAmount || null,
            data.minOrderAmount || 0,
            1, // max_total_uses = 1 (chỉ dùng 1 lần)
            1, // max_uses_per_customer = 1
            'all',
            JSON.stringify([data.customerPhone]), // allowed_customer_phones
            1, // active
            0, // visible = 0 (ẩn khỏi danh sách công khai)
            expiryDateStr,
            data.notes || null
        ).run();

        if (!result.success) {
            throw new Error('Failed to create quick discount');
        }

        return jsonResponse({
            success: true,
            message: 'Tạo mã giảm giá thành công',
            discount: {
                id: Number(result.meta.last_row_id),
                code: code,
                customerPhone: data.customerPhone,
                type: data.type,
                discountValue: data.discountValue,
                minOrderAmount: data.minOrderAmount || 0,
                expiryDate: expiryDateStr,
                expiryDays: expiryDays
            }
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error creating quick discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
