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
        console.log('🚀 Starting migration 058: Create flash sales system...\n');

        // Read SQL file
        const sql = fs.readFileSync('./database/migrations/058_create_flash_sales.sql', 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                const preview = statement.trim().substring(0, 80).replace(/\s+/g, ' ');
                console.log('Executing:', preview + '...');
                await client.execute(statement);
            }
        }

        console.log('\n✅ Migration 058 completed successfully!');
        console.log('\nCreated:');
        console.log('  ✓ flash_sales table');
        console.log('  ✓ flash_sale_products table');
        console.log('  ✓ Indexes for performance optimization');
        console.log('\nFlash sales system is ready to use!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('\nError details:', error.message);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
