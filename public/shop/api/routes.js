// ============================================
// SHOP API ROUTES - Public endpoints (no auth required)
// ============================================

import { createShopOrder, getShopProducts } from './handlers/orders.js';
import { getActiveProducts } from './handlers/products.js';
import { registerCTV } from './handlers/ctv.js';
import { jsonResponse } from '../../../src/utils/response.js';

/**
 * Handle all shop API routes
 * Base path: /api/shop/*
 */
export async function handleShopRoutes(request, env, corsHeaders) {
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
