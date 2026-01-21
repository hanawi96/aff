import { jsonResponse } from '../../utils/response.js';

// Reserved slugs that cannot be used
const RESERVED_SLUGS = [
    'admin', 'api', 'ctv', 'login', 'register', 'search', 'results',
    'dashboard', 'settings', 'profile', 'orders', 'products', 'cart',
    'checkout', 'payment', 'about', 'contact', 'help', 'support',
    'terms', 'privacy', 'blog', 'news', 'shop', 'store'
];

// Validate custom slug
function validateSlug(slug) {
    // Check length
    if (!slug || slug.length < 4 || slug.length > 20) {
        return { valid: false, error: 'Slug phải từ 4-20 ký tự' };
    }

    // Check format: only lowercase letters, numbers, hyphens
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return { valid: false, error: 'Chỉ được dùng chữ thường, số và dấu gạch ngang' };
    }

    // Cannot start or end with hyphen
    if (slug.startsWith('-') || slug.endsWith('-')) {
        return { valid: false, error: 'Không được bắt đầu hoặc kết thúc bằng dấu gạch ngang' };
    }

    // Cannot have consecutive hyphens
    if (slug.includes('--')) {
        return { valid: false, error: 'Không được có 2 dấu gạch ngang liên tiếp' };
    }

    // Check reserved words
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
        return { valid: false, error: 'Slug này đã được hệ thống sử dụng' };
    }

    return { valid: true };
}

// Check if slug is available
export async function checkSlugAvailability(data, env, corsHeaders) {
    try {
        const { slug, referralCode } = data;

        if (!slug) {
            return jsonResponse({
                success: false,
                error: 'Thiếu slug'
            }, 400, corsHeaders);
        }

        // Validate format
        const validation = validateSlug(slug);
        if (!validation.valid) {
            return jsonResponse({
                success: false,
                available: false,
                error: validation.error
            }, 200, corsHeaders);
        }

        // Check if slug exists (excluding current CTV)
        const existing = await env.DB.prepare(`
            SELECT referral_code, custom_slug 
            FROM ctv 
            WHERE (custom_slug = ? OR referral_code = ?)
            ${referralCode ? 'AND referral_code != ?' : ''}
        `).bind(
            slug.toLowerCase(),
            slug.toUpperCase(),
            ...(referralCode ? [referralCode] : [])
        ).first();

        if (existing) {
            return jsonResponse({
                success: true,
                available: false,
                error: 'Slug này đã được sử dụng'
            }, 200, corsHeaders);
        }

        return jsonResponse({
            success: true,
            available: true,
            message: 'Slug khả dụng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error checking slug:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update custom slug
export async function updateCustomSlug(data, env, corsHeaders) {
    try {
        const { referralCode, newSlug, phoneVerify } = data;

        if (!referralCode || !newSlug) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCode hoặc newSlug'
            }, 400, corsHeaders);
        }

        if (!phoneVerify) {
            return jsonResponse({
                success: false,
                error: 'Vui lòng nhập số điện thoại để xác minh'
            }, 400, corsHeaders);
        }

        // Validate format
        const validation = validateSlug(newSlug);
        if (!validation.valid) {
            return jsonResponse({
                success: false,
                error: validation.error
            }, 400, corsHeaders);
        }

        const slugLower = newSlug.toLowerCase();

        // Get current CTV info including phone
        const ctv = await env.DB.prepare(`
            SELECT 
                referral_code,
                phone,
                custom_slug,
                slug_updated_at_unix,
                slug_change_count
            FROM ctv 
            WHERE referral_code = ?
        `).bind(referralCode).first();

        if (!ctv) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy CTV'
            }, 404, corsHeaders);
        }

        // Verify phone number
        const ctvPhone = (ctv.phone || '').toString().trim();
        const phoneVerifyStr = phoneVerify.toString().trim();
        
        // Normalize both phones (remove leading 0 for comparison)
        const normalizedCtvPhone = ctvPhone.startsWith('0') ? ctvPhone.substring(1) : ctvPhone;
        const normalizedVerifyPhone = phoneVerifyStr.startsWith('0') ? phoneVerifyStr.substring(1) : phoneVerifyStr;
        
        console.log('🔍 Phone verification:', {
            ctvPhone,
            phoneVerifyStr,
            normalizedCtvPhone,
            normalizedVerifyPhone,
            match1: phoneVerifyStr === ctvPhone,
            match2: normalizedVerifyPhone === normalizedCtvPhone
        });
        
        // Check both with and without leading 0
        const phoneMatch = (phoneVerifyStr === ctvPhone) || (normalizedVerifyPhone === normalizedCtvPhone);
        
        if (!phoneMatch) {
            console.log('❌ Phone verification failed');
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không chính xác. Vui lòng nhập đúng số điện thoại đã đăng ký.'
            }, 400, corsHeaders);
        }
        
        console.log('✅ Phone verified successfully');

        // Check change limit (max 3 times per year)
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        
        if (ctv.slug_change_count >= 3 && ctv.slug_updated_at_unix > oneYearAgo) {
            return jsonResponse({
                success: false,
                error: 'Bạn đã đổi slug 3 lần trong năm nay. Vui lòng thử lại sau.'
            }, 400, corsHeaders);
        }

        // Check if slug is available
        const existing = await env.DB.prepare(`
            SELECT referral_code 
            FROM ctv 
            WHERE (custom_slug = ? OR referral_code = ?) AND referral_code != ?
        `).bind(slugLower, newSlug.toUpperCase(), referralCode).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Slug này đã được sử dụng'
            }, 400, corsHeaders);
        }

        // Update slug
        const newChangeCount = (ctv.slug_change_count || 0) + 1;
        
        await env.DB.prepare(`
            UPDATE ctv 
            SET 
                custom_slug = ?,
                slug_updated_at_unix = ?,
                slug_change_count = ?,
                updated_at_unix = ?
            WHERE referral_code = ?
        `).bind(
            slugLower,
            now,
            newChangeCount,
            now,
            referralCode
        ).run();

        console.log(`✅ Updated custom slug for ${referralCode}: ${slugLower}`);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật link thành công',
            customSlug: slugLower,
            newUrl: `https://shopvd.store/?ref=${slugLower}`,
            changesRemaining: Math.max(0, 3 - newChangeCount)
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating slug:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get CTV by slug (for order processing)
export async function getCTVBySlug(slug, env) {
    try {
        if (!slug) return null;

        const slugLower = slug.toLowerCase();
        const slugUpper = slug.toUpperCase();

        // Check both custom_slug and referral_code
        const ctv = await env.DB.prepare(`
            SELECT 
                referral_code,
                custom_slug,
                commission_rate,
                phone,
                status
            FROM ctv 
            WHERE custom_slug = ? OR referral_code = ?
        `).bind(slugLower, slugUpper).first();

        return ctv;
    } catch (error) {
        console.error('Error getting CTV by slug:', error);
        return null;
    }
}
