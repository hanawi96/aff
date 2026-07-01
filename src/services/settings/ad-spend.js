import { jsonResponse } from '../../utils/response.js';

const DEFAULT_ITEM = 'default_ad_spend';

export function vnDateStrFromMs(ms) {
    return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function vnTodayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
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

export async function upsertDailyAdSpend(env, spendDate, amount) {
    await env.DB.prepare(`
        INSERT INTO daily_ad_spend (spend_date, amount, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(spend_date) DO UPDATE SET
            amount = excluded.amount,
            updated_at = CURRENT_TIMESTAMP
    `).bind(spendDate, amount).run();
}

/**
 * Lấy chi QC của một ngày. Nếu chưa có bản ghi và autoSeed=true, ghi snapshot từ ngân sách mặc định.
 */
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
 * Tổng chi QC trong khoảng ngày (VN). Ngày chưa có bản ghi → dùng ngân sách mặc định.
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
    let total = 0;

    for (const spendDate of dates) {
        if (byDate.has(spendDate)) {
            total += byDate.get(spendDate) || 0;
            continue;
        }
        if (autoSeed && defaultAmount > 0) {
            await upsertDailyAdSpend(env, spendDate, defaultAmount);
            total += defaultAmount;
        } else {
            total += defaultAmount || 0;
        }
    }

    return { amount: total, days: dates.length };
}

export async function getAdSpendForDate(env, spendDate, { autoSeed = false } = {}) {
    const row = await env.DB.prepare(`
        SELECT amount FROM daily_ad_spend WHERE spend_date = ? LIMIT 1
    `).bind(spendDate).first();

    if (row) {
        return { amount: row.amount || 0, source: 'daily' };
    }

    const defaultAmount = await getDefaultAdSpendAmount(env);
    if (autoSeed && defaultAmount > 0) {
        await upsertDailyAdSpend(env, spendDate, defaultAmount);
        return { amount: defaultAmount, source: 'default_seeded' };
    }

    return { amount: defaultAmount || 0, source: 'default' };
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
