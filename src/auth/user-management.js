import bcrypt from 'bcryptjs';
import { jsonResponse } from '../utils/response.js';
import { verifySession } from './session.js';

// Create new admin user
export async function handleCreateUser(data, request, env, corsHeaders) {
    // Verify session
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Unauthorized'
        }, 401, corsHeaders);
    }

    try {
        const { username, password, full_name } = data;

        // Validation
        if (!username || !password || !full_name) {
            return jsonResponse({
                success: false,
                error: 'Username, password và họ tên là bắt buộc'
            }, 400, corsHeaders);
        }

        if (username.length < 3) {
            return jsonResponse({
                success: false,
                error: 'Username phải có ít nhất 3 ký tự'
            }, 400, corsHeaders);
        }

        if (password.length < 6) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu phải có ít nhất 6 ký tự'
            }, 400, corsHeaders);
        }

        // Check if username already exists
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ?
        `).bind(username).first();

        if (existingUser) {
            return jsonResponse({
                success: false,
                error: 'Username đã tồn tại'
            }, 400, corsHeaders);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        const now = Math.floor(Date.now() / 1000);

        // Insert new user
        const result = await env.DB.prepare(`
            INSERT INTO users (username, password_hash, full_name, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 'admin', 1, ?, ?)
        `).bind(username, passwordHash, full_name, now, now).run();

        if (result.success) {
            return jsonResponse({
                success: true,
                message: 'Tạo admin thành công',
                user: {
                    id: result.meta.last_row_id,
                    username,
                    full_name,
                    role: 'admin'
                }
            }, 200, corsHeaders);
        } else {
            throw new Error('Failed to create user');
        }

    } catch (error) {
        console.error('Create user error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi tạo admin: ' + error.message
        }, 500, corsHeaders);
    }
}

// Get all users
export async function handleGetAllUsers(request, env, corsHeaders) {
    // Verify session
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Unauthorized'
        }, 401, corsHeaders);
    }

    try {
        const users = await env.DB.prepare(`
            SELECT id, username, full_name, role, is_active, created_at, updated_at
            FROM users 
            WHERE is_active = 1
            ORDER BY created_at DESC
        `).all();

        return jsonResponse({
            success: true,
            users: users.results || []
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Get users error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi tải danh sách admin: ' + error.message
        }, 500, corsHeaders);
    }
}