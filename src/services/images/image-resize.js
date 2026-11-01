// ============================================
// Image resize proxy — Cloudflare Image Resizing via Worker
// URL forms (không dùng /cdn-cgi/ — path đó Cloudflare giữ, Worker không nhận được trên workers.dev):
//   /cdn/image/width=640,quality=75,format=auto/https://pub-….r2.dev/...
//   /img?w=640&q=75&url=https://pub-….r2.dev/...
// Fallback: proxy original R2 when cf.image unavailable.
// ============================================

const R2_PUBLIC_HOST = 'pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev';
const MAX_WIDTH = 2400;
const MAX_QUALITY = 90;

const IMAGE_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cross-Origin-Resource-Policy': 'cross-origin',
};

function isAllowedSource(urlString) {
    try {
        const u = new URL(urlString);
        return u.protocol === 'https:' && u.hostname === R2_PUBLIC_HOST;
    } catch {
        return false;
    }
}

function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/**
 * Parse /cdn/image/width=W,quality=Q,format=F/<absolute-url>
 */
function parseCdnPath(pathname) {
    const prefix = '/cdn/image/';
    if (!pathname.startsWith(prefix)) return null;

    const rest = pathname.slice(prefix.length);
    // Hỗ trợ cả URL thô (.../https://...) và URL đã encode (.../https%3A%2F%2F...)
    let protoIdx = rest.search(/https?:\/\//i);
    if (protoIdx < 0) protoIdx = rest.search(/https?%3A%2F%2F/i);
    if (protoIdx <= 0) return null;

    const optionsPart = rest.slice(0, protoIdx).replace(/\/$/, '');
    let sourceUrl = rest.slice(protoIdx);
    try {
        sourceUrl = decodeURIComponent(sourceUrl);
    } catch {
        /* giữ nguyên nếu decode lỗi */
    }

    const opts = {};
    for (const token of optionsPart.split(',')) {
        const [k, v] = token.split('=');
        if (k && v != null) opts[k.trim()] = v.trim();
    }

    return {
        sourceUrl,
        width: clampInt(opts.width, 16, MAX_WIDTH, 640),
        quality: clampInt(opts.quality, 1, MAX_QUALITY, 75),
        format: opts.format || 'auto',
    };
}

function parseImgQuery(url) {
    const sourceUrl = url.searchParams.get('url') || '';
    return {
        sourceUrl,
        width: clampInt(url.searchParams.get('w') || url.searchParams.get('width'), 16, MAX_WIDTH, 640),
        quality: clampInt(url.searchParams.get('q') || url.searchParams.get('quality'), 1, MAX_QUALITY, 75),
        format: url.searchParams.get('format') || 'auto',
    };
}

function cacheHeaders(extra = {}) {
    return {
        ...IMAGE_CORS,
        'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400',
        ...extra,
    };
}

async function fetchResized(sourceUrl, { width, quality, format }, request) {
    const accept = request.headers.get('Accept') || '';
    const imageOpts = {
        width,
        quality,
        fit: 'scale-down',
    };

    // format=auto → để CF chọn theo Accept; hoặc webp/avif/jpeg tường minh
    if (format && format !== 'auto') {
        imageOpts.format = format;
    } else if (accept.includes('image/avif')) {
        imageOpts.format = 'avif';
    } else if (accept.includes('image/webp')) {
        imageOpts.format = 'webp';
    }

    return fetch(sourceUrl, {
        cf: {
            image: imageOpts,
            cacheTtl: 2592000,
            cacheEverything: true,
        },
        headers: {
            Accept: accept || 'image/*',
        },
    });
}

async function fetchOriginal(sourceUrl) {
    return fetch(sourceUrl, {
        cf: {
            cacheTtl: 2592000,
            cacheEverything: true,
        },
    });
}

/**
 * @param {Request} request
 * @param {URL} url
 */
export async function handleImageResize(request, url) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: IMAGE_CORS });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: IMAGE_CORS });
    }

    const parsed =
        url.pathname === '/img' || url.pathname === '/img/'
            ? parseImgQuery(url)
            : parseCdnPath(url.pathname);

    if (!parsed?.sourceUrl) {
        return new Response('Bad image request', { status: 400, headers: IMAGE_CORS });
    }

    if (!isAllowedSource(parsed.sourceUrl)) {
        return new Response('Source host not allowed', { status: 403, headers: IMAGE_CORS });
    }

    // 1) Thử Image Resizing (cần bật trên account CF; có thể không có trên workers.dev)
    try {
        const resized = await fetchResized(parsed.sourceUrl, parsed, request);
        if (resized.ok) {
            const headers = new Headers(resized.headers);
            for (const [k, v] of Object.entries(cacheHeaders())) {
                headers.set(k, v);
            }
            if (request.method === 'HEAD') {
                return new Response(null, { status: 200, headers });
            }
            return new Response(resized.body, { status: 200, headers });
        }
    } catch (err) {
        console.warn('[img] cf.image failed, fallback to original:', err?.message || err);
    }

    // 2) Fallback: stream ảnh gốc từ R2 public URL (vẫn sống khi domain shop hết hạn)
    try {
        const original = await fetchOriginal(parsed.sourceUrl);
        if (!original.ok) {
            return new Response('Upstream image error', {
                status: original.status,
                headers: IMAGE_CORS,
            });
        }
        const headers = new Headers(original.headers);
        for (const [k, v] of Object.entries(cacheHeaders({ 'X-Image-Fallback': 'original' }))) {
            headers.set(k, v);
        }
        if (request.method === 'HEAD') {
            return new Response(null, { status: 200, headers });
        }
        return new Response(original.body, { status: 200, headers });
    } catch (err) {
        console.error('[img] original fetch failed:', err?.message || err);
        return new Response('Failed to fetch image', { status: 502, headers: IMAGE_CORS });
    }
}

export function isImageResizePath(pathname) {
    return pathname === '/img' || pathname === '/img/' || pathname.startsWith('/cdn/image/');
}
