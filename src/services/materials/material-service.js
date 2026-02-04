import { jsonResponse } from '../../utils/response.js';

// Get all material categories with material count
export async function getAllMaterialCategories(env, corsHeaders) {
    try {
        const { results: categories } = await env.DB.prepare(`
            SELECT 
                mc.*,
                COUNT(cc.id) as material_count
            FROM material_categories mc
            LEFT JOIN cost_config cc ON mc.id = cc.category_id
            GROUP BY mc.id
            ORDER BY mc.sort_order ASC
        `).all();

        return jsonResponse({
            success: true,
            categories: categories
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting material categories:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create new material category
export async function createMaterialCategory(data, env, corsHeaders) {
    try {
        if (!data.name || !data.display_name) {
            return jsonResponse({
                success: false,
                error: 'name and display_name are required'
            }, 400, corsHeaders);
        }

        // Check if category name already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM material_categories WHERE name = ?
        `).bind(data.name).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Category name already exists'
            }, 400, corsHeaders);
        }

        // Get max sort_order
        const { results: maxOrder } = await env.DB.prepare(`
            SELECT MAX(sort_order) as max_order FROM material_categories
        `).all();
        const nextOrder = (maxOrder[0]?.max_order || 0) + 1;

        // Insert category
        await env.DB.prepare(`
            INSERT INTO material_categories (name, display_name, icon, description, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            data.name,
            data.display_name,
            data.icon || '📦',
            data.description || '',
            nextOrder
        ).run();

        return jsonResponse({
            success: true,
            message: 'Category created successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error creating material category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update material category
export async function updateMaterialCategory(data, env, corsHeaders) {
    try {
        if (!data.id || !data.name) {
            return jsonResponse({
                success: false,
                error: 'id and name are required'
            }, 400, corsHeaders);
        }

        const oldName = data.old_name || data.name;
        const newName = data.name;

        // Check if category exists
        const existing = await env.DB.prepare(`
            SELECT id FROM material_categories WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Category not found'
            }, 404, corsHeaders);
        }

        // If name is changing, check if new name already exists
        if (oldName !== newName) {
            const duplicate = await env.DB.prepare(`
                SELECT id FROM material_categories WHERE name = ? AND id != ?
            `).bind(newName, data.id).first();

            if (duplicate) {
                return jsonResponse({
                    success: false,
                    error: 'Category with this name already exists'
                }, 400, corsHeaders);
            }
        }

        // Update category (name can be changed now)
        await env.DB.prepare(`
            UPDATE material_categories
            SET name = ?, display_name = ?, icon = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(
            newName,
            data.display_name,
            data.icon || '📦',
            data.description || '',
            data.id
        ).run();

        return jsonResponse({
            success: true,
            message: 'Category updated successfully',
            name_changed: oldName !== newName
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating material category:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete material category
export async function deleteMaterialCategory(data, env, corsHeaders) {
    try {
        console.log('🗑️ Delete category request:', JSON.stringify(data));
        
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'id is required'
            }, 400, corsHeaders);
        }

        // Ensure ID is an integer
        const categoryId = parseInt(data.id);
        
        console.log('🔢 Parsed category ID:', categoryId, 'Type:', typeof categoryId);
        
        if (isNaN(categoryId)) {
            return jsonResponse({
                success: false,
                error: 'Invalid category ID'
            }, 400, corsHeaders);
        }

        // Check if category has materials
        console.log('📊 Checking materials for category:', categoryId);
        const { results: materials } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM cost_config WHERE category_id = ?
        `).bind(categoryId).all();

        const materialCount = materials[0]?.count || 0;
        console.log('📦 Material count:', materialCount);

        // If category has materials, move them to NULL (Chưa phân loại)
        if (materialCount > 0) {
            console.log('🔄 Moving materials to NULL category...');
            await env.DB.prepare(`
                UPDATE cost_config 
                SET category_id = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE category_id = ?
            `).bind(categoryId).run();
            console.log('✅ Materials moved successfully');
        }

        // Delete category
        console.log('🗑️ Deleting category with ID:', categoryId);
        const deleteResult = await env.DB.prepare(`
            DELETE FROM material_categories WHERE id = ?
        `).bind(categoryId).run();
        
        console.log('✅ Delete result:', JSON.stringify(deleteResult));

        return jsonResponse({
            success: true,
            message: 'Category deleted successfully',
            moved_materials: materialCount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error deleting material category:', error);
        console.error('Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Reorder material categories
export async function reorderMaterialCategories(data, env, corsHeaders) {
    try {
        console.log('🔄 Reorder category request:', JSON.stringify(data));
        
        if (!data.category_id || !data.direction) {
            return jsonResponse({
                success: false,
                error: 'category_id and direction are required'
            }, 400, corsHeaders);
        }

        // Parse category_id as integer
        const categoryId = parseInt(data.category_id);
        
        if (isNaN(categoryId)) {
            return jsonResponse({
                success: false,
                error: 'Invalid category ID'
            }, 400, corsHeaders);
        }
        
        console.log('📝 Category ID:', categoryId, 'Direction:', data.direction);

        // Get current category
        const current = await env.DB.prepare(`
            SELECT * FROM material_categories WHERE id = ?
        `).bind(categoryId).first();

        if (!current) {
            return jsonResponse({
                success: false,
                error: 'Category not found'
            }, 404, corsHeaders);
        }
        
        console.log('📊 Current category:', current.display_name, 'Sort order:', current.sort_order);

        // Get swap target
        let swapTarget;
        if (data.direction === 'up') {
            swapTarget = await env.DB.prepare(`
                SELECT * FROM material_categories 
                WHERE sort_order < ? 
                ORDER BY sort_order DESC 
                LIMIT 1
            `).bind(current.sort_order).first();
        } else {
            swapTarget = await env.DB.prepare(`
                SELECT * FROM material_categories 
                WHERE sort_order > ? 
                ORDER BY sort_order ASC 
                LIMIT 1
            `).bind(current.sort_order).first();
        }

        if (!swapTarget) {
            return jsonResponse({
                success: false,
                error: 'Cannot move further in this direction'
            }, 400, corsHeaders);
        }
        
        console.log('🔀 Swap target:', swapTarget.display_name, 'Sort order:', swapTarget.sort_order);

        // Swap sort_order - do it sequentially instead of batch
        console.log('🔄 Swapping sort orders...');
        
        await env.DB.prepare(`
            UPDATE material_categories 
            SET sort_order = ? 
            WHERE id = ?
        `).bind(swapTarget.sort_order, categoryId).run();
        
        await env.DB.prepare(`
            UPDATE material_categories 
            SET sort_order = ? 
            WHERE id = ?
        `).bind(current.sort_order, swapTarget.id).run();
        
        console.log('✅ Categories reordered successfully');

        return jsonResponse({
            success: true,
            message: 'Category reordered successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error reordering material categories:', error);
        console.error('Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get all materials with product count and categories
export async function getAllMaterials(env, corsHeaders) {
    try {
        const { results: materials } = await env.DB.prepare(`
            SELECT 
                cc.*,
                mc.name as category_name,
                mc.display_name as category_display_name,
                mc.icon as category_icon,
                mc.sort_order as category_sort_order,
                COUNT(DISTINCT pm.product_id) as product_count
            FROM cost_config cc
            LEFT JOIN material_categories mc ON cc.category_id = mc.id
            LEFT JOIN product_materials pm ON cc.item_name = pm.material_name
            GROUP BY cc.id
            ORDER BY mc.sort_order ASC, cc.item_name ASC
        `).all();

        return jsonResponse({
            success: true,
            materials: materials
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting materials:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Create new material
export async function createMaterial(data, env, corsHeaders) {
    try {
        console.log('➕ Create material request:', JSON.stringify(data));
        
        if (!data.item_name || !data.item_cost) {
            return jsonResponse({
                success: false,
                error: 'item_name and item_cost are required'
            }, 400, corsHeaders);
        }

        // Check if material already exists
        const existing = await env.DB.prepare(`
            SELECT id FROM cost_config WHERE item_name = ?
        `).bind(data.item_name).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Material already exists'
            }, 400, corsHeaders);
        }

        // Parse category_id properly
        let categoryId = data.category_id;
        if (categoryId === '' || categoryId === undefined || categoryId === 'null') {
            categoryId = null;
        } else if (categoryId !== null) {
            categoryId = parseInt(categoryId);
            if (isNaN(categoryId)) {
                categoryId = null;
            }
        }
        
        console.log('📝 Creating material:', data.item_name, 'Category ID:', categoryId);

        // Insert material with category and display_name
        await env.DB.prepare(`
            INSERT INTO cost_config (item_name, display_name, item_cost, category_id, is_default)
            VALUES (?, ?, ?, ?, 1)
        `).bind(
            data.item_name, 
            data.display_name || data.item_name,
            parseFloat(data.item_cost), 
            categoryId
        ).run();
        
        console.log('✅ Material created successfully');

        return jsonResponse({
            success: true,
            message: 'Material created successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error creating material:', error);
        console.error('Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update material
export async function updateMaterial(data, env, corsHeaders) {
    try {
        console.log('🔧 Update material request:', JSON.stringify(data));
        
        if (!data.item_name || !data.item_cost) {
            return jsonResponse({
                success: false,
                error: 'item_name and item_cost are required'
            }, 400, corsHeaders);
        }

        const oldItemName = data.old_item_name || data.item_name;
        const newItemName = data.item_name;
        
        // Parse category_id properly - convert empty string or undefined to null
        let categoryId = data.category_id;
        if (categoryId === '' || categoryId === undefined || categoryId === 'null') {
            categoryId = null;
        } else if (categoryId !== null) {
            categoryId = parseInt(categoryId);
            if (isNaN(categoryId)) {
                categoryId = null;
            }
        }
        
        console.log('📝 Old name:', oldItemName, 'New name:', newItemName, 'Category ID:', categoryId);

        // Check if old material exists
        const existing = await env.DB.prepare(`
            SELECT id FROM cost_config WHERE item_name = ?
        `).bind(oldItemName).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Material not found'
            }, 404, corsHeaders);
        }

        // If item_name is changing, check if new name already exists
        if (oldItemName !== newItemName) {
            const duplicate = await env.DB.prepare(`
                SELECT id FROM cost_config WHERE item_name = ?
            `).bind(newItemName).first();

            if (duplicate) {
                return jsonResponse({
                    success: false,
                    error: 'Material with this item_name already exists'
                }, 400, corsHeaders);
            }
        }

        // Update the material itself first
        console.log('🔄 Updating material...');
        await env.DB.prepare(`
            UPDATE cost_config
            SET item_name = ?, display_name = ?, item_cost = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE item_name = ?
        `).bind(
            newItemName,
            data.display_name || newItemName,
            parseFloat(data.item_cost), 
            categoryId, 
            oldItemName
        ).run();
        
        console.log('✅ Material updated');

        // If item_name changed, update all product_materials references
        let affectedCount = 0;
        if (oldItemName !== newItemName) {
            console.log('🔄 Updating product_materials references...');
            await env.DB.prepare(`
                UPDATE product_materials
                SET material_name = ?
                WHERE material_name = ?
            `).bind(newItemName, oldItemName).run();
            
            // Count affected products
            const { results: affected } = await env.DB.prepare(`
                SELECT COUNT(DISTINCT product_id) as count
                FROM product_materials
                WHERE material_name = ?
            `).bind(newItemName).all();

            affectedCount = affected[0]?.count || 0;
            console.log('✅ Updated', affectedCount, 'product references');
        }

        return jsonResponse({
            success: true,
            message: 'Material updated successfully',
            affected_products: affectedCount,
            item_name_changed: oldItemName !== newItemName
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error updating material:', error);
        console.error('Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Delete material
export async function deleteMaterial(data, env, corsHeaders) {
    try {
        if (!data.item_name) {
            return jsonResponse({
                success: false,
                error: 'item_name is required'
            }, 400, corsHeaders);
        }

        // Check if material is being used
        const { results: usage } = await env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM product_materials
            WHERE material_name = ?
        `).bind(data.item_name).all();

        if (usage[0]?.count > 0) {
            return jsonResponse({
                success: false,
                error: 'Cannot delete material that is being used by products'
            }, 400, corsHeaders);
        }

        // Delete material
        await env.DB.prepare(`
            DELETE FROM cost_config WHERE item_name = ?
        `).bind(data.item_name).run();

        return jsonResponse({
            success: true,
            message: 'Material deleted successfully'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error deleting material:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get product materials (formula)
export async function getProductMaterials(productId, env, corsHeaders) {
    try {
        if (!productId) {
            return jsonResponse({
                success: false,
                error: 'product_id is required'
            }, 400, corsHeaders);
        }

        const { results: materials } = await env.DB.prepare(`
            SELECT 
                pm.*,
                cc.item_cost,
                cc.display_name,
                (pm.quantity * cc.item_cost) as subtotal
            FROM product_materials pm
            JOIN cost_config cc ON pm.material_name = cc.item_name
            WHERE pm.product_id = ?
            ORDER BY pm.id ASC
        `).bind(productId).all();

        return jsonResponse({
            success: true,
            materials: materials || []
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting product materials:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Save product materials (bulk upsert)
export async function saveProductMaterials(data, env, corsHeaders) {
    try {
        console.log('📦 saveProductMaterials called with data:', JSON.stringify(data));
        
        const { product_id, materials } = data;

        console.log('🔍 Extracted values:', {
            product_id,
            'typeof product_id': typeof product_id,
            'materials length': materials?.length
        });

        if (!product_id) {
            return jsonResponse({
                success: false,
                error: 'product_id is required'
            }, 400, corsHeaders);
        }

        if (!Array.isArray(materials)) {
            return jsonResponse({
                success: false,
                error: 'materials must be an array'
            }, 400, corsHeaders);
        }

        // Use batch for better performance
        const statements = [];
        
        // Delete existing materials for this product
        console.log('🗑️ Deleting existing materials for product:', product_id);
        await env.DB.prepare('DELETE FROM product_materials WHERE product_id = ?')
            .bind(product_id)
            .run();

        // Insert new materials
        if (materials.length > 0) {
            console.log('➕ Inserting', materials.length, 'materials');
            for (const material of materials) {
                console.log('  - Material:', material.material_name, 'Qty:', material.quantity);
                
                if (!material.material_name || material.quantity === undefined || material.quantity === null) {
                    console.warn('  ⚠️ Skipping invalid material:', material);
                    continue; // Skip invalid entries
                }

                await env.DB.prepare(`
                    INSERT INTO product_materials (product_id, material_name, quantity, unit, notes)
                    VALUES (?, ?, ?, ?, ?)
                `).bind(
                    product_id,
                    material.material_name,
                    parseFloat(material.quantity),
                    material.unit || '',
                    material.notes || ''
                ).run();
            }
        }

        console.log('✅ Materials inserted successfully');

        // Calculate cost_price manually (in case triggers don't work)
        console.log('💰 Calculating cost_price manually for product:', product_id);
        const { results: costCalc } = await env.DB.prepare(`
            SELECT COALESCE(SUM(pm.quantity * cc.item_cost), 0) as total_cost
            FROM product_materials pm
            JOIN cost_config cc ON pm.material_name = cc.item_name
            WHERE pm.product_id = ?
        `).bind(product_id).all();

        const calculatedCost = costCalc[0]?.total_cost || 0;
        console.log('📊 Calculated cost:', calculatedCost);

        // Update product cost_price manually
        await env.DB.prepare(`
            UPDATE products SET cost_price = ? WHERE id = ?
        `).bind(calculatedCost, product_id).run();

        // Get updated cost_price
        console.log('💰 Getting updated cost_price for product:', product_id);
        const { results: product } = await env.DB.prepare(`
            SELECT cost_price FROM products WHERE id = ?
        `).bind(product_id).all();

        console.log('✅ Materials saved successfully, cost_price:', product[0]?.cost_price);

        return jsonResponse({
            success: true,
            message: 'Product materials saved successfully',
            cost_price: product[0]?.cost_price || 0
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error saving product materials:', error);
        console.error('Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
