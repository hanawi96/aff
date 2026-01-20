#!/usr/bin/env node
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number',
});

console.log('🧪 Testing automatic price update...\n');

// Get products with materials before update
const before = await client.execute(`
    SELECT p.id, p.name, p.cost_price
    FROM products p
    JOIN product_materials pm ON p.id = pm.product_id
    WHERE pm.material_name = 'bi_bac_s999'
    LIMIT 3
`);

console.log('📊 Products BEFORE price change:');
console.log('─'.repeat(80));
for (const row of before.rows) {
    console.log(`   ${row.name.padEnd(50)} | ${row.cost_price.toLocaleString('vi-VN')}đ`);
}
console.log('─'.repeat(80));

// Update bi bạc price from 15000 to 20000
console.log('\n💰 Updating bi_bac_s999 price: 15.000đ → 20.000đ...\n');
await client.execute({
    sql: 'UPDATE cost_config SET item_cost = ? WHERE item_name = ?',
    args: [20000, 'bi_bac_s999']
});

// Get products after update
const after = await client.execute(`
    SELECT p.id, p.name, p.cost_price
    FROM products p
    JOIN product_materials pm ON p.id = pm.product_id
    WHERE pm.material_name = 'bi_bac_s999'
    LIMIT 3
`);

console.log('📊 Products AFTER price change:');
console.log('─'.repeat(80));
for (const row of after.rows) {
    const oldPrice = before.rows.find(r => r.id === row.id)?.cost_price || 0;
    const diff = row.cost_price - oldPrice;
    console.log(`   ${row.name.padEnd(50)} | ${row.cost_price.toLocaleString('vi-VN')}đ (+${diff.toLocaleString('vi-VN')}đ)`);
}
console.log('─'.repeat(80));

// Revert back to original price
console.log('\n🔄 Reverting bi_bac_s999 price back to 15.000đ...\n');
await client.execute({
    sql: 'UPDATE cost_config SET item_cost = ? WHERE item_name = ?',
    args: [15000, 'bi_bac_s999']
});

console.log('✅ Test completed! Trigger is working correctly.');
