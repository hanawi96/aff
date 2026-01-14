import { jsonResponse } from '../../utils/response.js';

// Get current active tax rate
export async function getCurrentTaxRate(env, corsHeaders) {
    try {
        // Get tax rate from cost_config (stored in item_cost)
        const taxConfig = await env.DB.prepare(`
            SELECT item_cost as tax_rate, created_at as effective_from
            FROM cost_config
            WHERE item_name = 'tax_rate'
            LIMIT 1
        `).first();

        if (!taxConfig) {
            // Return default if no config found
            return jsonResponse({
                success: true,
                taxRate: 0.015,
                effectiveFrom: '2024-01-01',
                description: 'Thuế mặc định 1.5%'
            }, 200, corsHeaders);
        }

        return jsonResponse({
            success: true,
            taxRate: taxConfig.tax_rate,
            effectiveFrom: taxConfig.effective_from,
            description: taxConfig.description
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting current tax rate:', error);
        // Return default on error
        return jsonResponse({
            success: true,
            taxRate: 0.015,
            effectiveFrom: '2024-01-01',
            description: 'Thuế mặc định 1.5%'
        }, 200, corsHeaders);
    }
}

// Update tax rate (create new tax config)
export async function updateTaxRate(data, env, corsHeaders) {
    try {
        const { taxRate, description } = data;

        if (!taxRate || taxRate < 0 || taxRate > 1) {
            return jsonResponse({
                success: false,
                error: 'Invalid tax rate. Must be between 0 and 1 (e.g., 0.015 for 1.5%)'
            }, 400, corsHeaders);
        }

        // Update tax rate in cost_config (stored in item_cost)
        const result = await env.DB.prepare(`
            INSERT INTO cost_config (item_name, item_cost, is_default)
            VALUES ('tax_rate', ?, 1)
            ON CONFLICT(item_name) DO UPDATE SET
                item_cost = excluded.item_cost,
                updated_at = CURRENT_TIMESTAMP
        `).bind(taxRate).run();

        if (!result.success) {
            throw new Error('Failed to insert new tax rate');
        }

        return jsonResponse({
            success: true,
            message: 'Tax rate updated successfully',
            taxRate: taxRate,
            effectiveFrom: new Date().toISOString().split('T')[0]
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating tax rate:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
