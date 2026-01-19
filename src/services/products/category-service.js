import { jsonResponse } from '../../utils/response.js';

// Get all categories
export async function getAllCategories(env, corsHeaders) {
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
export async function getCategory(categoryId, env, corsHeaders) {
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
export async function createCategory(data, env, corsHeaders) {
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

        // Get current unix timestamp (in seconds)
        const now = Math.floor(Date.now() / 1000);

        // Insert category
        const result = await env.DB.prepare(`
            INSERT INTO categories (name, description, icon, color, display_order, is_active, created_at_unix, updated_at_unix)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.name,
            data.description || null,
            data.icon || null,
            data.color || null,
            data.display_order || 0,
            data.is_active !== undefined ? data.is_active : 1,
            now,
            now
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
export async function updateCategory(data, env, corsHeaders) {
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
        updates.push('updated_at_unix = ?');
        values.push(Math.floor(Date.now() / 1000));

        if (updates.length === 2) {
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
export async function deleteCategory(data, env, corsHeaders) {
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
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(`
            UPDATE categories
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP, updated_at_unix = ?
            WHERE id = ?
        `).bind(now, data.id).run();

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
