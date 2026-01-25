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
        console.log('🚀 Starting Migration 061: Create product_favorites table...');

        // Read migration file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '061_create_product_favorites.sql'),
            'utf8'
        );

        // Execute as single statement
        console.log('Executing migration...');
        await client.executeMultiple(migrationSQL);

        console.log('✅ Migration 061 completed successfully!');
        console.log('📊 Created product_favorites table with indexes');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
