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
        console.log('🚀 Starting migration 057: Add special_event to discounts...\n');

        const sql = fs.readFileSync('./database/migrations/057_add_special_event_to_discounts.sql', 'utf8');
        
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.substring(0, 80) + '...');
                await client.execute(statement);
            }
        }

        console.log('\n✅ Migration 057 completed successfully!');
        console.log('\nAdded columns:');
        console.log('  - special_event (TEXT) - Event name');
        console.log('  - event_icon (TEXT) - Emoji icon');
        console.log('  - event_date (TEXT) - Event date for sorting');
        console.log('  - Index: idx_discounts_special_event');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
