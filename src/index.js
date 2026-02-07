// CTV Management System API - Powered by Turso Database
// Main Entry Point - Refactored Version

import { initTurso } from '../database/turso-client.js';
import { corsHeaders } from './config/cors.js';
import { jsonResponse } from './utils/response.js';
import { handleGet } from './handlers/get-handler.js';
import { handlePost, handlePostWithAction } from './handlers/post-handler.js';
import { handleShopRoutes } from '../public/shop/api/routes.js';
import { handleTelegramWebhook } from './services/notifications/telegram-commands.js';
import { sendDailyReport } from './services/notifications/daily-report.js';

export default {
    async fetch(request, env, ctx) {
        // Initialize Turso database connection
        const DB = initTurso(env);
        env.DB = DB;
        env.ctx = ctx; // Pass context for waitUntil support

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: corsHeaders,
            });
        }

        try {
            const url = new URL(request.url);
            const path = url.pathname;
            const action = url.searchParams.get('action');

            // Route to Shop API (public - no auth)
            if (path.startsWith('/api/shop/') || path.match(/^\/api\/products\/\d+\/favorite$/)) {
                return await handleShopRoutes(request, env, corsHeaders, ctx);
            }

            // Telegram Webhook Handler
            if (path === '/api/telegram/webhook' && request.method === 'POST') {
                const update = await request.json();
                return await handleTelegramWebhook(update, env);
            }

            // Route handling for admin/legacy
            if (request.method === 'GET') {
                return await handleGet(action, url, request, env, corsHeaders);
            } else if (request.method === 'POST') {
                // Check if action is in query string (for API calls with ?action=xxx)
                if (action) {
                    return await handlePostWithAction(action, request, env, corsHeaders);
                }
                return await handlePost(path, request, env, corsHeaders);
            }

            return jsonResponse({ success: false, error: 'Method not allowed' }, 405, corsHeaders);

        } catch (error) {
            console.error('Worker error:', error);
            return jsonResponse({
                success: false,
                error: error.message
            }, 500, corsHeaders);
        }
    },

    // Cron trigger for daily report at 21:00 Vietnam time (14:00 UTC)
    async scheduled(event, env, ctx) {
        console.log('⏰ Cron triggered:', new Date().toISOString());
        
        // Initialize database
        const DB = initTurso(env);
        env.DB = DB;
        
        // Send daily report
        await sendDailyReport(env);
    }
};
