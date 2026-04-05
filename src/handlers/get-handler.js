// GET Request Handler - Routes all GET requests to appropriate services

import { jsonResponse } from '../utils/response.js';

// Auth
import { handleVerifySession } from '../auth/index.js';
import { handleGetAllUsers } from '../auth/user-management.js';

// CTV
import { 
    getAllCTV, 
    verifyCTVCode, 
    validateReferralCode,
    getCollaboratorInfo
} from '../services/ctv/ctv-service.js';

import {
    getCTVOrdersOptimized,
    getCTVOrdersByPhoneOptimized,
    getCTVOrdersByOrderIdOptimized,
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
    getProductsPage,
    checkOutdatedProducts, 
    getOutdatedProductsDetails,
    getProduct, 
    searchProducts 
} from '../services/products/product-service.js';

// Categories
import { 
    getAllCategories, 
    getAllCategoriesAdmin,
    getCategory 
} from '../services/products/category-service.js';

// Product Categories
import { getProductCategories } from '../services/products/product-categories.js';

// Address Learning
import { searchLearning, getLearningStats } from '../services/address-learning/address-learning-service.js';

// Featured Products
import {
    getFeaturedProducts,
    getFeaturedProductsForAdmin,
    getFeaturedStats,
    clearFeaturedCache
} from '../services/featured/featured-service.js';

// Materials
import { getAllMaterials, getProductMaterials, getAllMaterialCategories } from '../services/materials/material-service.js';

// Settings
import { getShippingFee } from '../services/settings/shipping.js';

// Customers
import { 
    getAllCustomers, 
    checkCustomer, 
    getCustomerDetail, 
    searchCustomers,
    getCustomerNote,
    getCustomerNotesBatch
} from '../services/customers/customer-service.js';

// Export History
import { 
    getExportHistory, 
    downloadExport 
} from '../services/orders/export-service.js';

// Discounts
import { 
    getAllDiscounts, 
    getDiscount,
    getActiveDiscounts
} from '../services/discounts/discount-service.js';

import { 
    getDiscountUsageHistory, 
    validateDiscount 
} from '../services/discounts/discount-usage.js';

// Flash Sales
import {
    getAllFlashSales,
    getFlashSale,
    getActiveFlashSales
} from '../services/flash-sales/flash-sale-service.js';

import {
    getFlashSaleProducts,
    checkProductInFlashSale,
    getFlashSaleStats
} from '../services/flash-sales/flash-sale-products.js';

// Flash Sale Purchase Tracking
import {
    canPurchaseFlashSaleProduct,
    getCustomerFlashSalePurchases,
    getFlashSalePurchaseStats
} from '../services/flash-sales/flash-sale-purchase-tracking.js';

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
    getUnpaidOrdersByMonth,
    getExcludedCommissions,
    getCTVRanking,
    getCTVTargets
} from '../services/payments/payment-service.js';

export async function handleGet(action, url, request, env, corsHeaders) {
    console.log('📥 [GET] Handling GET request with action:', action);
    
    switch (action) {
        case 'verifySession':
            console.log('🔐 [GET] Routing to verifySession handler...');
            return await handleVerifySession(request, env, corsHeaders);

        case 'getAllUsers':
            return await handleGetAllUsers(request, env, corsHeaders);

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

        case 'getCTVOrdersByOrderId': {
            const oid = url.searchParams.get('orderId');
            return await getCTVOrdersByOrderIdOptimized(oid, env, corsHeaders);
        }

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

        case 'validateReferral':
            const refCode = url.searchParams.get('ref');
            return await validateReferralCode(refCode, env, corsHeaders);

        case 'getAllProducts':
            return await getAllProducts(env, corsHeaders);

        case 'getProductsPage': {
            const page = parseInt(url.searchParams.get('page') || '1', 10);
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '16', 10), 100);
            return await getProductsPage(env, corsHeaders, page, limit);
        }

        case 'getR2Image': {
            const objectKey = url.searchParams.get('key');
            if (!objectKey) {
                return jsonResponse({ success: false, error: 'Missing key parameter' }, 400, corsHeaders);
            }

            try {
                const decodedKey = decodeURIComponent(objectKey);
                const object = await env.R2_BUCKET.get(decodedKey);

                if (!object) {
                    return jsonResponse({ success: false, error: 'Image not found' }, 404, corsHeaders);
                }

                const headers = new Headers(corsHeaders);
                headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
                headers.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=31536000');
                headers.set('ETag', object.httpEtag);

                return new Response(object.body, {
                    status: 200,
                    headers
                });
            } catch (error) {
                console.error('❌ [GET] Failed to read R2 image:', error);
                return jsonResponse({
                    success: false,
                    error: 'Failed to fetch image'
                }, 500, corsHeaders);
            }
        }

        case 'getProductsByNames':
            // Get products by names for duplicate order
            const names = url.searchParams.get('names');
            if (!names) {
                return jsonResponse({ success: false, error: 'Missing names parameter' }, 400, corsHeaders);
            }
            try {
                const namesList = JSON.parse(names);
                if (!Array.isArray(namesList) || namesList.length === 0) {
                    return jsonResponse({ success: false, error: 'Invalid names array' }, 400, corsHeaders);
                }
                
                const placeholders = namesList.map(() => '?').join(',');
                const { results: products } = await env.DB.prepare(`
                    SELECT id, name, price, cost_price 
                    FROM products 
                    WHERE name IN (${placeholders})
                `).bind(...namesList).all();
                
                return jsonResponse({ success: true, products }, 200, corsHeaders);
            } catch (e) {
                return jsonResponse({ success: false, error: 'Invalid JSON' }, 400, corsHeaders);
            }

        case 'getOrderItems':
            // Get order items to preserve product_id when editing
            const orderIdParam = url.searchParams.get('orderId');
            if (!orderIdParam) {
                return jsonResponse({ success: false, error: 'Missing orderId parameter' }, 400, corsHeaders);
            }
            try {
                const { results: items } = await env.DB.prepare(`
                    SELECT product_id, product_name, product_price, product_cost, quantity, size, notes
                    FROM order_items
                    WHERE order_id = ?
                    ORDER BY id ASC
                `).bind(parseInt(orderIdParam)).all();
                
                return jsonResponse({ success: true, items }, 200, corsHeaders);
            } catch (e) {
                return jsonResponse({ success: false, error: e.message }, 500, corsHeaders);
            }

        case 'getFeaturedProducts':
            return await getFeaturedProducts(env, corsHeaders);

        case 'getFeaturedProductsForAdmin':
            return await getFeaturedProductsForAdmin(env, corsHeaders);

        case 'getFeaturedStats':
            return await getFeaturedStats(env, corsHeaders);

        case 'clearFeaturedCache':
            return await clearFeaturedCache(env, corsHeaders);

        case 'checkOutdatedProducts':
            return await checkOutdatedProducts(env, corsHeaders);

        case 'getOutdatedProductsDetails':
            return await getOutdatedProductsDetails(env, corsHeaders);

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
        
        case 'getAllCategoriesAdmin':
            return await getAllCategoriesAdmin(env, corsHeaders);

        case 'getCategory':
            const categoryId = url.searchParams.get('id');
            return await getCategory(categoryId, env, corsHeaders);

        case 'getAllCustomers':
            return await getAllCustomers(env, corsHeaders);

        case 'getAllDiscounts':
            return await getAllDiscounts(env, corsHeaders);

        case 'getActiveDiscounts':
            return await getActiveDiscounts(env, corsHeaders);

        case 'getShippingFee':
            return await getShippingFee(env, corsHeaders);

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

        case 'getCustomerNote':
            const notePhone = url.searchParams.get('phone');
            return await getCustomerNote(notePhone, env, corsHeaders);

        case 'getCustomerNotesBatch':
            const notePhonesParam = url.searchParams.get('phones');
            if (notePhonesParam) {
                const notePhones = JSON.parse(notePhonesParam);
                return await getCustomerNotesBatch(notePhones, env, corsHeaders);
            }
            return await getCustomerNotesBatch([], env, corsHeaders);

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
            const analyticsStartDate = url.searchParams.get('startDate');
            const analyticsEndDate = url.searchParams.get('endDate');
            return await getDetailedAnalytics({ period: analyticsPeriod, startDate: analyticsStartDate, endDate: analyticsEndDate }, env, corsHeaders);

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

        case 'getPaidOrdersByMonth': {
            const paidMonth = url.searchParams.get('month');
            const allPaid = url.searchParams.get('allPaid') === '1';
            const ps = url.searchParams.get('paymentStartMs');
            const pe = url.searchParams.get('paymentEndMs');
            const paymentStartMs = ps !== null && ps !== '' ? parseInt(ps, 10) : null;
            const paymentEndMs = pe !== null && pe !== '' ? parseInt(pe, 10) : null;
            return await getPaidOrdersByMonth(paidMonth, env, corsHeaders, {
                allPaid,
                paymentStartMs: Number.isFinite(paymentStartMs) ? paymentStartMs : null,
                paymentEndMs: Number.isFinite(paymentEndMs) ? paymentEndMs : null
            });
        }

        case 'getLocationStats':
            const level = url.searchParams.get('level') || 'province';
            const provinceId = url.searchParams.get('provinceId');
            const districtId = url.searchParams.get('districtId');
            const locationPeriod = url.searchParams.get('period') || 'all';
            const locationStartDate = url.searchParams.get('startDate');
            const locationEndDate = url.searchParams.get('endDate');
            const previousStartDate = url.searchParams.get('previousStartDate');
            const previousEndDate = url.searchParams.get('previousEndDate');
            return await getLocationStats({ 
                level, 
                provinceId, 
                districtId, 
                period: locationPeriod, 
                startDate: locationStartDate,
                endDate: locationEndDate,
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

        case 'getExcludedCommissions': {
            const excludedMonth = url.searchParams.get('month');
            const excludedReferralCode = url.searchParams.get('referralCode') || null;
            const excludedStatus = url.searchParams.get('status') || 'excluded';
            const exStart = url.searchParams.get('startDate');
            const exEnd = url.searchParams.get('endDate');
            const rangeDates = exStart && exEnd ? { startDate: exStart, endDate: exEnd } : null;
            return await getExcludedCommissions(
                excludedMonth,
                excludedReferralCode,
                excludedStatus,
                env,
                corsHeaders,
                rangeDates
            );
        }

        case 'getCTVRanking': {
            const rankingMonth = url.searchParams.get('month');
            return await getCTVRanking(rankingMonth, env, corsHeaders);
        }

        case 'getCTVTargets': {
            const targetMonth = url.searchParams.get('month');
            return await getCTVTargets(targetMonth, env, corsHeaders);
        }

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

        // Flash Sales
        case 'getAllFlashSales':
            return await getAllFlashSales(env, corsHeaders);

        case 'getFlashSale':
            const flashSaleId = url.searchParams.get('id');
            return await getFlashSale(flashSaleId, env, corsHeaders);

        case 'getActiveFlashSales':
            return await getActiveFlashSales(env, corsHeaders);

        case 'getFlashSaleProducts':
            const fsId = url.searchParams.get('flashSaleId');
            return await getFlashSaleProducts(fsId, env, corsHeaders);

        case 'checkProductInFlashSale':
            const checkProductId = url.searchParams.get('productId');
            return await checkProductInFlashSale(checkProductId, env, corsHeaders);

        case 'getFlashSaleStats':
            const statsFlashSaleId = url.searchParams.get('flashSaleId');
            return await getFlashSaleStats(statsFlashSaleId, env, corsHeaders);

        // Flash Sale Purchase Tracking
        case 'canPurchaseFlashSaleProduct':
            const canPurchaseProductId = url.searchParams.get('flashSaleProductId');
            const canPurchasePhone = url.searchParams.get('customerPhone');
            const canPurchaseQty = parseInt(url.searchParams.get('quantity') || '1');
            return await canPurchaseFlashSaleProduct(canPurchaseProductId, canPurchasePhone, canPurchaseQty, env, corsHeaders);

        case 'getCustomerFlashSalePurchases':
            const flashSaleCustomerPhone = url.searchParams.get('customerPhone');
            const filterFlashSaleId = url.searchParams.get('flashSaleId');
            return await getCustomerFlashSalePurchases(flashSaleCustomerPhone, filterFlashSaleId, env, corsHeaders);

        case 'getFlashSalePurchaseStats':
            const purchaseStatsFlashSaleId = url.searchParams.get('flashSaleId');
            return await getFlashSalePurchaseStats(purchaseStatsFlashSaleId, env, corsHeaders);

        default:
            return jsonResponse({
                success: false,
                error: action
                    ? `Unknown action: ${action}`
                    : 'Missing action parameter (add ?action=... to the request)'
            }, 400, corsHeaders);
    }
}

// Temporary stub for migration function
async function migrateOrdersToItems(env, corsHeaders) {
    // TODO: Extract from worker.js (optional - migration function)
    return jsonResponse({ success: false, error: 'Not implemented yet' }, 501, corsHeaders);
}
