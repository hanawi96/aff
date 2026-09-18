// Migration 089: Add invoice_exported_at column to orders table
// ─────────────────────────────────────────────────────────────────────────────
// Phương án C: Thêm cột invoice_exported_at để tracking riêng đơn đã xuất HĐĐT
// qua hệ thống (bên cạnh manual_invoice_exported = đánh dấu thủ công).
//
// Logic chống trùng khi tải file:
//   UPDATE orders SET invoice_exported_at = ?, manual_invoice_exported = 1
//   WHERE id = ?
//     AND (invoice_exported_at IS NULL OR invoice_exported_at = 0)  ← chưa xuất qua hệ thống
//     AND COALESCE(manual_invoice_exported, 0) = 0                  ← chưa đánh dấu thủ công
//
// Usage: node run-migration-089-invoice-exported-at.js
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('🔧 [Migration 089] Adding invoice_exported_at to orders...');

    // Ưu tiên env vars, fallback về wrangler.toml credentials (dùng HTTP URL cho libsql client)
    const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io';
    const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

    if (!TURSO_AUTH_TOKEN) {
        console.error('❌ Missing TURSO_AUTH_TOKEN');
        process.exit(1);
    }

    const client = createClient({
        url: TURSO_DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN,
        intMode: 'number'
    });

    // 1. Check if column already exists
    const tableInfo = await client.execute(`PRAGMA table_info(orders)`);
    const existingCols = tableInfo.rows.map(r => r.name);

    if (existingCols.includes('invoice_exported_at')) {
        console.log('   ✅ Column invoice_exported_at already exists, skipping');
        return;
    }

    // 2. Add column (INTEGER for Unix ms timestamp, NULL by default)
    await client.execute(`ALTER TABLE orders ADD COLUMN invoice_exported_at INTEGER`);
    console.log('   ✅ Added column invoice_exported_at INTEGER (NULL default)');

    // 3. Verify
    const verify = await client.execute(`PRAGMA table_info(orders)`);
    const invoiceCols = verify.rows
        .filter(r => r.name.includes('invoice') || r.name === 'manual_invoice_exported')
        .map(r => `${r.name}(${r.type})=${r.dflt_value ?? 'NULL'}`);
    console.log('   📋 Invoice columns:', invoiceCols.join(', '));

    console.log('✅ [Migration 089] Done');
}

run().catch(err => {
    console.error('❌ [Migration 089] Failed:', err);
    process.exit(1);
});
