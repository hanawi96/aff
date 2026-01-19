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
        console.log('🚀 Starting migration 041: Remove old datetime columns from ctv\n');

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
        console.log(`  created_at_unix: ${hasCreatedAtUnix ? '✅ exists' : '❌ not found'}`);
        console.log(`  updated_at_unix: ${hasUpdatedAtUnix ? '✅ exists' : '❌ not found'}\n`);

        if (!hasCreatedAtUnix || !hasUpdatedAtUnix) {
            console.error('❌ Error: Unix timestamp columns not found! Run migration 040 first.');
            process.exit(1);
        }

        if (!hasCreatedAt && !hasUpdatedAt) {
            console.log('✅ Old datetime columns already removed. Nothing to do.\n');
            process.exit(0);
        }

        // Step 2: Create backup
        console.log('Step 2: Creating backup...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        await client.execute(`CREATE TABLE ctv_backup_${timestamp.replace(/-/g, '')} AS SELECT * FROM ctv`);
        console.log(`  ✅ Backup created: ctv_backup_${timestamp.replace(/-/g, '')}\n`);

        // Step 3: Drop trigger
        console.log('Step 3: Dropping old trigger...');
        try {
            await client.execute('DROP TRIGGER IF EXISTS update_ctv_timestamp');
            console.log('  ✅ Dropped update_ctv_timestamp trigger');
        } catch (e) {
            console.log('  ⚠️  Trigger not found');
        }
        console.log();

        // Step 4: Drop old columns
        console.log('Step 4: Dropping old datetime columns...');
        
        if (hasCreatedAt) {
            await client.execute('ALTER TABLE ctv DROP COLUMN created_at');
            console.log('  ✅ Dropped created_at column');
        }
        
        if (hasUpdatedAt) {
            await client.execute('ALTER TABLE ctv DROP COLUMN updated_at');
            console.log('  ✅ Dropped updated_at column');
        }
        console.log();

        // Step 5: Verify final schema
        console.log('Step 5: Verifying final schema...');
        const finalTableInfo = await client.execute('PRAGMA table_info(ctv)');
        const finalColumns = finalTableInfo.rows.map(row => row.name);
        
        const stillHasCreatedAt = finalColumns.includes('created_at');
        const stillHasUpdatedAt = finalColumns.includes('updated_at');
        const stillHasCreatedAtUnix = finalColumns.includes('created_at_unix');
        const stillHasUpdatedAtUnix = finalColumns.includes('updated_at_unix');
        
        console.log(`  created_at: ${stillHasCreatedAt ? '❌ still exists' : '✅ removed'}`);
        console.log(`  updated_at: ${stillHasUpdatedAt ? '❌ still exists' : '✅ removed'}`);
        console.log(`  created_at_unix: ${stillHasCreatedAtUnix ? '✅ exists' : '❌ missing'}`);
        console.log(`  updated_at_unix: ${stillHasUpdatedAtUnix ? '✅ exists' : '❌ missing'}\n`);

        if (stillHasCreatedAt || stillHasUpdatedAt) {
            console.error('❌ Migration failed: Old columns still exist');
            process.exit(1);
        }

        if (!stillHasCreatedAtUnix || !stillHasUpdatedAtUnix) {
            console.error('❌ Migration failed: Unix timestamp columns missing');
            process.exit(1);
        }

        console.log('✅ Migration 041 completed successfully!\n');
        console.log('Summary:');
        console.log('  - Removed created_at column');
        console.log('  - Removed updated_at column');
        console.log('  - Removed update_ctv_timestamp trigger');
        console.log('  - Kept created_at_unix and updated_at_unix');
        console.log('  - All data preserved in Unix timestamp format\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
