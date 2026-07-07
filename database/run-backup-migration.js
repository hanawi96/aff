// Run backup_history table migration
// Usage: node database/run-backup-migration.js

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Turso client
const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

async function runMigration() {
    console.log('🚀 Starting backup_history migration...\n');
    
    try {
        // Read migration file
        const sqlPath = join(__dirname, 'create-backup-history-table.sql');
        const sql = readFileSync(sqlPath, 'utf-8');
        
        console.log('📄 Migration file loaded\n');
        
        // Split by semicolon and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));
        
        console.log(`Found ${statements.length} SQL statements\n`);
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            
            if (stmt) {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);
                console.log(`  ${stmt.substring(0, 60)}...`);
                
                await client.execute(stmt);
                console.log('  ✅ Success\n');
            }
        }
        
        // Verify table created
        console.log('🔍 Verifying table creation...');
        const result = await client.execute(`
            SELECT COUNT(*) as count 
            FROM backup_history
        `);
        
        console.log(`✅ Table verified! Current rows: ${result.rows[0].count}\n`);
        
        // Show table schema
        console.log('📋 Table schema:');
        const schema = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='backup_history'
        `);
        console.log(schema.rows[0].sql);
        console.log('');
        
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Deploy updated code: npm run deploy');
        console.log('2. Test backup creation: Visit /admin/settings');
        console.log('3. Verify R2 upload: wrangler r2 object list');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
runMigration().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
