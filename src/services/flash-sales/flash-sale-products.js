import { jsonResponse } from '../../utils/response.js';

// Get all products in a flash sale
export async function getFlashSaleProducts(flashSaleId, env, corsHeaders) {
    try {
        const { results: products } = await env.DB.prepare(`
            SELECT 
                fsp.*,
                p.name as product_name,
                p.image_url,
                p.sku,
                p.category_id
            FROM flash_sale_products fsp
            INNER JOIN products p ON fsp.product_id = p.id
            WHERE fsp.flash_sale_id = ?
            ORDER BY fsp.created_at_unix DESC
        `).bind(flashSaleId).all();

        // Get ALL product-category relationships in ONE query (optimized)
        const productIds = products.map(p => p.product_id);
        
        if (productIds.length > 0) {
            const placeholders = productIds.map(() => '?').join(',');
            const { results: allProductCategories } = await env.DB.prepare(`
                SELECT 
                    pc.product_id,
                    c.id,
                    c.name as category_name
                FROM product_categories pc
                INNER JOIN categories c ON pc.category_id = c.id
                WHERE pc.product_id IN (${placeholders})
                ORDER BY pc.product_id, pc.is_primary DESC, pc.display_order ASC
            `).bind(...productIds).all();
            
            // Group categories by product_id
            const categoriesByProduct = {};
            for (let pc of allProductCategories) {
                if (!categoriesByProduct[pc.product_id]) {
                    categoriesByProduct[pc.product_id] = [];
                }
                categoriesByProduct[pc.product_id].push({
                    id: pc.id,
                    name: pc.category_name
                });
            }
            
            // Assign categories to products
            for (let product of products) {
                product.categories = categoriesByProduct[product.product_id] || [];
            }
        } else {
            // No products, set empty categories
            for (let product of products) {
                product.categories = [];
            }
        }

        return jsonResponse({
            success: true,
            products: products
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting flash sale products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Add product to flash sale
export async function addProductToFlashSale(flashSaleId, data, env, corsHeaders) {
    try {
        // Validate flash sale exists
        const flashSale = await env.DB.prepare(`
            SELECT id, status FROM flash_sales WHERE id = ?
        `).bind(flashSaleId).first();

        if (!flashSale) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy flash sale'
            }, 404, corsHeaders);
        }

        // Validate product exists
        const product = await env.DB.prepare(`
            SELECT id, price FROM products WHERE id = ?
        `).bind(data.product_id).first();

        if (!product) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy sản phẩm'
            }, 404, corsHeaders);
        }

        // Check if product already in flash sale
        const existing = await env.DB.prepare(`
            SELECT id FROM flash_sale_products 
            WHERE flash_sale_id = ? AND product_id = ?
        `).bind(flashSaleId, data.product_id).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Sản phẩm đã có trong flash sale'
            }, 400, corsHeaders);
        }

        // Validate pricing
        const flashPrice = data.flash_price;
        const originalPrice = data.original_price || product.price;

        if (flashPrice >= originalPrice) {
            return jsonResponse({
                success: false,
                error: 'Giá flash sale phải nhỏ hơn giá gốc'
            }, 400, corsHeaders);
        }

        if (flashPrice < 0) {
            return jsonResponse({
                success: false,
                error: 'Giá flash sale không hợp lệ'
            }, 400, corsHeaders);
        }

        // Calculate discount percentage
        const discountPercentage = Math.round(((originalPrice - flashPrice) / originalPrice) * 100);

        const now = Math.floor(Date.now() / 1000);

        const result = await env.DB.prepare(`
            INSERT INTO flash_sale_products (
                flash_sale_id, product_id,
                original_price, flash_price, discount_percentage,
                stock_limit, sold_count, max_per_customer, is_active,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            flashSaleId,
            data.product_id,
            originalPrice,
            flashPrice,
            discountPercentage,
            data.stock_limit || null,
            0,
            data.max_per_customer || null,
            data.is_active !== undefined ? data.is_active : 1,
            now,
            now
        ).run();

        return jsonResponse({
            success: true,
            productId: result.meta.last_row_id,
            message: 'Thêm sản phẩm vào flash sale thành công'
        }, 201, corsHeaders);
    } catch (error) {
        console.error('Error adding product to flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Add multiple products to flash sale
export async function addMultipleProductsToFlashSale(flashSaleId, products, env, corsHeaders) {
    try {
        // Validate flash sale exists
        const flashSale = await env.DB.prepare(`
            SELECT id, status FROM flash_sales WHERE id = ?
        `).bind(flashSaleId).first();

        if (!flashSale) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy flash sale'
            }, 404, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);
        const results = [];
        const errors = [];

        for (const productData of products) {
            try {
                // Validate product exists
                const product = await env.DB.prepare(`
                    SELECT id, name, price FROM products WHERE id = ?
                `).bind(productData.product_id).first();

                if (!product) {
                    errors.push({ product_id: productData.product_id, error: 'Không tìm thấy sản phẩm' });
                    continue;
                }

                // Check if already exists
                const existing = await env.DB.prepare(`
                    SELECT id FROM flash_sale_products 
                    WHERE flash_sale_id = ? AND product_id = ?
                `).bind(flashSaleId, productData.product_id).first();

                if (existing) {
                    console.log(`Product ${productData.product_id} already exists in flash sale ${flashSaleId}`);
                    errors.push({ product_id: productData.product_id, error: 'Sản phẩm đã có trong flash sale' });
                    continue;
                }

                // Validate pricing
                const flashPrice = productData.flash_price;
                const originalPrice = productData.original_price || product.price;

                if (flashPrice >= originalPrice) {
                    errors.push({ product_id: productData.product_id, error: 'Giá flash sale phải nhỏ hơn giá gốc' });
                    continue;
                }

                // Calculate discount percentage
                const discountPercentage = Math.round(((originalPrice - flashPrice) / originalPrice) * 100);

                const result = await env.DB.prepare(`
                    INSERT INTO flash_sale_products (
                        flash_sale_id, product_id,
                        original_price, flash_price, discount_percentage,
                        stock_limit, sold_count, max_per_customer, is_active,
                        created_at_unix, updated_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    flashSaleId,
                    productData.product_id,
                    originalPrice,
                    flashPrice,
                    discountPercentage,
                    productData.stock_limit || null,
                    0,
                    productData.max_per_customer || null,
                    1,
                    now,
                    now
                ).run();

                results.push({
                    product_id: productData.product_id,
                    product_name: product.name,
                    id: result.meta.last_row_id
                });
            } catch (err) {
                errors.push({ product_id: productData.product_id, error: err.message });
            }
        }

        return jsonResponse({
            success: true,
            added: results.length,
            failed: errors.length,
            results: results,
            errors: errors,
            message: `Đã thêm ${results.length} sản phẩm, ${errors.length} lỗi`
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error adding multiple products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update flash sale product
export async function updateFlashSaleProduct(id, data, env, corsHeaders) {
    try {
        const existing = await env.DB.prepare(`
            SELECT * FROM flash_sale_products WHERE id = ?
        `).bind(id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy sản phẩm trong flash sale'
            }, 404, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);
        const updates = [];
        const values = [];

        // Determine final prices for validation
        const finalOriginalPrice = data.original_price !== undefined ? data.original_price : existing.original_price;
        const finalFlashPrice = data.flash_price !== undefined ? data.flash_price : existing.flash_price;

        // Validate pricing
        if (finalFlashPrice >= finalOriginalPrice) {
            return jsonResponse({
                success: false,
                error: 'Giá flash sale phải nhỏ hơn giá gốc'
            }, 400, corsHeaders);
        }

        if (data.original_price !== undefined) {
            updates.push('original_price = ?');
            values.push(data.original_price);
        }
        
        if (data.flash_price !== undefined) {
            updates.push('flash_price = ?');
            values.push(data.flash_price);
        }

        // Recalculate discount percentage if either price changed
        if (data.original_price !== undefined || data.flash_price !== undefined) {
            const discountPercentage = Math.round(((finalOriginalPrice - finalFlashPrice) / finalOriginalPrice) * 100);
            updates.push('discount_percentage = ?');
            values.push(discountPercentage);
        }

        if (data.stock_limit !== undefined) {
            updates.push('stock_limit = ?');
            values.push(data.stock_limit);
        }
        if (data.max_per_customer !== undefined) {
            updates.push('max_per_customer = ?');
            values.push(data.max_per_customer);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(data.is_active);
        }

        if (updates.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Không có dữ liệu để cập nhật'
            }, 400, corsHeaders);
        }

        updates.push('updated_at_unix = ?');
        values.push(now);
        values.push(id);

        await env.DB.prepare(`
            UPDATE flash_sale_products 
            SET ${updates.join(', ')}
            WHERE id = ?
        `).bind(...values).run();

        return jsonResponse({
            success: true,
            message: 'Cập nhật sản phẩm thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating flash sale product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Remove product from flash sale
export async function removeProductFromFlashSale(id, env, corsHeaders) {
    try {
        const existing = await env.DB.prepare(`
            SELECT id FROM flash_sale_products WHERE id = ?
        `).bind(id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy sản phẩm trong flash sale'
            }, 404, corsHeaders);
        }

        await env.DB.prepare(`
            DELETE FROM flash_sale_products WHERE id = ?
        `).bind(id).run();

        return jsonResponse({
            success: true,
            message: 'Xóa sản phẩm khỏi flash sale thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error removing product from flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Remove ALL products from flash sale (for bulk update)
export async function removeAllProductsFromFlashSale(flashSaleId, env, corsHeaders) {
    try {
        // Validate flashSaleId
        if (!flashSaleId) {
            return jsonResponse({
                success: false,
                error: 'flashSaleId is required'
            }, 400, corsHeaders);
        }
        
        console.log('Removing all products from flash sale:', flashSaleId);
        
        const result = await env.DB.prepare(`
            DELETE FROM flash_sale_products WHERE flash_sale_id = ?
        `).bind(flashSaleId).run();

        console.log('Delete result:', result.meta);

        return jsonResponse({
            success: true,
            deletedCount: result.meta.changes || 0,
            message: `Đã xóa ${result.meta.changes || 0} sản phẩm khỏi flash sale`
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error removing all products from flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Check if product is in active flash sale
export async function checkProductInFlashSale(productId, env, corsHeaders) {
    try {
        const now = Math.floor(Date.now() / 1000);
        
        const flashSaleProduct = await env.DB.prepare(`
            SELECT 
                fsp.*,
                fs.name as flash_sale_name,
                fs.end_time
            FROM flash_sale_products fsp
            INNER JOIN flash_sales fs ON fsp.flash_sale_id = fs.id
            WHERE fsp.product_id = ?
                AND fsp.is_active = 1
                AND fs.status = 'active'
                AND fs.start_time <= ?
                AND fs.end_time > ?
                AND (fsp.stock_limit IS NULL OR fsp.sold_count < fsp.stock_limit)
            ORDER BY fsp.flash_price ASC
            LIMIT 1
        `).bind(productId, now, now).first();

        return jsonResponse({
            success: true,
            inFlashSale: !!flashSaleProduct,
            flashSaleProduct: flashSaleProduct || null
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error checking product in flash sale:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Increment sold count when product is purchased
export async function incrementSoldCount(flashSaleProductId, quantity, env) {
    try {
        await env.DB.prepare(`
            UPDATE flash_sale_products 
            SET sold_count = sold_count + ?
            WHERE id = ?
        `).bind(quantity, flashSaleProductId).run();

        return { success: true };
    } catch (error) {
        console.error('Error incrementing sold count:', error);
        return { success: false, error: error.message };
    }
}

// Get flash sale statistics
export async function getFlashSaleStats(flashSaleId, env, corsHeaders) {
    try {
        const stats = await env.DB.prepare(`
            SELECT 
                COUNT(fsp.id) as total_products,
                SUM(fsp.sold_count) as total_sold,
                SUM(fsp.sold_count * fsp.flash_price) as total_revenue,
                SUM(fsp.sold_count * (fsp.original_price - fsp.flash_price)) as total_discount_given,
                AVG(fsp.discount_percentage) as avg_discount_percentage
            FROM flash_sale_products fsp
            WHERE fsp.flash_sale_id = ? AND fsp.is_active = 1
        `).bind(flashSaleId).first();

        return jsonResponse({
            success: true,
            stats: stats
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting flash sale stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
