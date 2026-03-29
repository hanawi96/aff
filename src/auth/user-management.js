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
        const { username: rawUsername, password, full_name } = data;
        const username = String(rawUsername || '').trim();

        // Validation
        if (!username || !password || !full_name) {
            return jsonResponse({
                success: false,
                error: 'Username, password và họ tên là bắt buộc'
            }, 400, corsHeaders);
        }

        if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập không hợp lệ: dùng 3–32 ký tự, chỉ chữ Latin không dấu, số và dấu _'
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

// Delete single admin user (soft delete)
export async function handleDeleteUser(data, request, env, corsHeaders) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Unauthorized'
        }, 401, corsHeaders);
    }

    try {
        const userId = parseInt(data?.id, 10);
        if (!userId || Number.isNaN(userId)) {
            return jsonResponse({
                success: false,
                error: 'ID user không hợp lệ'
            }, 400, corsHeaders);
        }

        if (userId === Number(session.user_id)) {
            return jsonResponse({
                success: false,
                error: 'Bạn không thể tự xóa tài khoản đang đăng nhập'
            }, 400, corsHeaders);
        }

        const target = await env.DB.prepare(`
            SELECT id, username, is_active
            FROM users
            WHERE id = ?
        `).bind(userId).first();

        if (!target) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy tài khoản'
            }, 404, corsHeaders);
        }

        if (Number(target.is_active) === 0) {
            return jsonResponse({
                success: true,
                message: 'Tài khoản đã bị vô hiệu hóa trước đó'
            }, 200, corsHeaders);
        }

        const activeCountRow = await env.DB.prepare(`
            SELECT COUNT(*) as cnt
            FROM users
            WHERE is_active = 1
        `).first();
        const activeCount = Number(activeCountRow?.cnt || 0);
        if (activeCount <= 1) {
            return jsonResponse({
                success: false,
                error: 'Không thể xóa admin cuối cùng của hệ thống'
            }, 400, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(`
            UPDATE users
            SET is_active = 0, updated_at = ?
            WHERE id = ?
        `).bind(now, userId).run();

        // Force logout deleted user (best effort)
        await env.DB.prepare(`
            DELETE FROM sessions WHERE user_id = ?
        `).bind(userId).run();

        return jsonResponse({
            success: true,
            message: 'Đã xóa tài khoản admin thành công'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Delete user error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi xóa admin: ' + error.message
        }, 500, corsHeaders);
    }
}

// Bulk delete admin users (soft delete)
export async function handleBulkDeleteUsers(data, request, env, corsHeaders) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({
            success: false,
            error: 'Unauthorized'
        }, 401, corsHeaders);
    }

    try {
        const idsInput = Array.isArray(data?.ids) ? data.ids : [];
        const uniqueIds = [...new Set(idsInput
            .map((id) => parseInt(id, 10))
            .filter((id) => id && !Number.isNaN(id))
        )];

        if (uniqueIds.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Danh sách ID cần xóa đang trống'
            }, 400, corsHeaders);
        }

        const selfId = Number(session.user_id);
        const targetIds = uniqueIds.filter((id) => id !== selfId);
        const skippedSelf = uniqueIds.length - targetIds.length;

        if (targetIds.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Không có tài khoản hợp lệ để xóa (không thể tự xóa chính mình)'
            }, 400, corsHeaders);
        }

        const activeCountRow = await env.DB.prepare(`
            SELECT COUNT(*) as cnt
            FROM users
            WHERE is_active = 1
        `).first();
        const activeCount = Number(activeCountRow?.cnt || 0);

        // Only active targets will be deleted
        const placeholders = targetIds.map(() => '?').join(',');
        const { results: activeTargets } = await env.DB.prepare(`
            SELECT id
            FROM users
            WHERE is_active = 1
              AND id IN (${placeholders})
        `).bind(...targetIds).all();
        const activeTargetIds = (activeTargets || []).map((u) => Number(u.id));

        if (activeTargetIds.length === 0) {
            return jsonResponse({
                success: true,
                deleted_count: 0,
                skipped_self: skippedSelf,
                message: 'Không có tài khoản đang hoạt động để xóa'
            }, 200, corsHeaders);
        }

        if ((activeCount - activeTargetIds.length) < 1) {
            return jsonResponse({
                success: false,
                error: 'Không thể xóa hết admin. Hệ thống cần ít nhất 1 admin hoạt động.'
            }, 400, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);
        const activePlaceholders = activeTargetIds.map(() => '?').join(',');

        await env.DB.prepare(`
            UPDATE users
            SET is_active = 0, updated_at = ?
            WHERE id IN (${activePlaceholders})
        `).bind(now, ...activeTargetIds).run();

        await env.DB.prepare(`
            DELETE FROM sessions
            WHERE user_id IN (${activePlaceholders})
        `).bind(...activeTargetIds).run();

        return jsonResponse({
            success: true,
            deleted_count: activeTargetIds.length,
            skipped_self: skippedSelf,
            message: `Đã xóa ${activeTargetIds.length} tài khoản admin`
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Bulk delete users error:', error);
        return jsonResponse({
            success: false,
            error: 'Lỗi xóa hàng loạt admin: ' + error.message
        }, 500, corsHeaders);
    }
}

// Update existing admin user
export async function handleUpdateUser(data, request, env, corsHeaders) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
    }

    try {
        const targetId = parseInt(data?.id, 10);
        if (!targetId || Number.isNaN(targetId)) {
            return jsonResponse({ success: false, error: 'ID user không hợp lệ' }, 400, corsHeaders);
        }

        const { username: rawUsername, full_name, role, password } = data;
        const username = String(rawUsername || '').trim();

        if (!username || !full_name) {
            return jsonResponse({ success: false, error: 'Username và họ tên là bắt buộc' }, 400, corsHeaders);
        }

        if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
            return jsonResponse({
                success: false,
                error: 'Tên đăng nhập không hợp lệ: dùng 3–32 ký tự, chỉ chữ Latin không dấu, số và dấu _'
            }, 400, corsHeaders);
        }

        if (role && !['admin'].includes(role)) {
            return jsonResponse({ success: false, error: 'Vai trò không hợp lệ' }, 400, corsHeaders);
        }

        if (password !== undefined && password !== null && password !== '') {
            if (String(password).length < 6) {
                return jsonResponse({ success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' }, 400, corsHeaders);
            }
        }

        const target = await env.DB.prepare(`
            SELECT id, username, is_active FROM users WHERE id = ?
        `).bind(targetId).first();

        if (!target) {
            return jsonResponse({ success: false, error: 'Không tìm thấy tài khoản' }, 404, corsHeaders);
        }

        if (Number(target.is_active) === 0) {
            return jsonResponse({ success: false, error: 'Tài khoản đã bị vô hiệu hóa, không thể sửa' }, 400, corsHeaders);
        }

        if (username !== target.username) {
            const conflict = await env.DB.prepare(`
                SELECT id FROM users WHERE username = ? AND id != ?
            `).bind(username, targetId).first();
            if (conflict) {
                return jsonResponse({ success: false, error: 'Username đã tồn tại, vui lòng chọn tên khác' }, 400, corsHeaders);
            }
        }

        const now = Math.floor(Date.now() / 1000);

        if (password !== undefined && password !== null && password !== '') {
            const passwordHash = await bcrypt.hash(String(password), 10);
            await env.DB.prepare(`
                UPDATE users
                SET username = ?, full_name = ?, role = ?, password_hash = ?, updated_at = ?
                WHERE id = ?
            `).bind(username, full_name.trim(), role || 'admin', passwordHash, now, targetId).run();
        } else {
            await env.DB.prepare(`
                UPDATE users
                SET username = ?, full_name = ?, role = ?, updated_at = ?
                WHERE id = ?
            `).bind(username, full_name.trim(), role || 'admin', now, targetId).run();
        }

        return jsonResponse({
            success: true,
            message: 'Cập nhật tài khoản thành công',
            user: {
                id: targetId,
                username,
                full_name: full_name.trim(),
                role: role || 'admin'
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Update user error:', error);
        return jsonResponse({ success: false, error: 'Lỗi cập nhật admin: ' + error.message }, 500, corsHeaders);
    }
}