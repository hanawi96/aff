import { jsonResponse } from '../../utils/response.js';

// Update commission rate cho CTV
export async function updateCTVCommission(data, env, corsHeaders) {
    try {
        if (!data.referralCode || data.commissionRate === undefined) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCode hoặc commissionRate'
            }, 400, corsHeaders);
        }

        // Validate commission rate (0-100%)
        const rate = parseFloat(data.commissionRate);
        if (isNaN(rate) || rate < 0 || rate > 1) {
            return jsonResponse({
                success: false,
                error: 'Commission rate phải từ 0 đến 1 (0% - 100%)'
            }, 400, corsHeaders);
        }

        // 1. Update trong Turso Database
        const result = await env.DB.prepare(`
            UPDATE ctv 
            SET commission_rate = ?, updated_at_unix = ?
            WHERE referral_code = ?
        `).bind(rate, Date.now(), data.referralCode).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy CTV với mã này'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated commission in database:', data.referralCode);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật commission rate',
            commissionRate: rate
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating commission:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Bulk update commission rate cho nhiều CTV (OPTIMIZED)
export async function bulkUpdateCTVCommission(data, env, corsHeaders) {
    try {
        if (!data.referralCodes || !Array.isArray(data.referralCodes) || data.referralCodes.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCodes array'
            }, 400, corsHeaders);
        }

        if (data.commissionRate === undefined) {
            return jsonResponse({
                success: false,
                error: 'Thiếu commissionRate'
            }, 400, corsHeaders);
        }

        // Validate commission rate (0-100%)
        const rate = parseFloat(data.commissionRate);
        if (isNaN(rate) || rate < 0 || rate > 1) {
            return jsonResponse({
                success: false,
                error: 'Commission rate phải từ 0 đến 1 (0% - 100%)'
            }, 400, corsHeaders);
        }

        const referralCodes = data.referralCodes;
        console.log(`🔄 Bulk updating commission for ${referralCodes.length} CTVs to ${rate * 100}%`);

        // 1. Bulk update trong Turso Database với single query (FAST!)
        const placeholders = referralCodes.map(() => '?').join(',');
        const updateQuery = `
            UPDATE ctv 
            SET commission_rate = ?, updated_at_unix = ?
            WHERE referral_code IN (${placeholders})
        `;
        
        const result = await env.DB.prepare(updateQuery)
            .bind(rate, Date.now(), ...referralCodes)
            .run();

        const updatedCount = result.meta?.changes || 0;
        console.log(`✅ Updated ${updatedCount} CTVs in database`);

        return jsonResponse({
            success: true,
            message: `Đã cập nhật commission rate cho ${updatedCount} CTV`,
            updatedCount: updatedCount,
            totalRequested: referralCodes.length,
            commissionRate: rate
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error in bulk update commission:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
