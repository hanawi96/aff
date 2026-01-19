import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const TURSO_DATABASE_URL = envVars.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = envVars.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env file');
    process.exit(1);
}

const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
});

async function runMigration() {
    try {
        console.log('🚀 Starting migration 040: Add Unix timestamps to ctv table\n');

        // Step 1: Check current schema
        console.log('Step 1: Checking current schema...');
        const tableInfo = await client.execute('PRAGMA table_info(ctv)');
        const columns = tableInfo.rows.map(row => row.name);
        
        const hasCreatedAt = columns.includes('created_at');
        const hasUpdatedAt = columns.includes('updated_at');
        const hasCreatedAtUnix = columns.includes('created_at_unix');
        const hasUpdatedAtUnix = columns.includes('updated_at_unix');
        
        console.log(`  created_at: ${hasCreatedAt ? '✅ exists' : '❌ not found'}`);
        console.log(`  updated_at: ${hasUpdatedAt ? '✅ exists' : '❌ not found'}`);
        console.log(`  created_at_unix: ${hasCreatedAtUnix ? '⚠️  already exists' : '❌ not found'}`);
        console.log(`  updated_at_unix: ${hasUpdatedAtUnix ? '⚠️  already exists' : '❌ not found'}\n`);

        if (hasCreatedAtUnix && hasUpdatedAtUnix) {
            console.log('✅ Unix timestamp columns already exist. Skipping migration.\n');
            process.exit(0);
        }

        // Step 2: Count records
        console.log('Step 2: Counting records...');
        const countResult = await client.execute('SELECT COUNT(*) as count FROM ctv');
        const totalRecords = countResult.rows[0].count;
        console.log(`  Total CTV records: ${totalRecords}\n`);

        // Step 3: Add new columns
        console.log('Step 3: Adding Unix timestamp columns...');
        
        if (!hasCreatedAtUnix) {
            await client.execute('ALTER TABLE ctv ADD COLUMN created_at_unix INTEGER');
            console.log('  ✅ Added created_at_unix column');
        }
        
        if (!hasUpdatedAtUnix) {
            await client.execute('ALTER TABLE ctv ADD COLUMN updated_at_unix INTEGER');
            console.log('  ✅ Added updated_at_unix column');
        }
        console.log();

        // Step 4: Migrate data
        console.log('Step 4: Migrating existing data...');
        console.log('  Converting DATETIME strings to Unix timestamps (milliseconds)...');
        
        // Migrate created_at
        await client.execute(`
            UPDATE ctv 
            SET created_at_unix = CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER)
            WHERE created_at IS NOT NULL
        `);
        console.log('  ✅ Migrated created_at → created_at_unix');
        
        // Migrate updated_at
        await client.execute(`
            UPDATE ctv 
            SET updated_at_unix = CAST((julianday(updated_at) - 2440587.5) * 86400000 AS INTEGER)
            WHERE updated_at IS NOT NULL
        `);
        console.log('  ✅ Migrated updated_at → updated_at_unix\n');

        // Step 5: Verify migration
        console.log('Step 5: Verifying migration...');
        const verifyResult = await client.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(created_at_unix) as with_created_unix,
                COUNT(updated_at_unix) as with_updated_unix
            FROM ctv
        `);
        
        const stats = verifyResult.rows[0];
        console.log(`  Total records: ${stats.total}`);
        console.log(`  With created_at_unix: ${stats.with_created_unix}`);
        console.log(`  With updated_at_unix: ${stats.with_updated_unix}\n`);

        // Sample data check
        console.log('Step 6: Sample data comparison...');
        const sampleResult = await client.execute(`
            SELECT 
                id,
                full_name,
                created_at,
                created_at_unix,
                updated_at,
                updated_at_unix
            FROM ctv 
            LIMIT 3
        `);
        
        console.log('  Sample records:');
        sampleResult.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.full_name}`);
            console.log(`     created_at: ${row.created_at} → ${row.created_at_unix}`);
            console.log(`     updated_at: ${row.updated_at} → ${row.updated_at_unix}`);
            
            // Verify conversion
            if (row.created_at && row.created_at_unix) {
                const date = new Date(row.created_at_unix);
                console.log(`     Verify: ${date.toISOString()}`);
            }
        });
        console.log();

        // Step 7: Create indexes
        console.log('Step 7: Creating indexes...');
        await client.execute('CREATE INDEX IF NOT EXISTS idx_ctv_created_at_unix ON ctv(created_at_unix)');
        await client.execute('CREATE INDEX IF NOT EXISTS idx_ctv_updated_at_unix ON ctv(updated_at_unix)');
        console.log('  ✅ Indexes created\n');

        console.log('✅ Migration 040 completed successfully!\n');
        console.log('Summary:');
        console.log(`  - Added created_at_unix and updated_at_unix columns`);
        console.log(`  - Migrated ${stats.with_created_unix} created_at timestamps`);
        console.log(`  - Migrated ${stats.with_updated_unix} updated_at timestamps`);
        console.log(`  - Created performance indexes`);
        console.log(`\nNext step: Update backend code to use Unix timestamps, then run migration 041 to remove old columns.\n`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
