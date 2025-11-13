// Cloudflare Worker API for CTV Management System
// Using D1 Database (SQLite on Edge)

export default {
    async fetch(request, env, ctx) {
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: corsHeaders,
            });
        }

        try {
            const url = new URL(request.url);
            const path = url.pathname;
            const action = url.searchParams.get('action');

            // Route handling
            if (request.method === 'GET') {
                return await handleGet(action, url, env, corsHeaders);
            } else if (request.method === 'POST') {
                return await handlePost(path, request, env, corsHeaders);
            }

            return jsonResponse({ success: false, error: 'Method not allowed' }, 405, corsHeaders);

        } catch (error) {
            console.error('Worker error:', error);
            return jsonResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    },
};

// ============================================
// GET REQUEST HANDLERS
// ============================================

async function handleGet(action, url, env, corsHeaders) {
    switch (action) {
        case 'getAllCTV':
            return await getAllCTV(env, corsHeaders);

        case 'getOrders':
            const referralCode = url.searchParams.get('referralCode');
            return await getOrdersByReferralCode(referralCode, env, corsHeaders);

        case 'getOrdersByPhone':
            const phone = url.searchParams.get('phone');
            return await getOrdersByPhone(phone, env, corsHeaders);

        case 'getRecentOrders':
            const limit = parseInt(url.searchParams.get('limit')) || 10;
            return await getRecentOrders(limit, env, corsHeaders);

        case 'getDashboardStats':
            return await getDashboardStats(env, corsHeaders);

        case 'getCollaboratorInfo':
            const ctvReferralCode = url.searchParams.get('referralCode');
            return await getCollaboratorInfo(ctvReferralCode, env, corsHeaders);

        default:
            return jsonResponse({
                success: false,
                error: 'Unknown action'
            }, 400, corsHeaders);
    }
}

// ============================================
// POST REQUEST HANDLERS
// ============================================

async function handlePost(path, request, env, corsHeaders) {
    // Read JSON body once
    const data = await request.json();

    // Check path-based routes first
    if (path === '/api/submit' || path === '/api/ctv/register') {
        return await registerCTV(data, env, corsHeaders);
    }

    if (path === '/api/order/create') {
        return await createOrder(data, env, corsHeaders);
    }

    if (path === '/api/ctv/update-commission') {
        return await updateCTVCommission(data, env, corsHeaders);
    }

    if (path === '/api/ctv/update') {
        return await updateCTV(data, env, corsHeaders);
    }

    // Handle action-based routes (for root path or any other path)
    if (data.action) {
        switch (data.action) {
            case 'updateOrderProducts':
                return await updateOrderProducts(data, env, corsHeaders);
            case 'updateCustomerInfo':
                return await updateCustomerInfo(data, env, corsHeaders);
            case 'updateAddress':
                return await updateAddress(data, env, corsHeaders);
            case 'updateAmount':
                return await updateAmount(data, env, corsHeaders);
            case 'deleteOrder':
                return await deleteOrder(data, env, corsHeaders);
            default:
                return jsonResponse({
                    success: false,
                    error: 'Unknown action: ' + data.action
                }, 400, corsHeaders);
        }
    }

    return jsonResponse({
        success: false,
        error: 'Unknown endpoint'
    }, 404, corsHeaders);
}

// ============================================
// CTV FUNCTIONS
// ============================================

// Đăng ký CTV mới - Lưu vào cả D1 và Google Sheets
async function registerCTV(data, env, corsHeaders) {
    try {
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

        // 1. Lưu vào D1 Database
        const result = await env.DB.prepare(`
            INSERT INTO ctv (full_name, phone, email, city, age, experience, motivation, referral_code, status, commission_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.fullName,
            data.phone,
            data.email || null,
            data.city || null,
            data.age || null,
            data.experience || null,
            data.motivation || null,
            referralCode,
            'Mới',
            commissionRate
        ).run();

        if (!result.success) {
            throw new Error('Failed to insert CTV into D1');
        }

        console.log('✅ Saved to D1:', referralCode);

        // 2. Lưu vào Google Sheets (gọi Google Apps Script)
        try {
            const sheetsData = {
                ...data,
                referralCode: referralCode,
                commissionRate: commissionRate,
                timestamp: new Date().toLocaleString('vi-VN')
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
                console.warn('⚠️ Failed to save to Google Sheets, but D1 saved successfully');
            }
        } catch (sheetsError) {
            console.error('⚠️ Google Sheets error:', sheetsError);
            // Không throw error, vì D1 đã lưu thành công
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

// Lấy thông tin chi tiết của một CTV
async function getCollaboratorInfo(referralCode, env, corsHeaders) {
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

        // Get order statistics
        const orderStats = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(commission) as total_commission
            FROM orders
            WHERE referral_code = ?
        `).bind(referralCode).first();

        // Get recent orders (last 5)
        const { results: recentOrders } = await env.DB.prepare(`
            SELECT 
                order_id,
                order_date,
                customer_name,
                total_amount,
                commission,
                created_at
            FROM orders
            WHERE referral_code = ?
            ORDER BY created_at DESC
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
async function getAllCTV(env, corsHeaders) {
    try {
        // Get all CTV
        const { results: ctvList } = await env.DB.prepare(`
            SELECT 
                id,
                full_name as fullName,
                phone,
                email,
                city,
                age,
                experience,
                referral_code as referralCode,
                status,
                commission_rate as commissionRate,
                created_at as timestamp
            FROM ctv
            ORDER BY created_at DESC
        `).all();

        // Get order stats for each CTV
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

        // Get today's commission for each CTV
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const { results: todayStats } = await env.DB.prepare(`
            SELECT 
                referral_code,
                SUM(commission) as today_commission
            FROM orders
            WHERE referral_code IS NOT NULL AND referral_code != ''
            AND DATE(created_at) = ?
            GROUP BY referral_code
        `).bind(today).all();

        // Create map for quick lookup
        const statsMap = {};
        orderStats.forEach(stat => {
            statsMap[stat.referral_code] = stat;
        });

        const todayStatsMap = {};
        todayStats.forEach(stat => {
            todayStatsMap[stat.referral_code] = stat;
        });

        // Merge data
        const enrichedCTVList = ctvList.map(ctv => {
            const stats = statsMap[ctv.referralCode] || {
                order_count: 0,
                total_revenue: 0,
                total_commission: 0
            };

            const todayCommission = todayStatsMap[ctv.referralCode]?.today_commission || 0;

            return {
                ...ctv,
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

        return jsonResponse({
            success: true,
            ctvList: enrichedCTVList,
            stats: stats
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting all CTV:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// ORDER FUNCTIONS
// ============================================

// Tạo đơn hàng mới - Lưu vào cả D1 và Google Sheets
async function createOrder(data, env, corsHeaders) {
    try {
        // Validate dữ liệu đơn hàng
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu mã đơn hàng'
            }, 400, corsHeaders);
        }

        if (!data.customer || !data.customer.name || !data.customer.phone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin khách hàng'
            }, 400, corsHeaders);
        }

        if (!data.cart || data.cart.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Giỏ hàng trống'
            }, 400, corsHeaders);
        }

        // Tính tổng tiền
        const totalAmount = data.total || data.totalAmount || 0;
        const totalAmountNumber = typeof totalAmount === 'string'
            ? parseInt(totalAmount.replace(/[^\d]/g, ''))
            : totalAmount;

        // Validate và lấy thông tin CTV
        let validReferralCode = null;
        let finalCommission = 0;
        let ctvPhone = null;
        
        if (data.referralCode && data.referralCode.trim() !== '') {
            // Kiểm tra xem referral code có tồn tại không
            const ctvData = await env.DB.prepare(`
                SELECT referral_code, commission_rate, phone FROM ctv WHERE referral_code = ?
            `).bind(data.referralCode.trim()).first();
            
            if (ctvData) {
                validReferralCode = ctvData.referral_code;
                ctvPhone = ctvData.phone;
                const commissionRate = ctvData.commission_rate || 0.1;
                finalCommission = totalAmountNumber * commissionRate;
            } else {
                console.warn('⚠️ Referral code không tồn tại:', data.referralCode);
            }
        }

        // Format products thành JSON string
        const productsJson = JSON.stringify(data.cart);

        // 1. Lưu vào D1 Database
        const orderDate = data.orderDate || new Date().toISOString();

        const result = await env.DB.prepare(`
            INSERT INTO orders (
                order_id, order_date, customer_name, customer_phone, 
                address, products, total_amount, payment_method, 
                status, referral_code, commission, ctv_phone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.orderId,
            orderDate,
            data.customer.name,
            data.customer.phone,
            data.customer.address || '',
            productsJson,
            totalAmountNumber,
            data.paymentMethod || 'cod',
            data.status || 'Mới',
            validReferralCode,
            finalCommission,
            ctvPhone || null
        ).run();

        if (!result.success) {
            throw new Error('Failed to insert order into D1');
        }

        console.log('✅ Saved order to D1:', data.orderId);

        // 2. Lưu vào Google Sheets (gọi Google Apps Script)
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;

            if (googleScriptUrl) {
                // Chuẩn bị dữ liệu cho Google Sheets (format giống như order-handler.js)
                const sheetsData = {
                    orderId: data.orderId,
                    orderDate: data.orderDate || new Date().toISOString(),
                    customer: {
                        name: data.customer.name,
                        phone: data.customer.phone,
                        address: data.customer.address || '',
                        notes: data.customer.notes || ''
                    },
                    cart: data.cart,
                    total: data.total || `${totalAmountNumber.toLocaleString('vi-VN')}đ`,
                    paymentMethod: data.paymentMethod || 'cod',
                    // Gửi referralCode từ frontend (không validate) để Google Sheets luôn nhận được
                    referralCode: data.referralCode || '',
                    // Commission đã validate từ D1
                    referralCommission: finalCommission || 0,
                    referralPartner: data.referralPartner || '',
                    telegramNotification: env.SECRET_KEY || 'VDT_SECRET_2025_ANHIEN'
                };

                console.log('📤 Sending to Google Sheets:', {
                    orderId: sheetsData.orderId,
                    referralCode: sheetsData.referralCode,
                    referralCommission: sheetsData.referralCommission
                });

                const sheetsResponse = await fetch(googleScriptUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(sheetsData)
                });

                const responseText = await sheetsResponse.text();
                console.log('📥 Google Sheets response:', responseText);

                if (sheetsResponse.ok) {
                    console.log('✅ Saved order to Google Sheets');
                } else {
                    console.warn('⚠️ Failed to save to Google Sheets:', sheetsResponse.status, responseText);
                }
            }
        } catch (sheetsError) {
            console.error('⚠️ Google Sheets error:', sheetsError);
            // Không throw error, vì D1 đã lưu thành công
        }

        return jsonResponse({
            success: true,
            message: 'Đơn hàng đã được tạo thành công',
            orderId: data.orderId,
            commission: finalCommission,
            timestamp: new Date().toISOString()
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error creating order:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng theo mã CTV
async function getOrdersByReferralCode(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'Mã referral không được để trống'
            }, 400, corsHeaders);
        }

        // Get orders
        const { results: orders } = await env.DB.prepare(`
            SELECT * FROM orders
            WHERE referral_code = ?
            ORDER BY created_at DESC
        `).bind(referralCode).all();

        // Get CTV info
        const ctvInfo = await env.DB.prepare(`
            SELECT full_name as name, phone, city as address
            FROM ctv
            WHERE referral_code = ?
        `).bind(referralCode).first();

        return jsonResponse({
            success: true,
            orders: orders,
            referralCode: referralCode,
            ctvInfo: ctvInfo || { name: 'Chưa cập nhật', phone: 'Chưa cập nhật', address: 'Chưa cập nhật' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng theo SĐT CTV
async function getOrdersByPhone(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không được để trống'
            }, 400, corsHeaders);
        }

        const normalizedPhone = normalizePhone(phone);

        // Get orders
        const { results: orders } = await env.DB.prepare(`
            SELECT * FROM orders
            WHERE ctv_phone = ? OR ctv_phone = ?
            ORDER BY created_at DESC
        `).bind(normalizedPhone, '0' + normalizedPhone).all();

        // Get CTV info
        const ctvInfo = await env.DB.prepare(`
            SELECT full_name as name, phone, city as address
            FROM ctv
            WHERE phone = ? OR phone = ?
        `).bind(normalizedPhone, '0' + normalizedPhone).first();

        const referralCode = orders.length > 0 ? orders[0].referral_code : '';

        return jsonResponse({
            success: true,
            orders: orders,
            referralCode: referralCode,
            phone: phone,
            ctvInfo: ctvInfo || { name: 'Không tìm thấy', phone: phone, address: 'Không tìm thấy' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting orders by phone:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng mới nhất
async function getRecentOrders(limit, env, corsHeaders) {
    try {
        const { results: orders } = await env.DB.prepare(`
            SELECT * FROM orders
            WHERE referral_code IS NOT NULL AND referral_code != ''
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(limit).all();

        return jsonResponse({
            success: true,
            orders: orders,
            total: orders.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting recent orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy thống kê dashboard
async function getDashboardStats(env, corsHeaders) {
    try {
        // Total CTV
        const { total_ctv } = await env.DB.prepare(`
            SELECT COUNT(*) as total_ctv FROM ctv
        `).first();

        // Total orders
        const { total_orders, total_revenue, total_commission } = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(commission) as total_commission
            FROM orders
            WHERE referral_code IS NOT NULL AND referral_code != ''
        `).first();

        // Top performers
        const { results: topPerformers } = await env.DB.prepare(`
            SELECT 
                referral_code,
                COUNT(*) as orderCount,
                SUM(total_amount) as totalRevenue,
                SUM(commission) as commission
            FROM orders
            WHERE referral_code IS NOT NULL AND referral_code != ''
            GROUP BY referral_code
            ORDER BY totalRevenue DESC
            LIMIT 5
        `).all();

        return jsonResponse({
            success: true,
            stats: {
                totalCTV: total_ctv || 0,
                totalOrders: total_orders || 0,
                totalRevenue: total_revenue || 0,
                totalCommission: total_commission || 0,
                topPerformers: topPerformers
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update commission rate cho CTV
async function updateCTVCommission(data, env, corsHeaders) {
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

// Update CTV info
async function updateCTV(data, env, corsHeaders) {
    try {
        if (!data.referralCode) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCode'
            }, 400, corsHeaders);
        }

        // 1. Update trong D1
        const result = await env.DB.prepare(`
            UPDATE ctv 
            SET full_name = ?, phone = ?, email = ?, city = ?, age = ?, 
                experience = ?, status = ?, commission_rate = ?, updated_at = CURRENT_TIMESTAMP
            WHERE referral_code = ?
        `).bind(
            data.fullName,
            data.phone,
            data.email || null,
            data.city || null,
            data.age || null,
            data.experience || null,
            data.status || 'Mới',
            data.commissionRate || 0.1,
            data.referralCode
        ).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy CTV với mã này'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated CTV in D1:', data.referralCode);

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
                console.warn('⚠️ Failed to sync to Google Sheets, but D1 updated successfully');
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

// Update order products
async function updateOrderProducts(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.products) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc products'
            }, 400, corsHeaders);
        }

        // Update in D1
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET products = ?
            WHERE id = ?
        `).bind(data.products, data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated order products in D1:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật sản phẩm'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update customer info
async function updateCustomerInfo(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.customerName || !data.customerPhone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId, customerName hoặc customerPhone'
            }, 400, corsHeaders);
        }

        // Validate phone format
        const phoneRegex = /^0\d{9}$/;
        if (!phoneRegex.test(data.customerPhone)) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không hợp lệ'
            }, 400, corsHeaders);
        }

        // Update in D1
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET customer_name = ?, customer_phone = ?
            WHERE id = ?
        `).bind(data.customerName, data.customerPhone, data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated customer info in D1:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật thông tin khách hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating customer info:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update address
async function updateAddress(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.address) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc address'
            }, 400, corsHeaders);
        }

        // Validate address length
        if (data.address.length < 10) {
            return jsonResponse({
                success: false,
                error: 'Địa chỉ quá ngắn'
            }, 400, corsHeaders);
        }

        // Update in D1
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET address = ?
            WHERE id = ?
        `).bind(data.address, data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated address in D1:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật địa chỉ'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating address:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update amount
async function updateAmount(data, env, corsHeaders) {
    try {
        if (!data.orderId || data.totalAmount === undefined) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc totalAmount'
            }, 400, corsHeaders);
        }

        // Validate amount
        if (data.totalAmount <= 0) {
            return jsonResponse({
                success: false,
                error: 'Giá trị đơn hàng phải lớn hơn 0'
            }, 400, corsHeaders);
        }

        if (data.totalAmount > 1000000000) {
            return jsonResponse({
                success: false,
                error: 'Giá trị đơn hàng quá lớn'
            }, 400, corsHeaders);
        }

        // Update in D1
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET total_amount = ?, commission = ?
            WHERE id = ?
        `).bind(data.totalAmount, data.commission || 0, data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated amount in D1:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật giá trị đơn hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating amount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete order
async function deleteOrder(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId'
            }, 400, corsHeaders);
        }

        // Delete from D1
        const result = await env.DB.prepare(`
            DELETE FROM orders 
            WHERE id = ?
        `).bind(data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Deleted order from D1:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã xóa đơn hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error deleting order:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateReferralCode() {
    let code = 'CTV';
    for (let i = 0; i < 6; i++) {
        code += Math.floor(Math.random() * 10);
    }
    return code;
}

function normalizePhone(phone) {
    if (!phone) return '';
    let normalized = phone.toString().trim().replace(/[\s\-]/g, '');
    if (normalized.startsWith('0')) {
        normalized = normalized.substring(1);
    }
    return normalized;
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}