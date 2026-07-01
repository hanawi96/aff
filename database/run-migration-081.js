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
        console.log('🚀 Starting Migration 081: daily_ad_spend + default_ad_spend...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '081_create_daily_ad_spend.sql'),
            'utf8'
        );

        await client.executeMultiple(migrationSQL);

        console.log('✅ Migration 081 completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
