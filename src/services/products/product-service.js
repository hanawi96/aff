import { jsonResponse } from '../../utils/response.js';
import { deleteImageByUrl } from '../upload/image-upload.js';

function smartRoundPrice(price) {
    if (price < 10000) return Math.round(price / 1000) * 1000;
    if (price < 100000) return Math.round(price / 1000) * 1000;
    if (price < 500000) return Math.round(price / 5000) * 5000;
    return Math.round(price / 10000) * 10000;
}

function smartRoundPriceUp(price) {
    if (price < 10000) return Math.ceil(price / 1000) * 1000;
    if (price < 100000) return Math.ceil(price / 1000) * 1000;
    if (price < 500000) return Math.ceil(price / 5000) * 5000;
    return Math.ceil(price / 10000) * 10000;
}

function hasMeaningfulDifference(a, b, epsilon = 0.01) {
    const n1 = Number(a || 0);
    const n2 = Number(b || 0);
    return Math.abs(n1 - n2) > epsilon;
}

async function ensureSystemMetaTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS system_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();
}

async function getSystemMetaNumber(env, key) {
    await ensureSystemMetaTable(env);
    const row = await env.DB.prepare(`SELECT value FROM system_meta WHERE key = ?`).bind(key).first();
    return Number(row?.value || 0);
}

async function setSystemMetaNumber(env, key, value) {
    await ensureSystemMetaTable(env);
    await env.DB.prepare(`
        INSERT INTO system_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind(key, String(Number(value || 0))).run();
}

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

/**
 * Shop home: paginated products (same shape as getAllProducts, smaller payload per request).
 * ORDER BY name ASC — must match client merge order.
 */
export async function getProductsPage(env, corsHeaders, page = 1, limit = 16) {
    try {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 16), 100);
        const offset = (pageNum - 1) * limitNum;

        const countRow = await env.DB.prepare(`
            SELECT COUNT(*) as cnt FROM products WHERE is_active = 1
        `).first();
        const total = countRow?.cnt ?? 0;

        const { results: products } = await env.DB.prepare(`
            SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
            ORDER BY name ASC
            LIMIT ? OFFSET ?
        `).bind(limitNum, offset).all();

        if (!products.length) {
            return jsonResponse({
                success: true,
                products: [],
                total,
                page: pageNum,
                limit: limitNum,
                hasMore: false
            }, 200, corsHeaders);
        }

        const ids = products.map((p) => p.id);
        const placeholders = ids.map(() => '?').join(',');
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
            WHERE pc.product_id IN (${placeholders})
            ORDER BY pc.product_id, pc.is_primary DESC, pc.display_order ASC
        `).bind(...ids).all();

        const categoriesByProduct = {};
        for (const pc of allProductCategories) {
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

        for (const product of products) {
            product.categories = categoriesByProduct[product.id] || [];
            product.category_ids = product.categories.map((c) => c.id);
        }

        const hasMore = offset + products.length < total;

        return jsonResponse({
            success: true,
            products,
            total,
            page: pageNum,
            limit: limitNum,
            hasMore
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting products page:', error);
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

        // Require at least one category
        const hasValidCategoryIds = Array.isArray(data.category_ids) && data.category_ids.length > 0;
        const hasValidSingleCategory = data.category_id !== undefined && data.category_id !== null && data.category_id !== '';
        if (!hasValidCategoryIds && !hasValidSingleCategory) {
            return jsonResponse({
                success: false,
                error: 'At least one category is required'
            }, 400, corsHeaders);
        }

        // Check duplicate product name (case-insensitive) among active products
        const normalizedName = String(data.name).trim();
        const duplicateByName = await env.DB.prepare(`
            SELECT id FROM products
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
              AND is_active = 1
            LIMIT 1
        `).bind(normalizedName).first();

        if (duplicateByName) {
            return jsonResponse({
                success: false,
                error: 'Product name already exists'
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
            INSERT INTO products (name, price, original_price, cost_price, markup_multiplier, category_id, stock_quantity, rating, purchases, sku, description, image_url, is_active, pricing_method, target_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            normalizedName,
            price,
            data.original_price ? parseFloat(data.original_price) : null,
            data.cost_price !== undefined ? parseFloat(data.cost_price) : 0,
            data.markup_multiplier !== undefined ? (data.markup_multiplier !== null ? parseFloat(data.markup_multiplier) : null) : null,
            data.category_id ? parseInt(data.category_id) : null,
            data.stock_quantity !== undefined ? parseInt(data.stock_quantity) : 0,
            data.rating !== undefined ? parseFloat(data.rating) : 0,
            data.purchases !== undefined ? parseInt(data.purchases) : 0,
            data.sku || null,
            data.description || null,
            data.image_url || null,
            data.is_active !== undefined ? data.is_active : 1,
            data.pricing_method || 'markup',
            data.target_profit ? parseFloat(data.target_profit) : null
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

        // Check if product exists and get old image URL
        const existing = await env.DB.prepare(`
            SELECT id, image_url FROM products WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Category validation:
        // - Only enforce "at least one category" when caller attempts to modify categories.
        // - Allow partial updates (e.g. stock_quantity) even if the product currently has no category
        //   so admin can fix inventory/fields first, then assign categories later.
        if (data.category_ids !== undefined) {
            if (!Array.isArray(data.category_ids) || data.category_ids.length === 0) {
                return jsonResponse({
                    success: false,
                    error: 'At least one category is required'
                }, 400, corsHeaders);
            }
        }

        // Track old image for deferred deletion.
        // Important: only delete after product update succeeds.
        const shouldDeleteOldImage = (
            data.image_url !== undefined &&
            existing.image_url &&
            existing.image_url !== data.image_url
        );
        const oldImageToDelete = shouldDeleteOldImage ? existing.image_url : null;

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
        if (data.markup_multiplier !== undefined) {
            updates.push('markup_multiplier = ?');
            values.push(data.markup_multiplier !== null ? parseFloat(data.markup_multiplier) : null);
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
        if (data.pricing_method !== undefined) {
            updates.push('pricing_method = ?');
            values.push(data.pricing_method || 'markup');
        }
        if (data.target_profit !== undefined) {
            updates.push('target_profit = ?');
            values.push(data.target_profit ? parseFloat(data.target_profit) : null);
        }

        if (updates.length === 0) {
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

        const touchesPricing = (
            data.price !== undefined ||
            data.cost_price !== undefined ||
            data.markup_multiplier !== undefined ||
            data.pricing_method !== undefined ||
            data.target_profit !== undefined
        );

        if (touchesPricing) {
            // User has manually adjusted product pricing; treat this as an explicit
            // sync point so outdated-material warning does not persist incorrectly.
            await env.DB.prepare(`
                UPDATE product_materials
                SET updated_at_unix = CAST(strftime('%s', 'now') AS INTEGER)
                WHERE product_id = ?
            `).bind(data.id).run();
        }

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

        // Delete old image only after DB update succeeded.
        // This ensures "upload only" never deletes old image, and "save" controls replacement.
        if (oldImageToDelete) {
            try {
                await deleteImageByUrl(env, oldImageToDelete);
            } catch (deleteError) {
                // Do not fail product update if cleanup fails.
                console.warn('⚠️ Failed to delete old product image:', deleteError);
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

        // Check if product exists and get image URL
        const existing = await env.DB.prepare(`
            SELECT id, image_url, is_active FROM products WHERE id = ?
        `).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Product not found'
            }, 404, corsHeaders);
        }

        // Idempotent behavior: already deleted is treated as success
        if (Number(existing.is_active) === 0) {
            return jsonResponse({
                success: true,
                message: 'Product already deleted'
            }, 200, corsHeaders);
        }

        // Soft delete first (schema no longer has updated_at column)
        await env.DB.prepare(`
            UPDATE products
            SET is_active = 0
            WHERE id = ?
        `).bind(data.id).run();

        // Cleanup image after DB update (best effort only)
        if (existing.image_url) {
            try {
                await deleteImageByUrl(env, existing.image_url);
            } catch (deleteError) {
                console.warn('⚠️ Failed to delete product image after soft delete:', deleteError);
            }
        }

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

// Recalculate all product prices based on current material costs
export async function recalculateAllProductPrices(env, corsHeaders) {
    try {
        // Get all products that have materials
        const { results: productsWithMaterials } = await env.DB.prepare(`
            SELECT DISTINCT p.id, p.name, p.markup_multiplier, p.price as old_price, p.cost_price as old_cost_price,
                   p.pricing_method, p.target_profit
            FROM products p
            INNER JOIN product_materials pm ON p.id = pm.product_id
            WHERE p.is_active = 1
        `).all();

        if (productsWithMaterials.length === 0) {
            return jsonResponse({
                success: true,
                message: 'No products with materials found',
                updated: 0
            }, 200, corsHeaders);
        }

        let updatedCount = 0;
        let skippedCount = 0;
        const updates = [];

        // Process each product
        for (const product of productsWithMaterials) {
            try {
                // Get materials for this product
                const { results: materials } = await env.DB.prepare(`
                    SELECT 
                        pm.material_name, 
                        pm.quantity, 
                        m.item_cost,
                        pm.updated_at_unix as formula_updated_at_unix,
                        CAST(strftime('%s', m.updated_at) AS INTEGER) as material_updated_at_unix
                    FROM product_materials pm
                    JOIN cost_config m ON pm.material_name = m.item_name
                    WHERE pm.product_id = ?
                `).bind(product.id).all();

                // Calculate new cost price
                let newCostPrice = 0;
                for (const material of materials) {
                    newCostPrice += (material.quantity || 0) * (material.item_cost || 0);
                }

                // Round to 2 decimal places
                newCostPrice = Math.round(newCostPrice * 100) / 100;

                // Calculate new selling price based on pricing method
                let newPrice;
                let newMarkup;
                const materialCount = materials.length;
                const pricingMethod = product.pricing_method || 'markup';
                const targetProfit = Number(product.target_profit || 0);

                // Debug logging
                console.log(`🔍 Product ${product.id} (${product.name}):`, {
                    pricingMethod,
                    target_profit: product.target_profit,
                    markup_multiplier: product.markup_multiplier,
                    old_cost_price: product.old_cost_price,
                    newCostPrice
                });

                if (pricingMethod === 'profit' && product.target_profit !== null && product.target_profit !== undefined && targetProfit >= 0) {
                    // Use target profit method: price = cost + target profit
                    // Round UP to avoid dropping below desired profit because of rounding step.
                    const minimumPrice = newCostPrice + targetProfit;
                    newPrice = smartRoundPriceUp(minimumPrice);
                    newMarkup = newCostPrice > 0 ? newPrice / newCostPrice : 2.5;
                    console.log(`💰 Using profit method: ${newCostPrice} + ${targetProfit} => rounded up ${newPrice}`);
                } else {
                    // Use markup method: price = cost × markup
                    if (product.markup_multiplier !== null && product.markup_multiplier !== undefined) {
                        // Use saved markup multiplier
                        newMarkup = product.markup_multiplier;
                    } else {
                        // Use auto markup based on material count
                        if (materialCount <= 3) {
                            newMarkup = 2.5;
                        } else if (materialCount <= 6) {
                            newMarkup = 3.0;
                        } else {
                            newMarkup = 3.5;
                        }
                    }
                    newPrice = newCostPrice * newMarkup;
                    console.log(`📊 Using markup method: ${newCostPrice} × ${newMarkup} = ${newPrice}`);
                    newPrice = smartRoundPrice(newPrice);
                }

                // Only update if prices changed
                if (newCostPrice !== product.old_cost_price || newPrice !== product.old_price) {
                    // Update product with new prices and calculated markup
                    await env.DB.prepare(`
                        UPDATE products
                        SET cost_price = ?, price = ?, markup_multiplier = ?
                        WHERE id = ?
                    `).bind(newCostPrice, newPrice, newMarkup, product.id).run();

                    updatedCount++;
                    updates.push({
                        id: product.id,
                        name: product.name,
                        old_cost_price: product.old_cost_price,
                        new_cost_price: newCostPrice,
                        old_price: product.old_price,
                        new_price: newPrice,
                        pricing_method: pricingMethod,
                        markup: newMarkup,
                        target_profit: product.target_profit
                    });
                } else {
                    skippedCount++;
                }

            } catch (error) {
                console.error(`Error processing product ${product.id}:`, error);
                // Continue with next product
            }
        }

        await setSystemMetaNumber(env, 'products_last_recalculate_unix', Math.floor(Date.now() / 1000));

        return jsonResponse({
            success: true,
            message: `Successfully recalculated prices for ${updatedCount} products`,
            updated: updatedCount,
            skipped: skippedCount,
            total: productsWithMaterials.length,
            updates: updates
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ Error recalculating prices:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}


// Check how many products have outdated prices (need recalculation)
export async function checkOutdatedProducts(env, corsHeaders) {
    try {
        const lastMaterialPriceUpdateUnix = await getSystemMetaNumber(env, 'materials_last_price_update_unix');
        const lastProductsRecalculateUnix = await getSystemMetaNumber(env, 'products_last_recalculate_unix');

        // No material price change since last recalc => no "outdated" warning.
        if (!lastMaterialPriceUpdateUnix || lastMaterialPriceUpdateUnix <= lastProductsRecalculateUnix) {
            return jsonResponse({
                success: true,
                outdated_count: 0,
                total_products: 0
            }, 200, corsHeaders);
        }

        // Get all products that have materials
        const { results: productsWithMaterials } = await env.DB.prepare(`
            SELECT DISTINCT 
                p.id,
                p.markup_multiplier,
                p.pricing_method,
                p.target_profit,
                p.price as current_price,
                p.cost_price as current_cost_price
            FROM products p
            INNER JOIN product_materials pm ON p.id = pm.product_id
            WHERE p.is_active = 1
        `).all();

        let outdatedCount = 0;

        // Check each product
        for (const product of productsWithMaterials) {
            try {
                // Get materials for this product
                const { results: materials } = await env.DB.prepare(`
                    SELECT 
                        pm.material_name, 
                        pm.quantity, 
                        m.item_cost,
                        pm.updated_at_unix as formula_updated_at_unix,
                        CAST(strftime('%s', m.updated_at) AS INTEGER) as material_updated_at_unix
                    FROM product_materials pm
                    JOIN cost_config m ON pm.material_name = m.item_name
                    WHERE pm.product_id = ?
                `).bind(product.id).all();

                // Calculate expected cost price
                let expectedCostPrice = 0;
                let latestFormulaUpdatedAtUnix = 0;
                let latestMaterialUpdatedAtUnix = 0;
                for (const material of materials) {
                    expectedCostPrice += (material.quantity || 0) * (material.item_cost || 0);
                    latestFormulaUpdatedAtUnix = Math.max(latestFormulaUpdatedAtUnix, Number(material.formula_updated_at_unix || 0));
                    latestMaterialUpdatedAtUnix = Math.max(latestMaterialUpdatedAtUnix, Number(material.material_updated_at_unix || 0));
                }
                expectedCostPrice = Math.round(expectedCostPrice * 100) / 100;

                // Only warn when material prices were updated after formula sync
                if (latestMaterialUpdatedAtUnix <= latestFormulaUpdatedAtUnix) {
                    continue;
                }

                // Calculate expected selling price based on product pricing method
                let expectedPrice;
                const materialCount = materials.length;
                const pricingMethod = product.pricing_method || 'markup';
                const targetProfit = Number(product.target_profit || 0);

                if (pricingMethod === 'profit' && product.target_profit !== null && product.target_profit !== undefined && targetProfit >= 0) {
                    const minimumPrice = expectedCostPrice + targetProfit;
                    expectedPrice = smartRoundPriceUp(minimumPrice);
                } else {
                    let markupToUse = product.markup_multiplier;
                    if (markupToUse === null || markupToUse === undefined) {
                        if (materialCount <= 3) {
                            markupToUse = 2.5;
                        } else if (materialCount <= 6) {
                            markupToUse = 3.0;
                        } else {
                            markupToUse = 3.5;
                        }
                    }
                    expectedPrice = smartRoundPrice(expectedCostPrice * markupToUse);
                }

                // Check if prices are different (tolerant comparison to avoid float/type false positives)
                if (hasMeaningfulDifference(expectedCostPrice, product.current_cost_price) ||
                    hasMeaningfulDifference(expectedPrice, product.current_price)) {
                    outdatedCount++;
                }
            } catch (error) {
                console.error(`Error checking product ${product.id}:`, error);
            }
        }

        return jsonResponse({
            success: true,
            outdated_count: outdatedCount,
            total_products: productsWithMaterials.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error checking outdated products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get detailed list of outdated products for admin quick inspection
export async function getOutdatedProductsDetails(env, corsHeaders) {
    try {
        const lastMaterialPriceUpdateUnix = await getSystemMetaNumber(env, 'materials_last_price_update_unix');
        const lastProductsRecalculateUnix = await getSystemMetaNumber(env, 'products_last_recalculate_unix');

        if (!lastMaterialPriceUpdateUnix || lastMaterialPriceUpdateUnix <= lastProductsRecalculateUnix) {
            return jsonResponse({
                success: true,
                outdated_count: 0,
                products: []
            }, 200, corsHeaders);
        }

        const { results: productsWithMaterials } = await env.DB.prepare(`
            SELECT DISTINCT 
                p.id,
                p.name,
                p.markup_multiplier,
                p.pricing_method,
                p.target_profit,
                p.price as current_price,
                p.cost_price as current_cost_price
            FROM products p
            INNER JOIN product_materials pm ON p.id = pm.product_id
            WHERE p.is_active = 1
            ORDER BY p.name COLLATE NOCASE ASC
        `).all();

        const outdatedProducts = [];

        for (const product of productsWithMaterials) {
            try {
                const { results: materials } = await env.DB.prepare(`
                    SELECT 
                        pm.material_name, 
                        pm.quantity, 
                        m.item_cost,
                        pm.updated_at_unix as formula_updated_at_unix,
                        CAST(strftime('%s', m.updated_at) AS INTEGER) as material_updated_at_unix
                    FROM product_materials pm
                    JOIN cost_config m ON pm.material_name = m.item_name
                    WHERE pm.product_id = ?
                `).bind(product.id).all();

                let expectedCostPrice = 0;
                let latestFormulaUpdatedAtUnix = 0;
                let latestMaterialUpdatedAtUnix = 0;
                for (const material of materials) {
                    expectedCostPrice += (material.quantity || 0) * (material.item_cost || 0);
                    latestFormulaUpdatedAtUnix = Math.max(latestFormulaUpdatedAtUnix, Number(material.formula_updated_at_unix || 0));
                    latestMaterialUpdatedAtUnix = Math.max(latestMaterialUpdatedAtUnix, Number(material.material_updated_at_unix || 0));
                }
                expectedCostPrice = Math.round(expectedCostPrice * 100) / 100;

                // Only show details when there was a real material-price update after formula sync
                if (latestMaterialUpdatedAtUnix <= latestFormulaUpdatedAtUnix) {
                    continue;
                }

                let expectedPrice;
                const materialCount = materials.length;
                const pricingMethod = product.pricing_method || 'markup';
                const targetProfit = Number(product.target_profit || 0);

                if (pricingMethod === 'profit' && product.target_profit !== null && product.target_profit !== undefined && targetProfit >= 0) {
                    const minimumPrice = expectedCostPrice + targetProfit;
                    expectedPrice = smartRoundPriceUp(minimumPrice);
                } else {
                    let markupToUse = product.markup_multiplier;
                    if (markupToUse === null || markupToUse === undefined) {
                        if (materialCount <= 3) {
                            markupToUse = 2.5;
                        } else if (materialCount <= 6) {
                            markupToUse = 3.0;
                        } else {
                            markupToUse = 3.5;
                        }
                    }
                    expectedPrice = smartRoundPrice(expectedCostPrice * markupToUse);
                }

                if (hasMeaningfulDifference(expectedCostPrice, product.current_cost_price) ||
                    hasMeaningfulDifference(expectedPrice, product.current_price)) {
                    outdatedProducts.push({
                        id: product.id,
                        name: product.name,
                        current_price: product.current_price,
                        expected_price: expectedPrice,
                        current_cost_price: product.current_cost_price,
                        expected_cost_price: expectedCostPrice,
                        delta_price: expectedPrice - (product.current_price || 0),
                        delta_cost_price: expectedCostPrice - (product.current_cost_price || 0)
                    });
                }
            } catch (error) {
                console.error(`Error checking product ${product.id}:`, error);
            }
        }

        return jsonResponse({
            success: true,
            outdated_count: outdatedProducts.length,
            products: outdatedProducts
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting outdated products details:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}