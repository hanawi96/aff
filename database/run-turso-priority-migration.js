// Run priority migration on Turso database
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env file');
    process.exit(1);
}

async function runMigration() {
    console.log('🚀 Starting priority migration on Turso...\n');

    const client = createClient({
        url: TURSO_DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN,
    });

    try {
        // Step 1: Add is_priority column
        console.log('📝 Step 1: Adding is_priority column...');
        await client.execute(`
            ALTER TABLE orders ADD COLUMN is_priority INTEGER DEFAULT 0
        `);
        console.log('✅ Column added successfully\n');

        // Step 2: Create index
        console.log('📝 Step 2: Creating index...');
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(is_priority)
        `);
        console.log('✅ Index created successfully\n');

        // Step 3: Update existing orders
        console.log('📝 Step 3: Updating existing orders...');
        const result = await client.execute(`
            UPDATE orders SET is_priority = 0 WHERE is_priority IS NULL
        `);
        console.log(`✅ Updated ${result.rowsAffected} orders\n`);

        // Verify
        console.log('🔍 Verifying migration...');
        const verify = await client.execute(`
            SELECT COUNT(*) as total, 
                   SUM(CASE WHEN is_priority = 0 THEN 1 ELSE 0 END) as normal,
                   SUM(CASE WHEN is_priority = 1 THEN 1 ELSE 0 END) as priority
            FROM orders
        `);
        
        const stats = verify.rows[0];
        console.log(`📊 Total orders: ${stats.total}`);
        console.log(`   - Normal: ${stats.normal}`);
        console.log(`   - Priority: ${stats.priority}`);

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
