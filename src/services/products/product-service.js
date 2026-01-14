import { jsonResponse } from '../../utils/response.js';

// Get all products (OPTIMIZED - No N+1 queries)
export async function getAllProducts(env, corsHeaders) {
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
export async function getProduct(productId, env, corsHeaders) {
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
export async function searchProducts(query, env, corsHeaders) {
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
export async function createProduct(data, env, corsHeaders) {
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
export async function updateProduct(data, env, corsHeaders) {
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
export async function deleteProduct(data, env, corsHeaders) {
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
