// Migration 065: Add is_featured column to categories table
const { initTurso } = require('./turso-client.js');

async function runMigration() {
    console.log('🚀 Starting Migration 065: Add is_featured to categories...');

    const db = initTurso({
        TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN
    });

    try {
        const { rows: tableInfo } = await db.execute('PRAGMA table_info(categories)');
        const hasIsFeatured = (tableInfo || []).some((col) => col.name === 'is_featured');

        if (!hasIsFeatured) {
            console.log('📝 Adding is_featured column...');
            await db.exec('ALTER TABLE categories ADD COLUMN is_featured INTEGER DEFAULT 0');
        } else {
            console.log('ℹ️ Column is_featured already exists, skipping ALTER TABLE');
        }

        console.log('📝 Creating index idx_categories_featured (if missing)...');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_categories_featured ON categories(is_featured)');

        console.log('✅ Migration 065 completed successfully!');
    } catch (error) {
        console.error('❌ Migration 065 failed:', error);
        throw error;
    }
}

if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('🎉 Migration completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };
