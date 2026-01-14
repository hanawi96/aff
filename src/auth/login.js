import bcrypt from 'bcryptjs';
import { jsonResponse } from '../utils/response.js';
import { generateSessionToken } from './session.js';

// Login endpoint
export async function handleLogin(data, request, env, corsHeaders) {
    try {
        const { username, password } = data;

        if (!username || !password) {
            return jsonResponse({
                success: false,
                error: 'Username và password là bắt buộc'
            }, 400, corsHeaders);
        }

        // Get user from database
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE username = ? AND is_active = 1
        `).bind(username).first();

        if (!user) {
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            }, 401, corsHeaders);
        }

        // Verify password using bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            }, 401, corsHeaders);
        }

        // Create session
        const sessionToken = generateSessionToken();
        const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
        const now = Math.floor(Date.now() / 1000);

        await env.DB.prepare(`
            INSERT INTO sessions (id, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        `).bind(sessionToken, user.id, expiresAt, now).run();

        return jsonResponse({
            success: true,
            sessionToken,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Login error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi đăng nhập: ' + error.message
        }, 500, corsHeaders);
    }
}
