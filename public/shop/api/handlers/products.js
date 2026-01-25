// ============================================
// SHOP PRODUCT HANDLER - Public product endpoints
// ============================================

import { jsonResponse } from '../../../../src/utils/response.js';

/**
 * Get active products for shop (public)
 */
export async function getActiveProducts(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');

        // Build query
        let query = `
            SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;

        const bindings = [];

        if (category) {
            query += ` AND c.name = ?`;
            bindings.push(category);
        }

        if (search) {
            query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            bindings.push(searchTerm, searchTerm);
        }

        query += ` ORDER BY p.name ASC`;

        const { results: products } = await env.DB.prepare(query).bind(...bindings).all();

        // Get all product-category relationships
        const { results: allProductCategories } = await env.DB.prepare(`
            SELECT 
                pc.product_id,
                c.id, 
                c.name, 
                c.icon, 
                c.color, 
                pc.is_primary
            FROM product_categories pc
            JOIN categories c ON pc.category_id = c.id
            ORDER BY pc.product_id, pc.is_primary DESC
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
/**
 * Add favorite to product
 */
export async function addProductFavorite(productId, env, corsHeaders) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Check if product exists
        const product = await env.DB.prepare(`
            SELECT id, favorites_count FROM products WHERE id = ? AND is_active = 1
        `).bind(productId).first();

        if (!product) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Increment favorites count
        await env.DB.prepare(`
            UPDATE products 
            SET favorites_count = favorites_count + 1 
            WHERE id = ?
        `).bind(productId).run();

        // Get updated count
        const updatedProduct = await env.DB.prepare(`
            SELECT favorites_count FROM products WHERE id = ?
        `).bind(productId).first();

        return jsonResponse({
            success: true,
            favorites_count: updatedProduct.favorites_count,
            message: 'Added to favorites'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error adding favorite:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Remove favorite from product
 */
export async function removeProductFavorite(productId, env, corsHeaders) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Check if product exists
        const product = await env.DB.prepare(`
            SELECT id, favorites_count FROM products WHERE id = ? AND is_active = 1
        `).bind(productId).first();

        if (!product) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Decrement favorites count (but not below 0)
        await env.DB.prepare(`
            UPDATE products 
            SET favorites_count = CASE 
                WHEN favorites_count > 0 THEN favorites_count - 1 
                ELSE 0 
            END 
            WHERE id = ?
        `).bind(productId).run();

        // Get updated count
        const updatedProduct = await env.DB.prepare(`
            SELECT favorites_count FROM products WHERE id = ?
        `).bind(productId).first();

        return jsonResponse({
            success: true,
            favorites_count: updatedProduct.favorites_count,
            message: 'Removed from favorites'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error removing favorite:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Get most favorited products
 */
export async function getMostFavorited(env, corsHeaders, limit = 10) {
    try {
        const { results: products } = await env.DB.prepare(`
            SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND p.favorites_count > 0
            ORDER BY p.favorites_count DESC, p.name ASC
            LIMIT ?
        `).bind(limit).all();

        return jsonResponse({
            success: true,
            products: products
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting most favorited products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}