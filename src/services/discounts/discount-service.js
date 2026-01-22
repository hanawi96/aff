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
                customer_type, allowed_customer_phones, combinable_with_other_discounts,
                active, visible,
                start_date, expiry_date,
                created_at_unix, updated_at_unix,
                usage_count, total_discount_amount,
                special_event, event_icon, event_date
            FROM discounts
            ORDER BY created_at_unix DESC
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

        // Get current timestamp
        const now = Date.now();

        const result = await env.DB.prepare(`
            INSERT INTO discounts (
                code, title, description, type,
                discount_value, max_discount_amount,
                gift_product_id, gift_product_name, gift_quantity,
                min_order_amount, min_items,
                max_total_uses, max_uses_per_customer,
                customer_type, combinable_with_other_discounts,
                active, visible,
                start_date, expiry_date,
                special_event, event_icon, event_date,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.special_event || null,
            data.event_icon || null,
            data.event_date || null,
            now,
            now
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

        // Get current timestamp
        const now = Date.now();

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
                expiry_date = ?,
                special_event = ?,
                event_icon = ?,
                event_date = ?,
                updated_at_unix = ?
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
            data.special_event || null,
            data.event_icon || null,
            data.event_date || null,
            now,
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

        // Use provided code or generate one
        let code;
        if (data.code && data.code.trim()) {
            // Use custom code from frontend
            code = data.code.trim().toUpperCase();
            
            // Validate code format
            if (!/^[A-Z0-9_-]+$/.test(code)) {
                return jsonResponse({
                    success: false,
                    error: 'Mã chỉ được chứa chữ in hoa, số, dấu gạch ngang và gạch dưới'
                }, 400, corsHeaders);
            }
            
            if (code.length < 3 || code.length > 20) {
                return jsonResponse({
                    success: false,
                    error: 'Mã phải có độ dài từ 3-20 ký tự'
                }, 400, corsHeaders);
            }
            
            // Check if code already exists
            const existingCode = await env.DB.prepare(
                'SELECT id FROM discounts WHERE code = ?'
            ).bind(code).first();
            
            if (existingCode) {
                return jsonResponse({
                    success: false,
                    error: `Mã "${code}" đã tồn tại. Vui lòng chọn mã khác`
                }, 400, corsHeaders);
            }
        } else {
            // Generate unique code with format: VIP{LAST4}-{RANDOM2}
            const last4 = data.customerPhone.slice(-4);
            const random2 = Math.floor(Math.random() * 90 + 10); // 10-99
            code = `VIP${last4}-${random2}`;
        }

        // Calculate expiry date (default 7 days)
        const expiryDays = data.expiryDays || 7;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        const expiryDateStr = expiryDate.toISOString().split('T')[0];

        // Create title
        const title = `Mã cá nhân - ${data.customerPhone}`;

        // Get current timestamp
        const now = Date.now();

        // Insert discount
        const result = await env.DB.prepare(`
            INSERT INTO discounts (
                code, title, description, type,
                discount_value, max_discount_amount,
                min_order_amount,
                max_total_uses, max_uses_per_customer,
                customer_type, allowed_customer_phones,
                active, visible,
                expiry_date, notes,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.notes || null,
            now,
            now
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

// Bulk extend expiry date for multiple discounts
export async function bulkExtendDiscounts(data, env, corsHeaders) {
    try {
        if (!data.discountIds || !Array.isArray(data.discountIds) || data.discountIds.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Thiếu danh sách mã giảm giá'
            }, 400, corsHeaders);
        }

        if (!data.newExpiryDate) {
            return jsonResponse({
                success: false,
                error: 'Thiếu ngày hết hạn mới'
            }, 400, corsHeaders);
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.newExpiryDate)) {
            return jsonResponse({
                success: false,
                error: 'Định dạng ngày không hợp lệ (phải là YYYY-MM-DD)'
            }, 400, corsHeaders);
        }

        // Validate date is in future
        const newDate = new Date(data.newExpiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (newDate <= today) {
            return jsonResponse({
                success: false,
                error: 'Ngày hết hạn mới phải sau ngày hôm nay'
            }, 400, corsHeaders);
        }

        const discountIds = data.discountIds;
        let updatedCount = 0;
        let failedIds = [];
        
        for (const id of discountIds) {
            try {
                const result = await env.DB.prepare(
                    `UPDATE discounts SET expiry_date = ? WHERE id = ?`
                ).bind(data.newExpiryDate, id).run();
                
                if (result.success && result.meta?.changes > 0) {
                    updatedCount++;
                } else {
                    failedIds.push(id);
                }
            } catch (err) {
                console.error(`Error updating discount ${id}:`, err);
                failedIds.push(id);
            }
        }

        return jsonResponse({
            success: updatedCount > 0,
            message: `Đã gia hạn ${updatedCount} mã giảm giá`,
            updatedCount: updatedCount,
            newExpiryDate: data.newExpiryDate,
            failedIds: failedIds,
            totalRequested: discountIds.length
        }, updatedCount > 0 ? 200 : 400, corsHeaders);

    } catch (error) {
        console.error('Error bulk extending discounts:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
