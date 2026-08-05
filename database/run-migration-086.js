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
        console.log('🚀 Starting Migration 086: is_makeup on orders...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '086_add_is_makeup_to_orders.sql'),
            'utf8'
        );

        await client.executeMultiple(migrationSQL);

        console.log('✅ Migration 086 completed successfully!');
    } catch (error) {
        if (String(error?.message || error).includes('duplicate column')) {
            console.log('ℹ️ Column is_makeup already exists — skip');
            return;
        }
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
