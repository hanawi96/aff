import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
  process.exit(1);
}

console.log('🔄 Populating used_at_unix for discount_usage records...');

try {
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
    intMode: 'number',
  });

  // Get all records with null used_at_unix
  console.log('\n📋 Step 1: Finding records with null used_at_unix...');
  const { rows: nullRecords } = await client.execute(`
    SELECT id FROM discount_usage WHERE used_at_unix IS NULL
  `);
  
  console.log(`Found ${nullRecords.length} records with null used_at_unix`);

  if (nullRecords.length === 0) {
    console.log('✅ All records already have used_at_unix populated');
    process.exit(0);
  }

  // Update with current timestamp (in milliseconds)
  console.log('\n📋 Step 2: Updating records with current timestamp...');
  const now = Math.floor(Date.now() / 1000); // Convert to seconds
  
  const updateResult = await client.execute(`
    UPDATE discount_usage 
    SET used_at_unix = ? 
    WHERE used_at_unix IS NULL
  `, [now]);

  console.log(`✅ Updated ${updateResult.rowsAffected} records`);

  // Verify
  console.log('\n📋 Step 3: Verifying update...');
  const { rows: verifyRecords } = await client.execute(`
    SELECT COUNT(*) as count FROM discount_usage WHERE used_at_unix IS NULL
  `);

  const remainingNull = verifyRecords[0]?.count || 0;
  
  if (remainingNull === 0) {
    console.log('✅ All records now have used_at_unix populated');
    console.log('\n✨ Migration completed successfully!');
  } else {
    console.log(`⚠️ Warning: ${remainingNull} records still have null used_at_unix`);
  }

  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}
