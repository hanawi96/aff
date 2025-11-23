/**
 * Migration Runner: Migrate payment_date to payment_date_unix
 * 
 * This script converts existing payment_date (text YYYY-MM-DD) to payment_date_unix (timestamp)
 * for all existing payment records
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
    join(__dirname, 'migrations/031_migrate_payment_date_to_unix.sql'),
    'utf-8'
);

console.log('\n📝 Migration SQL:');
console.log('─'.repeat(80));
console.log(migrationSQL);
console.log('─'.repeat(80));

console.log('\n✅ This migration will convert payment_date to payment_date_unix');
console.log('It will NOT drop the payment_date column yet.');
console.log('\nTo run this migration, execute:');
console.log(`\nwrangler d1 execute ${DATABASE_NAME} --remote --file=database/migrations/031_migrate_payment_date_to_unix.sql\n`);
console.log('After verifying the data is correct, you can run:');
console.log(`wrangler d1 execute ${DATABASE_NAME} --remote --file=database/migrations/030_drop_payment_date_column.sql\n`);
