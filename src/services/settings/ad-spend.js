import { jsonResponse } from '../../utils/response.js';

const DEFAULT_ITEM = 'default_ad_spend';

export function vnDateStrFromMs(ms) {
    return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function vnTodayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function vnYesterdayStr() {
    const todayMs = new Date(`${vnTodayStr()}T12:00:00+07:00`).getTime();
    return vnDateStrFromMs(todayMs - 86400000);
}

/** So sánh ngày VN dạng YYYY-MM-DD */
export function compareVnDates(a, b) {
    return String(a).localeCompare(String(b));
}

export async function getDefaultAdSpendAmount(env) {
    const row = await env.DB.prepare(`
        SELECT item_cost AS amount
        FROM cost_config
        WHERE item_name = ?
        LIMIT 1
    `).bind(DEFAULT_ITEM).first();

    return row?.amount ?? 0;
}

/** Ghi đè — dùng khi sửa tay hoặc áp dụng hôm nay từ cài đặt */
export async function upsertDailyAdSpend(env, spendDate, amount) {
    await env.DB.prepare(`
        INSERT INTO daily_ad_spend (spend_date, amount, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(spend_date) DO UPDATE SET
            amount = excluded.amount,
            updated_at = CURRENT_TIMESTAMP
    `).bind(spendDate, amount).run();
}

/** Chỉ ghi nếu chưa có — cron chốt ngày, backfill, không ghi đè sửa tay */
export async function insertDailyAdSpendIfMissing(env, spendDate, amount) {
    const result = await env.DB.prepare(`
        INSERT INTO daily_ad_spend (spend_date, amount, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(spend_date) DO NOTHING
    `).bind(spendDate, amount).run();

    return (result.meta?.changes || 0) > 0;
}

export function enumerateVnDateStrings(startMs, endMs) {
    const startStr = vnDateStrFromMs(startMs);
    const endStr = vnDateStrFromMs(endMs);
    const dates = [];
    let curMs = new Date(`${startStr}T12:00:00+07:00`).getTime();
    const endDayMs = new Date(`${endStr}T12:00:00+07:00`).getTime();
    while (curMs <= endDayMs) {
        dates.push(vnDateStrFromMs(curMs));
        curMs += 86400000;
    }
    return dates;
}

/**
 * Quy tắc chi QC theo ngày:
 * - snapshot (daily_ad_spend): số đã chốt
 * - live: hôm nay, chưa snapshot — dùng default hiện tại
 * - future: ngày tương lai → 0
 * - past chưa snapshot → insertIfMissing rồi coi là snapshot (fallback nếu cron lỡ)
 */
async function resolveAdSpendDay(env, spendDate, byDate, defaultAmount, todayStr, options = {}) {
    const { seedToday = false } = options;

    if (byDate.has(spendDate)) {
        return { amount: byDate.get(spendDate) || 0, source: 'snapshot' };
    }

    if (compareVnDates(spendDate, todayStr) > 0) {
        return { amount: 0, source: 'future' };
    }

    if (spendDate === todayStr) {
        const amount = defaultAmount || 0;
        if (seedToday && amount > 0) {
            await upsertDailyAdSpend(env, spendDate, amount);
            byDate.set(spendDate, amount);
            return { amount, source: 'snapshot' };
        }
        return { amount, source: 'live' };
    }

    // Ngày đã qua — bắt buộc chốt vào daily_ad_spend (không dùng default live khi chỉ đọc)
    const amount = defaultAmount || 0;
    if (amount > 0) {
        await insertDailyAdSpendIfMissing(env, spendDate, amount);
        byDate.set(spendDate, amount);
    }
    return { amount, source: 'snapshot' };
}

/**
 * Cron 00:00 VN: chốt chi QC hôm qua nếu chưa có bản ghi.
 */
export async function snapshotYesterdayAdSpend(env) {
    const yesterdayStr = vnYesterdayStr();
    const defaultAmount = await getDefaultAdSpendAmount(env);
    const inserted = await insertDailyAdSpendIfMissing(env, yesterdayStr, defaultAmount);

    console.log(`📸 [AD_SPEND] Snapshot ${yesterdayStr}: ${defaultAmount} (${inserted ? 'inserted' : 'already exists'})`);

    return {
        spend_date: yesterdayStr,
        amount: defaultAmount,
        inserted
    };
}

/**
 * Tổng chi QC trong khoảng ngày (VN).
 */
export async function getAdSpendForRange(env, startMs, endMs, { autoSeed = false } = {}) {
    const dates = enumerateVnDateStrings(startMs, endMs);
    if (dates.length === 0) {
        return { amount: 0, days: 0 };
    }

    const rows = await env.DB.prepare(`
        SELECT spend_date, amount
        FROM daily_ad_spend
        WHERE spend_date >= ? AND spend_date <= ?
    `).bind(dates[0], dates[dates.length - 1]).all();

    const byDate = new Map((rows.results || []).map((r) => [r.spend_date, r.amount || 0]));
    const defaultAmount = await getDefaultAdSpendAmount(env);
    const todayStr = vnTodayStr();
    let total = 0;

    for (const spendDate of dates) {
        const resolved = await resolveAdSpendDay(env, spendDate, byDate, defaultAmount, todayStr, {
            seedToday: autoSeed
        });
        total += resolved.amount;
    }

    return { amount: total, days: dates.length };
}

export async function getAdSpendForDate(env, spendDate, { autoSeed = false } = {}) {
    const row = await env.DB.prepare(`
        SELECT amount FROM daily_ad_spend WHERE spend_date = ? LIMIT 1
    `).bind(spendDate).first();

    const byDate = new Map();
    if (row) {
        byDate.set(spendDate, row.amount || 0);
    }

    const defaultAmount = await getDefaultAdSpendAmount(env);
    const todayStr = vnTodayStr();
    const resolved = await resolveAdSpendDay(env, spendDate, byDate, defaultAmount, todayStr, {
        seedToday: autoSeed
    });

    return resolved;
}

export async function getDefaultAdSpend(env, corsHeaders) {
    try {
        const amount = await getDefaultAdSpendAmount(env);
        return jsonResponse({
            success: true,
            amount,
            today: vnTodayStr()
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting default ad spend:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/**
 * Chi QC từng ngày trong khoảng — ngày qua đọc/ghi snapshot, hôm nay live.
 */
export async function getAdSpendMapForRange(env, startMs, endMs) {
    const dates = enumerateVnDateStrings(startMs, endMs);
    if (dates.length === 0) {
        return { days: [], total: 0, defaultAmount: 0 };
    }

    const defaultAmount = await getDefaultAdSpendAmount(env);
    const todayStr = vnTodayStr();
    const rows = await env.DB.prepare(`
        SELECT spend_date, amount
        FROM daily_ad_spend
        WHERE spend_date >= ? AND spend_date <= ?
    `).bind(dates[0], dates[dates.length - 1]).all();

    const byDate = new Map((rows.results || []).map((r) => [r.spend_date, r.amount || 0]));
    let total = 0;

    const days = [];
    for (const spendDate of dates) {
        const resolved = await resolveAdSpendDay(env, spendDate, byDate, defaultAmount, todayStr, {
            seedToday: false
        });
        total += resolved.amount;
        days.push({
            spend_date: spendDate,
            amount: resolved.amount,
            source: resolved.source
        });
    }

    return { days, total, defaultAmount };
}

export async function updateDailyAdSpend(data, env, corsHeaders) {
    try {
        const spendDate = String(data?.spendDate || '').trim();
        const amount = Number(data?.amount);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(spendDate)) {
            return jsonResponse({ success: false, error: 'Ngày không hợp lệ (YYYY-MM-DD)' }, 400, corsHeaders);
        }
        if (!Number.isFinite(amount) || amount < 0) {
            return jsonResponse({ success: false, error: 'Số tiền quảng cáo không hợp lệ' }, 400, corsHeaders);
        }

        await upsertDailyAdSpend(env, spendDate, amount);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật chi QC ngày ' + spendDate,
            spend_date: spendDate,
            amount
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating daily ad spend:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function updateDefaultAdSpend(data, env, corsHeaders) {
    try {
        const amount = Number(data?.amount);
        const applyToday = !!data?.applyToday;

        if (!Number.isFinite(amount) || amount < 0) {
            return jsonResponse({
                success: false,
                error: 'Số tiền quảng cáo không hợp lệ'
            }, 400, corsHeaders);
        }

        await env.DB.prepare(`
            INSERT INTO cost_config (item_name, item_cost, is_default, display_name)
            VALUES (?, ?, 1, 'Ngân sách quảng cáo mặc định/ngày')
            ON CONFLICT(item_name) DO UPDATE SET
                item_cost = excluded.item_cost,
                updated_at = CURRENT_TIMESTAMP
        `).bind(DEFAULT_ITEM, amount).run();

        // Chỉ snapshot hôm nay nếu chọn — không đụng các ngày đã chốt trong daily_ad_spend
        if (applyToday) {
            await upsertDailyAdSpend(env, vnTodayStr(), amount);
        }

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật ngân sách quảng cáo',
            amount,
            appliedToday: applyToday
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating default ad spend:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
