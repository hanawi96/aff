// Migration 066: Chuẩn hóa order_items.size — chuỗi placeholder "chưa có" → NULL
const { initTurso } = require('./turso-client.js');

async function runMigration() {
    console.log('🚀 Migration 066: order_items.size placeholder → NULL...');

    const db = initTurso({
        TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN
    });

    try {
        const variants = ['chưa có', 'chua co', 'chua có', 'Chưa có', 'CHƯA CÓ', 'CHUA CO'];
        for (const v of variants) {
            const r = await db.prepare('UPDATE order_items SET size = NULL WHERE TRIM(size) = ?').bind(v).run();
            const n = r?.meta?.changes ?? r?.changes ?? 0;
            if (n > 0) console.log(`  ✓ Đã cập nhật ${n} dòng (size = '${v}')`);
        }

        console.log('✅ Migration 066 hoàn tất.');
    } catch (error) {
        console.error('❌ Migration 066 failed:', error);
        throw error;
    }
}

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runMigration };
