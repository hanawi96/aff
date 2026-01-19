// CTV Management System API - Powered by Turso Database
// Main Entry Point - Refactored Version

import { initTurso } from '../database/turso-client.js';
import { corsHeaders } from './config/cors.js';
import { jsonResponse } from './utils/response.js';
import { handleGet } from './handlers/get-handler.js';
import { handlePost, handlePostWithAction } from './handlers/post-handler.js';

export default {
    async fetch(request, env, ctx) {
        // Initialize Turso database connection
        const DB = initTurso(env);
        env.DB = DB;

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

            // Route handling
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
};
