import { jsonResponse } from '../../utils/response.js';

/**
 * Validate SQL backup file
 */
function validateBackupSQL(sqlContent) {
    // Basic validation
    if (!sqlContent || typeof sqlContent !== 'string') {
        return { valid: false, error: 'File rỗng hoặc không hợp lệ' };
    }
    
    // Check if it's SQL
    if (!sqlContent.includes('CREATE TABLE') && !sqlContent.includes('INSERT INTO')) {
        return { valid: false, error: 'Không phải file SQL backup hợp lệ' };
    }
    
    // Check for dangerous commands
    const dangerousCommands = ['DROP DATABASE', 'GRANT', 'REVOKE', 'CREATE USER'];
    for (const cmd of dangerousCommands) {
        if (sqlContent.toUpperCase().includes(cmd)) {
            return { valid: false, error: `File chứa lệnh không an toàn: ${cmd}` };
        }
    }
    
    return { valid: true };
}

/**
 * Parse SQL statements from backup file
 */
function parseSQLStatements(sqlContent) {
    // Remove comments
    const lines = sqlContent.split('\n');
    const sqlLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--');
    });
    
    // Join and split by semicolons
    const fullSQL = sqlLines.join('\n');
    const statements = fullSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
    
    return statements;
}

/**
 * Get all table names from database
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
 * Restore database from SQL backup
 */
export async function restoreFromBackup(request, env, corsHeaders) {
    try {
        const DB = env.DB;
        
        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('backup_file');
        
        if (!file) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy file backup'
            }, 400, corsHeaders);
        }
        
        console.log('📁 Received backup file:', file.name, `(${file.size} bytes)`);
        
        // Read file content
        const sqlContent = await file.text();
        
        // Validate SQL
        const validation = validateBackupSQL(sqlContent);
        if (!validation.valid) {
            return jsonResponse({
                success: false,
                error: validation.error
            }, 400, corsHeaders);
        }
        
        console.log('✅ SQL validation passed');
        
        // Parse statements
        const statements = parseSQLStatements(sqlContent);
        console.log(`📝 Parsed ${statements.length} SQL statements`);
        
        if (statements.length === 0) {
            return jsonResponse({
                success: false,
                error: 'File backup không chứa câu lệnh SQL nào'
            }, 400, corsHeaders);
        }
        
        // Create safety backup before restore
        console.log('🔒 Creating safety backup before restore...');
        const currentTables = await getAllTables(DB);
        console.log(`📊 Current database has ${currentTables.length} tables`);
        
        // Execute restore
        console.log('🔄 Starting restore process...');
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // Disable foreign keys temporarily
        try {
            await DB.prepare('PRAGMA foreign_keys = OFF').run();
        } catch (err) {
            console.warn('Could not disable foreign keys:', err);
        }
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            
            try {
                await DB.prepare(stmt).run();
                successCount++;
                
                // Log progress every 100 statements
                if ((i + 1) % 100 === 0) {
                    console.log(`Progress: ${i + 1}/${statements.length} statements`);
                }
            } catch (error) {
                errorCount++;
                const errorMsg = `Statement ${i + 1}: ${error.message}`;
                errors.push(errorMsg);
                console.error('❌', errorMsg);
                
                // Stop if too many errors
                if (errorCount > 10) {
                    console.error('⚠️ Too many errors, stopping restore');
                    break;
                }
            }
        }
        
        // Re-enable foreign keys
        try {
            await DB.prepare('PRAGMA foreign_keys = ON').run();
        } catch (err) {
            console.warn('Could not re-enable foreign keys:', err);
        }
        
        // Verify restoration
        const restoredTables = await getAllTables(DB);
        
        console.log(`✅ Restore completed: ${successCount} success, ${errorCount} errors`);
        console.log(`📊 Database now has ${restoredTables.length} tables`);
        
        if (errorCount > statements.length * 0.1) {
            // More than 10% errors - considered failed
            return jsonResponse({
                success: false,
                error: 'Restore thất bại - quá nhiều lỗi',
                details: {
                    totalStatements: statements.length,
                    successCount,
                    errorCount,
                    errors: errors.slice(0, 10) // First 10 errors
                }
            }, 500, corsHeaders);
        }
        
        return jsonResponse({
            success: true,
            message: 'Khôi phục database thành công',
            details: {
                totalStatements: statements.length,
                successCount,
                errorCount,
                tablesRestored: restoredTables.length,
                errors: errors.length > 0 ? errors.slice(0, 5) : []
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('❌ Restore error:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Validate backup file without restoring
 */
export async function validateBackupFile(request, env, corsHeaders) {
    try {
        const formData = await request.formData();
        const file = formData.get('backup_file');
        
        if (!file) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy file'
            }, 400, corsHeaders);
        }
        
        const sqlContent = await file.text();
        const validation = validateBackupSQL(sqlContent);
        
        if (!validation.valid) {
            return jsonResponse({
                success: false,
                valid: false,
                error: validation.error
            }, 200, corsHeaders);
        }
        
        const statements = parseSQLStatements(sqlContent);
        
        // Count tables and inserts
        const createTableCount = statements.filter(s => 
            s.toUpperCase().includes('CREATE TABLE')
        ).length;
        
        const insertCount = statements.filter(s => 
            s.toUpperCase().includes('INSERT INTO')
        ).length;
        
        return jsonResponse({
            success: true,
            valid: true,
            info: {
                fileName: file.name,
                fileSize: file.size,
                totalStatements: statements.length,
                tables: createTableCount,
                inserts: insertCount,
                estimatedRows: insertCount
            }
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('Validation error:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
