// Script to run database migrations on Turso
// Usage: node database/run-turso-migration.js <migration-file>

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read migration file
const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('❌ Usage: node database/run-turso-migration.js <migration-file>');
    console.error('   Example: node database/run-turso-migration.js migrations/034_add_allowed_customer_phones.sql');
    process.exit(1);
}

const migrationPath = path.join(__dirname, migrationFile);

if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Migration file:', migrationFile);
console.log('📝 SQL to execute:');
console.log('─'.repeat(50));
console.log(sql);
console.log('─'.repeat(50));

// Check environment variables
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('\n❌ Missing Turso credentials in .env file');
    console.error('   Required: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
    process.exit(1);
}

// Run migration
async function runMigration() {
    try {
        console.log('\n🔄 Connecting to Turso database...');
        
        const client = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });

        console.log('✅ Connected to Turso');
        console.log('🚀 Executing migration...\n');

        // Split SQL by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => {
                // Remove comments and empty lines
                const lines = s.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('--'));
                return lines.length > 0;
            });

        for (const statement of statements) {
            const cleanStatement = statement
                .split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n')
                .trim();
                
            if (cleanStatement) {
                console.log('   Executing:', cleanStatement.substring(0, 80) + '...');
                await client.execute(cleanStatement);
            }
        }

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        
        // Check if it's a "column already exists" error
        if (error.message.includes('duplicate column name') || 
            error.message.includes('already exists')) {
            console.log('\n⚠️  Column might already exist. This is OK if migration was run before.');
            process.exit(0);
        }
        
        process.exit(1);
    }
}

runMigration();
