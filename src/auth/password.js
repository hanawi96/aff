import bcrypt from 'bcryptjs';
import { jsonResponse } from '../utils/response.js';
import { verifySession } from './session.js';

// Change password endpoint
export async function handleChangePassword(data, request, env, corsHeaders) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Unauthorized'
        }, 401, corsHeaders);
    }

    try {
        const { currentPassword, newPassword } = data;

        if (!currentPassword || !newPassword) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc'
            }, 400, corsHeaders);
        }

        if (newPassword.length < 6) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            }, 400, corsHeaders);
        }

        // Get current user
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(session.user_id).first();

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            return jsonResponse({
                success: false,
                error: 'Mật khẩu hiện tại không đúng'
            }, 401, corsHeaders);
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        const now = Math.floor(Date.now() / 1000);

        // Update password
        await env.DB.prepare(`
            UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
        `).bind(newPasswordHash, now, session.user_id).run();

        return jsonResponse({
            success: true,
            message: 'Đổi mật khẩu thành công'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Change password error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi đổi mật khẩu: ' + error.message
        }, 500, corsHeaders);
    }
}
