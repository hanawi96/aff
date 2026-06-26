import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const w = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf8');
const url = w.match(/TURSO_DATABASE_URL\s*=\s*"([^"]+)"/)[1];
const authToken = w.match(/TURSO_AUTH_TOKEN\s*=\s*"([^"]+)"/)[1];

const client = createClient({ url, authToken });
const info = await client.execute('PRAGMA table_info(orders)');
const col = info.rows.find((x) => x.name === 'deposit_amount');

if (!col) {
    console.error('FAIL: deposit_amount column not found');
    process.exit(1);
}

console.log('OK deposit_amount:', col);
const stats = await client.execute(`
    SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN COALESCE(deposit_amount, 0) = 0 THEN 1 ELSE 0 END) AS zero_deposit
    FROM orders
`);
console.log('OK orders stats:', stats.rows[0]);
client.close();
