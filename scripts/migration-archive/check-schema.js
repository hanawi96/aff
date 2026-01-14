// Check table schema
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkSchema() {
  // Get order_items schema
  const result = await client.execute(`PRAGMA table_info(order_items)`);
  console.log('📋 order_items schema:');
  console.table(result.rows);
}

checkSchema();
