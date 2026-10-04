import { jsonResponse } from '../../utils/response.js';
import { verifySession } from '../../auth/session.js';
import {
    quoteIdent,
    rowToInsertSQL,
    sha256Hex,
    attachChecksum,
    verifyChecksum,
} from './sql-script.js';

const LOCK_STALE_MS = 10 * 60 * 1000;
let backupSchemaReady = false;

const BACKUP_EXPOSE_HEADERS = {
    'Access-Control-Expose-Headers': 'Content-Disposition, X-Backup-Tables, X-Backup-Rows, X-Backup-R2-Uploaded, X-Backup-History, X-Backup-Checksum, X-Backup-Id',
};

export async function requireBackupAdmin(request, env, corsHeaders) {
    const session = await verifySession(request, env);
    if (!session) {
        return {
            ok: false,
            response: jsonResponse({
                success: false,
                error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
            }, 401, corsHeaders),
        };
    }
    return { ok: true, session };
}

async function ensureBackupSchema(DB) {
    if (backupSchemaReady) return;

    const lock = await DB.prepare(`
        CREATE TABLE IF NOT EXISTS backup_lock (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            operation TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            token TEXT NOT NULL
        )
    `).run();
    if (!lock.success) {
        throw new Error(lock.error || 'Không tạo được khóa backup');
    }

    const columns = await DB.prepare(`PRAGMA table_info(backup_history)`).all();
    const names = new Set((columns.results || []).map((column) => column.name));
    if (!names.has('id')) {
        throw new Error('Thiếu bảng backup_history');
    }
    if (!names.has('checksum')) {
        const added = await DB.prepare(`ALTER TABLE backup_history ADD COLUMN checksum TEXT`).run();
        if (!added.success && !/duplicate column/i.test(added.error || '')) {
            throw new Error(added.error || 'Không thêm được cột checksum');
        }
    }
    backupSchemaReady = true;
}

export async function acquireBackupLock(DB, operation) {
    await ensureBackupSchema(DB);
    const now = Date.now();
    const token = crypto.randomUUID();
    const staleBefore = now - LOCK_STALE_MS;
    const written = await DB.prepare(`
        INSERT INTO backup_lock (id, operation, started_at, token)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            operation = excluded.operation,
            started_at = excluded.started_at,
            token = excluded.token
        WHERE backup_lock.started_at < ?
    `).bind(operation, now, token, staleBefore).run();
    if (!written.success) {
        const error = new Error(written.error || 'Không khóa được thao tác backup');
        error.status = 500;
        throw error;
    }

    const row = await DB.prepare(`SELECT token FROM backup_lock WHERE id = 1`).first();
    if (!row || row.token !== token) {
        const error = new Error('Đang có một lần sao lưu hoặc khôi phục khác. Hãy đợi xong rồi thử lại.');
        error.status = 409;
        throw error;
    }
    return token;
}

export async function releaseBackupLock(DB, token) {
    if (!token) return;
    await DB.prepare(`DELETE FROM backup_lock WHERE id = 1 AND token = ?`).bind(token).run();
}

function ensureSemicolon(sql) {
    const trimmed = String(sql || '').trim();
    return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
}

async function buildDatabaseSql(DB) {
    // Một query schema cho mọi bảng, index, trigger, view.
    // Mỗi bảng chỉ thêm một SELECT dữ liệu để không vượt hạn mức subrequest.
    const master = await DB.prepare(`
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        WHERE sql IS NOT NULL
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_litestream_%'
          AND type IN ('table', 'index', 'trigger', 'view')
        ORDER BY name
    `).all();
    const objects = master.results || [];
    const tables = objects.filter((row) => row.type === 'table' && row.name !== 'backup_lock');
    const extras = objects.filter((row) => (
        row.type !== 'table' && row.name !== 'backup_lock' && row.tbl_name !== 'backup_lock'
    ));

    const lines = [
        '-- SHOPVD-BACKUP 2',
        `-- Generated: ${new Date().toISOString()}`,
        '-- Database: CTV System (Turso)',
        '-- Restore keeps the live backup_history and backup_lock tables.',
        'PRAGMA foreign_keys = OFF;',
        '',
    ];

    let totalRows = 0;
    for (const table of tables) {
        const tableName = table.name;
        const ident = quoteIdent(tableName);
        const data = await DB.prepare(`SELECT * FROM ${ident}`).all();
        const rows = data.results || [];
        lines.push(`-- Table: ${tableName}`);
        lines.push(`-- ROWCOUNT ${tableName} ${rows.length}`);
        lines.push(`DROP TABLE IF EXISTS ${ident};`);
        lines.push(ensureSemicolon(table.sql));
        lines.push('');
        if (rows.length === 0) {
            lines.push('-- No data');
            lines.push('');
            continue;
        }
        for (const row of rows) {
            lines.push(`${rowToInsertSQL(tableName, row)};`);
        }
        lines.push('');
        totalRows += rows.length;
    }

    const typeOrder = { view: 0, index: 1, trigger: 2 };
    extras.sort((a, b) => (typeOrder[a.type] - typeOrder[b.type]) || a.name.localeCompare(b.name));
    for (const object of extras) {
        lines.push(`-- OBJECT ${object.type} ${object.name}`);
        lines.push(ensureSemicolon(object.sql));
        lines.push('');
    }

    lines.push('PRAGMA foreign_keys = ON;');
    lines.push('-- Backup completed');
    lines.push(`-- Total rows: ${totalRows}`);

    return {
        body: lines.join('\n'),
        tables: tables.length,
        totalRows,
    };
}

async function insertBackupHistory(DB, info) {
    let createdAt = info.createdAt;
    let lastError = 'Không ghi được lịch sử backup';
    for (let attempt = 0; attempt < 3; attempt++) {
        const inserted = await DB.prepare(`
            INSERT INTO backup_history
                (created_at, file_name, file_path, file_size, tables_count, rows_count, status, created_by, notes, checksum)
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
        `).bind(
            createdAt,
            info.fileName,
            info.filePath,
            info.fileSize,
            info.tables,
            info.totalRows,
            info.createdBy,
            info.notes,
            info.checksum
        ).run();
        if (inserted.success) return inserted.meta?.last_row_id ?? null;
        lastError = inserted.error || lastError;
        if (!/unique/i.test(lastError)) break;
        createdAt += 1;
    }
    throw new Error(lastError);
}

async function storeBackupFile(env, info) {
    const now = Date.now();
    const dateStr = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `shopvd_backup_${dateStr}.sql`;
    const filePath = `backups/${now}_${fileName}`;
    const fileBuffer = new TextEncoder().encode(info.sql);
    const fileSize = fileBuffer.byteLength;
    const bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;

    if (!bucket) {
        if (info.requireR2) {
            const error = new Error('Chưa cấu hình kho backup. Đã dừng, database không bị đổi.');
            error.status = 500;
            throw error;
        }
        return { uploaded: false, historySaved: false, id: null, fileName, filePath, fileSize };
    }

    try {
        await bucket.put(filePath, fileBuffer, {
            httpMetadata: {
                contentType: 'application/sql; charset=utf-8',
            },
            customMetadata: {
                'backup-tables': String(info.tables),
                'backup-rows': String(info.totalRows),
                'backup-checksum': info.checksum,
                'backup-reason': info.reason,
            },
        });
    } catch (error) {
        console.error('R2 upload error:', error);
        if (info.requireR2) {
            const wrapped = new Error('Không lưu được bản sao lưu lên cloud. Đã dừng, database không bị đổi.');
            wrapped.status = 500;
            throw wrapped;
        }
        return { uploaded: false, historySaved: false, id: null, fileName, filePath, fileSize };
    }

    try {
        const id = await insertBackupHistory(env.DB, {
            createdAt: now,
            fileName,
            filePath,
            fileSize,
            tables: info.tables,
            totalRows: info.totalRows,
            createdBy: info.createdBy,
            notes: `reason=${info.reason}`,
            checksum: info.checksum,
        });
        return { uploaded: true, historySaved: true, id, fileName, filePath, fileSize };
    } catch (error) {
        console.error('Backup history insert failed:', error);
        try {
            await bucket.delete(filePath);
        } catch (deleteError) {
            console.error('R2 cleanup after history failure:', deleteError);
        }
        if (info.requireR2) {
            const wrapped = new Error('Không ghi được lịch sử bản sao lưu. Đã dừng, database không bị đổi.');
            wrapped.status = 500;
            throw wrapped;
        }
        return { uploaded: false, historySaved: false, id: null, fileName, filePath, fileSize };
    }
}

/**
 * Đọc toàn bộ database, lưu R2 và backup_history khi upload thành công.
 * requireR2: thất bại thì ném lỗi, không trả file coi như đã lưu.
 */
export async function createAndStoreBackup(env, options = {}) {
    const DB = env.DB;
    let lockToken = null;
    if (!options.lockHeld) {
        lockToken = await acquireBackupLock(DB, options.reason === 'safety-before-restore' ? 'restore' : 'backup');
    } else {
        await ensureBackupSchema(DB);
    }

    try {
        const built = await buildDatabaseSql(DB);
        const checksum = await sha256Hex(built.body);
        const sql = attachChecksum(built.body, checksum);
        const stored = await storeBackupFile(env, {
            sql,
            checksum,
            tables: built.tables,
            totalRows: built.totalRows,
            reason: options.reason || 'manual',
            createdBy: options.createdBy || null,
            requireR2: options.requireR2 === true,
        });
        return {
            sql,
            checksum,
            tables: built.tables,
            totalRows: built.totalRows,
            ...stored,
        };
    } finally {
        if (lockToken) await releaseBackupLock(DB, lockToken);
    }
}

export async function createDatabaseBackup(env, corsHeaders, createdBy) {
    try {
        const backup = await createAndStoreBackup(env, {
            reason: 'manual',
            createdBy: createdBy || null,
            requireR2: false,
        });
        return new Response(backup.sql, {
            status: 200,
            headers: {
                ...corsHeaders,
                ...BACKUP_EXPOSE_HEADERS,
                'Content-Type': 'application/sql; charset=utf-8',
                'Content-Disposition': `attachment; filename="${backup.fileName}"`,
                'X-Backup-Tables': String(backup.tables),
                'X-Backup-Rows': String(backup.totalRows),
                'X-Backup-R2-Uploaded': backup.uploaded ? 'true' : 'false',
                'X-Backup-History': backup.historySaved ? 'true' : 'false',
                'X-Backup-Checksum': backup.checksum,
                'X-Backup-Id': backup.id != null ? String(backup.id) : '',
            },
        });
    } catch (error) {
        console.error('Backup error:', error);
        return jsonResponse({
            success: false,
            error: error.message,
        }, error.status || 500, corsHeaders);
    }
}

export async function getBackupHistory(env, corsHeaders) {
    try {
        await ensureBackupSchema(env.DB);
        const result = await env.DB.prepare(`
            SELECT
                id,
                created_at,
                file_name,
                file_path,
                file_size,
                tables_count,
                rows_count,
                status,
                downloaded_at,
                created_by,
                notes,
                checksum
            FROM backup_history
            WHERE status = 'completed'
            ORDER BY created_at DESC
            LIMIT 30
        `).all();

        return jsonResponse({
            success: true,
            backups: result.results || [],
            count: (result.results || []).length,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting backup history:', error);
        return jsonResponse({
            success: false,
            error: error.message,
        }, 500, corsHeaders);
    }
}

export async function downloadBackupFromR2(backupId, env, corsHeaders) {
    try {
        if (!backupId) throw new Error('Thiếu mã backup');
        await ensureBackupSchema(env.DB);

        const backup = await env.DB.prepare(`
            SELECT id, file_path, file_name, file_size, tables_count, rows_count, checksum
            FROM backup_history
            WHERE id = ? AND status = 'completed'
        `).bind(backupId).first();
        if (!backup) throw new Error('Không tìm thấy backup');

        const bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
        if (!bucket) throw new Error('Chưa cấu hình kho backup');

        const object = await bucket.get(backup.file_path);
        if (!object) throw new Error('Không thấy file backup trên cloud');

        const bytes = await object.arrayBuffer();
        if (backup.checksum) {
            const text = new TextDecoder().decode(bytes);
            const checked = await verifyChecksum(text);
            if (checked.checksumOk !== true) {
                throw new Error('File trên cloud không khớp mã kiểm tra. Không tải file hỏng.');
            }
        }

        await env.DB.prepare(`
            UPDATE backup_history
            SET downloaded_at = ?
            WHERE id = ?
        `).bind(Date.now(), backupId).run();

        return new Response(bytes, {
            status: 200,
            headers: {
                ...corsHeaders,
                ...BACKUP_EXPOSE_HEADERS,
                'Content-Type': 'application/sql; charset=utf-8',
                'Content-Disposition': `attachment; filename="${backup.file_name}"`,
                'Content-Length': String(bytes.byteLength),
                'X-Backup-Tables': backup.tables_count?.toString() || '',
                'X-Backup-Rows': backup.rows_count?.toString() || '',
                'X-Backup-Checksum': backup.checksum || '',
            },
        });
    } catch (error) {
        console.error('Error downloading backup from R2:', error);
        return jsonResponse({
            success: false,
            error: error.message,
        }, 500, corsHeaders);
    }
}

export async function deleteBackupFromR2(backupId, env, corsHeaders) {
    try {
        if (!backupId) throw new Error('Thiếu mã backup');

        const backup = await env.DB.prepare(`
            SELECT id, file_path, file_name
            FROM backup_history
            WHERE id = ?
        `).bind(backupId).first();
        if (!backup) throw new Error('Không tìm thấy backup');

        const bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
        if (bucket) {
            try {
                await bucket.delete(backup.file_path);
            } catch (error) {
                console.warn('R2 delete failed:', error.message);
            }
        }

        const result = await env.DB.prepare(`
            DELETE FROM backup_history WHERE id = ?
        `).bind(backupId).run();
        if (!result.success) throw new Error(result.error || 'Không xóa được lịch sử backup');

        return jsonResponse({
            success: true,
            message: 'Đã xóa backup',
            fileName: backup.file_name,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error deleting backup:', error);
        return jsonResponse({
            success: false,
            error: error.message,
        }, 500, corsHeaders);
    }
}

export async function cleanupOldBackups(keepCount = 30, env) {
    try {
        const result = await env.DB.prepare(`
            SELECT id, file_path, file_name
            FROM backup_history
            ORDER BY created_at DESC
            LIMIT -1 OFFSET ?
        `).bind(keepCount).all();
        const toDelete = result.results || [];
        if (toDelete.length === 0) return { success: true, deleted: 0 };

        const bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
        let deletedCount = 0;
        for (const backup of toDelete) {
            try {
                if (bucket) await bucket.delete(backup.file_path);
                await env.DB.prepare(`DELETE FROM backup_history WHERE id = ?`).bind(backup.id).run();
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete ${backup.file_name}:`, error);
            }
        }
        return { success: true, deleted: deletedCount };
    } catch (error) {
        console.error('Cleanup error:', error);
        return { success: false, error: error.message };
    }
}

export async function getBackupMetadata(env, corsHeaders) {
    try {
        const tablesResult = await env.DB.prepare(`
            SELECT name FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
              AND name NOT LIKE '_litestream_%'
            ORDER BY name
        `).all();
        const tables = (tablesResult.results || []).map((row) => row.name);
        let totalRows = 0;
        const tableInfo = [];

        for (const tableName of tables) {
            const countResult = await env.DB.prepare(
                `SELECT COUNT(*) as count FROM ${quoteIdent(tableName)}`
            ).first();
            const rowCount = countResult?.count || 0;
            totalRows += rowCount;
            tableInfo.push({ name: tableName, rows: rowCount });
        }

        return jsonResponse({
            success: true,
            metadata: {
                tables: tables.length,
                totalRows,
                tableInfo,
                estimatedSize: `${Math.round(totalRows * 0.5)} KB`,
            },
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting backup metadata:', error);
        return jsonResponse({
            success: false,
            error: error.message,
        }, 500, corsHeaders);
    }
}
