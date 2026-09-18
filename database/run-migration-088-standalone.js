// Run Migration 088: Add manual_invoice_exported column to orders table
// Usage: node database/run-migration-088-standalone.js
// Needs: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars

const DATABASE_URL = process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io';
const AUTH_TOKEN    = process.env.TURSO_AUTH_TOKEN    || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg';

// Parse Turso v2 rows format: {results: [{response: {result: {cols: [...], rows: [[{type,value},...],...}}}]}
function parseResult(json) {
    const result = json.results?.[0];
    if (!result) return { cols: [], rows: [] };
    const resp = result.response || result;
    const exec = resp.response || resp;
    const cols = exec.result?.cols || exec.cols || [];
    const rawRows = exec.result?.rows || exec.rows || [];
    // Each row is [{type, value}, ...] — extract values
    const rows = rawRows.map(row => {
        const obj = {};
        cols.forEach((col, i) => { obj[col.name] = row[i]?.value ?? null; });
        return obj;
    });
    return { cols, rows };
}

async function http(sql) {
    const base = DATABASE_URL.startsWith('libsql://')
        ? DATABASE_URL.replace('libsql://', 'https://')
        : DATABASE_URL;
    const url = `${base}/v2/pipeline`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [{ type: 'execute', stmt: { sql, params: [] } }]
        })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json;
}

async function run() {
    console.log('🔧 [Migration 088] Adding manual_invoice_exported to orders...');

    // Check existing columns
    const r = await http(`PRAGMA table_info(orders)`);
    const { rows: cols } = parseResult(r);
    const colNames = cols.map(c => c.name);

    if (colNames.includes('manual_invoice_exported')) {
        console.log('   ✅ Column manual_invoice_exported already exists, skipping');
    } else {
        console.log('   📝 Columns found:', colNames.join(', '));
        console.log('   📝 Adding manual_invoice_exported...');
        await http(`ALTER TABLE orders ADD COLUMN manual_invoice_exported INTEGER DEFAULT 0`);
        console.log('   ✅ Column added');
    }

    // Verify
    const v = await http(`PRAGMA table_info(orders)`);
    const { rows: allCols } = parseResult(v);
    const invoiceCols = allCols
        .filter(c => c.name.includes('invoice') || c.name === 'manual_invoice_exported')
        .map(c => `${c.name}=${c.dflt_value ?? 'NULL'}`);
    console.log('   📋 Invoice columns:', invoiceCols.join(', '));
    console.log('✅ [Migration 088] Done');
}

run().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
