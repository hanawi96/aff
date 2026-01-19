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
        console.log('🔄 Running migration 047: Remove created_at from commission_payment_details table...');
        
        // Read the migration file
        const sql = fs.readFileSync('./database/migrations/047_remove_created_at_from_commission_payment_details.sql', 'utf-8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`\n📝 Executing: ${statement.trim().substring(0, 60)}...`);
                await client.execute(statement.trim());
                console.log('✅ Done');
            }
        }
        
        console.log('\n✅ Migration 047 completed successfully!');
        console.log('✨ Removed column: created_at (TIMESTAMP)');
        console.log('✨ Kept column: created_at_unix (INTEGER)');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
