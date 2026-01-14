// Cloudflare Worker API for CTV Management System
// Using Turso Database (Remote SQLite)

import bcrypt from 'bcryptjs';
import { initTurso } from './database/turso-client.js';

export default {
    async fetch(request, env, ctx) {
        // Initialize Turso database connection
        const DB = initTurso(env);
        env.DB = DB;
        
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
                return await handleGet(action, url, request, env, corsHeaders);
            } else if (request.method === 'POST') {
                // Check if action is in query string (for API calls with ?action=xxx)
                if (action) {
                    return await handlePostWithAction(action, request, env, corsHeaders);
                }
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

async function handleGet(action, url, request, env, corsHeaders) {
    switch (action) {
        case 'verifySession':
            return await handleVerifySession(request, env, corsHeaders);

        case 'getAllCTV':
            return await getAllCTV(env, corsHeaders);

        case 'getOrders':
            const referralCode = url.searchParams.get('referralCode');
            return await getOrdersByReferralCode(referralCode, env, corsHeaders);

        case 'getOrdersByPhone':
            const phone = url.searchParams.get('phone');
            return await getOrdersByPhone(phone, env, corsHeaders);

        // CTV Optimized Endpoints
        case 'getCTVOrders':
            const ctvCode = url.searchParams.get('referralCode');
            return await getCTVOrdersOptimized(ctvCode, env, corsHeaders);

        case 'getCTVOrdersByPhone':
            const ctvPhone = url.searchParams.get('phone');
            return await getCTVOrdersByPhoneOptimized(ctvPhone, env, corsHeaders);

        case 'getCTVDashboard':
            return await getCTVDashboardOptimized(env, corsHeaders);

        case 'getRecentOrders':
            const limit = parseInt(url.searchParams.get('limit')) || 10;
            return await getRecentOrders(limit, env, corsHeaders);

        case 'getDashboardStats':
            return await getDashboardStats(env, corsHeaders);

        case 'getCollaboratorInfo':
            const ctvReferralCode = url.searchParams.get('referralCode');
            return await getCollaboratorInfo(ctvReferralCode, env, corsHeaders);

        case 'verifyCTV':
            const verifyCode = url.searchParams.get('code');
            return await verifyCTVCode(verifyCode, env, corsHeaders);

        case 'getAllProducts':
            return await getAllProducts(env, corsHeaders);

        case 'getProduct':
            const productId = url.searchParams.get('id');
            return await getProduct(productId, env, corsHeaders);

        case 'getProductCategories':
            const prodId = url.searchParams.get('productId');
            return await getProductCategories(prodId, env, corsHeaders);

        case 'searchProducts':
            const searchQuery = url.searchParams.get('q');
            return await searchProducts(searchQuery, env, corsHeaders);

        case 'getAllCategories':
            return await getAllCategories(env, corsHeaders);

        case 'getCategory':
            const categoryId = url.searchParams.get('id');
            return await getCategory(categoryId, env, corsHeaders);

        case 'getAllCustomers':
            return await getAllCustomers(env, corsHeaders);

        case 'getAllDiscounts':
            return await getAllDiscounts(env, corsHeaders);

        case 'getDiscount':
            const discountId = url.searchParams.get('id');
            return await getDiscount(discountId, env, corsHeaders);

        case 'getDiscountUsageHistory':
            return await getDiscountUsageHistory(env, corsHeaders);

        case 'checkCustomer':
            const checkPhone = url.searchParams.get('phone');
            if (!checkPhone || checkPhone.trim() === '') {
                return jsonResponse({
                    success: false,
                    error: 'Phone parameter is missing or empty'
                }, 400, corsHeaders);
            }
            return await checkCustomer(checkPhone.trim(), env, corsHeaders);

        case 'getCustomerDetail':
            const customerPhone = url.searchParams.get('phone');
            return await getCustomerDetail(customerPhone, env, corsHeaders);

        case 'searchCustomers':
            const customerQuery = url.searchParams.get('q');
            return await searchCustomers(customerQuery, env, corsHeaders);

        case 'getPackagingConfig':
            return await getPackagingConfig(env, corsHeaders);

        case 'getProfitReport':
            const period = url.searchParams.get('period') || 'month';
            return await getProfitReport({ period }, env, corsHeaders);

        case 'getRevenueChart':
            const chartPeriod = url.searchParams.get('period') || 'week';
            const chartStartDate = url.searchParams.get('startDate');
            const chartEndDate = url.searchParams.get('endDate');
            return await getRevenueChart({ 
                period: chartPeriod, 
                startDate: chartStartDate, 
                endDate: chartEndDate 
            }, env, corsHeaders);

        case 'getOrdersChart':
            const ordersPeriod = url.searchParams.get('period') || 'week';
            const ordersStartDate = url.searchParams.get('startDate');
            const ordersEndDate = url.searchParams.get('endDate');
            return await getOrdersChart({ 
                period: ordersPeriod, 
                startDate: ordersStartDate, 
                endDate: ordersEndDate 
            }, env, corsHeaders);

        case 'getDetailedAnalytics':
            const analyticsPeriod = url.searchParams.get('period') || 'month';
            return await getDetailedAnalytics({ period: analyticsPeriod }, env, corsHeaders);

        case 'migrateOrdersToItems':
            return await migrateOrdersToItems(env, corsHeaders);

        case 'getTopProducts':
            const topLimit = parseInt(url.searchParams.get('limit')) || 10;
            const topPeriod = url.searchParams.get('period') || 'all';
            const topStartDate = url.searchParams.get('startDate'); // Optional: custom start date from frontend
            return await getTopProducts(topLimit, topPeriod, env, corsHeaders, topStartDate);

        case 'debugOrderItems':
            // Debug endpoint to check raw order_items data
            const debugLimit = parseInt(url.searchParams.get('limit')) || 20;
            const { results: debugItems } = await env.DB.prepare(`
                SELECT 
                    id, order_id, product_name, quantity, 
                    product_price, product_cost, created_at,
                    datetime(created_at) as created_at_readable
                FROM order_items
                ORDER BY created_at DESC
                LIMIT ?
            `).bind(debugLimit).all();
            
            return jsonResponse({
                success: true,
                count: debugItems.length,
                items: debugItems,
                serverTime: new Date().getTime(),
                note: 'All timestamps are in UTC'
            }, 200, corsHeaders);

        case 'getProductStats':
            const statsProductId = url.searchParams.get('productId');
            const statsPeriod = url.searchParams.get('period') || 'all';
            const statsStartDate = url.searchParams.get('startDate'); // Optional: custom start date from frontend
            return await getProductStats(statsProductId, statsPeriod, env, corsHeaders, statsStartDate);

        case 'getProfitOverview':
            const overviewPeriod = url.searchParams.get('period') || 'all';
            const overviewStartDate = url.searchParams.get('startDate'); // Optional: custom start date from frontend
            return await getProfitOverview(overviewPeriod, env, corsHeaders, overviewStartDate);

        case 'getCurrentTaxRate':
            return await getCurrentTaxRate(env, corsHeaders);

        case 'updateTaxRate':
            // This will be handled in POST
            break;

        case 'getCommissionsByMonth':
            const month = url.searchParams.get('month');
            return await getCommissionsByMonth(month, env, corsHeaders);

        case 'getPaidOrdersByMonth':
            const paidMonth = url.searchParams.get('month');
            return await getPaidOrdersByMonth(paidMonth, env, corsHeaders);

        case 'getLocationStats':
            const level = url.searchParams.get('level') || 'province';
            const provinceId = url.searchParams.get('provinceId');
            const districtId = url.searchParams.get('districtId');
            const locationPeriod = url.searchParams.get('period') || 'all';
            const locationStartDate = url.searchParams.get('startDate');
            const previousStartDate = url.searchParams.get('previousStartDate');
            const previousEndDate = url.searchParams.get('previousEndDate');
            return await getLocationStats({ 
                level, 
                provinceId, 
                districtId, 
                period: locationPeriod, 
                startDate: locationStartDate,
                previousStartDate,
                previousEndDate
            }, env, corsHeaders);

        case 'getPaymentHistory':
            const paymentReferralCode = url.searchParams.get('referralCode');
            return await getPaymentHistory(paymentReferralCode, env, corsHeaders);

        case 'getUnpaidOrders':
            const unpaidReferralCode = url.searchParams.get('referralCode');
            return await getUnpaidOrders(unpaidReferralCode, env, corsHeaders);

        case 'getUnpaidOrdersByMonth':
            const unpaidMonth = url.searchParams.get('month');
            return await getUnpaidOrdersByMonth(unpaidMonth, env, corsHeaders);

        case 'validateDiscount':
            return await validateDiscount(url, env, corsHeaders);

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

async function handlePostWithAction(action, request, env, corsHeaders) {
    // Read JSON body once
    const data = await request.json();

    switch (action) {
        case 'login':
            return await handleLogin(data, request, env, corsHeaders);
        case 'logout':
            return await handleLogout(request, env, corsHeaders);
        case 'changePassword':
            return await handleChangePassword(data, request, env, corsHeaders);
        case 'getPackagingConfig':
            return await getPackagingConfig(env, corsHeaders);
        case 'updatePackagingConfig':
            return await updatePackagingConfig(data, env, corsHeaders);
        case 'updateTaxRate':
            return await updateTaxRate(data, env, corsHeaders);
        case 'getProfitReport':
            return await getProfitReport(data, env, corsHeaders);
        case 'calculateCommissions':
            return await calculateCommissions(data, env, corsHeaders);
        case 'markAsPaid':
            return await markCommissionAsPaid(data, env, corsHeaders);
        case 'paySelectedOrders':
            return await paySelectedOrders(data, env, corsHeaders);
        case 'bulkDeleteCTV':
            return await bulkDeleteCTV(data, env, corsHeaders);
        case 'createDiscount':
            return await createDiscount(data, env, corsHeaders);
        case 'updateDiscount':
            return await updateDiscount(data, env, corsHeaders);
        case 'deleteDiscount':
            return await deleteDiscount(data, env, corsHeaders);
        case 'toggleDiscountStatus':
            return await toggleDiscountStatus(data, env, corsHeaders);
        case 'getDiscountUsageHistory':
            return await getDiscountUsageHistory(env, corsHeaders);
        default:
            return jsonResponse({
                success: false,
                error: 'Unknown action: ' + action
            }, 400, corsHeaders);
    }
}

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

    if (path === '/api/ctv/bulk-update-commission') {
        return await bulkUpdateCTVCommission(data, env, corsHeaders);
    }

    if (path === '/api/ctv/update') {
        return await updateCTV(data, env, corsHeaders);
    }

    // Handle action-based routes (for root path or any other path)
    if (data.action) {
        switch (data.action) {
            case 'createOrder':
                // Transform data to match createOrder function signature
                const orderData = {
                    orderId: 'DH' + Date.now(),
                    customer: data.customer,
                    cart: data.products,
                    totalAmount: data.totalAmount,
                    paymentMethod: data.paymentMethod,
                    status: data.status,
                    referralCode: data.referralCode,
                    notes: data.notes,
                    shippingFee: data.shippingFee || 0,
                    shippingCost: data.shippingCost || 0,
                    // Discount data
                    discountCode: data.discountCode || null,
                    discountAmount: data.discountAmount || 0,
                    discountId: data.discountId || null,
                    // Address 4 levels
                    province_id: data.province_id,
                    province_name: data.province_name,
                    district_id: data.district_id,
                    district_name: data.district_name,
                    ward_id: data.ward_id,
                    ward_name: data.ward_name,
                    street_address: data.street_address
                };
                return await createOrder(orderData, env, corsHeaders);
            case 'updateOrderProducts':
                return await updateOrderProducts(data, env, corsHeaders);
            case 'updateOrderNotes':
                return await updateOrderNotes(data, env, corsHeaders);
            case 'updateCustomerInfo':
                return await updateCustomerInfo(data, env, corsHeaders);
            case 'updateAddress':
                return await updateAddress(data, env, corsHeaders);
            case 'updateAmount':
                return await updateAmount(data, env, corsHeaders);
            case 'deleteOrder':
                return await deleteOrder(data, env, corsHeaders);
            case 'updateOrderStatus':
                return await updateOrderStatus(data, env, corsHeaders);
            case 'createProduct':
                return await createProduct(data, env, corsHeaders);
            case 'updateProduct':
                return await updateProduct(data, env, corsHeaders);
            case 'deleteProduct':
                return await deleteProduct(data, env, corsHeaders);
            case 'addProductCategory':
                return await addProductCategory(data, env, corsHeaders);
            case 'removeProductCategory':
                return await removeProductCategory(data, env, corsHeaders);
            case 'setPrimaryCategory':
                return await setPrimaryCategory(data, env, corsHeaders);
            case 'updateProductCategories':
                return await updateProductCategories(data, env, corsHeaders);
            case 'createCategory':
                return await createCategory(data, env, corsHeaders);
            case 'updateCategory':
                return await updateCategory(data, env, corsHeaders);
            case 'deleteCategory':
                return await deleteCategory(data, env, corsHeaders);
            case 'createDiscount':
                return await createDiscount(data, env, corsHeaders);
            case 'updateDiscount':
                return await updateDiscount(data, env, corsHeaders);
            case 'deleteDiscount':
                return await deleteDiscount(data, env, corsHeaders);
            case 'toggleDiscountStatus':
                return await toggleDiscountStatus(data, env, corsHeaders);
            case 'getDiscountUsageHistory':
                return await getDiscountUsageHistory(env, corsHeaders);
            case 'updatePackagingConfig':
                return await updatePackagingConfig(data, env, corsHeaders);
            case 'updateTaxRate':
                return await updateTaxRate(data, env, corsHeaders);
            case 'getProfitReport':
                return await getProfitReport(data, env, corsHeaders);
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

        // 1. Lưu vào D1 Database
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
            INSERT INTO ctv (full_name, phone, email, city, age, bank_account_number, bank_name, referral_code, status, commission_rate, created_at_unix)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            now
        ).run();

        console.log('📊 Insert result:', result);

        if (!result.success) {
            throw new Error('Failed to insert CTV into D1');
        }

        console.log('✅ Saved to D1:', referralCode);
        
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

// Verify CTV code (quick check for auto-complete)
async function verifyCTVCode(code, env, corsHeaders) {
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
        // Use created_at_unix (milliseconds) for consistent timezone handling
        const { results: ctvList } = await env.DB.prepare(`
            SELECT 
                id,
                full_name as fullName,
                phone,
                email,
                city,
                age,
                bank_account_number as bankAccountNumber,
                bank_name as bankName,
                experience,
                referral_code as referralCode,
                status,
                commission_rate as commissionRate,
                created_at_unix as timestamp
            FROM ctv
            ORDER BY created_at_unix DESC
        `).all();

        // Get order stats for each CTV - use total_amount column
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

        // Get today's commission for each CTV (in UTC)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
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

        // Calculate product total (for commission calculation)
        // Commission is calculated on product value ONLY (not including shipping, not including discount)
        const productTotal = data.cart.reduce((sum, item) => {
            const price = item.price || 0;
            const qty = item.quantity || 1;
            return sum + (price * qty);
        }, 0);

        // Validate và lấy thông tin CTV
        let validReferralCode = null;
        let finalCommission = 0;
        let finalCommissionRate = 0;
        let ctvPhone = null;

        if (data.referralCode && data.referralCode.trim() !== '') {
            // Kiểm tra xem referral code có tồn tại không
            const ctvData = await env.DB.prepare(`
                SELECT referral_code, commission_rate, phone FROM ctv WHERE referral_code = ?
            `).bind(data.referralCode.trim()).first();

            if (ctvData) {
                validReferralCode = ctvData.referral_code;
                ctvPhone = ctvData.phone;
                finalCommissionRate = ctvData.commission_rate || 0.1;
                // Commission calculated on product value ONLY (not including shipping, not including discount)
                finalCommission = Math.round(productTotal * finalCommissionRate);
                console.log(`💰 Commission calculated:`, {
                    referralCode: validReferralCode,
                    productValue: productTotal,
                    rate: finalCommissionRate,
                    commission: finalCommission
                });
            } else {
                console.warn('⚠️ Referral code không tồn tại:', data.referralCode);
            }
        }

        // Calculate product cost from cart
        let productCost = 0;
        for (const item of data.cart) {
            let costPrice = item.cost_price || 0;
            
            // Nếu không có cost_price, tự động tra cứu từ database
            if (!costPrice && item.name) {
                try {
                    // Tìm sản phẩm theo tên (hoặc ID nếu có)
                    const productQuery = await env.DB.prepare(`
                        SELECT cost_price FROM products 
                        WHERE name = ? OR id = ?
                        LIMIT 1
                    `).bind(item.name, item.id || item.name).first();
                    
                    if (productQuery && productQuery.cost_price) {
                        costPrice = productQuery.cost_price;
                        console.log(`✅ Auto-fetched cost_price for "${item.name}": ${costPrice}`);
                    } else {
                        console.warn(`⚠️ No cost_price found for product: "${item.name}"`);
                    }
                } catch (error) {
                    console.error(`❌ Error fetching cost_price for "${item.name}":`, error);
                }
            }
            
            const quantity = item.quantity || 1;
            productCost += costPrice * quantity;
        }

        // Format products thành JSON string
        const productsJson = JSON.stringify(data.cart);

        // 1. Lưu vào D1 Database (store in UTC)
        const orderDate = data.orderDate || new Date().getTime();

        // Get shipping info
        const shippingFee = data.shippingFee || 0;
        const shippingCost = data.shippingCost || 0;

        // Calculate packaging cost (snapshot current prices)
        const { results: packagingConfig } = await env.DB.prepare(`
            SELECT item_name, item_cost FROM cost_config WHERE is_default = 1
        `).all();
        
        const packagingPrices = {};
        packagingConfig.forEach(item => {
            packagingPrices[item.item_name] = item.item_cost;
        });
        
        const totalProducts = data.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Calculate packaging cost
        // Per-product items (multiply by total products): red_string, labor_cost
        // Per-order items (fixed per order): bag_zip, bag_red, box_shipping, thank_card, paper_print
        const perProductCost = 
            ((packagingPrices.red_string || 0) * totalProducts) +
            ((packagingPrices.labor_cost || 0) * totalProducts);
        
        const perOrderCost = 
            (packagingPrices.bag_zip || 0) + 
            (packagingPrices.bag_red || 0) +
            (packagingPrices.box_shipping || 0) + 
            (packagingPrices.thank_card || 0) + 
            (packagingPrices.paper_print || 0);
        
        const totalPackagingCost = perProductCost + perOrderCost;
        
        const packagingDetails = {
            per_product: {
                red_string: packagingPrices.red_string || 0,
                labor_cost: packagingPrices.labor_cost || 0
            },
            per_order: {
                bag_zip: packagingPrices.bag_zip || 0,
                bag_red: packagingPrices.bag_red || 0,
                box_shipping: packagingPrices.box_shipping || 0,
                thank_card: packagingPrices.thank_card || 0,
                paper_print: packagingPrices.paper_print || 0
            },
            total_products: totalProducts,
            per_product_cost: perProductCost,
            per_order_cost: perOrderCost,
            total_cost: totalPackagingCost
        };

        // Get current tax rate from cost_config (stored in item_cost)
        const taxRateConfig = await env.DB.prepare(`
            SELECT item_cost as tax_rate FROM cost_config WHERE item_name = 'tax_rate' LIMIT 1
        `).first();
        const currentTaxRate = taxRateConfig?.tax_rate || 0.015;
        
        // Calculate tax amount (revenue * tax_rate)
        // IMPORTANT: totalAmountNumber already includes productTotal + shippingFee - discountAmount
        // So we use it directly as revenue, no need to add shippingFee again
        const revenue = totalAmountNumber;
        const taxAmount = Math.round(revenue * currentTaxRate);

        // Get discount data
        const discountCode = data.discountCode || null;
        const discountAmount = data.discountAmount || 0;

        const orderTimestamp = new Date(orderDate).getTime();
        const result = await env.DB.prepare(`
            INSERT INTO orders (
                order_id, order_date, customer_name, customer_phone, 
                address, products, total_amount, payment_method, 
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.orderId,
            orderDate,
            data.customer.name,
            data.customer.phone,
            data.customer.address || data.address || '',
            productsJson,
            totalAmountNumber,
            data.paymentMethod || 'cod',
            data.status || 'pending',
            validReferralCode,
            finalCommission,
            finalCommissionRate,
            ctvPhone || null,
            data.notes || null,
            shippingFee,
            shippingCost,
            totalPackagingCost,
            JSON.stringify(packagingDetails),
            taxAmount,
            currentTaxRate,
            orderTimestamp,
            data.province_id || null,
            data.province_name || null,
            data.district_id || null,
            data.district_name || null,
            data.ward_id || null,
            data.ward_name || null,
            data.street_address || null,
            discountCode,
            discountAmount
        ).run();

        if (!result.success) {
            throw new Error('Failed to insert order into D1');
        }

        const insertedOrderId = result.meta.last_row_id;
        console.log('✅ Saved order to D1:', data.orderId, 'ID:', insertedOrderId);

        // 1.5. Insert order items into order_items table
        try {
            for (const item of data.cart) {
                const productName = item.name || 'Unknown';
                const quantity = item.quantity || 1;
                const productPrice = item.price || 0;
                const weight = item.weight || null;
                const size = item.size || null;
                const notes = item.notes || null;

                // Get product_id and cost_price
                let productId = item.id || item.product_id || null;
                let costPrice = item.cost_price || 0;

                // Try to find product in database if not provided
                if (!productId || !costPrice) {
                    try {
                        const productQuery = await env.DB.prepare(`
                            SELECT id, cost_price FROM products 
                            WHERE name = ? OR id = ?
                            LIMIT 1
                        `).bind(productName, productId).first();

                        if (productQuery) {
                            productId = productId || productQuery.id;
                            costPrice = costPrice || productQuery.cost_price || 0;
                        }
                    } catch (e) {
                        console.warn(`Could not find product: ${productName}`);
                    }
                }

                // Calculate totals
                const subtotal = productPrice * quantity;
                const costTotal = costPrice * quantity;
                const itemProfit = subtotal - costTotal;

                // Merge weight and size into single size column
                const sizeValue = size || weight || null;

                // Insert into order_items with unix timestamp
                const orderTimestamp = new Date(orderDate).getTime();
                await env.DB.prepare(`
                    INSERT INTO order_items (
                        order_id, product_id, product_name, product_price, product_cost,
                        quantity, size, notes, created_at, created_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    insertedOrderId,
                    productId,
                    productName,
                    productPrice,
                    costPrice,
                    quantity,
                    sizeValue,
                    notes,
                    orderDate,
                    orderTimestamp
                ).run();
            }
            console.log(`✅ Inserted ${data.cart.length} items into order_items`);
        } catch (itemsError) {
            console.error('⚠️ Error inserting order items:', itemsError);
            // Don't fail the order creation, just log the error
        }

        // 1.6. Insert into discount_usage if discount was applied
        if (discountCode && discountAmount > 0 && data.discountId) {
            try {
                // totalAmountNumber = productTotal + shippingFee - discountAmount (what customer pays)
                // We save totalAmountNumber as order_amount (final amount customer pays)
                
                await env.DB.prepare(`
                    INSERT INTO discount_usage (
                        discount_id, discount_code, order_id, 
                        customer_name, customer_phone,
                        order_amount, discount_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    data.discountId,
                    discountCode,
                    data.orderId,
                    data.customer.name,
                    data.customer.phone,
                    totalAmountNumber, // Total amount AFTER discount (what customer actually pays)
                    discountAmount
                ).run();
                console.log(`✅ Inserted discount usage: ${discountCode} - Order Amount: ${totalAmountNumber}, Discount: ${discountAmount}`);
            } catch (discountError) {
                console.error('⚠️ Error inserting discount usage:', discountError);
                // Don't fail the order creation
            }
        }

        // 2. Lưu vào Google Sheets (gọi Google Apps Script)
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;

            if (googleScriptUrl) {
                // Chuẩn bị dữ liệu cho Google Sheets (format giống như order-handler.js)
                const sheetsData = {
                    orderId: data.orderId,
                    orderDate: data.orderDate || new Date().getTime(),
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
            timestamp: new Date().getTime() // UTC timestamp
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
        // Get orders with product_cost calculated from order_items using subquery
        // This avoids GROUP BY issues with multiple JOINs
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                orders.*,
                ctv.commission_rate as ctv_commission_rate,
                COALESCE(
                    (SELECT SUM(product_cost * quantity) 
                     FROM order_items 
                     WHERE order_items.order_id = orders.id), 
                    0
                ) as product_cost
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            ORDER BY orders.created_at DESC
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

        // Total orders - Calculate revenue from order_items + shipping_fee
        const { total_orders, total_commission, total_shipping_fee } = await env.DB.prepare(`
            SELECT 
                COUNT(DISTINCT orders.id) as total_orders,
                SUM(orders.commission) as total_commission,
                COALESCE(SUM(orders.shipping_fee), 0) as total_shipping_fee
            FROM orders
        `).first();
        
        const { product_revenue } = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(product_price * quantity), 0) as product_revenue
            FROM order_items
        `).first();
        
        // Total revenue = product revenue + shipping fee (consistent with orders.js)
        const total_revenue = (product_revenue || 0) + (total_shipping_fee || 0);

        // Top performers - use total_amount column
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

// Bulk update commission rate cho nhiều CTV (OPTIMIZED)
async function bulkUpdateCTVCommission(data, env, corsHeaders) {
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
                bank_account_number = ?, bank_name = ?, status = ?, commission_rate = ?, updated_at = CURRENT_TIMESTAMP
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

// Bulk delete CTV
async function bulkDeleteCTV(data, env, corsHeaders) {
    try {
        if (!data.referralCodes || !Array.isArray(data.referralCodes) || data.referralCodes.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Thiếu referralCodes array'
            }, 400, corsHeaders);
        }

        const referralCodes = data.referralCodes;
        console.log(`🗑️ Bulk deleting ${referralCodes.length} CTVs`);

        // 1. Delete from D1 with single query
        const placeholders = referralCodes.map(() => '?').join(',');
        const deleteQuery = `
            DELETE FROM ctv 
            WHERE referral_code IN (${placeholders})
        `;
        
        const result = await env.DB.prepare(deleteQuery)
            .bind(...referralCodes)
            .run();

        const deletedCount = result.meta.changes;
        console.log(`✅ Deleted ${deletedCount} CTVs from D1`);

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
                    console.warn('⚠️ Failed to sync to Google Sheets, but D1 deleted successfully');
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

// Update order products
async function updateOrderProducts(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.products) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc products'
            }, 400, corsHeaders);
        }

        // Parse products JSON
        let productsArray;
        try {
            productsArray = typeof data.products === 'string' ? JSON.parse(data.products) : data.products;
        } catch (e) {
            return jsonResponse({
                success: false,
                error: 'Invalid products JSON'
            }, 400, corsHeaders);
        }

        // Get order info for commission calculation
        const order = await env.DB.prepare(`
            SELECT referral_code, shipping_fee
            FROM orders 
            WHERE id = ?
        `).bind(data.orderId).first();

        if (!order) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        // Delete existing order_items
        await env.DB.prepare(`
            DELETE FROM order_items 
            WHERE order_id = ?
        `).bind(data.orderId).run();

        // Insert new order_items
        const currentTimestamp = Date.now(); // Unix timestamp in milliseconds
        
        for (const product of productsArray) {
            await env.DB.prepare(`
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name, 
                    product_price, 
                    product_cost,
                    quantity,
                    size,
                    notes,
                    created_at_unix
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                data.orderId,
                product.product_id || null,
                product.name || product.product_name || 'Unknown',
                product.price || product.product_price || 0,
                product.cost_price || product.cost || product.product_cost || 0,
                product.quantity || 1,
                product.size || product.weight || null, // Use size field for both weight and size
                product.notes || null,
                currentTimestamp
            ).run();
        }

        // Calculate new total_amount from order_items
        const productTotalResult = await env.DB.prepare(`
            SELECT COALESCE(SUM(product_price * quantity), 0) as product_total
            FROM order_items
            WHERE order_id = ?
        `).bind(data.orderId).first();

        const productTotal = productTotalResult?.product_total || 0;
        const shippingFee = order.shipping_fee || 0;
        
        // Get discount amount from order
        const orderDiscount = await env.DB.prepare(`
            SELECT discount_amount
            FROM orders
            WHERE id = ?
        `).bind(data.orderId).first();
        
        const discountAmount = orderDiscount?.discount_amount || 0;
        
        // Calculate total_amount: productTotal + shippingFee - discountAmount
        const newTotalAmount = productTotal + shippingFee - discountAmount;
        
        // Update total_amount in orders table
        await env.DB.prepare(`
            UPDATE orders
            SET total_amount = ?
            WHERE id = ?
        `).bind(newTotalAmount, data.orderId).run();
        
        const updatedOrder = { total_amount: newTotalAmount };

        // Calculate product_cost from order_items
        const productCostResult = await env.DB.prepare(`
            SELECT COALESCE(SUM(product_cost * quantity), 0) as product_cost
            FROM order_items
            WHERE order_id = ?
        `).bind(data.orderId).first();

        const calculatedProductCost = productCostResult?.product_cost || 0;

        let calculatedCommission = null;

        // Calculate commission if order has referral_code
        if (order.referral_code) {
            // Get CTV's commission rate from database
            const ctv = await env.DB.prepare(`
                SELECT commission_rate 
                FROM ctv 
                WHERE referral_code = ?
            `).bind(order.referral_code).first();

            if (ctv && ctv.commission_rate !== null) {
                // Calculate commission based on productTotal ONLY (not including shipping, not including discount)
                calculatedCommission = Math.round(productTotal * ctv.commission_rate);
                console.log(`💰 Calculated commission for ${order.referral_code}: ${calculatedCommission} (rate: ${ctv.commission_rate}, productTotal: ${productTotal})`);
                
                // Update commission
                await env.DB.prepare(`
                    UPDATE orders 
                    SET commission = ?
                    WHERE id = ?
                `).bind(calculatedCommission, data.orderId).run();
            }
        }

        // Also update products text field for backward compatibility
        await env.DB.prepare(`
            UPDATE orders 
            SET products = ?
            WHERE id = ?
        `).bind(data.products, data.orderId).run();

        console.log('✅ Updated order_items and total_amount for order:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật sản phẩm',
            total_amount: updatedOrder.total_amount,
            product_cost: calculatedProductCost,
            commission: calculatedCommission
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order products:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Lỗi khi cập nhật sản phẩm'
        }, 500, corsHeaders);
    }
}

// Update order notes
async function updateOrderNotes(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId'
            }, 400, corsHeaders);
        }

        // Update notes in database
        await env.DB.prepare(`
            UPDATE orders 
            SET notes = ?
            WHERE id = ?
        `).bind(data.notes || null, data.orderId).run();

        console.log('✅ Updated notes for order:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật ghi chú'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order notes:', error);
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

        // Update both total_amount and commission
        // When user manually edits order value, we update the orders table directly
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET total_amount = ?,
                commission = ?
            WHERE id = ?
        `).bind(data.totalAmount, data.commission || 0, data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated commission in D1:', data.orderId);

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

// Update order status
async function updateOrderStatus(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.status) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc status'
            }, 400, corsHeaders);
        }

        // Validate status
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
            return jsonResponse({
                success: false,
                error: 'Trạng thái không hợp lệ'
            }, 400, corsHeaders);
        }

        // Update in D1
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET status = ?
            WHERE id = ?
        `).bind(data.status, data.orderId).run();

        if (result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated order status in D1:', data.orderId, '->', data.status);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật trạng thái đơn hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order status:', error);
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

// ============================================
// DISCOUNT FUNCTIONS
// ============================================

async function getAllDiscounts(env, corsHeaders) {
    try {
        const { results: discounts } = await env.DB.prepare(`
            SELECT 
                id, code, title, description, type,
                discount_value, max_discount_amount,
                gift_product_id, gift_product_name, gift_quantity,
                min_order_amount, min_items,
                max_total_uses, max_uses_per_customer,
                customer_type, combinable_with_other_discounts,
                active, visible,
                start_date, expiry_date,
                created_at, updated_at,
                usage_count, total_discount_amount
            FROM discounts
            ORDER BY created_at DESC
        `).all();

        return jsonResponse({
            success: true,
            discounts: discounts
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting all discounts:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

async function getDiscount(id, env, corsHeaders) {
    try {
        const discount = await env.DB.prepare(`
            SELECT * FROM discounts WHERE id = ?
        `).bind(id).first();

        if (!discount) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy mã giảm giá'
            }, 404, corsHeaders);
        }

        return jsonResponse({
            success: true,
            discount: discount
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

async function createDiscount(data, env, corsHeaders) {
    try {
        // Check if code already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM discounts WHERE code = ?
        `).bind(data.code).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá đã tồn tại'
            }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            INSERT INTO discounts (
                code, title, description, type,
                discount_value, max_discount_amount,
                gift_product_id, gift_product_name, gift_quantity,
                min_order_amount, min_items,
                max_total_uses, max_uses_per_customer,
                customer_type, combinable_with_other_discounts,
                active, visible,
                start_date, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.code,
            data.title,
            data.description || null,
            data.type,
            data.discount_value || 0,
            data.max_discount_amount || null,
            data.gift_product_id || null,
            data.gift_product_name || null,
            data.gift_quantity || 1,
            data.min_order_amount || 0,
            data.min_items || 0,
            data.max_total_uses || null,
            data.max_uses_per_customer || 1,
            data.customer_type || 'all',
            data.combinable_with_other_discounts || 0,
            data.active || 1,
            data.visible || 1,
            data.start_date || null,
            data.expiry_date
        ).run();

        if (!result.success) {
            throw new Error('Failed to create discount');
        }

        return jsonResponse({
            success: true,
            message: 'Tạo mã giảm giá thành công',
            id: result.meta.last_row_id
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error creating discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

async function updateDiscount(data, env, corsHeaders) {
    try {
        // Check if discount exists
        const existing = await env.DB.prepare(`
            SELECT id FROM discounts WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy mã giảm giá'
            }, 404, corsHeaders);
        }

        // Check if code is taken by another discount
        const codeCheck = await env.DB.prepare(`
            SELECT id FROM discounts WHERE code = ? AND id != ?
        `).bind(data.code, data.id).first();

        if (codeCheck) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá đã được sử dụng'
            }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            UPDATE discounts SET
                code = ?,
                title = ?,
                description = ?,
                type = ?,
                discount_value = ?,
                max_discount_amount = ?,
                gift_product_id = ?,
                gift_product_name = ?,
                gift_quantity = ?,
                min_order_amount = ?,
                min_items = ?,
                max_total_uses = ?,
                max_uses_per_customer = ?,
                customer_type = ?,
                combinable_with_other_discounts = ?,
                active = ?,
                visible = ?,
                start_date = ?,
                expiry_date = ?
            WHERE id = ?
        `).bind(
            data.code,
            data.title,
            data.description || null,
            data.type,
            data.discount_value || 0,
            data.max_discount_amount || null,
            data.gift_product_id || null,
            data.gift_product_name || null,
            data.gift_quantity || 1,
            data.min_order_amount || 0,
            data.min_items || 0,
            data.max_total_uses || null,
            data.max_uses_per_customer || 1,
            data.customer_type || 'all',
            data.combinable_with_other_discounts || 0,
            data.active || 1,
            data.visible || 1,
            data.start_date || null,
            data.expiry_date,
            data.id
        ).run();

        if (!result.success) {
            throw new Error('Failed to update discount');
        }

        return jsonResponse({
            success: true,
            message: 'Cập nhật mã giảm giá thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

async function deleteDiscount(data, env, corsHeaders) {
    try {
        // Check if discount has been used
        const usageCheck = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM discount_usage WHERE discount_id = ?
        `).bind(data.id).first();

        if (usageCheck && usageCheck.count > 0) {
            return jsonResponse({
                success: false,
                error: 'Không thể xóa mã đã được sử dụng. Bạn có thể tạm dừng mã này thay vì xóa.'
            }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            DELETE FROM discounts WHERE id = ?
        `).bind(data.id).run();

        if (!result.success) {
            throw new Error('Failed to delete discount');
        }

        return jsonResponse({
            success: true,
            message: 'Xóa mã giảm giá thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error deleting discount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

async function toggleDiscountStatus(data, env, corsHeaders) {
    try {
        const result = await env.DB.prepare(`
            UPDATE discounts SET active = ? WHERE id = ?
        `).bind(data.active ? 1 : 0, data.id).run();

        if (!result.success) {
            throw new Error('Failed to toggle discount status');
        }

        return jsonResponse({
            success: true,
            message: 'Cập nhật trạng thái thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error toggling discount status:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

async function getDiscountUsageHistory(env, corsHeaders) {
    try {
        const { results: usageHistory } = await env.DB.prepare(`
            SELECT 
                du.id,
                du.discount_id,
                du.discount_code,
                du.order_id,
                du.customer_name,
                du.customer_phone,
                du.order_amount,
                du.discount_amount,
                du.gift_received,
                du.used_at,
                d.title as discount_title,
                d.type as discount_type,
                o.total_amount as order_total_amount
            FROM discount_usage du
            LEFT JOIN discounts d ON du.discount_id = d.id
            LEFT JOIN orders o ON du.order_id = o.order_id
            ORDER BY du.used_at DESC
            LIMIT 1000
        `).all();

        // Fix order_amount for old records: use total_amount from orders table if available
        const fixedUsageHistory = usageHistory.map(usage => {
            // If we have order_total_amount from orders table, use it (it's the correct value after discount)
            if (usage.order_total_amount !== null && usage.order_total_amount !== undefined) {
                usage.order_amount = usage.order_total_amount;
            }
            // Remove the temporary field
            delete usage.order_total_amount;
            return usage;
        });

        return jsonResponse({
            success: true,
            usageHistory: fixedUsageHistory
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting discount usage history:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Validate discount code
async function validateDiscount(url, env, corsHeaders) {
    try {
        const code = url.searchParams.get('code');
        const customerPhone = url.searchParams.get('customerPhone');
        const orderAmount = parseFloat(url.searchParams.get('orderAmount')) || 0;

        if (!code) {
            return jsonResponse({
                success: false,
                error: 'Vui lòng nhập mã giảm giá'
            }, 400, corsHeaders);
        }

        // Get discount by code
        const discount = await env.DB.prepare(`
            SELECT * FROM discounts WHERE code = ? AND active = 1
        `).bind(code.toUpperCase()).first();

        if (!discount) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá không tồn tại hoặc đã hết hạn'
            }, 404, corsHeaders);
        }

        // Check expiry date
        const now = new Date();
        if (discount.expiry_date) {
            const expiryDate = new Date(discount.expiry_date);
            if (now > expiryDate) {
                return jsonResponse({
                    success: false,
                    error: 'Mã giảm giá đã hết hạn'
                }, 400, corsHeaders);
            }
        }

        // Check start date
        if (discount.start_date) {
            const startDate = new Date(discount.start_date);
            if (now < startDate) {
                return jsonResponse({
                    success: false,
                    error: 'Mã giảm giá chưa có hiệu lực'
                }, 400, corsHeaders);
            }
        }

        // Check minimum order amount
        if (discount.min_order_amount && orderAmount < discount.min_order_amount) {
            return jsonResponse({
                success: false,
                error: `Đơn hàng tối thiểu ${discount.min_order_amount.toLocaleString('vi-VN')}đ`
            }, 400, corsHeaders);
        }

        // Check max total uses
        if (discount.max_total_uses && discount.usage_count >= discount.max_total_uses) {
            return jsonResponse({
                success: false,
                error: 'Mã giảm giá đã hết lượt sử dụng'
            }, 400, corsHeaders);
        }

        // Check max uses per customer
        if (customerPhone && discount.max_uses_per_customer) {
            const usageCount = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM discount_usage 
                WHERE discount_code = ? AND customer_phone = ?
            `).bind(code.toUpperCase(), customerPhone).first();

            if (usageCount && usageCount.count >= discount.max_uses_per_customer) {
                return jsonResponse({
                    success: false,
                    error: 'Bạn đã sử dụng hết lượt áp dụng mã này'
                }, 400, corsHeaders);
            }
        }

        // Check customer type restriction
        if (discount.customer_type && discount.customer_type !== 'all') {
            // For now, we'll skip this check as it requires order history
            // Can be implemented later if needed
        }

        // Check allowed customer phones
        if (discount.allowed_customer_phones && customerPhone) {
            try {
                const allowedPhones = JSON.parse(discount.allowed_customer_phones);
                if (Array.isArray(allowedPhones) && allowedPhones.length > 0) {
                    if (!allowedPhones.includes(customerPhone)) {
                        return jsonResponse({
                            success: false,
                            error: 'Mã giảm giá không áp dụng cho số điện thoại này'
                        }, 400, corsHeaders);
                    }
                }
            } catch (e) {
                console.warn('Error parsing allowed_customer_phones:', e);
            }
        }

        // All validations passed
        return jsonResponse({
            success: true,
            discount: discount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error validating discount:', error);
        return jsonResponse({
            success: false,
            error: 'Không thể kiểm tra mã giảm giá'
        }, 500, corsHeaders);
    }
}

// ============================================
// CTV OPTIMIZED ENDPOINTS
// ============================================

// Get CTV orders - Optimized with single query
async function getCTVOrdersOptimized(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({ success: false, error: 'Mã CTV không được để trống' }, 400, corsHeaders);
        }

        // Normalize referral code: trim và uppercase
        const normalizedCode = referralCode.trim().toUpperCase();

        // Single optimized query with JOIN - Case insensitive search
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.*,
                c.full_name as ctv_name,
                c.phone as ctv_phone,
                c.city as ctv_address
            FROM orders o
            LEFT JOIN ctv c ON UPPER(TRIM(o.referral_code)) = UPPER(TRIM(c.referral_code))
            WHERE UPPER(TRIM(o.referral_code)) = ?
            ORDER BY o.created_at DESC
        `).bind(normalizedCode).all();

        if (!orders.length) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }

        // Extract CTV info from first order
        const ctvInfo = {
            name: orders[0].ctv_name || 'CTV ' + referralCode,
            phone: orders[0].ctv_phone || '****',
            address: orders[0].ctv_address || 'Xem trong đơn hàng'
        };

        return jsonResponse({ success: true, orders, ctvInfo }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// Get CTV orders by phone - Optimized
async function getCTVOrdersByPhoneOptimized(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({ success: false, error: 'Số điện thoại không được để trống' }, 400, corsHeaders);
        }

        // Normalize phone: trim và thử cả có/không có số 0 đầu
        const cleanPhone = phone.trim();
        const normalizedPhone = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
        const phoneWithout0 = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;

        // Single optimized query - Case insensitive và trim
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.*,
                c.full_name as ctv_name,
                c.phone as ctv_phone,
                c.city as ctv_address,
                c.referral_code
            FROM orders o
            LEFT JOIN ctv c ON UPPER(TRIM(o.referral_code)) = UPPER(TRIM(c.referral_code))
            WHERE TRIM(c.phone) = ? OR TRIM(c.phone) = ? OR TRIM(c.phone) = ?
            ORDER BY o.created_at DESC
        `).bind(normalizedPhone, phoneWithout0, cleanPhone).all();

        if (!orders.length) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }

        const ctvInfo = {
            name: orders[0].ctv_name || 'Cộng tác viên',
            phone: orders[0].ctv_phone || phone,
            address: orders[0].ctv_address || 'Xem trong đơn hàng'
        };

        return jsonResponse({
            success: true,
            orders,
            referralCode: orders[0].referral_code,
            ctvInfo
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// Get CTV dashboard - Optimized with aggregated queries
async function getCTVDashboardOptimized(env, corsHeaders) {
    try {
        // Single query for all stats
        const stats = await env.DB.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM ctv WHERE is_active = 1) as totalCTV,
                (SELECT COUNT(*) FROM orders) as totalOrders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders) as totalRevenue,
                (SELECT COALESCE(SUM(commission), 0) FROM orders WHERE commission IS NOT NULL) as totalCommission
        `).first();

        // Top 5 performers - Optimized
        const { results: topPerformers } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                COUNT(*) as orderCount,
                SUM(o.total_amount) as totalRevenue,
                SUM(o.commission) as commission
            FROM orders o
            WHERE o.referral_code IS NOT NULL AND o.referral_code != ''
            GROUP BY o.referral_code
            ORDER BY totalRevenue DESC
            LIMIT 5
        `).all();

        return jsonResponse({
            success: true,
            stats: {
                totalCTV: stats.totalCTV || 0,
                totalOrders: stats.totalOrders || 0,
                totalRevenue: stats.totalRevenue || 0,
                totalCommission: stats.totalCommission || 0,
                topPerformers: topPerformers || []
            }
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Helper: Generate session token
function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Helper: Verify session token
async function verifySession(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const now = Math.floor(Date.now() / 1000);

    const result = await env.DB.prepare(`
        SELECT s.*, u.id as user_id, u.username, u.full_name, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1
    `).bind(token, now).first();

    return result;
}

// Login endpoint
async function handleLogin(data, request, env, corsHeaders) {
    try {
        const { username, password } = data;

        if (!username || !password) {
            return jsonResponse({
                success: false,
                error: 'Username và password là bắt buộc'
            }, 400, corsHeaders);
        }

        // Get user from database
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE username = ? AND is_active = 1
        `).bind(username).first();

        if (!user) {
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            }, 401, corsHeaders);
        }

        // Verify password using bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            }, 401, corsHeaders);
        }

        // Create session
        const sessionToken = generateSessionToken();
        const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
        const now = Math.floor(Date.now() / 1000);

        await env.DB.prepare(`
            INSERT INTO sessions (id, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        `).bind(sessionToken, user.id, expiresAt, now).run();

        return jsonResponse({
            success: true,
            sessionToken,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Login error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi đăng nhập: ' + error.message
        }, 500, corsHeaders);
    }
}

// Verify session endpoint
async function handleVerifySession(request, env, corsHeaders) {
    const session = await verifySession(request, env);

    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Session không hợp lệ hoặc đã hết hạn'
        }, 401, corsHeaders);
    }

    return jsonResponse({
        success: true,
        user: {
            id: session.user_id,
            username: session.username,
            full_name: session.full_name,
            role: session.role
        }
    }, 200, corsHeaders);
}

// Logout endpoint
async function handleLogout(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({
            success: false,
            error: 'Không tìm thấy session token'
        }, 400, corsHeaders);
    }

    const token = authHeader.substring(7);

    await env.DB.prepare(`
        DELETE FROM sessions WHERE id = ?
    `).bind(token).run();

    return jsonResponse({
        success: true,
        message: 'Đăng xuất thành công'
    }, 200, corsHeaders);
}

// Change password endpoint
async function handleChangePassword(data, request, env, corsHeaders) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Unauthorized'
        }, 401, corsHeaders);
    }

    try {
        const { currentPassword, newPassword } = data;

        if (!currentPassword || !newPassword) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc'
            }, 400, corsHeaders);
        }

        if (newPassword.length < 6) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            }, 400, corsHeaders);
        }

        // Get current user
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(session.user_id).first();

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu hiện tại không đúng'
            }, 401, corsHeaders);
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        const now = Math.floor(Date.now() / 1000);

        // Update password
        await env.DB.prepare(`
            UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
        `).bind(newPasswordHash, now, session.user_id).run();

        return jsonResponse({
            success: true,
            message: 'Đổi mật khẩu thành công'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Change password error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi đổi mật khẩu: ' + error.message
        }, 500, corsHeaders);
    }
}

// ============================================

function jsonResponse(data, status = 200, corsHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}


// ============================================
// PRODUCT FUNCTIONS
// ============================================

// Get all products (OPTIMIZED - No N+1 queries)
async function getAllProducts(env, corsHeaders) {
    try {
        // Get all products
        const { results: products } = await env.DB.prepare(`
            SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
            ORDER BY name ASC
        `).all();

        // Get ALL product-category relationships in ONE query
        const { results: allProductCategories } = await env.DB.prepare(`
            SELECT 
                pc.product_id,
                c.id, 
                c.name, 
                c.icon, 
                c.color, 
                pc.is_primary,
                pc.display_order
            FROM product_categories pc
            JOIN categories c ON pc.category_id = c.id
            ORDER BY pc.product_id, pc.is_primary DESC, pc.display_order ASC
        `).all();

        // Group categories by product_id
        const categoriesByProduct = {};
        for (let pc of allProductCategories) {
            if (!categoriesByProduct[pc.product_id]) {
                categoriesByProduct[pc.product_id] = [];
            }
            categoriesByProduct[pc.product_id].push({
                id: pc.id,
                name: pc.name,
                icon: pc.icon,
                color: pc.color,
                is_primary: pc.is_primary
            });
        }

        // Assign categories to products
        for (let product of products) {
            product.categories = categoriesByProduct[product.id] || [];
            product.category_ids = product.categories.map(c => c.id);
        }

        return jsonResponse({
            success: true,
            products: products
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get single product by ID
async function getProduct(productId, env, corsHeaders) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        const product = await env.DB.prepare(`
            SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `).bind(productId).first();

        if (!product) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Get all categories for this product
        const { results: categories } = await env.DB.prepare(`
            SELECT c.id, c.name, c.icon, c.color, pc.is_primary
            FROM categories c
            JOIN product_categories pc ON c.id = pc.category_id
            WHERE pc.product_id = ?
            ORDER BY pc.is_primary DESC, pc.display_order ASC
        `).bind(productId).all();
        
        product.categories = categories;
        product.category_ids = categories.map(c => c.id);

        return jsonResponse({
            success: true,
            product: product
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Search products by name
async function searchProducts(query, env, corsHeaders) {
    try {
        if (!query || query.trim() === '') {
            return await getAllProducts(env, corsHeaders);
        }

        const searchTerm = `%${query.trim()}%`;
        const { results: products } = await env.DB.prepare(`
            SELECT * FROM products
            WHERE is_active = 1
            AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)
            ORDER BY name ASC
            LIMIT 50
        `).bind(searchTerm, searchTerm, searchTerm).all();

        return jsonResponse({
            success: true,
            products: products,
            query: query
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error searching products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create new product
async function createProduct(data, env, corsHeaders) {
    try {
        // Validate required fields
        if (!data.name || !data.price) {
            return jsonResponse({
                success: false,
                error: 'Name and price are required'
            }, 400, corsHeaders);
        }

        // Validate price
        const price = parseFloat(data.price);
        if (isNaN(price) || price < 0) {
            return jsonResponse({
                success: false,
                error: 'Invalid price'
            }, 400, corsHeaders);
        }

        // Check if SKU already exists (if provided)
        if (data.sku) {
            const existing = await env.DB.prepare(`
                SELECT id FROM products WHERE sku = ?
            `).bind(data.sku).first();

            if (existing) {
                return jsonResponse({
                    success: false,
                    error: 'SKU already exists'
                }, 400, corsHeaders);
            }
        }

        // Insert product
        const result = await env.DB.prepare(`
            INSERT INTO products (name, price, original_price, cost_price, category_id, stock_quantity, rating, purchases, sku, description, image_url, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.name,
            price,
            data.original_price ? parseFloat(data.original_price) : null,
            data.cost_price !== undefined ? parseFloat(data.cost_price) : 0,
            data.category_id ? parseInt(data.category_id) : null,
            data.stock_quantity !== undefined ? parseInt(data.stock_quantity) : 0,
            data.rating !== undefined ? parseFloat(data.rating) : 0,
            data.purchases !== undefined ? parseInt(data.purchases) : 0,
            data.sku || null,
            data.description || null,
            data.image_url || null,
            data.is_active !== undefined ? data.is_active : 1
        ).run();

        const productId = result.meta.last_row_id;

        // Handle multiple categories if provided
        if (data.category_ids && Array.isArray(data.category_ids) && data.category_ids.length > 0) {
            for (let i = 0; i < data.category_ids.length; i++) {
                const categoryId = data.category_ids[i];
                const isPrimary = i === 0 ? 1 : 0; // First one is primary
                
                await env.DB.prepare(`
                    INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
                    VALUES (?, ?, ?, ?)
                `).bind(productId, categoryId, isPrimary, i).run();
            }
        } else if (data.category_id) {
            // Fallback: single category (backward compatibility)
            await env.DB.prepare(`
                INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
                VALUES (?, ?, 1, 0)
            `).bind(productId, data.category_id).run();
        }

        return jsonResponse({
            success: true,
            productId: productId,
            message: 'Product created successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error creating product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update product
async function updateProduct(data, env, corsHeaders) {
    try {
        // Validate required fields
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Check if product exists
        const existing = await env.DB.prepare(`
            SELECT id FROM products WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Validate price if provided
        if (data.price !== undefined) {
            const price = parseFloat(data.price);
            if (isNaN(price) || price < 0) {
                return jsonResponse({
                    success: false,
                    error: 'Invalid price'
                }, 400, corsHeaders);
            }
        }

        // Check SKU uniqueness if changing
        if (data.sku) {
            const skuCheck = await env.DB.prepare(`
                SELECT id FROM products WHERE sku = ? AND id != ?
            `).bind(data.sku, data.id).first();

            if (skuCheck) {
                return jsonResponse({
                    success: false,
                    error: 'SKU already exists'
                }, 400, corsHeaders);
            }
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.price !== undefined) {
            updates.push('price = ?');
            values.push(parseFloat(data.price));
        }
        if (data.original_price !== undefined) {
            updates.push('original_price = ?');
            values.push(data.original_price ? parseFloat(data.original_price) : null);
        }
        if (data.cost_price !== undefined) {
            updates.push('cost_price = ?');
            values.push(data.cost_price !== null ? parseFloat(data.cost_price) : 0);
        }
        if (data.category_id !== undefined) {
            updates.push('category_id = ?');
            values.push(data.category_id ? parseInt(data.category_id) : null);
        }
        if (data.stock_quantity !== undefined) {
            updates.push('stock_quantity = ?');
            values.push(parseInt(data.stock_quantity));
        }
        if (data.rating !== undefined) {
            updates.push('rating = ?');
            values.push(parseFloat(data.rating));
        }
        if (data.purchases !== undefined) {
            updates.push('purchases = ?');
            values.push(parseInt(data.purchases));
        }
        if (data.sku !== undefined) {
            updates.push('sku = ?');
            values.push(data.sku || null);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            values.push(data.description || null);
        }
        if (data.image_url !== undefined) {
            updates.push('image_url = ?');
            values.push(data.image_url || null);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(data.is_active ? 1 : 0);
        }

        // Always update updated_at
        updates.push('updated_at = CURRENT_TIMESTAMP');

        if (updates.length === 1) { // Only updated_at
            return jsonResponse({
                success: false,
                error: 'No fields to update'
            }, 400, corsHeaders);
        }

        // Add ID to values
        values.push(data.id);

        // Execute update
        await env.DB.prepare(`
            UPDATE products
            SET ${updates.join(', ')}
            WHERE id = ?
        `).bind(...values).run();

        // Handle multiple categories update if provided
        if (data.category_ids !== undefined) {
            const categoryIds = Array.isArray(data.category_ids) ? data.category_ids : [];
            
            // Delete existing categories
            await env.DB.prepare(`
                DELETE FROM product_categories WHERE product_id = ?
            `).bind(data.id).run();
            
            // Insert new categories
            if (categoryIds.length > 0) {
                for (let i = 0; i < categoryIds.length; i++) {
                    const categoryId = categoryIds[i];
                    const isPrimary = i === 0 ? 1 : 0; // First one is primary
                    
                    await env.DB.prepare(`
                        INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
                        VALUES (?, ?, ?, ?)
                    `).bind(data.id, categoryId, isPrimary, i).run();
                }
            }
        }

        return jsonResponse({
            success: true,
            message: 'Product updated successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete product (soft delete by setting is_active = 0)
async function deleteProduct(data, env, corsHeaders) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Check if product exists
        const existing = await env.DB.prepare(`
            SELECT id FROM products WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Soft delete (set is_active = 0)
        await env.DB.prepare(`
            UPDATE products
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(data.id).run();

        return jsonResponse({
            success: true,
            message: 'Product deleted successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error deleting product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// ============================================
// PRODUCT CATEGORIES (MANY-TO-MANY)
// ============================================

// Get all categories for a product
async function getProductCategories(productId, env, corsHeaders) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        const { results: categories } = await env.DB.prepare(`
            SELECT c.*, pc.is_primary, pc.display_order
            FROM categories c
            JOIN product_categories pc ON c.id = pc.category_id
            WHERE pc.product_id = ?
            ORDER BY pc.is_primary DESC, pc.display_order ASC, c.name ASC
        `).bind(productId).all();

        return jsonResponse({
            success: true,
            categories: categories
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting product categories:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Add category to product
async function addProductCategory(data, env, corsHeaders) {
    try {
        if (!data.productId || !data.categoryId) {
            return jsonResponse({
                success: false,
                error: 'Product ID and Category ID are required'
            }, 400, corsHeaders);
        }

        // Check if relationship already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM product_categories 
            WHERE product_id = ? AND category_id = ?
        `).bind(data.productId, data.categoryId).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Category already added to this product'
            }, 400, corsHeaders);
        }

        // Insert new relationship
        await env.DB.prepare(`
            INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
            VALUES (?, ?, ?, ?)
        `).bind(
            data.productId,
            data.categoryId,
            data.isPrimary ? 1 : 0,
            data.displayOrder || 0
        ).run();

        return jsonResponse({
            success: true,
            message: 'Category added successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error adding product category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Remove category from product
async function removeProductCategory(data, env, corsHeaders) {
    try {
        if (!data.productId || !data.categoryId) {
            return jsonResponse({
                success: false,
                error: 'Product ID and Category ID are required'
            }, 400, corsHeaders);
        }

        await env.DB.prepare(`
            DELETE FROM product_categories 
            WHERE product_id = ? AND category_id = ?
        `).bind(data.productId, data.categoryId).run();

        return jsonResponse({
            success: true,
            message: 'Category removed successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error removing product category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Set primary category for product
async function setPrimaryCategory(data, env, corsHeaders) {
    try {
        if (!data.productId || !data.categoryId) {
            return jsonResponse({
                success: false,
                error: 'Product ID and Category ID are required'
            }, 400, corsHeaders);
        }

        // Update to set as primary (trigger will handle removing old primary)
        await env.DB.prepare(`
            UPDATE product_categories 
            SET is_primary = 1 
            WHERE product_id = ? AND category_id = ?
        `).bind(data.productId, data.categoryId).run();

        return jsonResponse({
            success: true,
            message: 'Primary category set successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error setting primary category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update all categories for a product (bulk operation)
async function updateProductCategories(data, env, corsHeaders) {
    try {
        if (!data.productId || !data.categoryIds) {
            return jsonResponse({
                success: false,
                error: 'Product ID and category IDs are required'
            }, 400, corsHeaders);
        }

        const productId = data.productId;
        const categoryIds = Array.isArray(data.categoryIds) ? data.categoryIds : [];

        // Delete all existing categories for this product
        await env.DB.prepare(`
            DELETE FROM product_categories WHERE product_id = ?
        `).bind(productId).run();

        // Insert new categories
        if (categoryIds.length > 0) {
            for (let i = 0; i < categoryIds.length; i++) {
                const categoryId = categoryIds[i];
                const isPrimary = i === 0 ? 1 : 0; // First one is primary
                
                await env.DB.prepare(`
                    INSERT INTO product_categories (product_id, category_id, is_primary, display_order)
                    VALUES (?, ?, ?, ?)
                `).bind(productId, categoryId, isPrimary, i).run();
            }
        }

        return jsonResponse({
            success: true,
            message: 'Product categories updated successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating product categories:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// CATEGORY FUNCTIONS
// ============================================

// Get all categories
async function getAllCategories(env, corsHeaders) {
    try {
        const { results: categories } = await env.DB.prepare(`
            SELECT * FROM categories
            WHERE is_active = 1
            ORDER BY display_order ASC, name ASC
        `).all();

        return jsonResponse({
            success: true,
            categories: categories
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting categories:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get single category by ID
async function getCategory(categoryId, env, corsHeaders) {
    try {
        if (!categoryId) {
            return jsonResponse({
                success: false,
                error: 'Category ID is required'
            }, 400, corsHeaders);
        }

        const category = await env.DB.prepare(`
            SELECT * FROM categories WHERE id = ?
        `).bind(categoryId).first();

        if (!category) {
            return jsonResponse({
                success: false,
                error: 'Category not found'
            }, 404, corsHeaders);
        }

        return jsonResponse({
            success: true,
            category: category
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create new category
async function createCategory(data, env, corsHeaders) {
    try {
        if (!data.name) {
            return jsonResponse({
                success: false,
                error: 'Category name is required'
            }, 400, corsHeaders);
        }

        // Check if name already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM categories WHERE name = ?
        `).bind(data.name).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Category name already exists'
            }, 400, corsHeaders);
        }

        // Insert category
        const result = await env.DB.prepare(`
            INSERT INTO categories (name, description, icon, color, display_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            data.name,
            data.description || null,
            data.icon || null,
            data.color || null,
            data.display_order || 0,
            data.is_active !== undefined ? data.is_active : 1
        ).run();

        return jsonResponse({
            success: true,
            categoryId: result.meta.last_row_id,
            message: 'Category created successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error creating category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update category
async function updateCategory(data, env, corsHeaders) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Category ID is required'
            }, 400, corsHeaders);
        }

        // Check if category exists
        const existing = await env.DB.prepare(`
            SELECT id FROM categories WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Category not found'
            }, 404, corsHeaders);
        }

        // Check name uniqueness if changing
        if (data.name) {
            const nameCheck = await env.DB.prepare(`
                SELECT id FROM categories WHERE name = ? AND id != ?
            `).bind(data.name, data.id).first();

            if (nameCheck) {
                return jsonResponse({
                    success: false,
                    error: 'Category name already exists'
                }, 400, corsHeaders);
            }
        }

        // Build update query
        const updates = [];
        const values = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            values.push(data.description || null);
        }
        if (data.icon !== undefined) {
            updates.push('icon = ?');
            values.push(data.icon || null);
        }
        if (data.color !== undefined) {
            updates.push('color = ?');
            values.push(data.color || null);
        }
        if (data.display_order !== undefined) {
            updates.push('display_order = ?');
            values.push(data.display_order);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(data.is_active ? 1 : 0);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        if (updates.length === 1) {
            return jsonResponse({
                success: false,
                error: 'No fields to update'
            }, 400, corsHeaders);
        }

        values.push(data.id);

        await env.DB.prepare(`
            UPDATE categories
            SET ${updates.join(', ')}
            WHERE id = ?
        `).bind(...values).run();

        return jsonResponse({
            success: true,
            message: 'Category updated successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete category (soft delete)
async function deleteCategory(data, env, corsHeaders) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Category ID is required'
            }, 400, corsHeaders);
        }

        // Check if category exists
        const existing = await env.DB.prepare(`
            SELECT id FROM categories WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Category not found'
            }, 404, corsHeaders);
        }

        // Check if category has products
        const { count } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = 1
        `).bind(data.id).first();

        if (count > 0) {
            return jsonResponse({
                success: false,
                error: `Cannot delete category with ${count} active products`
            }, 400, corsHeaders);
        }

        // Soft delete
        await env.DB.prepare(`
            UPDATE categories
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(data.id).run();

        return jsonResponse({
            success: true,
            message: 'Category deleted successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error deleting category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// ============================================
// CUSTOMER FUNCTIONS
// ============================================

// Get all customers (virtual - aggregated from orders)
async function getAllCustomers(env, corsHeaders) {
    try {
        const { results: customers } = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                MAX(customer_name) as name,
                MAX(address) as address,
                MAX(province_id) as province_id,
                MAX(province_name) as province_name,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE customer_phone IS NOT NULL AND customer_phone != ''
            GROUP BY customer_phone
            ORDER BY total_spent DESC
        `).all();

        // Calculate additional metrics for each customer
        const enrichedCustomers = customers.map(customer => {
            const daysSinceLastOrder = customer.last_order_date
                ? Math.floor((Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

            const daysSinceFirstOrder = customer.first_order_date
                ? Math.floor((Date.now() - new Date(customer.first_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

            // Classify customer
            let segment = 'New';
            if (customer.total_orders >= 5) {
                segment = 'VIP';
            } else if (customer.total_orders >= 2) {
                segment = 'Regular';
            }

            // Check if at risk or churned
            if (daysSinceLastOrder > 90) {
                segment = 'Churned';
            } else if (daysSinceLastOrder > 60) {
                segment = 'At Risk';
            }

            return {
                ...customer,
                avg_order_value: customer.total_spent / customer.total_orders,
                days_since_last_order: daysSinceLastOrder,
                days_since_first_order: daysSinceFirstOrder,
                segment: segment
            };
        });

        console.log('📊 getAllCustomers: Total customers =', enrichedCustomers.length);
        
        return jsonResponse({
            success: true,
            customers: enrichedCustomers,
            total: enrichedCustomers.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customers:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Quick check if customer is new or returning (lightweight query)
async function checkCustomer(phone, env, corsHeaders) {
    try {
        console.log('checkCustomer called with phone:', phone);
        
        if (!phone || phone.trim() === '') {
            console.log('Phone is empty or null');
            return jsonResponse({
                success: false,
                error: 'Phone number is required'
            }, 400, corsHeaders);
        }

        // Simple count query - very fast
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as order_count
            FROM orders
            WHERE customer_phone = ?
        `).bind(phone).first();

        const orderCount = result?.order_count || 0;
        console.log('Order count for phone', phone, ':', orderCount);

        return jsonResponse({
            success: true,
            isNew: orderCount === 0,
            orderCount: orderCount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error checking customer:', error);
        return jsonResponse({
            success: false,
            error: 'Internal server error',
            details: error.message
        }, 500, corsHeaders);
    }
}

// Get customer detail with order history
async function getCustomerDetail(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Phone number is required'
            }, 400, corsHeaders);
        }

        // Get customer summary - use total_amount column
        const summary = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                MAX(customer_name) as name,
                MAX(address) as address,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE customer_phone = ?
            GROUP BY customer_phone
        `).bind(phone).first();

        if (!summary) {
            return jsonResponse({
                success: false,
                error: 'Customer not found'
            }, 404, corsHeaders);
        }

        // Get order history - use total_amount column and include address fields
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                id,
                order_id,
                order_date,
                total_amount,
                status,
                referral_code,
                commission,
                products,
                shipping_fee,
                address,
                province_id,
                district_id,
                ward_id,
                street_address
            FROM orders 
            WHERE customer_phone = ? 
            ORDER BY order_date DESC
        `).bind(phone).all();

        // Calculate metrics
        const daysSinceLastOrder = summary.last_order_date
            ? Math.floor((Date.now() - new Date(summary.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const daysSinceFirstOrder = summary.first_order_date
            ? Math.floor((Date.now() - new Date(summary.first_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Classify customer
        let segment = 'New';
        if (summary.total_orders >= 5) {
            segment = 'VIP';
        } else if (summary.total_orders >= 2) {
            segment = 'Regular';
        }

        if (daysSinceLastOrder > 90) {
            segment = 'Churned';
        } else if (daysSinceLastOrder > 60) {
            segment = 'At Risk';
        }

        const customerDetail = {
            ...summary,
            avg_order_value: summary.total_spent / summary.total_orders,
            days_since_last_order: daysSinceLastOrder,
            days_since_first_order: daysSinceFirstOrder,
            segment: segment,
            orders: orders
        };

        return jsonResponse({
            success: true,
            customer: customerDetail
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customer detail:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Search customers
async function searchCustomers(query, env, corsHeaders) {
    try {
        if (!query || query.trim() === '') {
            return await getAllCustomers(env, corsHeaders);
        }

        const searchTerm = `%${query.trim()}%`;

        const { results: customers } = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                customer_name as name,
                MAX(address) as address,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE (customer_name LIKE ? OR customer_phone LIKE ?)
            AND customer_phone IS NOT NULL AND customer_phone != ''
            GROUP BY customer_phone
            ORDER BY total_spent DESC
        `).bind(searchTerm, searchTerm).all();

        // Enrich customer data
        const enrichedCustomers = customers.map(customer => {
            const daysSinceLastOrder = customer.last_order_date
                ? Math.floor((Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

            let segment = 'New';
            if (customer.total_orders >= 5) {
                segment = 'VIP';
            } else if (customer.total_orders >= 2) {
                segment = 'Regular';
            }

            if (daysSinceLastOrder > 90) {
                segment = 'Churned';
            } else if (daysSinceLastOrder > 60) {
                segment = 'At Risk';
            }

            return {
                ...customer,
                avg_order_value: customer.total_spent / customer.total_orders,
                days_since_last_order: daysSinceLastOrder,
                segment: segment
            };
        });

        return jsonResponse({
            success: true,
            customers: enrichedCustomers
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error searching customers:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// ============================================
// PROFIT MANAGEMENT FUNCTIONS
// ============================================

// Get packaging config
async function getPackagingConfig(env, corsHeaders) {
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
async function updatePackagingConfig(data, env, corsHeaders) {
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

// Get profit report
async function getProfitReport(data, env, corsHeaders) {
    try {
        const period = data.period || 'month';
        
        // Calculate date range in UTC
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'today':
                // Start of today in UTC
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                break;
            case 'week':
                // 7 days ago from now
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                // Start of current month in UTC
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
                break;
            case 'year':
                // Start of current year in UTC
                startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                break;
            case 'all':
                // Far past date
                startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
                break;
            default:
                // Default to start of current month
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        }

        // Get orders in period with calculated totals from order_items using subqueries
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                orders.id,
                orders.order_id,
                orders.order_date,
                orders.customer_name,
                orders.customer_phone,
                orders.commission,
                orders.referral_code,
                orders.created_at,
                orders.shipping_fee,
                orders.shipping_cost,
                orders.packaging_cost,
                orders.tax_amount,
                orders.discount_amount,
                COALESCE(
                    (SELECT SUM(product_price * quantity) 
                     FROM order_items 
                     WHERE order_items.order_id = orders.id), 
                    0
                ) as product_total,
                COALESCE(
                    (SELECT SUM(product_cost * quantity) 
                     FROM order_items 
                     WHERE order_items.order_id = orders.id), 
                    0
                ) as product_cost
            FROM orders
            WHERE orders.created_at_unix >= ?
            ORDER BY orders.created_at DESC
        `).bind(startDate.getTime()).all();

        // Calculate totals
        let totalRevenue = 0;
        let totalProductCost = 0;
        let totalShippingFee = 0;
        let totalShippingCost = 0;
        let totalPackagingCost = 0;
        let totalCommission = 0;
        let totalTax = 0;
        let totalProfit = 0;

        orders.forEach(order => {
            const productTotal = order.product_total || 0;
            const shippingFee = order.shipping_fee || 0;
            const discountAmount = order.discount_amount || 0;
            const revenue = productTotal + shippingFee - discountAmount;
            
            const productCost = order.product_cost || 0;
            const shippingCost = order.shipping_cost || 0;
            const packagingCost = order.packaging_cost || 0;
            const commission = order.commission || 0;
            const taxAmount = order.tax_amount || 0;
            const profit = revenue - productCost - shippingCost - packagingCost - commission - taxAmount;

            totalRevenue += revenue;
            totalProductCost += productCost;
            totalShippingFee += shippingFee;
            totalShippingCost += shippingCost;
            totalPackagingCost += packagingCost;
            totalCommission += commission;
            totalTax += taxAmount;
            totalProfit += profit;

            order.total_amount = revenue;
            order.profit = profit;
        });

        const totalCost = totalProductCost + totalShippingCost + totalPackagingCost + totalCommission + totalTax;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return jsonResponse({
            success: true,
            period: period,
            summary: {
                totalRevenue,
                totalCost,
                totalProfit,
                profitMargin: Math.round(profitMargin * 10) / 10,
                orderCount: orders.length
            },
            costBreakdown: {
                productCost: totalProductCost,
                packagingCost: totalPackagingCost,
                shippingFee: totalShippingFee,
                shippingCost: totalShippingCost,
                shippingProfit: totalShippingFee - totalShippingCost,
                commission: totalCommission,
                tax: totalTax
            },
            orders: orders.map(order => ({
                id: order.id,
                order_id: order.order_id,
                order_date: order.order_date,
                customer_name: order.customer_name,
                total_amount: order.total_amount,
                product_cost: order.product_cost,
                packaging_cost: order.packaging_cost,
                shipping_fee: order.shipping_fee,
                shipping_cost: order.shipping_cost,
                commission: order.commission,
                profit: order.profit,
                created_at: order.created_at
            }))
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting profit report:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get revenue chart data for visualization
async function getRevenueChart(data, env, corsHeaders) {
    try {
        const period = data.period || 'week';
        const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
        
        // Helper: Get VN date components
        const getVNDate = (timestamp) => {
            const vnTime = new Date(timestamp + VN_OFFSET_MS);
            return {
                year: vnTime.getUTCFullYear(),
                month: vnTime.getUTCMonth() + 1,
                date: vnTime.getUTCDate(),
                day: vnTime.getUTCDay()
            };
        };
        
        // Helper: Get start of day in VN timezone
        const getVNStartOfDay = (year, month, date) => {
            return Date.UTC(year, month - 1, date, 0, 0, 0) - VN_OFFSET_MS;
        };
        
        const now = Date.now();
        const vnNow = getVNDate(now);
        
        let currentStart, currentEnd, previousStart, previousEnd, groupBy, labels;
        
        // Handle custom date range (when period='all' with startDate/endDate)
        if (period === 'all' && data.startDate && data.endDate) {
            currentStart = new Date(data.startDate).getTime();
            currentEnd = new Date(data.endDate).getTime();
            
            // Calculate duration for comparison period
            const duration = currentEnd - currentStart;
            previousStart = currentStart - duration;
            previousEnd = currentStart - 1;
            
            // Determine groupBy based on duration
            const days = Math.ceil(duration / (24 * 60 * 60 * 1000));
            if (days <= 1) {
                groupBy = 'hour';
                labels = Array.from({length: 24}, (_, i) => `${i}h`);
            } else if (days <= 31) {
                groupBy = 'day';
                labels = Array.from({length: days}, (_, i) => `${i + 1}`);
            } else if (days <= 365) {
                groupBy = 'day';
                const daysCount = Math.min(days, 31);
                labels = Array.from({length: daysCount}, (_, i) => `${i + 1}`);
            } else {
                groupBy = 'month';
                labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
            }
        } else if (period === 'today') {
            // Today vs Yesterday
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, vnNow.date);
            currentEnd = currentStart + 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'hour';
            labels = Array.from({length: 24}, (_, i) => `${i}h`);
            
        } else if (period === 'week') {
            // This week vs Last week (Monday to Sunday)
            const daysSinceMonday = vnNow.day === 0 ? 6 : vnNow.day - 1;
            const mondayDate = vnNow.date - daysSinceMonday;
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, mondayDate);
            currentEnd = currentStart + 7 * 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 7 * 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'day';
            labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
            
        } else if (period === 'month') {
            // This month vs Last month
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, 1);
            const nextMonth = vnNow.month === 12 ? 1 : vnNow.month + 1;
            const nextYear = vnNow.month === 12 ? vnNow.year + 1 : vnNow.year;
            currentEnd = getVNStartOfDay(nextYear, nextMonth, 1) - 1;
            
            const prevMonth = vnNow.month === 1 ? 12 : vnNow.month - 1;
            const prevYear = vnNow.month === 1 ? vnNow.year - 1 : vnNow.year;
            previousStart = getVNStartOfDay(prevYear, prevMonth, 1);
            previousEnd = currentStart - 1;
            groupBy = 'day';
            
            const daysInMonth = Math.ceil((currentEnd - currentStart + 1) / (24 * 60 * 60 * 1000));
            labels = Array.from({length: daysInMonth}, (_, i) => `${i + 1}`);
            
        } else if (period === 'year') {
            // This year vs Last year
            currentStart = getVNStartOfDay(vnNow.year, 1, 1);
            currentEnd = getVNStartOfDay(vnNow.year + 1, 1, 1) - 1;
            previousStart = getVNStartOfDay(vnNow.year - 1, 1, 1);
            previousEnd = currentStart - 1;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        } else {
            // Default to 'all' - all time data
            // Get first order date as start
            const { results: firstOrder } = await env.DB.prepare(`
                SELECT MIN(created_at_unix) as first_date FROM orders WHERE created_at_unix IS NOT NULL
            `).all();
            
            currentStart = firstOrder[0]?.first_date || (now - 365 * 24 * 60 * 60 * 1000);
            currentEnd = now;
            previousStart = currentStart;
            previousEnd = currentStart;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        }
        
        // Fetch orders for both periods with optimized JOIN
        // Use total_amount (actual revenue) and calculate profit in SQL for better performance
        const { results: allOrders } = await env.DB.prepare(`
            SELECT 
                o.created_at_unix,
                o.total_amount as revenue,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost,
                o.shipping_cost,
                o.packaging_cost,
                o.commission,
                o.tax_amount,
                (o.total_amount 
                    - COALESCE(SUM(oi.product_cost * oi.quantity), 0) 
                    - COALESCE(o.shipping_cost, 0) 
                    - COALESCE(o.packaging_cost, 0) 
                    - COALESCE(o.commission, 0) 
                    - COALESCE(o.tax_amount, 0)
                ) as profit
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.created_at_unix >= ? AND o.created_at_unix <= ?
            GROUP BY o.id
        `).bind(previousStart, currentEnd).all();
        
        // Initialize data arrays
        const currentData = { revenue: [], profit: [], orders: [] };
        const previousData = { revenue: [], profit: [], orders: [] };
        
        // Initialize with zeros
        for (let i = 0; i < labels.length; i++) {
            currentData.revenue[i] = 0;
            currentData.profit[i] = 0;
            currentData.orders[i] = 0;
            previousData.revenue[i] = 0;
            previousData.profit[i] = 0;
            previousData.orders[i] = 0;
        }
        
        // Process orders
        allOrders.forEach(order => {
            const timestamp = order.created_at_unix;
            const isCurrent = timestamp >= currentStart && timestamp <= currentEnd;
            const data = isCurrent ? currentData : previousData;
            const baseTime = isCurrent ? currentStart : previousStart;
            
            // Calculate index based on groupBy
            let index = 0;
            if (groupBy === 'hour') {
                const hours = Math.floor((timestamp - baseTime) / (60 * 60 * 1000));
                index = Math.min(hours, 23);
            } else if (groupBy === 'day') {
                const days = Math.floor((timestamp - baseTime) / (24 * 60 * 60 * 1000));
                index = Math.min(days, labels.length - 1);
            } else if (groupBy === 'month') {
                const vnDate = getVNDate(timestamp);
                const baseDate = getVNDate(baseTime);
                index = vnDate.month - baseDate.month;
                if (index < 0) index += 12;
                index = Math.min(index, 11);
            }
            
            // Use pre-calculated values from SQL (much faster than calculating in JS)
            const revenue = order.revenue || 0;
            const profit = order.profit || 0;
            
            data.revenue[index] += revenue;
            data.profit[index] += profit;
            data.orders[index] += 1;
        });
        
        // Calculate totals and comparison
        const currentTotal = {
            revenue: currentData.revenue.reduce((a, b) => a + b, 0),
            profit: currentData.profit.reduce((a, b) => a + b, 0),
            orders: currentData.orders.reduce((a, b) => a + b, 0)
        };
        
        const previousTotal = {
            revenue: previousData.revenue.reduce((a, b) => a + b, 0),
            profit: previousData.profit.reduce((a, b) => a + b, 0),
            orders: previousData.orders.reduce((a, b) => a + b, 0)
        };
        
        const comparison = {
            revenueChange: previousTotal.revenue > 0 ? ((currentTotal.revenue - previousTotal.revenue) / previousTotal.revenue * 100) : 0,
            profitChange: previousTotal.profit > 0 ? ((currentTotal.profit - previousTotal.profit) / previousTotal.profit * 100) : 0,
            ordersChange: previousTotal.orders > 0 ? ((currentTotal.orders - previousTotal.orders) / previousTotal.orders * 100) : 0
        };
        
        return jsonResponse({
            success: true,
            period: period,
            labels: labels,
            currentPeriod: {
                revenue: currentData.revenue,
                profit: currentData.profit,
                orders: currentData.orders,
                total: currentTotal
            },
            previousPeriod: {
                revenue: previousData.revenue,
                profit: previousData.profit,
                orders: previousData.orders,
                total: previousTotal
            },
            comparison: {
                revenueChange: Math.round(comparison.revenueChange * 10) / 10,
                profitChange: Math.round(comparison.profitChange * 10) / 10,
                ordersChange: Math.round(comparison.ordersChange * 10) / 10
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting revenue chart:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// Get orders chart data for visualization
async function getOrdersChart(data, env, corsHeaders) {
    try {
        const period = data.period || 'week';
        const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
        
        const getVNDate = (timestamp) => {
            const vnTime = new Date(timestamp + VN_OFFSET_MS);
            return {
                year: vnTime.getUTCFullYear(),
                month: vnTime.getUTCMonth() + 1,
                date: vnTime.getUTCDate(),
                day: vnTime.getUTCDay()
            };
        };
        
        const getVNStartOfDay = (year, month, date) => {
            return Date.UTC(year, month - 1, date, 0, 0, 0) - VN_OFFSET_MS;
        };
        
        const now = Date.now();
        const vnNow = getVNDate(now);
        
        let currentStart, currentEnd, previousStart, previousEnd, groupBy, labels;
        
        // Handle custom date range (when period='all' with startDate/endDate)
        if (period === 'all' && data.startDate && data.endDate) {
            currentStart = new Date(data.startDate).getTime();
            currentEnd = new Date(data.endDate).getTime();
            
            const duration = currentEnd - currentStart;
            previousStart = currentStart - duration;
            previousEnd = currentStart - 1;
            
            const days = Math.ceil(duration / (24 * 60 * 60 * 1000));
            if (days <= 1) {
                groupBy = 'hour';
                labels = Array.from({length: 24}, (_, i) => `${i}h`);
            } else if (days <= 31) {
                groupBy = 'day';
                labels = Array.from({length: days}, (_, i) => `${i + 1}`);
            } else {
                groupBy = 'month';
                labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
            }
        } else if (period === 'today') {
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, vnNow.date);
            currentEnd = currentStart + 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'hour';
            labels = Array.from({length: 24}, (_, i) => `${i}h`);
        } else if (period === 'week') {
            const daysSinceMonday = vnNow.day === 0 ? 6 : vnNow.day - 1;
            const mondayDate = vnNow.date - daysSinceMonday;
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, mondayDate);
            currentEnd = currentStart + 7 * 24 * 60 * 60 * 1000 - 1;
            previousStart = currentStart - 7 * 24 * 60 * 60 * 1000;
            previousEnd = currentStart - 1;
            groupBy = 'day';
            labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        } else if (period === 'month') {
            currentStart = getVNStartOfDay(vnNow.year, vnNow.month, 1);
            const nextMonth = vnNow.month === 12 ? 1 : vnNow.month + 1;
            const nextYear = vnNow.month === 12 ? vnNow.year + 1 : vnNow.year;
            currentEnd = getVNStartOfDay(nextYear, nextMonth, 1) - 1;
            const prevMonth = vnNow.month === 1 ? 12 : vnNow.month - 1;
            const prevYear = vnNow.month === 1 ? vnNow.year - 1 : vnNow.year;
            previousStart = getVNStartOfDay(prevYear, prevMonth, 1);
            previousEnd = currentStart - 1;
            groupBy = 'day';
            const daysInMonth = Math.ceil((currentEnd - currentStart + 1) / (24 * 60 * 60 * 1000));
            labels = Array.from({length: daysInMonth}, (_, i) => `${i + 1}`);
        } else if (period === 'year') {
            currentStart = getVNStartOfDay(vnNow.year, 1, 1);
            currentEnd = getVNStartOfDay(vnNow.year + 1, 1, 1) - 1;
            previousStart = getVNStartOfDay(vnNow.year - 1, 1, 1);
            previousEnd = currentStart - 1;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        } else {
            // Default to 'all' - all time data
            const { results: firstOrder } = await env.DB.prepare(`
                SELECT MIN(created_at_unix) as first_date FROM orders WHERE created_at_unix IS NOT NULL
            `).all();
            
            currentStart = firstOrder[0]?.first_date || (now - 365 * 24 * 60 * 60 * 1000);
            currentEnd = now;
            previousStart = currentStart;
            previousEnd = currentStart;
            groupBy = 'month';
            labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        }
        
        const { results: allOrders } = await env.DB.prepare(`
            SELECT created_at_unix, status
            FROM orders
            WHERE created_at_unix >= ? AND created_at_unix <= ?
        `).bind(previousStart, currentEnd).all();
        
        const currentData = { total: [], delivered: [], cancelled: [] };
        const previousData = { total: [], delivered: [], cancelled: [] };
        
        for (let i = 0; i < labels.length; i++) {
            currentData.total[i] = 0;
            currentData.delivered[i] = 0;
            currentData.cancelled[i] = 0;
            previousData.total[i] = 0;
            previousData.delivered[i] = 0;
            previousData.cancelled[i] = 0;
        }
        
        allOrders.forEach(order => {
            const timestamp = order.created_at_unix;
            const isCurrent = timestamp >= currentStart && timestamp <= currentEnd;
            const data = isCurrent ? currentData : previousData;
            const baseTime = isCurrent ? currentStart : previousStart;
            
            let index = 0;
            if (groupBy === 'hour') {
                const hours = Math.floor((timestamp - baseTime) / (60 * 60 * 1000));
                index = Math.min(hours, 23);
            } else if (groupBy === 'day') {
                const days = Math.floor((timestamp - baseTime) / (24 * 60 * 60 * 1000));
                index = Math.min(days, labels.length - 1);
            } else if (groupBy === 'month') {
                const vnDate = getVNDate(timestamp);
                const baseDate = getVNDate(baseTime);
                index = vnDate.month - baseDate.month;
                if (index < 0) index += 12;
                index = Math.min(index, 11);
            }
            
            data.total[index] += 1;
            if (order.status === 'delivered') data.delivered[index] += 1;
            else if (order.status === 'cancelled') data.cancelled[index] += 1;
        });
        
        const currentTotal = {
            total: currentData.total.reduce((a, b) => a + b, 0),
            delivered: currentData.delivered.reduce((a, b) => a + b, 0),
            cancelled: currentData.cancelled.reduce((a, b) => a + b, 0)
        };
        
        const previousTotal = {
            total: previousData.total.reduce((a, b) => a + b, 0),
            delivered: previousData.delivered.reduce((a, b) => a + b, 0),
            cancelled: previousData.cancelled.reduce((a, b) => a + b, 0)
        };
        
        const comparison = {
            totalChange: previousTotal.total > 0 ? ((currentTotal.total - previousTotal.total) / previousTotal.total * 100) : 0,
            deliveredChange: previousTotal.delivered > 0 ? ((currentTotal.delivered - previousTotal.delivered) / previousTotal.delivered * 100) : 0,
            cancelledChange: previousTotal.cancelled > 0 ? ((currentTotal.cancelled - previousTotal.cancelled) / previousTotal.cancelled * 100) : 0
        };
        
        const currentDeliveryRate = currentTotal.total > 0 ? (currentTotal.delivered / currentTotal.total * 100) : 0;
        const currentCancelRate = currentTotal.total > 0 ? (currentTotal.cancelled / currentTotal.total * 100) : 0;
        
        return jsonResponse({
            success: true,
            period: period,
            labels: labels,
            currentPeriod: {
                total: currentData.total,
                delivered: currentData.delivered,
                cancelled: currentData.cancelled,
                totals: currentTotal,
                deliveryRate: Math.round(currentDeliveryRate * 10) / 10,
                cancelRate: Math.round(currentCancelRate * 10) / 10
            },
            previousPeriod: {
                total: previousData.total,
                delivered: previousData.delivered,
                cancelled: previousData.cancelled,
                totals: previousTotal
            },
            comparison: {
                totalChange: Math.round(comparison.totalChange * 10) / 10,
                deliveredChange: Math.round(comparison.deliveredChange * 10) / 10,
                cancelledChange: Math.round(comparison.cancelledChange * 10) / 10
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting orders chart:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// ============================================
// MIGRATION FUNCTION - Migrate orders.products to order_items table
// ============================================

async function migrateOrdersToItems(env, corsHeaders) {
    try {
        console.log('🚀 Starting migration: orders.products -> order_items');
        
        const stats = {
            totalOrders: 0,
            ordersProcessed: 0,
            itemsCreated: 0,
            errors: [],
            skipped: []
        };

        // Step 1: Get all orders (without total_amount and product_cost - they were removed)
        const { results: orders } = await env.DB.prepare(`
            SELECT id, order_id, products, created_at
            FROM orders
            ORDER BY id ASC
        `).all();

        stats.totalOrders = orders.length;
        console.log(`📊 Found ${stats.totalOrders} orders to migrate`);

        // Step 2: Process each order
        for (const order of orders) {
            try {
                // Check if already migrated
                const { results: existing } = await env.DB.prepare(`
                    SELECT COUNT(*) as count FROM order_items WHERE order_id = ?
                `).bind(order.id).all();

                if (existing[0].count > 0) {
                    stats.skipped.push({
                        orderId: order.order_id,
                        reason: 'Already migrated'
                    });
                    continue;
                }

                // Parse products
                if (!order.products || order.products.trim() === '') {
                    stats.skipped.push({
                        orderId: order.order_id,
                        reason: 'No products'
                    });
                    continue;
                }

                let products = [];
                try {
                    // Try parse as JSON
                    products = JSON.parse(order.products);
                    if (!Array.isArray(products)) {
                        products = [products];
                    }
                } catch (e) {
                    // Parse as text format: "Product A x2, Product B x1"
                    const lines = order.products.split(/[,\n]/).map(l => l.trim()).filter(l => l);
                    products = lines.map(line => {
                        const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                        if (match) {
                            return { name: match[1].trim(), quantity: parseInt(match[2]) };
                        }
                        return { name: line, quantity: 1 };
                    });
                }

                if (products.length === 0) {
                    stats.skipped.push({
                        orderId: order.order_id,
                        reason: 'Could not parse products'
                    });
                    continue;
                }

                // Helper function to parse Vietnamese price format
                const parseVietnamesePrice = (priceStr) => {
                    if (typeof priceStr === 'number') return priceStr;
                    if (!priceStr) return 0;
                    
                    // Remove currency symbols and spaces: "59.000 ₫" -> "59000"
                    const cleaned = String(priceStr)
                        .replace(/[₫đĐ]/g, '')
                        .replace(/\./g, '')
                        .replace(/,/g, '')
                        .replace(/\s/g, '')
                        .trim();
                    
                    return parseFloat(cleaned) || 0;
                };

                // Step 3: Insert each product as order_item
                for (const product of products) {
                    const productName = typeof product === 'string' ? product : (product.name || 'Unknown');
                    const quantity = typeof product === 'object' && product.quantity ? parseInt(product.quantity) : 1;
                    const productPrice = typeof product === 'object' && product.price ? parseVietnamesePrice(product.price) : 0;
                    const weight = typeof product === 'object' && product.weight ? product.weight : null;
                    const size = typeof product === 'object' && product.size ? product.size : null;
                    const notes = typeof product === 'object' && product.notes ? product.notes : null;

                    // Try to find product in products table to get product_id and cost_price
                    let productId = null;
                    let costPrice = 0;

                    try {
                        const { results: productMatch } = await env.DB.prepare(`
                            SELECT id, cost_price FROM products 
                            WHERE LOWER(name) = LOWER(?) OR id = ?
                            LIMIT 1
                        `).bind(productName, product.id || product.product_id || null).all();

                        if (productMatch && productMatch.length > 0) {
                            productId = productMatch[0].id;
                            costPrice = productMatch[0].cost_price || 0;
                        }
                    } catch (e) {
                        console.warn(`Could not find product: ${productName}`);
                    }

                    // If no cost_price found, try to calculate from order.product_cost
                    if (costPrice === 0 && order.product_cost && products.length === 1) {
                        costPrice = order.product_cost / quantity;
                    }

                    // Calculate totals
                    const subtotal = productPrice * quantity;
                    const costTotal = costPrice * quantity;
                    const profit = subtotal - costTotal;

                    // Merge weight and size into single size column
                    const sizeValue = size || weight || null;

                    // Insert into order_items (without subtotal, cost_total, profit - removed columns)
                    await env.DB.prepare(`
                        INSERT INTO order_items (
                            order_id, product_id, product_name, product_price, product_cost,
                            quantity, size, notes, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        order.id,
                        productId,
                        productName,
                        productPrice,
                        costPrice,
                        quantity,
                        sizeValue,
                        notes,
                        order.created_at
                    ).run();

                    stats.itemsCreated++;
                }

                stats.ordersProcessed++;

            } catch (error) {
                console.error(`Error processing order ${order.order_id}:`, error);
                stats.errors.push({
                    orderId: order.order_id,
                    error: error.message
                });
            }
        }

        console.log('✅ Migration completed!');
        console.log(`📊 Stats:`, stats);

        return jsonResponse({
            success: true,
            message: 'Migration completed successfully',
            stats: {
                totalOrders: stats.totalOrders,
                ordersProcessed: stats.ordersProcessed,
                itemsCreated: stats.itemsCreated,
                skipped: stats.skipped.length,
                errors: stats.errors.length
            },
            details: {
                skipped: stats.skipped,
                errors: stats.errors
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// PRODUCT ANALYTICS FUNCTIONS
// ============================================

// Get top selling products
async function getTopProducts(limit, period, env, corsHeaders, customStartDate = null) {
    try {
        // Calculate date range
        // If frontend provides custom startDate (in ISO format), use it
        // Otherwise calculate based on period
        let startDate;
        
        if (customStartDate) {
            // Frontend sends start date in ISO format (UTC)
            startDate = new Date(customStartDate);
        } else {
            // Fallback: calculate in UTC
            const now = new Date();
            startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0)); // Default: all time

            switch (period) {
                case 'today':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
                    break;
                case 'year':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                    break;
            }
        }

        // Query top products - Simplified and optimized
        const startDateISO = startDate.getTime();
        console.log('🔍 getTopProducts - Filtering from:', startDateISO);
        
        const { results: topProducts } = await env.DB.prepare(`
            SELECT 
                oi.product_id,
                oi.product_name,
                SUM(oi.quantity) as total_sold,
                SUM(oi.product_price * oi.quantity) as total_revenue,
                SUM(oi.product_cost * oi.quantity) as total_cost,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as total_profit,
                AVG(oi.product_price) as avg_price,
                COUNT(DISTINCT oi.order_id) as order_count,
                ROUND(
                    (SUM((oi.product_price - oi.product_cost) * oi.quantity) * 100.0) / 
                    NULLIF(SUM(oi.product_price * oi.quantity), 0), 
                    2
                ) as profit_margin
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?
            GROUP BY oi.product_id, oi.product_name
            ORDER BY total_sold DESC
            LIMIT ?
        `).bind(startDateISO, limit).all();
        
        console.log('📊 getTopProducts - Found', topProducts.length, 'products');

        return jsonResponse({
            success: true,
            period: period,
            startDate: startDate.getTime(),
            products: topProducts
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting top products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get profit overview with all costs
async function getProfitOverview(period, env, corsHeaders, customStartDate = null) {
    try {
        // Calculate date range
        // If frontend provides custom startDate (in ISO format), use it for accurate VN timezone filtering
        // Otherwise calculate based on period in UTC (may not match VN timezone exactly)
        let startDate;
        
        if (customStartDate) {
            // Frontend sends start date in ISO format (already adjusted for VN timezone)
            startDate = new Date(customStartDate);
        } else {
            // Fallback: calculate in UTC (may not match VN timezone exactly)
            const now = new Date();
            
            switch (period) {
                case 'today':
                    // Start of today UTC (not VN timezone!)
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                    break;
                case 'week':
                    // 7 days ago from now
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    // Start of current month UTC
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
                    break;
                case 'year':
                    // Start of current year UTC
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                    break;
                default: // 'all'
                    startDate = new Date(0); // Beginning of time
            }
        }

        // Get overview from orders table (simple & fast)
        const overview = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(shipping_cost), 0) as total_shipping_cost,
                COALESCE(SUM(commission), 0) as total_commission,
                COALESCE(SUM(packaging_cost), 0) as total_packaging_cost,
                COALESCE(SUM(tax_amount), 0) as total_tax
            FROM orders
            WHERE created_at_unix >= ?
        `).bind(startDate.getTime()).first();

        // Get product data from order_items (separate query)
        const productData = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(oi.quantity), 0) as total_products_sold,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?
        `).bind(startDate.getTime()).first();

        // Merge results
        overview.total_products_sold = productData.total_products_sold || 0;
        overview.product_cost = productData.product_cost || 0;

        // Calculate totals using total_amount
        const totalRevenue = overview.total_revenue || 0;
        const totalTax = overview.total_tax || 0; // Use saved tax amount
        const totalCost = (overview.product_cost || 0) + (overview.total_shipping_cost || 0) + 
                         (overview.total_packaging_cost || 0) + (overview.total_commission || 0) + totalTax;
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

        return jsonResponse({
            success: true,
            period: period,
            startDate: startDate.getTime(),
            overview: {
                total_orders: overview.total_orders || 0,
                total_products_sold: overview.total_products_sold || 0,
                total_revenue: totalRevenue,
                product_revenue: overview.product_revenue || 0,
                shipping_fee: overview.total_shipping_fee || 0,
                total_cost: totalCost,
                product_cost: overview.product_cost || 0,
                shipping_cost: overview.total_shipping_cost || 0,
                packaging_cost: overview.total_packaging_cost || 0,
                commission: overview.total_commission || 0,
                tax: totalTax,
                total_profit: totalProfit,
                profit_margin: profitMargin,
                avg_order_value: overview.total_orders > 0 ? (totalRevenue / overview.total_orders) : 0,
                avg_profit_per_product: overview.total_products_sold > 0 ? (totalProfit / overview.total_products_sold) : 0
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting profit overview:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get current active tax rate
async function getCurrentTaxRate(env, corsHeaders) {
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
async function updateTaxRate(data, env, corsHeaders) {
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

// Get detailed stats for a specific product
async function getProductStats(productId, period, env, corsHeaders, customStartDate = null) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Calculate date range
        let startDate;
        
        if (customStartDate) {
            // Frontend sends start date in ISO format (already adjusted for VN timezone)
            startDate = new Date(customStartDate);
        } else {
            // Fallback: calculate in UTC (may not match VN timezone exactly)
            const now = new Date();
            startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0)); // Default: all time

            switch (period) {
                case 'today':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
                    break;
                case 'year':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                    break;
            }
        }

        // Get product info
        const productInfo = await env.DB.prepare(`
            SELECT * FROM products WHERE id = ?
        `).bind(productId).first();

        // Get aggregated stats - Simplified and optimized
        const stats = await env.DB.prepare(`
            SELECT 
                oi.product_id,
                oi.product_name,
                SUM(oi.quantity) as total_sold,
                SUM(oi.product_price * oi.quantity) as total_revenue,
                SUM(oi.product_cost * oi.quantity) as total_cost,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as total_profit,
                AVG(oi.product_price) as avg_price,
                MIN(oi.product_price) as min_price,
                MAX(oi.product_price) as max_price,
                COUNT(DISTINCT oi.order_id) as order_count,
                ROUND(
                    (SUM((oi.product_price - oi.product_cost) * oi.quantity) * 100.0) / 
                    NULLIF(SUM(oi.product_price * oi.quantity), 0), 
                    2
                ) as profit_margin
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND o.created_at_unix >= ?
            GROUP BY oi.product_id, oi.product_name
        `).bind(productId, startDate.getTime()).first();

        // Get daily trend (last 30 days) - Simplified and optimized
        const now = new Date();
        const { results: dailyTrend } = await env.DB.prepare(`
            SELECT 
                DATE(o.created_at_unix/1000, 'unixepoch') as date,
                SUM(oi.quantity) as daily_sold,
                SUM(oi.product_price * oi.quantity) as daily_revenue,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as daily_profit
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND o.created_at_unix >= ?
            GROUP BY DATE(o.created_at_unix/1000, 'unixepoch')
            ORDER BY date DESC
            LIMIT 30
        `).bind(productId, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime()).all();

        // Get recent orders
        const { results: recentOrders } = await env.DB.prepare(`
            SELECT 
                oi.*,
                o.order_id,
                o.customer_name,
                o.created_at as order_date
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND oi.created_at_unix >= ?
            ORDER BY oi.created_at DESC
            LIMIT 10
        `).bind(productId, startDate.getTime()).all();

        return jsonResponse({
            success: true,
            period: period,
            productInfo: productInfo,
            stats: stats || {
                total_sold: 0,
                total_revenue: 0,
                total_cost: 0,
                total_profit: 0,
                order_count: 0,
                profit_margin: 0
            },
            dailyTrend: dailyTrend,
            recentOrders: recentOrders
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting product stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// LOCATION ANALYTICS FUNCTIONS
// ============================================

/**
 * Get location statistics with drill-down support
 * Supports 3 levels: province → district → ward
 */
async function getLocationStats(params, env, corsHeaders) {
    try {
        const { level, provinceId, districtId, period, startDate, previousStartDate, previousEndDate } = params;
        
        // Calculate date range
        let startTimestamp = 0;
        if (startDate) {
            startTimestamp = new Date(startDate).getTime();
        } else if (period && period !== 'all') {
            const now = new Date();
            switch (period) {
                case 'today':
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).getTime();
                    break;
                case 'week':
                    const dayOfWeek = now.getUTCDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday, 0, 0, 0)).getTime();
                    break;
                case 'month':
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).getTime();
                    break;
                case 'year':
                    startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0)).getTime();
                    break;
            }
        }

        let query, previousQuery;

        // Build query based on level
        if (level === 'province') {
            // Province level - group by province_id
            query = `
                SELECT 
                    province_id as id,
                    province_name as name,
                    COUNT(*) as orders,
                    SUM(total_amount) as revenue,
                    COUNT(DISTINCT customer_phone) as customers,
                    AVG(total_amount) as avgValue
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id IS NOT NULL 
                    AND province_id != ''
                    AND created_at_unix >= ?
                GROUP BY province_id, province_name
                ORDER BY revenue DESC
            `;
            
            if (previousStartDate && previousEndDate) {
                const prevStart = new Date(previousStartDate).getTime();
                const prevEnd = new Date(previousEndDate).getTime();
                previousQuery = `
                    SELECT 
                        province_id as id,
                        COUNT(*) as orders,
                        SUM(total_amount) as revenue
                    FROM orders
                    WHERE customer_phone IS NOT NULL 
                        AND customer_phone != ''
                        AND province_id IS NOT NULL 
                        AND province_id != ''
                        AND created_at_unix >= ?
                        AND created_at_unix <= ?
                    GROUP BY province_id
                `;
            }
        } else if (level === 'district' && provinceId) {
            // District level - filter by province, group by district
            query = `
                SELECT 
                    district_id as id,
                    district_name as name,
                    COUNT(*) as orders,
                    SUM(total_amount) as revenue,
                    COUNT(DISTINCT customer_phone) as customers,
                    AVG(total_amount) as avgValue
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND district_id IS NOT NULL 
                    AND district_id != ''
                    AND created_at_unix >= ?
                GROUP BY district_id, district_name
                ORDER BY revenue DESC
            `;
            
            if (previousStartDate && previousEndDate) {
                const prevStart = new Date(previousStartDate).getTime();
                const prevEnd = new Date(previousEndDate).getTime();
                previousQuery = `
                    SELECT 
                        district_id as id,
                        COUNT(*) as orders,
                        SUM(total_amount) as revenue
                    FROM orders
                    WHERE customer_phone IS NOT NULL 
                        AND customer_phone != ''
                        AND province_id = ?
                        AND district_id IS NOT NULL 
                        AND district_id != ''
                        AND created_at_unix >= ?
                        AND created_at_unix <= ?
                    GROUP BY district_id
                `;
            }
        } else if (level === 'ward' && provinceId && districtId) {
            // Ward level - filter by province and district, group by ward
            query = `
                SELECT 
                    ward_id as id,
                    ward_name as name,
                    COUNT(*) as orders,
                    SUM(total_amount) as revenue,
                    COUNT(DISTINCT customer_phone) as customers,
                    AVG(total_amount) as avgValue
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND district_id = ?
                    AND ward_id IS NOT NULL 
                    AND ward_id != ''
                    AND created_at_unix >= ?
                GROUP BY ward_id, ward_name
                ORDER BY revenue DESC
            `;
            
            if (previousStartDate && previousEndDate) {
                const prevStart = new Date(previousStartDate).getTime();
                const prevEnd = new Date(previousEndDate).getTime();
                previousQuery = `
                    SELECT 
                        ward_id as id,
                        COUNT(*) as orders,
                        SUM(total_amount) as revenue
                    FROM orders
                    WHERE customer_phone IS NOT NULL 
                        AND customer_phone != ''
                        AND province_id = ?
                        AND district_id = ?
                        AND ward_id IS NOT NULL 
                        AND ward_id != ''
                        AND created_at_unix >= ?
                        AND created_at_unix <= ?
                    GROUP BY ward_id
                `;
            }
        } else {
            return jsonResponse({
                success: false,
                error: 'Invalid level or missing required parameters'
            }, 400, corsHeaders);
        }

        // Execute current period query
        let results;
        if (level === 'province') {
            results = await env.DB.prepare(query).bind(startTimestamp).all();
        } else if (level === 'district') {
            results = await env.DB.prepare(query).bind(provinceId, startTimestamp).all();
        } else if (level === 'ward') {
            results = await env.DB.prepare(query).bind(provinceId, districtId, startTimestamp).all();
        }

        const locations = results.results || [];

        // Execute previous period query if requested
        let previousLocations = [];
        if (previousQuery && previousStartDate && previousEndDate) {
            const prevStart = new Date(previousStartDate).getTime();
            const prevEnd = new Date(previousEndDate).getTime();
            
            let prevResults;
            if (level === 'province') {
                prevResults = await env.DB.prepare(previousQuery).bind(prevStart, prevEnd).all();
            } else if (level === 'district') {
                prevResults = await env.DB.prepare(previousQuery).bind(provinceId, prevStart, prevEnd).all();
            } else if (level === 'ward') {
                prevResults = await env.DB.prepare(previousQuery).bind(provinceId, districtId, prevStart, prevEnd).all();
            }
            
            previousLocations = prevResults.results || [];
        }

        // Format data
        const formattedLocations = locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            orders: loc.orders || 0,
            revenue: loc.revenue || 0,
            customers: loc.customers || 0,
            avgValue: loc.avgValue || 0
        }));

        const formattedPreviousLocations = previousLocations.map(loc => ({
            id: loc.id,
            orders: loc.orders || 0,
            revenue: loc.revenue || 0
        }));

        // Calculate unique customers across all locations (to avoid double counting)
        // Count all customers with phone, not just those with address
        let uniqueCustomersQuery;
        if (level === 'province') {
            uniqueCustomersQuery = await env.DB.prepare(`
                SELECT COUNT(DISTINCT customer_phone) as unique_customers
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND created_at_unix >= ?
            `).bind(startTimestamp).first();
        } else if (level === 'district') {
            uniqueCustomersQuery = await env.DB.prepare(`
                SELECT COUNT(DISTINCT customer_phone) as unique_customers
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND created_at_unix >= ?
            `).bind(provinceId, startTimestamp).first();
        } else if (level === 'ward') {
            uniqueCustomersQuery = await env.DB.prepare(`
                SELECT COUNT(DISTINCT customer_phone) as unique_customers
                FROM orders
                WHERE customer_phone IS NOT NULL 
                    AND customer_phone != ''
                    AND province_id = ?
                    AND district_id = ?
                    AND created_at_unix >= ?
            `).bind(provinceId, districtId, startTimestamp).first();
        }

        const uniqueCustomers = uniqueCustomersQuery?.unique_customers || 0;

        return jsonResponse({
            success: true,
            level: level,
            period: period || 'all',
            locations: formattedLocations,
            previousLocations: formattedPreviousLocations,
            uniqueCustomers: uniqueCustomers,
            total: formattedLocations.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting location stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// Get detailed analytics for analytics page
async function getDetailedAnalytics(data, env, corsHeaders) {
    try {
        const period = data.period || 'month';
        
        // Calculate date range
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'today':
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
                break;
            case 'week':
                const dayOfWeek = now.getUTCDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday, 0, 0, 0));
                break;
            case 'year':
                startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
                break;
            case 'all':
                startDate = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
                break;
            case 'month':
            default:
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        }

        // Get overview data from orders table (simple & fast)
        const overview = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(shipping_cost), 0) as total_shipping_cost,
                COALESCE(SUM(packaging_cost), 0) as total_packaging_cost,
                COALESCE(SUM(commission), 0) as total_commission,
                COALESCE(SUM(tax_amount), 0) as total_tax
            FROM orders
            WHERE created_at_unix >= ?
        `).bind(startDate.getTime()).first();

        // Get product data from order_items (separate query to avoid JOIN issues)
        const productData = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(oi.quantity), 0) as total_products_sold,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) as product_cost
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?
        `).bind(startDate.getTime()).first();

        // Get unique customers count (by phone number)
        // Handle both milliseconds (13 digits) and seconds (10 digits) timestamps
        const startTimeMs = startDate.getTime();
        const startTimeSec = Math.floor(startTimeMs / 1000);
        const customerData = await env.DB.prepare(`
            SELECT COUNT(DISTINCT customer_phone) as unique_customers
            FROM orders
            WHERE (
                (LENGTH(CAST(created_at_unix AS TEXT)) = 13 AND created_at_unix >= ?) OR
                (LENGTH(CAST(created_at_unix AS TEXT)) = 10 AND created_at_unix >= ?)
            )
              AND customer_phone IS NOT NULL 
              AND customer_phone != ''
        `).bind(startTimeMs, startTimeSec).first();

        // Merge results
        overview.total_products_sold = productData.total_products_sold || 0;
        overview.product_cost = productData.product_cost || 0;
        overview.unique_customers = customerData?.unique_customers || 0;

        const totalRevenue = overview.total_revenue || 0;
        const totalCost = (overview.product_cost || 0) + (overview.total_shipping_cost || 0) + 
                         (overview.total_packaging_cost || 0) + (overview.total_commission || 0) + (overview.total_tax || 0);
        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

        // Get detailed cost breakdown from packaging_details using SQLite JSON functions
        // This is MUCH faster than parsing JSON in JavaScript loop
        const packagingBreakdown = await env.DB.prepare(`
            SELECT 
                COALESCE(SUM(
                    CAST(json_extract(packaging_details, '$.per_product.red_string') AS REAL) * 
                    CAST(json_extract(packaging_details, '$.total_products') AS INTEGER)
                ), 0) as red_string,
                COALESCE(SUM(
                    CAST(json_extract(packaging_details, '$.per_product.labor_cost') AS REAL) * 
                    CAST(json_extract(packaging_details, '$.total_products') AS INTEGER)
                ), 0) as labor_cost,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.bag_zip') AS REAL)), 0) as bag_zip,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.bag_red') AS REAL)), 0) as bag_red,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.box_shipping') AS REAL)), 0) as box_shipping,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.thank_card') AS REAL)), 0) as thank_card,
                COALESCE(SUM(CAST(json_extract(packaging_details, '$.per_order.paper_print') AS REAL)), 0) as paper_print
            FROM orders
            WHERE created_at_unix >= ? AND packaging_details IS NOT NULL
        `).bind(startDate.getTime()).first();

        const costBreakdown = {
            product_cost: overview.product_cost || 0,
            shipping_cost: overview.total_shipping_cost || 0,
            commission: overview.total_commission || 0,
            tax: overview.total_tax || 0,
            red_string: packagingBreakdown?.red_string || 0,
            labor_cost: packagingBreakdown?.labor_cost || 0,
            bag_zip: packagingBreakdown?.bag_zip || 0,
            bag_red: packagingBreakdown?.bag_red || 0,
            box_shipping: packagingBreakdown?.box_shipping || 0,
            thank_card: packagingBreakdown?.thank_card || 0,
            paper_print: packagingBreakdown?.paper_print || 0
        };

        // Debug: Check if any orders have commission
        const ordersWithCommission = await env.DB.prepare(`
            SELECT order_id, commission, referral_code, created_at 
            FROM orders 
            WHERE commission > 0 AND created_at_unix >= ?
            LIMIT 5
        `).bind(startDate.getTime()).all();
        
        console.log('📊 Analytics Debug:', {
            period: period,
            startDate: startDate.getTime(),
            total_orders: overview.total_orders,
            total_commission: overview.total_commission,
            orders_with_commission: ordersWithCommission.results.length,
            sample_orders: ordersWithCommission.results
        });

        // Get top products - Simplified and optimized with full details
        const topProducts = await env.DB.prepare(`
            SELECT 
                oi.product_id,
                oi.product_name,
                SUM(oi.quantity) as total_sold,
                SUM(oi.product_price * oi.quantity) as total_revenue,
                SUM(oi.product_cost * oi.quantity) as total_cost,
                SUM((oi.product_price - oi.product_cost) * oi.quantity) as total_profit,
                AVG(oi.product_price) as avg_price,
                COUNT(DISTINCT oi.order_id) as order_count,
                ROUND(
                    (SUM((oi.product_price - oi.product_cost) * oi.quantity) * 100.0) / 
                    NULLIF(SUM(oi.product_price * oi.quantity), 0), 
                    2
                ) as profit_margin
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?
            GROUP BY oi.product_id, oi.product_name
            ORDER BY total_sold DESC
            LIMIT 10
        `).bind(startDate.getTime()).all();

        // Get daily data for charts (last 30 days) - Use total_amount
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const dailyData = await env.DB.prepare(`
            SELECT 
                DATE(orders.created_at_unix/1000, 'unixepoch') as date,
                COALESCE(SUM(orders.total_amount), 0) as revenue,
                COALESCE(SUM(order_items.product_cost * order_items.quantity), 0) + 
                COALESCE(SUM(orders.shipping_cost), 0) + 
                COALESCE(SUM(orders.packaging_cost), 0) + 
                COALESCE(SUM(orders.commission), 0) + 
                COALESCE(SUM(orders.tax_amount), 0) as cost
            FROM orders
            LEFT JOIN order_items ON orders.id = order_items.order_id
            WHERE orders.created_at_unix >= ?
            GROUP BY DATE(orders.created_at_unix/1000, 'unixepoch')
            ORDER BY date ASC
        `).bind(thirtyDaysAgo.getTime()).all();

        const dailyDataFormatted = dailyData.results.map(d => ({
            date: d.date,
            revenue: d.revenue || 0,
            cost: d.cost || 0,
            profit: (d.revenue || 0) - (d.cost || 0)
        }));

        return jsonResponse({
            success: true,
            period: period,
            overview: {
                total_orders: overview.total_orders || 0,
                total_products_sold: overview.total_products_sold || 0,
                unique_customers: overview.unique_customers || 0,
                total_revenue: totalRevenue,
                total_cost: totalCost,
                total_profit: totalProfit,
                profit_margin: profitMargin,
                avg_revenue_per_order: overview.total_orders > 0 ? totalRevenue / overview.total_orders : 0,
                avg_cost_per_order: overview.total_orders > 0 ? totalCost / overview.total_orders : 0,
                avg_profit_per_order: overview.total_orders > 0 ? totalProfit / overview.total_orders : 0,
                cost_ratio: totalRevenue > 0 ? totalCost / totalRevenue : 0,
                // Add individual cost components
                product_cost: overview.product_cost || 0,
                shipping_cost: overview.total_shipping_cost || 0,
                commission: overview.total_commission || 0,
                packaging_cost: overview.total_packaging_cost || 0,
                tax: overview.total_tax || 0
            },
            cost_breakdown: costBreakdown,
            top_products: topProducts.results || [],
            daily_data: dailyDataFormatted,
            comparison: {
                revenue_change: 0,
                profit_change: 0,
                cost_change: 0
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting detailed analytics:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// ============================================
// COMMISSION PAYMENT HANDLERS
// ============================================

/**
 * Get commissions by month
 * GET ?action=getCommissionsByMonth&month=2025-11
 */
async function getCommissionsByMonth(month, env, corsHeaders) {
    try {
        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month parameter is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDateStr = `${year}-${monthNum}-${endDate}`;

        // Get all CTVs
        const { results: ctvList } = await env.DB.prepare(`
            SELECT referral_code, full_name, phone, commission_rate, bank_account_number, bank_name
            FROM ctv
            WHERE status != 'Tạm ngưng'
            ORDER BY full_name ASC
        `).all();

        // Get all orders except cancelled ones for this month
        console.log('🔍 Querying orders for:', { month, startDate, endDateStr });
        
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                COUNT(DISTINCT o.id) as order_count,
                SUM(o.commission) as total_commission
            FROM orders o
            WHERE o.status NOT IN ('Đã hủy', 'Hủy')
            AND DATE(o.created_at) >= DATE(?)
            AND DATE(o.created_at) <= DATE(?)
            AND o.referral_code IS NOT NULL
            AND o.referral_code != ''
            GROUP BY o.referral_code
        `).bind(startDate, endDateStr).all();
        
        console.log('📦 Found orders:', orders.length);

        // Get existing payment records for this month
        const { results: payments } = await env.DB.prepare(`
            SELECT *
            FROM commission_payments
            WHERE month = ?
        `).bind(month).all();

        // Create a map of payments by referral_code
        const paymentMap = {};
        payments.forEach(p => {
            paymentMap[p.referral_code] = p;
        });

        // Combine data
        const commissionList = ctvList.map(ctv => {
            const orderData = orders.find(o => o.referral_code === ctv.referral_code);
            const payment = paymentMap[ctv.referral_code];

            const orderCount = orderData ? orderData.order_count : 0;
            const commissionAmount = orderData ? orderData.total_commission : 0;

            return {
                referral_code: ctv.referral_code,
                ctv_name: ctv.full_name,
                phone: ctv.phone,
                commission_rate: ctv.commission_rate,
                bank_account_number: ctv.bank_account_number,
                bank_name: ctv.bank_name,
                order_count: orderCount,
                commission_amount: commissionAmount,
                status: payment ? payment.status : 'pending',
                payment_date: payment ? payment.payment_date : null,
                payment_method: payment ? payment.payment_method : null,
                note: payment ? payment.note : null,
                payment_id: payment ? payment.id : null
            };
        }).filter(item => item.order_count > 0); // Only show CTVs with orders

        // Calculate summary
        const summary = {
            total_ctv: commissionList.length,
            paid_count: commissionList.filter(c => c.status === 'paid').length,
            pending_count: commissionList.filter(c => c.status === 'pending').length,
            total_commission: commissionList.reduce((sum, c) => sum + c.commission_amount, 0),
            paid_amount: commissionList.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
            pending_amount: commissionList.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0)
        };

        return jsonResponse({
            success: true,
            month: month,
            commissions: commissionList,
            summary: summary
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting commissions:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get paid orders by month (for payment history)
 * GET ?action=getPaidOrdersByMonth&month=2025-11
 * Returns only the orders that have been paid
 */
async function getPaidOrdersByMonth(month, env, corsHeaders) {
    try {
        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month parameter is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Get all payment records for this month with CTV info
        const { results: payments } = await env.DB.prepare(`
            SELECT 
                cp.id as payment_id,
                cp.referral_code,
                cp.order_count,
                cp.commission_amount,
                cp.payment_date_unix,
                cp.payment_method,
                cp.note,
                cp.status,
                c.full_name as ctv_name,
                c.phone,
                c.bank_account_number,
                c.bank_name
            FROM commission_payments cp
            LEFT JOIN ctv c ON cp.referral_code = c.referral_code
            WHERE cp.month = ?
            AND cp.status = 'paid'
            ORDER BY cp.payment_date_unix DESC, cp.id DESC
        `).bind(month).all();

        return jsonResponse({
            success: true,
            month: month,
            payments: payments,
            summary: {
                total_payments: payments.length,
                total_orders: payments.reduce((sum, p) => sum + (p.order_count || 0), 0),
                total_amount: payments.reduce((sum, p) => sum + (p.commission_amount || 0), 0)
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting paid orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Calculate and save commissions for a month
 * POST ?action=calculateCommissions
 * Body: { month: "2025-11" }
 */
async function calculateCommissions(data, env, corsHeaders) {
    try {
        const { month } = data;

        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDateStr = `${year}-${monthNum}-${endDate}`;

        // Get all orders except cancelled ones for this month grouped by CTV
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                referral_code,
                COUNT(*) as order_count,
                SUM(commission) as total_commission
            FROM orders
            WHERE status NOT IN ('Đã hủy', 'Hủy')
            AND DATE(created_at) >= DATE(?)
            AND DATE(created_at) <= DATE(?)
            AND referral_code IS NOT NULL
            AND referral_code != ''
            GROUP BY referral_code
        `).bind(startDate, endDateStr).all();

        // Insert or update commission_payments
        let insertedCount = 0;
        let updatedCount = 0;

        for (const order of orders) {
            // Check if record exists
            const existing = await env.DB.prepare(`
                SELECT id FROM commission_payments
                WHERE referral_code = ? AND month = ?
            `).bind(order.referral_code, month).first();

            if (existing) {
                // Update existing record
                await env.DB.prepare(`
                    UPDATE commission_payments
                    SET commission_amount = ?,
                        order_count = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(
                    order.total_commission,
                    order.order_count,
                    existing.id
                ).run();
                updatedCount++;
            } else {
                // Insert new record
                const now = Date.now();
                await env.DB.prepare(`
                    INSERT INTO commission_payments (
                        referral_code, month, commission_amount, order_count, status,
                        created_at_unix, updated_at_unix
                    ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
                `).bind(
                    order.referral_code,
                    month,
                    order.total_commission,
                    order.order_count,
                    now,
                    now
                ).run();
                insertedCount++;
            }
        }

        return jsonResponse({
            success: true,
            message: `Calculated commissions for ${month}`,
            inserted: insertedCount,
            updated: updatedCount,
            total: orders.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error calculating commissions:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Mark commission as paid
 * POST ?action=markAsPaid
 * Body: { referralCode, month, paymentDate, paymentMethod, note }
 */
async function markCommissionAsPaid(data, env, corsHeaders) {
    try {
        const { referralCode, month, paymentDate, paymentMethod, note } = data;

        if (!referralCode || !month) {
            return jsonResponse({
                success: false,
                error: 'referralCode and month are required'
            }, 400, corsHeaders);
        }

        // Check if record exists
        const existing = await env.DB.prepare(`
            SELECT id FROM commission_payments
            WHERE referral_code = ? AND month = ?
        `).bind(referralCode, month).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Commission record not found. Please calculate commissions first.'
            }, 404, corsHeaders);
        }

        // Update payment status
        const now = Date.now();
        const paymentDateStr = paymentDate || new Date().toISOString().split('T')[0];
        const paymentDateUnix = new Date(paymentDateStr + 'T00:00:00Z').getTime();
        
        await env.DB.prepare(`
            UPDATE commission_payments
            SET status = 'paid',
                payment_date = ?,
                payment_date_unix = ?,
                payment_method = ?,
                note = ?,
                updated_at = CURRENT_TIMESTAMP,
                updated_at_unix = ?
            WHERE id = ?
        `).bind(
            paymentDateStr,
            paymentDateUnix,
            paymentMethod || 'bank_transfer',
            note || '',
            now,
            existing.id
        ).run();

        return jsonResponse({
            success: true,
            message: 'Commission marked as paid'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error marking commission as paid:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get payment history for a CTV
 * GET ?action=getPaymentHistory&referralCode=ABC123
 */
async function getPaymentHistory(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'referralCode is required'
            }, 400, corsHeaders);
        }

        const { results: history } = await env.DB.prepare(`
            SELECT *
            FROM commission_payments
            WHERE referral_code = ?
            ORDER BY month DESC
        `).bind(referralCode).all();

        return jsonResponse({
            success: true,
            referralCode: referralCode,
            history: history
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting payment history:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// NEW PAYMENT SYSTEM - Pay by Individual Orders
// ============================================

/**
 * Get unpaid orders for a specific CTV
 * GET ?action=getUnpaidOrders&referralCode=CTV100001
 */
async function getUnpaidOrders(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'referralCode is required'
            }, 400, corsHeaders);
        }

        // Get all orders that haven't been paid yet
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.id,
                o.order_id,
                o.order_date,
                o.customer_name,
                o.customer_phone,
                o.address,
                o.products,
                o.payment_method,
                o.status,
                o.commission,
                o.created_at,
                o.shipping_fee
            FROM orders o
            LEFT JOIN commission_payment_details cpd ON o.id = cpd.order_id
            WHERE o.referral_code = ?
            AND o.status NOT IN ('Đã hủy', 'Hủy')
            AND cpd.id IS NULL
            ORDER BY o.created_at DESC
        `).bind(referralCode).all();

        // Calculate summary
        const totalOrders = orders.length;
        const totalCommission = orders.reduce((sum, order) => sum + (order.commission || 0), 0);

        return jsonResponse({
            success: true,
            referralCode: referralCode,
            orders: orders,
            summary: {
                total_orders: totalOrders,
                total_commission: totalCommission
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting unpaid orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get unpaid orders grouped by CTV for a specific month
 * GET ?action=getUnpaidOrdersByMonth&month=2025-11
 */
async function getUnpaidOrdersByMonth(month, env, corsHeaders) {
    try {
        if (!month) {
            return jsonResponse({
                success: false,
                error: 'Month parameter is required (format: YYYY-MM)'
            }, 400, corsHeaders);
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDateStr = `${year}-${monthNum}-${endDate}`;

        // Get all CTVs
        const { results: ctvList } = await env.DB.prepare(`
            SELECT referral_code, full_name, phone, commission_rate, bank_account_number, bank_name
            FROM ctv
            WHERE status != 'Tạm ngưng'
            ORDER BY full_name ASC
        `).all();

        // Get unpaid orders for this month
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.referral_code,
                o.id as order_id,
                o.order_id as order_code,
                o.order_date,
                o.customer_name,
                o.commission,
                o.status,
                o.created_at
            FROM orders o
            LEFT JOIN commission_payment_details cpd ON o.id = cpd.order_id
            WHERE o.status NOT IN ('Đã hủy', 'Hủy')
            AND DATE(o.created_at) >= DATE(?)
            AND DATE(o.created_at) <= DATE(?)
            AND o.referral_code IS NOT NULL
            AND o.referral_code != ''
            AND cpd.id IS NULL
            ORDER BY o.created_at DESC
        `).bind(startDate, endDateStr).all();

        // Group orders by CTV
        const ctvMap = {};
        orders.forEach(order => {
            if (!ctvMap[order.referral_code]) {
                ctvMap[order.referral_code] = {
                    orders: [],
                    total_commission: 0,
                    order_count: 0
                };
            }
            ctvMap[order.referral_code].orders.push(order);
            ctvMap[order.referral_code].total_commission += order.commission || 0;
            ctvMap[order.referral_code].order_count += 1;
        });

        // Combine with CTV info
        const commissionList = ctvList.map(ctv => {
            const ctvData = ctvMap[ctv.referral_code];
            if (!ctvData) return null;

            return {
                referral_code: ctv.referral_code,
                ctv_name: ctv.full_name,
                phone: ctv.phone,
                commission_rate: ctv.commission_rate,
                bank_account_number: ctv.bank_account_number,
                bank_name: ctv.bank_name,
                order_count: ctvData.order_count,
                commission_amount: ctvData.total_commission,
                orders: ctvData.orders
            };
        }).filter(item => item !== null);

        // Calculate summary
        const summary = {
            total_ctv: commissionList.length,
            total_orders: orders.length,
            total_commission: commissionList.reduce((sum, c) => sum + c.commission_amount, 0)
        };

        return jsonResponse({
            success: true,
            month: month,
            commissions: commissionList,
            summary: summary
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting unpaid orders by month:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Pay selected orders
 * POST ?action=paySelectedOrders
 * Body: {
 *   referralCode: "CTV100001",
 *   orderIds: [1, 2, 3],
 *   paymentDate: "2025-11-16",
 *   paymentMethod: "bank_transfer",
 *   note: "Chuyển khoản MB Bank"
 * }
 */
async function paySelectedOrders(data, env, corsHeaders) {
    try {
        const { referralCode, orderIds, paymentDate, paymentMethod, note } = data;

        // Validate input
        if (!referralCode || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return jsonResponse({
                success: false,
                error: 'referralCode and orderIds are required'
            }, 400, corsHeaders);
        }

        // Get CTV info
        const ctv = await env.DB.prepare(`
            SELECT full_name, phone FROM ctv WHERE referral_code = ?
        `).bind(referralCode).first();

        if (!ctv) {
            return jsonResponse({
                success: false,
                error: 'CTV not found'
            }, 404, corsHeaders);
        }

        // Get orders to verify they exist and calculate total
        const placeholders = orderIds.map(() => '?').join(',');
        const { results: orders } = await env.DB.prepare(`
            SELECT id, order_id, commission, referral_code
            FROM orders
            WHERE id IN (${placeholders})
            AND referral_code = ?
        `).bind(...orderIds, referralCode).all();

        if (orders.length !== orderIds.length) {
            return jsonResponse({
                success: false,
                error: 'Some orders not found or do not belong to this CTV'
            }, 400, corsHeaders);
        }

        // Check if any order is already paid
        const { results: alreadyPaid } = await env.DB.prepare(`
            SELECT order_id FROM commission_payment_details
            WHERE order_id IN (${placeholders})
        `).bind(...orderIds).all();

        if (alreadyPaid.length > 0) {
            return jsonResponse({
                success: false,
                error: 'Some orders have already been paid'
            }, 400, corsHeaders);
        }

        // Calculate total commission
        const totalCommission = orders.reduce((sum, order) => sum + (order.commission || 0), 0);

        // Create payment record
        const now = Date.now();
        const paymentDateStr = paymentDate || new Date().toISOString().split('T')[0];
        const paymentDateUnix = new Date(paymentDateStr + 'T00:00:00Z').getTime();
        
        const paymentResult = await env.DB.prepare(`
            INSERT INTO commission_payments (
                referral_code,
                month,
                order_count,
                commission_amount,
                status,
                payment_date_unix,
                payment_method,
                note,
                created_at_unix,
                updated_at_unix
            ) VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
        `).bind(
            referralCode,
            new Date().toISOString().slice(0, 7), // YYYY-MM
            orders.length,
            totalCommission,
            paymentDateUnix,
            paymentMethod || 'bank_transfer',
            note || '',
            now,
            now
        ).run();

        const paymentId = paymentResult.meta.last_row_id;

        // Create payment details for each order
        const detailsTimestamp = Date.now();
        for (const order of orders) {
            await env.DB.prepare(`
                INSERT INTO commission_payment_details (
                    payment_id,
                    order_id,
                    commission_amount,
                    created_at_unix
                ) VALUES (?, ?, ?, ?)
            `).bind(paymentId, order.id, order.commission, detailsTimestamp).run();
        }

        return jsonResponse({
            success: true,
            message: `Đã thanh toán ${orders.length} đơn hàng cho ${ctv.full_name}`,
            payment: {
                payment_id: paymentId,
                referral_code: referralCode,
                ctv_name: ctv.full_name,
                order_count: orders.length,
                total_commission: totalCommission,
                payment_date: paymentDate || new Date().toISOString().split('T')[0],
                payment_method: paymentMethod || 'bank_transfer'
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error paying selected orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}





