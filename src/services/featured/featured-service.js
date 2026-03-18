// Featured Products Service - Simplified with products table columns
// Quản lý sản phẩm nổi bật bằng cách thêm cột vào bảng products

import { jsonResponse } from '../../utils/response.js';

// Cache layer - In-memory cache với TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút
const MAX_FEATURED_PRODUCTS = 20; // Giới hạn số lượng

// Helper: Kiểm tra cache còn hạn không
function isCacheValid(cacheEntry) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

// Helper: Lấy cache key
function getCacheKey(type, params = '') {
    return `featured_${type}_${params}`;
}

// Helper: Clear cache
function clearCache(pattern = null) {
    if (pattern) {
        for (const key of cache.keys()) {
            if (key.includes(pattern)) {
                cache.delete(key);
            }
        }
    } else {
        cache.clear();
    }
}

// 🚀 Lấy danh sách sản phẩm nổi bật (Public API - Siêu nhanh)
export async function getFeaturedProducts(env, corsHeaders) {
    const cacheKey = getCacheKey('products');
    
    try {
        // Kiểm tra cache trước
        const cached = cache.get(cacheKey);
        if (isCacheValid(cached)) {
            return jsonResponse({
                success: true,
                products: cached.data,
                cached: true,
                count: cached.data.length
            }, 200, corsHeaders);
        }

        // Query tối ưu - lấy đầy đủ thông tin sản phẩm featured
        const { results: products } = await env.DB.prepare(`
            SELECT 
                p.id,
                p.name,
                p.price,
                p.original_price,
                p.image_url,
                p.description,
                p.category_id,
                p.is_handmade,
                p.is_chemical_free,
                p.rating,
                p.purchases,
                p.favorites_count,
                p.featured_order,
                p.featured_at_unix,
                c.name as category_name,
                GROUP_CONCAT(pc.category_id) as all_category_ids
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_categories pc ON p.id = pc.product_id
            WHERE p.is_active = 1 AND p.is_featured = 1
            GROUP BY p.id
            ORDER BY p.featured_order ASC, p.featured_at_unix DESC
            LIMIT ${MAX_FEATURED_PRODUCTS}
        `).all();

        // Format data cho frontend
        const formattedProducts = products.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
            original_price: product.original_price,
            image_url: product.image_url,
            description: product.description,
            category_id: product.category_id,
            is_handmade: product.is_handmade,
            is_chemical_free: product.is_chemical_free,
            rating: product.rating || 4.5,
            purchases: product.purchases || 0,
            favorites_count: product.favorites_count || 0,
            featured_order: product.featured_order,
            featured_at: product.featured_at_unix,
            categories: product.all_category_ids ? 
                product.all_category_ids.split(',').map(id => ({ id: parseInt(id) })) : 
                [{ id: product.category_id }]
        }));

        // Cache kết quả
        cache.set(cacheKey, {
            data: formattedProducts,
            timestamp: Date.now()
        });

        return jsonResponse({
            success: true,
            products: formattedProducts,
            cached: false,
            count: formattedProducts.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting featured products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// 🔧 Lấy danh sách để quản lý (Admin API)
export async function getFeaturedProductsForAdmin(env, corsHeaders) {
    const cacheKey = getCacheKey('admin');
    
    try {
        // Kiểm tra cache
        const cached = cache.get(cacheKey);
        if (isCacheValid(cached)) {
            return jsonResponse({
                success: true,
                ...cached.data,
                cached: true
            }, 200, corsHeaders);
        }

        // Lấy sản phẩm đã featured
        const { results: featuredProducts } = await env.DB.prepare(`
            SELECT 
                p.id,
                p.name,
                p.price,
                p.image_url,
                p.category_id,
                p.featured_order,
                p.featured_at_unix,
                c.name as category_name,
                GROUP_CONCAT(pc.category_id) as all_category_ids
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_categories pc ON p.id = pc.product_id
            WHERE p.is_active = 1 AND p.is_featured = 1
            GROUP BY p.id
            ORDER BY p.featured_order ASC, p.featured_at_unix DESC
        `).all();

        // Lấy tổng số sản phẩm có thể featured
        const { count: totalProducts } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM products WHERE is_active = 1
        `).first();

        // Lấy sản phẩm chưa featured (để suggest) - lấy tất cả thay vì giới hạn 50
        const { results: availableProducts } = await env.DB.prepare(`
            SELECT 
                p.id,
                p.name,
                p.price,
                p.image_url,
                p.category_id,
                c.name as category_name,
                GROUP_CONCAT(pc.category_id) as all_category_ids
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_categories pc ON p.id = pc.product_id
            WHERE p.is_active = 1 AND (p.is_featured = 0 OR p.is_featured IS NULL)
            GROUP BY p.id
            ORDER BY p.name ASC
        `).all();

        const result = {
            featured_products: featuredProducts,
            available_products: availableProducts,
            stats: {
                featured_count: featuredProducts.length,
                max_featured: MAX_FEATURED_PRODUCTS,
                total_products: totalProducts,
                available_slots: MAX_FEATURED_PRODUCTS - featuredProducts.length
            }
        };

        // Cache kết quả
        cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        return jsonResponse({
            success: true,
            ...result,
            cached: false
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting featured products for admin:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ➕ Thêm sản phẩm vào featured
export async function addFeaturedProduct(data, env, corsHeaders) {
    try {
        const { product_id } = data;

        if (!product_id) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Kiểm tra sản phẩm tồn tại và active
        const product = await env.DB.prepare(`
            SELECT id, name, is_featured FROM products WHERE id = ? AND is_active = 1
        `).bind(product_id).first();

        if (!product) {
            return jsonResponse({
                success: false,
                error: 'Product not found or inactive'
            }, 404, corsHeaders);
        }

        if (product.is_featured) {
            return jsonResponse({
                success: false,
                error: 'Product is already featured'
            }, 400, corsHeaders);
        }

        // Kiểm tra giới hạn số lượng
        const { count } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM products WHERE is_featured = 1
        `).first();

        if (count >= MAX_FEATURED_PRODUCTS) {
            return jsonResponse({
                success: false,
                error: `Maximum ${MAX_FEATURED_PRODUCTS} featured products allowed`
            }, 400, corsHeaders);
        }

        // Lấy featured_order tiếp theo
        const { max_order } = await env.DB.prepare(`
            SELECT COALESCE(MAX(featured_order), 0) as max_order FROM products WHERE is_featured = 1
        `).first();

        const now = Math.floor(Date.now() / 1000);

        // Cập nhật sản phẩm thành featured
        await env.DB.prepare(`
            UPDATE products 
            SET is_featured = ?, 
                featured_order = ?, 
                featured_at_unix = ?
            WHERE id = ?
        `).bind(1, max_order + 1, now, product_id).run();

        // Clear cache
        clearCache('featured');

        return jsonResponse({
            success: true,
            message: `Product "${product.name}" added to featured products`,
            featured_order: max_order + 1
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error adding featured product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ➖ Xóa sản phẩm khỏi featured
export async function removeFeaturedProduct(data, env, corsHeaders) {
    try {
        const { product_id } = data;

        if (!product_id) {
            return jsonResponse({
                success: false,
                error: 'Product ID is required'
            }, 400, corsHeaders);
        }

        // Kiểm tra sản phẩm có trong featured không
        const product = await env.DB.prepare(`
            SELECT id, name, featured_order FROM products 
            WHERE id = ? AND is_featured = 1
        `).bind(product_id).first();

        if (!product) {
            return jsonResponse({
                success: false,
                error: 'Product is not in featured list'
            }, 404, corsHeaders);
        }

        // Xóa khỏi featured
        await env.DB.prepare(`
            UPDATE products 
            SET is_featured = 0, 
                featured_order = NULL, 
                featured_at_unix = NULL
            WHERE id = ?
        `).bind(product_id).run();

        // Cập nhật lại featured_order cho các sản phẩm còn lại
        await env.DB.prepare(`
            UPDATE products 
            SET featured_order = featured_order - 1
            WHERE is_featured = 1 AND featured_order > ?
        `).bind(product.featured_order).run();

        // Clear cache
        clearCache('featured');

        return jsonResponse({
            success: true,
            message: `Product "${product.name}" removed from featured products`
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error removing featured product:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// 🔄 Sắp xếp lại thứ tự featured products
export async function reorderFeaturedProducts(data, env, corsHeaders) {
    try {
        console.log('🔄 [REORDER] Starting reorder with data:', data);
        const { product_orders } = data;

        if (!Array.isArray(product_orders) || product_orders.length === 0) {
            console.log('❌ [REORDER] Invalid product_orders:', product_orders);
            return jsonResponse({
                success: false,
                error: 'Product orders array is required'
            }, 400, corsHeaders);
        }

        console.log('📦 [REORDER] Processing', product_orders.length, 'products');
        
        // Validate data structure
        for (const item of product_orders) {
            if (!item.product_id || !item.display_order) {
                console.log('❌ [REORDER] Invalid item structure:', item);
                return jsonResponse({
                    success: false,
                    error: 'Each item must have product_id and display_order'
                }, 400, corsHeaders);
            }
        }

        // Sử dụng individual updates thay vì batch để debug dễ hơn
        console.log('💾 [REORDER] Executing individual updates...');
        
        for (let i = 0; i < product_orders.length; i++) {
            const item = product_orders[i];
            const productId = parseInt(item.product_id);
            const displayOrder = parseInt(item.display_order);
            
            console.log(`🔄 [REORDER] Updating product ${productId} to order ${displayOrder}`);
            
            try {
                const result = await env.DB.prepare(`
                    UPDATE products 
                    SET featured_order = ?
                    WHERE id = ? AND is_featured = 1
                `).bind(displayOrder, productId).run();
                
                console.log(`✅ [REORDER] Updated product ${productId}, changes: ${result.changes}`);
            } catch (error) {
                console.error(`❌ [REORDER] Failed to update product ${productId}:`, error);
                throw error;
            }
        }

        // Clear cache
        clearCache('featured');
        console.log('🗑️ [REORDER] Cache cleared');

        return jsonResponse({
            success: true,
            message: 'Featured products reordered successfully',
            updated_count: product_orders.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ [REORDER] Error reordering featured products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// 📊 Lấy thống kê featured products
export async function getFeaturedStats(env, corsHeaders) {
    try {
        const stats = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_featured,
                MIN(featured_at_unix) as oldest_featured,
                MAX(featured_at_unix) as newest_featured
            FROM products
            WHERE is_featured = 1
        `).first();

        return jsonResponse({
            success: true,
            stats: {
                ...stats,
                max_allowed: MAX_FEATURED_PRODUCTS,
                available_slots: MAX_FEATURED_PRODUCTS - stats.total_featured,
                cache_entries: cache.size
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting featured stats:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ➕ Thêm nhiều sản phẩm vào featured cùng lúc
export async function addMultipleFeaturedProducts(data, env, corsHeaders) {
    try {
        console.log('🔥 [FEATURED] Adding multiple products:', data);
        const { product_ids } = data;

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            console.log('❌ [FEATURED] Invalid product_ids:', product_ids);
            return jsonResponse({
                success: false,
                error: 'Product IDs array is required'
            }, 400, corsHeaders);
        }

        console.log('📦 [FEATURED] Processing product IDs:', product_ids);

        // Kiểm tra giới hạn số lượng hiện tại
        const { count: currentCount } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM products WHERE is_featured = 1
        `).first();

        console.log('📊 [FEATURED] Current featured count:', currentCount);

        const availableSlots = MAX_FEATURED_PRODUCTS - currentCount;
        
        if (product_ids.length > availableSlots) {
            console.log('⚠️ [FEATURED] Not enough slots:', { requested: product_ids.length, available: availableSlots });
            return jsonResponse({
                success: false,
                error: `Chỉ có thể thêm ${availableSlots} sản phẩm nữa (${currentCount}/${MAX_FEATURED_PRODUCTS})`
            }, 400, corsHeaders);
        }

        // Kiểm tra sản phẩm tồn tại và chưa featured
        let products = [];
        
        // Query từng sản phẩm để tránh lỗi SQL với IN clause
        for (const productId of product_ids) {
            console.log('🔍 [FEATURED] Checking product:', productId, typeof productId);
            
            // Đảm bảo productId là number
            const numericId = parseInt(productId);
            if (isNaN(numericId)) {
                console.log('❌ [FEATURED] Invalid product ID:', productId);
                continue;
            }
            
            try {
                const product = await env.DB.prepare(`
                    SELECT id, name, is_featured FROM products 
                    WHERE id = ? AND is_active = 1
                `).bind(numericId).first();
                
                if (product) {
                    console.log('✅ [FEATURED] Product found:', product);
                    products.push(product);
                } else {
                    console.log('❌ [FEATURED] Product not found or inactive:', numericId);
                }
            } catch (error) {
                console.error('❌ [FEATURED] Query error for product', numericId, ':', error);
            }
        }

        if (products.length !== product_ids.length) {
            console.log('⚠️ [FEATURED] Some products not found:', { requested: product_ids.length, found: products.length });
            return jsonResponse({
                success: false,
                error: 'Một số sản phẩm không tồn tại hoặc không hoạt động'
            }, 400, corsHeaders);
        }

        // Lọc ra sản phẩm chưa featured
        const newProducts = products.filter(p => !p.is_featured);
        console.log('🆕 [FEATURED] New products to add:', newProducts.length);
        
        if (newProducts.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Tất cả sản phẩm đã có trong danh sách nổi bật'
            }, 400, corsHeaders);
        }

        // Lấy featured_order tiếp theo
        const { max_order } = await env.DB.prepare(`
            SELECT COALESCE(MAX(featured_order), 0) as max_order FROM products WHERE is_featured = 1
        `).first();

        console.log('📈 [FEATURED] Max order:', max_order);

        const now = Math.floor(Date.now() / 1000);

        // Batch update các sản phẩm thành featured
        const updatePromises = newProducts.map((product, index) => {
            const newOrder = max_order + index + 1;
            const numericId = parseInt(product.id);
            console.log(`🔄 [FEATURED] Updating product ${numericId} with order ${newOrder}`);
            
            return env.DB.prepare(`
                UPDATE products 
                SET is_featured = 1, 
                    featured_order = ${newOrder}, 
                    featured_at_unix = ${now}
                WHERE id = ${numericId}
            `);
        });

        console.log('💾 [FEATURED] Executing individual updates...');
        
        // Update từng sản phẩm thay vì batch
        for (let i = 0; i < newProducts.length; i++) {
            const product = newProducts[i];
            const newOrder = max_order + i + 1;
            const numericId = parseInt(product.id);
            
            console.log(`🔄 [FEATURED] Updating product ${numericId} with order ${newOrder}`);
            
            try {
                await env.DB.prepare(`
                    UPDATE products 
                    SET is_featured = ?, 
                        featured_order = ?, 
                        featured_at_unix = ?
                    WHERE id = ?
                `).bind(1, newOrder, now, numericId).run();
                
                console.log(`✅ [FEATURED] Updated product ${numericId}`);
            } catch (error) {
                console.error(`❌ [FEATURED] Failed to update product ${numericId}:`, error);
                throw error;
            }
        }

        // Clear cache
        clearCache('featured');
        console.log('🗑️ [FEATURED] Cache cleared');

        const skippedCount = products.length - newProducts.length;
        let message = `Đã thêm ${newProducts.length} sản phẩm vào nổi bật`;
        if (skippedCount > 0) {
            message += ` (${skippedCount} sản phẩm đã có sẵn)`;
        }

        console.log('✅ [FEATURED] Success:', message);

        return jsonResponse({
            success: true,
            message,
            added_count: newProducts.length,
            skipped_count: skippedCount,
            total_requested: product_ids.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ [FEATURED] Error adding multiple featured products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ➖ Xóa nhiều sản phẩm khỏi featured cùng lúc
export async function removeMultipleFeaturedProducts(data, env, corsHeaders) {
    try {
        console.log('🗑️ [FEATURED] Removing multiple products:', data);
        const { product_ids } = data;

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            console.log('❌ [FEATURED] Invalid product_ids:', product_ids);
            return jsonResponse({
                success: false,
                error: 'Product IDs array is required'
            }, 400, corsHeaders);
        }

        console.log('📦 [FEATURED] Processing product IDs for removal:', product_ids);

        // Kiểm tra sản phẩm có trong featured không
        let products = [];
        
        for (const productId of product_ids) {
            console.log('🔍 [FEATURED] Checking featured product:', productId, typeof productId);
            
            // Đảm bảo productId là number
            const numericId = parseInt(productId);
            if (isNaN(numericId)) {
                console.log('❌ [FEATURED] Invalid product ID:', productId);
                continue;
            }
            
            try {
                const product = await env.DB.prepare(`
                    SELECT id, name, is_featured, featured_order FROM products 
                    WHERE id = ? AND is_active = 1
                `).bind(numericId).first();
                
                if (product) {
                    console.log('✅ [FEATURED] Product found:', product);
                    products.push(product);
                } else {
                    console.log('❌ [FEATURED] Product not found or inactive:', numericId);
                }
            } catch (error) {
                console.error('❌ [FEATURED] Query error for product', numericId, ':', error);
            }
        }

        if (products.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy sản phẩm nào để xóa'
            }, 400, corsHeaders);
        }

        // Lọc ra sản phẩm đang featured
        const featuredProducts = products.filter(p => p.is_featured);
        console.log('🗑️ [FEATURED] Featured products to remove:', featuredProducts.length);
        
        if (featuredProducts.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Không có sản phẩm nào trong danh sách nổi bật'
            }, 400, corsHeaders);
        }

        console.log('💾 [FEATURED] Executing individual removals...');
        
        // Xóa từng sản phẩm khỏi featured
        for (const product of featuredProducts) {
            const numericId = parseInt(product.id);
            
            console.log(`🗑️ [FEATURED] Removing product ${numericId} from featured`);
            
            try {
                await env.DB.prepare(`
                    UPDATE products 
                    SET is_featured = 0, 
                        featured_order = NULL, 
                        featured_at_unix = NULL
                    WHERE id = ?
                `).bind(numericId).run();
                
                console.log(`✅ [FEATURED] Removed product ${numericId}`);
            } catch (error) {
                console.error(`❌ [FEATURED] Failed to remove product ${numericId}:`, error);
                throw error;
            }
        }

        // Cập nhật lại featured_order cho các sản phẩm còn lại
        console.log('🔄 [FEATURED] Reordering remaining featured products...');
        
        try {
            // Lấy tất cả sản phẩm featured còn lại, sắp xếp theo order cũ
            const { results: remainingProducts } = await env.DB.prepare(`
                SELECT id, featured_order FROM products 
                WHERE is_featured = 1 
                ORDER BY featured_order ASC
            `).all();

            // Cập nhật lại order từ 1, 2, 3...
            for (let i = 0; i < remainingProducts.length; i++) {
                const product = remainingProducts[i];
                const newOrder = i + 1;
                
                await env.DB.prepare(`
                    UPDATE products 
                    SET featured_order = ?
                    WHERE id = ?
                `).bind(newOrder, product.id).run();
            }
            
            console.log(`✅ [FEATURED] Reordered ${remainingProducts.length} remaining products`);
        } catch (error) {
            console.error('❌ [FEATURED] Failed to reorder products:', error);
            // Không throw error vì việc xóa đã thành công
        }

        // Clear cache
        clearCache('featured');
        console.log('🗑️ [FEATURED] Cache cleared');

        const skippedCount = products.length - featuredProducts.length;
        let message = `Đã xóa ${featuredProducts.length} sản phẩm khỏi nổi bật`;
        if (skippedCount > 0) {
            message += ` (${skippedCount} sản phẩm không có trong danh sách)`;
        }

        console.log('✅ [FEATURED] Bulk removal success:', message);

        return jsonResponse({
            success: true,
            message,
            removed_count: featuredProducts.length,
            skipped_count: skippedCount,
            total_requested: product_ids.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ [FEATURED] Error removing multiple featured products:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// 🗑️ Clear cache manually (Admin utility)
export async function clearFeaturedCache(env, corsHeaders) {
    try {
        const cacheSize = cache.size;
        clearCache();
        
        return jsonResponse({
            success: true,
            message: `Cache cleared successfully`,
            cleared_entries: cacheSize
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error clearing cache:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}