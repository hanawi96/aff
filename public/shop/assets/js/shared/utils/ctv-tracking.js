/**
 * CTV Tracking System
 * Quản lý cookie tracking cho hệ thống cộng tác viên
 */

import { CONFIG } from '../constants/config.js';

const CTV_COOKIE_NAME = 'vdt_ctv_ref';
const CTV_COOKIE_DAYS = 7;

const CTV_INFO_CACHE_KEY = 'vdt_ctv_ref_info_v1';
const API_BASE_URL = CONFIG.API_BASE_URL;

/**
 * Lưu referral code vào cookie
 * @param {string} referralCode - Mã CTV hoặc custom slug
 * @param {number} days - Số ngày lưu cookie (mặc định 7)
 */
export function setCTVCookie(referralCode, days = CTV_COOKIE_DAYS) {
    if (!referralCode) return;
    
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    
    // Set cookie cho toàn bộ domain
    document.cookie = `${CTV_COOKIE_NAME}=${encodeURIComponent(referralCode)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    
    console.log(`✅ CTV tracking saved: ${referralCode} (expires in ${days} days)`);
}

/**
 * Lấy referral code từ cookie
 * @returns {string|null} - Mã CTV hoặc null nếu không có
 */
export function getCTVCookie() {
    console.log('🔍 [CTV Tracking] Getting cookie...');
    const name = CTV_COOKIE_NAME + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    console.log('🍪 [CTV Tracking] All cookies:', decodedCookie);
    const cookieArray = decodedCookie.split(';');
    
    for (let cookie of cookieArray) {
        cookie = cookie.trim();
        if (cookie.indexOf(name) === 0) {
            const value = cookie.substring(name.length);
            console.log('✅ [CTV Tracking] Found cookie:', value);
            return value;
        }
    }
    
    console.log('❌ [CTV Tracking] Cookie not found');
    return null;
}

/**
 * Xóa CTV cookie
 */
export function clearCTVCookie() {
    document.cookie = `${CTV_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    console.log('🗑️ CTV tracking cleared');
}

/**
 * Kiểm tra và lưu referral code từ URL
 * Hỗ trợ cả ?ref=CTV123456 và ?ref=custom-slug
 * @returns {Promise<Object|null>} - Thông tin CTV nếu hợp lệ
 */
export async function checkAndSaveReferralFromURL() {
    console.log('🔍 [CTV Tracking] Checking URL for referral...');
    const urlParams = new URLSearchParams(window.location.search);
    const refParamRaw = urlParams.get('ref');
    const refParam = refParamRaw ? refParamRaw.trim() : null;
    
    console.log('🔗 [CTV Tracking] URL params:', window.location.search);
    console.log('📋 [CTV Tracking] Ref param:', refParam);
    
    if (!refParam) {
        // Không có ref trong URL, kiểm tra cookie hiện tại
        const existingRef = getCTVCookie();
        if (existingRef) {
            console.log(`ℹ️ [CTV Tracking] Using existing CTV tracking: ${existingRef}`);
        } else {
            console.log('ℹ️ [CTV Tracking] No ref in URL and no existing cookie');
        }
        return null;
    }
    
    try {
        console.log(`📞 [CTV Tracking] Validating referral: ${refParam}`);
        // Validate referral code với API - using ?action=validateReferral format
        const apiUrl = `${API_BASE_URL}/?action=validateReferral&ref=${encodeURIComponent(refParam)}`;
        console.log('🌐 [CTV Tracking] API URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        console.log('📡 [CTV Tracking] API response status:', response.status);
        
        const data = await response.json();
        console.log('📦 [CTV Tracking] API response data:', data);
        
        if (data.success && data.ctv) {
            // Lưu referral code vào cookie (ghi đè nếu đã có)
            setCTVCookie(data.ctv.referralCode);

            // Cache additional CTV info to avoid re-validating on checkout
            try {
                localStorage.setItem(
                    CTV_INFO_CACHE_KEY,
                    JSON.stringify({
                        referralCode: data.ctv.referralCode,
                        commissionRate: data.ctv.commissionRate,
                        ctvPhone: data.ctv.phone,
                        ctvName: data.ctv.name,
                        storedAt: Date.now()
                    })
                );
            } catch (e) {
                // ignore localStorage errors (private mode / disabled)
            }
            
            console.log('✅ [CTV Tracking] CTV validated and saved:', {
                name: data.ctv.name,
                code: data.ctv.referralCode,
                rate: data.ctv.commissionRate
            });
            
            return data.ctv;
        } else {
            console.warn('⚠️ [CTV Tracking] Invalid referral code:', refParam);
            console.warn('⚠️ [CTV Tracking] API response:', data);
            return null;
        }
    } catch (error) {
        console.error('❌ [CTV Tracking] Error validating referral:', error);
        return null;
    }
}

/**
 * Lấy thông tin CTV từ cookie (để gửi khi đặt hàng)
 * @returns {Promise<Object|null>} - Thông tin CTV đầy đủ
 */
export async function getCTVInfoForOrder() {
    console.log('📞 [CTV Tracking] Getting CTV info for order...');
    const referralCode = getCTVCookie();
    
    console.log('🔍 [CTV Tracking] Referral code from cookie:', referralCode);
    
    if (!referralCode) {
        console.log('❌ [CTV Tracking] No referral code in cookie');
        return null;
    }

    // Try localStorage cache first (avoid 2nd API validateReferral call)
    try {
        const cachedRaw = localStorage.getItem(CTV_INFO_CACHE_KEY);
        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached?.referralCode === referralCode && cached?.commissionRate !== undefined) {
                return {
                    referralCode: cached.referralCode,
                    commissionRate: cached.commissionRate,
                    ctvPhone: cached.ctvPhone || null,
                    ctvName: cached.ctvName || ''
                };
            }
        }
    } catch (e) {
        // ignore cache parse errors
    }
    
    try {
        console.log(`🌐 [CTV Tracking] Fetching CTV info for: ${referralCode}`);
        // Lấy thông tin CTV đầy đủ từ API - using ?action=validateReferral format
        const apiUrl = `${API_BASE_URL}/?action=validateReferral&ref=${encodeURIComponent(referralCode)}`;
        console.log('🌐 [CTV Tracking] API URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        console.log('📡 [CTV Tracking] API response status:', response.status);
        
        const data = await response.json();
        console.log('📦 [CTV Tracking] API response data:', data);
        
        if (data.success && data.ctv) {
            const result = {
                referralCode: data.ctv.referralCode,
                commissionRate: data.ctv.commissionRate,
                ctvPhone: data.ctv.phone,
                ctvName: data.ctv.name
            };
            console.log('✅ [CTV Tracking] CTV info retrieved:', result);
            return result;
        }
        
        // Cookie không hợp lệ, xóa đi
        console.warn('⚠️ [CTV Tracking] Cookie invalid, clearing...');
        clearCTVCookie();
        return null;
    } catch (error) {
        console.error('❌ [CTV Tracking] Error getting CTV info:', error);
        return null;
    }
}

/**
 * Tính hoa hồng cho đơn hàng
 * Công thức: (total_amount - shipping_fee) × commission_rate
 * @param {number} totalAmount - Tổng tiền đơn hàng
 * @param {number} shippingFee - Phí ship
 * @param {number} commissionRate - Tỷ lệ hoa hồng (0.1 = 10%)
 * @returns {number} - Số tiền hoa hồng
 */
export function calculateCommission(totalAmount, shippingFee, commissionRate) {
    const revenue = totalAmount - shippingFee;
    const commission = Math.round(revenue * commissionRate);
    return Math.max(0, commission); // Không âm
}

