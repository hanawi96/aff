import { jsonResponse } from '../../utils/response.js';
import { normalizeOrderPhone } from '../../utils/order-duplicate-check.js';

const OPEN_STATUS = 'open';
const RESOLVED_STATUS = 'resolved';
const DISMISSED_STATUS = 'dismissed';
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Sau khi gửi hàng: không báo lại trong cửa sổ này trừ khi có tin chốt đơn mới sau shipped_at */
export const POST_SHIP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Nguồn tự động — tôn trọng dismiss (×), không ép tạo lại */
const AUTO_SOURCES = new Set(['auto-detect', 'extension', 'pancake-api']);

function isValidPendingPhone(phone) {
    const normalized = normalizeOrderPhone(phone);
    return /^0\d{8,10}$/.test(normalized);
}

/**
 * Quy tắc "đã lưu" theo SĐT:
 * 1) Còn đơn Chưa gửi hàng → đã lưu
 * 2) Vừa gửi hàng (trong POST_SHIP_GRACE_MS) và chưa có tin chốt sau shipped_at → đã lưu
 * 3) Có tin chốt đơn (intentAt) sau lần gửi hàng gần nhất → chưa lưu (đơn mới)
 *
 * @param {object|null} unshippedOrder
 * @param {object|null} lastShippedOrder — đơn có shipped_at gần nhất
 * @param {number|null} intentAtMs — thời điểm tin chốt (Pancake updated_at / lúc detect)
 * @param {number} [nowMs]
 * @returns {{ saved: boolean, reason: string, matchedOrder: object|null }}
 */
export function evaluatePhoneSavedState(unshippedOrder, lastShippedOrder, intentAtMs = null, nowMs = Date.now()) {
    if (unshippedOrder) {
        return { saved: true, reason: 'unshipped', matchedOrder: unshippedOrder };
    }

    const shippedAt = Number(lastShippedOrder?.shipped_at_unix || 0);
    if (!lastShippedOrder || !Number.isFinite(shippedAt) || shippedAt <= 0) {
        return { saved: false, reason: 'no_order', matchedOrder: null };
    }

    const intent = intentAtMs == null ? null : Number(intentAtMs);
    const intentAfterShip = intent != null && Number.isFinite(intent) && intent > shippedAt;

    // Tin chốt đơn mới sau khi đã gửi hàng → coi là đơn mới, báo chưa lưu
    if (intentAfterShip) {
        return { saved: false, reason: 'intent_after_ship', matchedOrder: lastShippedOrder };
    }

    // Trong cửa sổ sau gửi hàng, tin cũ / không chứng minh được tin mới → không báo lại
    if ((nowMs - shippedAt) < POST_SHIP_GRACE_MS) {
        return { saved: true, reason: 'recent_ship', matchedOrder: lastShippedOrder };
    }

    // Ngoài grace: tin rõ ràng cũ hơn lần gửi → không báo; không có mốc intent → cho phép báo
    if (intent != null && Number.isFinite(intent) && intent <= shippedAt) {
        return { saved: true, reason: 'stale_intent', matchedOrder: lastShippedOrder };
    }

    return { saved: false, reason: 'outside_grace', matchedOrder: lastShippedOrder };
}

/**
 * Lấy trạng thái đơn theo SĐT (1–2 query).
 */
export async function loadPhoneOrderState(env, phone) {
    const normalized = normalizeOrderPhone(phone);
    if (!isValidPendingPhone(normalized)) {
        return { unshippedOrder: null, lastShippedOrder: null };
    }

    const unshippedOrder = await env.DB.prepare(`
        SELECT id, order_id, created_at_unix, shipped_at_unix, customer_phone, status
        FROM orders
        WHERE customer_phone = ?
          AND LOWER(TRIM(status)) IN ('pending', 'processing', 'send_later', 'awaiting_reship')
        ORDER BY created_at_unix DESC
        LIMIT 1
    `).bind(normalized).first();

    const lastShippedOrder = await env.DB.prepare(`
        SELECT id, order_id, created_at_unix, shipped_at_unix, customer_phone, status
        FROM orders
        WHERE customer_phone = ?
          AND shipped_at_unix IS NOT NULL
          AND shipped_at_unix > 0
        ORDER BY shipped_at_unix DESC
        LIMIT 1
    `).bind(normalized).first();

    return { unshippedOrder: unshippedOrder || null, lastShippedOrder: lastShippedOrder || null };
}

function hasEnoughAddress(data = {}, source = '') {
    // Sync từ Pancake API: chỉ cần SĐT (list đã có recent_phone_numbers)
    if (source === 'pancake-api') return true;
    if (data.province_id && data.ward_id) return true;
    const address = String(data.address || '').trim();
    if (address.length >= 10) return true;
    const street = String(data.street_address || data.street || '').trim();
    return street.length >= 8 && Boolean(data.province_id);
}

function rowToPending(row) {
    if (!row) return null;
    return {
        id: row.id,
        phone: row.customer_phone,
        name: row.customer_name || '',
        conversationKey: row.conversation_key || '',
        address: row.address || '',
        provinceId: row.province_id || '',
        provinceName: row.province_name || '',
        wardId: row.ward_id || '',
        wardName: row.ward_name || '',
        street: row.street_address || '',
        source: row.source || 'extension',
        status: row.status,
        resolvedOrderDbId: row.resolved_order_db_id || null,
        resolvedOrderCode: row.resolved_order_code || null,
        createdAt: row.created_at_unix,
        updatedAt: row.updated_at_unix,
        resolvedAt: row.resolved_at_unix || null,
    };
}

export async function ensurePendingTable(env) {
    try {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS pending_unsaved_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_phone TEXT NOT NULL,
                customer_name TEXT,
                conversation_key TEXT,
                address TEXT,
                province_id TEXT,
                province_name TEXT,
                ward_id TEXT,
                ward_name TEXT,
                street_address TEXT,
                source TEXT DEFAULT 'extension',
                status TEXT NOT NULL DEFAULT 'open',
                resolved_order_db_id INTEGER,
                resolved_order_code TEXT,
                created_at_unix INTEGER NOT NULL,
                updated_at_unix INTEGER NOT NULL,
                resolved_at_unix INTEGER
            )
        `).run();
    } catch (_) {
        // already exists
    }
}

/**
 * Resolve open pending rows for a phone when a real order is created (any channel).
 */
export async function resolvePendingUnsavedByPhone(env, phone, orderMeta = {}) {
    try {
        await ensurePendingTable(env);
        const normalized = normalizeOrderPhone(phone);
        if (!isValidPendingPhone(normalized)) return { resolved: 0 };

        const now = Date.now();
        const orderDbId = orderMeta.orderDbId ?? null;
        const orderCode = orderMeta.orderCode ?? null;

        const result = await env.DB.prepare(`
            UPDATE pending_unsaved_orders
            SET status = ?,
                resolved_order_db_id = ?,
                resolved_order_code = ?,
                resolved_at_unix = ?,
                updated_at_unix = ?
            WHERE status = ?
              AND customer_phone = ?
        `).bind(
            RESOLVED_STATUS,
            orderDbId,
            orderCode,
            now,
            now,
            OPEN_STATUS,
            normalized
        ).run();

        return { resolved: result?.meta?.changes || 0 };
    } catch (error) {
        console.warn('[pending-unsaved] resolve failed:', error?.message || error);
        return { resolved: 0, error: error?.message };
    }
}

/**
 * Core upsert — dùng chung HTTP + Pancake sync.
 * @returns {{ ok, alreadyOrdered?, dismissed?, pending?, error?, matchedOrder? }}
 */
export async function upsertPendingUnsavedCore(env, data = {}) {
    await ensurePendingTable(env);

    const phone = normalizeOrderPhone(data.phone || data.customer_phone);
    if (!isValidPendingPhone(phone)) {
        return { ok: false, error: 'SĐT không hợp lệ' };
    }

    const source = String(data.source || 'extension');
    const payload = {
        name: String(data.name || data.customer_name || '').trim(),
        conversation_key: String(data.conversationKey || data.conversation_key || '').trim(),
        address: String(data.address || '').trim(),
        province_id: data.provinceId || data.province_id || null,
        province_name: data.provinceName || data.province_name || null,
        ward_id: data.wardId || data.ward_id || null,
        ward_name: data.wardName || data.ward_name || null,
        street_address: data.street || data.street_address || null,
        source,
    };

    if (!hasEnoughAddress(payload, source)) {
        return { ok: false, error: 'Thiếu địa chỉ (cần tỉnh/phường hoặc địa chỉ đủ)' };
    }

    const now = Date.now();
    // Thời điểm tin chốt (Pancake updated_at). Không có → null: chỉ neo unshipped + grace sau ship.
    const rawIntent = data.intentAt ?? data.intent_at ?? data.conversationUpdatedAt ?? null;
    let intentAtMs = null;
    if (rawIntent != null && rawIntent !== '') {
        const n = Number(rawIntent);
        if (Number.isFinite(n) && n > 0) {
            intentAtMs = n < 1e12 ? n * 1000 : n;
        }
    }

    const { unshippedOrder, lastShippedOrder } = await loadPhoneOrderState(env, phone);
    const savedState = evaluatePhoneSavedState(unshippedOrder, lastShippedOrder, intentAtMs, now);

    const latestAny = await env.DB.prepare(`
        SELECT * FROM pending_unsaved_orders
        WHERE customer_phone = ?
        ORDER BY id DESC
        LIMIT 1
    `).bind(phone).first();

    const existingOpen = await env.DB.prepare(`
        SELECT * FROM pending_unsaved_orders
        WHERE customer_phone = ? AND status = ?
        ORDER BY id DESC
        LIMIT 1
    `).bind(phone, OPEN_STATUS).first();

    if (savedState.saved) {
        const matchedOrder = savedState.matchedOrder;
        if (existingOpen && matchedOrder) {
            await env.DB.prepare(`
                UPDATE pending_unsaved_orders
                SET status = ?,
                    resolved_order_db_id = ?,
                    resolved_order_code = ?,
                    resolved_at_unix = ?,
                    updated_at_unix = ?
                WHERE customer_phone = ? AND status = ?
            `).bind(
                RESOLVED_STATUS,
                matchedOrder.id,
                matchedOrder.order_id,
                now,
                now,
                phone,
                OPEN_STATUS
            ).run();
        }

        return {
            ok: true,
            alreadyOrdered: true,
            pending: null,
            reason: savedState.reason,
            matchedOrder: matchedOrder ? {
                id: matchedOrder.id,
                orderId: matchedOrder.order_id,
                createdAt: matchedOrder.created_at_unix,
                shippedAt: matchedOrder.shipped_at_unix || null,
                status: matchedOrder.status,
            } : null,
        };
    }

    // User đã bấm × gần đây → nguồn tự động không tạo lại
    if (
        !existingOpen
        && latestAny
        && latestAny.status === DISMISSED_STATUS
        && (now - Number(latestAny.updated_at_unix || 0)) < DISMISS_COOLDOWN_MS
        && AUTO_SOURCES.has(source)
    ) {
        return { ok: true, dismissed: true, pending: null };
    }

    const applyFields = async (id) => {
        await env.DB.prepare(`
            UPDATE pending_unsaved_orders
            SET customer_name = COALESCE(?, customer_name),
                conversation_key = COALESCE(?, conversation_key),
                address = COALESCE(?, address),
                province_id = COALESCE(?, province_id),
                province_name = COALESCE(?, province_name),
                ward_id = COALESCE(?, ward_id),
                ward_name = COALESCE(?, ward_name),
                street_address = COALESCE(?, street_address),
                source = ?,
                status = ?,
                resolved_order_db_id = NULL,
                resolved_order_code = NULL,
                resolved_at_unix = NULL,
                updated_at_unix = ?
            WHERE id = ?
        `).bind(
            payload.name || null,
            payload.conversation_key || null,
            payload.address || null,
            payload.province_id,
            payload.province_name,
            payload.ward_id,
            payload.ward_name,
            payload.street_address,
            payload.source,
            OPEN_STATUS,
            now,
            id
        ).run();

        await env.DB.prepare(`
            UPDATE pending_unsaved_orders
            SET status = ?, updated_at_unix = ?, resolved_at_unix = ?
            WHERE customer_phone = ? AND status = ? AND id != ?
        `).bind(DISMISSED_STATUS, now, now, phone, OPEN_STATUS, id).run();

        return env.DB.prepare(`SELECT * FROM pending_unsaved_orders WHERE id = ?`).bind(id).first();
    };

    if (existingOpen) {
        const updated = await applyFields(existingOpen.id);
        return { ok: true, pending: rowToPending(updated) };
    }

    if (latestAny) {
        const updated = await applyFields(latestAny.id);
        return { ok: true, pending: rowToPending(updated), reused: true };
    }

    try {
        const insert = await env.DB.prepare(`
            INSERT INTO pending_unsaved_orders (
                customer_phone, customer_name, conversation_key, address,
                province_id, province_name, ward_id, ward_name, street_address,
                source, status, created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            phone,
            payload.name || null,
            payload.conversation_key || null,
            payload.address || null,
            payload.province_id,
            payload.province_name,
            payload.ward_id,
            payload.ward_name,
            payload.street_address,
            payload.source,
            OPEN_STATUS,
            now,
            now
        ).run();

        const created = await env.DB.prepare(`SELECT * FROM pending_unsaved_orders WHERE id = ?`)
            .bind(insert.meta.last_row_id).first();

        return { ok: true, pending: rowToPending(created) };
    } catch (insertErr) {
        const raced = await env.DB.prepare(`
            SELECT * FROM pending_unsaved_orders
            WHERE customer_phone = ? AND status = ?
            ORDER BY id DESC LIMIT 1
        `).bind(phone, OPEN_STATUS).first();
        if (raced) {
            const updated = await applyFields(raced.id);
            return { ok: true, pending: rowToPending(updated) };
        }
        throw insertErr;
    }
}

export async function upsertPendingUnsaved(data, env, corsHeaders) {
    try {
        const result = await upsertPendingUnsavedCore(env, data);
        if (!result.ok) {
            return jsonResponse({ success: false, error: result.error }, 400, corsHeaders);
        }
        return jsonResponse({
            success: true,
            alreadyOrdered: result.alreadyOrdered || false,
            dismissed: result.dismissed || false,
            pending: result.pending || null,
            matchedOrder: result.matchedOrder || null,
            reused: result.reused || false,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('[pending-unsaved] upsert error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function listPendingUnsaved(env, corsHeaders) {
    try {
        await ensurePendingTable(env);
        const now = Date.now();
        const cutoff = now - PENDING_TTL_MS;

        await env.DB.prepare(`
            UPDATE pending_unsaved_orders
            SET status = ?, updated_at_unix = ?, resolved_at_unix = ?
            WHERE status = ? AND updated_at_unix < ?
        `).bind(DISMISSED_STATUS, now, now, OPEN_STATUS, cutoff).run();

        const rows = await env.DB.prepare(`
            SELECT * FROM pending_unsaved_orders
            WHERE status = ?
            ORDER BY updated_at_unix DESC
            LIMIT 100
        `).bind(OPEN_STATUS).all();

        const items = (rows?.results || []).map(rowToPending);
        return jsonResponse({
            success: true,
            count: items.length,
            items,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('[pending-unsaved] list error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function dismissPendingUnsaved(data, env, corsHeaders) {
    try {
        await ensurePendingTable(env);
        const now = Date.now();
        const id = data.id != null ? Number(data.id) : null;
        const phone = normalizeOrderPhone(data.phone || data.customer_phone || '');

        let result;
        if (id && Number.isFinite(id)) {
            result = await env.DB.prepare(`
                UPDATE pending_unsaved_orders
                SET status = ?, updated_at_unix = ?, resolved_at_unix = ?
                WHERE id = ? AND status = ?
            `).bind(DISMISSED_STATUS, now, now, id, OPEN_STATUS).run();
        } else if (isValidPendingPhone(phone)) {
            result = await env.DB.prepare(`
                UPDATE pending_unsaved_orders
                SET status = ?, updated_at_unix = ?, resolved_at_unix = ?
                WHERE customer_phone = ? AND status = ?
            `).bind(DISMISSED_STATUS, now, now, phone, OPEN_STATUS).run();
        } else {
            return jsonResponse({ success: false, error: 'Thiếu id hoặc SĐT' }, 400, corsHeaders);
        }

        return jsonResponse({
            success: true,
            dismissed: result?.meta?.changes || 0,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('[pending-unsaved] dismiss error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
