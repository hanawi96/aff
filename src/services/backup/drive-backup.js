import { createAndStoreBackup } from './backup-service.js';

const DRIVE_BACKUP_KEEP = 14;

/**
 * Gửi file SQL đã tạo sang Apps Script trên Google Drive của shop.
 * Script tự lưu file và chỉ giữ 14 bản mới nhất.
 */
export async function uploadBackupToGoogleDrive(env, { sql, fileName }) {
    const url = env.GOOGLE_DRIVE_BACKUP_URL;
    const secret = env.GOOGLE_DRIVE_BACKUP_SECRET;
    if (!url) {
        return { uploaded: false, reason: 'Chưa cấu hình GOOGLE_DRIVE_BACKUP_URL' };
    }
    if (!secret) {
        return { uploaded: false, reason: 'Chưa cấu hình GOOGLE_DRIVE_BACKUP_SECRET' };
    }
    if (!sql || !fileName) {
        return { uploaded: false, reason: 'Thiếu file backup để gửi lên Drive' };
    }

    const body = JSON.stringify({
        type: 'database-backup',
        secret,
        fileName,
        sql,
        keep: DRIVE_BACKUP_KEEP,
    });

    try {
        const response = await postAppsScript(url, body);
        const text = await response.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
        if (!response.ok || !data?.success) {
            const detail = data?.error || text.replace(/\s+/g, ' ').slice(0, 180);
            return { uploaded: false, reason: detail || `Drive trả về ${response.status}` };
        }
        return {
            uploaded: true,
            fileId: data.fileId || null,
            removed: Number(data.removed) || 0,
        };
    } catch (error) {
        return { uploaded: false, reason: error.message || 'Không gửi được file lên Drive' };
    }
}

async function postAppsScript(url, body) {
    const first = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body,
    });
    if (first.status !== 301 && first.status !== 302) return first;

    // Apps Script trả 302 sau khi đã nhận POST. Kết quả JSON nằm ở địa chỉ redirect.
    const location = first.headers.get('Location');
    if (!location) return first;
    return fetch(location, { method: 'GET' });
}

async function markDriveResult(env, backupId, drive) {
    if (!backupId) return;
    const note = drive.uploaded
        ? 'reason=scheduled; drive=ok'
        : `reason=scheduled; drive=failed; ${drive.reason || 'lỗi không rõ'}`.slice(0, 500);
    const updated = await env.DB.prepare(
        `UPDATE backup_history SET notes = ? WHERE id = ?`
    ).bind(note, backupId).run();
    if (!updated.success) {
        console.error('Không ghi được trạng thái Drive vào lịch sử backup:', updated.error);
    }
}

/**
 * Backup đêm: lưu R2 như bản thủ công, rồi đưa cùng file SQL lên Google Drive.
 * Drive lỗi thì bản R2 vẫn còn.
 */
export async function runScheduledDriveBackup(env) {
    const backup = await createAndStoreBackup(env, {
        reason: 'scheduled',
        createdBy: 'cron',
        requireR2: false,
    });
    const drive = await uploadBackupToGoogleDrive(env, {
        sql: backup.sql,
        fileName: backup.fileName,
    });
    try {
        await markDriveResult(env, backup.id, drive);
    } catch (error) {
        console.error('Drive note update failed:', error);
    }
    return {
        fileName: backup.fileName,
        tables: backup.tables,
        rows: backup.totalRows,
        r2: backup.uploaded === true,
        drive: drive.uploaded === true,
        driveError: drive.uploaded ? undefined : drive.reason,
    };
}
