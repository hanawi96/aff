// GET Request Handler - Routes all GET requests to appropriate services

import { jsonResponse } from '../utils/response.js';

// Auth
import { handleVerifySession } from '../auth/index.js';

// CTV
import { 
    getAllCTV, 
    verifyCTVCode, 
    getCollaboratorInfo
} from '../services/ctv/ctv-service.js';

import {
    getCTVOrdersOptimized,
    getCTVOrdersByPhoneOptimized,
    getCTVDashboardOptimized
} from '../services/ctv/ctv-stats.js';

// Orders
import { 
    getOrdersByReferralCode, 
    getOrdersByPhone, 
    getRecentOrders 
} from '../services/orders/order-queries.js';

// Products
import { 
    getAllProducts,
    checkOutdatedProducts, 
    getProduct, 
    searchProducts 
} from '../services/products/product-service.js';

// Categories
import { 
    getAllCategories, 
    getCategory 
} from '../services/products/category-service.js';

// Product Categories
import { getProductCategories } from '../services/products/product-categories.js';

// Address Learning
import { searchLearning, getLearningStats } from '../services/address-learning/address-learning-service.js';

// Materials
import { getAllMaterials, getProductMaterials, getAllMaterialCategories } from '../services/materials/material-service.js';

// Customers
import { 
    getAllCustomers, 
    checkCustomer, 
    getCustomerDetail, 
    searchCustomers 
} from '../services/customers/customer-service.js';

// Export History
import { 
    getExportHistory, 
    downloadExport 
} from '../services/orders/export-service.js';

// Discounts
import { 
    getAllDiscounts, 
    getDiscount 
} from '../services/discounts/discount-service.js';

import { 
    getDiscountUsageHistory, 
    validateDiscount 
} from '../services/discounts/discount-usage.js';

// Settings
import { getPackagingConfig } from '../services/settings/packaging.js';
import { getCurrentTaxRate } from '../services/settings/tax.js';

// Analytics
import {
    getRevenueChart,
    getOrdersChart,
    getProfitReport,
    getDetailedAnalytics,
    getTopProducts,
    getProfitOverview,
    getProductStats,
    getLocationStats,
    getDashboardStats
} from '../services/analytics/index.js';

// Payments
import {
    getCommissionsByMonth,
    getPaidOrdersByMonth,
    getPaymentHistory,
    getUnpaidOrders,
    getUnpaidOrdersByMonth
} from '../services/payments/payment-service.js';

export async function handleGet(action, url, request, env, corsHeaders) {
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

        case 'checkOutdatedProducts':
            return await checkOutdatedProducts(env, corsHeaders);

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
            const topStartDate = url.searchParams.get('startDate');
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
            const statsStartDate = url.searchParams.get('startDate');
            return await getProductStats(statsProductId, statsPeriod, env, corsHeaders, statsStartDate);

        case 'getProfitOverview':
            const overviewPeriod = url.searchParams.get('period') || 'all';
            const overviewStartDate = url.searchParams.get('startDate');
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

        case 'getExportHistory':
            return await getExportHistory(env).then(data => jsonResponse(data, 200, corsHeaders));

        case 'downloadExport':
            const exportId = url.searchParams.get('id');
            const exportData = await downloadExport(exportId, env);
            return new Response(exportData.file, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${exportData.fileName}"`,
                    ...corsHeaders
                }
            });

        // Address Learning
        case 'searchAddressLearning':
            const keywords = url.searchParams.get('keywords')?.split(',').filter(k => k.trim()) || [];
            const learningDistrictId = parseInt(url.searchParams.get('district_id'));
            return await searchLearning(env, keywords, learningDistrictId).then(data => jsonResponse(data, 200, corsHeaders));

        case 'getAddressLearningStats':
            return await getLearningStats(env).then(data => jsonResponse(data, 200, corsHeaders));

        case 'getAllMaterials':
            return await getAllMaterials(env, corsHeaders);

        case 'getAllMaterialCategories':
            return await getAllMaterialCategories(env, corsHeaders);

        case 'getProductMaterials':
            const materialProductId = url.searchParams.get('product_id');
            return await getProductMaterials(materialProductId, env, corsHeaders);

        default:
            return jsonResponse({
                success: false,
                error: 'Unknown action'
            }, 400, corsHeaders);
    }
}

// Temporary stub for migration function
async function migrateOrdersToItems(env, corsHeaders) {
    // TODO: Extract from worker.js (optional - migration function)
    return jsonResponse({ success: false, error: 'Not implemented yet' }, 501, corsHeaders);
}
