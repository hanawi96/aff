/**
 * Sync map: conversation_id → customer phone
 * - Pancake: pageId_threadId (vd. 8216…_1590…)
 * - Zalo: zalo:{anim-data-id} (vd. zalo:3732123456789012)
 * Dùng cho extension: nhớ SĐT theo chat, đồng bộ nhiều máy.
 */
import { jsonResponse } from '../../utils/response.js';
import { normalizeOrderPhone } from '../../utils/order-duplicate-check.js';

const PANCAKE_CONV_ID_RE = /^\d+_\d+$/;
const ZALO_CONV_ID_RE = /^zalo:\d{6,}$/;
const PHONE_RE = /^0\d{8,10}$/;
const BATCH_MAX = 50;
const LIST_DEFAULT_LIMIT = 500;
const LIST_MAX_LIMIT = 1000;

/** Tránh CREATE TABLE/INDEX lặp lại mỗi item → treo Turso / vượt subrequest. */
let ensureTablePromise = null;

function normalizeConversationId(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    // Zalo: giữ nguyên zalo:{id}
    if (ZALO_CONV_ID_RE.test(s)) return s;
    // Pancake: bỏ suffix __0/__1 trên list item id
    s = s.replace(/__\d+$/, '');
    return s;
}

function isValidConversationId(id) {
    const normalized = normalizeConversationId(id);
    return PANCAKE_CONV_ID_RE.test(normalized) || ZALO_CONV_ID_RE.test(normalized);
}

function isValidPhone(phone) {
    return PHONE_RE.test(normalizeOrderPhone(phone));
}

function extractPageId(conversationId) {
    const id = normalizeConversationId(conversationId);
    if (ZALO_CONV_ID_RE.test(id)) return null;
    const i = id.indexOf('_');
    return i > 0 ? id.slice(0, i) : null;
}

function rowToItem(row) {
    if (!row) return null;
    return {
        conversationId: row.conversation_id,
        phone: row.phone,
        source: row.source || 'extension',
        pageId: row.page_id || null,
        updatedAt: Number(row.updated_at_unix) || 0,
        createdAt: Number(row.created_at_unix) || 0,
    };
}

async function ensureConvPhoneTable(env) {
    if (ensureTablePromise) return ensureTablePromise;

    ensureTablePromise = (async () => {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS pancake_conversation_phones (
                conversation_id TEXT PRIMARY KEY NOT NULL,
                phone TEXT NOT NULL,
                source TEXT DEFAULT 'extension',
                page_id TEXT,
                created_at_unix INTEGER NOT NULL,
                updated_at_unix INTEGER NOT NULL
            )
        `).run();
        await env.DB.prepare(`
            CREATE INDEX IF NOT EXISTS idx_pancake_conv_phones_phone
            ON pancake_conversation_phones(phone)
        `).run();
        await env.DB.prepare(`
            CREATE INDEX IF NOT EXISTS idx_pancake_conv_phones_updated
            ON pancake_conversation_phones(updated_at_unix)
        `).run();
    })().catch((err) => {
        ensureTablePromise = null;
        throw err;
    });

    return ensureTablePromise;
}

function normalizeUpsertInput(data = {}) {
    const conversationId = normalizeConversationId(data.conversationId || data.conversation_id);
    const phone = normalizeOrderPhone(data.phone || data.customer_phone);
    if (!isValidConversationId(conversationId)) {
        return { ok: false, error: 'conversationId không hợp lệ' };
    }
    if (!isValidPhone(phone)) {
        return { ok: false, error: 'SĐT không hợp lệ' };
    }

    const source = String(data.source || 'extension').trim().slice(0, 40) || 'extension';
    const now = Date.now();
    let updatedAt = Number(data.updatedAt ?? data.updated_at_unix ?? now);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) updatedAt = now;
    if (updatedAt > now + 5 * 60 * 1000) updatedAt = now;

    return {
        ok: true,
        conversationId,
        phone,
        source,
        updatedAt,
        pageId: extractPageId(conversationId),
    };
}

/**
 * Upsert 1 mapping. newer updated_at thắng; cùng thời điểm thì ghi đè incoming.
 * @returns {{ ok: boolean, skipped?: boolean, item?: object, error?: string }}
 */
export async function upsertConvPhoneCore(env, data = {}) {
    await ensureConvPhoneTable(env);

    const parsed = normalizeUpsertInput(data);
    if (!parsed.ok) return parsed;

    const { conversationId, phone, source, updatedAt, pageId } = parsed;

    const existing = await env.DB.prepare(`
        SELECT conversation_id, phone, source, page_id, created_at_unix, updated_at_unix
        FROM pancake_conversation_phones
        WHERE conversation_id = ?
    `).bind(conversationId).first();

    if (existing) {
        const prevAt = Number(existing.updated_at_unix) || 0;
        if (updatedAt < prevAt) {
            return { ok: true, skipped: true, item: rowToItem(existing) };
        }
        if (updatedAt === prevAt && existing.phone === phone && (existing.source || '') === source) {
            return { ok: true, skipped: true, item: rowToItem(existing) };
        }

        await env.DB.prepare(`
            UPDATE pancake_conversation_phones
            SET phone = ?, source = ?, page_id = ?, updated_at_unix = ?
            WHERE conversation_id = ?
        `).bind(phone, source, pageId, updatedAt, conversationId).run();

        return {
            ok: true,
            item: {
                conversationId,
                phone,
                source,
                pageId,
                updatedAt,
                createdAt: Number(existing.created_at_unix) || updatedAt,
            },
        };
    }

    await env.DB.prepare(`
        INSERT INTO pancake_conversation_phones (
            conversation_id, phone, source, page_id, created_at_unix, updated_at_unix
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(conversationId, phone, source, pageId, updatedAt, updatedAt).run();

    return {
        ok: true,
        item: {
            conversationId,
            phone,
            source,
            pageId,
            updatedAt,
            createdAt: updatedAt,
        },
    };
}

export async function upsertConvPhone(data, env, corsHeaders) {
    try {
        const result = await upsertConvPhoneCore(env, data);
        if (!result.ok) {
            return jsonResponse({ success: false, error: result.error }, 400, corsHeaders);
        }
        return jsonResponse({
            success: true,
            skipped: Boolean(result.skipped),
            item: result.item,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('[conv-phone] upsert error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/**
 * Batch upsert — 1 lần ensure table + 1 Turso batch (tránh N*DDL / treo Worker).
 */
export async function upsertConvPhoneBatch(data, env, corsHeaders) {
    try {
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        if (!items.length) {
            return jsonResponse({ success: false, error: 'Thiếu items' }, 400, corsHeaders);
        }
        if (items.length > BATCH_MAX) {
            return jsonResponse({
                success: false,
                error: `Tối đa ${BATCH_MAX} items / request`,
            }, 400, corsHeaders);
        }

        await ensureConvPhoneTable(env);

        let upserted = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];
        const statements = [];

        for (const row of items) {
            const parsed = normalizeUpsertInput(row);
            if (!parsed.ok) {
                failed += 1;
                if (errors.length < 5) errors.push(parsed.error);
                continue;
            }

            const { conversationId, phone, source, updatedAt, pageId } = parsed;
            // ON CONFLICT: chỉ ghi khi incoming mới hơn hoặc bằng
            statements.push({
                sql: `
                    INSERT INTO pancake_conversation_phones (
                        conversation_id, phone, source, page_id, created_at_unix, updated_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(conversation_id) DO UPDATE SET
                        phone = excluded.phone,
                        source = excluded.source,
                        page_id = excluded.page_id,
                        updated_at_unix = excluded.updated_at_unix
                    WHERE excluded.updated_at_unix >= pancake_conversation_phones.updated_at_unix
                `,
                params: [conversationId, phone, source, pageId, updatedAt, updatedAt],
            });
            upserted += 1;
        }

        if (statements.length) {
            if (typeof env.DB.batch === 'function') {
                await env.DB.batch(statements);
            } else {
                for (const stmt of statements) {
                    await env.DB.prepare(stmt.sql).bind(...stmt.params).run();
                }
            }
        }

        // skipped không đếm chính xác với UPSERT gộp — giữ field cho tương thích client
        skipped = Math.max(0, items.length - upserted - failed);

        return jsonResponse({
            success: true,
            upserted,
            skipped,
            failed,
            errors: errors.length ? errors : undefined,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('[conv-phone] batch error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/** Pull incremental: since = updated_at_unix exclusive lower bound */
export async function listConvPhones(env, corsHeaders, { since = 0, limit = LIST_DEFAULT_LIMIT } = {}) {
    try {
        await ensureConvPhoneTable(env);

        let sinceMs = Number(since) || 0;
        if (!Number.isFinite(sinceMs) || sinceMs < 0) sinceMs = 0;

        let lim = parseInt(String(limit), 10);
        if (!Number.isFinite(lim) || lim <= 0) lim = LIST_DEFAULT_LIMIT;
        lim = Math.min(lim, LIST_MAX_LIMIT);

        const { results } = await env.DB.prepare(`
            SELECT conversation_id, phone, source, page_id, created_at_unix, updated_at_unix
            FROM pancake_conversation_phones
            WHERE updated_at_unix > ?
            ORDER BY updated_at_unix ASC
            LIMIT ?
        `).bind(sinceMs, lim).all();

        const items = (results || []).map(rowToItem).filter(Boolean);
        const maxUpdated = items.reduce((m, it) => Math.max(m, it.updatedAt || 0), sinceMs);

        return jsonResponse({
            success: true,
            items,
            since: sinceMs,
            serverTime: Date.now(),
            nextSince: maxUpdated,
            hasMore: items.length >= lim,
        }, 200, corsHeaders);
    } catch (error) {
        console.error('[conv-phone] list error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function getPhoneByConversation(conversationId, env, corsHeaders) {
    try {
        await ensureConvPhoneTable(env);
        const id = normalizeConversationId(conversationId);
        if (!isValidConversationId(id)) {
            return jsonResponse({ success: false, error: 'conversationId không hợp lệ' }, 400, corsHeaders);
        }

        const row = await env.DB.prepare(`
            SELECT conversation_id, phone, source, page_id, created_at_unix, updated_at_unix
            FROM pancake_conversation_phones
            WHERE conversation_id = ?
        `).bind(id).first();

        if (!row) {
            return jsonResponse({ success: true, found: false, item: null }, 200, corsHeaders);
        }
        return jsonResponse({ success: true, found: true, item: rowToItem(row) }, 200, corsHeaders);
    } catch (error) {
        console.error('[conv-phone] get error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
