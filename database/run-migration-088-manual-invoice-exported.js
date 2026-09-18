// Migration 088: Add manual_invoice_exported column to orders table
// Usage: node run-migration-088-manual-invoice-exported.js
import { initTurso } from './turso-client.js';

async function run() {
    console.log('🔧 [Migration 088] Adding manual_invoice_exported to orders...');

    const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
    const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
        console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
        process.exit(1);
    }

    const DB = initTurso({ TURSO_DATABASE_URL, TURSO_AUTH_TOKEN });

    // 1. Check if column already exists
    const tableInfo = await DB.prepare(`PRAGMA table_info(orders)`).all();
    const existingCols = tableInfo.results.map(r => r.name);

    if (existingCols.includes('manual_invoice_exported')) {
        console.log('   ✅ Column manual_invoice_exported already exists, skipping');
        return;
    }

    // 2. Add column
    await DB.prepare(`ALTER TABLE orders ADD COLUMN manual_invoice_exported INTEGER DEFAULT 0`).run();
    console.log('   ✅ Added column manual_invoice_exported');

    // 3. Verify
    const verify = await DB.prepare(`PRAGMA table_info(orders)`).all();
    const invoiceCols = verify.results
        .filter(r => r.name.includes('invoice') || r.name === 'manual_invoice_exported')
        .map(r => `${r.name}(${r.type})=${r.dflt_value ?? 'NULL'}`);
    console.log('   📋 Invoice columns:', invoiceCols.join(', '));

    console.log('✅ [Migration 088] Done');
}

run().catch(err => {
    console.error('❌ [Migration 088] Failed:', err);
    process.exit(1);
});
