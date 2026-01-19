import { createClient } from '@libsql/client';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function runMigration() {
    try {
        console.log('🔄 Running migration 045: Remove TEXT timestamp columns from products table...');
        
        // Read the migration file
        const sql = fs.readFileSync('./database/migrations/045_remove_text_timestamps_from_products.sql', 'utf-8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`\n📝 Executing: ${statement.trim().substring(0, 60)}...`);
                await client.execute(statement.trim());
                console.log('✅ Done');
            }
        }
        
        console.log('\n✅ Migration 045 completed successfully!');
        console.log('✨ Removed columns: created_at (TEXT), updated_at (TEXT)');
        console.log('✨ Kept columns: created_at_unix, updated_at_unix');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
