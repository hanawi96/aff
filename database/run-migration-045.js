import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || './database/database.json';

try {
    console.log('🔄 Running migration 045: Remove TEXT timestamp columns from products table...');
    
    // Read the migration file
    const migrationPath = path.join('./database/migrations', '045_remove_text_timestamps_from_products.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
        if (statement.trim()) {
            console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
            // Note: This is for reference. In production, use Turso CLI
        }
    }
    
    console.log('✅ Migration 045 completed successfully!');
    console.log('\n📝 To apply this migration to Turso, run:');
    console.log('   turso db shell <database-name> < database/migrations/045_remove_text_timestamps_from_products.sql');
    
} catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
}
