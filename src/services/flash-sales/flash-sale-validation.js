// Validate flash sale time conflicts
export async function checkTimeConflicts(productId, startTime, endTime, excludeFlashSaleId, env) {
    try {
        let query = `
            SELECT 
                fs.id,
                fs.name,
                fs.start_time,
                fs.end_time
            FROM flash_sale_products fsp
            INNER JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
            WHERE fsp.product_id = ?
                AND fsp.is_active = 1
                AND fs.status IN ('scheduled', 'active')
                AND (
                    (fs.start_time <= ? AND fs.end_time > ?)
                    OR (fs.start_time < ? AND fs.end_time >= ?)
                    OR (fs.start_time >= ? AND fs.end_time <= ?)
                )
        `;

        const params = [productId, startTime, startTime, endTime, endTime, startTime, endTime];

        if (excludeFlashSaleId) {
            query += ' AND fs.id != ?';
            params.push(excludeFlashSaleId);
        }

        const { results: conflicts } = await env.DB.prepare(query).bind(...params).all();

        return {
            hasConflict: conflicts.length > 0,
            conflicts: conflicts
        };
    } catch (error) {
        console.error('Error checking time conflicts:', error);
        throw error;
    }
}

// Validate flash sale data
export function validateFlashSaleData(data) {
    const errors = [];

    // Name validation
    if (!data.name || data.name.trim().length === 0) {
        errors.push('Tên flash sale không được để trống');
    }

    if (data.name && data.name.length > 200) {
        errors.push('Tên flash sale không được quá 200 ký tự');
    }

    // Time validation
    if (!data.start_time) {
        errors.push('Thời gian bắt đầu không được để trống');
    }

    if (!data.end_time) {
        errors.push('Thời gian kết thúc không được để trống');
    }

    if (data.start_time && data.end_time && data.end_time <= data.start_time) {
        errors.push('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    // Status validation
    const validStatuses = ['draft', 'scheduled', 'active', 'ended', 'cancelled'];
    if (data.status && !validStatuses.includes(data.status)) {
        errors.push('Trạng thái không hợp lệ');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Validate flash sale product data
export function validateFlashSaleProductData(data, productPrice) {
    const errors = [];

    // Product ID validation
    if (!data.product_id) {
        errors.push('ID sản phẩm không được để trống');
    }

    // Price validation
    if (data.flash_price === undefined || data.flash_price === null) {
        errors.push('Giá flash sale không được để trống');
    }

    if (data.flash_price < 0) {
        errors.push('Giá flash sale phải lớn hơn hoặc bằng 0');
    }

    const originalPrice = data.original_price || productPrice;
    if (data.flash_price >= originalPrice) {
        errors.push('Giá flash sale phải nhỏ hơn giá gốc');
    }

    // Stock limit validation
    if (data.stock_limit !== undefined && data.stock_limit !== null) {
        if (data.stock_limit <= 0) {
            errors.push('Giới hạn số lượng phải lớn hơn 0');
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Auto-update flash sale status based on time
export async function autoUpdateFlashSaleStatus(env) {
    try {
        const now = Math.floor(Date.now() / 1000);

        // Update scheduled -> active
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'active', updated_at_unix = ?
            WHERE status = 'scheduled' 
                AND start_time <= ?
                AND end_time > ?
        `).bind(now, now, now).run();

        // Update active -> ended
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'ended', updated_at_unix = ?
            WHERE status = 'active' 
                AND end_time <= ?
        `).bind(now, now).run();

        return { success: true };
    } catch (error) {
        console.error('Error auto-updating flash sale status:', error);
        return { success: false, error: error.message };
    }
}

// Check if flash sale can be deleted
export async function canDeleteFlashSale(flashSaleId, env) {
    try {
        const flashSale = await env.DB.prepare(`
            SELECT status FROM flash_sales WHERE id = ?
        `).bind(flashSaleId).first();

        if (!flashSale) {
            return { canDelete: false, reason: 'Flash sale không tồn tại' };
        }

        // Can't delete active flash sales
        if (flashSale.status === 'active') {
            return { canDelete: false, reason: 'Không thể xóa flash sale đang hoạt động' };
        }

        return { canDelete: true };
    } catch (error) {
        console.error('Error checking if can delete:', error);
        return { canDelete: false, reason: error.message };
    }
}

// Check if flash sale can be edited
export async function canEditFlashSale(flashSaleId, env) {
    try {
        const flashSale = await env.DB.prepare(`
            SELECT status FROM flash_sales WHERE id = ?
        `).bind(flashSaleId).first();

        if (!flashSale) {
            return { canEdit: false, reason: 'Flash sale không tồn tại' };
        }

        // Can't edit ended or cancelled flash sales
        if (flashSale.status === 'ended' || flashSale.status === 'cancelled') {
            return { canEdit: false, reason: 'Không thể sửa flash sale đã kết thúc hoặc đã hủy' };
        }

        return { canEdit: true };
    } catch (error) {
        console.error('Error checking if can edit:', error);
        return { canEdit: false, reason: error.message };
    }
}
