const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        console.log('🚀 Starting Migration 084: dedupe pending_unsaved_orders...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '084_dedupe_pending_unsaved_orders.sql'),
            'utf8'
        );

        await client.executeMultiple(migrationSQL);

        console.log('✅ Migration 084 completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
