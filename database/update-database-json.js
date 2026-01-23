import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function updateDatabaseJson() {
    try {
        console.log('🔄 Updating database.json with current schema...\n');

        // Get all tables
        const { rows: tables } = await client.execute(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='table' 
                AND name NOT LIKE 'sqlite_%'
                AND name NOT LIKE '_litestream_%'
            ORDER BY name
        `);

        // Format as JSON
        const schema = tables.map(table => ({
            name: table.name,
            sql: table.sql
        }));

        // Write to file
        fs.writeFileSync(
            './database/database.json',
            JSON.stringify(schema, null, 2),
            'utf8'
        );

        console.log('✅ database.json updated successfully!');
        console.log(`\nTotal tables: ${schema.length}`);
        console.log('\nTables included:');
        schema.forEach(table => {
            console.log(`  - ${table.name}`);
        });

    } catch (error) {
        console.error('❌ Update failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

updateDatabaseJson();
