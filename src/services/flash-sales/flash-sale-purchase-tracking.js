import { jsonResponse } from '../../utils/response.js';

/**
 * Check if customer can purchase flash sale product
 * Validates stock limit and per-customer limit
 */
export async function canPurchaseFlashSaleProduct(flashSaleProductId, customerPhone, requestedQuantity, env, corsHeaders) {
    try {
        // 1. Get flash sale product info
        const product = await env.DB.prepare(`
            SELECT 
                fsp.*,
                fs.status,
                fs.start_time,
                fs.end_time,
                fs.name as flash_sale_name
            FROM flash_sale_products fsp
            INNER JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
            WHERE fsp.id = ? AND fsp.is_active = 1
        `).bind(flashSaleProductId).first();
        
        if (!product) {
            return jsonResponse({
                success: false,
                allowed: false,
                reason: 'Sản phẩm không tồn tại hoặc không hoạt động'
            }, 404, corsHeaders);
        }
        
        // 2. Check flash sale is active
        const now = Math.floor(Date.now() / 1000);
        if (product.status !== 'active' || product.start_time > now || product.end_time <= now) {
            return jsonResponse({
                success: false,
                allowed: false,
                reason: 'Flash sale không còn hoạt động'
            }, 400, corsHeaders);
        }
        
        // 3. Check total stock limit
        if (product.stock_limit !== null) {
            const remaining = product.stock_limit - product.sold_count;
            if (remaining < requestedQuantity) {
                return jsonResponse({
                    success: false,
                    allowed: false,
                    reason: remaining > 0 
                        ? `Chỉ còn ${remaining} sản phẩm` 
                        : 'Sản phẩm đã hết',
                    remaining: remaining
                }, 400, corsHeaders);
            }
        }
        
        // 4. Check per-customer limit
        if (product.max_per_customer !== null) {
            // Get customer's total purchased quantity
            const purchased = await env.DB.prepare(`
                SELECT COALESCE(SUM(quantity), 0) as total_purchased
                FROM flash_sale_purchases
                WHERE flash_sale_product_id = ? 
                    AND customer_phone = ?
            `).bind(flashSaleProductId, customerPhone).first();
            
            const totalAfterPurchase = purchased.total_purchased + requestedQuantity;
            
            if (totalAfterPurchase > product.max_per_customer) {
                const canBuy = product.max_per_customer - purchased.total_purchased;
                return jsonResponse({
                    success: false,
                    allowed: false,
                    reason: `Mỗi khách hàng chỉ được mua tối đa ${product.max_per_customer} sản phẩm`,
                    alreadyPurchased: purchased.total_purchased,
                    canStillBuy: Math.max(0, canBuy),
                    maxPerCustomer: product.max_per_customer
                }, 400, corsHeaders);
            }
        }
        
        // 5. All checks passed
        return jsonResponse({
            success: true,
            allowed: true,
            product: {
                id: product.id,
                flash_sale_id: product.flash_sale_id,
                flash_sale_name: product.flash_sale_name,
                product_id: product.product_id,
                flash_price: product.flash_price,
                original_price: product.original_price,
                stock_limit: product.stock_limit,
                sold_count: product.sold_count,
                max_per_customer: product.max_per_customer,
                remaining: product.stock_limit !== null 
                    ? product.stock_limit - product.sold_count 
                    : null
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error checking purchase eligibility:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Record flash sale purchase
 * Called when order is created/confirmed
 * IMPORTANT: This should be called AFTER payment confirmation, not before
 */
export async function recordFlashSalePurchase(data, env, corsHeaders) {
    try {
        const {
            flashSaleId,
            flashSaleProductId,
            orderId,
            customerPhone,
            customerName,
            quantity,
            flashPrice
        } = data;
        
        // Validate required fields
        if (!flashSaleId || !flashSaleProductId || !orderId || !customerPhone || !quantity || !flashPrice) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin bắt buộc'
            }, 400, corsHeaders);
        }
        
        // CRITICAL: Re-check eligibility to prevent race conditions
        // This ensures stock/customer limits are still valid at purchase time
        const eligibility = await canPurchaseFlashSaleProduct(
            flashSaleProductId, 
            customerPhone, 
            quantity, 
            env, 
            corsHeaders
        );
        
        const eligibilityData = await eligibility.json();
        
        if (!eligibilityData.allowed) {
            return jsonResponse({
                success: false,
                error: eligibilityData.reason || 'Không thể mua sản phẩm này',
                reason: eligibilityData.reason
            }, 400, corsHeaders);
        }
        
        const now = Math.floor(Date.now() / 1000);
        const totalAmount = flashPrice * quantity;
        
        // Insert purchase record
        const result = await env.DB.prepare(`
            INSERT INTO flash_sale_purchases (
                flash_sale_id,
                flash_sale_product_id,
                order_id,
                customer_phone,
                customer_name,
                quantity,
                flash_price,
                total_amount,
                purchased_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            flashSaleId,
            flashSaleProductId,
            orderId,
            customerPhone,
            customerName || '',
            quantity,
            flashPrice,
            totalAmount,
            now
        ).run();
        
        // Update sold_count
        await env.DB.prepare(`
            UPDATE flash_sale_products 
            SET sold_count = sold_count + ?,
                updated_at_unix = ?
            WHERE id = ?
        `).bind(quantity, now, flashSaleProductId).run();
        
        return jsonResponse({
            success: true,
            purchaseId: result.meta.last_row_id,
            message: 'Ghi nhận mua hàng thành công'
        }, 201, corsHeaders);
        
    } catch (error) {
        console.error('Error recording purchase:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get customer's flash sale purchase history
 */
export async function getCustomerFlashSalePurchases(customerPhone, flashSaleId, env, corsHeaders) {
    try {
        let query = `
            SELECT 
                fsp.*,
                fs.name as flash_sale_name,
                fs.start_time,
                fs.end_time,
                fsp_info.product_id,
                p.name as product_name,
                p.image_url
            FROM flash_sale_purchases fsp
            INNER JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
            INNER JOIN flash_sale_products fsp_info ON fsp.flash_sale_product_id = fsp_info.id
            LEFT JOIN products p ON fsp_info.product_id = p.id
            WHERE fsp.customer_phone = ?
        `;
        
        const params = [customerPhone];
        
        if (flashSaleId) {
            query += ` AND fsp.flash_sale_id = ?`;
            params.push(flashSaleId);
        }
        
        query += ` ORDER BY fsp.purchased_at_unix DESC`;
        
        const { results: purchases } = await env.DB.prepare(query).bind(...params).all();
        
        return jsonResponse({
            success: true,
            purchases: purchases,
            total: purchases.length
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting customer purchases:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get flash sale purchase statistics
 */
export async function getFlashSalePurchaseStats(flashSaleId, env, corsHeaders) {
    try {
        const stats = await env.DB.prepare(`
            SELECT 
                COUNT(DISTINCT fsp.customer_phone) as unique_customers,
                COUNT(fsp.id) as total_orders,
                SUM(fsp.quantity) as total_quantity_sold,
                SUM(fsp.total_amount) as total_revenue,
                AVG(fsp.quantity) as avg_quantity_per_order,
                MIN(fsp.purchased_at_unix) as first_purchase,
                MAX(fsp.purchased_at_unix) as last_purchase
            FROM flash_sale_purchases fsp
            WHERE fsp.flash_sale_id = ?
        `).bind(flashSaleId).first();
        
        // Get top customers
        const { results: topCustomers } = await env.DB.prepare(`
            SELECT 
                customer_phone,
                customer_name,
                COUNT(*) as order_count,
                SUM(quantity) as total_quantity,
                SUM(total_amount) as total_spent
            FROM flash_sale_purchases
            WHERE flash_sale_id = ?
            GROUP BY customer_phone
            ORDER BY total_spent DESC
            LIMIT 10
        `).bind(flashSaleId).all();
        
        return jsonResponse({
            success: true,
            stats: stats,
            topCustomers: topCustomers
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting purchase stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Cancel/Refund flash sale purchase
 * Called when order is cancelled
 */
export async function cancelFlashSalePurchase(orderId, env, corsHeaders) {
    try {
        // Get purchase record
        const purchase = await env.DB.prepare(`
            SELECT * FROM flash_sale_purchases WHERE order_id = ?
        `).bind(orderId).first();
        
        if (!purchase) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy giao dịch'
            }, 404, corsHeaders);
        }
        
        const now = Math.floor(Date.now() / 1000);
        
        // Decrease sold_count (with safety check to prevent negative)
        await env.DB.prepare(`
            UPDATE flash_sale_products 
            SET sold_count = MAX(0, sold_count - ?),
                updated_at_unix = ?
            WHERE id = ?
        `).bind(purchase.quantity, now, purchase.flash_sale_product_id).run();
        
        // Delete purchase record
        await env.DB.prepare(`
            DELETE FROM flash_sale_purchases WHERE id = ?
        `).bind(purchase.id).run();
        
        return jsonResponse({
            success: true,
            message: 'Hủy giao dịch thành công'
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error cancelling purchase:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
