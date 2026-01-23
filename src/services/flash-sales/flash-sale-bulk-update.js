import { jsonResponse } from '../../utils/response.js';

/**
 * Update flash sale products in a single transaction
 * This ensures atomicity: delete all old products and add new ones
 * Solves the race condition issue with Turso replication
 */
export async function updateFlashSaleProducts(flashSaleId, products, env, corsHeaders) {
    try {
        // Validate inputs
        if (!flashSaleId) {
            return jsonResponse({
                success: false,
                error: 'flashSaleId is required'
            }, 400, corsHeaders);
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return jsonResponse({
                success: false,
                error: 'products array is required and must not be empty'
            }, 400, corsHeaders);
        }

        console.log(`Updating flash sale ${flashSaleId} with ${products.length} products in transaction`);

        const now = Math.floor(Date.now() / 1000);
        const statements = [];

        // Step 1: Delete all existing products
        statements.push({
            sql: 'DELETE FROM flash_sale_products WHERE flash_sale_id = ?',
            params: [flashSaleId]
        });

        // Step 2: Insert all new products
        for (const productData of products) {
            // Calculate discount percentage
            const flashPrice = productData.flash_price;
            const originalPrice = productData.original_price;
            const discountPercentage = Math.round(((originalPrice - flashPrice) / originalPrice) * 100);

            statements.push({
                sql: `INSERT INTO flash_sale_products (
                    flash_sale_id, product_id,
                    original_price, flash_price, discount_percentage,
                    stock_limit, sold_count, max_per_customer, is_active,
                    created_at_unix, updated_at_unix
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                params: [
                    flashSaleId,
                    productData.product_id,
                    originalPrice,
                    flashPrice,
                    discountPercentage,
                    productData.stock_limit || null,
                    0, // sold_count starts at 0
                    productData.max_per_customer || null,
                    1, // is_active
                    now,
                    now
                ]
            });
        }

        // Execute all statements in a single transaction
        console.log(`Executing ${statements.length} statements in transaction`);
        const results = await env.DB.batch(statements);

        // First result is the DELETE, check how many were deleted
        const deletedCount = results[0].meta.changes || 0;
        const addedCount = results.length - 1; // All except the DELETE

        console.log(`Transaction complete: deleted ${deletedCount}, added ${addedCount}`);

        return jsonResponse({
            success: true,
            deletedCount: deletedCount,
            addedCount: addedCount,
            message: `Đã cập nhật: xóa ${deletedCount} sản phẩm cũ, thêm ${addedCount} sản phẩm mới`
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating flash sale products in transaction:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
