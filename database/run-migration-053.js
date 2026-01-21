// Run migration 053: Add custom slug to CTV
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        console.log('🚀 Starting migration 053: Add custom slug to CTV...');

        // Read migration file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '053_add_custom_slug_to_ctv.sql'),
            'utf8'
        );

        // Split by semicolon and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            console.log('Executing:', statement.substring(0, 100) + '...');
            await client.execute(statement);
        }

        console.log('✅ Migration 053 completed successfully!');

        // Verify
        const result = await client.execute(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='ctv'
        `);
        console.log('📋 CTV table schema:', result.rows[0]);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
