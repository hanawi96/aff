import { jsonResponse } from '../../utils/response.js';

// Get all categories for a product
export async function getProductCategories(productId, env, corsHeaders) {
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
export async function addProductCategory(data, env, corsHeaders) {
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
export async function removeProductCategory(data, env, corsHeaders) {
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
export async function setPrimaryCategory(data, env, corsHeaders) {
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
export async function updateProductCategories(data, env, corsHeaders) {
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
