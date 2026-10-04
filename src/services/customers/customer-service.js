import { jsonResponse } from '../../utils/response.js';

const CUSTOMER_SEGMENTS = new Set(['VIP', 'Regular', 'New', 'At Risk', 'Churned']);
const CUSTOMER_SORT_SQL = {
    name: 'name COLLATE NOCASE',
    phone: 'phone',
    segment: 'segment',
    total_orders: 'total_orders',
    total_spent: 'total_spent',
    last_order_date: 'last_order_date',
};

function timestampMs(ts) {
    if (ts == null || ts === '') return null;
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    const n = Number(ts);
    if (Number.isFinite(n) && String(ts).trim() !== '') return n;
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : null;
}

function enrichCustomer(customer, now) {
    const lastMs = timestampMs(customer.last_order_date);
    const firstMs = timestampMs(customer.first_order_date);
    const daysSinceLastOrder = lastMs == null ? null : Math.floor((now - lastMs) / 86400000);
    const daysSinceFirstOrder = firstMs == null ? null : Math.floor((now - firstMs) / 86400000);

    let segment = 'New';
    const totalOrders = Number(customer.total_orders) || 0;
    if (totalOrders >= 5) {
        segment = 'VIP';
    } else if (totalOrders >= 2) {
        segment = 'Regular';
    }

    if (daysSinceLastOrder > 90) {
        segment = 'Churned';
    } else if (daysSinceLastOrder > 60) {
        segment = 'At Risk';
    }

    const totalSpent = Number(customer.total_spent) || 0;
    return {
        ...customer,
        total_orders: totalOrders,
        total_spent: totalSpent,
        avg_order_value: totalOrders ? totalSpent / totalOrders : 0,
        days_since_last_order: daysSinceLastOrder,
        days_since_first_order: daysSinceFirstOrder,
        segment,
    };
}

// Customers are aggregated from orders. Pass limit/offset to page the list.
// Without limit, the full grouped list is returned (export and older callers).
export async function getAllCustomers(env, corsHeaders, options = {}) {
    try {
        const now = Date.now();
        const q = String(options.q || '').trim();
        const segment = CUSTOMER_SEGMENTS.has(options.segment) ? options.segment : 'all';
        const sortKey = CUSTOMER_SORT_SQL[options.sort] ? options.sort : 'total_spent';
        const dir = String(options.dir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const includeStats = options.stats === '1' || options.stats === 'true' || options.stats === true;

        const limitParam = options.limit;
        const hasLimit = limitParam !== undefined && limitParam !== null && String(limitParam) !== '';
        let limit = null;
        if (hasLimit) {
            limit = parseInt(limitParam, 10);
            if (!Number.isFinite(limit) || limit < 1) limit = 40;
            if (limit > 10000) limit = 10000;
        }
        const offset = Math.max(parseInt(options.offset, 10) || 0, 0);

        const searchClause = q
            ? `AND (customer_name LIKE ? OR customer_phone LIKE ?)`
            : '';
        const searchBinds = q ? [`%${q}%`, `%${q}%`] : [];
        const orderSql = sortKey === 'phone'
            ? `phone ${dir}`
            : `${CUSTOMER_SORT_SQL[sortKey]} ${dir}, phone ASC`;

        const groupedSql = `
            WITH grouped AS (
                SELECT
                    customer_phone AS phone,
                    MAX(customer_name) AS name,
                    MAX(address) AS address,
                    MAX(province_id) AS province_id,
                    MAX(province_name) AS province_name,
                    COUNT(*) AS total_orders,
                    SUM(total_amount) AS total_spent,
                    MAX(created_at_unix) AS last_order_date,
                    MIN(created_at_unix) AS first_order_date,
                    GROUP_CONCAT(DISTINCT referral_code) AS ctv_codes
                FROM orders
                WHERE customer_phone IS NOT NULL AND customer_phone != ''
                ${searchClause}
                GROUP BY customer_phone
            ),
            labeled AS (
                SELECT
                    grouped.*,
                    CASE
                        WHEN last_order_date IS NOT NULL AND CAST((? - last_order_date) / 86400000.0 AS INTEGER) > 90 THEN 'Churned'
                        WHEN last_order_date IS NOT NULL AND CAST((? - last_order_date) / 86400000.0 AS INTEGER) > 60 THEN 'At Risk'
                        WHEN total_orders >= 5 THEN 'VIP'
                        WHEN total_orders >= 2 THEN 'Regular'
                        ELSE 'New'
                    END AS segment
                FROM grouped
            )
        `;

        const whereSql = `WHERE (? = 'all' OR segment = ?)`;
        const filterBinds = [...searchBinds, now, now, segment === 'all' ? 'all' : segment, segment];

        const pageSql = `
            ${groupedSql}
            SELECT * FROM labeled
            ${whereSql}
            ORDER BY ${orderSql}
            ${hasLimit ? 'LIMIT ? OFFSET ?' : ''}
        `;
        const countSql = `
            ${groupedSql}
            SELECT COUNT(*) AS total FROM labeled
            ${whereSql}
        `;
        const pageBinds = hasLimit ? [...filterBinds, limit, offset] : filterBinds;

        const statsSql = `
            SELECT
                COUNT(*) AS total_customers,
                COALESCE(SUM(spent), 0) AS total_revenue,
                COALESCE(SUM(orders_n), 0) AS total_orders,
                COALESCE(SUM(CASE
                    WHEN first_order IS NOT NULL AND CAST((? - first_order) / 86400000.0 AS INTEGER) <= 30 THEN 1
                    ELSE 0
                END), 0) AS new_customers
            FROM (
                SELECT
                    SUM(total_amount) AS spent,
                    COUNT(*) AS orders_n,
                    MIN(created_at_unix) AS first_order
                FROM orders
                WHERE customer_phone IS NOT NULL AND customer_phone != ''
                GROUP BY customer_phone
            )
        `;

        const pagePromise = env.DB.prepare(pageSql).bind(...pageBinds).all();
        const countPromise = env.DB.prepare(countSql).bind(...filterBinds).first();
        const statsPromise = includeStats
            ? env.DB.prepare(statsSql).bind(now).first()
            : Promise.resolve(null);

        const [pageResult, countResult, statsResult] = await Promise.all([
            pagePromise,
            countPromise,
            statsPromise,
        ]);

        const enrichedCustomers = (pageResult.results || []).map((customer) => enrichCustomer(customer, now));
        const total = Number(countResult?.total) || 0;

        const body = {
            success: true,
            customers: enrichedCustomers,
            total,
        };

        if (includeStats && statsResult) {
            const totalOrders = Number(statsResult.total_orders) || 0;
            const totalRevenue = Number(statsResult.total_revenue) || 0;
            body.stats = {
                totalCustomers: Number(statsResult.total_customers) || 0,
                newCustomers: Number(statsResult.new_customers) || 0,
                totalRevenue,
                totalOrders,
            };
        }

        console.log('📊 getAllCustomers:', { total, returned: enrichedCustomers.length, offset, limit });

        return jsonResponse(body, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting customers:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Quick check if customer is new or returning (lightweight query)
export async function checkCustomer(phone, env, corsHeaders) {
    try {
        console.log('checkCustomer called with phone:', phone);
        
        if (!phone || phone.trim() === '') {
            console.log('Phone is empty or null');
            return jsonResponse({
                success: false,
                error: 'Phone number is required'
            }, 400, corsHeaders);
        }

        // Simple count query - very fast
        const result = await env.DB.prepare(`
            SELECT COUNT(*) as order_count
            FROM orders
            WHERE customer_phone = ?
        `).bind(phone).first();

        const orderCount = result?.order_count || 0;
        console.log('Order count for phone', phone, ':', orderCount);

        return jsonResponse({
            success: true,
            isNew: orderCount === 0,
            orderCount: orderCount
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error checking customer:', error);
        return jsonResponse({
            success: false,
            error: 'Internal server error',
            details: error.message
        }, 500, corsHeaders);
    }
}

// Get customer detail with order history
export async function getCustomerDetail(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Phone number is required'
            }, 400, corsHeaders);
        }

        // Get customer summary - use total_amount column
        const summary = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                MAX(customer_name) as name,
                MAX(address) as address,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(created_at_unix) as last_order_date,
                MIN(created_at_unix) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE customer_phone = ?
            GROUP BY customer_phone
        `).bind(phone).first();

        if (!summary) {
            return jsonResponse({
                success: false,
                error: 'Customer not found'
            }, 404, corsHeaders);
        }

        // Get order history - use total_amount column and include address fields
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                id,
                order_id,
                created_at_unix,
                total_amount,
                status,
                referral_code,
                commission,
                products,
                shipping_fee,
                address,
                province_id,
                district_id,
                ward_id,
                street_address
            FROM orders 
            WHERE customer_phone = ? 
            ORDER BY created_at_unix DESC
        `).bind(phone).all();

        // Calculate metrics
        const daysSinceLastOrder = summary.last_order_date
            ? Math.floor((Date.now() - new Date(summary.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const daysSinceFirstOrder = summary.first_order_date
            ? Math.floor((Date.now() - new Date(summary.first_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Classify customer
        let segment = 'New';
        if (summary.total_orders >= 5) {
            segment = 'VIP';
        } else if (summary.total_orders >= 2) {
            segment = 'Regular';
        }

        if (daysSinceLastOrder > 90) {
            segment = 'Churned';
        } else if (daysSinceLastOrder > 60) {
            segment = 'At Risk';
        }

        const customerDetail = {
            ...summary,
            avg_order_value: summary.total_spent / summary.total_orders,
            days_since_last_order: daysSinceLastOrder,
            days_since_first_order: daysSinceFirstOrder,
            segment: segment,
            orders: orders
        };

        return jsonResponse({
            success: true,
            customer: customerDetail
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customer detail:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Search customers
export async function searchCustomers(query, env, corsHeaders) {
    try {
        if (!query || query.trim() === '') {
            return await getAllCustomers(env, corsHeaders);
        }

        const searchTerm = `%${query.trim()}%`;

        const { results: customers } = await env.DB.prepare(`
            SELECT 
                customer_phone as phone,
                customer_name as name,
                MAX(address) as address,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_spent,
                MAX(created_at_unix) as last_order_date,
                MIN(created_at_unix) as first_order_date,
                GROUP_CONCAT(DISTINCT referral_code) as ctv_codes
            FROM orders
            WHERE (customer_name LIKE ? OR customer_phone LIKE ?)
            AND customer_phone IS NOT NULL AND customer_phone != ''
            GROUP BY customer_phone
            ORDER BY total_spent DESC
        `).bind(searchTerm, searchTerm).all();

        const enrichedCustomers = customers.map((customer) => enrichCustomer(customer, Date.now()));

        return jsonResponse({
            success: true,
            customers: enrichedCustomers
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error searching customers:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get note for a customer
export async function getCustomerNote(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({ success: false, error: 'Số điện thoại là bắt buộc' }, 400, corsHeaders);
        }

        const note = await env.DB.prepare(`
            SELECT id, phone, content, created_at, updated_at, created_by, updated_by
            FROM customer_notes
            WHERE phone = ?
        `).bind(phone).first();

        return jsonResponse({
            success: true,
            note: note || { phone, content: '' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customer note:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Get notes for multiple customers (batch - for table list)
export async function getCustomerNotesBatch(phones, env, corsHeaders) {
    try {
        if (!phones || phones.length === 0) {
            return jsonResponse({ success: true, notes: {} }, 200, corsHeaders);
        }

        const placeholders = phones.map(() => '?').join(',');
        const { results } = await env.DB.prepare(`
            SELECT phone, content, updated_at
            FROM customer_notes
            WHERE phone IN (${placeholders})
        `).bind(...phones).all();

        const notesMap = {};
        for (const row of results) {
            notesMap[row.phone] = {
                content: row.content,
                updated_at: row.updated_at,
                has_content: row.content && row.content.trim().length > 0
            };
        }

        return jsonResponse({
            success: true,
            notes: notesMap
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting customer notes batch:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Save (create or update) note for a customer
export async function saveCustomerNote(phone, content, created_by, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({ success: false, error: 'Số điện thoại là bắt buộc' }, 400, corsHeaders);
        }

        const now = Math.floor(Date.now() / 1000);
        const trimmed = (content || '').trim();

        // Check if note exists
        const existing = await env.DB.prepare(`
            SELECT id FROM customer_notes WHERE phone = ?
        `).bind(phone).first();

        if (existing) {
            await env.DB.prepare(`
                UPDATE customer_notes
                SET content = ?, updated_at = ?, updated_by = ?
                WHERE phone = ?
            `).bind(trimmed, now, created_by || null, phone).run();
        } else {
            await env.DB.prepare(`
                INSERT INTO customer_notes (phone, content, created_at, updated_at, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(phone, trimmed, now, now, created_by || null, created_by || null).run();
        }

        return jsonResponse({
            success: true,
            note: {
                phone,
                content: trimmed,
                updated_at: now,
                has_content: trimmed.length > 0
            }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error saving customer note:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}
