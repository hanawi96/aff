// Run a specific migration directly
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getEnvFromWrangler() {
    const content = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf8');
    const urlMatch = content.match(/TURSO_DATABASE_URL\s*=\s*"([^"]+)"/);
    const tokenMatch = content.match(/TURSO_AUTH_TOKEN\s*=\s*"([^"]+)"/);
    if (!urlMatch || !tokenMatch) { console.error('❌ Không tìm thấy credentials'); process.exit(1); }
    return { url: urlMatch[1], authToken: tokenMatch[1] };
}

async function run() {
    const { url, authToken } = getEnvFromWrangler();
    console.log('🔌 Kết nối Turso...');
    const client = createClient({ url, authToken });

    const migrationFile = process.argv[2] || '067_add_restored_commission_fields.sql';
    const path = join(__dirname, 'migrations', migrationFile);

    console.log(`📄 Migration: ${migrationFile}`);
    const sql = readFileSync(path, 'utf8');
    const statements = sql.split(';').map(s => s.replace(/--.*$/gm, '').trim()).filter(s => s.length > 0);

    for (const stmt of statements) {
        console.log(`  ▶ ${stmt.substring(0, 80)}...`);
        try {
            await client.execute(stmt);
            console.log('  ✅ OK');
        } catch (error) {
            if (error.message && (
                error.message.includes('duplicate column name') ||
                error.message.includes('duplicate index name')
            )) {
                console.log(`  ⚠️  Bỏ qua: ${error.message.split('\n')[0]}`);
            } else {
                console.error(`  ❌ ${error.message}`);
            }
        }
    }

    console.log('\n✅ Hoàn tất!');
}

run().catch(console.error);
