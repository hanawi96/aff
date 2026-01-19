import { jsonResponse } from '../../utils/response.js';
import { generateReferralCode } from '../../utils/referral-code.js';

// Đăng ký CTV mới - Lưu vào cả Turso Database và Google Sheets
export async function registerCTV(data, env, corsHeaders) {
    try {
        // Debug: Log received data
        console.log('📥 Received CTV data:', JSON.stringify(data, null, 2));
        console.log('🏦 Bank Name:', data.bankName);
        console.log('💳 Bank Account:', data.bankAccountNumber);
        
        // Validate
        if (!data.fullName || !data.phone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin bắt buộc'
            }, 400, corsHeaders);
        }

        // Generate referral code
        const referralCode = generateReferralCode();

        // Commission rate mặc định 10%, có thể custom khi đăng ký
        const commissionRate = data.commissionRate || 0.1;

        // 1. Lưu vào Turso Database
        console.log('💾 Preparing to insert with values:', {
            fullName: data.fullName,
            phone: data.phone,
            email: data.email || null,
            city: data.city || null,
            age: data.age || null,
            bankAccountNumber: data.bankAccountNumber || null,
            bankName: data.bankName || null,
            referralCode: referralCode,
            status: data.status || 'Mới',
            commissionRate: commissionRate
        });
        
        // Get current timestamp in milliseconds (UTC)
        const now = Date.now();
        
        const result = await env.DB.prepare(`
            INSERT INTO ctv (full_name, phone, email, city, age, bank_account_number, bank_name, referral_code, status, commission_rate, created_at_unix, updated_at_unix)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.fullName,
            data.phone,
            data.email || null,
            data.city || null,
            data.age || null,
            data.bankAccountNumber || null,
            data.bankName || null,
            referralCode,
            data.status || 'Mới',
            commissionRate,
            now,
            now
        ).run();

        console.log('📊 Insert result:', result);

        if (!result.success) {
            throw new Error('Failed to insert CTV into database');
        }

        console.log('✅ Saved to database:', referralCode);
        
        // Verify data was saved
        const verify = await env.DB.prepare(`
            SELECT bank_account_number, bank_name FROM ctv WHERE referral_code = ?
        `).bind(referralCode).first();
        console.log('🔍 Verification query result:', verify);

        // 2. Lưu vào Google Sheets (gọi Google Apps Script)
        try {
            const sheetsData = {
                ...data,
                referralCode: referralCode,
                commissionRate: commissionRate,
                timestamp: new Date().getTime()
            };

            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

            const sheetsResponse = await fetch(googleScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sheetsData)
            });

            if (sheetsResponse.ok) {
                console.log('✅ Saved to Google Sheets');
            } else {
                console.warn('⚠️ Failed to save to Google Sheets, but database saved successfully');
            }
        } catch (sheetsError) {
            console.error('⚠️ Google Sheets error:', sheetsError);
            // Không throw error, vì database đã lưu thành công
        }

        return jsonResponse({
            success: true,
            message: 'Đăng ký thành công',
            referralCode: referralCode,
            referralUrl: `https://shopvd.store/?ref=${referralCode}`,
            orderCheckUrl: `https://shopvd.store/ctv/?code=${referralCode}`
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error registering CTV:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Verify CTV code (quick check for auto-complete)
export async function verifyCTVCode(code, env, corsHeaders) {
    try {
        if (!code || code.trim() === '') {
            return jsonResponse({
                success: false,
                message: 'Vui lòng nhập mã CTV'
            }, 200, corsHeaders);
        }

        const ctv = await env.DB.prepare(`
            SELECT full_name, commission_rate, phone, status
            FROM ctv 
            WHERE referral_code = ?
        `).bind(code.trim()).first();

        if (ctv) {
            return jsonResponse({
                success: true,
                verified: true,
                data: {
                    name: ctv.full_name,
                    rate: ctv.commission_rate,
                    phone: ctv.phone,
                    status: ctv.status
                }
            }, 200, corsHeaders);
        } else {
            return jsonResponse({
                success: true,
                verified: false,
                message: 'Không tìm thấy CTV với mã này'
            }, 200, corsHeaders);
        }
    } catch (error) {
        console.error('Error verifying CTV:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy thông tin chi tiết của một CTV
export async function getCollaboratorInfo(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'Mã CTV không được để trống'
            }, 400, corsHeaders);
        }

        // Get CTV info
        const collaborator = await env.DB.prepare(`
            SELECT 
                id,
                full_name as name,
                phone,
                email,
                city,
                age,
                experience,
                referral_code,
                status,
                commission_rate,
                created_at,
                updated_at
            FROM ctv
            WHERE referral_code = ?
        `).bind(referralCode).first();

        if (!collaborator) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy CTV với mã này'
            }, 404, corsHeaders);
        }

        // Get order statistics - use total_amount column
        const orderStats = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(commission) as total_commission
            FROM orders
            WHERE referral_code = ?
        `).bind(referralCode).first();

        // Get recent orders (last 5) - use total_amount column
        const { results: recentOrders } = await env.DB.prepare(`
            SELECT 
                order_id,
                order_date,
                customer_name,
                total_amount,
                commission,
                created_at_unix
            FROM orders
            WHERE referral_code = ?
            ORDER BY created_at_unix DESC
            LIMIT 5
        `).bind(referralCode).all();

        return jsonResponse({
            success: true,
            collaborator: {
                ...collaborator,
                bank_info: null // Add bank info if available in your schema
            },
            stats: {
                totalOrders: orderStats.total_orders || 0,
                totalRevenue: orderStats.total_revenue || 0,
                totalCommission: orderStats.total_commission || 0
            },
            recentOrders: recentOrders
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting collaborator info:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy tất cả CTV
export async function getAllCTV(env, corsHeaders) {
    try {
        console.log('🔍 getAllCTV called');
        
        // Get all CTV
        console.log('📋 Step 1: Fetching all CTV...');
        const { results: ctvList } = await env.DB.prepare(`
            SELECT 
                id,
                full_name,
                phone,
                email,
                city,
                age,
                bank_account_number,
                bank_name,
                experience,
                referral_code,
                status,
                commission_rate,
                created_at_unix
            FROM ctv
            ORDER BY created_at_unix DESC
        `).all();
        
        console.log(`✅ Fetched ${ctvList.length} CTVs`);

        // Get order stats for each CTV - use total_amount column
        console.log('📋 Step 2: Fetching order stats...');
        const { results: orderStats } = await env.DB.prepare(`
            SELECT 
                referral_code,
                COUNT(*) as order_count,
                SUM(total_amount) as total_revenue,
                SUM(commission) as total_commission
            FROM orders
            WHERE referral_code IS NOT NULL AND referral_code != ''
            GROUP BY referral_code
        `).all();
        
        console.log(`✅ Fetched stats for ${orderStats.length} referral codes`);

        // Get today's commission for each CTV - simplified without date conversion
        console.log('📋 Step 3: Fetching today stats...');
        const todayStats = []; // Skip today stats for now to avoid date issues
        console.log(`✅ Skipped today stats (will implement later)`);

        // Create map for quick lookup
        const statsMap = {};
        orderStats.forEach(stat => {
            statsMap[stat.referral_code] = stat;
        });

        const todayStatsMap = {};
        todayStats.forEach(stat => {
            todayStatsMap[stat.referral_code] = stat;
        });

        // Merge data - map column names to camelCase
        const enrichedCTVList = ctvList.map(ctv => {
            const stats = statsMap[ctv.referral_code] || {
                order_count: 0,
                total_revenue: 0,
                total_commission: 0
            };

            const todayCommission = todayStatsMap[ctv.referral_code]?.today_commission || 0;

            return {
                id: ctv.id,
                fullName: ctv.full_name,
                phone: ctv.phone,
                email: ctv.email,
                city: ctv.city,
                age: ctv.age,
                bankAccountNumber: ctv.bank_account_number,
                bankName: ctv.bank_name,
                experience: ctv.experience,
                referralCode: ctv.referral_code,
                status: ctv.status,
                commissionRate: ctv.commission_rate,
                timestamp: ctv.created_at_unix,
                hasOrders: stats.order_count > 0,
                orderCount: stats.order_count,
                totalRevenue: stats.total_revenue,
                totalCommission: stats.total_commission,
                todayCommission: todayCommission
            };
        });

        // Calculate summary stats
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = {
            totalCTV: enrichedCTVList.length,
            activeCTV: enrichedCTVList.filter(ctv => ctv.hasOrders).length,
            newCTV: enrichedCTVList.filter(ctv => {
                const createdDate = new Date(ctv.timestamp);
                return createdDate >= firstDayOfMonth;
            }).length,
            totalCommission: enrichedCTVList.reduce((sum, ctv) => sum + (ctv.totalCommission || 0), 0)
        };

        console.log('✅ getAllCTV completed successfully');
        
        return jsonResponse({
            success: true,
            ctvList: enrichedCTVList,
            stats: stats
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error in getAllCTV:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update CTV info
export async function updateCTV(data, env, corsHeaders) {
    try {
        if (!data.referralCode) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCode'
            }, 400, corsHeaders);
        }

        // 1. Update trong Turso Database
        const result = await env.DB.prepare(`
            UPDATE ctv 
            SET full_name = ?, phone = ?, email = ?, city = ?, age = ?, 
                bank_account_number = ?, bank_name = ?, status = ?, commission_rate = ?, updated_at_unix = ?
            WHERE referral_code = ?
        `).bind(
            data.fullName,
            data.phone,
            data.email || null,
            data.city || null,
            data.age || null,
            data.bankAccountNumber || null,
            data.bankName || null,
            data.status || 'Mới',
            data.commissionRate || 0.1,
            Date.now(),
            data.referralCode
        ).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy CTV với mã này'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated CTV in database:', data.referralCode);

        // 2. Đồng bộ sang Google Sheets
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;
            const syncResponse = await fetch(`${googleScriptUrl}?action=updateCTV`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (syncResponse.ok) {
                console.log('✅ Synced CTV to Google Sheets');
            } else {
                console.warn('⚠️ Failed to sync to Google Sheets, but database updated successfully');
            }
        } catch (syncError) {
            console.error('⚠️ Google Sheets sync error:', syncError);
        }

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật thông tin CTV'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating CTV:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Bulk delete CTV
export async function bulkDeleteCTV(data, env, corsHeaders) {
    try {
        if (!data.referralCodes || !Array.isArray(data.referralCodes) || data.referralCodes.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCodes array'
            }, 400, corsHeaders);
        }

        const referralCodes = data.referralCodes;
        console.log(`🗑️ Bulk deleting ${referralCodes.length} CTVs`);

        // 1. Delete from database with single query
        const placeholders = referralCodes.map(() => '?').join(',');
        const deleteQuery = `
            DELETE FROM ctv 
            WHERE referral_code IN (${placeholders})
        `;
        
        const result = await env.DB.prepare(deleteQuery)
            .bind(...referralCodes)
            .run();

        const deletedCount = result.meta.changes;
        console.log(`✅ Deleted ${deletedCount} CTVs from database`);

        // 2. Sync to Google Sheets (async, fire-and-forget)
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;
            
            fetch(`${googleScriptUrl}?action=bulkDeleteCTV`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    referralCodes: referralCodes
                })
            }).then(response => {
                if (response.ok) {
                    console.log('✅ Synced bulk delete to Google Sheets');
                } else {
                    console.warn('⚠️ Failed to sync to Google Sheets, but database deleted successfully');
                }
            }).catch(syncError => {
                console.error('⚠️ Google Sheets sync error:', syncError);
            });
        } catch (syncError) {
            console.error('⚠️ Google Sheets sync error:', syncError);
        }

        return jsonResponse({
            success: true,
            message: `Đã xóa ${deletedCount} CTV`,
            deletedCount: deletedCount,
            totalRequested: referralCodes.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error in bulk delete CTV:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
