// Import D1 export to Turso database
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const SQL_FILE = 'd1_remote_export.sql';

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing environment variables!');
  console.error('Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env file');
  process.exit(1);
}

console.log('========================================');
console.log('🚀 Importing D1 data to Turso');
console.log('========================================\n');

console.log('📍 Database:', TURSO_URL);
console.log('📄 SQL File:', SQL_FILE);
console.log('');

// Create Turso client
const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

async function importData() {
  try {
    // Read SQL file
    console.log('📖 Reading SQL file...');
    const sqlContent = readFileSync(SQL_FILE, 'utf-8');
    console.log(`✅ File size: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

    // Split SQL into statements (simple split by semicolon)
    console.log('🔄 Parsing SQL statements...');
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`✅ Found ${statements.length} SQL statements\n`);

    // Execute statements one by one
    console.log('⚡ Executing SQL statements...\n');
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Skip PRAGMA statements
      if (stmt.startsWith('PRAGMA')) {
        console.log(`⏭️  [${i + 1}/${statements.length}] Skipping PRAGMA statement`);
        continue;
      }

      try {
        await client.execute(stmt);
        successCount++;
        
        // Show progress for important statements
        if (stmt.startsWith('CREATE TABLE')) {
          const tableName = stmt.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`✅ [${i + 1}/${statements.length}] Created table: ${tableName}`);
        } else if (stmt.startsWith('INSERT INTO')) {
          const tableName = stmt.match(/INSERT INTO "?(\w+)"?/i)?.[1];
          if (i % 10 === 0) { // Show every 10th insert
            console.log(`📝 [${i + 1}/${statements.length}] Inserting into: ${tableName}...`);
          }
        } else if (stmt.startsWith('CREATE INDEX')) {
          const indexName = stmt.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`🔧 [${i + 1}/${statements.length}] Created index: ${indexName}`);
        } else if (stmt.startsWith('CREATE TRIGGER')) {
          const triggerName = stmt.match(/CREATE TRIGGER (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`⚡ [${i + 1}/${statements.length}] Created trigger: ${triggerName}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [${i + 1}/${statements.length}] Error:`, error.message);
        
        // Show the problematic statement (first 100 chars)
        console.error(`   Statement: ${stmt.substring(0, 100)}...`);
        
        // Continue with next statement
      }
    }

    console.log('\n========================================');
    console.log('📊 Import Summary');
    console.log('========================================\n');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${statements.length}`);
    console.log('');

    // Verify data
    console.log('🔍 Verifying imported data...\n');
    
    const tables = ['ctv', 'orders', 'order_items', 'products', 'categories', 'customers', 'discounts', 'users'];
    
    for (const table of tables) {
      try {
        const result = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result.rows[0].count;
        console.log(`✅ ${table.padEnd(20)} - ${count} rows`);
      } catch (error) {
        console.log(`⚠️  ${table.padEnd(20)} - Table not found or error`);
      }
    }

    console.log('\n========================================');
    console.log('🎉 Import completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

importData();
