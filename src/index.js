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
import { snapshotYesterdayAdSpend } from './services/settings/ad-spend.js';

async function handleRequest(request, env, ctx) {
    const DB = initTurso(env);
    env.DB = DB;
    env.ctx = ctx;

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

        console.log('🌐 [MAIN] Incoming request:');
        console.log('   Method:', request.method);
        console.log('   Path:', path);
        console.log('   Action:', action);
        console.log('   Origin:', request.headers.get('Origin'));
        console.log('   User-Agent:', request.headers.get('User-Agent')?.substring(0, 50) + '...');

        if (path.startsWith('/api/shop/') || path.match(/^\/api\/products\/\d+\/favorite$/)) {
            console.log('🏪 [MAIN] Routing to Shop API');
            return await handleShopRoutes(request, env, corsHeaders, ctx);
        }

        if (path === '/api/telegram/webhook' && request.method === 'POST') {
            console.log('📱 [MAIN] Routing to Telegram webhook');
            const update = await request.json();
            return await handleTelegramWebhook(update, env);
        }

        if (request.method === 'GET') {
            console.log('📥 [MAIN] Routing to GET handler');
            return await handleGet(action, url, request, env, corsHeaders);
        }
        if (request.method === 'POST') {
            if (action) {
                console.log('📤 [MAIN] Routing to POST with action handler');
                return await handlePostWithAction(action, request, env, corsHeaders);
            }
            console.log('📤 [MAIN] Routing to POST handler');
            return await handlePost(path, request, env, corsHeaders);
        }

        console.log('❌ [MAIN] Method not allowed:', request.method);
        return jsonResponse({ success: false, error: 'Method not allowed' }, 405, corsHeaders);
    } catch (error) {
        console.error('💥 [MAIN] Worker error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

export default {
    async fetch(request, env, ctx) {
        try {
            return await handleRequest(request, env, ctx);
        } catch (error) {
            console.error('💥 [MAIN] Unhandled worker error:', error);
            return jsonResponse({
                success: false,
                error: error?.message || 'Internal server error'
            }, 500, corsHeaders);
        }
    },

    // Cron trigger for daily report at 21:00 Vietnam time (14:00 UTC)
    async scheduled(event, env, ctx) {
        console.log('⏰ Cron triggered:', event.cron, new Date().toISOString());

        const DB = initTurso(env);
        env.DB = DB;

        // 00:00 VN (17:00 UTC) — chốt chi QC hôm qua vào daily_ad_spend
        if (event.cron === '0 17 * * *') {
            try {
                await snapshotYesterdayAdSpend(env);
            } catch (err) {
                console.error('💥 [CRON] Ad spend snapshot failed:', err);
            }
            return;
        }

        // 21:00 VN (14:00 UTC) — báo cáo Telegram hàng ngày
        await sendDailyReport(env);
    }
};
