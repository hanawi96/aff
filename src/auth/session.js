import { jsonResponse } from '../utils/response.js';

// Helper: Generate session token
function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Helper: Verify session token
export async function verifySession(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const now = Math.floor(Date.now() / 1000);

    const result = await env.DB.prepare(`
        SELECT s.*, u.id as user_id, u.username, u.full_name, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1
    `).bind(token, now).first();

    return result;
}

// Verify session endpoint
export async function handleVerifySession(request, env, corsHeaders) {
    const session = await verifySession(request, env);

    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Session không hợp lệ hoặc đã hết hạn'
        }, 401, corsHeaders);
    }

    return jsonResponse({
        success: true,
        user: {
            id: session.user_id,
            username: session.username,
            full_name: session.full_name,
            role: session.role
        }
    }, 200, corsHeaders);
}

// Logout endpoint
export async function handleLogout(request, env, corsHeaders) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({
            success: false,
            error: 'Không tìm thấy session token'
        }, 400, corsHeaders);
    }

    const token = authHeader.substring(7);

    await env.DB.prepare(`
        DELETE FROM sessions WHERE id = ?
    `).bind(token).run();

    return jsonResponse({
        success: true,
        message: 'Đăng xuất thành công'
    }, 200, corsHeaders);
}

// Export generateSessionToken for use in login
export { generateSessionToken };
