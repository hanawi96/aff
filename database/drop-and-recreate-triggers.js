#!/usr/bin/env node
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('🗑️  Dropping old triggers...\n');

await client.execute('DROP TRIGGER IF EXISTS update_product_cost_after_material_insert');
await client.execute('DROP TRIGGER IF EXISTS update_product_cost_after_material_update');
await client.execute('DROP TRIGGER IF EXISTS update_product_cost_after_material_delete');
await client.execute('DROP TRIGGER IF EXISTS update_all_products_cost_after_material_price_change');

console.log('✅ Old triggers dropped\n');
console.log('🔧 Now run: node database/create-triggers-048.js');
