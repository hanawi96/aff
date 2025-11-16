// Script to run database migrations
// Usage: node database/run-migration.js <migration-file>

const fs = require('fs');
const path = require('path');

// Read migration file
const migrationFile = process.argv[2] || 'database/migrations/003_normalize_order_status.sql';
const migrationPath = path.join(process.cwd(), migrationFile);

if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Migration file:', migrationFile);
console.log('📝 SQL to execute:');
console.log('─'.repeat(50));
console.log(sql);
console.log('─'.repeat(50));
console.log('\n⚠️  To run this migration on Cloudflare D1:');
console.log('\n1. Run the following command:');
console.log(`   npx wrangler d1 execute vdt --file=${migrationFile}`);
console.log('\n2. Or run each SQL statement manually in D1 console');
console.log('\nNote: This script shows the SQL but does not execute it.');
console.log('You need to run it using wrangler CLI as shown above.');
