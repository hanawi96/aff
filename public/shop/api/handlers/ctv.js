// ============================================
// SHOP CTV HANDLER - Public CTV registration
// ============================================

import { jsonResponse } from '../../../../src/utils/response.js';
import { generateReferralCode } from '../../../../src/utils/referral-code.js';

/**
 * Register CTV from shop (public)
 */
export async function registerCTV(request, env, corsHeaders) {
    try {
        const data = await request.json();

        // Validate required fields
        if (!data.full_name || !data.phone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin bắt buộc'
            }, 400, corsHeaders);
        }

        // Check if phone already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM ctv WHERE phone = ?
        `).bind(data.phone).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại đã được đăng ký'
            }, 400, corsHeaders);
        }

        // Generate unique referral code
        let referralCode;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            referralCode = generateReferralCode(data.full_name);
            
            const codeExists = await env.DB.prepare(`
                SELECT id FROM ctv WHERE referral_code = ?
            `).bind(referralCode).first();

            if (!codeExists) break;
            attempts++;
        }

        if (attempts >= maxAttempts) {
            return jsonResponse({
                success: false,
                error: 'Không thể tạo mã giới thiệu'
            }, 500, corsHeaders);
        }

        // Insert CTV
        const now = Date.now();
        const result = await env.DB.prepare(`
            INSERT INTO ctv (
                full_name, phone, email, city, age, experience, motivation,
                referral_code, status, commission_rate,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.full_name,
            data.phone,
            data.email || null,
            data.city || null,
            data.age || null,
            data.experience || null,
            data.motivation || null,
            referralCode,
            'Mới',
            0.1, // Default 10%
            now,
            now
        ).run();

        return jsonResponse({
            success: true,
            message: 'Đăng ký thành công',
            referralCode: referralCode
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error registering CTV:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
