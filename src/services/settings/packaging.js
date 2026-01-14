import { jsonResponse } from '../../utils/response.js';

// Get packaging config
export async function getPackagingConfig(env, corsHeaders) {
    try {
        const { results: config } = await env.DB.prepare(`
            SELECT * FROM cost_config
            ORDER BY id ASC
        `).all();

        return jsonResponse({
            success: true,
            config: config
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting packaging config:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update packaging config
export async function updatePackagingConfig(data, env, corsHeaders) {
    try {
        if (!data.config || !Array.isArray(data.config)) {
            return jsonResponse({
                success: false,
                error: 'Config array is required'
            }, 400, corsHeaders);
        }

        // Validate all items
        for (const item of data.config) {
            if (!item.item_name || item.item_cost === undefined) {
                return jsonResponse({
                    success: false,
                    error: 'Each config item must have item_name and item_cost'
                }, 400, corsHeaders);
            }

            const cost = parseFloat(item.item_cost);
            if (isNaN(cost) || cost < 0) {
                return jsonResponse({
                    success: false,
                    error: `Invalid cost for ${item.item_name}`
                }, 400, corsHeaders);
            }
        }

        // Update each item
        for (const item of data.config) {
            await env.DB.prepare(`
                INSERT INTO cost_config (item_name, item_cost, is_default)
                VALUES (?, ?, ?)
                ON CONFLICT(item_name) DO UPDATE SET
                    item_cost = excluded.item_cost,
                    is_default = excluded.is_default,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(
                item.item_name,
                parseFloat(item.item_cost),
                item.is_default !== undefined ? item.is_default : 1
            ).run();
        }

        console.log('✅ Updated packaging config');

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật cấu hình đóng gói'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating packaging config:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
