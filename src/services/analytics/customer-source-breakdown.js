/** Shared customer-source aggregation (facebook / zalo / tiktok / unknown). */

export const SOURCE_ORDER = ['facebook', 'zalo', 'tiktok', 'unknown'];

export const SOURCE_LABELS = {
    facebook: 'Facebook',
    zalo: 'Zalo',
    tiktok: 'TikTok',
    unknown: 'Chưa ghi nguồn'
};

const ORDER_SOURCE_KEY_SQL = `
    CASE
        WHEN LOWER(TRIM(customer_source)) = 'zalo' THEN 'zalo'
        WHEN LOWER(TRIM(customer_source)) = 'facebook' THEN 'facebook'
        WHEN LOWER(TRIM(customer_source)) = 'tiktok' THEN 'tiktok'
        ELSE 'unknown'
    END`;

const OI_SOURCE_KEY_SQL = `
    CASE
        WHEN LOWER(TRIM(o.customer_source)) = 'zalo' THEN 'zalo'
        WHEN LOWER(TRIM(o.customer_source)) = 'facebook' THEN 'facebook'
        WHEN LOWER(TRIM(o.customer_source)) = 'tiktok' THEN 'tiktok'
        ELSE 'unknown'
    END`;

/**
 * Run 2 parallel GROUP BY queries for the given date range.
 * @returns {{ ordersRows: object[], productRows: object[] }}
 */
export async function queryCustomerSourceBreakdown(env, startMs, endMs) {
    const endClause = endMs != null ? ' AND created_at_unix <= ?' : '';
    const endClauseO = endMs != null ? ' AND o.created_at_unix <= ?' : '';
    const binds = endMs != null ? [startMs, endMs] : [startMs];

    const [ordersRes, productsRes] = await Promise.all([
        env.DB.prepare(`
            SELECT
                ${ORDER_SOURCE_KEY_SQL} AS source_key,
                COUNT(*) AS order_count,
                COALESCE(SUM(total_amount), 0) AS revenue,
                COALESCE(SUM(shipping_cost), 0) AS shipping_cost,
                COALESCE(SUM(packaging_cost), 0) AS packaging_cost,
                COALESCE(SUM(commission), 0) AS commission,
                COALESCE(SUM(tax_amount), 0) AS tax
            FROM orders
            WHERE created_at_unix >= ?${endClause}
            GROUP BY source_key
        `).bind(...binds).all(),
        env.DB.prepare(`
            SELECT
                ${OI_SOURCE_KEY_SQL} AS source_key,
                COALESCE(SUM(oi.product_cost * oi.quantity), 0) AS product_cost
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at_unix >= ?${endClauseO}
            GROUP BY source_key
        `).bind(...binds).all()
    ]);

    return {
        ordersRows: ordersRes.results || [],
        productRows: productsRes.results || []
    };
}

/**
 * Merge raw SQL rows into sorted customer_sources array.
 */
export function buildCustomerSources(ordersRows, productRows, totalRevenue) {
    const productCostBySource = {};
    (productRows || []).forEach((row) => {
        productCostBySource[row.source_key] = row.product_cost || 0;
    });

    const sourceAgg = {};
    (ordersRows || []).forEach((row) => {
        sourceAgg[row.source_key] = row;
    });

    return SOURCE_ORDER.map((key) => {
        const row = sourceAgg[key] || {};
        const revenue = row.revenue || 0;
        const orderCount = row.order_count || 0;
        const cost = (productCostBySource[key] || 0)
            + (row.shipping_cost || 0)
            + (row.packaging_cost || 0)
            + (row.commission || 0)
            + (row.tax || 0);
        const profit = revenue - cost;
        return {
            source: key,
            label: SOURCE_LABELS[key] || key,
            order_count: orderCount,
            revenue,
            cost,
            profit,
            profit_margin: revenue > 0 ? (profit / revenue * 100) : 0,
            revenue_share: totalRevenue > 0 ? (revenue / totalRevenue * 100) : 0,
            avg_order_value: orderCount > 0 ? (revenue / orderCount) : 0
        };
    }).filter((s) => s.order_count > 0 || s.revenue > 0);
}
