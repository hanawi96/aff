// POST Request Handler - Routes all POST requests to appropriate services

import { jsonResponse } from '../utils/response.js';

// Auth
import { handleLogin, handleLogout, handleChangePassword } from '../auth/index.js';

// CTV
import { 
    registerCTV, 
    updateCTV, 
    bulkDeleteCTV 
} from '../services/ctv/ctv-service.js';

import { 
    updateCTVCommission, 
    bulkUpdateCTVCommission 
} from '../services/ctv/commission.js';

// Orders
import { 
    createOrder,
    updateOrderNotes,
    updateCustomerInfo,
    updateAddress,
    updateAmount,
    deleteOrder,
    updateOrderStatus,
    toggleOrderPriority
} from '../services/orders/order-service.js';
import { updateOrderProducts } from '../services/orders/order-items.js';

// Products
import { 
    createProduct, 
    updateProduct, 
    deleteProduct 
} from '../services/products/product-service.js';

// Product Categories
import { 
    addProductCategory, 
    removeProductCategory, 
    setPrimaryCategory, 
    updateProductCategories 
} from '../services/products/product-categories.js';

// Categories
import { 
    createCategory, 
    updateCategory, 
    deleteCategory 
} from '../services/products/category-service.js';

// Discounts
import { 
    createDiscount, 
    updateDiscount, 
    deleteDiscount, 
    toggleDiscountStatus,
    createQuickDiscount,
    bulkExtendDiscounts
} from '../services/discounts/discount-service.js';

import { getDiscountUsageHistory } from '../services/discounts/discount-usage.js';

// Export History
import { 
    saveExport, 
    markExportDownloaded, 
    deleteExport,
    mergeExports
} from '../services/orders/export-service.js';

// Settings
import { getPackagingConfig, updatePackagingConfig } from '../services/settings/packaging.js';
import { updateTaxRate } from '../services/settings/tax.js';

// Analytics
import { getProfitReport } from '../services/analytics/index.js';

// Payments
import {
    calculateCommissions,
    markCommissionAsPaid,
    paySelectedOrders
} from '../services/payments/payment-service.js';

// Upload
import { uploadImage } from '../services/upload/image-upload.js';

// Address Learning
import { learnAddress } from '../services/address-learning/address-learning-service.js';

// Materials
import {
    createMaterial,
    updateMaterial,
    deleteMaterial,
    saveProductMaterials,
    createMaterialCategory,
    updateMaterialCategory,
    deleteMaterialCategory,
    reorderMaterialCategories
} from '../services/materials/material-service.js';

// ============================================
// POST WITH ACTION (Query String)
// ============================================

export async function handlePostWithAction(action, request, env, corsHeaders) {
    // Special handling for uploadImage (multipart form data)
    if (action === 'uploadImage') {
        const formData = await request.formData();
        const file = formData.get('image');
        const filename = formData.get('filename') || file?.name || 'image.jpg';
        
        if (!file) {
            return jsonResponse({
                success: false,
                error: 'No image file provided'
            }, 400, corsHeaders);
        }
        
        const result = await uploadImage(env, file, filename);
        return jsonResponse(result, result.success ? 200 : 500, corsHeaders);
    }
    
    // Read JSON body for other actions
    let data;
    try {
        data = await request.json();
    } catch (error) {
        console.error('Error parsing JSON body:', error);
        return jsonResponse({
            success: false,
            error: 'Invalid JSON body: ' + error.message
        }, 400, corsHeaders);
    }

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
        case 'createQuickDiscount':
            return await createQuickDiscount(data, env, corsHeaders);
        case 'updateDiscount':
            return await updateDiscount(data, env, corsHeaders);
        case 'deleteDiscount':
            return await deleteDiscount(data, env, corsHeaders);
        case 'toggleDiscountStatus':
            return await toggleDiscountStatus(data, env, corsHeaders);
        case 'bulkExtendDiscounts':
            return await bulkExtendDiscounts(data, env, corsHeaders);
        case 'getDiscountUsageHistory':
            return await getDiscountUsageHistory(env, corsHeaders);
        case 'saveExport':
            return await saveExport(data, env).then(result => jsonResponse(result, 200, corsHeaders));
        case 'markExportDownloaded':
            return await markExportDownloaded(data.exportId, env).then(result => jsonResponse(result, 200, corsHeaders));
        case 'deleteExport':
            return await deleteExport(data.exportId, env).then(result => jsonResponse(result, 200, corsHeaders));
        case 'mergeExports':
            return await mergeExports(data.exportIds, env).then(result => jsonResponse(result, 200, corsHeaders));
        default:
            return jsonResponse({
                success: false,
                error: 'Unknown action: ' + action
            }, 400, corsHeaders);
    }
}

// ============================================
// POST WITH PATH OR ACTION IN BODY
// ============================================

export async function handlePost(path, request, env, corsHeaders) {
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
                    // Discount data (support both camelCase and snake_case)
                    discountCode: data.discountCode || data.discount_code || null,
                    discountAmount: data.discountAmount || data.discount_amount || 0,
                    discountId: data.discountId || data.discount_id || null,
                    // Address 4 levels
                    province_id: data.province_id,
                    province_name: data.province_name,
                    district_id: data.district_id,
                    district_name: data.district_name,
                    ward_id: data.ward_id,
                    ward_name: data.ward_name,
                    street_address: data.street_address,
                    // Priority
                    is_priority: data.is_priority || 0
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
            case 'toggleOrderPriority':
                return await toggleOrderPriority(data, env, corsHeaders);
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
            case 'createQuickDiscount':
                return await createQuickDiscount(data, env, corsHeaders);
            case 'updateDiscount':
                return await updateDiscount(data, env, corsHeaders);
            case 'deleteDiscount':
                return await deleteDiscount(data, env, corsHeaders);
            case 'toggleDiscountStatus':
                return await toggleDiscountStatus(data, env, corsHeaders);
            case 'bulkExtendDiscounts':
                return await bulkExtendDiscounts(data, env, corsHeaders);
            case 'getDiscountUsageHistory':
                return await getDiscountUsageHistory(env, corsHeaders);
            case 'updatePackagingConfig':
                return await updatePackagingConfig(data, env, corsHeaders);
            case 'updateTaxRate':
                return await updateTaxRate(data, env, corsHeaders);
            case 'getProfitReport':
                return await getProfitReport(data, env, corsHeaders);
            case 'learnAddress':
                return await learnAddress(env, data.street_address, data.district_id, data.ward_id, data.ward_name)
                    .then(result => jsonResponse(result, 200, corsHeaders));
            case 'createMaterial':
                return await createMaterial(data, env, corsHeaders);
            case 'updateMaterial':
                return await updateMaterial(data, env, corsHeaders);
            case 'deleteMaterial':
                return await deleteMaterial(data, env, corsHeaders);
            case 'saveProductMaterials':
                return await saveProductMaterials(data, env, corsHeaders);
            case 'createMaterialCategory':
                return await createMaterialCategory(data, env, corsHeaders);
            case 'updateMaterialCategory':
                return await updateMaterialCategory(data, env, corsHeaders);
            case 'deleteMaterialCategory':
                return await deleteMaterialCategory(data, env, corsHeaders);
            case 'reorderMaterialCategories':
                return await reorderMaterialCategories(data, env, corsHeaders);
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
