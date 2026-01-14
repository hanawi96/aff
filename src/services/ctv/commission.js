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

        // 1. Update trong D1
        const result = await env.DB.prepare(`
            UPDATE ctv 
            SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP
            WHERE referral_code = ?
        `).bind(rate, data.referralCode).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy CTV với mã này'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated commission in D1:', data.referralCode);

        // 2. Đồng bộ sang Google Sheets
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;
            const syncResponse = await fetch(`${googleScriptUrl}?action=updateCommission`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    referralCode: data.referralCode,
                    commissionRate: rate
                })
            });

            if (syncResponse.ok) {
                console.log('✅ Synced commission to Google Sheets');
            } else {
                console.warn('⚠️ Failed to sync to Google Sheets, but D1 updated successfully');
            }
        } catch (syncError) {
            console.error('⚠️ Google Sheets sync error:', syncError);
            // Không throw error, vì D1 đã update thành công
        }

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

        // 1. Bulk update trong D1 với single query (FAST!)
        const placeholders = referralCodes.map(() => '?').join(',');
        const updateQuery = `
            UPDATE ctv 
            SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP
            WHERE referral_code IN (${placeholders})
        `;
        
        const result = await env.DB.prepare(updateQuery)
            .bind(rate, ...referralCodes)
            .run();

        const updatedCount = result.meta.changes;
        console.log(`✅ Updated ${updatedCount} CTVs in D1`);

        // 2. Đồng bộ sang Google Sheets (async, không chờ)
        // Gửi batch request thay vì từng request riêng lẻ
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;
            
            // Gửi tất cả trong 1 request duy nhất
            fetch(`${googleScriptUrl}?action=bulkUpdateCommission`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    referralCodes: referralCodes,
                    commissionRate: rate
                })
            }).then(response => {
                if (response.ok) {
                    console.log('✅ Synced bulk commission to Google Sheets');
                } else {
                    console.warn('⚠️ Failed to sync to Google Sheets, but D1 updated successfully');
                }
            }).catch(syncError => {
                console.error('⚠️ Google Sheets sync error:', syncError);
            });
            // Không await - fire and forget để response nhanh hơn
        } catch (syncError) {
            console.error('⚠️ Google Sheets sync error:', syncError);
        }

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
