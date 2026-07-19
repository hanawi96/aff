import { jsonResponse } from '../../utils/response.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get list of all tables in database
 */
async function getAllTables(DB) {
    const result = await DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_litestream_%'
        ORDER BY name
    `).all();
    
    return result.results.map(row => row.name);
}

/**
 * Lấy name + CREATE TABLE trong 1 query (tiết kiệm subrequest Workers).
 * Tránh 1 query schema / bảng — createBackup dễ vượt limit 50 subrequest.
 */
async function getAllTablesWithSchema(DB) {
    const result = await DB.prepare(`
        SELECT name, sql FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_litestream_%'
        ORDER BY name
    `).all();

    return (result.results || []).map((row) => ({
        name: row.name,
        schema: row.sql || null,
    }));
}

/**
 * Get all data from a table
 */
async function getTableData(DB, tableName) {
    const result = await DB.prepare(`SELECT * FROM ${tableName}`).all();
    return result.results || [];
}

/**
 * Convert row to SQL INSERT statement
 */
function rowToInsertSQL(tableName, row) {
    const columns = Object.keys(row);
    const values = Object.values(row).map(val => {
        if (val === null) return 'NULL';
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? 1 : 0;
        // Escape single quotes in strings
        return `'${String(val).replace(/'/g, "''")}'`;
    });
    
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
}

// ============================================
// BACKUP CREATION (HYBRID: Download + R2)
// ============================================

/**
 * Create full database backup as SQL
 * Hybrid mode: Returns file for download + uploads to R2 storage
 * 
 * @param {Object} env - Environment with DB and R2_BUCKET
 * @param {Object} corsHeaders - CORS headers for response
 * @returns {Response} SQL file response with R2 upload confirmation
 */
export async function createDatabaseBackup(env, corsHeaders) {
    try {
        const DB = env.DB;
        
        console.log('🔄 Starting database backup...');
        
        // 1 query lấy toàn bộ schema — mỗi bảng chỉ còn 1 SELECT data
        const tables = await getAllTablesWithSchema(DB);
        const tableNames = tables.map((t) => t.name);
        console.log(`📊 Found ${tables.length} tables:`, tableNames);
        
        // Build SQL backup content
        let sqlContent = [];
        
        // Header
        sqlContent.push('-- Database Backup');
        sqlContent.push(`-- Generated: ${new Date().toISOString()}`);
        sqlContent.push(`-- Database: CTV System (Turso)`);
        sqlContent.push('-- Total Tables: ' + tables.length);
        sqlContent.push('');
        sqlContent.push('-- Disable foreign keys during restore');
        sqlContent.push('PRAGMA foreign_keys = OFF;');
        sqlContent.push('');
        
        let totalRows = 0;
        
        // Export each table (schema đã có sẵn — không query lại)
        for (const { name: tableName, schema } of tables) {
            console.log(`📦 Exporting table: ${tableName}`);
            
            sqlContent.push('');
            sqlContent.push(`-- ============================================`);
            sqlContent.push(`-- Table: ${tableName}`);
            sqlContent.push(`-- ============================================`);
            sqlContent.push('');
            
            if (schema) {
                sqlContent.push(`-- Schema`);
                sqlContent.push(`DROP TABLE IF EXISTS ${tableName};`);
                sqlContent.push(schema + ';');
                sqlContent.push('');
            }
            
            const rows = await getTableData(DB, tableName);
            
            if (rows.length > 0) {
                sqlContent.push(`-- Data (${rows.length} rows)`);
                rows.forEach(row => {
                    sqlContent.push(rowToInsertSQL(tableName, row));
                });
                totalRows += rows.length;
                sqlContent.push('');
            } else {
                sqlContent.push(`-- No data`);
                sqlContent.push('');
            }
        }
        
        // Footer
        sqlContent.push('');
        sqlContent.push('-- Re-enable foreign keys');
        sqlContent.push('PRAGMA foreign_keys = ON;');
        sqlContent.push('');
        sqlContent.push(`-- Backup completed successfully`);
        sqlContent.push(`-- Total rows: ${totalRows}`);
        
        const finalSQL = sqlContent.join('\n');
        
        console.log(`✅ Backup completed: ${tables.length} tables, ${totalRows} rows`);
        
        // Generate filename and metadata
        const now = Date.now();
        const dateStr = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `shopvd_backup_${dateStr}.sql`;
        const filePath = `backups/${now}_${filename}`;
        let r2Uploaded = false;
        
        // ============================================
        // UPLOAD TO R2 STORAGE (không chặn download nếu fail)
        // ============================================
        try {
            console.log(`☁️ Uploading to R2: ${filePath}`);
            
            const fileBuffer = new TextEncoder().encode(finalSQL);
            const fileSize = fileBuffer.byteLength;
            const r2Bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
            
            if (r2Bucket) {
                await r2Bucket.put(filePath, fileBuffer, {
                    httpMetadata: {
                        contentType: 'application/sql; charset=utf-8',
                        cacheControl: 'private, max-age=31536000',
                    },
                    customMetadata: {
                        'backup-tables': String(tables.length),
                        'backup-rows': String(totalRows),
                        'backup-date': dateStr,
                    }
                });
                
                console.log(`✅ R2 upload successful: ${fileSize} bytes`);
                
                await DB.prepare(`
                    INSERT INTO backup_history 
                    (created_at, file_name, file_path, file_size, tables_count, rows_count, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'completed')
                `).bind(
                    now,
                    filename,
                    filePath,
                    fileSize,
                    tables.length,
                    totalRows
                ).run();
                
                r2Uploaded = true;
                console.log(`✅ Backup metadata saved to database`);
            } else {
                console.warn('⚠️ R2 bucket not configured, skipping upload');
            }
        } catch (uploadError) {
            console.error('❌ R2 upload error (continuing with download):', uploadError);
        }
        
        // ============================================
        // RETURN FILE FOR DOWNLOAD
        // ============================================
        return new Response(finalSQL, {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/sql; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Backup-Tables': String(tables.length),
                'X-Backup-Rows': String(totalRows),
                'X-Backup-R2-Uploaded': r2Uploaded ? 'true' : 'false',
                'X-Backup-R2-Path': r2Uploaded ? filePath : '',
            }
        });
        
    } catch (error) {
        console.error('❌ Backup error:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// BACKUP HISTORY MANAGEMENT
// ============================================

/**
 * Get list of backup history from database
 * Returns recent backups with metadata
 * 
 * @param {Object} env - Environment with DB
 * @param {Object} corsHeaders - CORS headers
 * @returns {Object} List of backups with metadata
 */
export async function getBackupHistory(env, corsHeaders) {
    try {
        const DB = env.DB;
        
        // Get recent backups (last 30 backups)
        const result = await DB.prepare(`
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
                notes
            FROM backup_history
            WHERE status = 'completed'
            ORDER BY created_at DESC
            LIMIT 30
        `).all();
        
        console.log(`✅ Retrieved ${result.results.length} backup records`);
        
        return jsonResponse({
            success: true,
            backups: result.results || [],
            count: result.results.length
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('❌ Error getting backup history:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Download backup file from R2 storage
 * Updates downloaded_at timestamp
 * 
 * @param {string} backupId - Backup record ID
 * @param {Object} env - Environment with DB and R2_BUCKET
 * @param {Object} corsHeaders - CORS headers
 * @returns {Response} File download response
 */
export async function downloadBackupFromR2(backupId, env, corsHeaders) {
    try {
        const DB = env.DB;
        
        if (!backupId) {
            throw new Error('Backup ID is required');
        }
        
        console.log(`📥 Downloading backup ID: ${backupId}`);
        
        // Get backup info from database
        const backup = await DB.prepare(`
            SELECT 
                id,
                file_path,
                file_name,
                file_size,
                tables_count,
                rows_count
            FROM backup_history
            WHERE id = ? AND status = 'completed'
        `).bind(backupId).first();
        
        if (!backup) {
            throw new Error('Backup not found or not completed');
        }
        
        // Get file from R2
        const r2Bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
        
        if (!r2Bucket) {
            throw new Error('R2 storage not configured');
        }
        
        const object = await r2Bucket.get(backup.file_path);
        
        if (!object) {
            throw new Error('Backup file not found in R2 storage');
        }
        
        console.log(`✅ Retrieved backup from R2: ${backup.file_name}`);
        
        // Update downloaded_at timestamp
        await DB.prepare(`
            UPDATE backup_history 
            SET downloaded_at = ?
            WHERE id = ?
        `).bind(Date.now(), backupId).run();
        
        // Return file for download
        return new Response(object.body, {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/sql; charset=utf-8',
                'Content-Disposition': `attachment; filename="${backup.file_name}"`,
                'Content-Length': backup.file_size?.toString() || '',
                'X-Backup-Tables': backup.tables_count?.toString() || '',
                'X-Backup-Rows': backup.rows_count?.toString() || '',
            }
        });
        
    } catch (error) {
        console.error('❌ Error downloading backup from R2:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Delete a single backup from R2 and database
 * 
 * @param {string} backupId - Backup record ID to delete
 * @param {Object} env - Environment with DB and R2_BUCKET
 * @param {Object} corsHeaders - CORS headers
 * @returns {Response} Deletion result
 */
export async function deleteBackupFromR2(backupId, env, corsHeaders) {
    try {
        const DB = env.DB;
        
        if (!backupId) {
            throw new Error('Backup ID is required');
        }
        
        console.log(`🗑️ Deleting backup ID: ${backupId}`);
        
        // Get backup info from database
        const backup = await DB.prepare(`
            SELECT id, file_path, file_name
            FROM backup_history
            WHERE id = ?
        `).bind(backupId).first();
        
        if (!backup) {
            throw new Error('Backup not found');
        }
        
        // Delete from R2
        const r2Bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
        
        if (r2Bucket) {
            try {
                await r2Bucket.delete(backup.file_path);
                console.log(`✅ Deleted from R2: ${backup.file_path}`);
            } catch (r2Error) {
                console.warn(`⚠️ R2 delete failed (continuing): ${r2Error.message}`);
                // Continue even if R2 delete fails
            }
        }
        
        // Delete from database
        const result = await DB.prepare(`
            DELETE FROM backup_history WHERE id = ?
        `).bind(backupId).run();
        
        if (!result.success) {
            throw new Error('Failed to delete from database');
        }
        
        console.log(`✅ Deleted backup: ${backup.file_name}`);
        
        return jsonResponse({
            success: true,
            message: 'Backup deleted successfully',
            fileName: backup.file_name
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('❌ Error deleting backup:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Delete old backups from R2 and database
 * Keeps only the most recent N backups
 * 
 * @param {number} keepCount - Number of backups to keep (default: 30)
 * @param {Object} env - Environment with DB and R2_BUCKET
 * @returns {Object} Deletion result
 */
export async function cleanupOldBackups(keepCount = 30, env) {
    try {
        const DB = env.DB;
        
        // Get backups to delete (older than keepCount)
        const result = await DB.prepare(`
            SELECT id, file_path, file_name
            FROM backup_history
            ORDER BY created_at DESC
            LIMIT -1 OFFSET ?
        `).bind(keepCount).all();
        
        const toDelete = result.results || [];
        
        if (toDelete.length === 0) {
            console.log('✅ No old backups to clean up');
            return { success: true, deleted: 0 };
        }
        
        console.log(`🗑️ Cleaning up ${toDelete.length} old backups`);
        
        const r2Bucket = env.R2_BUCKET || env.R2_EXCEL_BUCKET;
        let deletedCount = 0;
        
        // Delete from R2 and database
        for (const backup of toDelete) {
            try {
                // Delete from R2
                if (r2Bucket) {
                    await r2Bucket.delete(backup.file_path);
                }
                
                // Delete from database
                await DB.prepare(`
                    DELETE FROM backup_history WHERE id = ?
                `).bind(backup.id).run();
                
                deletedCount++;
                console.log(`✅ Deleted: ${backup.file_name}`);
                
            } catch (deleteError) {
                console.error(`❌ Failed to delete ${backup.file_name}:`, deleteError);
            }
        }
        
        console.log(`✅ Cleanup completed: ${deletedCount} backups deleted`);
        
        return { success: true, deleted: deletedCount };
        
    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get backup metadata (without generating full backup)
 */
export async function getBackupMetadata(env, corsHeaders) {
    try {
        const DB = env.DB;
        
        const tables = await getAllTables(DB);
        let totalRows = 0;
        const tableInfo = [];
        
        for (const tableName of tables) {
            const countResult = await DB.prepare(
                `SELECT COUNT(*) as count FROM ${tableName}`
            ).first();
            
            const rowCount = countResult?.count || 0;
            totalRows += rowCount;
            
            tableInfo.push({
                name: tableName,
                rows: rowCount
            });
        }
        
        return jsonResponse({
            success: true,
            metadata: {
                tables: tables.length,
                totalRows: totalRows,
                tableInfo: tableInfo,
                estimatedSize: `${Math.round(totalRows * 0.5)} KB`
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Error getting backup metadata:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
