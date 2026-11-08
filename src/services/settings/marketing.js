import { jsonResponse } from '../../utils/response.js';

const TRACKING_META_KEY = 'marketing_tracking_v1';

/** ID Google Ads đang hardcode trên shop — giữ làm mặc định khi chưa cấu hình. */
const LEGACY_GOOGLE_ADS_ID = 'AW-18459160193';

const DEFAULT_TRACKING = {
    gtm_id: '',
    meta_pixel_id: '',
    google_ads_id: LEGACY_GOOGLE_ADS_ID,
    gtm_enabled: true,
    meta_enabled: true,
    google_ads_enabled: true
};

async function ensureSystemMeta(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS system_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();
}

async function ensureLandingPagesTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS marketing_landing_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            headline TEXT,
            subheadline TEXT,
            cta_text TEXT,
            cta_url TEXT,
            hero_image_url TEXT,
            notes TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_marketing_landing_slug
        ON marketing_landing_pages(slug)
    `).run();
}

function normalizeId(value, pattern) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (pattern && !pattern.test(raw)) return null;
    return raw;
}

function sanitizeTrackingInput(data = {}) {
    const gtm = normalizeId(data.gtm_id, /^GTM-[A-Z0-9]+$/i);
    const meta = normalizeId(data.meta_pixel_id, /^\d{5,20}$/);
    const ads = normalizeId(data.google_ads_id, /^AW-\d+$/i);

    if (gtm === null) return { error: 'GTM ID không hợp lệ (ví dụ: GTM-XXXXXX)' };
    if (meta === null) return { error: 'Meta Pixel ID không hợp lệ (chỉ gồm số)' };
    if (ads === null) return { error: 'Google Ads ID không hợp lệ (ví dụ: AW-123456789)' };

    return {
        tracking: {
            gtm_id: gtm,
            meta_pixel_id: meta,
            google_ads_id: ads,
            gtm_enabled: data.gtm_enabled !== false && data.gtm_enabled !== 0 && data.gtm_enabled !== '0',
            meta_enabled: data.meta_enabled !== false && data.meta_enabled !== 0 && data.meta_enabled !== '0',
            google_ads_enabled: data.google_ads_enabled !== false && data.google_ads_enabled !== 0 && data.google_ads_enabled !== '0'
        }
    };
}

export async function getTrackingConfig(env) {
    await ensureSystemMeta(env);
    const row = await env.DB.prepare(
        `SELECT value FROM system_meta WHERE key = ?`
    ).bind(TRACKING_META_KEY).first();

    if (!row?.value) {
        return { ...DEFAULT_TRACKING };
    }

    try {
        const parsed = JSON.parse(row.value);
        return {
            ...DEFAULT_TRACKING,
            ...parsed,
            gtm_id: String(parsed.gtm_id || ''),
            meta_pixel_id: String(parsed.meta_pixel_id || ''),
            google_ads_id: String(parsed.google_ads_id || LEGACY_GOOGLE_ADS_ID)
        };
    } catch {
        return { ...DEFAULT_TRACKING };
    }
}

/** Public payload — chỉ ID đang bật, đủ để inject. */
export function toPublicTracking(tracking) {
    const t = tracking || DEFAULT_TRACKING;
    return {
        gtm_id: t.gtm_enabled && t.gtm_id ? t.gtm_id : '',
        meta_pixel_id: t.meta_enabled && t.meta_pixel_id ? t.meta_pixel_id : '',
        google_ads_id: t.google_ads_enabled && t.google_ads_id ? t.google_ads_id : ''
    };
}

export async function getMarketingTracking(env, corsHeaders) {
    try {
        const tracking = await getTrackingConfig(env);
        return jsonResponse({ success: true, tracking }, 200, corsHeaders);
    } catch (error) {
        console.error('getMarketingTracking:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/** Không auth — dùng cho loader trên trang khách. */
export async function getPublicMarketingTracking(env, corsHeaders) {
    try {
        const tracking = await getTrackingConfig(env);
        return jsonResponse({
            success: true,
            tracking: toPublicTracking(tracking)
        }, 200, corsHeaders);
    } catch (error) {
        console.error('getPublicMarketingTracking:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function updateMarketingTracking(data, env, corsHeaders) {
    try {
        const result = sanitizeTrackingInput(data);
        if (result.error) {
            return jsonResponse({ success: false, error: result.error }, 400, corsHeaders);
        }

        await ensureSystemMeta(env);
        await env.DB.prepare(`
            INSERT INTO system_meta (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).bind(TRACKING_META_KEY, JSON.stringify(result.tracking)).run();

        return jsonResponse({
            success: true,
            message: 'Đã lưu mã theo dõi',
            tracking: result.tracking
        }, 200, corsHeaders);
    } catch (error) {
        console.error('updateMarketingTracking:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

function slugifyLanding(input) {
    return String(input || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

function mapLandingRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        headline: row.headline || '',
        subheadline: row.subheadline || '',
        cta_text: row.cta_text || '',
        cta_url: row.cta_url || '',
        hero_image_url: row.hero_image_url || '',
        notes: row.notes || '',
        is_active: Number(row.is_active) !== 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        public_path: `/p/?page=${encodeURIComponent(row.slug)}`
    };
}

export async function listLandingPages(env, corsHeaders) {
    try {
        await ensureLandingPagesTable(env);
        const { results } = await env.DB.prepare(`
            SELECT * FROM marketing_landing_pages
            ORDER BY updated_at DESC, id DESC
        `).all();
        return jsonResponse({
            success: true,
            pages: (results || []).map(mapLandingRow)
        }, 200, corsHeaders);
    } catch (error) {
        console.error('listLandingPages:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function getPublicLandingPage(slug, env, corsHeaders) {
    try {
        await ensureLandingPagesTable(env);
        const clean = slugifyLanding(slug);
        if (!clean) {
            return jsonResponse({ success: false, error: 'Slug không hợp lệ' }, 400, corsHeaders);
        }

        const row = await env.DB.prepare(`
            SELECT * FROM marketing_landing_pages
            WHERE slug = ? AND is_active = 1
            LIMIT 1
        `).bind(clean).first();

        if (!row) {
            return jsonResponse({ success: false, error: 'Trang không tồn tại hoặc đã tắt' }, 404, corsHeaders);
        }

        return jsonResponse({
            success: true,
            page: mapLandingRow(row)
        }, 200, corsHeaders);
    } catch (error) {
        console.error('getPublicLandingPage:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function saveLandingPage(data, env, corsHeaders) {
    try {
        await ensureLandingPagesTable(env);

        const id = data.id != null ? parseInt(data.id, 10) : null;
        const name = String(data.name || '').trim();
        let slug = slugifyLanding(data.slug || name);

        if (!name) {
            return jsonResponse({ success: false, error: 'Vui lòng nhập tên trang' }, 400, corsHeaders);
        }
        if (!slug) {
            return jsonResponse({ success: false, error: 'Slug không hợp lệ' }, 400, corsHeaders);
        }

        const headline = String(data.headline || '').trim();
        const subheadline = String(data.subheadline || '').trim();
        const cta_text = String(data.cta_text || 'Mua ngay').trim() || 'Mua ngay';
        const cta_url = String(data.cta_url || '/#products').trim() || '/#products';
        const hero_image_url = String(data.hero_image_url || '').trim();
        const notes = String(data.notes || '').trim();
        const is_active = data.is_active === false || data.is_active === 0 || data.is_active === '0' ? 0 : 1;

        const dup = await env.DB.prepare(`
            SELECT id FROM marketing_landing_pages
            WHERE slug = ? AND (? IS NULL OR id != ?)
            LIMIT 1
        `).bind(slug, id, id).first();

        if (dup) {
            return jsonResponse({ success: false, error: `Slug "${slug}" đã được dùng` }, 400, corsHeaders);
        }

        if (id && !Number.isNaN(id)) {
            await env.DB.prepare(`
                UPDATE marketing_landing_pages SET
                    slug = ?, name = ?, headline = ?, subheadline = ?,
                    cta_text = ?, cta_url = ?, hero_image_url = ?, notes = ?,
                    is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(
                slug, name, headline, subheadline,
                cta_text, cta_url, hero_image_url, notes,
                is_active, id
            ).run();

            const row = await env.DB.prepare(
                `SELECT * FROM marketing_landing_pages WHERE id = ?`
            ).bind(id).first();

            return jsonResponse({
                success: true,
                message: 'Đã cập nhật trang bán',
                page: mapLandingRow(row)
            }, 200, corsHeaders);
        }

        const result = await env.DB.prepare(`
            INSERT INTO marketing_landing_pages (
                slug, name, headline, subheadline, cta_text, cta_url,
                hero_image_url, notes, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            slug, name, headline, subheadline, cta_text, cta_url,
            hero_image_url, notes, is_active
        ).run();

        const newId = result.meta?.last_row_id;
        const row = await env.DB.prepare(
            `SELECT * FROM marketing_landing_pages WHERE id = ?`
        ).bind(newId).first();

        return jsonResponse({
            success: true,
            message: 'Đã tạo trang bán',
            page: mapLandingRow(row)
        }, 200, corsHeaders);
    } catch (error) {
        console.error('saveLandingPage:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

export async function deleteLandingPage(data, env, corsHeaders) {
    try {
        await ensureLandingPagesTable(env);
        const id = parseInt(data.id, 10);
        if (!id || Number.isNaN(id)) {
            return jsonResponse({ success: false, error: 'ID không hợp lệ' }, 400, corsHeaders);
        }

        await env.DB.prepare(
            `DELETE FROM marketing_landing_pages WHERE id = ?`
        ).bind(id).run();

        return jsonResponse({ success: true, message: 'Đã xóa trang bán' }, 200, corsHeaders);
    } catch (error) {
        console.error('deleteLandingPage:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
