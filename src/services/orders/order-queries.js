import { jsonResponse } from '../../utils/response.js';
import { normalizePhone } from '../../utils/validators.js';

// Lấy đơn hàng theo mã CTV
export async function getOrdersByReferralCode(referralCode, env, corsHeaders) {
    try {
        if (!referralCode) {
            return jsonResponse({
                success: false,
                error: 'Mã referral không được để trống'
            }, 400, corsHeaders);
        }

        // is_excluded: đồng bộ tab Thanh toán CTV (đơn bị loại HH vẫn hiện trong bảng, có cờ)
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.*,
                COALESCE(
                    (SELECT MAX(cpd.is_excluded) FROM commission_payment_details cpd WHERE cpd.order_id = o.id),
                    0
                ) AS is_excluded
            FROM orders o
            WHERE o.referral_code = ?
            ORDER BY o.created_at_unix DESC
        `).bind(referralCode).all();

        // Get CTV info
        const ctvInfo = await env.DB.prepare(`
            SELECT full_name as name, phone, city as address
            FROM ctv
            WHERE referral_code = ?
        `).bind(referralCode).first();

        return jsonResponse({
            success: true,
            orders: orders,
            referralCode: referralCode,
            ctvInfo: ctvInfo || { name: 'Chưa cập nhật', phone: 'Chưa cập nhật', address: 'Chưa cập nhật' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng theo SĐT CTV
export async function getOrdersByPhone(phone, env, corsHeaders) {
    try {
        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không được để trống'
            }, 400, corsHeaders);
        }

        const normalizedPhone = normalizePhone(phone);

        // Get orders
        const { results: orders } = await env.DB.prepare(`
            SELECT * FROM orders
            WHERE ctv_phone = ? OR ctv_phone = ?
            ORDER BY created_at_unix DESC
        `).bind(normalizedPhone, '0' + normalizedPhone).all();

        // Get CTV info
        const ctvInfo = await env.DB.prepare(`
            SELECT full_name as name, phone, city as address
            FROM ctv
            WHERE phone = ? OR phone = ?
        `).bind(normalizedPhone, '0' + normalizedPhone).first();

        const referralCode = orders.length > 0 ? orders[0].referral_code : '';

        return jsonResponse({
            success: true,
            orders: orders,
            referralCode: referralCode,
            phone: phone,
            ctvInfo: ctvInfo || { name: 'Không tìm thấy', phone: phone, address: 'Không tìm thấy' }
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting orders by phone:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Lấy đơn hàng mới nhất
export async function getRecentOrders(limit, env, corsHeaders, lite = false) {
    try {
        // product_cost = tổng giá vốn từ order_items.
        // Trước đây dùng subquery tương quan → chạy 1 lần / đơn (N+1, rất chậm trên D1).
        // Đổi sang LEFT JOIN + GROUP BY: chỉ quét order_items một lần, tận dụng index
        // idx_order_items_order_id (migration 079). orders.id là PK nên các cột orders.*
        // và ctv.commission_rate phụ thuộc hàm vào GROUP BY orders.id — hợp lệ trên SQLite/D1.
        //
        // lite=true (dùng cho danh sách mobile): BỎ JOIN order_items + SUM(product_cost)
        // — phần nặng nhất (GROUP BY) mà danh sách mobile KHÔNG dùng đến. Vẫn giữ JOIN ctv
        // (rẻ, có index) để có ctv_commission_rate. → query nhẹ & nhanh hơn nhiều.
        //
        // Ngoài ra chỉ SELECT đúng các cột mà DANH SÁCH/CHI TIẾT/TÌM KIẾM/ĐẾM mobile dùng tới,
        // BỎ các cột chỉ cần khi SỬA đơn (địa chỉ tách phần, đóng gói, thuế, giá vốn ship, mã/giá
        // giảm) → giảm payload đáng kể. Khi mở SỬA đơn, mobile gọi getOrderById để lấy full.
        // (Lưu ý: vẫn GIỮ address gộp, commission, commission_rate, referral_code, shipping_fee
        //  vì chi tiết + tìm kiếm + tính lại hoa hồng ở chi tiết có dùng.)
        // Thông tin HĐĐT đã xuất (chỉ tính các file đã tải về = status='downloaded'):
        //   - invoice_exported_count         : số file HĐ đã bao gồm đơn này và đã tải
        //   - last_invoice_export_id         : id file gần nhất (để click badge mở đúng file)
        //   - last_invoice_export_file_name  : tên file gần nhất (hiển thị tooltip)
        //   - last_invoice_downloaded_at     : mốc thời gian tải (sắp xếp/tooltip)
        // order_ids được lưu dạng JSON array → json_each để khớp với orders.id.
        // Dùng subquery tương quan cho file_name/export_id (1 row / đơn) thay vì JOIN
        // để tránh phá GROUP BY hiện tại và đảm bảo đúng "gần nhất".
        const sql = lite
            ? `SELECT
                   orders.id, orders.order_id, orders.customer_name, orders.customer_phone,
                   orders.address, orders.products, orders.notes, orders.status,
                   orders.total_amount, orders.deposit_amount, orders.payment_method,
                   orders.shipping_fee, orders.commission, orders.commission_rate,
                   orders.referral_code, orders.is_priority, orders.is_makeup,
                   orders.created_at_unix, orders.shipped_at_unix, orders.planned_send_at_unix,
                   orders.customer_source,
                   ctv.commission_rate as ctv_commission_rate,
                   COALESCE(orders.manual_invoice_exported, 0) AS manual_invoice_exported,
                   COALESCE(orders.invoice_exported_at, 0) AS invoice_exported_at
               FROM orders
               LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
               ORDER BY orders.created_at_unix DESC
               LIMIT ?`
            : `SELECT
                   orders.*,
                   ctv.commission_rate as ctv_commission_rate,
                   -- TÍNH product_cost từ subquery riêng để tránh nhân đôi khi JOIN với export_history
                   COALESCE(
                       (SELECT SUM(oi.product_cost * oi.quantity) 
                        FROM order_items oi 
                        WHERE oi.order_id = orders.id),
                       0
                   ) as product_cost,
                   -- Đếm file HĐĐT đã tải từ export_history + manual_invoice_exported (nếu đã tick thủ công)
                   (CASE WHEN COALESCE(orders.manual_invoice_exported, 0) = 1 THEN 1 ELSE 0 END)
                   + (SELECT COUNT(DISTINCT eh.id) 
                      FROM export_history eh
                      WHERE eh.type='invoice' 
                        AND eh.status='downloaded'
                        AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
                     ) AS invoice_exported_count,
                   (SELECT MAX(eh.downloaded_at)
                    FROM export_history eh
                    WHERE eh.type='invoice' 
                      AND eh.status='downloaded'
                      AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
                   ) AS last_invoice_downloaded_at,
                   (SELECT eh2.id FROM export_history eh2
                       WHERE eh2.type='invoice' AND eh2.status='downloaded'
                         AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
                       ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_id,
                   (SELECT eh2.file_name FROM export_history eh2
                       WHERE eh2.type='invoice' AND eh2.status='downloaded'
                         AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
                       ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_file_name,
                   COALESCE(orders.invoice_exported_at, 0) AS invoice_exported_at
               FROM orders
               LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
               ORDER BY orders.created_at_unix DESC
               LIMIT ?`;

        const { results: orders } = await env.DB.prepare(sql).bind(limit).all();

        return jsonResponse({
            success: true,
            orders: orders,
            total: orders.length
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error getting recent orders:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// SELECT dùng chung (shape đầy đủ, giống getRecentOrders bản đầy đủ) — tránh lặp SQL dài.
// {WHERE} và {ORDER_LIMIT} được thay ở từng hàm gọi.
const ORDER_FULL_SELECT = `
    SELECT
        orders.*,
        ctv.commission_rate as ctv_commission_rate,
        COALESCE(
            (SELECT SUM(oi.product_cost * oi.quantity)
             FROM order_items oi
             WHERE oi.order_id = orders.id),
            0
        ) as product_cost,
        (CASE WHEN COALESCE(orders.manual_invoice_exported, 0) = 1 THEN 1 ELSE 0 END)
        + (SELECT COUNT(DISTINCT eh.id)
           FROM export_history eh
           WHERE eh.type='invoice' AND eh.status='downloaded'
             AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
          ) AS invoice_exported_count,
        (SELECT MAX(eh.downloaded_at)
         FROM export_history eh
         WHERE eh.type='invoice' AND eh.status='downloaded'
           AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
        ) AS last_invoice_downloaded_at,
        (SELECT eh2.id FROM export_history eh2
            WHERE eh2.type='invoice' AND eh2.status='downloaded'
              AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
            ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_id,
        (SELECT eh2.file_name FROM export_history eh2
            WHERE eh2.type='invoice' AND eh2.status='downloaded'
              AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
            ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_file_name,
        COALESCE(orders.invoice_exported_at, 0) AS invoice_exported_at
    FROM orders
    LEFT JOIN ctv ON orders.referral_code = ctv.referral_code`;

/**
 * LUỒNG 1 — Lấy TOÀN BỘ đơn CHƯA GỬI HÀNG (pending / awaiting_reship / send_later),
 * KHÔNG giới hạn số lượng, KHÔNG phân trang.
 *
 * Đây là tập dữ liệu nhỏ & bị chặn (đơn xử lý xong chuyển sang 'shipped' → rời khỏi tập),
 * phục vụ mọi tính năng toàn cục ở client: banner "gửi sau cần làm", panel "thẻ tên bé",
 * badge "chưa có size", chip chọn nhanh theo ngày, đếm số đơn chưa gửi. Vì tải đủ tập này
 * nên các tính năng đó vẫn chính xác 100% như trước (không bị giới hạn top-1000 như getRecentOrders).
 */
export async function getUnshippedOrders(env, corsHeaders) {
    const startTime = Date.now();
    try {
        const sql = `${ORDER_FULL_SELECT}
            WHERE LOWER(TRIM(orders.status)) IN ('pending', 'awaiting_reship', 'send_later', 'processing')
            ORDER BY orders.created_at_unix DESC`;

        const { results: orders } = await env.DB.prepare(sql).all();

        const queryTime = Date.now() - startTime;
        console.log(`✅ [getUnshippedOrders] Tải ${orders.length} đơn chưa gửi hàng (${queryTime}ms)`);

        return jsonResponse({
            success: true,
            orders: orders,
            total: orders.length,
            bucket: 'unshipped',
            queryTime
        }, 200, corsHeaders);
    } catch (error) {
        console.error('❌ [getUnshippedOrders] Lỗi:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// Đồng bộ với public/assets/js/invoices.js (INV_REMIND_DAYS, INV_CREATED_FROM_MS).
const INVOICE_DUE_REMIND_DAYS = 10;
const INVOICE_DUE_CREATED_FROM_MS = new Date('2026-09-05T00:00:00+07:00').getTime();

/**
 * Đơn thuộc phạm vi xuất HĐĐT từ mốc 05/09/2026:
 * đặt từ mốc đó, hoặc gửi từ mốc đó (kể cả đơn đặt trước).
 */
function invoiceScopeClause() {
    return `(orders.created_at_unix >= ? OR COALESCE(orders.shipped_at_unix, 0) >= ?)`;
}

/**
 * Điều kiện đơn đã đến hạn xuất HĐĐT.
 * applyDefaultCreatedFrom: badge đếm áp mốc 05/09/2026 (ngày đặt hoặc ngày gửi).
 * Danh sách "Chọn đơn cần xuất" áp mốc này khi client truyền createdFromMs.
 */
function buildDueInvoiceFilter(params, { applyDefaultCreatedFrom = false } = {}) {
    const _rd = parseInt(params?.remindDays, 10);
    const remindDays = Number.isFinite(_rd) && _rd >= 0 ? _rd : INVOICE_DUE_REMIND_DAYS;
    let createdFromMs = null;
    if (params?.createdFromMs != null && params.createdFromMs !== '' && Number.isFinite(Number(params.createdFromMs))) {
        createdFromMs = Number(params.createdFromMs);
    } else if (applyDefaultCreatedFrom) {
        createdFromMs = INVOICE_DUE_CREATED_FROM_MS;
    }
    const dueThreshold = Date.now() - remindDays * 86400000;
    const where = [
        `LOWER(TRIM(orders.status)) = 'shipped'`,
        `COALESCE(orders.invoice_exported_at, 0) = 0`,
        `COALESCE(orders.manual_invoice_exported, 0) = 0`,
        `orders.shipped_at_unix IS NOT NULL`,
        `orders.shipped_at_unix > 0`,
        `orders.shipped_at_unix <= ?`
    ];
    const binds = [dueThreshold];
    if (createdFromMs != null) {
        where.push(invoiceScopeClause());
        binds.push(createdFromMs, createdFromMs);
    }
    return { where, binds, remindDays };
}

/**
 * Đếm đơn đã đến hạn xuất HĐĐT — chỉ một số, dùng cho badge sidebar.
 * Cùng điều kiện với getDueInvoiceOrders, cộng mốc 05/09/2026 theo ngày đặt hoặc ngày gửi.
 */
export async function getDueInvoiceCount(params, env, corsHeaders) {
    const startTime = Date.now();
    try {
        const { where, binds, remindDays } = buildDueInvoiceFilter(params, { applyDefaultCreatedFrom: true });
        const row = await env.DB.prepare(
            `SELECT COUNT(*) AS count FROM orders WHERE ${where.join(' AND ')}`
        ).bind(...binds).first();
        const count = Number(row?.count || 0);
        const queryTime = Date.now() - startTime;
        console.log(`✅ [getDueInvoiceCount] ${count} đơn đến hạn (remindDays=${remindDays}, ${queryTime}ms)`);
        return jsonResponse({ success: true, count, queryTime }, 200, corsHeaders);
    } catch (error) {
        console.error('❌ [getDueInvoiceCount] Lỗi:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/**
 * Lấy TOÀN BỘ đơn ĐẾN HẠN XUẤT HĐĐT — dùng cho nút "Chọn đơn cần xuất" (chọn xuyên trang).
 * Điều kiện:
 *   - status = 'shipped'
 *   - CHƯA xuất HĐĐT (invoice_exported_at = 0 AND manual_invoice_exported = 0)
 *   - Đã đủ ≥ remindDays ngày kể từ ngày GỬI (shipped_at_unix <= now - remindDays*ngày)
 *   - Đặt từ createdFromMs, hoặc gửi từ mốc đó (nếu truyền) — đồng bộ trang HĐĐT
 * Trả về FULL shape (dùng luôn để build Excel export), có trần an toàn để tránh tải quá lớn.
 *
 * @param {object} params { remindDays, createdFromMs, maxLimit }
 */
export async function getDueInvoiceOrders(params, env, corsHeaders) {
    const startTime = Date.now();
    try {
        const { where, binds, remindDays } = buildDueInvoiceFilter(params);
        const maxLimit = Math.min(Math.max(parseInt(params?.maxLimit, 10) || 1000, 1), 2000);

        const sql = `${ORDER_FULL_SELECT}
            WHERE ${where.join(' AND ')}
            ORDER BY orders.shipped_at_unix ASC, orders.id ASC
            LIMIT ?`;
        binds.push(maxLimit);

        const { results: orders } = await env.DB.prepare(sql).bind(...binds).all();

        const queryTime = Date.now() - startTime;
        console.log(`✅ [getDueInvoiceOrders] ${orders.length} đơn đến hạn xuất HĐĐT (remindDays=${remindDays}, ${queryTime}ms)`);

        return jsonResponse({
            success: true,
            orders,
            total: orders.length,
            capped: orders.length >= maxLimit, // đã chạm trần → có thể còn nữa
            queryTime
        }, 200, corsHeaders);
    } catch (error) {
        console.error('❌ [getDueInvoiceOrders] Lỗi:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/**
 * LUỒNG 2 — Cursor pagination cho đơn ĐÃ GỬI / TẤT CẢ (dữ liệu phình to theo thời gian).
 *
 * Dùng khi người dùng lọc trạng thái "Đã gửi hàng" (shipped) hoặc "Tất cả trạng thái" (all).
 * Cursor keyset: (sortValue, id) < (cursorSort, cursorId) — nhanh, không giảm tốc theo số trang.
 * Chỉ hỗ trợ các filter ĐƠN GIẢN xử lý được bằng SQL (payment/source/ctv/invoice/date).
 * Các filter phức tạp (search từ khóa, thiếu size, thẻ tên bé, có lưu ý) KHÔNG đi qua đây —
 * frontend sẽ fallback về tải đầy đủ, nên không có rủi ro sai lệch.
 *
 * @param {object} params
 * @param {string} params.statusFilter - 'shipped' | 'all'
 * @param {string} params.paymentFilter - 'all' | 'bank' | 'cod'
 * @param {string} params.customerSourceFilter - 'all' | zalo/facebook/tiktok/web
 * @param {string} params.ctvFilter - 'all' | 'has_ctv' | 'no_ctv'
 * @param {string} params.invoiceStatusFilter - 'all' | 'exported' | 'not_exported'
 * @param {string} params.dateField - 'created' | 'shipped' (cột dùng để lọc ngày + sort)
 * @param {number|null} params.dateStartMs - đầu khoảng (ms, VN) hoặc null
 * @param {number|null} params.dateEndMs - cuối khoảng (ms, VN) hoặc null
 * @param {'desc'|'asc'} params.sortDir - hướng sort theo dateField
 * @param {number|null} params.cursorSort - giá trị sort của phần tử cuối trang trước
 * @param {number|null} params.cursorId - id của phần tử cuối trang trước (tie-breaker)
 * @param {number} params.limit - số đơn/trang
 */
export async function getOrdersHistoryPage(params, env, corsHeaders) {
    const startTime = Date.now();
    try {
        const {
            statusFilter = 'all',
            paymentFilter = 'all',
            customerSourceFilter = 'all',
            ctvFilter = 'all',
            invoiceStatusFilter = 'all',
            dateField = 'created',
            dateStartMs = null,
            dateEndMs = null,
            createdFromMs = null,   // mốc HĐĐT: ngày đặt hoặc ngày gửi >= mốc — dùng cho trang HĐĐT
            sortDir = 'desc',
            cursorSort = null,
            cursorId = null,
            limit = 30
        } = params || {};

        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 200);
        const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
        // Cột sort/cursor: đơn đã gửi ưu tiên theo thời điểm gửi, còn lại theo thời điểm tạo.
        const sortCol = dateField === 'shipped'
            ? 'COALESCE(orders.shipped_at_unix, orders.created_at_unix)'
            : 'orders.created_at_unix';

        const where = [];
        const binds = [];

        // --- Trạng thái ---
        if (statusFilter === 'shipped') {
            where.push(`LOWER(TRIM(orders.status)) = 'shipped'`);
        }
        // 'all' → không thêm điều kiện status

        // --- Phương thức thanh toán (DB lưu 'bank_transfer'/'bank' hoặc 'cod'/khác) ---
        if (paymentFilter === 'bank') {
            where.push(`LOWER(TRIM(COALESCE(orders.payment_method,''))) IN ('bank','bank_transfer','transfer','chuyen_khoan','ck')`);
        } else if (paymentFilter === 'cod') {
            where.push(`LOWER(TRIM(COALESCE(orders.payment_method,''))) NOT IN ('bank','bank_transfer','transfer','chuyen_khoan','ck')`);
        }

        // --- Nguồn khách (đơn thiếu field coi là facebook — đồng bộ client) ---
        if (['zalo', 'facebook', 'tiktok', 'web'].includes(customerSourceFilter)) {
            if (customerSourceFilter === 'facebook') {
                where.push(`(LOWER(TRIM(COALESCE(orders.customer_source,''))) = 'facebook' OR COALESCE(orders.customer_source,'') = '')`);
            } else {
                where.push(`LOWER(TRIM(COALESCE(orders.customer_source,''))) = ?`);
                binds.push(customerSourceFilter);
            }
        }

        // --- CTV ---
        if (ctvFilter === 'has_ctv') {
            where.push(`(orders.referral_code IS NOT NULL AND TRIM(orders.referral_code) != '')`);
        } else if (ctvFilter === 'no_ctv') {
            where.push(`(orders.referral_code IS NULL OR TRIM(orders.referral_code) = '')`);
        }

        // --- Trạng thái HĐĐT (đã xuất = invoice_exported_at > 0 HOẶC manual_invoice_exported = 1) ---
        if (invoiceStatusFilter === 'exported') {
            where.push(`(COALESCE(orders.invoice_exported_at,0) > 0 OR COALESCE(orders.manual_invoice_exported,0) = 1)`);
        } else if (invoiceStatusFilter === 'not_exported') {
            where.push(`(COALESCE(orders.invoice_exported_at,0) = 0 AND COALESCE(orders.manual_invoice_exported,0) = 0)`);
        }

        // Mốc HĐĐT: đơn đặt từ mốc, hoặc gửi từ mốc (đơn đặt trước nhưng gửi sau vẫn xuất hóa đơn).
        if (createdFromMs != null && Number.isFinite(Number(createdFromMs))) {
            where.push(invoiceScopeClause());
            binds.push(Number(createdFromMs), Number(createdFromMs));
        }

        // --- Khoảng ngày (theo sortCol) ---
        if (dateStartMs != null && Number.isFinite(Number(dateStartMs))) {
            where.push(`${sortCol} >= ?`);
            binds.push(Number(dateStartMs));
        }
        if (dateEndMs != null && Number.isFinite(Number(dateEndMs))) {
            where.push(`${sortCol} <= ?`);
            binds.push(Number(dateEndMs));
        }

        // TÁCH điều kiện LỌC (dùng cho COUNT tổng) khỏi điều kiện CURSOR (chỉ cho query 1 trang).
        // COUNT phải đếm TOÀN BỘ đơn khớp bộ lọc, không phụ thuộc cursor của trang hiện tại.
        const filterWhere = where.slice();
        const filterBinds = binds.slice();

        // --- Cursor keyset: (sortCol, id) so với (cursorSort, cursorId) ---
        if (cursorSort != null && cursorId != null
            && Number.isFinite(Number(cursorSort)) && Number.isFinite(Number(cursorId))) {
            const cmp = dir === 'ASC' ? '>' : '<';
            // (sortCol > cursorSort) OR (sortCol = cursorSort AND id > cursorId)
            where.push(`(${sortCol} ${cmp} ? OR (${sortCol} = ? AND orders.id ${cmp} ?))`);
            binds.push(Number(cursorSort), Number(cursorSort), Number(cursorId));
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        // Lấy dư 1 dòng để biết còn trang sau không (hasMore) mà không cần COUNT.
        const fetchLimit = parsedLimit + 1;
        const sql = `${ORDER_FULL_SELECT}
            ${whereClause}
            ORDER BY ${sortCol} ${dir}, orders.id ${dir}
            LIMIT ?`;
        binds.push(fetchLimit);

        const { results } = await env.DB.prepare(sql).bind(...binds).all();

        // Tổng số đơn khớp bộ lọc — CHỈ tính ở trang đầu (không có cursor) để tránh COUNT mỗi lần chuyển trang.
        // Tổng không đổi trong cùng bộ lọc, nên frontend chỉ cần con số từ trang 1.
        let totalCount = null;
        if (cursorSort == null || cursorId == null) {
            const countWhere = filterWhere.length ? `WHERE ${filterWhere.join(' AND ')}` : '';
            const countRow = await env.DB.prepare(
                `SELECT COUNT(*) AS c FROM orders LEFT JOIN ctv ON orders.referral_code = ctv.referral_code ${countWhere}`
            ).bind(...filterBinds).first();
            totalCount = countRow ? Number(countRow.c) : 0;
        }

        const hasMore = results.length > parsedLimit;
        const orders = hasMore ? results.slice(0, parsedLimit) : results;

        // Cursor cho trang kế tiếp = giá trị sort + id của phần tử CUỐI trang này.
        let nextCursor = null;
        if (hasMore && orders.length > 0) {
            const last = orders[orders.length - 1];
            const lastSort = dateField === 'shipped'
                ? (last.shipped_at_unix ?? last.created_at_unix)
                : last.created_at_unix;
            nextCursor = { sort: Number(lastSort), id: Number(last.id) };
        }

        const queryTime = Date.now() - startTime;
        console.log(`✅ [getOrdersHistoryPage] status=${statusFilter} trả ${orders.length} đơn, hasMore=${hasMore} (${queryTime}ms)`);

        return jsonResponse({
            success: true,
            orders,
            returned: orders.length,
            hasMore,
            nextCursor,
            totalCount,   // tổng đơn khớp bộ lọc (chỉ có ở trang đầu; null ở các trang sau)
            queryTime
        }, 200, corsHeaders);
    } catch (error) {
        console.error('❌ [getOrdersHistoryPage] Lỗi:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/**
 * Tìm kiếm đơn hàng trên TOÀN BỘ database (không giới hạn bởi LIMIT 1000 của getRecentOrders).
 * Dùng cho ô tìm kiếm trang admin khi cần tìm đơn cũ hơn số đơn đã tải về client.
 *
 * Query theo order_id, customer_name, customer_phone, address, notes (LOWER + LIKE '%term%').
 * Cùng SELECT shape với getRecentOrders (đầy đủ) để frontend gắn thẳng vào allOrdersData/render table
 * mà không cần xử lý riêng.
 *
 * @param {string} query - Từ khóa tìm kiếm (>= 2 ký tự)
 * @param {number} limit - Số kết quả tối đa (default 100, max 500)
 * @param {number} offset - Vị trí bắt đầu (phân trang, default 0)
 * @param {object} env - Worker environment (env.DB)
 * @param {object} corsHeaders
 */
export async function searchOrders(query, limit, offset, env, corsHeaders) {
    const startTime = Date.now();
    try {
        const searchTerm = String(query || '').trim();
        console.log(`🔍 [searchOrders] Bắt đầu tìm kiếm — term="${searchTerm}", limit=${limit}, offset=${offset}`);

        if (searchTerm.length < 2) {
            console.log('⚠️ [searchOrders] Từ khóa quá ngắn (< 2 ký tự) — trả lỗi validate');
            return jsonResponse({
                success: false,
                error: 'Từ khóa tìm kiếm cần ít nhất 2 ký tự',
                code: 'INVALID_SEARCH_TERM'
            }, 400, corsHeaders);
        }

        if (searchTerm.length > 100) {
            console.log('⚠️ [searchOrders] Từ khóa quá dài (> 100 ký tự) — trả lỗi validate');
            return jsonResponse({
                success: false,
                error: 'Từ khóa tìm kiếm quá dài (tối đa 100 ký tự)',
                code: 'INVALID_SEARCH_TERM'
            }, 400, corsHeaders);
        }

        // Chuẩn hoá limit/offset — tránh query bất thường (âm, quá lớn, NaN)
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

        // Pattern LIKE dùng chung cho mọi cột — search không phân biệt hoa/thường (LOWER ở cả 2 phía).
        const pattern = `%${searchTerm.toLowerCase()}%`;

        // Cùng cấu trúc SELECT với getRecentOrders (đầy đủ) — giữ nhất quán field cho frontend.
        const sql = `
            SELECT
                orders.*,
                ctv.commission_rate as ctv_commission_rate,
                COALESCE(
                    (SELECT SUM(oi.product_cost * oi.quantity)
                     FROM order_items oi
                     WHERE oi.order_id = orders.id),
                    0
                ) as product_cost,
                (CASE WHEN COALESCE(orders.manual_invoice_exported, 0) = 1 THEN 1 ELSE 0 END)
                + (SELECT COUNT(DISTINCT eh.id)
                   FROM export_history eh
                   WHERE eh.type='invoice'
                     AND eh.status='downloaded'
                     AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
                  ) AS invoice_exported_count,
                (SELECT MAX(eh.downloaded_at)
                 FROM export_history eh
                 WHERE eh.type='invoice'
                   AND eh.status='downloaded'
                   AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
                ) AS last_invoice_downloaded_at,
                (SELECT eh2.id FROM export_history eh2
                    WHERE eh2.type='invoice' AND eh2.status='downloaded'
                      AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
                    ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_id,
                (SELECT eh2.file_name FROM export_history eh2
                    WHERE eh2.type='invoice' AND eh2.status='downloaded'
                      AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
                    ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_file_name,
                COALESCE(orders.invoice_exported_at, 0) AS invoice_exported_at
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            WHERE
                LOWER(orders.order_id) LIKE ?
                OR LOWER(orders.customer_phone) LIKE ?
                OR LOWER(orders.customer_name) LIKE ?
                OR LOWER(orders.address) LIKE ?
                OR LOWER(orders.notes) LIKE ?
            ORDER BY orders.created_at_unix DESC
            LIMIT ? OFFSET ?
        `;

        const { results: orders } = await env.DB.prepare(sql)
            .bind(pattern, pattern, pattern, pattern, pattern, parsedLimit, parsedOffset)
            .all();

        const queryTime = Date.now() - startTime;
        console.log(`✅ [searchOrders] Xong — term="${searchTerm}", tìm được ${orders.length} đơn, thời gian ${queryTime}ms`);
        if (queryTime > 500) {
            console.warn(`🐢 [searchOrders] SLOW QUERY: ${queryTime}ms cho term="${searchTerm}" — xem xét index/FTS`);
        }

        return jsonResponse({
            success: true,
            orders: orders,
            total: orders.length,
            returned: orders.length,
            hasMore: orders.length === parsedLimit,
            searchTerm: searchTerm,
            searchMode: 'server',
            queryTime: queryTime
        }, 200, corsHeaders);

    } catch (error) {
        console.error('❌ [searchOrders] Lỗi khi tìm kiếm đơn hàng:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Không thể tìm kiếm đơn hàng',
            code: 'DATABASE_ERROR'
        }, 500, corsHeaders);
    }
}

/**
 * Lấy 1 đơn hàng theo db id với FULL shape (đầy đủ mọi cột + ctv_commission_rate + product_cost),
 * dùng cho mobile khi mở SỬA đơn (vì danh sách lite đã bỏ bớt cột địa chỉ tách phần/đóng gói/thuế...).
 * Cùng shape với getRecentOrders (đầy đủ) để gắn thẳng vào allOrders.
 */
export async function getOrderById(id, env, corsHeaders) {
    try {
        const orderId = parseInt(id);
        if (!orderId) {
            return jsonResponse({ success: false, error: 'Thiếu id đơn hàng' }, 400, corsHeaders);
        }
        const order = await env.DB.prepare(`
            SELECT
                orders.*,
                ctv.commission_rate AS ctv_commission_rate,
                COALESCE(
                    (SELECT SUM(product_cost * quantity)
                     FROM order_items
                     WHERE order_items.order_id = orders.id),
                    0
                ) AS product_cost
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            WHERE orders.id = ?
        `).bind(orderId).first();

        if (!order) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }
        return jsonResponse({ success: true, order }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting order by id:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
