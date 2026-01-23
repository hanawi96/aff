import { jsonResponse } from '../../utils/response.js';
import { validateFlashSaleData } from './flash-sale-validation.js';

// Get all flash sales
export async function getAllFlashSales(env, corsHeaders) {
    try {
        const now = Math.floor(Date.now() / 1000);
        
        // First, auto-update statuses based on current time
        // Update scheduled -> active (if start time has passed)
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'active', updated_at_unix = ?
            WHERE status = 'scheduled' 
                AND start_time <= ? 
                AND end_time > ?
        `).bind(now, now, now).run();
        
        // Update active -> ended (if end time has passed)
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'ended', updated_at_unix = ?
            WHERE status = 'active' 
                AND end_time <= ?
        `).bind(now, now).run();
        
        // Update scheduled -> ended (if both times have passed)
        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = 'ended', updated_at_unix = ?
            WHERE status = 'scheduled' 
                AND end_time <= ?
        `).bind(now, now).run();
        
        // Now get all flash sales with updated statuses
        const { results: flashSales } = await env.DB.prepare(`
            SELECT 
                fs.*,
                COUNT(fsp.id) as product_count,
                SUM(fsp.sold_count) as total_sold
            FROM flash_sales fs
            LEFT JOIN flash_sale_products fsp ON fs.id = fsp.flash_sale_id AND fsp.is_active = 1
            GROUP BY fs.id
            ORDER BY fs.created_at_unix DESC
        `).all();

        return jsonResponse({
            success: true,
            flashSales: flashSales
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting all flash sales:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get single flash sale by ID
export async function getFlashSale(id, env, corsHeaders) {
    try {
        const flashSale = await env.DB.prepare(`
            SELECT * FROM flash_sales WHERE id = ?
        `).bind(id).first();

        if (!flashSale) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy flash sale'
            }, 404, corsHeaders);
        }

        return jsonResponse({
            success: true,
            flashSale: flashSale
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get active flash sales (for public display)
export async function getActiveFlashSales(env, corsHeaders) {
    try {
        const now = Math.floor(Date.now() / 1000);
        
        // Auto-update statuses before querying
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
        
        // Get active flash sales
        const { results: flashSales } = await env.DB.prepare(`
            SELECT 
                fs.*,
                COUNT(fsp.id) as product_count
            FROM flash_sales fs
            LEFT JOIN flash_sale_products fsp ON fs.id = fsp.flash_sale_id AND fsp.is_active = 1
            WHERE fs.status = 'active' 
                AND fs.is_visible = 1
                AND fs.start_time <= ?
                AND fs.end_time > ?
            GROUP BY fs.id
            ORDER BY fs.end_time ASC
        `).bind(now, now).all();

        return jsonResponse({
            success: true,
            flashSales: flashSales
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting active flash sales:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create new flash sale
export async function createFlashSale(data, env, corsHeaders) {
    try {
        // Validate input data
        const validation = validateFlashSaleData(data);
        if (!validation.isValid) {
            return jsonResponse({
                success: false,
                error: validation.errors[0],
                errors: validation.errors
            }, 400, corsHeaders);
        }

        // Validate time range
        if (data.end_time <= data.start_time) {
            return jsonResponse({
                success: false,
                error: 'Thời gian kết thúc phải sau thời gian bắt đầu'
            }, 400, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);

        // Determine initial status
        let status = data.status || 'draft';
        if (status === 'scheduled' || status === 'active') {
            if (data.start_time <= now && data.end_time > now) {
                status = 'active';
            } else if (data.start_time > now) {
                status = 'scheduled';
            } else {
                status = 'ended';
            }
        }

        const result = await env.DB.prepare(`
            INSERT INTO flash_sales (
                name, description,
                start_time, end_time,
                status, is_visible, banner_image,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.name,
            data.description || null,
            data.start_time,
            data.end_time,
            status,
            data.is_visible !== undefined ? data.is_visible : 1,
            data.banner_image || null,
            now,
            now
        ).run();

        return jsonResponse({
            success: true,
            flashSaleId: result.meta.last_row_id,
            message: 'Tạo flash sale thành công'
        }, 201, corsHeaders);
    } catch (error) {
        console.error('Error creating flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update flash sale
export async function updateFlashSale(id, data, env, corsHeaders) {
    try {
        // Check if flash sale exists
        const existing = await env.DB.prepare(`
            SELECT id, status FROM flash_sales WHERE id = ?
        `).bind(id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy flash sale'
            }, 404, corsHeaders);
        }

        // Validate time range if provided
        if (data.start_time && data.end_time && data.end_time <= data.start_time) {
            return jsonResponse({
                success: false,
                error: 'Thời gian kết thúc phải sau thời gian bắt đầu'
            }, 400, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);
        const updates = [];
        const values = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            values.push(data.description);
        }
        if (data.start_time !== undefined) {
            updates.push('start_time = ?');
            values.push(data.start_time);
        }
        if (data.end_time !== undefined) {
            updates.push('end_time = ?');
            values.push(data.end_time);
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            values.push(data.status);
        }
        if (data.is_visible !== undefined) {
            updates.push('is_visible = ?');
            values.push(data.is_visible);
        }
        if (data.banner_image !== undefined) {
            updates.push('banner_image = ?');
            values.push(data.banner_image);
        }

        updates.push('updated_at_unix = ?');
        values.push(now);
        values.push(id);

        await env.DB.prepare(`
            UPDATE flash_sales 
            SET ${updates.join(', ')}
            WHERE id = ?
        `).bind(...values).run();

        return jsonResponse({
            success: true,
            message: 'Cập nhật flash sale thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete flash sale
export async function deleteFlashSale(id, env, corsHeaders) {
    try {
        const existing = await env.DB.prepare(`
            SELECT id FROM flash_sales WHERE id = ?
        `).bind(id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy flash sale'
            }, 404, corsHeaders);
        }

        // Delete flash sale (cascade will delete products)
        await env.DB.prepare(`
            DELETE FROM flash_sales WHERE id = ?
        `).bind(id).run();

        return jsonResponse({
            success: true,
            message: 'Xóa flash sale thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error deleting flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update flash sale status (activate, end, cancel)
export async function updateFlashSaleStatus(id, status, env, corsHeaders) {
    try {
        const validStatuses = ['draft', 'scheduled', 'active', 'ended', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return jsonResponse({
                success: false,
                error: 'Trạng thái không hợp lệ'
            }, 400, corsHeaders);
        }

        const existing = await env.DB.prepare(`
            SELECT id FROM flash_sales WHERE id = ?
        `).bind(id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy flash sale'
            }, 404, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);

        await env.DB.prepare(`
            UPDATE flash_sales 
            SET status = ?, updated_at_unix = ?
            WHERE id = ?
        `).bind(status, now, id).run();

        return jsonResponse({
            success: true,
            message: 'Cập nhật trạng thái thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating flash sale status:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
