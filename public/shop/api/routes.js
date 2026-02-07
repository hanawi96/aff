// ============================================
// SHOP API ROUTES - Public endpoints (no auth required)
// ============================================

import { createShopOrder, getShopProducts } from './handlers/orders.js';
import { getActiveProducts, addProductFavorite, removeProductFavorite, getMostFavorited } from './handlers/products.js';
import { registerCTV } from './handlers/ctv.js';
import { jsonResponse } from '../../../src/utils/response.js';

/**
 * Handle all shop API routes
 * Base path: /api/shop/*
 */
export async function handleShopRoutes(request, env, corsHeaders, ctx) {
    // Add ctx to env for waitUntil support
    if (ctx) {
        env.ctx = ctx;
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
        // POST /api/shop/order - Create order from shop
        if (path === '/api/shop/order' && method === 'POST') {
            return await createShopOrder(request, env, corsHeaders);
        }

        // GET /api/shop/products - Get active products
        if (path === '/api/shop/products' && method === 'GET') {
            return await getActiveProducts(request, env, corsHeaders);
        }

        // POST /api/shop/ctv/register - Register CTV from shop
        if (path === '/api/shop/ctv/register' && method === 'POST') {
            return await registerCTV(request, env, corsHeaders);
        }

        // POST /api/products/{id}/favorite - Add favorite
        const favoriteMatch = path.match(/^\/api\/products\/(\d+)\/favorite$/);
        if (favoriteMatch && method === 'POST') {
            const productId = parseInt(favoriteMatch[1]);
            return await addProductFavorite(productId, env, corsHeaders);
        }

        // DELETE /api/products/{id}/favorite - Remove favorite
        if (favoriteMatch && method === 'DELETE') {
            const productId = parseInt(favoriteMatch[1]);
            return await removeProductFavorite(productId, env, corsHeaders);
        }

        // GET /api/products/most-favorited - Get most favorited products
        if (path === '/api/products/most-favorited' && method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit')) || 10;
            return await getMostFavorited(env, corsHeaders, limit);
        }

        // Not found
        return jsonResponse({
            success: false,
            error: 'Shop API endpoint not found'
        }, 404, corsHeaders);

    } catch (error) {
        console.error('Shop API error:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
