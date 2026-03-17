import bcrypt from 'bcryptjs';
import { jsonResponse } from '../utils/response.js';
import { generateSessionToken } from './session.js';

// Login endpoint
export async function handleLogin(data, request, env, corsHeaders) {
    console.log('🔐 [LOGIN] Starting login process...');
    console.log('   Request data:', { username: data?.username, hasPassword: !!data?.password });
    console.log('   Environment DB:', !!env?.DB);
    
    try {
        const { username, password } = data;

        if (!username || !password) {
            console.log('❌ [LOGIN] Missing username or password');
            return jsonResponse({
                success: false,
                error: 'Username và password là bắt buộc'
            }, 400, corsHeaders);
        }

        console.log('✅ [LOGIN] Username and password provided');

        // Get user from database
        console.log('🔍 [LOGIN] Querying database for user:', username);
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE username = ? AND is_active = 1
        `).bind(username).first();

        console.log('📦 [LOGIN] Database query result:', user ? 'USER_FOUND' : 'USER_NOT_FOUND');
        if (user) {
            console.log('   User ID:', user.id);
            console.log('   User role:', user.role);
            console.log('   Has password hash:', !!user.password_hash);
        }

        if (!user) {
            console.log('❌ [LOGIN] User not found or inactive');
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            }, 401, corsHeaders);
        }

        // Verify password using bcrypt
        console.log('🔑 [LOGIN] Verifying password with bcrypt...');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        console.log('   Password valid:', isValidPassword);

        if (!isValidPassword) {
            console.log('❌ [LOGIN] Invalid password');
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            }, 401, corsHeaders);
        }

        console.log('✅ [LOGIN] Password verified successfully');

        // Create session
        console.log('🎫 [LOGIN] Creating session token...');
        const sessionToken = generateSessionToken();
        const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
        const now = Math.floor(Date.now() / 1000);

        console.log('   Session token generated:', sessionToken.substring(0, 8) + '...');
        console.log('   Expires at:', new Date(expiresAt * 1000).toISOString());

        console.log('💾 [LOGIN] Saving session to database...');
        await env.DB.prepare(`
            INSERT INTO sessions (id, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        `).bind(sessionToken, user.id, expiresAt, now).run();

        console.log('✅ [LOGIN] Session saved successfully');

        const responseData = {
            success: true,
            sessionToken,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        };

        console.log('🎉 [LOGIN] Login successful! Returning response:', {
            success: responseData.success,
            hasSessionToken: !!responseData.sessionToken,
            user: responseData.user
        });

        return jsonResponse(responseData, 200, corsHeaders);

    } catch (error) {
        console.error('💥 [LOGIN] Login error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        return jsonResponse({
            success: false,
            error: 'Lỗi đăng nhập: ' + error.message
        }, 500, corsHeaders);
    }
}
