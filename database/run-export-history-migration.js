// Run Export History Migration
import { initTurso } from './turso-client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    console.log('🚀 Starting export history migration...');
    
    // Read environment variables
    const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
    const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
    
    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
        console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
        process.exit(1);
    }
    
    // Initialize database
    const env = {
        TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN
    };
    
    const DB = initTurso(env);
    
    try {
        // Read SQL file
        const sqlPath = path.join(__dirname, 'export_history_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('📝 Executing:', statement.trim().substring(0, 50) + '...');
                await DB.prepare(statement).run();
            }
        }
        
        console.log('✅ Migration completed successfully!');
        
        // Verify table exists
        const result = await DB.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='export_history'
        `).first();
        
        if (result) {
            console.log('✅ Table export_history created successfully');
        } else {
            console.error('❌ Table export_history not found');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
