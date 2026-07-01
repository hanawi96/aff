import { jsonResponse } from '../../utils/response.js';
import {
    ORDER_SOURCE_KEY_SQL,
    OI_SOURCE_KEY_SQL,
    queryCustomerSourceBreakdown,
    buildCustomerSources
} from './customer-source-breakdown.js';
import {
    enumerateVnDateStrings,
    getAdSpendMapForRange,
    vnDateStrFromMs,
    vnTodayStr
} from '../settings/ad-spend.js';

const VN_DAY_EXPR = `date(datetime(created_at_unix/1000, 'unixepoch', '+7 hours'))`;
const VN_DAY_EXPR_O = `date(datetime(o.created_at_unix/1000, 'unixepoch', '+7 hours'))`;
const FB_FILTER = `(${ORDER_SOURCE_KEY_SQL}) = 'facebook'`;
const FB_FILTER_O = `(${OI_SOURCE_KEY_SQL}) = 'facebook'`;

export function resolveVnPeriodRange(period) {
    const todayStr = vnTodayStr();
    const todayStartMs = new Date(`${todayStr}T00:00:00+07:00`).getTime();
    const nowMs = Date.now();

    let startMs;
    let endMs = nowMs;

    switch (period) {
        case 'today':
            startMs = todayStartMs;
            break;
        case 'yesterday':
            startMs = todayStartMs - 86400000;
            endMs = todayStartMs - 1;
            break;
        case '7d':
            startMs = todayStartMs - 6 * 86400000;
            break;
        case 'month': {
            const [y, m] = todayStr.split('-').map(Number);
            startMs = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+07:00`).getTime();
            break;
        }
        default:
            startMs = todayStartMs - 86400000;
            endMs = todayStartMs - 1;
            period = 'yesterday';
    }

    const durationMs = endMs - startMs + 1;
    const prevEndMs = startMs - 1;
    const prevStartMs = prevEndMs - durationMs + 1;

    return {
        period,
        startMs,
        endMs,
        startDate: vnDateStrFromMs(startMs),
        endDate: vnDateStrFromMs(endMs),
        prevStartMs,
        prevEndMs
    };
}

function calcAdMetrics(adSpend, fbOrders, fbRevenue, fbGrossProfit) {
    const netProfit = fbGrossProfit - adSpend;
    return {
        ad_spend: adSpend,
        fb_orders: fbOrders,
        fb_revenue: fbRevenue,
        fb_gross_profit: fbGrossProfit,
        net_profit: netProfit,
        net_profit_per_order: fbOrders > 0 ? netProfit / fbOrders : null,
        gross_profit_per_order: fbOrders > 0 ? fbGrossProfit / fbOrders : null,
        revenue_per_order: fbOrders > 0 ? fbRevenue / fbOrders : null,
        gross_margin_pct: fbRevenue > 0 ? (fbGrossProfit / fbRevenue) * 100 : null,
        net_margin_pct: fbRevenue > 0 ? (netProfit / fbRevenue) * 100 : null,
        break_even_roas: fbGrossProfit > 0 ? fbRevenue / fbGrossProfit : null,
        roas: adSpend > 0 ? fbRevenue / adSpend : null,
        cpa: fbOrders > 0 ? adSpend / fbOrders : null
    };
}

function pctChange(current, previous) {
    if (previous == null || previous === undefined) return null;
    if (previous === 0) {
        if (current === 0) return 0;
        return current > 0 ? 100 : -100;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
}

async function queryFacebookDailyStats(env, startMs, endMs) {
    const binds = [startMs, endMs];

    const [ordersRes, productsRes] = await Promise.all([
        env.DB.prepare(`
            SELECT
                ${VN_DAY_EXPR} AS day_key,
                COUNT(*) AS order_count,
                COALESCE(SUM(total_amount), 0) AS revenue,
                COALESCE(SUM(shipping_cost), 0) AS shipping_cost,
                COALESCE(SUM(packaging_cost), 0) AS packaging_cost,
                COALESCE(SUM(commission), 0) AS commission,
                COALESCE(SUM(tax_amount), 0) AS tax
            FROM orders
            WHERE created_at_unix >= ? AND created_at_unix <= ?
              AND ${FB_FILTER}
            GROUP BY day_key
        `).bind(...binds).all(),
        env.DB.prepare(`
            SELECT
                ${VN_DAY_EXPR_O} AS day_key,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) AS product_cost
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ? AND o.created_at_unix <= ?
              AND ${FB_FILTER_O}
            GROUP BY day_key
        `).bind(...binds).all()
    ]);

    const productCostByDay = {};
    (productsRes.results || []).forEach((row) => {
        productCostByDay[row.day_key] = row.product_cost || 0;
    });

    const byDay = {};
    (ordersRes.results || []).forEach((row) => {
        const revenue = row.revenue || 0;
        const cost = (productCostByDay[row.day_key] || 0)
            + (row.shipping_cost || 0)
            + (row.packaging_cost || 0)
            + (row.commission || 0)
            + (row.tax || 0);
        byDay[row.day_key] = {
            fb_orders: row.order_count || 0,
            fb_revenue: revenue,
            fb_gross_profit: revenue - cost
        };
    });

    return byDay;
}

async function buildAdAnalyticsPayload(env, startMs, endMs) {
    const [adSpendData, fbByDay] = await Promise.all([
        getAdSpendMapForRange(env, startMs, endMs),
        queryFacebookDailyStats(env, startMs, endMs)
    ]);

    const dateKeys = enumerateVnDateStrings(startMs, endMs);
    const adSpendByDate = new Map(adSpendData.days.map((d) => [d.spend_date, d]));

    let totals = { ad_spend: 0, fb_orders: 0, fb_revenue: 0, fb_gross_profit: 0 };

    const days = dateKeys.map((date) => {
        const adRow = adSpendByDate.get(date) || { amount: adSpendData.defaultAmount || 0, source: 'default' };
        const fb = fbByDay[date] || { fb_orders: 0, fb_revenue: 0, fb_gross_profit: 0 };

        totals.ad_spend += adRow.amount || 0;
        totals.fb_orders += fb.fb_orders;
        totals.fb_revenue += fb.fb_revenue;
        totals.fb_gross_profit += fb.fb_gross_profit;

        return {
            date,
            ad_spend_source: adRow.source,
            ...calcAdMetrics(adRow.amount || 0, fb.fb_orders, fb.fb_revenue, fb.fb_gross_profit)
        };
    });

    days.reverse();

    const summary = calcAdMetrics(
        totals.ad_spend,
        totals.fb_orders,
        totals.fb_revenue,
        totals.fb_gross_profit
    );

    return { summary, days, default_ad_spend: adSpendData.defaultAmount || 0 };
}

async function queryTotalOrders(env, startMs, endMs) {
    const row = await env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM orders
        WHERE created_at_unix >= ? AND created_at_unix <= ?
    `).bind(startMs, endMs).first();
    return row?.total || 0;
}

function buildSourceCompare(sources, adSpend) {
    return (sources || []).map((s) => {
        const isFacebook = s.source === 'facebook';
        const ad = isFacebook ? (adSpend || 0) : 0;
        const net = (s.profit || 0) - ad;
        return {
            source: s.source,
            label: s.label,
            order_count: s.order_count || 0,
            revenue: s.revenue || 0,
            gross_profit: s.profit || 0,
            gross_margin_pct: s.profit_margin || 0,
            ad_spend: ad,
            net_profit: net,
            net_margin_pct: (s.revenue || 0) > 0 ? (net / s.revenue) * 100 : null,
            is_ad_channel: isFacebook
        };
    }).filter((s) => s.order_count > 0 || s.revenue > 0);
}

function buildPeriodInsights(days) {
    const list = days || [];
    let profitable = 0;
    let loss = 0;
    let flat = 0;
    list.forEach((d) => {
        const np = d.net_profit || 0;
        if (np > 0) profitable += 1;
        else if (np < 0) loss += 1;
        else flat += 1;
    });
    return {
        total_days: list.length,
        profitable_days: profitable,
        loss_days: loss,
        flat_days: flat
    };
}

async function buildAdAnalyticsFull(env, startMs, endMs) {
    const [payload, totalOrders, sourceBreakdown] = await Promise.all([
        buildAdAnalyticsPayload(env, startMs, endMs),
        queryTotalOrders(env, startMs, endMs),
        queryCustomerSourceBreakdown(env, startMs, endMs)
    ]);

    const totalRevenue = (sourceBreakdown.ordersRows || []).reduce(
        (sum, row) => sum + (row.revenue || 0), 0
    );
    const sources = buildCustomerSources(
        sourceBreakdown.ordersRows,
        sourceBreakdown.productRows,
        totalRevenue
    );

    payload.summary.total_orders = totalOrders;
    payload.summary.fb_order_share_pct = totalOrders > 0
        ? (payload.summary.fb_orders / totalOrders) * 100
        : null;

    return {
        ...payload,
        source_compare: buildSourceCompare(sources, payload.summary.ad_spend),
        period_insights: buildPeriodInsights(payload.days)
    };
}

export async function getAdAnalytics(period, env, corsHeaders) {
    try {
        const range = resolveVnPeriodRange(period || 'yesterday');
        const [current, previous] = await Promise.all([
            buildAdAnalyticsFull(env, range.startMs, range.endMs),
            buildAdAnalyticsFull(env, range.prevStartMs, range.prevEndMs)
        ]);

        const compare = {
            ad_spend_pct: pctChange(current.summary.ad_spend, previous.summary.ad_spend),
            fb_orders_pct: pctChange(current.summary.fb_orders, previous.summary.fb_orders),
            fb_revenue_pct: pctChange(current.summary.fb_revenue, previous.summary.fb_revenue),
            net_profit_pct: pctChange(current.summary.net_profit, previous.summary.net_profit),
            net_profit_per_order_pct: pctChange(
                current.summary.net_profit_per_order,
                previous.summary.net_profit_per_order
            ),
            revenue_per_order_pct: pctChange(
                current.summary.revenue_per_order,
                previous.summary.revenue_per_order
            ),
            roas_pct: pctChange(current.summary.roas, previous.summary.roas),
            cpa_pct: pctChange(current.summary.cpa, previous.summary.cpa)
        };

        return jsonResponse({
            success: true,
            period: range.period,
            start_date: range.startDate,
            end_date: range.endDate,
            today: vnTodayStr(),
            default_ad_spend: current.default_ad_spend,
            summary: current.summary,
            compare,
            days: current.days,
            source_compare: current.source_compare,
            period_insights: current.period_insights
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting ad analytics:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
