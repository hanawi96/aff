// Simple migration runner for backup_history table
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

async function runMigration() {
    console.log('🚀 Creating backup_history table...\n');
    
    try {
        // Create table
        console.log('1️⃣ Creating table...');
        await client.execute(`
            CREATE TABLE IF NOT EXISTS backup_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                tables_count INTEGER,
                rows_count INTEGER,
                status TEXT DEFAULT 'completed',
                downloaded_at INTEGER,
                created_by TEXT,
                notes TEXT,
                CONSTRAINT backup_history_created_at_idx UNIQUE (created_at)
            )
        `);
        console.log('   ✅ Table created\n');
        
        // Create indexes
        console.log('2️⃣ Creating indexes...');
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_backup_history_created_at 
            ON backup_history(created_at DESC)
        `);
        console.log('   ✅ Index on created_at created');
        
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_backup_history_status 
            ON backup_history(status)
        `);
        console.log('   ✅ Index on status created\n');
        
        // Verify
        console.log('3️⃣ Verifying table...');
        const result = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='backup_history'
        `);
        
        if (result.rows.length > 0) {
            console.log('   ✅ Table verified!\n');
            
            // Show schema
            const schema = await client.execute(`
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='backup_history'
            `);
            console.log('📋 Table schema:');
            console.log(schema.rows[0].sql);
            console.log('\n✅ Migration completed successfully!\n');
            
            console.log('Next steps:');
            console.log('1. Deploy: npm run deploy');
            console.log('2. Test: Visit /admin/settings');
            
        } else {
            throw new Error('Table not found after creation');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration().then(() => process.exit(0));
