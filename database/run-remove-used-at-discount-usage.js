import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
  process.exit(1);
}

console.log('🔄 Starting migration: Remove used_at column from discount_usage...');
console.log(`📁 Database: ${TURSO_DATABASE_URL}`);

try {
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
    intMode: 'number',
  });

  console.log('\n📋 Step 1: Creating new table without used_at column...');
  await client.execute(`
    CREATE TABLE discount_usage_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discount_id INTEGER NOT NULL,
      discount_code TEXT NOT NULL,
      order_id TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT NOT NULL,
      order_amount INTEGER,
      discount_amount INTEGER,
      gift_received TEXT,
      ip_address TEXT,
      user_agent TEXT,
      used_at_unix INTEGER,
      FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
    )
  `);
  console.log('✅ New table created');

  console.log('\n📋 Step 2: Copying data from old table...');
  const copyResult = await client.execute(`
    INSERT INTO discount_usage_new 
    SELECT id, discount_id, discount_code, order_id, customer_name, customer_phone, 
           order_amount, discount_amount, gift_received, ip_address, user_agent, used_at_unix
    FROM discount_usage
  `);
  console.log(`✅ Data copied: ${copyResult.rowsAffected} rows`);

  console.log('\n📋 Step 3: Dropping old table...');
  await client.execute('DROP TABLE discount_usage');
  console.log('✅ Old table dropped');

  console.log('\n📋 Step 4: Renaming new table...');
  await client.execute('ALTER TABLE discount_usage_new RENAME TO discount_usage');
  console.log('✅ Table renamed');

  const countResult = await client.execute('SELECT COUNT(*) as count FROM discount_usage');
  const rowCount = countResult.rows[0]?.count || 0;

  console.log('\n✨ Migration completed successfully!');
  console.log(`📊 Final row count: ${rowCount}`);

  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}
