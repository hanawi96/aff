import { jsonResponse } from '../../utils/response.js';
import { planRestore } from './sql-script.js';
import {
    acquireBackupLock,
    releaseBackupLock,
    createAndStoreBackup,
} from './backup-service.js';

const MAX_BACKUP_BYTES = 24 * 1024 * 1024;

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function readSqlUpload(request) {
    const form = await request.formData();
    const file = form.get('backup_file');
    if (!file || typeof file === 'string') {
        throw httpError('Không tìm thấy file backup', 400);
    }

    const name = String(file.name || 'backup.sql');
    const lower = name.toLowerCase();
    if (!lower.endsWith('.sql') || lower.endsWith('.sql.gz')) {
        throw httpError('Chỉ nhận file .sql. File nén .sql.gz không được dùng.', 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0) {
        throw httpError('File backup rỗng', 400);
    }
    if (bytes.length > MAX_BACKUP_BYTES) {
        throw httpError('File backup lớn hơn 24MB. Dừng để tránh khôi phục dở.', 400);
    }
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        throw httpError('File đang là dạng nén gzip. Hãy giải nén thành file .sql trước.', 400);
    }

    let sql;
    try {
        sql = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        throw httpError('File không phải SQL UTF-8', 400);
    }
    if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
    return { sql, name, size: bytes.length };
}

/**
 * Khôi phục trong một transaction. Trước đó phải lưu được một bản backup lên cloud.
 * Lệch số dòng hoặc lỗi bất kỳ câu nào thì hoàn tác, database không giữ dữ liệu dở.
 */
export async function restoreFromBackup(request, env, corsHeaders, createdBy) {
    let lockToken = null;
    try {
        const upload = await readSqlUpload(request);
        const plan = await planRestore(upload.sql);

        lockToken = await acquireBackupLock(env.DB, 'restore');
        const safety = await createAndStoreBackup(env, {
            reason: 'safety-before-restore',
            createdBy: createdBy || null,
            requireR2: true,
            lockHeld: true,
        });

        try {
            await env.DB.migrateSql([
                'CREATE TEMP TABLE backup_row_verify (n INTEGER NOT NULL)',
                ...plan.statements,
                ...plan.guards,
            ]);
        } catch (error) {
            console.error('Restore rolled back:', error);
            return jsonResponse({
                success: false,
                error: 'Khôi phục thất bại. Database đã được hoàn tác, không giữ dữ liệu dở.',
                detail: String(error?.message || error).slice(0, 500),
                safetyBackup: { id: safety.id, fileName: safety.fileName },
            }, 500, corsHeaders);
        }

        return jsonResponse({
            success: true,
            message: 'Khôi phục database thành công',
            details: {
                statements: plan.statements.length,
                tables: plan.counts.tables,
                rows: plan.counts.rows,
                indexes: plan.counts.indexes,
                triggers: plan.counts.triggers,
                views: plan.counts.views,
                checksum: plan.checksum,
                safetyBackup: { id: safety.id, fileName: safety.fileName },
            },
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Restore error:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Khôi phục thất bại',
        }, error.status || 500, corsHeaders);
    } finally {
        if (lockToken) {
            try {
                await releaseBackupLock(env.DB, lockToken);
            } catch (error) {
                console.error('Release backup lock failed:', error);
            }
        }
    }
}

/**
 * Kiểm tra file, không ghi database.
 */
export async function validateBackupFile(request, env, corsHeaders) {
    try {
        const upload = await readSqlUpload(request);
        const plan = await planRestore(upload.sql);
        return jsonResponse({
            success: true,
            valid: true,
            info: {
                fileName: upload.name,
                fileSize: upload.size,
                tables: plan.counts.tables,
                rows: plan.counts.rows,
                indexes: plan.counts.indexes,
                triggers: plan.counts.triggers,
                views: plan.counts.views,
                statements: plan.statements.length,
                checksum: plan.checksum,
            },
        }, 200, corsHeaders);
    } catch (error) {
        return jsonResponse({
            success: false,
            valid: false,
            error: error.message || 'File không hợp lệ',
        }, 200, corsHeaders);
    }
}
