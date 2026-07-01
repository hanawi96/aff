/**
 * Migration 082: Backfill daily_ad_spend cho các ngày đã qua (chưa có snapshot).
 * Mặc định lịch sử: 210.000đ/ngày (khớp migration 081).
 */
const { createClient } = require('@libsql/client');
require('dotenv').config();

const BACKFILL_AMOUNT = 210000;
const BACKFILL_START = '2024-01-01';

function vnTodayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function vnYesterdayStr() {
    const todayMs = new Date(`${vnTodayStr()}T12:00:00+07:00`).getTime();
    return new Date(todayMs - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function enumerateDates(startStr, endStr) {
    const dates = [];
    let curMs = new Date(`${startStr}T12:00:00+07:00`).getTime();
    const endMs = new Date(`${endStr}T12:00:00+07:00`).getTime();
    while (curMs <= endMs) {
        dates.push(new Date(curMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
        curMs += 86400000;
    }
    return dates;
}

async function runMigration() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        const endDate = vnYesterdayStr();
        console.log(`🚀 Migration 082: backfill daily_ad_spend ${BACKFILL_START} → ${endDate} @ ${BACKFILL_AMOUNT}đ`);

        const existing = await client.execute({
            sql: 'SELECT spend_date FROM daily_ad_spend WHERE spend_date >= ? AND spend_date <= ?',
            args: [BACKFILL_START, endDate],
        });
        const have = new Set((existing.rows || []).map((r) => r.spend_date));

        const dates = enumerateDates(BACKFILL_START, endDate);
        let inserted = 0;
        let skipped = 0;

        for (const spendDate of dates) {
            if (have.has(spendDate)) {
                skipped += 1;
                continue;
            }
            await client.execute({
                sql: `INSERT INTO daily_ad_spend (spend_date, amount, updated_at)
                      VALUES (?, ?, CURRENT_TIMESTAMP)
                      ON CONFLICT(spend_date) DO NOTHING`,
                args: [spendDate, BACKFILL_AMOUNT],
            });
            inserted += 1;
        }

        console.log(`✅ Migration 082 done: ${inserted} inserted, ${skipped} already had rows`);
    } catch (error) {
        console.error('❌ Migration 082 failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

runMigration();
