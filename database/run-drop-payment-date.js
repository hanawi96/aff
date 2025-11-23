/**
 * Migration Runner: Drop payment_date column
 * 
 * This script drops the payment_date text column from commission_payments table
 * We only keep payment_date_unix for consistent timezone handling
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read wrangler.toml to get database info
const wranglerConfig = readFileSync(join(__dirname, '../wrangler.toml'), 'utf-8');
const dbMatch = wranglerConfig.match(/database_name\s*=\s*"([^"]+)"/);
const dbId = wranglerConfig.match(/database_id\s*=\s*"([^"]+)"/);

if (!dbMatch || !dbId) {
    console.error('❌ Could not find database info in wrangler.toml');
    process.exit(1);
}

const DATABASE_NAME = dbMatch[1];
const DATABASE_ID = dbId[1];

console.log('📦 Database:', DATABASE_NAME);
console.log('🆔 Database ID:', DATABASE_ID);

// Read migration SQL
const migrationSQL = readFileSync(
    join(__dirname, 'migrations/030_drop_payment_date_column.sql'),
    'utf-8'
);

console.log('\n📝 Migration SQL:');
console.log('─'.repeat(80));
console.log(migrationSQL);
console.log('─'.repeat(80));

console.log('\n⚠️  WARNING: This will drop the payment_date column!');
console.log('Make sure you have a backup before proceeding.');
console.log('\nTo run this migration, execute:');
console.log(`\nwrangler d1 execute ${DATABASE_NAME} --remote --file=database/migrations/030_drop_payment_date_column.sql\n`);
