import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
    try {
        console.log('🚀 Starting migration 056: Create discount campaigns...\n');

        // Read SQL file
        const sql = fs.readFileSync('./database/migrations/056_create_discount_campaigns.sql', 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.substring(0, 100) + '...');
                await client.execute(statement);
            }
        }

        console.log('\n✅ Migration 056 completed successfully!');
        console.log('\nCreated:');
        console.log('  - discount_campaigns table');
        console.log('  - campaign_id column in discounts table');
        console.log('  - Indexes for performance');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
