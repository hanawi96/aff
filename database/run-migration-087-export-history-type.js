// Migration 087: Add type + invoice_row_count columns to export_history
// Usage: node run-migration-087-export-history-type.js
import { initTurso } from './turso-client.js';

async function runMigration() {
    console.log('🚀 Migration 087: Adding type + invoice_row_count to export_history...');

    const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
    const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
        console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
        process.exit(1);
    }

    const DB = initTurso({ TURSO_DATABASE_URL, TURSO_AUTH_TOKEN });

    try {
        // Check if columns already exist
        const colsResult = await DB.prepare(`PRAGMA table_info(export_history)`).all();
        const colNames = colsResult.results.map(c => c.name);

        if (!colNames.includes('type')) {
            console.log('📝 Adding column: type TEXT DEFAULT "spx"');
            await DB.prepare(`ALTER TABLE export_history ADD COLUMN type TEXT DEFAULT "spx"`).run();
            console.log('✅ Column type added');
        } else {
            console.log('ℹ️  Column type already exists');
        }

        if (!colNames.includes('invoice_row_count')) {
            console.log('📝 Adding column: invoice_row_count INTEGER DEFAULT 0');
            await DB.prepare(`ALTER TABLE export_history ADD COLUMN invoice_row_count INTEGER DEFAULT 0`).run();
            console.log('✅ Column invoice_row_count added');
        } else {
            console.log('ℹ️  Column invoice_row_count already exists');
        }

        // Verify final schema
        const finalResult = await DB.prepare(`PRAGMA table_info(export_history)`).all();
        console.log('\n📋 Final export_history columns:');
        finalResult.results.forEach(c => console.log(`   - ${c.name} (${c.type})`));

        console.log('\n✅ Migration 087 completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
